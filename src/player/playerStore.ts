// ============================================================================
// playerStore — единый центр, связывающий:
//   AudioEngine (звук) ⇄ WaveEngine (алгоритм) ⇄ UI (PlayerBar, QueueDrawer).
//
// Здесь живёт очередь «Моей волны» и логика бесконечного потока:
// когда до конца очереди остаётся prefetchAhead=3 трека — достраиваем партию.
// Каждое событие прослушивания (play/complete/skip/like) уходит:
//   1) в TasteProfile (веса → следующая партия меняется);
//   2) в локальную БД (история для восстановления профиля после перезапуска).
// ============================================================================

import { create } from "zustand";
import type { Track, WaveMode, WaveTrack } from "../types/music";
import { AudioEngine } from "./AudioEngine";
import { WaveEngine, WAVE_SETTINGS } from "../wave/WaveEngine";
import { TasteProfile, type ListenEventType } from "../wave/TasteProfile";
import { history } from "../db/history";
import { toastError, toastInfo, useUiStore } from "../stores/uiStore";
import { useLibraryStore } from "../stores/libraryStore";
import { mockServiceFor, serviceFor, activeServices, mockServices } from "../services/active";
import { registry } from "../services/core/ServiceRegistry";

export interface PlayerState {
  queue: WaveTrack[];
  index: number;
  current: WaveTrack | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  /** Первая партия волны грузится. */
  waveLoading: boolean;
  /** Докидывается продление очереди (индикатор в drawer). */
  extending: boolean;
  /** Позиция для продолжения восстановленной сессии (сбрасывается после seek). */
  resumeSec: number | null;

  // Действия
  playWave(mode?: WaveMode): Promise<void>;
  /** «Волна по треку»: похожее на заданный трек. */
  playWaveFrom(track: Track): Promise<void>;
  playTrackFrom(track: Track, list: Track[]): Promise<void>;
  /** Прыжок на трек очереди (клик по строке в полноэкранном плеере). */
  playIndex(i: number): Promise<void>;
  toggle(): void;
  next(manual?: boolean): Promise<void>;
  prev(): void;
  seek(sec: number): void;
  setVolume(v: number): void;
  toggleLike(track: Track): Promise<void>;
  isLiked(track: Track | null): boolean;
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
  queue: [],
  index: -1,
  current: null,
  playing: false,
  position: 0,
  duration: 0,
  volume: 0.85,
  waveLoading: false,
  extending: false,
  resumeSec: null,

  // --- Запуск «Моей волны» -----------------------------------------------------

  playWave: async (mode: WaveMode = "mix") => {
    const engine = getEngine();
    if (!engine) return;
    set({ waveLoading: true });
    try {
      const batch = await engine.buildBatch(
        WAVE_SETTINGS.initialBatch,
        new Set(), // новая волна — никакой анти-повтор не нужен
        mode
      );
      set({ queue: batch, index: 0, current: batch[0], resumeSec: null });
      await playCurrent();
    } catch (realError) {
      // ЛОКАЛЬНЫЙ РЕЗЕРВ: сервисы недоступны (сеть/сессия истекла) —
      // собираем волну из локального каталога, приложение продолжает работать.
      try {
        const batch = (
          await engine.buildBatch(WAVE_SETTINGS.initialBatch, new Set(), mode, mockServices())
        ).map((t) => ({ ...t, demo: true }));
        set({ queue: batch, index: 0, current: batch[0], resumeSec: null });
        await playCurrent();
        toastInfo("Сервисы недоступны — включён локальный режим");
      } catch {
        toastError(
          realError instanceof Error ? realError.message : "Не удалось запустить волну"
        );
      }
    } finally {
      set({ waveLoading: false });
    }
  },

