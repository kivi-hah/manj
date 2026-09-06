// ============================================================================
// Палитра плеера и фирменные полосатые обложки.
// Цвета сняты ТОЧНО из экспорта дизайна (Главная.svg / Rectangle 25-52-53):
//   розовый акцент #DA7CC1, синий #80B0DF, фон плеера #380020 / #45002F.
// «Мини-плеер меняет цвет на тёмный цвет обложки» — каждый трек несёт
// accentId, и панель перекрашивается в его тёмную пару (фон + акцент).
// ============================================================================

import type { AccentId } from "../types/music";
import type { LogoId } from "../stores/uiStore";
import artPink from "../assets/art-pink.png";
import artGreen from "../assets/art-green.png";
import artBlue from "../assets/art-blue.png";

/** Цветовые версии логотипа (Group-2 / Group-3 / Group-6 из загрузок). */
export const LOGO_VARIANTS = {
  gray: { circle: "#C3C3C3", tri: "#A0A0A0", triDark: "#606060", label: "Серый" },
  peach: { circle: "#FFC9BC", tri: "#D96B3F", triDark: "#8D5E4E", label: "Персиковый" },
  olive: { circle: "#FBFBB0", tri: "#CFC93C", triDark: "#6F7A44", label: "Оливковый" },
} as const;

/** Полосатые обложки из макета (Rectangle 25/52/53). */
export const ART_BY_ACCENT: Record<AccentId, string> = {
  pink: artPink,
  green: artGreen,
  blue: artBlue,
};

export interface PlayerPalette {
  /** Акцентный цвет: название трека, треугольник Play, прогресс. */
  accent: string;
  /** Фон основной части мини-плеера (тёмный). */
  bg: string;
  /** Фон сегмента управления (чуть светлее, как в макете). */
  controls: string;
  /** Фон развёрнутого плеера — градиент из ДВУХ цветов обложки. */
  fsBg: string;
}

export function getPalette(accentId?: AccentId): PlayerPalette {
  return accentId ? PALETTES[accentId] : neutralPalette("gray");
}

export function gradientOf(c1: string, c2: string): string {
  return `linear-gradient(155deg, ${c1} 0%, ${c2} 100%)`;
}

const PALETTES: Record<AccentId, PlayerPalette> = {
  pink: {
    accent: "#DA7CC1",
    bg: "#380020",
    controls: "#45002F",
    fsBg: gradientOf("#A85795", "#6E3862"),
  },
  green: {
    accent: "#63CC82",
    bg: "#12301B",
    controls: "#1A4026",
    fsBg: gradientOf("#4B9C64", "#2E6B43"),
  },
  blue: {
    accent: "#80B0DF",
    bg: "#102536",
    controls: "#17334A",
    fsBg: gradientOf("#5D87B5", "#3A5D82"),
  },
};

/**
 * Нейтральная палитра (нет обложки) — следует ЦВЕТУ ЛОГОТИПА:
 * акцент и градиенты берутся из выбранного варианта, чёрный фон окна
 # при этом никогда не меняется.
 */
export function neutralPalette(logoId: LogoId): PlayerPalette {
  const v = LOGO_VARIANTS[logoId];
  return {
    accent: v.tri,
    bg: darken(v.circle, 0.85),
    controls: darken(v.circle, 0.78),
    fsBg: gradientOf(darken(v.tri, 0.12), darken(v.triDark, 0.1)),
  };
}

// --- Утилиты цвета для полноэкранного плеера ------------------------------------

export function darken(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16);
  const r = Math.round(((v >> 16) & 255) * (1 - k));
  const g = Math.round(((v >> 8) & 255) * (1 - k));
  const b = Math.round((v & 255) * (1 - k));
  const c = (x: number) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Цвета полноэкранного режима: плоский тёмный фон МИНИ-плеера (без градиентов). */
export function fullscreenColors(p: PlayerPalette) {
  return {
    bg: p.bg,
    fg: darken(p.accent, 0.58), // основной текст (название трека)
    fgSoft: darken(p.accent, 0.32), // вторичный текст («автор», времена)
  };
}
