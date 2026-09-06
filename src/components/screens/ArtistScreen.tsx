import { useEffect } from "react";
import { useUiStore } from "../../stores/uiStore";
import { useArtistStore } from "../../stores/artistStore";
import { usePlayerStore } from "../../player/playerStore";
import type { WaveTrack } from "../../types/music";
import { coverOf, usePlayerPalette } from "../../lib/coverPalette";
import { fullscreenColors } from "../../lib/palette";
import { artFor } from "../../services/mock/data";
import { fmtTime } from "../../lib/format";

/**
 * Страница артиста в стиле приложения: большая обложка/арт, название,
 * описание сервиса (Яндекс brief-info), кнопка «слушать» и список
 * популярных треков в фирменных пилюлях.
 */
export function ArtistScreen() {
  const artistPage = useUiStore((s) => s.artistPage);
  const closeArtist = useUiStore((s) => s.closeArtist);
  const { info, loading, load } = useArtistStore();
  const playTrackFrom = usePlayerStore((s) => s.playTrackFrom);
  const isLiked = usePlayerStore((s) => s.isLiked);
  const toggleLike = usePlayerStore((s) => s.toggleLike);

  useEffect(() => {
    if (artistPage) void load(artistPage.serviceId, artistPage.artistId, artistPage.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistPage?.serviceId, artistPage?.artistId, artistPage?.name]);

  const palette = usePlayerPalette(info ? (info.popular[0] ?? null) : null);
  const colors = fullscreenColors(palette);

  if (!artistPage) return null;

  const cover = info?.coverUrl;
  const fallbackArt = artFor(`artist:${artistPage.name}`);

  const tracks = (info?.popular ?? []) as WaveTrack[];

  return (
    <div
      className="flex h-full flex-col overflow-y-auto p-7"
      style={{ background: colors.bg }}
    >
      {/* Кнопка назад */}
      <button
        onClick={closeArtist}
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-transform hover:scale-105"
        style={{ background: colors.fgSoft }}
        title="Назад в библиотеку"
      >
        <span className="material-symbols-outlined text-[26px]">arrow_back</span>
      </button>

      <div className="flex flex-col items-start gap-8 md:flex-row md:gap-10">
        {/* Обложка / фирменный арт */}
        {loading && !info ? (
          <div className="h-[220px] w-[220px] shrink-0 animate-shimmer rounded-[40px] bg-white/10 xl:h-[300px] xl:w-[300px]" />
        ) : (
          <img
            src={cover ?? fallbackArt}
            alt=""
            draggable={false}
            className="h-[220px] w-[220px] shrink-0 rounded-[40px] object-cover shadow-xl shadow-black/25 xl:h-[300px] xl:w-[300px]"
          />
        )}

        <div className="min-w-0 flex-1 pt-6">
          <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color: colors.fgSoft }}>
            Артист
          </div>
          <h1 className="mt-2 text-[44px] font-black leading-tight" style={{ color: colors.fg }}>
            {artistPage.name}
          </h1>
          {info?.listeners !== undefined && (
            <div className="mt-1 text-[14px] font-bold" style={{ color: colors.fgSoft }}>
              {info.listeners.toLocaleString("ru-RU")} слушателей за месяц
            </div>
          )}
          {info?.description && (
            <p
              className="mt-4 max-w-[640px] text-[14px] font-semibold leading-relaxed"
              style={{ color: colors.fgSoft }}
            >
              {info.description}
            </p>
          )}

          {tracks.length > 0 && (
            <button
              onClick={() => void playTrackFrom(tracks[0], tracks)}
              className="mt-6 flex items-center gap-2 rounded-full bg-black px-6 py-3 text-[15px] font-bold transition-transform hover:scale-105 active:scale-95"
              style={{ color: palette.accent }}
              title="Слушать популярное"
            >
              <span className="material-symbols-outlined ms-fill text-[22px]">play_arrow</span>
              Слушать
            </button>
          )}
        </div>
      </div>

      {/* Популярные треки */}
      <h2 className="mb-5 mt-9 text-[24px] font-extrabold" style={{ color: colors.fg }}>
        Популярные треки
      </h2>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 pb-6 md:grid-cols-2">
        {loading &&
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[88px] animate-shimmer rounded-full bg-white/10" />
          ))}

        {!loading && tracks.length === 0 && (
          <p className="col-span-2 text-[14px] font-semibold" style={{ color: colors.fgSoft }}>
            Треки не найдены
          </p>
        )}

        {!loading &&
          tracks.map((t) => (
            <div
              key={`${t.serviceId}:${t.id}`}
              onClick={() => void playTrackFrom(t, tracks)}
              className="flex h-[88px] cursor-pointer items-center gap-5 rounded-full bg-black/10 px-3 transition-colors hover:bg-black/20"
              title={`Играть: ${t.artist} — ${t.title}`}
            >
              <img
                src={coverOf(t)}
                alt=""
                draggable={false}
                className="h-[68px] w-[80px] shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold" style={{ color: colors.fg }}>
                  {t.title}
                </div>
                <div className="truncate text-[12px] font-bold" style={{ color: colors.fgSoft }}>
                  {fmtTime(t.durationSec)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleLike(t);
                }}
                className={`mr-3 shrink-0 transition-transform hover:scale-110 ${
                  isLiked(t) ? "" : "opacity-60 hover:opacity-100"
                }`}
                style={{ color: colors.fg }}
                title={isLiked(t) ? "Убрать лайк" : "Лайк"}
              >
                <span className={`material-symbols-outlined text-[24px] ${isLiked(t) ? "ms-fill" : "ms-medium"}`}>
                  thumb_up
                </span>
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
