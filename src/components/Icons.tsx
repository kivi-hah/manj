// ============================================================================
// Фирменные SVG-иконки сайдбара (вместо иконочного шрифта — точные размеры
// и обводки, как в макете). Все — 24×24, stroke наследует currentColor.
// ============================================================================

interface IconProps {
  size?: number;
  className?: string;
}

/** Кнопка-«Меню»: скруглённый квадрат с заполненной правой панелью. */
export function SidebarMenuIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2.6" y="4.2" width="18.8" height="15.6" rx="4.2" stroke="currentColor" strokeWidth="1.9" />
      <rect x="13.6" y="6.1" width="6" height="11.8" rx="2.5" fill="currentColor" />
      <rect x="5.4" y="6.1" width="6" height="5.2" rx="1.6" fill="currentColor" />
    </svg>
  );
}

/** Главная — контурный домик. */
export function HomeIcon({ size = 30, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3.9 10.4 12 3.7l8.1 6.7v9.2c0 .7-.6 1.3-1.3 1.3h-4.3v-6.3H9.5v6.3H5.2c-.7 0-1.3-.6-1.3-1.3v-9.2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Поиск — лупа. */
export function SearchIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4.6 4.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** Библиотека — палец вверх (контур + боковая планка). */
export function ThumbUpIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M9.2 21h8.6c.86 0 1.6-.55 1.9-1.32l2.6-6.4c.1-.24.15-.5.15-.76v-1.8c0-1.14-.92-2.06-2.06-2.06h-5.94l.9-4.33.03-.3c0-.42-.17-.81-.45-1.09l-1.06-1.04-6.1 6.1c-.36.36-.57.86-.57 1.4v9.6c0 1.43 1.16 1.6 2.6 1.6Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M2.2 21h3V10.4h-3V21Z" fill="currentColor" />
    </svg>
  );
}

/** Крестик закрытия. */
export function CloseIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5.5 5.5 18.5 18.5 M18.5 5.5 5.5 18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Логотип «Manj» — круг с тремя треугольниками.
 * Вектор 1:1 из Group 2.svg; цвета — из выбранного варианта (Внешний вид).
 */
export function LogoMark({
  size = 40,
  colors = { circle: "#C3C3C3", tri: "#A0A0A0", triDark: "#606060" },
  className,
}: {
  size?: number;
  colors?: { circle: string; tri: string; triDark: string };
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 644 644" fill="none" className={className}>
      <rect width="644" height="644" rx="322" fill={colors.circle} />
      <path d="M255.767 537.69 362.312 410.714 209.273 390.488 255.767 537.69Z" fill={colors.triDark} />
      <path d="M174 313.98 221.785 107 353.127 246.329 174 313.98ZM346.483 353.801 394.268 146.821 525.611 286.15 346.483 353.801Z" fill={colors.tri} />
    </svg>
  );
}
