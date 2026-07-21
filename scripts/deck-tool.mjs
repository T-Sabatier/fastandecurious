// Outil d'édition du deck EN BASE (la source de vérité), authentifié admin.
// Identifiants : scripts/.admin-credentials.json (local, gitignoré).
// Config Firebase : lue depuis .env (les VITE_FIREBASE_*).
//
// Usage :
//   node scripts/deck-tool.mjs count                    → total + par catégorie
//   node scripts/deck-tool.mjs list <catId>             → cartes d'une catégorie
//   node scripts/deck-tool.mjs cats                     → liste des catégories
//   node scripts/deck-tool.mjs add <catId> "Texte" [--spicy]
//   node scripts/deck-tool.mjs del <cardId>
//   node scripts/deck-tool.mjs rename <cardId> "Nouveau texte"
//   node scripts/deck-tool.mjs addcat <id> "Label" <emoji> [--spicy] [--pack <packId>]
//   node scripts/deck-tool.mjs setpack <catId> <packId> → rattache à un pack (verrou)
//   node scripts/deck-tool.mjs unsetpack <catId>        → détache (redevient gratuite)
//   node scripts/deck-tool.mjs export <fichier.json>    → sauvegarde complète
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
} from 'firebase/database';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Config depuis .env (parse minimal, pas de dependance) ---
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

// --- Connexion admin ---
const creds = JSON.parse(
  readFileSync(join(root, 'scripts', '.admin-credentials.json'), 'utf8')
);
const auth = getAuth(app);
await signInWithEmailAndPassword(auth, creds.email, creds.password);
const db = getDatabase(app);

const [, , cmd, ...args] = process.argv;

async function loadAll() {
  const [cardsSnap, catsSnap] = await Promise.all([
    get(ref(db, 'cards')),
    get(ref(db, 'categories')),
  ]);
  return { cards: cardsSnap.val() || {}, categories: catsSnap.val() || {} };
}

