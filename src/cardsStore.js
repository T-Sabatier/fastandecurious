import { ref, onValue, get, set, push, update, remove } from 'firebase/database';
import { db } from './firebase';
import { DEFAULT_CARDS } from './cards';

const CARDS_PATH = 'cards';
const DELETED_DEFAULTS_PATH = 'deletedDefaults';

export function subscribeCards(cb) {
  const r = ref(db, CARDS_PATH);
  return onValue(r, (snap) => {
    const val = snap.val() || {};
    const arr = Object.entries(val).map(([id, c]) => ({ id, ...c }));
    cb(arr);
  });
}

function slugify(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function defaultId(cat, t) {
  return `def_${slugify(cat)}_${slugify(t)}`;
}

// Seed de BOOTSTRAP uniquement : remplit une base totalement VIDE avec le
// deck par defaut du code (premiere installation). Si la base contient la
// moindre carte, ne touche a RIEN — l'admin est la seule source de verite,
// aucune carte ne s'ajoute ou ne se supprime automatiquement.
let inFlight = null;
export async function seedDefaultsIfEmpty() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const cardsSnap = await get(ref(db, CARDS_PATH));
    if (cardsSnap.exists()) return;
    const obj = {};
    DEFAULT_CARDS.forEach((c) => {
      obj[defaultId(c.cat, c.t)] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
    });
    await set(ref(db, CARDS_PATH), obj);
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function addCard({ t, cat, spicy }) {
  const r = push(ref(db, CARDS_PATH));
  await set(r, { t, cat, spicy: !!spicy });
  return r.key;
}

export async function updateCard(id, patch) {
  await update(ref(db, `${CARDS_PATH}/${id}`), patch);
}

// Suppression definitive : le seed ne tournant que sur base vide, une carte
// supprimee ne revient JAMAIS (plus besoin de tombstones).
export async function deleteCard(id) {
  await remove(ref(db, `${CARDS_PATH}/${id}`));
}
