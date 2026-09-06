// ============================================================================
// Демо-каталог: 4 «сервиса», лайки и обложки в точности по макетам.
//
// Первые 9 треков (сетка 3×3 на «Библиотеке») названы «Название», как в
// макете, и несут полосатые обложки в порядке макета:
//   розовый, розовый, розовый / зелёный, розовый, зелёный / синий, розовый, синий.
// Остальные треки — с обычными названиями, обложки циклически из трёх цветов.
// ============================================================================

import type { AccentId, Playlist, ServiceId, Track } from "../../types/music";

interface MockArtist {
  id: string;
  name: string;
  genres: string[];
}

export const MOCK_ARTISTS: MockArtist[] = [
  { id: "a1", name: "Ночной эфир", genres: ["джаз", "электроника"] },
  { id: "a2", name: "Аврора", genres: ["поп", "электроника"] },
  { id: "a3", name: "Кассиопея", genres: ["инди", "поп"] },
  { id: "a4", name: "Тень и Свет", genres: ["рок"] },
  { id: "a5", name: "Кубик", genres: ["хип-хоп"] },
  { id: "a6", name: "Полярная", genres: ["инди", "рок"] },
  { id: "a7", name: "Северный ветер", genres: ["поп"] },
  { id: "a8", name: "Глубина", genres: ["электроника", "джаз"] },
];

const TRACK_TITLES: Record<string, string[]> = {
  a1: ["Полночный трём", "Дым по воде", "Синий час"],
  a2: ["Стеклянный рассвет", "Кислород", "Мимолётность"],
  a3: ["Бумажный самолёт", "Тёплый бетон", "Осколки лета"],
  a4: ["Тень и Свет", "Импульс", "Стальная листва"],
  a5: ["Кубометр", "Чёрный квадрат", "Медленно"],
  a6: ["Полярная ночь", "Сигналы", "Тихий берег"],
  a7: ["Северный ветер", "Метель", "Первая искра"],
  a8: ["Глубина", "Марианская", "Акустика бездны"],
};

/** Сетка библиотеки 3×3: сервис и цвет обложки каждой ячейки — по макету. */
const GRID: Array<{ svc: ServiceId; accent: AccentId }> = [
  { svc: "yandex", accent: "pink" },
  { svc: "yandex", accent: "pink" },
  { svc: "yandex", accent: "pink" },
  { svc: "vk", accent: "green" },
  { svc: "vk", accent: "pink" },
  { svc: "yandex", accent: "green" },
  { svc: "vk", accent: "blue" },
  { svc: "yandex", accent: "pink" },
  { svc: "vk", accent: "blue" },
];

const SEED_COUNT = 9;
const CYCLE: AccentId[] = ["pink", "green", "blue"];

function buildTracks(): Track[] {
  const tracks: Track[] = [];

  // 9 «сеточных» треков-плейсхолдеров (как в макете).
  for (let i = 0; i < SEED_COUNT; i++) {
    const { svc, accent } = GRID[i];
    const artist = MOCK_ARTISTS[i % MOCK_ARTISTS.length];
    tracks.push({
      id: `${svc}-seed-${i}`,
      serviceId: svc,
      title: "Название",
      artist: artist.name,
      artistId: artist.id,
      genres: [...artist.genres],
      durationSec: i === 0 ? 130 : 120 + ((i * 37) % 140), // первый = 2:10, как в макете
      accentId: accent,
    });
  }

  // Остальной каталог — обычные треки (только Яндекс и VK).
  const services: ServiceId[] = ["yandex", "vk"];
  let n = 0;
  for (const svc of services) {
    for (const artist of MOCK_ARTISTS) {
      const titles = TRACK_TITLES[artist.id];
      tracks.push({
        id: `${svc}-${artist.id}-${n % titles.length}`,
        serviceId: svc,
        title: titles[n % titles.length],
        artist: artist.name,
        artistId: artist.id,
        genres: [...artist.genres],
        durationSec: 120 + ((n * 37) % 140),
        accentId: CYCLE[n % CYCLE.length],
      });
      n++;
    }
  }
  return tracks;
}

export const MOCK_TRACKS: Track[] = buildTracks();

/** Локальные лайки — 9 треков сетки библиотеки. */
export const SEED_LIKED_IDS = new Set(
  MOCK_TRACKS.slice(0, SEED_COUNT).map((t) => t.id)
);

export const MOCK_PLAYLISTS: Playlist[] = [
  { id: "p1", serviceId: "yandex", name: "Для дороги", trackCount: 42 },
  { id: "p2", serviceId: "vk", name: "Фокус", trackCount: 18 },
  { id: "p3", serviceId: "yandex", name: "Вечер", trackCount: 33 },
  { id: "p4", serviceId: "vk", name: "Тренировка", trackCount: 27 },
];

/** Псевдослучайная обложка-градиент по хешу строки (для треков без арта). */
export function artFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 40) % 360;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${hue},30%,72%)'/>` +
    `<stop offset='1' stop-color='hsl(${hue2},35%,45%)'/>` +
    `</linearGradient></defs>` +
    `<rect width='160' height='160' fill='url(#g)'/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
