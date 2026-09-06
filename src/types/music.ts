// ============================================================================
// Общие типы музыкального домена.
// Все адаптеры стриминговых сервисов работают ТОЛЬКО с этими структурами —
// так UI и движок «Моя волна» не знают ничего о конкретных API.
// ============================================================================

export type ServiceId = "yandex" | "vk";

/** Откуда трек попал в очередь «Моей волны». */
export type WaveSource = "taste" | "discovery";

/** Порядок обхода сервисов везде в приложении (Spotify/SoundCloud исключены). */
export const SERVICE_IDS: ServiceId[] = ["yandex", "vk"];

/** Цветовые варианты полосатой обложки из макета (Rectangle 25/52/53). */
export type AccentId = "pink" | "green" | "blue";

export interface Track {
  /** Уникальный id в рамках сервиса (например, числовой id трека Яндекса). */
  id: string;
  serviceId: ServiceId;
  title: string;
  artist: string;
  artistId?: string;
  /** Жанровые теги — топливо для вкусового профиля. */
  genres: string[];
  /** Длительность в секундах. */
  durationSec: number;
  /** URL обложки (может отсутствовать — тогда рисуем плейсхолдер). */
  coverUrl?: string;
  /** Идентификатор альбома (нужен Яндексу для разворачивания потока). */
  albumId?: string;
  /** Трек из локального каталога — поток отдаёт mock-адаптер, а не сервис. */
  demo?: boolean;
  /** Вариант фирменной полосатой обложки и цвета плеера (демо/без обложки). */
  accentId?: AccentId;
}

/** Трек в контексте очереди «Моей волны»: помним, зачем он здесь. */
export interface WaveTrack extends Track {
  waveSource: WaveSource;
}

export interface Playlist {
  id: string;
  serviceId: ServiceId;
  name: string;
  trackCount: number;
  coverUrl?: string;
}

/** Результат разворачивания трека в поток. */
export interface StreamInfo {
  /**
   * Адрес потока. В зависимости от сервиса это может быть:
   *  — подписанный URL CDN ( mp3 / m3u8 ),
   *  — blob: URL с демо-звуком (mock-режим),
   *  — stream://… прокси (когда CDN требует заголовки авторизации —
   *    тогда реальный адрес остаётся внутри Rust и в веб-слой не попадает).
   */
  url: string;
  kind: "mp3" | "hls" | "drm";
}

/** Снимок вкусового профиля, который адаптеры получают для подбора кандидатов. */
export interface TasteProfileSnapshot {
  artists: Record<string, number>;
  genres: Record<string, number>;
  services: Record<string, number>;
  totalEvents: number;
}

/** Что сервис отдаёт движку волны: два пула кандидатов. */
export interface WaveCandidates {
  /** Треки «под вкус» — лайки, любимые артисты, похожее. */
  taste: Track[];
  /** Треки для открытия — новые имена, свежие релизы. */
  discovery: Track[];
}

/** Режим «Моей волны»: стандартный микс / популярное / любимое / незнакомое. */
export type WaveMode = "mix" | "popular" | "favorites" | "unfamiliar";

/** Страница артиста: обложка/описание + популярные треки. */
export interface ArtistInfo {
  id: string;
  serviceId: ServiceId;
  name: string;
  coverUrl?: string;
  /** Короткое описание (у Яндекса — из brief-info; у VK может отсутствовать). */
  description?: string;
  /** Число слушателей/подписчиков, если сервис отдаёт. */
  listeners?: number;
  /** Популярные треки для страницы. */
  popular: Track[];
}
