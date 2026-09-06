// ============================================================================
// Тонкий мост к Tauri IPC.
// В браузере (npm run dev без Tauri) вызовы IPC бросают понятную ошибку,
// поэтому UI остаётся пригодным для вёрстки, но требует tauri:dev для API.
// ============================================================================

/** true, если фронтенд запущен внутри WebView Tauri. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Вызов Rust-команды с понятной ошибкой вне Tauri. */
export async function ipc<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      `IPC недоступен (команда «${cmd}»). Запустите приложение командой npm run tauri:dev`
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// --- Управление окном (кастомный титлбар, decorations: false) ---------------

export async function winMinimize(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function winToggleMaximize(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

export async function winClose(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
