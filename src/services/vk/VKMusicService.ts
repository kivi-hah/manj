// ============================================================================
// VK Музыка.
//
// Транспорт: Rust-прокси добавляет `Authorization: Bearer <token>` и
// автоматически параметр v=5.199 (см. api_proxy.rs).
// Нюанс: методы audio.* доступны только standalone-токенам с правом audio —
// получать их нужно через OAuth VK ID с соответствующим scope.
// ============================================================================

import type {
  ArtistInfo,
  Playlist,
  ServiceId,
  StreamInfo,
  Track,
} from "../../types/music";
import { BaseMusicService } from "../core/BaseMusicService";

export class VKMusicService extends BaseMusicService {
  readonly id: ServiceId = "vk";
  readonly name = "VK Музыка";
  readonly short = "VK";

  /** audio.search → items[]. */
  async search(query: string, limit = 12): Promise<Track[]> {
    const r = await this.api<any>("POST", "/method/audio.search", {
      query: { q: query, count: limit },
    });
    return (r?.response?.items ?? []).map((i: any) => mapTrack(i));
  }

  /** «Похожее» на трек — рекомендации VK с целевым аудио. */
  async getSimilar(track: Track): Promise<Track[]> {
    const r = await this.api<any>("POST", "/method/audio.getRecommendations", {
      query: { target_audio: track.id, count: 15 },
    });
    return (r?.response?.items ?? []).map((i: any) => mapTrack(i));
  }

  /** audio.get — личная аудиотека (страницами по 1000, до полного конца). */
  async getLikedTracks(limit = 500): Promise<Track[]> {
    const out: Track[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (out.length < limit) {
      const r = await this.api<any>("POST", "/method/audio.get", {
        query: { count: pageSize, offset },
      });
      const items: any[] = r?.response?.items ?? [];
      if (!items.length) break; // дошли до конца аудиотеки
      out.push(...items.map((i: any) => mapTrack(i)));
      offset += items.length;
      if (items.length < pageSize) break;
    }
    return out.slice(0, limit);
  }

  async getPlaylists(limit = 10): Promise<Playlist[]> {
    // У VK аудио-плейлисты отдаются методом audio.getPlaylists.
    const r = await this.api<any>("POST", "/method/audio.getPlaylists", {
      query: { count: limit },
    });
    return (r?.response?.items ?? []).map((p: any) => ({
      id: String(p.id),
      serviceId: this.id,
      name: p.title,
      trackCount: p.count ?? 0,
      coverUrl: p.photo?.photo_300 ?? undefined,
    }));
  }

  async getTrack(id: string): Promise<Track | null> {
    const r = await this.api<any>("POST", "/method/audio.getById", {
      query: { audios: id },
    });
    return r?.response?.[0] ? mapTrack(r.response[0]) : null;
  }

  /**
   * Страница артиста для VK: у VK Audio API нет прямого метода страниц
   * артистов, поэтому собираем её из поиска по имени (обложки/описания нет —
   * используем фирменный полосатый арт и популярное из поиска).
   */
  async getArtist(_artistId: string | undefined, name: string): Promise<ArtistInfo | null> {
    try {
      const r = await this.api<any>("POST", "/method/audio.search", {
        query: { q: name, count: 20 },
      });
      const items: Track[] = (r?.response?.items ?? [])
        .map((i: any) => mapTrack(i))
        .filter((t: Track) => t.artist.toLowerCase() === name.toLowerCase());
      if (!items.length) return null;
      return {
        id: `vk-search:${name}`,
        serviceId: this.id,
        name,
        popular: items.slice(0, 10),
      };
    } catch {
      return null;
    }
  }

  /**
   * VK возвращает прямые mp3/m3u8 ссылки в поле url аудиотреков
   * (см. mapTrack). Пустое поле — трек недоступен без подписки
   * или запрещён правообладателем.
   */
  async resolveStream(track: Track): Promise<StreamInfo> {
    const full = (await this.getTrack(track.id)) as (Track & { url?: string }) | null;
    const raw = full?.url;
    if (!raw) throw new Error("VK: поток недоступен (ограничение правообладателя?)");
    return {
      url: raw,
      // VK отдаёт либо прямые mp3, либо сегментированные m3u8
      kind: raw.includes(".m3u8") ? "hls" : "mp3",
    };
  }

  /** audio.getRecommendations — готовые «похожие» от VK. */
  protected override async fetchSimilarFor(ids: string[]): Promise<Track[]> {
    const r = await this.api<any>("POST", "/method/audio.getRecommendations", {
      query: { target_audio: ids[0], count: 20 },
    });
    return (r?.response?.items ?? []).map((i: any) => mapTrack(i));
  }
}

function mapTrack(i: any): Track & { url?: string } {
  return {
    id: String(i.id),
    serviceId: "vk",
    title: i.title ?? "Без названия",
    artist: i.artist ?? "Неизвестный артист",
    genres: [],
    durationSec: Number(i.duration ?? 0),
    coverUrl: i.album?.thumb?.photo_300 ?? undefined,
    // Прямая ссылка приходит в audio.get — сохраняем рядом с треком,
    // чтобы resolveStream не делал лишний запрос.
    url: i.url ?? undefined,
  } as Track & { url?: string };
}
