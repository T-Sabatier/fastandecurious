// Migration one-shot fast-and-curious-a38c3 → snaptap-party.
// Utilise firebase-admin (bypass des regles) via une cle de compte de service.
//
// Pre-requis :
//   - Cle de service : C:\Users\Valky\snap-tap-keys\snaptap-party-sa.json
//   - .env pointe deja sur snaptap-party (VITE_FIREBASE_*)
//   - backup deck : backups/full-export-2026-07-17-avant-migration-snaptap.json
//   - identifiants admin : scripts/.admin-credentials.json
//
// Actions :
//   1. Importe cards + categories dans la nouvelle base.
//   2. Recree le compte admin (email/mdp) s'il n'existe pas.
//   3. Ecrit admin/<uid> = true (droits d'ecriture du deck).
//
// Usage : node scripts/migrate-to-snaptap.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SA_PATH = 'C:/Users/Valky/snap-tap-keys/snaptap-party-sa.json';
const BACKUP = join(root, 'backups/full-export-2026-07-17-avant-migration-snaptap.json');

// --- .env (parse minimal) ---
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const databaseURL = env.VITE_FIREBASE_DATABASE_URL;
const projectId = env.VITE_FIREBASE_PROJECT_ID;

// --- fichiers ---
let serviceAccount, backup, admins;
try {
  serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf8'));
} catch {
  console.error('❌ Cle de service introuvable a :', SA_PATH);
  console.error('   Genere-la (Firebase → Parametres → Comptes de service) et place-la a ce chemin exact.');
  process.exit(1);
}
backup = JSON.parse(readFileSync(BACKUP, 'utf8'));
admins = JSON.parse(readFileSync(join(root, 'scripts/.admin-credentials.json'), 'utf8'));

// --- garde-fou : la cle doit viser le MEME projet que le .env ---
if (serviceAccount.project_id !== projectId) {
  console.error('❌ La cle vise le projet "' + serviceAccount.project_id + '" mais .env pointe sur "' + projectId + '".');
  console.error('   Refus par securite (on ne veut surtout pas ecrire dans le mauvais projet).');
  process.exit(1);
}

console.log('→ Projet cible :', projectId);
console.log('→ Base        :', databaseURL);

const app = initializeApp({ credential: cert(serviceAccount), databaseURL });
const db = getDatabase(app);
const auth = getAuth(app);

const nCards = Object.keys(backup.cards || {}).length;
const nCats = Object.keys(backup.categories || {}).length;

// 1. Import du deck
await db.ref('cards').set(backup.cards);
await db.ref('categories').set(backup.categories);
console.log('✅ Importe :', nCards, 'cartes,', nCats, 'categories');

// 2. Compte admin
let user;
try {
  user = await auth.getUserByEmail(admins.email);
  console.log('ℹ️  Compte admin deja present :', user.uid);
} catch {
  user = await auth.createUser({ email: admins.email, password: admins.password });
  console.log('✅ Compte admin cree :', user.uid);
}

// 3. Noeud admin
await db.ref('admin/' + user.uid).set(true);
console.log('✅ Noeud admin/' + user.uid + ' = true (droits deck OK)');

console.log('\n🎉 Migration terminee vers', projectId);
process.exit(0);
