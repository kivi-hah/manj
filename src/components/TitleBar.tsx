import { winClose, winMinimize, winToggleMaximize } from "../lib/tauri";

/**
 * Кастомный титлбар в стиле макета: тонкие кнопки min/max/close справа,
 * вся верхняя полоса служит зоной перетаскивания окна (decorations: false).
 */
export function TitleBar() {
  const btn =
    "relative flex h-11 w-14 items-center justify-center text-white/90 transition-colors duration-150";

  return (
    <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-50 flex h-11 items-stretch justify-end">
      <button className={`${btn} hover:bg-white/10`} onClick={winMinimize} title="Свернуть">
        <span className="material-symbols-outlined ms-medium text-[22px]">remove</span>
      </button>
      <button
        className={`${btn} hover:bg-white/10`}
        onClick={winToggleMaximize}
        title="Развернуть"
      >
        <span className="material-symbols-outlined ms-medium text-[20px]">crop_square</span>
      </button>
      <button
        className={`${btn} hover:bg-[#e81123]`}
        onClick={winClose}
        title="Закрыть"
      >
        <span className="material-symbols-outlined ms-medium text-[22px]">close</span>
      </button>
    </div>
  );
}
