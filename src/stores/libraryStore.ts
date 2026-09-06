// ============================================================================
// Библиотека: лайки (локальные + из сервисов) и плейлисты.
// ============================================================================

import { create } from "zustand";
import type { Playlist, Track } from "../types/music";
import { SERVICE_IDS } from "../types/music";
import { history } from "../db/history";
import { activeServices, mockServices } from "../services/active";
import { toastError, toastInfo } from "./uiStore";

interface LibraryStore {
  /** Треки с экрана «Библиотека» (лайки сервисов + локальные). */
  likedTracks: Track[];
  /** id, залайканные в самом приложении (персистятся). */
  likedIds: Record<string, true>;
  playlists: Playlist[];
  loading: boolean;

  toggleLike(track: Track): Promise<boolean>; // возвращает новое состояние (залайкано?)
  load(): Promise<void>;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  likedTracks: [],
  likedIds: {},
  playlists: [],
  loading: false,

  toggleLike: async (track) => {
    const key = `${track.serviceId}:${track.id}`;
    const liked = !get().likedIds[key];
    const likedIds = { ...get().likedIds };
    if (liked) likedIds[key] = true;
    else delete likedIds[key];

    const likedTracks = liked
      ? [track, ...get().likedTracks]
      : get().likedTracks.filter(
          (t) => `${t.serviceId}:${t.id}` !== key
        );

    // Кэшируем Track-объект локальных лайков — тогда «Библиотека» покажет
    // их даже после перезапуска, когда сервис ещё не отвечал.
    const cache = (await history.kvGet<Record<string, Track>>("liked_cache")) ?? {};
    if (liked) cache[key] = track;
    else delete cache[key];

    set({ likedIds, likedTracks });
    void history.kvSet("liked_ids", likedIds);
    void history.kvSet("liked_cache", cache);
    return liked;
  },

  load: async () => {
    set({ loading: true });
    try {
      // Лайки из всех активных сервисов параллельно; сбой одного не мешает другим.
      // Лимит 8000: грузим ВСЮ медиатеку; полная вкладка показывает всё.
      const services = activeServices();
      const results = await Promise.allSettled([
        Promise.all(services.map((s) => s.getLikedTracks(8000))),
        Promise.all(services.map((s) => s.getPlaylists(6))),
      ]);

      const likedFromServices =
        results[0].status === "fulfilled"
          ? results[0].value.flat()
          : [];
      const playlists =
        results[1].status === "fulfilled" ? results[1].value.flat() : [];

      // ЛОКАЛЬНЫЙ РЕЗЕРВ: сервисы недоступны (сеть/сессия) — библиотека
      // заполняется локальным каталогом, приложение продолжает работать.
      let finalLiked = likedFromServices;
      if (finalLiked.length === 0) {
        try {
          const mocks = await Promise.all(
            mockServices().map((s) => s.getLikedTracks(24))
          );
          finalLiked = mocks.flat().map((t) => ({ ...t, demo: true }));
          if (finalLiked.length) toastInfo("Сервисы недоступны — показан локальный каталог");
        } catch {
          /* совсем без каталога — покажем пусто */
        }
      }

      const savedIds = (await history.kvGet<Record<string, true>>("liked_ids")) ?? {};

      // Треки из библиотек сервиса УЖЕ залайканы — отмечаем их,
      // чтобы кнопка лайка показывала активное состояние.
      const likedIds = { ...savedIds };
      for (const t of finalLiked) likedIds[`${t.serviceId}:${t.id}`] = true;

      // Локальные лайки, которых нет в выдаче сервисов, добавляем сверху
      // (их Track-объекты кэшируются при toggleLike в kv "liked_cache").
      const cache = (await history.kvGet<Record<string, Track>>("liked_cache")) ?? {};
      const known = new Set(finalLiked.map((t) => `${t.serviceId}:${t.id}`));
      const localLiked = Object.entries(cache)
        .filter(([key]) => savedIds[key] && !known.has(key))
        .map(([, t]) => t);

      set({
        likedTracks: [...localLiked, ...finalLiked],
        playlists,
        likedIds,
        loading: false,
      });
      void history.kvSet("liked_ids", likedIds);
    } catch (e) {
      set({ loading: false });
      toastError(e instanceof Error ? e.message : "Не удалось загрузить библиотеку");
    }
  },
}));
