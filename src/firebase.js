import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Connexion anonyme automatique : les regles de securite exigent auth != null.
// Invisible pour le joueur (aucun compte a creer). La session persiste en
// local, donc pas de re-connexion reseau a chaque ouverture.
// Resolue des qu'un utilisateur (anonyme ou admin) est disponible.
export const authReady = new Promise((resolve) => {
  let settled = false;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (!settled) {
        settled = true;
        resolve(user);
      }
      return;
    }
    signInAnonymously(auth).catch((e) => {
      // Offline au premier lancement ou auth anonyme non activee dans la
      // console : on lance quand meme l'app, les regles refuseront les acces.
      console.warn('Connexion anonyme impossible :', e.message);
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
  });
});
