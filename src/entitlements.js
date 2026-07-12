import { ref, onValue } from 'firebase/database';
import { db, auth } from './firebase';
import { UNLOCK_ALL_ID } from './cards';

// Droits (packs achetes) du joueur courant, stockes dans users/$uid/packs
// sous la forme { pack_coquin: true, ... }. Ecrits par le flux d'achat
// (Play Billing / RevenueCat, a venir) ; lus ici pour le verrouillage des
// categories premium. Le bundle `tout_debloquer` donne tous les packs.
export function subscribeMyPacks(cb) {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, `users/${uid}/packs`),
    (snap) => cb(snap.val() || {}),
    () => cb({}) // regles pas encore deployees / offline : aucun droit
  );
}

export function ownsPack(myPacks, packId) {
  if (!packId) return true; // categorie gratuite
  return !!(myPacks && (myPacks[packId] || myPacks[UNLOCK_ALL_ID]));
}
