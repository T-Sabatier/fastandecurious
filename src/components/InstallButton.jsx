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

export default function InstallButton() {
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

  // Déjà installée → rien à afficher
  if (installed) return null;

  const ios = isIOS();

  // Sur Android/Chrome on attend l'event ; sur iOS on montre l'aide manuelle.
  // Si ni l'un ni l'autre n'est dispo (navigateur sans support), on cache.
  if (!deferred && !ios) return null;

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
    <div className="mb-6">
      <button
        onClick={handleClick}
        className="w-full border-4 border-black bg-white py-3 flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px]"
        style={{ boxShadow: '4px 4px 0 #000' }}
      >
        {ios ? <Share size={20} /> : <Download size={20} />}
        <span
          style={{ fontFamily: '"Anton", sans-serif' }}
          className="text-xl uppercase tracking-wide"
        >
          Installer l'app
        </span>
      </button>

      {ios && showIosHelp && (
        <div
          className="mt-2 border-4 border-black bg-black text-white p-4 relative"
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
