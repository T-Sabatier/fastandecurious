import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Capture l'event d'installation le plus tôt possible : il peut se declencher
// avant que le composant InstallButton soit monte (ex: sur la Home, avant le
// lobby). On le stocke pour que le bouton le retrouve.
window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
