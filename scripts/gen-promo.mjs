// Genere les visuels de com STATIQUES dans store-assets/promo/ :
//   - memes "carte" (J'AIME / J'AIME PAS + une carte du jeu)  → feed 1080x1350 + story 1080x1920
//   - duels "PLUTOT X OU Y ?"                                  → feed 1080x1350
//   - affiche QR imprimable A4 300dpi (bars, soirees)          → 2480x3508
//   - story de lancement "j'ai cree un jeu d'apero"            → 1080x1920
// Meme langage visuel que le jeu (Anton, jaune/rose/noir, brutaliste).
// Lancer :  node scripts/gen-promo.mjs
//
// REGLE EDITORIALE (legal) : ne JAMAIS mettre de vraie personne (Jul, Mbappe…)
// ni de grande marque dans ces visuels — une carte-nom dans le JEU est de
// l'opinion, la meme carte dans une PUB devient de l'exploitation d'image.
// Les listes ci-dessous ne contiennent donc que des cartes "generiques".
import sharp from 'sharp';
import opentype from 'opentype.js';
import QRCode from 'qrcode';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'store-assets', 'promo');
mkdirSync(OUT, { recursive: true });

const YELLOW = '#FFE600';
const PINK = '#FF2D6F';
const GREEN = '#00C853';
const RED = '#FF1744';
const BLACK = '#000000';
const WHITE = '#FFFFFF';

const PUBLIC_URL_LABEL = 'SNAPTAPPARTY.COM';
const QR_URL = 'https://www.snaptapparty.com';

// --- Cartes vedettes des memes (cartes REELLES du deck, sans personnes/marques)
const MEME_CARDS = [
  'Ananas sur la pizza',
  'Garder les chaussettes',
  'Vomir dans le Uber',
  'Appeler ton ex',
  'Kebab à 3h du mat',
  'Chaussettes-claquettes',
  'Moustiques en été',
  'Salle de sport à 18h',
  'Dormir 18h',
  'Lire dans les pensées',
  'Raclette',
  'Camping sauvage',
  'Couche-tard',
  'Refaire le monde à 4h',
  'Danser sur une table',
  'Match sur appli',
];

// --- Duels "PLUTOT X OU Y ?" (le 1er = la reference de la fiche store)
const VS_PAIRS = [
  ['Téléportation', 'Raclette'],
  ['Chat', 'Chien'],
  ['Mariage', 'PACS'],
  ['Camping sauvage', 'Palace 5 étoiles'],
  ['Matinal', 'Couche-tard'],
  ['Voyage temporel', 'Invisibilité'],
  ['Bière fraîche', 'Mojito'],
  ['Kebab à 3h du mat', 'Sushis'],
];

const fontBuf = readFileSync(join(root, 'scripts', 'fonts', 'Anton-Regular.ttf'));
const font = opentype.parse(
  fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength)
);

// Path SVG du texte, boite englobante centree sur (cx, cy).
function textAt(text, size, cx, cy, fill) {
  const p = font.getPath(text, 0, 0, size);
  const b = p.getBoundingBox();
  const dx = cx - (b.x1 + b.x2) / 2;
  const dy = cy - (b.y1 + b.y2) / 2;
  return `<path d="${p.toPathData(2)}" transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})" fill="${fill}"/>`;
}

function widthOf(text, size) {
  return font.getAdvanceWidth(text, size);
}

// Coupe un texte en 1-2 lignes equilibrees (au mot le plus central).
function splitBalanced(text) {
  const words = text.split(' ');
  if (words.length === 1 || text.length <= 12) return [text];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(widthOf(a, 100), widthOf(b, 100));
    if (!best || w < best.w) best = { a, b, w };
  }
  return [best.a, best.b];
}

