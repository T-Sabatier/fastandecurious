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

let inFlight = null;
export async function seedCategoriesIfEmpty() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const catsSnap = await get(ref(db, CATEGORIES_PATH));
    let tombstones = new Set();
    try {
      const deletedSnap = await get(ref(db, DELETED_PATH));
      tombstones = new Set(Object.keys(deletedSnap.val() || {}));
    } catch {
      // Permission denied, on continue sans tombstones
    }

    if (!catsSnap.exists()) {
      const obj = {};
      DEFAULT_CATEGORIES.forEach((c) => {
        if (!tombstones.has(c.id)) {
          obj[c.id] = {
            label: c.label,
            emoji: c.emoji,
            ...(c.spicy ? { spicy: true } : {}),
          };
        }
      });
      await set(ref(db, CATEGORIES_PATH), obj);
      return;
    }

    const existing = catsSnap.val() || {};
    const updates = {};
    DEFAULT_CATEGORIES.forEach((c) => {
      if (!existing[c.id] && !tombstones.has(c.id)) {
        updates[c.id] = {
          label: c.label,
          emoji: c.emoji,
          ...(c.spicy ? { spicy: true } : {}),
        };
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db, CATEGORIES_PATH), updates);
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function addCategory({ id, label, emoji, spicy }) {
  await set(ref(db, `${CATEGORIES_PATH}/${id}`), {
    label,
    emoji,
    ...(spicy ? { spicy: true } : {}),
  });
}

export async function deleteCategory(id) {
  const isDefault = DEFAULT_CATEGORIES.some((c) => c.id === id);
  if (isDefault) {
    try {
      await set(ref(db, `${DELETED_PATH}/${id}`), true);
    } catch (e) {
      console.warn(
        `Tombstone categorie failed (regles Firebase ?). ${e.message}`
      );
    }
  }
  await remove(ref(db, `${CATEGORIES_PATH}/${id}`));
}