  /** «Волна по треку»: seed + похожее от сервиса, дальше — обычное продление. */
  playWaveFrom: async (track) => {
    const engine = getEngine();
    if (!engine) return;
    set({ waveLoading: true });
    try {
      const service = serviceFor(track.serviceId);
      const similar = service?.getSimilar
        ? await service.getSimilar(track).catch(() => [] as Track[])
        : [];
      const seed: WaveTrack = { ...track, waveSource: "taste" };
      const batch: WaveTrack[] = [
        seed,
        ...similar.map(
          (t): WaveTrack => ({ ...t, waveSource: "taste" })
        ),
      ];
      set({ queue: batch, index: 0, current: seed, resumeSec: null });
      await playCurrent();
      // Хвост очереди достроит движок в обычном режиме.
      void extendQueue();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Не удалось запустить волну по треку");
    } finally {
      set({ waveLoading: false });
    }
  },

  /** Контекстное воспроизведение (из библиотеки/поиска): очередь = список. */
  playTrackFrom: async (track, list) => {
    const wave: WaveTrack[] = list.map((t) => ({ ...t, waveSource: "taste" }));
    const idx = Math.max(0, wave.findIndex((t) => t.id === track.id));
    set({ queue: wave, index: idx, current: wave[idx], resumeSec: null });
    await playCurrent();
  },

  /** Клик по строке очереди в полноэкранном плеере. */
  playIndex: async (i) => {
    const { queue } = get();
    if (i < 0 || i >= queue.length) return;
    set({ index: i, current: queue[i], position: 0 });
    await playCurrent();
  },

  // --- Управление ---------------------------------------------------------------

  toggle: () => {
    const { playing, current } = get();
    if (!current) {
      void get().playWave(); // первый запуск без очереди = волна
      return;
    }
    // После восстановления сессии поток ещё не загружен: грузим БЕЗ autoplay,
    // отматываем к сохранённой позиции и продолжаем с неё.
    if (loadedTrackKey !== trackKey(current)) {
      void (async () => {
        await playCurrent(false);
        const resume = get().resumeSec;
        if (resume && resume > 1) {
          audio.seek(resume);
        }
        usePlayerStore.setState({ resumeSec: null });
        audio.play();
        usePlayerStore.setState({ playing: true });
      })();
      return;
    }
    const engine = getEngine();
    if (!engine) return;
    if (playing) {
      audio.pause();
      set({ playing: false });
    } else {
      audio.play();
      set({ playing: true });
    }
  },

  next: async (manual = false) => {
    const { queue, index, current, position } = get();
    // Ручной скип — это сигнал вкусу: чем раньше скипнули, тем сильнее штраф.
    if (manual && current) {
      emitEvent(current, "skip", position);
    }
    if (index >= queue.length - 1) {
      // Конец очереди: волна не кончается — пробуем достроить прямо сейчас.
      const added = await extendQueue();
      if (!added) {
        // Повтор очереди (настройка «Плеера»): начинаем сначала.
        if (useUiStore.getState().prefs.repeatQueue && queue.length > 0) {
          set({ index: 0, current: queue[0], position: 0 });
          await playCurrent();
        } else {
          set({ playing: false });
        }
        return;
      }
    }
    const nextIndex = get().index + 1;
    set({ index: nextIndex, current: get().queue[nextIndex], position: 0 });
    await playCurrent();
  },

  prev: () => {
    const { index, position } = get();
    if (position > 3) {
      get().seek(0);
      return;
    }
    if (index > 0) {
      const i = index - 1;
      set({ index: i, current: get().queue[i], position: 0 });
      void playCurrent();
    }
  },

  seek: (sec) => audio.seek(sec),

  setVolume: (v) => {
    audio.setVolume(v);
    set({ volume: v });
  },

  // --- Лайк -----------------------------------------------------------------------

  toggleLike: async (track) => {
    const liked = await useLibraryStore.getState().toggleLike(track);
    const { current } = get();
    // Лайк трека-открытия весит больше — Discovery попал в точку.
    const isDiscovery = (track as Partial<WaveTrack>).waveSource === "discovery";
    const type: ListenEventType = liked && isDiscovery ? "discover_like" : liked ? "like" : "unlike";
    emitEvent(track, type, audio.currentTime);
    // Мгновенный отклик UI, если лайкнули текущий трек.
    if (current && current.id === track.id && current.serviceId === track.serviceId) {
      set({ current: { ...current } });
    }
  },

