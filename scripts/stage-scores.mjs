// Met en scene les scores d'une room pour les captures du store.
// Usage: node scripts/stage-scores.mjs <ROOMCODE>
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
});
const creds = JSON.parse(
  readFileSync(join(root, 'scripts', '.admin-credentials.json'), 'utf8')
);
await signInWithEmailAndPassword(getAuth(app), creds.email, creds.password);
const db = getDatabase(app);

const [, , roomCode] = process.argv;
const snap = await get(ref(db, `rooms/${roomCode}`));
if (!snap.exists()) throw new Error(`Room ${roomCode} introuvable`);
const room = snap.val();

// Scores serres pour un beau classement (le prochain gagnant finit la partie)
const SCORES = { tim: 3, adi: 3, guillaume: 2, mika: 2, chloé: 1, chloe: 1 };

const updates = {};
for (const [pid, p] of Object.entries(room.players || {})) {
  const target = SCORES[(p.name || '').toLowerCase()];
  if (target !== undefined) {
    updates[`players/${pid}/score`] = target;
    console.log(`${p.name} : ${p.score || 0} → ${target}`);
  }
}
await update(ref(db, `rooms/${roomCode}`), updates);
console.log('✅ Scores mis en scène');
process.exit(0);
