/** @type {import('tailwindcss').Config} */

// Дизайн-токены сняты со скриншотов проекта:
// чёрный фон окна, тёмно-серая «карточка» контента, пилюли и круги,
// светлая инверсная кнопка для активных состояний.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0a0a0a",      // фон окна
        surface: "#2c2c2c",   // большая карточка экрана
        surface2: "#383838",  // панель плеера, поля ввода
        surface3: "#4e4e4e",  // пилюли треков/плейлистов
        surface4: "#5d5d5d",  // hover пилюль
        icon: "#1d1d1d",      // круглые кнопки сайдбара
        inv: "#e2e2e2",       // активная (светлая) кнопка
        sub: "#b9b9b9",       // вторичный текст
        pinkA: "#f2a7e0",     // градиент библиотеки, светлая часть
        pinkB: "#e96fcd",     // градиент библиотеки, насыщенная часть
      },
      borderRadius: {
        card: "44px",   // внешний контейнер экрана
        hero: "36px",   // синяя карточка «Моя волна», баннер библиотеки
        modal: "40px",  // окно настроек
      },
      fontFamily: {
        sans: ['"Roboto Flex Variable"', '"Roboto Flex"', "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { opacity: "0.55" },
          "50%": { opacity: "1" },
          "100%": { opacity: "0.55" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        screen: "fadeUp 0.28s ease both",
        modal: "popIn 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        spin: "spin 0.9s linear infinite",
      },
    },
  },
  plugins: [],
};
