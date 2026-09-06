// ============================================================================
// Демо-аудиопоток для mock-сервисов.
//
// Генерируем короткий WAV (мягкий аккорд с медленным тремоло) в Blob и
// кэшируем object-URL по id трека. Это НЕ имитация «на глаз»: плеер получает
// настоящий медиафайл, работает перемотка, длительность и события ended.
// В реальном режиме вместо этого адаптер вернёт подписанный URL CDN или
// stream://… прокси.
// ============================================================================

const cache = new Map<string, string>();

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** Создать (или взять из кэша) демо-WAV длительностью `seconds` секунд. */
export function mockStreamUrl(trackId: string, seconds: number): string {
  const cached = cache.get(trackId);
  if (cached) return cached;

  const dur = Math.min(Math.max(Math.floor(seconds), 20), 180);
  const rate = 22050; // моно 16 бит — хватает для демо и экономит память
  const n = rate * dur;

  const pcm = new Int16Array(n);
  let seed = hash(trackId) || 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 2 ** 32);

  // Тональность слегка «уникальна» для каждого трека.
  const base = 180 + Math.floor(rnd() * 120);
  const third = base * 1.25;
  const fifth = base * 1.5;

  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.15 * t); // медленное тремоло
    const env = Math.min(1, t * 2, (dur - t) * 2); // плавные начало/конец
    const s =
      (Math.sin(2 * Math.PI * base * t) * 0.5 +
        Math.sin(2 * Math.PI * third * t) * 0.3 +
        Math.sin(2 * Math.PI * fifth * t) * 0.2) *
      lfo *
      env *
      0.5;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
  }

  // Сборка WAV-контейнера (44-байтовый заголовок + PCM).
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  dv.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // моно
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, "data");
  dv.setUint32(40, n * 2, true);
  new Int16Array(buf, 44).set(pcm);

  const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  cache.set(trackId, url);
  return url;
}
