// ============================================================================
// Безопасная работа с токенами — клиентская сторона.
//
// ВАЖНО про модель безопасности:
//  — фронт может ТОЛЬКО ЗАПИСАТЬ токен (save_token) и узнать факт его наличия
//    (has_token). Чтение токена из JS не предусмотрено вообще: в Rust не
//    экспортирована команда load. Токены живут в системном хранилище ОС
//    (Windows Credential Manager / Keychain / Secret Service).
//  — все вызовы внешних API идут через Rust-прокси (команда service_request):
//    Rust сам достаёт токен из keyring и подставляет его в заголовки.
//  — аудиопотоки, требующие авторизации, раздаются через кастомную схему
//    stream://, где подписанный URL тоже не покидает Rust.
// ============================================================================

import type { ServiceId } from "../types/music";
import { SERVICE_IDS } from "../types/music";
import { ipc, isTauri } from "./tauri";

/** Сохранить токен сервиса в системное хранилище (после OAuth-входа). */
export function saveToken(service: ServiceId, token: string): Promise<void> {
  return ipc<void>("save_token", { service, token });
}

/** Удалить токен (выход из сервиса). */
export function deleteToken(service: ServiceId): Promise<void> {
  return ipc<void>("delete_token", { service });
}

/** Есть ли сохранённый токен у сервиса. */
export function hasToken(service: ServiceId): Promise<boolean> {
  return ipc<boolean>("has_token", { service });
}

/** Опросить все сервисы: какие имеют сохранённые токены. */
export async function connectedServices(): Promise<Record<ServiceId, boolean>> {
  const result = {} as Record<ServiceId, boolean>;
  await Promise.all(
    SERVICE_IDS.map(async (id) => {
      result[id] = await hasToken(id).catch(() => false);
    })
  );
  return result;
}

// --- Вход в приложении (OAuth-окно с перехватом редиректа) ---------------------

/**
 * Открыть окно входа сервиса. Rust перехватит редирект с токеном, сохранит
 * его в keyring, закроет окно и пришлёт событие oauth-result.
 * Бросает понятную ошибку, если OAuth-клиент ещё не настроен.
 */
export function startOauth(service: ServiceId): Promise<void> {
  return ipc<void>("start_oauth", { service });
}

/** Подписка на результат входа (успех/ошибка от окна OAuth). */
export function onOauthResult(
  handler: (r: { service: string; ok: boolean; message: string }) => void
): () => void {
  if (!isTauri()) return () => {};
  let unsubscribe: (() => void) | undefined;
  void import("@tauri-apps/api/event").then(({ listen }) =>
    listen<{ service: string; ok: boolean; message: string }>("oauth-result", (e) =>
      handler(e.payload)
    ).then((fn) => {
      unsubscribe = fn;
    })
  );
  return () => unsubscribe?.();
}
