// ============================================================================
// WaveEngine — сердце «Моей волны».
//
// Движок СТЕЙТЛЕСС: он не владеет очередью, а лишь генерирует партии треков.
// Владелец очереди — playerStore (см. src/player/playerStore.ts), который:
//   1) при старте волны запрашивает партию initialBatch;
//   2) когда до конца очереди остаётся prefetchAhead (3) трека — достраивает
//      партию extendBatch «на лету» (бесконечный поток);
//   3) пересылает в движок события (лайк/скип/дослушивание), и следующая
//      партия уже учитывает обновлённые веса — волна адаптируется.
//
// Микс партии: 70% «вкус» (лайки + похожее, взвешенная выборка по профилю),
//               30% «открытия» (Discovery Engine, см. discovery.ts).
// ============================================================================

import type { Track, TasteProfileSnapshot, WaveMode, WaveSource, WaveTrack } from "../types/music";
import type { IMusicService } from "../services/core/IMusicService";
import type { ListenEvent, TasteProfile } from "./TasteProfile";
import { pickDiscovery } from "./discovery";

export const WAVE_SETTINGS = {
  /** Размер первой партии при нажатии «Плей» на карточке волны. */
  initialBatch: 25,
  /** Сколько треков докидывать при автоматическом продлении. */
  extendBatch: 15,
  /** За сколько треков до конца очереди начинать подгрузку. */
  prefetchAhead: 3,
  /** Целевая пропорция вкус/открытия. */
  tasteRatio: 0.7,
} as const;

export class WaveEngine {
  constructor(
    private profile: TasteProfile,
    /** Поставщик активных адаптеров (зависит от подключённых сервисов). */
    private getServices: () => IMusicService[]
  ) {}

  /** Прямой доступ к профилю — для настроек/отладки и статистики микса. */
  get tasteProfile(): TasteProfile {
    return this.profile;
  }

  // --- Генерация партии -------------------------------------------------------

  /**
   * Собрать партию треков. `exclude` — все id, что уже в очереди или недавно
   * звучали (анти-повтор). Режимы меняют пропорцию микса:
   *   mix        — 70% вкус / 30% открытия (стандарт);
   *   popular    — известное и хитовое: топ лайков по весам + чарт;
   *   favorites  — только любимое;
   *   unfamiliar — преимущественно открытия (новые имена).
   */
  async buildBatch(
    count: number,
    exclude: Set<string>,
    mode: WaveMode = "mix",
    /** Переопределение списка адаптеров — для локального резерва. */
    servicesOverride?: IMusicService[]
  ): Promise<WaveTrack[]> {
    const services = servicesOverride ?? this.getServices();
    if (!services.length) {
      throw new Error(
        "Нет источников музыки — подключите сервис в «Настройки → Интеграции» или включите демо-режим"
      );
    }

    // Опрашиваем все активные адаптеры параллельно; сбой одного сервиса
    // не должен ломать волну — собираем его ошибку для диагностики.
    const pools = await Promise.allSettled(
      services.map((s) => s.getWaveCandidates(this.profile.snapshot(), 24))
    );

    const tastePool: Track[] = [];
    const discoveryPool: Track[] = [];
    const errors: string[] = [];
    pools.forEach((p, i) => {
      if (p.status === "fulfilled") {
        tastePool.push(...p.value.taste);
        discoveryPool.push(...p.value.discovery);
      } else {
        const reason = p.reason;
        errors.push(
          `${services[i].name}: ${
            typeof reason === "string" ? reason : reason instanceof Error ? reason.message : "ошибка"
          }`
        );
      }
    });
    if (tastePool.length + discoveryPool.length === 0) {
      const details = errors.length ? ` — ${errors.join("; ")}` : "";
      throw new Error(
        `Сервисы не вернули треков${details}. Проверь вход (Настройки → Интеграции) или включи «Работа без аккаунта»`
      );
    }

    const targetTaste =
      mode === "favorites"
        ? count
        : mode === "unfamiliar"
          ? Math.round(count * 0.15)
          : mode === "popular"
            ? Math.round(count * 0.8)
            : Math.round(count * WAVE_SETTINGS.tasteRatio);

    let taste: Track[];
    if (mode === "popular") {
      // «Популярное» — детерминированно: топ лайков по весам профиля.
      taste = this.profile
        .rank(tastePool.filter((t) => !exclude.has(t.id)))
        .slice(0, targetTaste);
    } else {
      taste = this.pickWeighted(tastePool, targetTaste, exclude).map((t) => t);
    }
    const tasteTracks = taste.map(wrapAs("taste"));

    const disc =
      mode === "favorites"
        ? []
        : pickDiscovery(
            discoveryPool.length ? discoveryPool : tastePool,
            this.profile,
            count - tasteTracks.length,
            exclude
          ).map(wrapAs("discovery"));

    return interleave(tasteTracks, disc);
  }

