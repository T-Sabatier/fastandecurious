import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { isInstallableWeb } from '../utils';
import InstallCta from './InstallCta.jsx';

// Pop-up "installe l'app" pour les joueurs sur navigateur (Android = bouton
// Play, desktop = QR ; pas iOS, pas natif). Objectif : convertir les joueurs
// web en installs Play Store (l'app a les achats). Assertif mais fermable :
// reapparait a CHAQUE nouvelle session (sessionStorage), pas a chaque
// reconnexion dans la meme session (sinon insupportable).
const SESSION_KEY = 'snaptap_install_nudge_seen';

export default function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isInstallableWeb()) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      className="fixed inset-0 z-[60] flex items-end justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative border-4 border-black bg-white w-full max-w-sm p-6 mb-2"
        style={{ boxShadow: '8px 8px 0 #000' }}
      >
        <button
          onClick={() => setShow(false)}
          aria-label="Fermer"
          className="absolute top-3 right-3 active:opacity-50"
        >
          <X size={24} strokeWidth={3} />
        </button>
        <div
          style={{ fontFamily: '"Anton", sans-serif' }}
          className="text-3xl uppercase leading-none mb-2 mt-1"
        >
          🍻 Prends l'app !
        </div>
        <p className="text-sm mb-5 opacity-80">
          Débloque le <b>Mode Apéro</b> (jeu à boire) et les <b>packs premium</b>
          {' '}— dispo uniquement dans l'app.
        </p>
        <InstallCta onNavigate={() => setShow(false)} />
        <button onClick={() => setShow(false)} className="mt-3 w-full text-center">
          <span
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[11px] uppercase tracking-widest opacity-60"
          >
            Continuer sur le web
          </span>
        </button>
      </div>
    </div>
  );
}
