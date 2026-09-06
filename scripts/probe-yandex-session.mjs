// Диагностика №3: контекст вокруг Session_id и токенных вызовов в чанках плеера.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126";

const home = await (await fetch("https://music.yandex.ru/", { headers: { "User-Agent": UA } })).text();
const srcs = [...home.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);

for (const s of srcs) {
  const url = s.startsWith("http") ? s : "https:" + s;
  if (!/\.js(\?|$)/.test(url)) continue;
  let t;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    t = await r.text();
  } catch {
    continue;
  }
  if (!t.includes("Session_id")) continue;

  console.log(`### CHUNK ${url.slice(-60)} (${t.length})`);
  // Контекст вокруг Session_id
  let idx = 0;
  let shown = 0;
  while ((idx = t.indexOf("Session_id", idx)) !== -1 && shown < 4) {
    console.log("--- ctx @" + idx + ":");
    console.log(t.slice(Math.max(0, idx - 260), idx + 260).replace(/\s+/g, " "));
    idx += 10;
    shown++;
  }
  // Поиск эндпоинтов обмена токенов
  for (const pat of ["oauth", "token", "/api/", "yandex.ru/", "passport", "accounts_media"]) {
    const hits = [];
    let i = 0;
    let count = 0;
    while ((i = t.indexOf(pat, i)) !== -1 && count < 3) {
      hits.push(t.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, " "));
      i += pat.length;
      count++;
    }
    if (hits.length) {
      console.log(`--- "${pat}":`);
      for (const h of hits) console.log("   " + h);
    }
  }
}
