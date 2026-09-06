import { useEffect } from "react";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../player/playerStore";
import { useUiStore } from "../../stores/uiStore";
import type { WaveTrack } from "../../types/music";
import { TrackPill } from "../TrackPill";

/** Полная вкладка библиотеки: все лайки без ограничения 3×3. */
export function LibraryAllScreen() {
  const { likedTracks, loading, load } = useLibraryStore();
  const isLiked = usePlayerStore((s) => s.isLiked);
  const toggleLikeInPlayer = usePlayerStore((s) => s.toggleLike);
  const setScreen = useUiStore((s) => s.setScreen);

  useEffect(() => {
    if (!likedTracks.length) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const context = likedTracks as WaveTrack[];

  return (
    <div className="flex h-full flex-col p-7">
      <div className="mb-6 flex items-center gap-5">
        <button
          onClick={() => setScreen("library")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface2 transition-transform hover:scale-105"
          title="Назад к сетке библиотеки"
        >
          <span className="material-symbols-outlined text-[26px]">arrow_back</span>
        </button>
        <h1 className="text-[30px] font-black tracking-tight">Все любимые треки</h1>
        <span className="rounded-full bg-surface2 px-4 py-1 text-[13px] font-bold text-sub">
          {likedTracks.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pr-2">
        <div className="grid grid-cols-2 content-start gap-x-5 gap-y-5 md:grid-cols-3 xl:grid-cols-4">
          {loading &&
            Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="h-[120px] animate-shimmer rounded-full bg-surface3" />
            ))}

          {!loading && likedTracks.length === 0 && (
            <p className="col-span-3 mt-10 text-center text-[14px] font-semibold text-sub">
              Пока пусто — лайкайте треки
            </p>
          )}

          {!loading &&
            likedTracks.map((t) => (
              <TrackPill
                key={`${t.serviceId}:${t.id}`}
                track={t as WaveTrack}
                context={context}
                onLike={() => void toggleLikeInPlayer(t)}
                liked={isLiked(t)}
                showArtist
              />
            ))}
        </div>
      </div>
    </div>
  );
}
