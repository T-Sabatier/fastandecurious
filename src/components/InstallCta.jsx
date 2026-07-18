import { QRCodeSVG } from 'qrcode.react';
import { webPlatform, PLAY_STORE_URL } from '../utils';
import { PINK } from '../cards';

// CTA d'installation adaptatif selon la plateforme web :
//  - Android : bouton -> Play Store (install directe).
//  - Desktop : QR code a scanner avec son telephone.
//  - iOS     : "Bientot sur iPhone" (pas encore d'app iOS).
// Ne rend rien en natif (on est deja dans l'app). onNavigate = callback pour
// fermer la modale parente au clic.
export default function InstallCta({ onNavigate }) {
  const platform = webPlatform();

  if (platform === 'android') {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="block w-full border-4 border-black text-center py-3 active:translate-x-[2px] active:translate-y-[2px]"
        style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '4px 4px 0 #000' }}
      >
        <span style={{ fontFamily: '"Anton", sans-serif' }} className="text-xl uppercase">
          Installer l'app
        </span>
      </a>
    );
  }

  if (platform === 'ios') {
    return (
      <div
        className="w-full border-4 border-black text-center py-3 bg-white opacity-70"
        style={{ boxShadow: '4px 4px 0 #000' }}
      >
        <span style={{ fontFamily: '"Anton", sans-serif' }} className="text-xl uppercase">
          Bientôt sur iPhone
        </span>
      </div>
    );
  }

  // desktop (ou natif : ne devrait pas s'afficher, mais fallback QR inoffensif)
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="border-4 border-black p-2 bg-white"
        style={{ boxShadow: '4px 4px 0 #000' }}
      >
        <QRCodeSVG value={PLAY_STORE_URL} size={128} />
      </div>
      <span
        style={{ fontFamily: '"Space Mono", monospace' }}
        className="text-[11px] uppercase tracking-widest text-center"
      >
        Scanne pour installer l'app
      </span>
    </div>
  );
}
