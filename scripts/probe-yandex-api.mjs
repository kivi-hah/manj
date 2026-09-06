// Диагностика №2: сканируем ВСЕ чанки веб-плеера и ищем пути API,
// а также пробуем v2.1-эндпоинты с полным набором браузерных заголовков.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

const home = await (await fetch("https://music.yandex.ru/", { headers: { "User-Agent": UA } })).text();
const srcs = [...home.matchAll(/(?:<script[^>]+src="([^"]+)")|(?:href="([^"]+\.js[^"]*)")/g)]
  .map((m) => m[1] || m[2]);
console.log("scripts:", srcs.length);

const found = new Set();
let fetched = 0;
let bytes = 0;
for (const s of srcs) {
  if (fetched > 90 || bytes > 40_000_000) break;
  const url = s.startsWith("http") ? s : "https:" + s;
  if (!/\.js(\?|$)/.test(url)) continue;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    const t = await r.text();
    fetched++;
    bytes += t.length;
    const res = [];
    let m;
    const re =
      /(v2\.1\/handlers\/[a-zA-Z0-9/_.{}$:,-]{0,60})|(\/handlers\/[a-zA-Z0-9._-]{2,40})|(many-ids)|(like-tracks)|(account\/status)|(likes\/tracks)|(music-search[a-zA-Z0-9._-]*)|(web-metadata-storage)|(playaudio[a-zA-Z0-9/_.-]*)|(api\.music[a-z.-]*)|(Session_id)/g;
    while ((m = re.exec(t))) {
      if (!found.has(m[0])) {
        found.add(m[0]);
        res.push(m[0]);
      }
    }
    if (res.length) console.log(`${url.slice(-60)} → ${res.slice(0, 12).join(" | ")}`);
  } catch {
    /* пропускаем */
  }
}
console.log(`scanned ${fetched} files, ${(bytes / 1e6).toFixed(1)} MB`);
console.log("=== ALL UNIQUE:");
console.log([...found].slice(0, 120).join("\n"));

// v2.1 с браузерными заголовками
for (const path of [
  "/api/v2.1/handlers/library?like-tracks=true",
  "/api/v2.1/handlers/account/status",
  "/api/v2.1/handlers/track?many-ids=80584",
]) {
  const r = await fetch("https://music.yandex.ru" + path, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://music.yandex.ru/",
      "X-Yandex-Music-Client": "YandexMusicWeb",
    },
  });
  const t = await r.text();
  console.log(`=== ${path} HTTP:${r.status} :: ${t.slice(0, 150).replace(/\n/g, " ")}`);
}
