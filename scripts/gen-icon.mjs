// ============================================================================
// Генератор icons/icon.ico без внешних зависимостей.
// Рисует мини-версию логотипа: 7 вертикальных «пилюль» на тёмном фоне.
// Для настоящей иконки: npm run tauri icon path/to/logo.png
// Запуск: node scripts/gen-icon.mjs
// ============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src-tauri", "icons", "icon.ico");

const S = 256; // сторона (256 → в ICONDIRENTRY пишется 0)
const px = Buffer.alloc(S * S * 4); // BGRA, строки снизу вверх

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  px[i] = b;
  px[i + 1] = g;
  px[i + 2] = r;
  px[i + 3] = a;
}

// Фон — почти чёрный квадрат со скруглением (упрощённо: круг)
const cx = S / 2;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, y - cx);
    if (d <= cx) setPx(x, y, 0x0a, 0x0a, 0x0a);
  }
}

// 7 вертикальных полос разной высоты (как у логотипа «Volna»)
const bars = 7;
const margin = 56;
const gap = 6;
const barW = Math.floor((S - margin * 2 - gap * (bars - 1)) / bars);
const centerY = S / 2;
for (let b = 0; b < bars; b++) {
  const h = 70 + Math.round(46 * Math.abs(Math.sin(b * 1.7)));
  const x0 = margin + b * (barW + gap);
  const y0 = centerY - h;
  const y1 = centerY + h;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x < x0 + barW; x++) {
      // скруглённые торцы
      const capR = barW / 2;
      const topCap = Math.hypot(x - (x0 + capR), y - y0) <= capR + 2;
      const bottomCap = Math.hypot(x - (x0 + capR), y - y1) <= capR + 2;
      const inBody = y >= y0 && y <= y1;
      if (inBody && (topCap || bottomCap || (y > y0 && y < y1))) {
        setPx(x, y, 0xc3, 0xc3, 0xc3);
      }
    }
  }
}

// --- Сборка ICO: 6-байтовый заголовок + 1 запись + BMP (40 + пиксели + маска) ---

const andMaskRow = Math.ceil(S / 32) * 4; // строки маски кратны 4 байтам
const andMaskSize = andMaskRow * S;
const bmpSize = 40 + px.length + andMaskSize;
const imageOffset = 6 + 16;

const icon = Buffer.alloc(imageOffset + bmpSize);

// ICONDIR
icon.writeUInt16LE(0, 0); // reserved
icon.writeUInt16LE(1, 2); // type: icon
icon.writeUInt16LE(1, 4); // count

// ICONDIRENTRY
icon.writeUInt8(0, 6); // width 256 → 0
icon.writeUInt8(0, 7); // height 256 → 0
icon.writeUInt8(0, 8); // palette
icon.writeUInt8(0, 9); // reserved
icon.writeUInt16LE(1, 10); // planes
icon.writeUInt16LE(32, 12); // bpp
icon.writeUInt32LE(bmpSize, 14);
icon.writeUInt32LE(imageOffset, 18);

// BITMAPINFOHEADER (biHeight = ×2: XOR + AND)
const off = imageOffset;
icon.writeUInt32LE(40, off);
icon.writeInt32LE(S, off + 4);
icon.writeInt32LE(S * 2, off + 8);
icon.writeUInt16LE(1, off + 12);
icon.writeUInt16LE(32, off + 14);
icon.writeUInt32LE(0, off + 20);

// Пиксели снизу вверх
px.copy(icon, off + 40);
// AND-маска — нули (непрозрачность определяется альфа-каналом)

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, icon);
console.log(`OK: ${OUT} (${icon.length} bytes)`);
