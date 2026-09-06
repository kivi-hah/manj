// ============================================================================
// Базовый класс адаптера: общий IPC-транспорт и дефолтная сборка кандидатов
// для «Моей волны». Конкретные сервисы реализуют только «ручки» каталога
// и (при желании) переопределяют хуки fetchSimilarFor / fetchFresh.
// ============================================================================

import type {
  Playlist,
  ServiceId,
  StreamInfo,
  TasteProfileSnapshot,
  Track,
  WaveCandidates,
} from "../../types/music";
import type { IMusicService } from "./IMusicService";
import { ipc } from "../../lib/tauri";
import { hasToken } from "../../lib/secure";

export abstract class BaseMusicService implements IMusicService {
  abstract readonly id: ServiceId;
  abstract readonly name: string;
  abstract readonly short: string;

  // --- Транспорт ---------------------------------------------------------------

  /**
   * Проксированный вызов API сервиса. Токен НЕ передаётся отсюда: Rust
   * (src-tauri/src/api_proxy.rs) сам читает его из keyring и подставляет
   * в заголовки. Веб-слой никогда не видит значение токена.
   */
  protected api<T = unknown>(
    method: "GET" | "POST",
    path: string,
    opts?: { query?: Record<string, string | number>; body?: unknown }
  ): Promise<T> {
    return ipc<T>("service_request", {
      service: this.id,
      method,
      path,
      query: opts?.query ?? null,
      body: opts?.body ?? null,
    });
  }

  async isReady(): Promise<boolean> {
    try {
      return await hasToken(this.id);
    } catch {
      return false;
    }
  }

  // --- Контракт каталога (реализуют наследники) ---------------------------------

  abstract search(query: string, limit?: number): Promise<Track[]>;
  abstract getLikedTracks(limit?: number): Promise<Track[]>;
  abstract getPlaylists(limit?: number): Promise<Playlist[]>;
  abstract getTrack(id: string): Promise<Track | null>;
  abstract resolveStream(track: Track): Promise<StreamInfo>;

  // --- «Моя волна»: сборка пулов по умолчанию ------------------------------------

  /**
   * Дефолтная реализация, пригодная для большинства сервисов:
   *  taste     = ранжированные по профилю лайки + «похожее» на верхние треки;
   *  discovery = свежие релизы, отфильтрованные по низкой аффинности артиста
   *              (сам фильтр применит Discovery Engine в WaveEngine).
   */
  async getWaveCandidates(
    profile: TasteProfileSnapshot,
    limitPerPool: number
  ): Promise<WaveCandidates> {
    const liked = await this.getLikedTracks(50);

    // Достаём «похожее» на несколько любимых треков (хук конкретного сервиса).
    const seedIds = liked.slice(0, 3).map((t) => t.id);
    const similar = seedIds.length
      ? await this.fetchSimilarFor(seedIds).catch(() => [] as Track[])
      : [];

    const fresh = await this.fetchFresh().catch(() => [] as Track[]);

    return {
      taste: this.rankByProfile(liked, similar, profile, limitPerPool),
      discovery: dedupeById([...fresh, ...similar]).slice(0, limitPerPool),
    };
  }

  /**
   * Ранжирование пула по снимку вкусового профиля: tanh-аффинности артиста
   * и жанров, артист доминирует (0.6 против 0.4) — те же пропорции,
   * что и в TasteProfile.affinity.
   */
  private rankByProfile(
    liked: Track[],
    similar: Track[],
    profile: TasteProfileSnapshot,
    limit: number
  ): Track[] {
    const artistW = (name: string) => profile.artists[name.toLowerCase()] ?? 0;
    const genreW = (genres: string[]) =>
      genres.reduce((m, g) => Math.max(m, profile.genres[g.toLowerCase()] ?? 0), 0);

    const score = (t: Track) =>
      Math.tanh(artistW(t.artist) / 6) * 0.6 + Math.tanh(genreW(t.genres) / 6) * 0.4;

    return dedupeById([...liked, ...similar])
      .sort((a, b) => score(b) - score(a))
      .slice(0, limit);
  }

  // --- Хуки для наследников --------------------------------------------------------

  /** «Похожие треки» API сервиса (Яндекс /tracks/{id}/similar и т.п.). */
  protected async fetchSimilarFor(_ids: string[]): Promise<Track[]> {
    return [];
  }

  /** Свежие релизы / новинки для пула discovery. */
  protected async fetchFresh(): Promise<Track[]> {
    return [];
  }
}

function dedupeById(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    const key = `${t.serviceId}:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
