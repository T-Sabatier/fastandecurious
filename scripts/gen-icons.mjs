// Génère les icônes PWA à partir de public/icon-src.svg
// Lancer avec : npm run gen-icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const src = readFileSync(join(pub, 'icon-src.svg'));

const targets = [
  { file: 'pwa-64x64.png', size: 64 },
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'maskable-icon-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32x32.png', size: 32 },
];

for (const { file, size } of targets) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(join(pub, file));
  console.log('✓', file);
}
console.log('Icônes générées dans public/');
