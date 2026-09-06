import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { usePlayerStore } from "../player/playerStore";
import { useUiStore } from "../stores/uiStore";
import { fmtTime } from "../lib/format";
import { ART_BY_ACCENT, fullscreenColors } from "../lib/palette";
import { usePlayerPalette } from "../lib/coverPalette";
import { useExitAnimation } from "../lib/useExitAnimation";
import { artFor } from "../services/mock/data";
import type { WaveTrack } from "../types/music";

/**
 * Полноэкранный режим плеера.
 * Слева — большая обложка: при наведении она размывается и появляются
 * кнопки «назад» (слева), play/pause (центр), «вперёд» (справа) и лайк
 * (нижний правый угол обложки). Ниже — название/автор и слайдер перемотки.
 * Справа — очередь: треки, которые уже играли (история сессии), текущий
 * и следующий. История очищается при запуске новой волны/закрытии.
 * Фон и акцент — из палитры обложки (следует и цвету логотипа).
 */
export function FullscreenPlayer() {
  const current = usePlayerStore((s) => s.current);
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const playing = usePlayerStore((s) => s.playing);
  const waveLoading = usePlayerStore((s) => s.waveLoading);
  const seek = usePlayerStore((s) => s.seek);
  const playIndex = usePlayerStore((s) => s.playIndex);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const toggleLike = usePlayerStore((s) => s.toggleLike);
  const isLiked = usePlayerStore((s) => s.isLiked);
  const setFullscreenOpen = useUiStore((s) => s.setFullscreenOpen);
  const openArtist = useUiStore((s) => s.openArtist);
  const fullscreenOpen = useUiStore((s) => s.fullscreenOpen);
  const { mounted, closing } = useExitAnimation(fullscreenOpen);

  // Палитра: фирменная (полосатые арты) или извлечённая из обложки трека.
  const palette = usePlayerPalette(current);
  const colors = fullscreenColors(palette);
  const dur = current ? duration || current.durationSec : 130;
  const progress = dur > 0 ? Math.min(position / dur, 1) : 0;

  const coverSrc = current
    ? current.coverUrl ?? (current.accentId ? ART_BY_ACCENT[current.accentId] : artFor(current.id))
    : ART_BY_ACCENT.pink;

  // Слайдер перемотки: клик и перетаскивание
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || !dur) return;
      seek(((clientX - rect.left) / rect.width) * dur);
    },
    [dur, seek]
  );

  const onPointerDown = (e: ReactPointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekFromEvent(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragging.current) seekFromEvent(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  // Ранний выход — только после ВСЕХ хуков (правила хуков React).
  if (!mounted) return null;

  // История сессии: треки, которые уже играли (очищается при новой волне).
  const played = queue.slice(0, index);
  const nextTrack = queue[index + 1];

  const coverButtons =
    "absolute flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-black/75";

  const row = (t: WaveTrack, queueIdx: number, dimmed: boolean) => {
    const art = t.coverUrl ?? (t.accentId ? ART_BY_ACCENT[t.accentId] : artFor(t.id));
    return (
      <div
        key={`${t.serviceId}:${t.id}:${queueIdx}`}
        onClick={() => void playIndex(queueIdx)}
        className={`group flex cursor-pointer items-center gap-5 rounded-3xl px-4 py-2 transition-colors hover:bg-black/10 ${
          dimmed ? "opacity-55 hover:opacity-90" : ""
        }`}
      >
        <img
          src={art}
          alt=""
          draggable={false}
          className="h-[56px] w-[74px] shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[17px] font-black leading-tight"
            style={{ color: colors.fg }}
          >
            {t.title}
          </div>
          <div
            className="truncate text-[12px] font-bold"
            style={{ color: colors.fgSoft }}
          >
            {t.artist}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void toggleLike(t);
          }}
          className={`shrink-0 transition-transform hover:scale-110 ${
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
    );
  };

  return (
    <div className={`fixed inset-0 z-[70] p-3 xl:p-4 ${closing ? "anim-exit-fade" : "animate-fade"}`}>
      <div
        className={`relative h-full w-full overflow-hidden rounded-[36px] shadow-2xl shadow-black/60 xl:rounded-[44px] ${
          closing ? "anim-exit-pop" : "animate-pop"
        }`}
        style={{ background: colors.bg }}
      >
        {/* Кнопка выхода (шеврон вниз) */}
        <button
          onClick={() => setFullscreenOpen(false)}
          className="absolute right-5 top-5 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-105 active:scale-95 xl:right-8 xl:top-7"
          style={{ background: colors.fgSoft }}
          title="Свернуть плеер"
        >
          <span className="material-symbols-outlined text-[32px]">expand_more</span>
        </button>

        <div className="flex h-full flex-col items-center gap-8 overflow-y-auto px-6 pb-10 pt-6 md:px-12 xl:flex-row xl:items-center xl:gap-14 xl:overflow-hidden xl:px-16 2xl:px-20 2xl:pt-8">
          {/* --- Левая колонка: обложка с кнопками, название, перемотка --- */}
          <div className="flex w-full max-w-[420px] shrink-0 flex-col items-center xl:w-[36%] xl:max-w-[440px]">
            {/* Обложка: при наведении размывается и проявляются кнопки */}
            <div className="group relative w-full">
              <img
                src={coverSrc}
                alt=""
                draggable={false}
                className="aspect-square w-full rounded-[40px] object-cover shadow-xl shadow-black/25 transition-all duration-300 group-hover:scale-[1.01] group-hover:blur-[7px]"
              />

              {/* Назад — левый край (зелёная метка на макете) */}
              <button
                onClick={prev}
                className={`${coverButtons} left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100`}
                title="Назад"
              >
                <span className="material-symbols-outlined ms-fill text-[32px]">skip_previous</span>
              </button>

              {/* Play/Pause — центр (фиолетовая метка на макете) */}
              <button
                onClick={toggle}
                className={`${coverButtons} left-1/2 top-1/2 h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100`}
                style={{ color: palette.accent }}
                title={playing ? "Пауза (Space)" : "Играть (Space)"}
              >
                {waveLoading ? (
                  <span className="animate-spin block h-7 w-7 rounded-full border-4 border-white/25 border-t-white" />
                ) : (
                  <span className="material-symbols-outlined ms-fill text-[42px]">
                    {playing ? "pause" : "play_arrow"}
                  </span>
                )}
              </button>

              {/* Вперёд — правый край (зелёная метка на макете) */}
              <button
                onClick={() => void next(true)}
                className={`${coverButtons} right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100`}
                title="Вперёд"
              >
                <span className="material-symbols-outlined ms-fill text-[32px]">skip_next</span>
              </button>

              {/* Лайк — нижний правый угол обложки */}
              <button
                onClick={() => current && void toggleLike(current)}
                className={`${coverButtons} bottom-4 right-4 h-12 w-12 opacity-0 group-hover:opacity-100 ${
                  current && isLiked(current) ? "opacity-100" : ""
                }`}
                style={current && isLiked(current) ? { color: palette.accent } : undefined}
                title={current && isLiked(current) ? "Убрать лайк" : "Лайк"}
              >
                <span
                  className={`material-symbols-outlined text-[26px] ${
                    current && isLiked(current) ? "ms-fill" : "ms-medium"
                  }`}
                >
                  thumb_up
                </span>
              </button>
            </div>

            <div
              className="mt-6 text-center text-[26px] font-black leading-tight xl:mt-8 xl:text-[32px]"
              style={{ color: colors.fg }}
            >
              {current ? current.title : "Название"}
            </div>
            <div className="mt-1 text-center text-[15px] font-bold xl:text-[17px]" style={{ color: colors.fgSoft }}>
              <button
                onClick={() =>
                  current &&
                  openArtist({
                    serviceId: current.serviceId,
                    artistId: current.artistId,
                    name: current.artist,
                  })
                }
                className="transition-colors hover:opacity-80"
                title={`Открыть страницу артиста: ${current?.artist ?? ""}`}
              >
                {current ? current.artist : "автор"}
              </button>
            </div>

            {/* Слайдер перемотки */}
            <div
              ref={barRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="relative mt-7 h-6 w-full cursor-pointer touch-none select-none"
              title="Перемотка"
            >
              <div className="absolute top-1/2 h-[4px] w-full -translate-y-1/2 rounded-full bg-white/30" />
              <div
                className="absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full"
                style={{ width: `${progress * 100}%`, background: colors.fg }}
              />
              <div
                className="absolute top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full"
                style={{ left: `calc(${progress * 100}% - 7px)`, background: colors.fg }}
              />
            </div>

            <div
              className="mt-2 flex w-full justify-between text-[13px] font-semibold"
              style={{ color: colors.fgSoft }}
            >
              <span>{fmtTime(position)}</span>
              <span>{fmtTime(dur)}</span>
            </div>
          </div>

          {/* --- Правая колонка: история сессии + текущий + следующий --- */}
          <div className="min-w-0 flex-1 overflow-y-auto pb-4 xl:h-full xl:pr-2">
            {played.length > 0 && (
              <h3 className="mb-3 mt-2 text-[13px] font-black uppercase tracking-wide" style={{ color: colors.fgSoft }}>
                Играло ранее
              </h3>
            )}
            {played.map((t, i) => row(t, i, true))}

            <h3 className={`text-[13px] font-black uppercase tracking-wide ${played.length ? "mb-3 mt-7" : "mb-3 mt-2"}`} style={{ color: colors.fgSoft }}>
              Сейчас и далее
            </h3>
            <div className="space-y-4">
              {current && row(current, index, false)}
              {nextTrack && row(nextTrack, index + 1, false)}
              {!current && !nextTrack && (
                <p className="text-[14px] font-semibold" style={{ color: colors.fgSoft }}>
                  Очередь пуста — запусти волну
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
