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
    const snap = await get(ref(db, CARDS_PATH));
    if (!snap.exists()) {
      const obj = {};
      DEFAULT_CARDS.forEach((c) => {
        obj[defaultId(c.cat, c.t)] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
      });
      await set(ref(db, CARDS_PATH), obj);
      return;
    }
    const existing = snap.val() || {};
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
      if (!byKey[key]) {
        updates[defaultId(c.cat, c.t)] = { t: c.t, cat: c.cat, spicy: !!c.spicy };
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
