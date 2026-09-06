// ============================================================================
// TasteProfile — «вкусовой профиль» пользователя.
//
// Хранит веса артистов, жанров и сервисов. Обновляется событиями прослушивания
// и затухает со временем (упущенный интерес перестаёт доминировать).
//
// Правила адаптации (требования ТЗ):
//   скип в начале трека  → сильный минус артисту/жанру  («похожее надоело»);
//   скип в конце трека   → почти нейтрален (дослушал почти целиком);
//   дослушивание         → плюс артисту/жанру;
//   лайк                 → большой плюс;
//   лайк трека-открытия  → ещё больший плюс (алгоритм попал в точку).
// ============================================================================

import type { TasteProfileSnapshot, Track } from "../types/music";

/** Тип события, приходящего в профиль (скип классифицируется по позиции). */
export type ListenEventType =
  | "like"
  | "unlike"
  | "discover_like"
  | "complete"
  | "near_complete"
  | "skip_early"
  | "skip"
  | "play";

export interface ListenEvent {
  type: ListenEventType;
  track: Track;
  /** Позиция в момент события (сек) — обязательна для корректного скипа. */
  positionSec?: number;
  ts?: number;
}

/** Дельты весов на каждое событие. Вынесены в константы — легко калибровать. */
const DELTAS: Record<ListenEventType, { artist: number; genre: number; service: number }> = {
  like: { artist: 3.0, genre: 2.0, service: 0.5 },
  // Лайк трека-открытия — самый сильный сигнал: новое имя «зашло».
  discover_like: { artist: 3.5, genre: 2.5, service: 0.5 },
  complete: { artist: 1.0, genre: 0.6, service: 0.3 },
  near_complete: { artist: 0.2, genre: 0.1, service: 0.1 },
  skip_early: { artist: -1.6, genre: -0.9, service: -0.2 },
  skip: { artist: -0.6, genre: -0.3, service: 0.0 },
  play: { artist: 0.1, genre: 0.05, service: 0.1 },
  unlike: { artist: -2.0, genre: -1.5, service: 0.0 },
};

/** Границы веса: не даём ни «чёрным дырам», ни вечным обидам. */
const WEIGHT_MIN = -5;
const WEIGHT_MAX = 20;

/** Каждые 12 часов бездействия все веса затухают на 3%. */
const DECAY_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DECAY_FACTOR = 0.97;

export interface TasteProfileData {
  artists: Record<string, number>;
  genres: Record<string, number>;
  services: Record<string, number>;
  lastDecay: number;
  totalEvents: number;
}

function clamp(w: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w));
}

export class TasteProfile {
  private data: TasteProfileData;

  constructor(data?: TasteProfileData) {
    this.data = data ?? {
      artists: {},
      genres: {},
      services: {},
      lastDecay: Date.now(),
      totalEvents: 0,
    };
  }

  // --- Чтение ---------------------------------------------------------------

  artistWeight(artist: string): number {
    return this.data.artists[artist.toLowerCase()] ?? 0;
  }

  genreWeight(genre: string): number {
    return this.data.genres[genre.toLowerCase()] ?? 0;
  }

  serviceWeight(serviceId: string): number {
    return this.data.services[serviceId] ?? 0;
  }

  /** Нормированная (0..1) аффинность к артисту через tanh — сглаживает хвосты. */
  artistAffinity(artist: string): number {
    return Math.tanh(this.artistWeight(artist) / 6);
  }

  /** Нормированная аффинность к набору жанров трека: берём максимум из тегов. */
  genreAffinity(genres: string[]): number {
    if (!genres.length) return 0.2; // у трека без жанров — нейтральный приоритет
    let max = -Infinity;
    for (const g of genres) max = Math.max(max, this.genreWeight(g));
    return Math.tanh(max / 6);
  }

  /** Итоговая оценка трека: артист доминирует, жанр и сервис — коррективы. */
  affinity(track: Track): number {
    return (
      this.artistAffinity(track.artist) * 0.6 +
      this.genreAffinity(track.genres) * 0.3 +
      Math.tanh(this.serviceWeight(track.serviceId) / 3) * 0.1
    );
  }

  /** Отсортировать треки по убыванию аффинности (для пула «вкуса»). */
  rank<T extends Track>(tracks: T[]): T[] {
    return [...tracks].sort((a, b) => this.affinity(b) - this.affinity(a));
  }

  // --- Запись -----------------------------------------------------------------

  /** Применить событие прослушивания к весам. */
  apply(ev: ListenEvent): void {
    this.decayIfNeeded();

    const d = DELTAS[ev.type];
    const artistKey = ev.track.artist.toLowerCase();
    const serviceKey = ev.track.serviceId;

    this.data.artists[artistKey] = clamp(
      (this.data.artists[artistKey] ?? 0) + d.artist
    );

    for (const g of ev.track.genres) {
      const key = g.toLowerCase();
      this.data.genres[key] = clamp((this.data.genres[key] ?? 0) + d.genre);
    }

    this.data.services[serviceKey] = clamp(
      (this.data.services[serviceKey] ?? 0) + d.service
    );

    this.data.totalEvents += 1;
  }

  /** Периодическое затухание весов: интересы пользователя меняются. */
  private decayIfNeeded(): void {
    const now = Date.now();
    if (now - this.data.lastDecay < DECAY_INTERVAL_MS) return;
    const apply = (map: Record<string, number>) => {
      for (const k of Object.keys(map)) map[k] = clamp(map[k] * DECAY_FACTOR);
    };
    apply(this.data.artists);
    apply(this.data.genres);
    apply(this.data.services);
    this.data.lastDecay = now;
  }

  // --- Сериализация ------------------------------------------------------------

  snapshot(): TasteProfileSnapshot {
    return {
      artists: { ...this.data.artists },
      genres: { ...this.data.genres },
      services: { ...this.data.services },
      totalEvents: this.data.totalEvents,
    };
  }

  toJSON(): TasteProfileData {
    return structuredClone(this.data);
  }

  static fromJSON(json: TasteProfileData): TasteProfile {
    return new TasteProfile({
      artists: json.artists ?? {},
      genres: json.genres ?? {},
      services: json.services ?? {},
      lastDecay: json.lastDecay ?? Date.now(),
      totalEvents: json.totalEvents ?? 0,
    });
  }
}
