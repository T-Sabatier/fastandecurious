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

let inFlight = null;
export async function seedDefaultsIfEmpty() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const cardsSnap = await get(ref(db, CARDS_PATH));
    let tombstones = new Set();
    try {
      const deletedSnap = await get(ref(db, DELETED_DEFAULTS_PATH));
      tombstones = new Set(Object.keys(deletedSnap.val() || {}));
    } catch {
      // Regles Firebase ne permettent pas la lecture, on continue sans
    }
    if (!cardsSnap.exists()) {
      const obj = {};
      DEFAULT_CARDS.forEach((c) => {
        const id = defaultId(c.cat, c.t);
        if (!tombstones.has(id)) {
          obj[id] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
        }
      });
      await set(ref(db, CARDS_PATH), obj);
      return;
    }
    const existing = cardsSnap.val() || {};
    const byKey = {};
    for (const [id, c] of Object.entries(existing)) {
      const key = `${c.cat}::${c.t}`;
      (byKey[key] ||= []).push(id);
    }
    const updates = {};
    for (const ids of Object.values(byKey)) {
      if (ids.length > 1) {
        ids.sort();
        ids.slice(1).forEach((id) => { updates[id] = null; });
      }
    }
    DEFAULT_CARDS.forEach((c) => {
      const key = `${c.cat}::${c.t}`;
      const id = defaultId(c.cat, c.t);
      if (!byKey[key] && !tombstones.has(id)) {
        updates[id] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db, CARDS_PATH), updates);
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

// Cartes par defaut OBSOLETES : entrees `def_...` presentes en base mais qui
// ne correspondent plus a DEFAULT_CARDS (cartes renommees, deplacees de
// categorie ou retirees du code — le seed ne fait qu'ajouter, jamais retirer).
// Les cartes creees via l'admin (ids push) ne sont jamais concernees.
export async function getStaleDefaults() {
  const snap = await get(ref(db, CARDS_PATH));
  const existing = snap.val() || {};
  const currentIds = new Set(DEFAULT_CARDS.map((c) => defaultId(c.cat, c.t)));
  return Object.entries(existing)
    .filter(([id]) => id.startsWith('def_') && !currentIds.has(id))
    .map(([id, c]) => ({ id, t: c.t, cat: c.cat }));
}

// Supprime les cartes listees par getStaleDefaults, avec pierre tombale :
// les clients qui tournent encore sur une VIEILLE version de l'app (cache
// PWA) re-seedent leur ancienne liste de defauts — sans tombstone, les
// cartes purgees ressuscitent.
export async function purgeStaleDefaults(stale) {
  if (!stale.length) return 0;
  const tombstones = Object.fromEntries(stale.map((s) => [s.id, true]));
  const removals = Object.fromEntries(stale.map((s) => [s.id, null]));
  await update(ref(db, DELETED_DEFAULTS_PATH), tombstones);
  await update(ref(db, CARDS_PATH), removals);
  return stale.length;
}

export async function addCard({ t, cat, spicy }) {
  const r = push(ref(db, CARDS_PATH));
  await set(r, { t, cat, spicy: !!spicy });
  return r.key;
}

export async function updateCard(id, patch) {
  await update(ref(db, `${CARDS_PATH}/${id}`), patch);
}

export async function deleteCard(id) {
  const snap = await get(ref(db, `${CARDS_PATH}/${id}`));
  if (snap.exists()) {
    const c = snap.val();
    const isDefault = DEFAULT_CARDS.some(
      (d) => d.cat === c.cat && d.t === c.t
    );
    if (isDefault) {
      const tombstoneId = defaultId(c.cat, c.t);
      try {
        await set(ref(db, `${DELETED_DEFAULTS_PATH}/${tombstoneId}`), true);
      } catch (e) {
        console.warn(
          `Tombstone failed (regles Firebase ?). La carte reviendra au prochain seed. ${e.message}`
        );
      }
    }
  }
  await remove(ref(db, `${CARDS_PATH}/${id}`));
}
