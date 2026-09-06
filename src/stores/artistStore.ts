// ============================================================================
// Страница артиста: данные сервиса, завёрнутые в дизайн Manj.
// ============================================================================

import { create } from "zustand";
import type { ArtistInfo, ServiceId, Track, WaveTrack } from "../types/music";
import { serviceFor } from "../services/active";
import { toastError } from "./uiStore";

interface ArtistStore {
  info: ArtistInfo | null;
  loading: boolean;
  /** Последний запрос — чтобы игнорировать устаревшие ответы. */
  reqKey: string;

  load(serviceId: ServiceId, artistId: string | undefined, name: string): Promise<void>;
}

export const useArtistStore = create<ArtistStore>((set, get) => ({
  info: null,
  loading: false,
  reqKey: "",

  load: async (serviceId, artistId, name) => {
    const key = `${serviceId}:${artistId ?? ""}:${name}`;
    set({ loading: true, reqKey: key });
    const service = serviceFor(serviceId);
    if (!service?.getArtist) {
      set({ loading: false, info: null });
      return;
    }
    try {
      const info = await service.getArtist(artistId, name);
      // Пришли только если запрос всё ещё актуален (пользователь мог уйти).
      if (get().reqKey === key) set({ info, loading: false });
    } catch (e) {
      if (get().reqKey === key) {
        set({ loading: false, info: null });
        toastError(
          typeof e === "string" ? e : e instanceof Error ? e.message : "Не удалось загрузить артиста"
        );
      }
    }
  },
}));

/** Удобный тип для списков треков на странице артиста. */
export type ArtistTrack = WaveTrack | Track;
