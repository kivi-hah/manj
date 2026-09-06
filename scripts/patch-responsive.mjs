// Одноразовый адаптивный патч UI-компонентов.
import fs from "node:fs";

const dir = new URL(".", import.meta.url).pathname.replace(/^\//, "").replace(/\//g, "\\");
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

patch("screens\\HomeScreen.tsx", [
  ['className="relative flex h-full flex-col gap-10 p-7"', 'className="relative flex h-full flex-col gap-6 overflow-y-auto p-5 xl:gap-10 xl:p-7"'],
  ['<section className="flex min-h-0 flex-1 items-stretch gap-10">', '<section className="flex min-h-0 flex-1 flex-col items-stretch gap-8 xl:flex-row xl:gap-10">'],
  ['className="relative w-[46%] shrink-0 rounded-hero bg-cover bg-center"', 'className="relative h-[300px] w-full shrink-0 rounded-hero bg-cover bg-center sm:h-[360px] xl:h-auto xl:w-[46%]"'],
  ['<h1 className="text-[40px] font-medium leading-tight tracking-tight">', '<h1 className="text-[30px] font-medium leading-tight tracking-tight xl:text-[40px]">'],
  ['mt-6 max-w-[560px] text-[15px]', 'mt-6 max-w-[560px] text-[13px] xl:text-[15px]'],
  ['<section className="flex items-center gap-10">', '<section className="flex flex-col items-center gap-6 xl:flex-row xl:items-center xl:gap-10">'],
  ['className="h-[290px] w-auto shrink-0 object-cover"', 'className="h-[180px] w-auto shrink-0 object-cover xl:h-[290px]"'],
  ['<h2 className="text-[30px] font-extrabold tracking-tight">', '<h2 className="text-[24px] font-extrabold tracking-tight xl:text-[30px]">'],
]);

patch("screens\\LibraryScreen.tsx", [
  ['className="flex h-full flex-col gap-7 p-7"', 'className="flex h-full flex-col gap-5 p-5 xl:gap-7 xl:p-7"'],
  ["flex h-[170px] shrink-0 items-center justify-center rounded-hero bg-gradient-to-r from-pinkA to-pinkB", "flex h-[120px] shrink-0 items-center justify-center rounded-hero bg-gradient-to-r from-pinkA to-pinkB xl:h-[170px]"],
  ["text-[34px] font-black tracking-tight", "text-[24px] font-black tracking-tight xl:text-[34px]"],
  ["grid grid-cols-4 gap-x-6 gap-y-6 pr-2", "grid grid-cols-2 gap-x-5 gap-y-5 pr-2 md:grid-cols-3 xl:grid-cols-4"],
]);

patch("screens\\LibraryAllScreen.tsx", [
  ["grid grid-cols-4 content-start gap-x-6 gap-y-6", "grid grid-cols-2 content-start gap-x-5 gap-y-5 md:grid-cols-3 xl:grid-cols-4"],
]);

patch("screens\\SearchScreen.tsx", [
  ["grid grid-cols-2 content-start gap-x-16 gap-y-5 overflow-y-auto pb-4", "grid grid-cols-1 content-start gap-x-12 gap-y-5 overflow-y-auto pb-4 md:grid-cols-2 xl:grid-cols-3"],
]);

patch("screens\\ArtistScreen.tsx", [
  ['className="flex items-start gap-10"', 'className="flex flex-col items-start gap-8 md:flex-row md:gap-10"'],
  ["h-[300px] w-[300px] shrink-0 animate-shimmer rounded-[40px] bg-white/10", "h-[220px] w-[220px] shrink-0 animate-shimmer rounded-[40px] bg-white/10 xl:h-[300px] xl:w-[300px]"],
  ["aspect-square w-[300px] rounded-[40px] object-cover shadow-xl shadow-black/25", "aspect-square w-[220px] rounded-[40px] object-cover shadow-xl shadow-black/25 xl:w-[300px]"],
]);

patch("PlayerBar.tsx", [
  ['className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-[124px] items-center justify-center gap-6"', 'className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex h-[104px] items-center justify-center gap-4 xl:h-[124px] xl:gap-6"'],
  ["w-12 text-right text-[20px] font-semibold tabular-nums text-white", "w-10 text-right text-[15px] font-semibold tabular-nums text-white xl:w-12 xl:text-[20px]"],
  ["relative flex h-[92px] w-[min(52vw,1020px)]", "relative flex h-[80px] w-[min(94vw,1020px)] xl:h-[92px]"],
  ["h-[80px] w-[104px] shrink-0 overflow-hidden rounded-full", "h-[66px] w-[88px] shrink-0 overflow-hidden rounded-full xl:h-[80px] xl:w-[104px]"],
  ["truncate text-[19px] font-bold", "truncate text-[15px] font-bold xl:text-[19px]"],
  ["h-[72px] w-[72px] items-center justify-center rounded-full bg-black", "h-[60px] w-[60px] items-center justify-center rounded-full bg-black xl:h-[72px] xl:w-[72px]"],
  ["ms-fill text-[38px]", "ms-fill text-[32px] xl:text-[38px]"],
  ["w-12 text-[20px] font-semibold tabular-nums text-white", "w-10 text-[15px] font-semibold tabular-nums text-white xl:w-12 xl:text-[20px]"],
]);
console.log("done");
