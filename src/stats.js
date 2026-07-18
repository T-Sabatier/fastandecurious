import { ref, update, increment } from 'firebase/database';
import { db } from './firebase';

// Compteurs ANONYMES et agrégés (aucune donnée personnelle) pour piloter le jeu
// depuis /admin : parties, catégories jouées, adoption apéro, taille des parties.
// Stockés à plat sous /stats/<clé> (nombres). Increment atomique côté serveur,
// increment-only côté règles. Best-effort : on ignore les erreurs (non critique).
//
// updates : objet { cle: delta }, ex. { gamesCreated: 1, cat_bouffe: 1 }.
export function bumpStats(updates) {
  const payload = {};
  for (const [k, v] of Object.entries(updates)) {
    payload['stats/' + k] = increment(v);
  }
  update(ref(db), payload).catch(() => {});
}
