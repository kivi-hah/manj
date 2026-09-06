import { useEffect, useRef, useState } from "react";
import type { ServiceId, WaveTrack } from "../../types/music";
import { activeServices } from "../../services/active";
import { usePlayerStore } from "../../player/playerStore";
import { TrackPill } from "../TrackPill";
import { PillSkeleton } from "../Skeleton";

const SHORT: Record<ServiceId, string> = {
  yandex: "ЯМ",
  vk: "VK",
};

/** Экран поиска: единый запрос по всем активным сервисам. */
export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WaveTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => void doSearch(query), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const isLiked = usePlayerStore((s) => s.isLiked);
  const toggleLike = usePlayerStore((s) => s.toggleLike);

  async function doSearch(q: string) {
    try {
      const services = activeServices();
      const settled = await Promise.allSettled(
        services.map((s) => s.search(q.trim(), 10))
      );
      const tracks: WaveTrack[] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          tracks.push(...r.value.map((t) => ({ ...t, waveSource: "taste" as const })));
        } else if (services[i]) {
          console.warn(`Поиск в ${services[i].name} не удался`, r.reason);
        }
      });
      setResults(tracks);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-7 p-7">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найдите трек или артиста во всех сервисах…"
        className="h-14 shrink-0 rounded-full bg-surface2 px-6 text-[16px] xl:h-16 xl:px-8 xl:text-[18px] font-semibold text-white outline-none ring-2 ring-transparent transition-shadow placeholder:text-white/35 focus:ring-white/20"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-x-12 gap-y-5 overflow-y-auto pb-4 md:grid-cols-2 xl:grid-cols-3">
        {searching && skeletons(6)}

        {!searching &&
          results.map((t, i) => (
            <div key={`${t.serviceId}:${t.id}:${i}`} className="relative">
              <TrackPill
                track={t}
                context={results}
                onLike={() => void toggleLike(t)}
                liked={isLiked(t)}
              />
              {/* Бейдж сервиса */}
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-bold text-white/85">
                {SHORT[t.serviceId]}
              </span>
            </div>
          ))}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="col-span-2 mt-10 text-center text-[14px] font-semibold text-sub">
            Ничего не найдено
          </p>
        )}
      </div>
    </div>
  );

  function skeletons(n: number) {
    return Array.from({ length: n }, (_, i) => <PillSkeleton key={i} height={76} />);
  }
}