  /**
   * Взвешенная выборка без возвращения: вероятность трека пропорциональна
   * его аффинности. Внутри партии штрафуем повторного артиста (×1/3 за
   * каждый уже взятый трек), чтобы очередь не «залипала» на одном имени.
   */
  private pickWeighted(pool: Track[], k: number, exclude: Set<string>): Track[] {
    const candidates = pool.filter((t) => !exclude.has(t.id));
    const weights = candidates.map((t) => Math.max(0.05, this.profile.affinity(t)));
    const artistCount = new Map<string, number>();
    const out: Track[] = [];
    const taken = new Set<number>();

    while (out.length < k) {
      const penalty = (i: number) =>
        1 + (artistCount.get(candidates[i].artist) ?? 0) * 2;

      let total = 0;
      for (let i = 0; i < candidates.length; i++) {
        if (!taken.has(i)) total += weights[i] / penalty(i);
      }
      if (total <= 0) break;

      let r = Math.random() * total;
      let idx = -1;
      for (let i = 0; i < candidates.length; i++) {
        if (taken.has(i)) continue;
        r -= weights[i] / penalty(i);
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      if (idx < 0) break;

      taken.add(idx);
      const track = candidates[idx];
      artistCount.set(track.artist, (artistCount.get(track.artist) ?? 0) + 1);
      out.push(track);
    }
    return out;
  }

  // --- Адаптация ----------------------------------------------------------------

  /** Прокидываем событие в профиль; следующая партия уже будет другой. */
  applyEvent(ev: ListenEvent): void {
    this.profile.apply(ev);
  }

  /** Фактический микс текущей очереди — для плашки «7 : 3» в.drawer очереди. */
  mixStats(queue: WaveTrack[]): { taste: number; discovery: number } {
    let taste = 0;
    let discovery = 0;
    for (const t of queue) t.waveSource === "taste" ? taste++ : discovery++;
    return { taste, discovery };
  }
}

// --- Вспомогательные чистые функции -------------------------------------------

function wrapAs(source: WaveSource) {
  return (t: Track): WaveTrack => ({ ...t, waveSource: source });
}

/** Фишер—Йетс поверх копии массива. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Чередование пулов: группы по 10 (7 вкуса + 3 открытия), перемешанные
 * внутри группы — микс «дышит», но пропорция держится. Затем разводим
 * треки одного артиста, если они оказались соседями.
 */
function interleave(taste: WaveTrack[], disc: WaveTrack[]): WaveTrack[] {
  const out: WaveTrack[] = [];
  for (let i = 0; ; i++) {
    const t = taste.slice(i * 7, i * 7 + 7);
    const d = disc.slice(i * 3, i * 3 + 3);
    if (!t.length && !d.length) break;
    out.push(...shuffle([...t, ...d]));
  }
  return fixAdjacentArtists(out);
}

function fixAdjacentArtists(queue: WaveTrack[]): WaveTrack[] {
  for (let i = 1; i < queue.length; i++) {
    if (queue[i].artist !== queue[i - 1].artist) continue;
    // ищем ближайший справа трек другого артиста и меняем местами
    for (let j = i + 1; j < queue.length; j++) {
      if (queue[j].artist !== queue[i].artist) {
        [queue[i], queue[j]] = [queue[j], queue[i]];
        break;
      }
    }
  }
  return queue;
}
