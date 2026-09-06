// ============================================================================
// Яндекс Музыка — адаптер мобильного API (api.music.yandex.net).
//
// Транспорт: OAuth-токен приложения Яндекс Музыки (перехватывается при входе,
// см. oauth.rs). Rust подставляет `Authorization: OAuth` и заголовок клиента
// `X-Yandex-Music-Client` — без него часть методов API не отвечает.
//
// ДВА КЛЮЧЕВЫХ НЮАНСА ЭТОГО API (обе причины былых «пустых» ответов):
//   1) КАЖДЫЙ ответ завёрнут в {"result": ...} — всегда разворачиваем .result;
//   2) списки треков приходят обёрнутыми: items[].track — всегда разворачиваем.
// ============================================================================

import type {
  ArtistInfo,
  Playlist,
  ServiceId,
  StreamInfo,
  TasteProfileSnapshot,
  Track,
  WaveCandidates,
} from "../../types/music";
import { BaseMusicService } from "../core/BaseMusicService";
import { ipc } from "../../lib/tauri";

export class YandexMusicService extends BaseMusicService {
  readonly id: ServiceId = "yandex";
  readonly name = "Яндекс Музыка";
  readonly short = "ЯМ";

  // --- Поиск -------------------------------------------------------------------

  async search(query: string, limit = 12): Promise<Track[]> {
    const r = await this.api<any>("GET", "/search", {
      query: { text: query, type: "track", pageSize: limit },
    });
    const items = r?.result?.tracks?.items ?? [];
    return items.map((i: any) => mapTrack(i?.track ?? i)).filter(valid);
  }

  // --- Медиатека -----------------------------------------------------------------

