// Génère les assets sources pour les icônes/splash NATIFS (Android/iOS) dans
// assets/, consommés ensuite par `npx @capacitor/assets generate --android`.
// Même logo SNAP/TAP que gen-icons.mjs. Lancer avec : npm run gen-native-assets
import sharp from 'sharp';
import opentype from 'opentype.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');
mkdirSync(out, { recursive: true });

const YELLOW = '#FFE600';
const PINK = '#FF2D6F';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

const fontBuf = readFileSync(join(root, 'scripts', 'fonts', 'Anton-Regular.ttf'));
const font = opentype.parse(
  fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength)
);

function textBlock(text, targetWidth, cx, cy) {
  const size = (targetWidth * 100) / font.getAdvanceWidth(text, 100);
  const p = font.getPath(text, 0, 0, size);
  const b = p.getBoundingBox();
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const dx = cx - (b.x1 + b.x2) / 2;
  const dy = cy - (b.y1 + b.y2) / 2;
  return { d: p.toPathData(2), dx, dy, w, h };
}

// Logo dessiné sur un canevas 512 (comme gen-icons.mjs), remis à l'échelle en SVG.
const S = 512;
const snap = textBlock('SNAP', 400, S / 2, 150);
const tap = textBlock('TAP', 210, S / 2, 350);
const padX = 40;
const padY = 30;
const bx = S / 2 - tap.w / 2 - padX;
const by = 350 - tap.h / 2 - padY;
const bw = tap.w + padX * 2;
const bh = tap.h + padY * 2;

const content = `  <path d="${snap.d}" transform="translate(${snap.dx.toFixed(2)},${snap.dy.toFixed(2)})" fill="${BLACK}"/>
  <g transform="rotate(-3 ${S / 2} 350)">
    <rect x="${(bx + 13).toFixed(1)}" y="${(by + 13).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${BLACK}"/>
    <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${PINK}" stroke="${BLACK}" stroke-width="14"/>
    <path d="${tap.d}" transform="translate(${tap.dx.toFixed(2)},${tap.dy.toFixed(2)})" fill="${WHITE}"/>
  </g>`;

// SVG carré taille `size`, logo mis à l'échelle `scale` (centré), fond optionnel.
function svgCanvas(size, scale, bg) {
  const k = (size / S) * scale;
  const off = (size - S * k) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
  <g transform="translate(${off.toFixed(1)} ${off.toFixed(1)}) scale(${k.toFixed(4)})">
${content}
  </g>
</svg>`;
}

const targets = [
  // Icône "classique" (stores, fallback) : logo plein cadre sur fond jaune
  { file: 'icon-only.png', size: 1024, svg: svgCanvas(1024, 1.0, YELLOW) },
  // Icône adaptative Android : fond uni + logo dans la zone sûre. 0.70 remplit
  // mieux la pastille (0.62 rendait le texte trop petit) en restant dans les
  // clous du masque rond.
  { file: 'icon-background.png', size: 1024, svg: svgCanvas(1024, 0, YELLOW) },
  { file: 'icon-foreground.png', size: 1024, svg: svgCanvas(1024, 0.78, null) },
  // Splash screens : logo centré sur fond jaune
  { file: 'splash.png', size: 2732, svg: svgCanvas(2732, 0.5, YELLOW) },
  { file: 'splash-dark.png', size: 2732, svg: svgCanvas(2732, 0.5, YELLOW) },
];

for (const { file, size, svg } of targets) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(join(out, file));
  console.log('✓ assets/' + file);
}
console.log('Assets natifs générés. Lancer : npx @capacitor/assets generate --android');