switch (cmd) {
  case 'count': {
    const { cards, categories } = await loadAll();
    const byCat = {};
    Object.values(cards).forEach((c) => {
      byCat[c.cat] = (byCat[c.cat] || 0) + 1;
    });
    console.log(`TOTAL : ${Object.keys(cards).length} cartes\n`);
    Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, n]) => {
        const meta = categories[cat];
        const label = meta ? `${meta.emoji} ${meta.label}` : `⚠️ ${cat} (catégorie inconnue)`;
        console.log(`  ${String(n).padStart(3)}  ${label}`);
      });
    break;
  }

  case 'cats': {
    const { categories } = await loadAll();
    Object.entries(categories).forEach(([id, c]) => {
      console.log(
        `  ${c.emoji} ${c.label}  (id: ${id})${c.spicy ? ' [spicy]' : ''}${c.pack ? ` [pack: ${c.pack}]` : ''}`
      );
    });
    break;
  }

  case 'list': {
    const catId = args[0];
    if (!catId) throw new Error('Usage: list <catId>');
    const { cards } = await loadAll();
    const inCat = Object.entries(cards).filter(([, c]) => c.cat === catId);
    console.log(`${inCat.length} carte(s) dans "${catId}" :\n`);
    inCat
      .sort((a, b) => a[1].t.localeCompare(b[1].t))
      .forEach(([id, c]) => console.log(`  ${c.t}${c.spicy ? ' 🌶️' : ''}  (${id})`));
    break;
  }

  case 'add': {
    // Par defaut : BROUILLON (draft) → invisible en partie tant que non
    // publie. --live pour publier directement (a eviter sans validation).
    const [catId, text] = args;
    if (!catId || !text) throw new Error('Usage: add <catId> "Texte" [--spicy] [--live]');
    const { categories } = await loadAll();
    if (!categories[catId]) throw new Error(`Catégorie inconnue: ${catId}`);
    const live = args.includes('--live');
    const r = push(ref(db, 'cards'));
    await set(r, {
      t: text,
      cat: catId,
      spicy: args.includes('--spicy'),
      ...(live ? {} : { draft: true }),
    });
    console.log(`${live ? '✅ Publiée' : '📝 Brouillon'} : "${text}" dans ${catId} (${r.key})`);
    break;
  }

  case 'drafts': {
    const { cards, categories } = await loadAll();
    const drafts = Object.entries(cards).filter(([, c]) => c.draft);
    if (!drafts.length) {
      console.log('Aucun brouillon.');
      break;
    }
    console.log(`${drafts.length} brouillon(s) en attente de validation :\n`);
    drafts.forEach(([id, c]) => {
      const cat = categories[c.cat];
      console.log(`  📝 ${c.t}${c.spicy ? ' 🌶️' : ''}  — ${cat ? cat.emoji + ' ' + cat.label : c.cat}  (${id})`);
    });
    break;
  }

  case 'publish': {
    // publish all → publie tous les brouillons ; publish <id> → un seul
    const target = args[0];
    if (!target) throw new Error('Usage: publish <cardId|all>');
    const { cards } = await loadAll();
    const updates = {};
    if (target === 'all') {
      Object.entries(cards).forEach(([id, c]) => {
        if (c.draft) updates[`${id}/draft`] = null;
      });
    } else {
      if (!cards[target]) throw new Error(`Carte introuvable: ${target}`);
      updates[`${target}/draft`] = null;
    }
    const n = Object.keys(updates).length;
    if (n === 0) {
      console.log('Rien à publier.');
      break;
    }
    await update(ref(db, 'cards'), updates);
    console.log(`🚀 ${n} carte(s) publiée(s) — jouables dès la prochaine partie.`);
    break;
  }

  case 'unpublish': {
    // Repasse une carte en brouillon (retrait de circulation sans suppression)
    const [cardId] = args;
    if (!cardId) throw new Error('Usage: unpublish <cardId>');
    await update(ref(db, `cards/${cardId}`), { draft: true });
    console.log(`📝 Repassée en brouillon : ${cardId}`);
    break;
  }

  case 'del': {
    const [cardId] = args;
    if (!cardId) throw new Error('Usage: del <cardId>');
    const snap = await get(ref(db, `cards/${cardId}`));
    if (!snap.exists()) throw new Error(`Carte introuvable: ${cardId}`);
    const c = snap.val();
    await remove(ref(db, `cards/${cardId}`));
    console.log(`🗑️ Supprimée : "${c.t}" (${c.cat})`);
    break;
  }

  case 'rename': {
    const [cardId, text] = args;
    if (!cardId || !text) throw new Error('Usage: rename <cardId> "Nouveau texte"');
    await update(ref(db, `cards/${cardId}`), { t: text });
    console.log(`✏️ Renommée : ${cardId} → "${text}"`);
    break;
  }

  case 'setgage': {
    // Regle a boire du Mode Apero, affichee quand CETTE carte est choisie.
    // Texte vide ("") pour retirer la regle.
    const [cardId, text] = args;
    if (!cardId || text === undefined)
      throw new Error('Usage: setgage <cardId> "Regle a boire" (ou "" pour retirer)');
    await update(ref(db, `cards/${cardId}`), { g: text || null });
    console.log(text ? `🍺 Gage posé sur ${cardId} : "${text}"` : `🧹 Gage retiré de ${cardId}`);
    break;
  }

  case 'gages': {
    // Liste toutes les cartes qui ont une regle a boire.
    const { cards } = await loadAll();
    const withG = Object.entries(cards).filter(([, c]) => c.g);
    console.log(`${withG.length} carte(s) avec gage :\n`);
    withG
      .sort((a, b) => a[1].t.localeCompare(b[1].t))
      .forEach(([id, c]) => console.log(`  ${c.t} → "${c.g}"  (${id})`));
    break;
  }

  case 'setpack': {
    // Rattache une categorie existante a un pack premium (verrouillage).
    const [id, packId] = args;
    if (!id || !packId)
      throw new Error('Usage: setpack <catId> <packId>');
    const snap = await get(ref(db, `categories/${id}`));
    if (!snap.exists()) throw new Error(`Catégorie inconnue: ${id}`);
    await update(ref(db, `categories/${id}`), { pack: packId });
    console.log(`🔒 ${snap.val().emoji} ${snap.val().label} rattachée au pack "${packId}"`);
    break;
  }

  case 'unsetpack': {
    // Detache une categorie de son pack → elle redevient gratuite.
    const [id] = args;
    if (!id) throw new Error('Usage: unsetpack <catId>');
    const snap = await get(ref(db, `categories/${id}`));
    if (!snap.exists()) throw new Error(`Catégorie inconnue: ${id}`);
    await update(ref(db, `categories/${id}`), { pack: null });
    console.log(`🔓 ${snap.val().emoji} ${snap.val().label} redevenue gratuite`);
    break;
  }

  case 'addcat': {
    const [id, label, emoji] = args;
    if (!id || !label || !emoji)
      throw new Error('Usage: addcat <id> "Label" <emoji> [--spicy] [--pack <packId>]');
    const packIdx = args.indexOf('--pack');
    await set(ref(db, `categories/${id}`), {
      label,
      emoji,
      ...(args.includes('--spicy') ? { spicy: true } : {}),
      ...(packIdx !== -1 && args[packIdx + 1] ? { pack: args[packIdx + 1] } : {}),
    });
    console.log(`✅ Catégorie créée : ${emoji} ${label} (${id})`);
    break;
  }

  case 'export': {
    const file = args[0] || `deck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const data = await loadAll();
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log(
      `💾 Export : ${Object.keys(data.cards).length} cartes, ${Object.keys(data.categories).length} catégories → ${file}`
    );
    break;
  }

  default:
    console.log('Commandes : count | cats | list <cat> | add <cat> "Texte" [--spicy] [--live] | drafts | publish <id|all> | unpublish <id> | del <id> | rename <id> "Texte" | addcat <id> "Label" <emoji> | export [fichier]');
}

process.exit(0);