  isLiked: (track) => {
    if (!track) return false;
    return !!useLibraryStore.getState().likedIds[`${track.serviceId}:${track.id}`];
  },
}));

// ============================================================================
// Инфраструктура: синглтоны движка/аудио и инициализация.
// ============================================================================

const audio = new AudioEngine();
let engine: WaveEngine | null = null;

// --- Память последнего трека (сессия переживает закрытие приложения) -----------

let lastSessionSave = 0;
/** Ключ трека, чей поток сейчас загружен в аудиоэлемент. */
let loadedTrackKey: string | null = null;

function trackKey(t: Track | null): string | null {
  return t ? `${t.serviceId}:${t.id}` : null;
}

/** Сохранить очередь, позицию и текущий трек в локальную БД. */
export function persistSession(): void {
  const s = usePlayerStore.getState();
  if (!s.current) return;
  void history.kvSet("player_session", {
    queue: s.queue.slice(0, 300),
    index: s.index,
    position: audio.currentTime || s.position,
  });
}

/** Восстановить последнюю сессию (вызывается при старте приложения). */
async function restoreSession(): Promise<void> {
  const saved = await history.kvGet<{
    queue: WaveTrack[];
    index: number;
    position: number;
  }>("player_session");
  if (!saved?.queue?.length) return;
  const idx = Math.min(Math.max(saved.index, 0), saved.queue.length - 1);
  const current = saved.queue[idx];
  if (!current) return;
  usePlayerStore.setState({
    queue: saved.queue,
    index: idx,
    current,
    position: saved.position ?? 0,
    duration: current.durationSec ?? 0,
    resumeSec: saved.position ?? 0,
    playing: false,
  });
}

function getEngine(): WaveEngine | null {
  if (!engine) toastError("Плеер ещё инициализируется, попробуйте через секунду");
  return engine;
}

/** Восстановить профиль из kv (или пересобрать из истории) и создать движок. */
export async function initPlayer(): Promise<void> {
  const saved = await history.kvGet<ReturnType<TasteProfile["toJSON"]>>("taste_profile");
  const profile = saved
    ? TasteProfile.fromJSON(saved)
    : new TasteProfile();

  if (!saved) {
    // Первый запуск: восстанавливаем вкус из истории прослушиваний (ТЗ п.2).
    const events = await history.recent(400);
    for (const e of events) {
      const track = reconstructTrack(e);
      if (track) {
        profile.apply({
          type: e.event === "complete" ? "complete" : "skip",
          track,
          positionSec: e.positionSec,
        });
      }
    }
  }

  engine = new WaveEngine(profile, activeServices);

  // Колбэки движка → store. Движок не знает про zustand, как и AudioEngine.
  const store = usePlayerStore;

  audio.onTime = (t) => {
    store.setState({ position: t });
    // Периодическое сохранение сессии (раз в 5 секунд).
    const now = Date.now();
    if (now - lastSessionSave > 5000) {
      lastSessionSave = now;
      persistSession();
    }
  };
  audio.onLoaded = (d) => store.setState({ duration: d });
  audio.onEnded = () => void store.getState().next(false);
  audio.onError = (msg) => {
    toastError(msg);
    store.setState({ playing: false });
  };
  // За 2 секунды до конца текущего трека — подгружаем следующий поток,
  // чтобы переход был мгновенным (требование «бесконечного потока»).
  audio.onNearEnd = () => void preloadNext();

  // Смена трека: сохраняем сессию, докидываем хвост, отмечаем старт.
  store.subscribe((state, prev) => {
    if (state.current !== prev.current || state.index !== prev.index) {
      persistSession();
    }
    if (state.index !== prev.index && state.current) {
      void extendQueue();
      emitEvent(state.current, "play", 0);
    }
  });

  // Восстановить последний трек и позицию (память между запусками).
  await restoreSession();
}

// --- Внутренние операции --------------------------------------------------------

