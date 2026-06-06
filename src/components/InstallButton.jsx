import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { YELLOW } from '../cards';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Bouton compact (meme taille/police que "Quitter") pour les en-tetes.
export default function InstallButton({ align = 'right' }) {
  // Recupere l'event eventuellement deja capture par main.jsx
  const [deferred, setDeferred] = useState(
    () => (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null)
  );
  const [installed, setInstalled] = useState(isStandalone);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (installed) return;

    function onInstallable() {
      setDeferred(window.__deferredInstallPrompt);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
      window.__deferredInstallPrompt = null;
    }

    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  const ios = isIOS();

  // Rien a afficher : deja installee, ou pas d'event Android et pas iOS.
  // On rend un espace vide pour ne pas casser l'alignement de l'en-tete.
  if (installed || (!deferred && !ios)) {
    return <div className="w-14" />;
  }

  async function handleClick() {
    if (ios) {
      setShowIosHelp((v) => !v);
      return;
    }
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferred(null);
    window.__deferredInstallPrompt = null;
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5"
        aria-label="Télécharger l'app"
      >
        {ios ? <Share size={18} /> : <Download size={18} />}
        <span
          style={{ fontFamily: '"Space Mono", monospace' }}
          className="text-[10px] uppercase tracking-widest"
        >
          Télécharger l'app
        </span>
      </button>

      {ios && showIosHelp && (
        <div
          className={`absolute top-full mt-2 z-50 w-64 border-4 border-black bg-black text-white p-4 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ boxShadow: '4px 4px 0 #000' }}
        >
          <button
            onClick={() => setShowIosHelp(false)}
            className="absolute top-2 right-2"
            aria-label="Fermer"
          >
            <X size={18} color={YELLOW} />
          </button>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[11px] uppercase tracking-widest leading-relaxed"
          >
            Sur iPhone :<br />
            1. Touche <Share size={13} className="inline -mt-0.5" /> Partager (en
            bas de Safari)<br />
            2. Choisis « Sur l'écran d'accueil »
          </div>
        </div>
      )}
    </div>
  );
}
