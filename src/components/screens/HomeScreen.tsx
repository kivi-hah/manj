import { useState } from "react";
import waveGradient from "../../assets/wave-gradient.png";
import logoStripes from "../../assets/logo-stripes.png";
import { usePlayerStore } from "../../player/playerStore";
import { useUiStore } from "../../stores/uiStore";
import type { WaveMode } from "../../types/music";

const WAVE_MODES: Array<{ mode: WaveMode; label: string; icon: string; hint: string }> = [
  { mode: "popular", label: "Популярное", icon: "whatshot", hint: "Хиты и топ твоих лайков" },
  { mode: "favorites", label: "Любимое", icon: "favorite", hint: "Только твои лайки" },
  { mode: "unfamiliar", label: "Незнакомое", icon: "explore", hint: "В основном новые имена" },
];

/**
 * Главный экран по макету «Главная.png»:
 *  — синяя карточка волны с меню режимов и кнопкой play;
 *  — заголовок «Моя волна из треков» с выделенным курсивом словом «волна»;
 *  — блок «Интеграция сервисов в один» с фирменным логотипом-полосами.
 */
export function HomeScreen() {
  const playWave = usePlayerStore((s) => s.playWave);
  const waveLoading = usePlayerStore((s) => s.waveLoading);
  const playing = usePlayerStore((s) => s.playing);
  const toggle = usePlayerStore((s) => s.toggle);
  const hasQueue = usePlayerStore((s) => s.queue.length > 0);
  const setUpdatesOpen = useUiStore((s) => s.setUpdatesOpen);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  return (
    <div className="relative flex h-full flex-col gap-6 overflow-y-auto p-5 xl:gap-10 xl:p-7">
      {/* --- Hero: карточка волны + описание --- */}
      <section className="flex min-h-0 flex-1 flex-col items-stretch gap-8 xl:flex-row xl:gap-10">
        <div
          className="relative h-[300px] w-full shrink-0 rounded-hero bg-cover bg-center sm:h-[360px] xl:h-auto xl:w-[46%]"
          style={{ backgroundImage: `url(${waveGradient})` }}
        >
          {/* Кнопки управления волной: меню режимов и «play» */}
          <div className="absolute bottom-7 right-7 flex flex-col items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setModeMenuOpen((v) => !v)}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#2b2b2b]/90 text-white transition-all duration-200 hover:scale-105 active:scale-95"
                title="Режимы волны"
              >
                <span className="material-symbols-outlined ms-fill text-[30px]">
                  {modeMenuOpen ? "close" : "tune"}
                </span>
              </button>

              {/* Меню выбора режима волны — открывается ВНИЗ, без обрезки */}
              {modeMenuOpen && (
                <div className="animate-pop absolute right-0 top-[84px] z-50 w-[280px] rounded-[28px] bg-[#232323] p-3 shadow-2xl shadow-black/60">
                  {WAVE_MODES.map(({ mode, label, icon, hint }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setModeMenuOpen(false);
                        void playWave(mode);
                      }}
                      className="flex w-full items-center gap-4 rounded-3xl px-3 py-3 text-left transition-colors hover:bg-white/10"
                    >
                      <span className="material-symbols-outlined ms-fill text-[26px] text-white/85">
                        {icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold">{label}</span>
                        <span className="block truncate text-[11px] font-semibold text-sub">
                          {hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={toggle}
              className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-[#2b2b2b]/90 text-white transition-all duration-200 hover:scale-105 active:scale-95"
              title={hasQueue ? (playing ? "Пауза" : "Продолжить волну") : "Запустить волну"}
            >
              {waveLoading ? (
                <span className="animate-spin block h-8 w-8 rounded-full border-4 border-white/25 border-t-white" />
              ) : (
                <span className="material-symbols-outlined ms-fill text-[44px]">
                  {hasQueue && playing ? "pause" : "play_arrow"}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="text-[30px] font-medium leading-tight tracking-tight xl:text-[40px]">
            Моя <span className="font-black italic">волна</span> из треков
          </h1>
          <p className="mt-6 max-w-[560px] text-[13px] xl:text-[15px] font-semibold leading-relaxed text-sub">
            «Моя волна» — это ваш бесконечный персональный поток музыки, который
            подстраивается под ваше настроение в реальном времени. Нажмите одну
            кнопку, и алгоритм сам соберет идеальную очередь треков со всех
            подключенных сервисов (Яндекс, VK)
          </p>
        </div>
      </section>

      {/* --- Блок интеграции сервисов --- */}
      <section className="flex flex-col items-center gap-6 xl:flex-row xl:items-center xl:gap-10">
        <img
          src={logoStripes}
          alt="Manj — все сервисы в одном"
          className="h-[180px] w-auto shrink-0 object-cover xl:h-[290px]"
        />
        <div className="min-w-0 flex-1 px-6">
          <h2 className="text-[24px] font-extrabold tracking-tight xl:text-[30px]">
            Интеграция сервисов в один
          </h2>
          <p className="mt-4 max-w-[560px] text-[15px] font-semibold leading-relaxed text-sub">
            Объедините медиатеки Яндекс Музыки и VK в единый плеер. Вся ваша
            музыка собрана в одном месте — без подписок, рекламы и переключения
            между приложениями.
          </p>
        </div>
      </section>

      {/* Кнопка «Обновления»: высота и размер кнопки настроек, справа снизу */}
      <button
        onClick={() => setUpdatesOpen(true)}
        className="absolute bottom-1 right-1 flex h-[66px] w-[66px] items-center justify-center rounded-full bg-icon text-white transition-all duration-200 hover:scale-105 active:scale-95"
        title="Обновления (v0.1.0 бета)"
      >
        <span className="material-symbols-outlined ms-medium text-[30px]">new_releases</span>
      </button>
    </div>
  );
}
