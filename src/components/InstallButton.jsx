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

// variant "compact" : meme taille/police que "Quitter" (en-tetes).
// variant "block"   : gros bouton pleine largeur (bas de page).
export default function InstallButton({ align = 'right', variant = 'compact' }) {
  // Recupere l'event eventuellement deja capture par main.jsx
  const [deferred, setDeferred] = useState(
    () => (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null)
  );
  const [installed, setInstalled] = useState(isStandalone);
  const [showHelp, setShowHelp] = useState(false);

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

  const block = variant === 'block';

  // Deja en mode app installee : pas de bouton. En compact on garde un espace
  // pour l'alignement de l'en-tete ; en block on n'affiche rien.
  if (installed) {
    return block ? null : <div className="w-14" />;
  }

  const ios = isIOS();

  async function handleClick() {
    // Prompt natif dispo (Android/Chrome/Edge) → on le declenche
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
      window.__deferredInstallPrompt = null;
      return;
    }
    // Sinon (iOS, ou prompt pas encore/plus dispo) → on montre l'aide
    setShowHelp((v) => !v);
  }

  return (
    <div className={block ? 'relative mb-6' : 'relative'}>
      {block ? (
        <button
          onClick={handleClick}
          className="w-full border-4 border-black bg-white py-3 flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px]"
          style={{ boxShadow: '4px 4px 0 #000' }}
          aria-label="Télécharger l'app"
        >
          {ios ? <Share size={20} /> : <Download size={20} />}
          <span
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase tracking-wide"
          >
            Télécharger l'app
          </span>
        </button>
      ) : (
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
      )}

      {showHelp && !deferred && (
        <div
          className={`absolute z-50 w-64 border-4 border-black bg-black text-white p-4 ${
            block ? 'bottom-full mb-2 left-0' : `top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'}`
          }`}
          style={{ boxShadow: '4px 4px 0 #000' }}
        >
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-2 right-2"
            aria-label="Fermer"
          >
            <X size={18} color={YELLOW} />
          </button>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[11px] uppercase tracking-widest leading-relaxed"
          >
            {ios ? (
              <>
                Sur iPhone :<br />
                1. Touche <Share size={13} className="inline -mt-0.5" /> Partager
                (en bas de Safari)<br />
                2. Choisis « Sur l'écran d'accueil »
              </>
            ) : (
              <>
                Pour installer :<br />
                Menu du navigateur (⋮)<br />
                → « Installer l'application »<br />
                ou « Ajouter à l'écran d'accueil »
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
