// ============================================================================
// Реестр адаптеров. Для каждого ServiceId регистрируются:
//   — «настоящий» адаптер (ходит через Rust-прокси с токеном из keyring);
//   — mock-адаптер (локальный демо-каталог, работает без аккаунтов).
// Выбор между ними делает activeServices() в services/active.ts в зависимости
// от флагов подключений и демо-режима.
// ============================================================================

import type { ServiceId } from "../../types/music";
import type { IMusicService } from "./IMusicService";

export class ServiceRegistry {
  private real = new Map<ServiceId, IMusicService>();
  private mocks = new Map<ServiceId, IMusicService>();

  registerReal(service: IMusicService): void {
    this.real.set(service.id, service);
  }

  registerMock(service: IMusicService): void {
    this.mocks.set(service.id, service);
  }

  /** preferReal=true отдаёт настоящий адаптер, при его отсутствии — mock. */
  resolve(id: ServiceId, preferReal: boolean): IMusicService | undefined {
    return preferReal ? (this.real.get(id) ?? this.mocks.get(id)) : this.mocks.get(id);
  }
}

// Синглтон реестра: заполняется при старте приложения (см. services/bootstrap.ts).
export const registry = new ServiceRegistry();