  /** Лайки: uid аккаунта → полный список id → батчи треков (по 50 на запрос). */
  async getLikedTracks(limit = 500): Promise<Track[]> {
    const status = await this.api<any>("GET", "/account/status");
    const uid: string = String(status?.result?.account?.uid ?? "");
    if (!uid) throw new Error("Яндекс: аккаунт не распознан (токен недействителен?)");

    const likes = await this.api<any>("GET", `/users/${uid}/likes/tracks`);
    // В библиотеке id лежат строками вида "trackId:albumId"
    const ids: string[] = (likes?.result?.library?.tracks ?? [])
      .map((x: any) => String(x?.id ?? "").split(":")[0])
      .filter(Boolean)
      .slice(0, limit);
    if (!ids.length) return [];

    // Батчи по 50: URL с сотнями id может не влезть в лимиты запроса.
    const out: Track[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50).join(",");
      const batch = await this.api<any>("GET", "/tracks", {
        query: { "track-ids": chunk },
      });
      out.push(
        ...((batch?.result ?? []) as any[])
          .map((x) => mapTrack(x?.track ?? x))
          .filter(valid)
      );
    }
    return out;
  }

  async getPlaylists(limit = 6): Promise<Playlist[]> {
    try {
      const status = await this.api<any>("GET", "/account/status");
      const uid: string = String(status?.result?.account?.uid ?? "");
      if (!uid) return [];
      const r = await this.api<any>("GET", `/users/${uid}/playlists/list`);
      return ((r?.result ?? []) as any[]).slice(0, limit).map((p) => ({
        id: String(p.kind ?? p.id),
        serviceId: this.id,
        name: p.title ?? "Плейлист",
        trackCount: p.trackCount ?? 0,
        coverUrl: p.ogImage ? enlargenImage(p.ogImage) : undefined,
      }));
    } catch {
      return [];
    }
  }

  async getTrack(id: string): Promise<Track | null> {
    const r = await this.api<any>("GET", "/tracks", { query: { "track-ids": id } });
    const raw = (r?.result ?? [])[0];
    return raw ? mapTrack(raw?.track ?? raw) : null;
  }

  // --- Воспроизведение -------------------------------------------------------------

  /**
   * Поток: двухшаговый алгоритм Яндекса (download-info → XML → подписанный
   * mp3-URL). Подпись md5 и работа с токеном — в Rust-команде resolve_stream,
   * фронтенд получает готовый короткоживущий URL.
   */
  async resolveStream(track: Track): Promise<StreamInfo> {
    return ipc<{ url: string; kind: "mp3" | "hls" }>("resolve_stream", {
      service: this.id,
      trackId: track.id,
    });
  }

  // --- «Моя волна» -------------------------------------------------------------------

  /**
   * Кандидаты волны: вкус = лайки, ранжированные снимком профиля;
   * открытия = похожее на верхние лайки (/tracks/{id}/similar) + чарт.
   */
  override async getWaveCandidates(
    profile: TasteProfileSnapshot,
    limitPerPool: number
  ): Promise<WaveCandidates> {
    const liked = await this.getLikedTracks(60);
    const weights = new Map<string, number>(Object.entries(profile.artists));

    const taste = [...liked]
      .sort(
        (a, b) =>
          (weights.get(b.artist.toLowerCase()) ?? 0) -
          (weights.get(a.artist.toLowerCase()) ?? 0)
      )
      .slice(0, limitPerPool);

    const seedIds = taste.slice(0, 3).map((t) => t.id);
    const similar = await this.fetchSimilarFor(seedIds).catch(() => [] as Track[]);
    const fresh = await this.fetchFresh().catch(() => [] as Track[]);

    // Discovery: новое/похожее от артистов, которых пользователь ещё не слушал.
    const discovery = [...fresh, ...similar]
      .filter((t) => !weights.has(t.artist.toLowerCase()))
      .slice(0, limitPerPool);

    return { taste, discovery };
  }

  /** /tracks/{id}/similar — штатное «похожее» Яндекса. */
  protected override async fetchSimilarFor(ids: string[]): Promise<Track[]> {
    const out: Track[] = [];
    for (const id of ids) {
      const r = await this.api<any>("GET", `/tracks/${id}/similar`);
      for (const t of r?.result?.similarTracks ?? []) out.push(mapTrack(t?.track ?? t));
    }
    return out.filter(valid);
  }

  /** Чарт как источник свежего для пула открытий. */
  protected override async fetchFresh(): Promise<Track[]> {
    const r = await this.api<any>("GET", "/landing3/chart");
    return ((r?.result?.chart?.tracks ?? []) as any[])
      .map((c) => mapTrack(c?.track ?? c))
      .filter(valid)
      .slice(0, 20);
  }

  /** Страница артиста: brief-info (обложка, описание) + популярные треки. */
  async getArtist(artistId: string | undefined, name: string): Promise<ArtistInfo | null> {
    if (!artistId) return null;
    try {
      const r = await this.api<any>("GET", `/artists/${artistId}/brief-info`);
      const result = r?.result ?? {};
      const artist = result.artist ?? {};
      const popular = ((result.popularTracks ?? []) as any[])
        .map((t) => mapTrack(t?.track ?? t))
        .filter(valid)
        .slice(0, 10);
      return {
        id: String(artistId),
        serviceId: this.id,
        name: artist.name ?? name,
        coverUrl: artist.ogImage
          ? enlargenImage(artist.ogImage).replace("200x200", "600x600")
          : undefined,
        description: result.description?.text ?? undefined,
        listeners: artist.stats?.lastMonthListeners,
        popular,
      };
    } catch {
      return null;
    }
  }

  /** «Похожее» на трек — для «Волны по треку». */
  async getSimilar(track: Track): Promise<Track[]> {
    const r = await this.api<any>("GET", `/tracks/${track.id}/similar`);
    return ((r?.result?.similarTracks ?? []) as any[])
      .map((t) => mapTrack(t?.track ?? t))
      .filter(valid)
      .slice(0, 15);
  }
}

// --- Мапперы -----------------------------------------------------------------

function valid(t: Track): boolean {
  return !!t.id && t.id !== "unknown" && !!t.title;
}

function mapTrack(t: any): Track {
  if (!t) {
    return {
      id: "unknown",
      serviceId: "yandex",
      title: "Без названия",
      artist: "",
      genres: [],
      durationSec: 0,
    };
  }
  return {
    id: String(t.id),
    serviceId: "yandex",
    title: t.title ?? "Без названия",
    artist:
      t.artists
        ?.map((a: any) => a?.name)
        .filter(Boolean)
        .join(", ") || "Неизвестный артист",
    artistId: t.artists?.[0] ? String(t.artists[0].id) : undefined,
    genres: [],
    durationSec: Math.round((t.durationMs ?? 0) / 1000),
    coverUrl: t.coverUri ? enlargenImage(t.coverUri) : undefined,
    albumId: t.albums?.[0] ? String(t.albums[0].id) : undefined,
  } as Track;
}

/** Шаблон обложки Яндекса: %%size%%x%%size%% → 400x400 (высокое качество). */
function enlargenImage(template: string): string {
  return `https://${template.replace("%%", "400x400")}`;
}