// Carte blanche inclinee (ombre + contour) avec texte ajuste sur 1-2 lignes.
// Majuscules comme dans le jeu (les cartes y sont affichees en uppercase).
function gameCard(text, cx, cy, w, h, tilt, bg = WHITE, fg = BLACK) {
  const lines = splitBalanced(text.toUpperCase());
  const padX = w * 0.10;
  const padY = h * 0.16;
  let size = Infinity;
  for (const ln of lines) {
    size = Math.min(size, ((w - padX * 2) * 100) / widthOf(ln, 100));
  }
  const lineGap = 1.14;
  size = Math.min(size, (h - padY * 2) / (lines.length * lineGap));
  const bx = cx - w / 2;
  const by = cy - h / 2;
  const stroke = Math.max(8, Math.round(w * 0.018));
  const shadow = Math.max(10, Math.round(w * 0.026));
  let texts = '';
  lines.forEach((ln, i) => {
    const yi = cy + (i - (lines.length - 1) / 2) * size * lineGap;
    texts += textAt(ln, size, cx, yi, fg);
  });
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
    <rect x="${bx + shadow}" y="${by + shadow}" width="${w}" height="${h}" fill="${BLACK}"/>
    <rect x="${bx}" y="${by}" width="${w}" height="${h}" fill="${bg}" stroke="${BLACK}" stroke-width="${stroke}"/>
    ${texts}
  </g>`;
}

// Pastille coloree (texte blanc, ombre, inclinee) — meme style que le jeu.
function chip(text, textTargetW, cx, cy, bg, tilt, fg = WHITE) {
  const size = (textTargetW * 100) / widthOf(text, 100);
  const w = widthOf(text, size);
  const h = size; // Anton ~ cap height ≈ size
  const padX = size * 0.42;
  const padY = size * 0.30;
  const bx = cx - w / 2 - padX;
  const by = cy - h / 2 - padY;
  const bw = w + padX * 2;
  const bh = h + padY * 2;
  const stroke = Math.max(6, Math.round(size * 0.12));
  const shadow = Math.max(8, Math.round(size * 0.14));
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
    <rect x="${bx + shadow}" y="${by + shadow}" width="${bw}" height="${bh}" fill="${BLACK}"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${bg}" stroke="${BLACK}" stroke-width="${stroke}"/>
    ${textAt(text, size, cx, cy, fg)}
  </g>`;
}

// Logo SNAP/TAP (meme construction que gen-banner), rendu dans un groupe 512x512.
function logoGroup() {
  const S = 512;
  const snapSize = (400 * 100) / widthOf('SNAP', 100);
  const tapSize = (210 * 100) / widthOf('TAP', 100);
  const tapW = widthOf('TAP', tapSize);
  const padX = 40;
  const padY = 30;
  const bx = S / 2 - tapW / 2 - padX;
  const by = 350 - tapSize / 2 - padY;
  const bw = tapW + padX * 2;
  const bh = tapSize + padY * 2;
  return `${textAt('SNAP', snapSize, S / 2, 150, BLACK)}
  <g transform="rotate(-3 ${S / 2} 350)">
    <rect x="${bx + 13}" y="${by + 13}" width="${bw}" height="${bh}" fill="${BLACK}"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${PINK}" stroke="${BLACK}" stroke-width="14"/>
    ${textAt('TAP', tapSize, S / 2, 350, WHITE)}
  </g>`;
}

// Pied de page : logo + url.
function footer(W, yLogo, logoScale, yUrl, urlSize) {
  return `<g transform="translate(${W / 2 - 256 * logoScale} ${yLogo}) scale(${logoScale})">${logoGroup()}</g>
  ${textAt(PUBLIC_URL_LABEL, urlSize, W / 2, yUrl, BLACK)}`;
}

async function render(svg, W, H, file) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(W, H).png().toFile(join(OUT, file));
  console.log('✓ promo/' + file);
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

// ============ 1. MEMES CARTE (feed 1080x1350 + story 1080x1920) ============
async function memes() {
  for (const text of MEME_CARDS) {
    // --- Feed 1080x1350
    {
      const W = 1080, H = 1350;
      const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${YELLOW}"/>
  ${chip("J'AIME", 200, W / 2 - 190, 170, GREEN, -3, BLACK)}
  ${chip("J'AIME PAS", 300, W / 2 + 155, 170, RED, 2)}
  ${textAt('TU VOTES QUOI ?', 58, W / 2, 320, BLACK)}
  ${gameCard(text, W / 2, H / 2 + 60, 760, 480, -2)}
  ${footer(W, H - 260, 0.34, H - 60, 40)}
</svg>`;
      await render(svg, W, H, `meme-${slug(text)}-1080x1350.png`);
    }
    // --- Story 1080x1920
    {
      const W = 1080, H = 1920;
      const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${YELLOW}"/>
  ${chip("J'AIME", 220, W / 2 - 200, 300, GREEN, -3, BLACK)}
  ${chip("J'AIME PAS", 330, W / 2 + 165, 300, RED, 2)}
  ${textAt('TU VOTES QUOI ?', 64, W / 2, 470, BLACK)}
  ${gameCard(text, W / 2, H / 2 + 40, 820, 540, -2)}
  ${chip('LE JEU D APERO', 330, W / 2, H - 460, BLACK, -2, YELLOW)}
  ${footer(W, H - 360, 0.36, H - 80, 44)}
</svg>`;
      await render(svg, W, H, `meme-${slug(text)}-story-1080x1920.png`);
    }
  }
}

