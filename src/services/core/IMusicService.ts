// ============================================================================
// ПАТТЕРН «АДАПТЕР»: единый контракт для всех стриминговых платформ.
//
// UI, плеер и WaveEngine общаются с любым сервисом ТОЛЬКО через этот
// интерфейс. Добавление нового сервиса = один новый класс + регистрация
// в ServiceRegistry, без единой правки в UI или алгоритме волны.
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
export interface IMusicService {
  /** Машиночитаемый id ('yandex' | 'vk' | 'spotify' | 'soundcloud'). */
  readonly id: ServiceId;
  /** Человекочитаемое имя — «Яндекс Музыка» и т.д. */
  readonly name: string;
  /** Короткий бейдж для чипов в UI — «ЯМ», «VK», «SP», «SC». */
  readonly short: string;

  /** Готов ли сервис отдавать данные (есть токен / это mock). */
  isReady(): Promise<boolean>;

  // --- Каталог ---------------------------------------------------------------

  search(query: string, limit?: number): Promise<Track[]>;
  getLikedTracks(limit?: number): Promise<Track[]>;
  getPlaylists(limit?: number): Promise<Playlist[]>;
  getTrack(id: string): Promise<Track | null>;

  /**
   * Страница артиста (обложка, описание, популярное).
   * `artistId` может отсутствовать (VK) — тогда ищем по имени.
   */
  getArtist?(artistId: string | undefined, name: string): Promise<ArtistInfo | null>;

  /** «Похожее» на трек — режим «Волна по треку». */
  getSimilar?(track: Track): Promise<Track[]>;

  // --- Воспроизведение ---------------------------------------------------------

  /**
   * Разворачивает трек в воспроизводимый поток (mp3/hls).
   * Может вернуть stream://… прокси-URL, если CDN требует заголовки авторизации.
   */
  resolveStream(track: Track): Promise<StreamInfo>;

  // --- «Моя волна» ---------------------------------------------------------------

  /**
   * Кандидаты для движка волны. Реализации используют связку:
   *  — taste: лайки + топы артистов из профиля + похожие треки API;
   *  — discovery: свежие релизы / рекомендации по жанрам профиля.
   */
  getWaveCandidates(
    profile: TasteProfileSnapshot,
    limitPerPool: number
  ): Promise<WaveCandidates>;
}
