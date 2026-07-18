import { ref, onValue, set, remove } from 'firebase/database';
import { db } from './firebase';

// Annonce poussée en direct à tous les joueurs (web + app) depuis /admin, sans
// mise à jour de l'app. Nœud /announcement = { id, title, body } (ou absent).
// L'`id` change à chaque publication → le pop-up se ré-affiche une fois par
// nouvelle annonce (suivi côté client via localStorage).
const PATH = 'announcement';

export function subscribeAnnouncement(cb) {
  return onValue(ref(db, PATH), (snap) => cb(snap.val() || null));
}

export async function publishAnnouncement({ title, body }) {
  await set(ref(db, PATH), { id: Date.now(), title, body });
}

export async function clearAnnouncement() {
  await remove(ref(db, PATH));
}
