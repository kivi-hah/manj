import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Конфигурация Vite по рекомендациям Tauri:
// порт фиксирован (его ожидает tauri dev), clearScreen отключён,
// чтобы вывод cargo не затирался.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Rust пишет в src-tauri/target во время сборки — файлы там заняты (EBUSY),
    // поэтому вотчеру Vite эта папка не нужна.
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "chrome110",
    outDir: "dist",
    minify: "esbuild",
    sourcemap: false,
  },
});
