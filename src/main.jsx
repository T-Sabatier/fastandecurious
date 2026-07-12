import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import App from './App.jsx';
import { authReady } from './firebase';
import './index.css';

// App native Android : le bouton retour systeme minimise l'app au lieu de la
// tuer — on ne perd jamais une partie en cours (l'etat vit dans Firebase de
// toute facon, mais ca evite le rechargement complet + la deconnexion visuelle).
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', () => {
    CapacitorApp.minimizeApp();
  });

  // App Link (QR scanne / lien https://snap-tap.vercel.app/?room=CODE) : on
  // recharge la webview avec ?room=CODE, l'auto-join de App.jsx fait le reste.
  // Garde anti-boucle : on ne navigue pas si la webview est deja sur ce code
  // (getLaunchUrl renvoie la meme URL apres notre propre rechargement).
  const openRoomFromUrl = (url) => {
    try {
      const room = new URL(url).searchParams.get('room');
      const current = new URLSearchParams(window.location.search).get('room');
      if (room && room !== current) {
        window.location.href = `/?room=${encodeURIComponent(room)}`;
      }
    } catch {
      // URL invalide : on ignore
    }
  };

  // Demarrage "chaud" : l'app tournait deja quand le lien a ete ouvert.
  CapacitorApp.addListener('appUrlOpen', ({ url }) => openRoomFromUrl(url));

  // Demarrage "a froid" : l'app a ete LANCEE par le lien — l'event appUrlOpen
  // est parti avant que ce code soit charge, on recupere l'URL de lancement.
  CapacitorApp.getLaunchUrl().then((res) => {
    if (res?.url) openRoomFromUrl(res.url);
  });
}

// Capture l'event d'installation le plus tôt possible : il peut se declencher
// avant que le composant InstallButton soit monte (ex: sur la Home, avant le
// lobby). On le stocke pour que le bouton le retrouve.
window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});

// On attend la connexion anonyme avant de monter l'app : les abonnements
// Firebase (rooms, cartes) partiraient sinon avant l'auth et seraient refuses
// par les regles de securite. Quasi instantane (session persistee en local),
// et de toute facon borne a 5s (garde-fou dans firebase.js) : l'app se monte
// TOUJOURS, meme si l'auth echoue.
function mount() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

authReady.then(mount, mount);
