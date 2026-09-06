import { useUiStore } from "../stores/uiStore";
import { useExitAnimation } from "../lib/useExitAnimation";

/** История версий приложения (пополняется с каждым релизом). */
export const CHANGELOG: Array<{
  version: string;
  date: string;
  beta?: boolean;
  items: string[];
}> = [
  {
    version: "0.1.1",
    date: "07.09.2026",
    beta: true,
    items: [
      "Управление прямо на обложке в полноэкранном плеере: назад, пауза, вперёд и лайк — при наведении обложка красиво размывается",
      "История проигранных треков в очереди (очищается при запуске новой волны)",
      "Память последнего трека и позиции — закрывай и продолжай с того же места",
      "Полная адаптация интерфейса под любые размеры окна",
      "Фон полноэкранного плеера в палитре обложки; плеер следует цвету логотипа",
      "Локальный режим: приложение работает даже без доступа к сервисам",
      "Анимации открытия и закрытия всех окон и меню",
      "Обложки в высоком качестве (400–600px)",
      "Настройки плеера: громкость, повтор очереди, автозапуск",
      "Волна по треку, страницы артистов, меню режимов волны",
    ],
  },
  {
    version: "0.1.0",
    date: "06.09.2026",
    beta: true,
    items: [
      "Первый релиз: плеер-агрегатор Яндекс Музыки и VK",
      "«Моя волна» 70/30 с режимами: Популярное, Любимое, Незнакомое",
      "Вход через встроенный браузер с перехватом сессии (Rust + keyring)",
      "Библиотека: сетка 4×4, полная вкладка до 8000 треков",
      "Страницы артистов, поиск, волна по треку",
      "Полноэкранный плеер с перемоткой и адаптивной палитрой от обложки",
      "Настройки: логотип 3 цветов, плеер, горячие клавиши, плавные переходы",
    ],
  },
];

/** Оверлей списка обновлений (открывается кнопкой на главной справа снизу). */
export function UpdatesOverlay() {
  const updatesOpen = useUiStore((s) => s.updatesOpen);
  const setUpdatesOpen = useUiStore((s) => s.setUpdatesOpen);
  const { mounted, closing } = useExitAnimation(updatesOpen);
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className={`absolute inset-0 bg-black/45 backdrop-blur-xl ${
          closing ? "anim-exit-fade" : "animate-fade"
        }`}
        onClick={() => setUpdatesOpen(false)}
      />
      {/* Центрирует ВНЕШНИЙ контейнер, а анимация играет на внутреннем —
          иначе transform-анимация ломает -translate-центрирование */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className={`max-h-[76vh] w-[560px] overflow-y-auto rounded-modal bg-[#303030] p-10 shadow-2xl shadow-black/60 ${
            closing ? "anim-exit-pop" : "animate-pop"
          }`}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-[32px] font-black tracking-tight">Обновления</h1>
            <button
              onClick={() => setUpdatesOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              title="Закрыть"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          <div className="mt-7 space-y-7">
            {CHANGELOG.map((release) => (
              <div key={release.version}>
                <div className="flex items-center gap-3">
                  <span className="text-[20px] font-extrabold">v{release.version}</span>
                  {release.beta && (
                    <span className="rounded-full bg-inv px-3 py-0.5 text-[11px] font-black text-[#1f1f1f]">
                      бета
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-sub">{release.date}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {release.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-[14px] font-semibold text-white/85">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
