// ============================================================================
// Bootstrap: регистрация адаптеров + выбор активных сервисов.
// ============================================================================

import type { ServiceId } from "../types/music";
import { SERVICE_IDS } from "../types/music";
import type { IMusicService } from "./core/IMusicService";
import { registry } from "./core/ServiceRegistry";
import { YandexMusicService } from "./yandex/YandexMusicService";
import { VKMusicService } from "./vk/VKMusicService";
import { MockMusicService } from "./mock/MockMusicService";
import { SEED_LIKED_IDS } from "./mock/data";
import { useUiStore } from "../stores/uiStore";

const SERVICE_META: Record<ServiceId, { name: string; short: string }> = {
  yandex: { name: "Яндекс Музыка", short: "ЯМ" },
  vk: { name: "VK Музыка", short: "VK" },
};

/** Вызывается один раз при старте приложения (main.tsx). */
export function bootstrapServices(): void {
  const sharedLikes = SEED_LIKED_IDS;

  for (const id of SERVICE_IDS) {
    // Spotify и SoundCloud исключены из интеграций по требованию.
    registry.registerReal(
      id === "yandex" ? new YandexMusicService() : new VKMusicService()
    );
    registry.registerMock(
      new MockMusicService(id, SERVICE_META[id].name, SERVICE_META[id].short, sharedLikes)
    );
  }
}

/**
 * Активные адаптеры для волн/библиотеки:
 *  — сервис подключён (есть токен) → настоящий адаптер;
 *  — иначе, при включённом демо-режиме → mock;
 *  — иначе сервис пропускается.
 */
export function activeServices(): IMusicService[] {
  const { connections, prefs } = useUiStore.getState();
  return SERVICE_IDS.flatMap((id) => {
    if (connections[id]) {
      const s = registry.resolve(id, true);
      return s ? [s] : [];
    }
    return prefs.demoMode ? [registry.resolve(id, false)!] : [];
  });
}

/** Адаптер для конкретного сервиса (используется при разворачивании потока). */
export function serviceFor(id: ServiceId): IMusicService | undefined {
  const { connections, prefs } = useUiStore.getState();
  if (connections[id]) return registry.resolve(id, true);
  return prefs.demoMode ? registry.resolve(id, false) : undefined;
}

/** Локальные mock-адаптеры всех сервисов — резерв, когда сеть/сессия недоступны. */
export function mockServices(): IMusicService[] {
  return SERVICE_IDS.map((id) => registry.resolve(id, false)).filter(
    (s): s is IMusicService => !!s
  );
}

/** Mock-адаптер конкретного сервиса (для треков с demo-флагом). */
export function mockServiceFor(id: ServiceId): IMusicService | undefined {
  return registry.resolve(id, false);
}
