// ============================================================================
// MockMusicService — полнофункциональный адаптер поверх локального каталога.
// Используется в демо-режиме для каждого из четырёх «виртуальных» сервисов,
// поэтому логотипы/бейджи в UI выглядят как настоящие интеграции.
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
import type { IMusicService } from "../core/IMusicService";
import { MOCK_ARTISTS, MOCK_PLAYLISTS, MOCK_TRACKS } from "./data";
import { mockStreamUrl } from "./audio";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockMusicService implements IMusicService {
  constructor(
    readonly id: ServiceId,
    readonly name: string,
    readonly short: string,
    private likedIds: Set<string>
  ) {}

  /** Mock всегда готов. */
  async isReady(): Promise<boolean> {
    return true;
  }

  private tracksOf(serviceOnly = true): Track[] {
    return serviceOnly ? MOCK_TRACKS.filter((t) => t.serviceId === this.id) : MOCK_TRACKS;
  }

  async search(query: string, limit = 12): Promise<Track[]> {
    await sleep(150 + Math.random() * 250); // имитация сети — видны скелетоны
    const q = query.toLowerCase();
    return this.tracksOf()
      .filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      )
      .slice(0, limit);
  }

  async getLikedTracks(limit = 20): Promise<Track[]> {
    await sleep(200 + Math.random() * 300);
    return MOCK_TRACKS.filter(
      (t) => t.serviceId === this.id && this.likedIds.has(t.id)
    ).slice(0, limit);
  }

  async getPlaylists(limit = 8): Promise<Playlist[]> {
    await sleep(180 + Math.random() * 200);
    return MOCK_PLAYLISTS.filter((p) => p.serviceId === this.id).slice(0, limit);
  }

  async getTrack(id: string): Promise<Track | null> {
    return MOCK_TRACKS.find((t) => t.id === id) ?? null;
  }

  /** Страница артиста из локального каталога (по имени). */
  async getArtist(_artistId: string | undefined, name: string): Promise<ArtistInfo | null> {
    await sleep(150);
    const artist = MOCK_ARTISTS.find((a) => a.name === name);
    if (!artist) return null;
    const popular = MOCK_TRACKS.filter((t) => t.artist === name).slice(0, 8);
    return {
      id: artist.id,
      serviceId: this.id,
      name: artist.name,
      description: `${artist.name} — демо-артист локального каталога Manj. Жанры: ${artist.genres.join(", ")}.`,
      popular,
    };
  }

  /** «Похожее» — треки того же артиста (демо). */
  async getSimilar(track: Track): Promise<Track[]> {
    await sleep(150);
    return MOCK_TRACKS.filter(
      (t) => t.artist === track.artist && t.id !== track.id
    ).slice(0, 10);
  }

  async resolveStream(track: Track): Promise<StreamInfo> {
    await sleep(80);
    return { url: mockStreamUrl(track.id, track.durationSec), kind: "mp3" };
  }

  /**
   * Кандидаты для волны из локального каталога:
   *  — taste: лайки + остальные треки тех же артистов (обогащение пула);
   *  — discovery: треки артистов, которых в лайках нет вовсе.
   * В реальных адаптерах вместо этого вызываются recommendation-API.
   */
  async getWaveCandidates(
    profile: TasteProfileSnapshot,
    limitPerPool: number
  ): Promise<WaveCandidates> {
    const liked = MOCK_TRACKS.filter((t) => this.likedIds.has(t.id));
    const likedArtists = new Set(liked.map((t) => t.artist));

    const taste = [...liked];
    for (const t of MOCK_TRACKS) {
      if (taste.length >= limitPerPool * 2) break;
      if (likedArtists.has(t.artist) && !this.likedIds.has(t.id)) taste.push(t);
    }

    const knownArtists = new Set([
      ...likedArtists,
      ...Object.keys(profile.artists).filter((a) => profile.artists[a] > 1),
    ]);
    const discovery = MOCK_TRACKS.filter(
      (t) => !knownArtists.has(t.artist)
    ).slice(0, limitPerPool * 2);

    return { taste, discovery };
  }
}
