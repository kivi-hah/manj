// Допатчи по оставшимся строкам.
import fs from "node:fs";

const base = "C:\\Users\\Tim\\.zcode\\workspace\\default\\volna\\src\\components\\";

function patch(file, pairs) {
  const p = base + file;
  let s = fs.readFileSync(p, "utf8");
  let hits = 0;
  for (const [from, to] of pairs) {
    if (s.includes(from)) {
      s = s.split(from).join(to);
      hits++;
    } else {
      console.log("MISS:", file, "::", from.slice(0, 60));
    }
  }
  fs.writeFileSync(p, s);
  console.log("OK:", file, `(${hits}/${pairs.length})`);
}

patch("screens\\SearchScreen.tsx", [
  ["grid min-h-0 flex-1 grid-cols-2 content-start gap-x-16 gap-y-5 overflow-y-auto pb-4", "grid min-h-0 flex-1 grid-cols-1 content-start gap-x-12 gap-y-5 overflow-y-auto pb-4 md:grid-cols-2 xl:grid-cols-3"],
  ["h-16 shrink-0 rounded-full bg-surface2 px-8 text-[18px]", "h-14 shrink-0 rounded-full bg-surface2 px-6 text-[16px] xl:h-16 xl:px-8 xl:text-[18px]"],
]);

patch("screens\\ArtistScreen.tsx", [
  ["h-[300px] w-[300px] shrink-0 rounded-[40px] object-cover shadow-xl shadow-black/25", "h-[220px] w-[220px] shrink-0 rounded-[40px] object-cover shadow-xl shadow-black/25 xl:h-[300px] xl:w-[300px]"],
]);

patch("PlayerBar.tsx", [
  ["ml-1 mr-1 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-black", "ml-1 mr-1 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-black xl:h-[72px] xl:w-[72px]"],
  ["ms-fill text-[44px]", "ms-fill text-[38px] xl:text-[44px]"],
]);

console.log("done");
