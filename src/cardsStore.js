import { ref, onValue, get, set, push, update, remove } from 'firebase/database';
import { db } from './firebase';
import { DEFAULT_CARDS } from './cards';

const CARDS_PATH = 'cards';

export function subscribeCards(cb) {
  const r = ref(db, CARDS_PATH);
  return onValue(r, (snap) => {
    const val = snap.val() || {};
    const arr = Object.entries(val).map(([id, c]) => ({ id, ...c }));
    cb(arr);
  });
}

export async function seedDefaultsIfEmpty() {
  const snap = await get(ref(db, CARDS_PATH));
  if (!snap.exists()) {
    const obj = {};
    DEFAULT_CARDS.forEach((c, i) => {
      const id = 'd' + String(i).padStart(4, '0');
      obj[id] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
    });
    await set(ref(db, CARDS_PATH), obj);
    return true;
  }
  const existing = snap.val() || {};
  const seen = new Set(
    Object.values(existing).map((c) => `${c.cat}::${c.t}`)
  );
  const missing = DEFAULT_CARDS.filter((c) => !seen.has(`${c.cat}::${c.t}`));
  if (missing.length === 0) return false;
  const updates = {};
  missing.forEach((c) => {
    const r = push(ref(db, CARDS_PATH));
    updates[r.key] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
  });
  await update(ref(db, CARDS_PATH), updates);
  return true;
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
  await remove(ref(db, `${CARDS_PATH}/${id}`));
}