// ============ 2. DUELS "PLUTOT X OU Y ?" (feed 1080x1350) ============
async function duels() {
  const W = 1080, H = 1350;
  for (const [a, b] of VS_PAIRS) {
    const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${YELLOW}"/>
  ${textAt('PLUTÔT…', 96, W / 2, 160, BLACK)}
  ${gameCard(a, W / 2 - 40, 440, 720, 330, -3)}
  ${chip('OU', 90, W / 2 + 330, 630, PINK, -6)}
  ${gameCard(b, W / 2 + 40, 830, 720, 330, 3)}
  ${footer(W, H - 250, 0.32, H - 60, 40)}
</svg>`;
    await render(svg, W, H, `vs-${slug(a)}-${slug(b)}-1080x1350.png`);
  }
}

// ============ 3. AFFICHE QR A4 300dpi (2480x3508) ============
function qrGroup(x, y, sizePx) {
  const qr = QRCode.create(QR_URL, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const cell = sizePx / n;
  let rects = '';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (qr.modules.data[i * n + j]) {
        rects += `<rect x="${(j * cell).toFixed(2)}" y="${(i * cell).toFixed(2)}" width="${(cell + 0.4).toFixed(2)}" height="${(cell + 0.4).toFixed(2)}" fill="${BLACK}"/>`;
      }
    }
  }
  return `<g transform="translate(${x} ${y})">${rects}</g>`;
}

async function poster() {
  const W = 2480, H = 3508;
  const qrSize = 1150;
  const qrBoxPad = 90;
  const qrBox = qrSize + qrBoxPad * 2;
  const qrCx = W / 2;
  const qrCy = 2130;
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${YELLOW}"/>
  <g transform="translate(${W / 2 - 256 * 1.9} 120) scale(1.9)">${logoGroup()}</g>
  ${chip("LE JEU D'APÉRO", 900, W / 2, 1280, BLACK, -2, YELLOW)}
  <g transform="rotate(-1.5 ${qrCx} ${qrCy})">
    <rect x="${qrCx - qrBox / 2 + 26}" y="${qrCy - qrBox / 2 + 26}" width="${qrBox}" height="${qrBox}" fill="${BLACK}"/>
    <rect x="${qrCx - qrBox / 2}" y="${qrCy - qrBox / 2}" width="${qrBox}" height="${qrBox}" fill="${WHITE}" stroke="${BLACK}" stroke-width="24"/>
    ${qrGroup(qrCx - qrSize / 2, qrCy - qrSize / 2, qrSize)}
  </g>
  ${textAt('SCANNE. JOUE.', 150, W / 2, 3000, BLACK)}
  ${textAt('GRATUIT · 3 À 16 JOUEURS · CHACUN SON TEL', 62, W / 2, 3160, BLACK)}
  ${textAt(PUBLIC_URL_LABEL, 80, W / 2, 3330, BLACK)}
</svg>`;
  await render(svg, W, H, 'affiche-qr-a4-2480x3508.png');
}

// ============ 4. STORY DE LANCEMENT (1080x1920) ============
async function storyLancement() {
  const W = 1080, H = 1920;
  const qrSize = 260;
  const qrCx = W / 2;
  const qrCy = 1520;
  const box = qrSize + 56;
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${YELLOW}"/>
  ${textAt("J'AI CRÉÉ", 130, W / 2, 200, BLACK)}
  ${textAt("UN JEU D'APÉRO", 110, W / 2, 360, BLACK)}
  ${chip('TOUT SEUL, DANS MON SALON', 560, W / 2, 520, PINK, -2)}
  ${gameCard('Ananas sur la pizza', W / 2 - 30, 800, 640, 280, -3)}
  ${gameCard("J'aime ou j'aime pas ?", W / 2 + 30, 1090, 640, 230, 2, BLACK, YELLOW)}
  <g transform="rotate(-2 ${qrCx} ${qrCy})">
    <rect x="${qrCx - box / 2 + 14}" y="${qrCy - box / 2 + 14}" width="${box}" height="${box}" fill="${BLACK}"/>
    <rect x="${qrCx - box / 2}" y="${qrCy - box / 2}" width="${box}" height="${box}" fill="${WHITE}" stroke="${BLACK}" stroke-width="12"/>
    ${qrGroup(qrCx - qrSize / 2, qrCy - qrSize / 2, qrSize)}
  </g>
  ${textAt('GRATUIT · DISPO MAINTENANT', 50, W / 2, 1760, BLACK)}
  ${textAt(PUBLIC_URL_LABEL, 56, W / 2, 1850, BLACK)}
</svg>`;
  await render(svg, W, H, 'story-lancement-1080x1920.png');
}

await memes();
await duels();
await poster();
await storyLancement();
console.log(`\n${MEME_CARDS.length * 2 + VS_PAIRS.length + 2} visuels generes dans store-assets/promo/`);
