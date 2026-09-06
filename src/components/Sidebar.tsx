import type { ReactNode } from "react";
import { useUiStore } from "../stores/uiStore";
import { usePlayerStore } from "../player/playerStore";
import { LOGO_VARIANTS } from "../lib/palette";
import { HomeIcon, LogoMark, SearchIcon, SidebarMenuIcon, ThumbUpIcon } from "./Icons";

/**
 * Левая боковая панель по макету: сверху — «Меню» (сворачивание),
 * навигация (Главная / Поиск / Библиотека), внизу — логотип-трилистник,
 * открывающий настройки. Все иконки — точные SVG.
 */
export function Sidebar() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const openSettings = useUiStore((s) => s.openSettings);
  const compact = useUiStore((s) => s.prefs.compactSidebar);
  const setPref = useUiStore((s) => s.setPref);
  const logoId = useUiStore((s) => s.prefs.logoId);
  const playWave = usePlayerStore((s) => s.playWave);

  const circle = compact ? "h-11 w-11" : "h-[60px] w-[60px] xl:h-[72px] xl:w-[72px]";

  return (
    <aside
      className={`flex shrink-0 flex-col items-center gap-3 py-4 transition-all duration-300 xl:gap-4 xl:py-5 ${
        compact ? "w-[64px]" : "w-[88px] xl:w-[116px]"
      }`}
    >
      {/* Меню: свернуть/развернуть рельс */}
      <button
        onClick={() => setPref("compactSidebar", !compact)}
        className={`flex ${compact ? "h-11 w-11" : "h-[52px] w-[72px] xl:h-[56px] xl:w-[80px]"} items-center justify-center rounded-[22px] bg-icon text-white transition-all duration-200 hover:scale-105 active:scale-95`}
        title={compact ? "Развернуть панель" : "Свернуть панель"}
      >
        <SidebarMenuIcon size={compact ? 20 : 25} />
      </button>

      <div className="flex-1" />

      <NavBtn
        label="Главная"
        active={screen === "home"}
        circle={circle}
        onClick={() => setScreen("home")}
      >
        <HomeIcon size={compact ? 22 : 27} />
      </NavBtn>
      <NavBtn
        label="Поиск"
        active={screen === "search"}
        circle={circle}
        onClick={() => setScreen("search")}
      >
        <SearchIcon size={compact ? 20 : 25} />
      </NavBtn>
      <NavBtn
        label="Библиотека"
        active={screen === "library" || screen === "library-all"}
        circle={circle}
        onClick={() => setScreen("library")}
      >
        <ThumbUpIcon size={compact ? 20 : 25} />
      </NavBtn>

      <div className="flex-1" />

      {/* Лого-трилистник: открывает настройки (нижняя кнопка макета) */}
      <button
        onClick={() => openSettings()}
        className={`flex ${circle} items-center justify-center rounded-full transition-all duration-200 hover:scale-105 active:scale-95`}
        title="Настройки"
      >
        <LogoMark size={compact ? 36 : 56} colors={LOGO_VARIANTS[logoId]} />
      </button>

      {/* Скрытая возможность запуска волны (для горячих клавиш/доступности) */}
      <button onClick={() => void playWave()} className="hidden" aria-hidden tabIndex={-1} />
    </aside>
  );
}

function NavBtn(props: {
  label: string;
  active: boolean;
  circle: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const { label, active, circle, onClick, children } = props;
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex ${circle} items-center justify-center rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
        active ? "bg-inv text-[#1f1f1f]" : "bg-icon text-white"
      }`}
    >
      {children}
    </button>
  );
}
