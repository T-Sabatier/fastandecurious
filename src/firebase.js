import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { Capacitor } from '@capacitor/core';

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

// --- App Check (anti-abus) : atteste que les requetes viennent du VRAI site.
// WEB UNIQUEMENT (reCAPTCHA v3, invisible). Dans l'app native, reCAPTCHA ne
// marche pas (origine capacitor://localhost) : le natif aura Play Integrity
// via un plugin dedie (phase 2). Ne s'active que si la cle publique est
// fournie (VITE_RECAPTCHA_V3_SITE_KEY) → aucun effet tant qu'elle est absente,
// et AUCUN blocage tant que l'enforcement n'est pas active dans la console.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
if (recaptchaKey && !Capacitor.isNativePlatform()) {
  if (import.meta.env.DEV) {
    // En dev (localhost), reCAPTCHA ne peut pas attester : le SDK genere un
    // "debug token" affiche en console, a enregistrer une fois dans
    // Firebase Console → App Check → Applications → menu ⋮ → Jetons de debug.
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('[appcheck] Initialisation impossible :', e.message);
  }
}

export const db = getDatabase(app);

// getAuth() LEVE une exception si la cle API est absente/invalide (la RTDB,
// elle, tolere une cle invalide). On ne laisse pas ce cas bloquer toute
// l'app : auth vaut null et l'app se lance sans authentification.
let authInstance = null;
try {
  authInstance = getAuth(app);
} catch (e) {
  console.warn('[auth] Initialisation Auth impossible :', e.code || e.message);
}
export const auth = authInstance;

// Connexion anonyme automatique : les regles de securite exigent auth != null.
// Invisible pour le joueur (aucun compte a creer). La session persiste en
// local, donc pas de re-connexion reseau a chaque ouverture.
// Resolue des qu'un utilisateur (anonyme ou admin) est disponible.
// Garde-fou : quoi qu'il arrive (adblocker, reseau lent, auth desactivee),
// on rend la main au bout de 5s pour ne jamais bloquer l'app sur un ecran vide.
const authAttempt = new Promise((resolve) => {
  if (!auth) {
    resolve(null);
    return;
  }
  let settled = false;
  const settle = (user) => {
    if (!settled) {
      settled = true;
      resolve(user);
    }
  };
  onAuthStateChanged(
    auth,
    (user) => {
      if (user) {
        settle(user);
        return;
      }
      signInAnonymously(auth).catch((e) => {
        // Offline au premier lancement ou auth anonyme non activee dans la
        // console : on lance quand meme l'app, les regles refuseront les acces.
        console.warn('[auth] Connexion anonyme impossible :', e.code || e.message);
        settle(null);
      });
    },
    (e) => {
      console.warn('[auth] Erreur onAuthStateChanged :', e.code || e.message);
      settle(null);
    }
  );
});

const authTimeout = new Promise((resolve) => {
  setTimeout(() => {
    console.warn('[auth] Timeout de connexion (5s), lancement sans auth');
    resolve(null);
  }, 5000);
});

export const authReady = Promise.race([authAttempt, authTimeout]);
