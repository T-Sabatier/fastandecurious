// Rogne les barres systeme (statut + navigation) des captures brutes pour
// produire les versions store dans store-assets/screenshots/final/.
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'store-assets', 'screenshots');
const out = join(src, 'final');
mkdirSync(out, { recursive: true });

const TOP = 120; // barre de statut (heure, batterie)
const BOTTOM = 150; // barre de navigation Android

for (const f of readdirSync(src)) {
  if (!f.match(/^\d\d-.*\.png$/)) continue; // uniquement les captures numerotees
  const img = sharp(join(src, f));
  const meta = await img.metadata();
  await img
    .extract({
      left: 0,
      top: TOP,
      width: meta.width,
      height: meta.height - TOP - BOTTOM,
    })
    .png()
    .toFile(join(out, f));
  console.log(`✓ ${f}  ${meta.width}x${meta.height} → ${meta.width}x${meta.height - TOP - BOTTOM}`);
}
console.log('Versions store dans store-assets/screenshots/final/');
