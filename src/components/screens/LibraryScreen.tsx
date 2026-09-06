import { useEffect } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../player/playerStore";
import { useUiStore } from "../../stores/uiStore";
import type { WaveTrack } from "../../types/music";
import { TrackPill } from "../TrackPill";
import { PillSkeleton } from "../Skeleton";

const GRID_LIMIT = 16; // сетка 4×4

/**
 * Библиотека по макету: розовый баннер «Библиотека ваших любимых треков»,
 * сетка 3×3 с полосатыми обложками. Если лайков больше 9 — кнопка
 * «Показать все» ведёт в отдельную вкладку (library-all).
 */
export function LibraryScreen() {
  const { likedTracks, playlists, loading, load } = useLibraryStore();
  const isLiked = usePlayerStore((s) => s.isLiked);
  const toggleLikeInPlayer = usePlayerStore((s) => s.toggleLike);
  const setScreen = useUiStore((s) => s.setScreen);

  useEffect(() => {
    if (!likedTracks.length && !playlists.length) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const context = likedTracks as WaveTrack[];
  const visible = likedTracks.slice(0, GRID_LIMIT);
  const extra = likedTracks.length - visible.length;

  return (
    <div className="flex h-full flex-col gap-5 p-5 xl:gap-7 xl:p-7">
      {/* Баннер */}
      <div className="flex h-[120px] shrink-0 items-center justify-center rounded-hero bg-gradient-to-r from-pinkA to-pinkB xl:h-[170px]">
        <h1 className="text-[24px] font-black tracking-tight xl:text-[34px] text-[#1f1f1f]">
          Библиотека ваших любимых треков
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 pr-2 md:grid-cols-3 xl:grid-cols-4">
          {loading && skeletons(GRID_LIMIT)}

          {!loading && likedTracks.length === 0 && (
            <p className="col-span-3 mt-10 text-center text-[14px] font-semibold text-sub">
              Лайкните треки — они появятся здесь и в вашей волне
            </p>
          )}

          {!loading &&
            visible.map((t) => (
              <TrackPill
                key={`${t.serviceId}:${t.id}`}
                track={t as WaveTrack}
                context={context}
                onLike={() => void toggleLikeInPlayer(t)}
                liked={isLiked(t)}
                showArtist={false}
              />
            ))}
        </div>

        {/* Больше 10 треков — отдельная вкладка */}
        {extra > 0 && (
          <button
            onClick={() => setScreen("library-all")}
            className="mt-7 flex items-center gap-2 rounded-full bg-surface2 px-6 py-3 text-[15px] font-bold transition-all hover:scale-105 active:scale-95"
            title="Открыть все треки"
          >
            <span className="material-symbols-outlined ms-medium text-[22px]">library_music</span>
            Показать все ({likedTracks.length})
          </button>
        )}

        {/* Плейлисты — компактно под сеткой */}
        {!loading && playlists.length > 0 && (
          <div className="mt-9">
            <h2 className="mb-5 text-[24px] font-extrabold">Плейлисты</h2>
            <div className="grid grid-cols-3 gap-x-8 gap-y-5 pr-2">
              {playlists.slice(0, 6).map((p) => (
                <div
                  key={`${p.serviceId}:${p.id}`}
                  className="flex h-[88px] cursor-pointer items-center gap-5 rounded-full bg-surface3 px-3 transition-all duration-200 hover:bg-surface4"
                  title={`Плейлист: ${p.name}`}
                >
                  <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/25 to-white/5">
                    <span className="material-symbols-outlined ms-fill text-[28px] text-white/80">
                      queue_music
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="truncate text-[16px] font-bold leading-tight">{p.name}</div>
                    <div className="truncate text-[12px] font-bold text-sub">
                      {p.trackCount} треков
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function skeletons(n: number) {
    return Array.from({ length: n }, (_, i) => <PillSkeleton key={i} height={108} />);
  }
}
