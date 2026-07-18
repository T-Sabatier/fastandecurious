import { ref, onValue, get, set, remove, update } from 'firebase/database';
import { db } from './firebase';
import { CATEGORIES as DEFAULT_CATEGORIES } from './cards';

const CATEGORIES_PATH = 'categories';
const DELETED_PATH = 'deletedCategories';

export function subscribeCategories(cb) {
  const r = ref(db, CATEGORIES_PATH);
  return onValue(r, (snap) => {
    const val = snap.val() || {};
    const arr = Object.entries(val).map(([id, c]) => ({ id, ...c }));
    cb(arr);
  });
}

// Seed de BOOTSTRAP uniquement : remplit une base totalement VIDE avec les
// categories par defaut du code (premiere installation). Si la base contient
// la moindre categorie, ne touche a RIEN — l'admin est la seule source de
// verite, rien ne s'ajoute ou ne se supprime automatiquement.
let inFlight = null;
export async function seedCategoriesIfEmpty() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const catsSnap = await get(ref(db, CATEGORIES_PATH));
    if (catsSnap.exists()) return;
    const obj = {};
    DEFAULT_CATEGORIES.forEach((c) => {
      obj[c.id] = {
        label: c.label,
        emoji: c.emoji,
        ...(c.spicy ? { spicy: true } : {}),
      };
    });
    await set(ref(db, CATEGORIES_PATH), obj);
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function addCategory({ id, label, emoji, spicy, pack }) {
  await set(ref(db, `${CATEGORIES_PATH}/${id}`), {
    label,
    emoji,
    ...(spicy ? { spicy: true } : {}),
    ...(pack ? { pack } : {}),
  });
}

// Affecte une categorie a un pack premium (null = gratuite).
export async function setCategoryPack(id, pack) {
  await update(ref(db, `${CATEGORIES_PATH}/${id}`), { pack: pack || null });
}

// Active/desactive une categorie. hidden=true → invisible pour les joueurs
// (lobby + jeu) mais conservee dans l'admin avec ses cartes. Pour du saisonnier.
export async function setCategoryHidden(id, hidden) {
  await update(ref(db, `${CATEGORIES_PATH}/${id}`), { hidden: hidden || null });
}

// Suppression definitive : le seed ne tournant que sur base vide, une
// categorie supprimee ne revient jamais.
export async function deleteCategory(id) {
  await remove(ref(db, `${CATEGORIES_PATH}/${id}`));
}
