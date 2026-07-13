// Génère le logo SNAP / TAP (texte Anton converti en tracés vectoriels) puis
// toutes les icônes PWA + favicon. Lancer avec : npm run gen-icons
import sharp from 'sharp';
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const YELLOW = '#FFE600';
const PINK = '#FF2D6F';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

const fontBuf = readFileSync(join(root, 'scripts', 'fonts', 'Anton-Regular.ttf'));
const font = opentype.parse(
  fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength)
);

// Renvoie un tracé centré visuellement sur (cx, cy) pour une largeur cible.
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

const S = 512;

// --- HATE (noir, en haut) ---
const snap = textBlock('HATE', 400, S / 2, 150);

// --- LOVE (blanc) dans un encadré rose ---
const tap = textBlock('LOVE', 260, S / 2, 350);
const padX = 40;
const padY = 30;
const bx = S / 2 - tap.w / 2 - padX;
const by = 350 - tap.h / 2 - padY;
const bw = tap.w + padX * 2;
const bh = tap.h + padY * 2;
const stroke = 14;
const shadowOff = 13;
const tilt = -3; // léger basculement comme le logo

// Contenu du logo (sans le fond), réutilisé tel quel ou dézoomé (maskable).
const content = `  <path d="${snap.d}" transform="translate(${snap.dx.toFixed(2)},${snap.dy.toFixed(2)})" fill="${BLACK}"/>
  <g transform="rotate(${tilt} ${S / 2} 350)">
    <rect x="${(bx + shadowOff).toFixed(1)}" y="${(by + shadowOff).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${BLACK}"/>
    <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${PINK}" stroke="${BLACK}" stroke-width="${stroke}"/>
    <path d="${tap.d}" transform="translate(${tap.dx.toFixed(2)},${tap.dy.toFixed(2)})" fill="${WHITE}"/>
  </g>`;

const wrap = (inner) =>
  `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${S}" height="${S}" fill="${YELLOW}"/>
${inner}
</svg>
`;

const svg = wrap(content);
// Maskable : on dézoome (~0.78) pour que rien ne soit rogné par le masque rond.
const maskableSvg = wrap(
  `  <g transform="translate(${S / 2} ${S / 2}) scale(0.78) translate(${-S / 2} ${-S / 2})">
${content}
  </g>`
);

writeFileSync(join(pub, 'icon-src.svg'), svg);
console.log('✓ icon-src.svg');

const targets = [
  { file: 'pwa-64x64.png', size: 64, src: svg },
  { file: 'pwa-192x192.png', size: 192, src: svg },
  { file: 'pwa-512x512.png', size: 512, src: svg },
  { file: 'maskable-icon-512x512.png', size: 512, src: maskableSvg },
  { file: 'apple-touch-icon.png', size: 180, src: svg },
  { file: 'favicon-32x32.png', size: 32, src: svg },
];

for (const { file, size, src } of targets) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(join(pub, file));
  console.log('✓', file);
}
console.log('Logo + icônes générés dans public/');
