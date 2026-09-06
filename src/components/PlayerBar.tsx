import { usePlayerStore } from "../player/playerStore";
import { useUiStore } from "../stores/uiStore";
import { fmtTime } from "../lib/format";
import { ART_BY_ACCENT } from "../lib/palette";
import { usePlayerPalette } from "../lib/coverPalette";

/**
 * Нижняя панель плеера по макетам:
 *  — панель окрашена в ТЁМНЫЙ цвет обложки (палитра по accentId трека);
 *  — граница между двумя сегментами СДВИГАЕТСЯ как ход времени трека
 *    (как в Яндекс Музыке): слева — прошлая часть, справа — оставшаяся;
 *  — слева сегмент с круглой полосатой обложкой и названием в акцентном цвете;
 *  — справа prev / next / чёрная круглая кнопка Play с акцентным треугольником;
 *  — метки времени снаружи пилюли; в простое — 1:21 / 2:10, как в макете.
 *  — клик по обложке открывает полноэкранный режим с перемоткой.
 */
export function PlayerBar() {
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const waveLoading = usePlayerStore((s) => s.waveLoading);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const setFullscreenOpen = useUiStore((s) => s.setFullscreenOpen);

  // Палитра: фирменная (полосатые арты) или извлечённая из обложки трека.
  const palette = usePlayerPalette(current);

  // В простое показываем значения макета (обложка-плейсхолдер, 1:21 / 2:10).
  const pos = current ? position : 81;
  const dur = current ? duration || current.durationSec : 130;
  const progress = dur > 0 ? Math.min(pos / dur, 1) : 0;

  const coverSrc = current
    ? current.coverUrl ?? (current.accentId ? ART_BY_ACCENT[current.accentId] : undefined)
    : ART_BY_ACCENT.pink;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-[104px] items-center justify-center gap-4 xl:h-[124px] xl:gap-6">
      {/* Метки времени — вне пилюли, как в макете */}
      <span className="pointer-events-auto w-10 text-right text-[15px] font-semibold tabular-nums text-white xl:w-12 xl:text-[20px]">
        {fmtTime(pos)}
      </span>

      {/* Пилюля плеера: фон — цвет «осталось», поверх — заливка «прошло» */}
      <div
        className="pointer-events-auto relative flex h-[80px] w-[min(94vw,1020px)] xl:h-[92px] items-center overflow-hidden rounded-full shadow-lg shadow-black/40"
        style={{ background: palette.controls }}
      >
        {/* Прошедшая часть трека — граница движется со временем */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{ width: `${progress * 100}%`, background: palette.bg }}
        />

        {/* Обложка-пилюля; клик открывает полноэкранный режим */}
        <button
          onClick={() => setFullscreenOpen(true)}
          className="relative z-10 ml-2 h-[66px] w-[88px] shrink-0 overflow-hidden rounded-full xl:h-[80px] xl:w-[104px] transition-transform duration-200 hover:scale-[1.03]"
          title="Открыть плеер (перемотка, очередь)"
        >
          <img
            src={coverSrc}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        </button>

        {/* Название */}
        <div className="relative z-10 min-w-0 flex-1 px-6 text-center">
          <span
            className="truncate text-[15px] font-bold xl:text-[19px]"
            style={{ color: palette.accent }}
          >
            {current ? current.title : "Название"}
          </span>
        </div>

        {/* Управление — на «оставшейся» части */}
        <div className="relative z-10 flex shrink-0 items-center gap-1 pl-3 pr-3">
          <button
            onClick={prev}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-110 active:scale-90"
            title="Предыдущий (позиция < 3 c — перемотка в начало)"
          >
            <span className="material-symbols-outlined ms-fill text-[30px]">skip_previous</span>
          </button>
          <button
            onClick={() => void next(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform duration-150 hover:scale-110 active:scale-90"
            title="Следующий"
          >
            <span className="material-symbols-outlined ms-fill text-[30px]">skip_next</span>
          </button>

          {/* Чёрная круглая кнопка Play (компактная, как в макете) */}
          <button
            onClick={toggle}
            className="ml-1 mr-1 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-black xl:h-[72px] xl:w-[72px] transition-all duration-200 hover:scale-105 active:scale-95"
            title={playing ? "Пауза (Space)" : "Играть (Space)"}
          >
            {waveLoading ? (
              <span
                className="animate-spin block h-7 w-7 rounded-full border-4 border-white/20"
                style={{ borderTopColor: palette.accent }}
              />
            ) : (
              <span
                className="material-symbols-outlined ms-fill text-[32px] xl:text-[38px]"
                style={{ color: palette.accent }}
              >
                {playing ? "pause" : "play_arrow"}
              </span>
            )}
          </button>
        </div>
      </div>

      <span className="pointer-events-auto w-10 text-[15px] font-semibold tabular-nums text-white xl:w-12 xl:text-[20px]">
        {fmtTime(dur)}
      </span>
    </div>
  );
}
