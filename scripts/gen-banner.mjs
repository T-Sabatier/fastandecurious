// Genere la banniere Play Store (feature graphic 1024x500) dans
// store-assets/banner-1024x500.png. Meme langage visuel que le jeu :
// logo SNAP/TAP + pastilles J'AIME / J'AIME PAS. Lancer :
//   node scripts/gen-banner.mjs
import sharp from 'sharp';
import opentype from 'opentype.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'store-assets'), { recursive: true });

const YELLOW = '#FFE600';
const PINK = '#FF2D6F';
const GREEN = '#00C853';
const RED = '#FF1744';
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

// Pastille type "carte" : rect ombre + rect colore + texte blanc, inclinee.
function chip(text, targetWidth, cx, cy, bg, tilt) {
  const t = textBlock(text, targetWidth, cx, cy);
  const padX = 34;
  const padY = 26;
  const bx = cx - t.w / 2 - padX;
  const by = cy - t.h / 2 - padY;
  const bw = t.w + padX * 2;
  const bh = t.h + padY * 2;
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
    <rect x="${bx + 10}" y="${by + 10}" width="${bw}" height="${bh}" fill="${BLACK}"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${bg}" stroke="${BLACK}" stroke-width="10"/>
    <path d="${t.d}" transform="translate(${t.dx.toFixed(2)},${t.dy.toFixed(2)})" fill="${WHITE}"/>
  </g>`;
}

// --- Logo SNAP / TAP (meme construction que gen-icons, canvas 512) ---
const S = 512;
const snap = textBlock('SNAP', 400, S / 2, 150);
const tap = textBlock('TAP', 210, S / 2, 350);
const padX = 40;
const padY = 30;
const bx = S / 2 - tap.w / 2 - padX;
const by = 350 - tap.h / 2 - padY;
const bw = tap.w + padX * 2;
const bh = tap.h + padY * 2;
const logo = `<path d="${snap.d}" transform="translate(${snap.dx.toFixed(2)},${snap.dy.toFixed(2)})" fill="${BLACK}"/>
  <g transform="rotate(-3 ${S / 2} 350)">
    <rect x="${(bx + 13).toFixed(1)}" y="${(by + 13).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${BLACK}"/>
    <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${PINK}" stroke="${BLACK}" stroke-width="14"/>
    <path d="${tap.d}" transform="translate(${tap.dx.toFixed(2)},${tap.dy.toFixed(2)})" fill="${WHITE}"/>
  </g>`;

// --- Composition 1024x500 ---
const k = 0.82; // echelle du logo (512 -> ~420)
const logoX = 30;
const logoY = (500 - S * k) / 2;

const svg = `<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="500" fill="${YELLOW}"/>
  <g transform="translate(${logoX} ${logoY}) scale(${k})">
${logo}
  </g>
  ${chip("J'AIME", 220, 720, 165, GREEN, -3)}
  ${chip("J'AIME PAS", 330, 745, 340, RED, 2)}
</svg>`;

await sharp(Buffer.from(svg), { density: 300 })
  .resize(1024, 500)
  .png()
  .toFile(join(root, 'store-assets', 'banner-1024x500.png'));
console.log('✓ store-assets/banner-1024x500.png');
