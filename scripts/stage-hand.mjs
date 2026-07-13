// Met en scene la main d'un joueur pour les captures d'ecran du store :
// remplace le contenu des cartes qu'il tient (pool de la room) par un
// tirage choisi. Usage: node stage-hand.mjs <ROOMCODE> <NomJoueur>
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';

const root = 'c:/Users/Valky/Desktop/Fast and curious/fastandecurious';
const env = {};
for (const line of readFileSync(`${root}/.env`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
});
const creds = JSON.parse(readFileSync(`${root}/scripts/.admin-credentials.json`, 'utf8'));
await signInWithEmailAndPassword(getAuth(app), creds.email, creds.password);
const db = getDatabase(app);

const [, , roomCode, playerName] = process.argv;
const snap = await get(ref(db, `rooms/${roomCode}`));
if (!snap.exists()) throw new Error(`Room ${roomCode} introuvable`);
const room = snap.val();

const entry = Object.entries(room.players || {}).find(
  ([, p]) => (p.name || '').toLowerCase() === playerName.toLowerCase()
);
if (!entry) throw new Error(`Joueur "${playerName}" introuvable`);
const [pid] = entry;

const handIds = Object.keys(room.hands?.[pid] || {});
console.log(`Main de ${playerName} (${pid}) : ${handIds.length} cartes`);
handIds.forEach((id) => console.log(`  avant: ${room.pool?.[id]?.t} (${room.pool?.[id]?.cat})`));

// Le tirage vitrine (cartes réelles du deck, mix de catégories/couleurs)
const SHOWCASE = [
  { t: 'Dua Lipa', cat: 'musique', spicy: false },
  { t: 'Pastis', cat: 'boisson', spicy: false },
  { t: 'Raclette', cat: 'bouffe', spicy: false },
  { t: 'Road trip USA', cat: 'voyages', spicy: false },
  { t: 'Chaussettes-claquettes', cat: 'mode', spicy: false },
  { t: 'Manger sans grossir', cat: 'absurde', spicy: false },
  { t: 'Sieste coquine à deux', cat: 'coquin', spicy: true },
];

const updates = {};
handIds.slice(0, SHOWCASE.length).forEach((id, i) => {
  updates[`pool/${id}`] = SHOWCASE[i];
});
await update(ref(db, `rooms/${roomCode}`), updates);
console.log(`\n✅ Main remplacée par le tirage vitrine (${Object.keys(updates).length} cartes)`);
process.exit(0);