async function playCurrent(autoplay = true): Promise<void> {
  const { current } = usePlayerStore.getState();
  if (!current) return;
  // demo-треки играются из локального каталога, даже если сервис подключён.
  const service = current.demo
    ? mockServiceFor(current.serviceId)
    : serviceFor(current.serviceId);
  if (!service) {
    toastError(`Сервис «${current.serviceId}» не подключён`);
    return;
  }
  try {
    const stream = await service.resolveStream(current);
    await audio.load(stream, autoplay);
    loadedTrackKey = trackKey(current);
    if (autoplay) {
      usePlayerStore.setState({ playing: true });
    }
  } catch (e) {
    usePlayerStore.setState({ playing: false });
    toastError(e instanceof Error ? e.message : "Ошибка воспроизведения");
  }
}

/** Резолвим и предзагружаем поток следующего трека. */
async function preloadNext(): Promise<void> {
  const { queue, index } = usePlayerStore.getState();
  const next = queue[index + 1];
  if (!next) return;
  const service = next.demo ? mockServiceFor(next.serviceId) : serviceFor(next.serviceId);
  if (!service) return;
  try {
    const stream = await service.resolveStream(next);
    audio.preload(stream);
  } catch {
    /* предзагрузка — оптимизация, её сбой не фатален */
  }
}

/**
 * Бесконечный поток: если до конца очереди ≤ prefetchAhead треков,
 * запрашиваем новую партию у движка и докидываем в хвост.
 */
let extendInFlight = false;
async function extendQueue(): Promise<boolean> {
  const state = usePlayerStore.getState();
  const engine = engineOrNull();
  if (!engine || extendInFlight) return false;
  const remaining = state.queue.length - state.index - 1;
  if (remaining > WAVE_SETTINGS.prefetchAhead) return false;

  extendInFlight = true;
  usePlayerStore.setState({ extending: true });
  try {
    // Анти-повтор: исключаем всё, что уже в очереди.
    const exclude = new Set(state.queue.map((t) => t.id));
    let batch: WaveTrack[];
    try {
      batch = await engine.buildBatch(WAVE_SETTINGS.extendBatch, exclude);
    } catch {
      // Сервисы недоступны — продлеваем из локального каталога.
      batch = (await engine.buildBatch(WAVE_SETTINGS.extendBatch, exclude, "mix", mockServices())).map(
        (t) => ({ ...t, demo: true })
      );
    }
    usePlayerStore.setState((s) => ({ queue: [...s.queue, ...batch] }));
    return batch.length > 0;
  } catch (e) {
    toastError(e instanceof Error ? e.message : "Не удалось продлить волну");
    return false;
  } finally {
    extendInFlight = false;
    usePlayerStore.setState({ extending: false });
  }
}

/**
 * Классификация события по позиции и отправка его: профиль → kv (с дебаунсом)
 * и в историю БД. Дебаунс реализован через таймер.
 */
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function emitEvent(
  track: Track,
  base: ListenEventType,
  positionSec: number
): void {
  const engine = engineOrNull();
  if (!engine) return;

  // Скип классифицируем по доле прослушанного (правила адаптации ТЗ).
  let type: ListenEventType = base;
  if (base === "skip") {
    const frac = positionSec / Math.max(track.durationSec, 1);
    type = frac < 0.3 ? "skip_early" : frac < 0.7 ? "skip" : "near_complete";
  }

  engine.applyEvent({ type, track, positionSec });

  // Дебаунс-запись профиля в kv (не чаще раза в 2 секунды).
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void history.kvSet("taste_profile", engineOrNull()!.tasteProfile.toJSON());
  }, 2000);

  // История — для восстановления профиля после переустановки.
  history.log({
    service: track.serviceId,
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    genres: track.genres.join(","),
    event: base === "skip" ? "skip" : base,
    positionSec,
  });
}

function engineOrNull(): WaveEngine | null {
  return engine;
}

/** Из строки истории собираем объект трека, пригодный для TasteProfile. */
function reconstructTrack(e: {
  service: string;
  trackId: string;
  title: string;
  artist: string;
  genres: string;
}): Track | null {
  if (!e.artist) return null;
  return {
    id: e.trackId,
    serviceId: e.service as Track["serviceId"],
    title: e.title,
    artist: e.artist,
    genres: e.genres ? e.genres.split(",") : [],
    durationSec: 0,
  };
}
