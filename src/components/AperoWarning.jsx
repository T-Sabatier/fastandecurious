import { APERO_ACCENT } from '../cards';

// Avertissement 18+ / alcool du Mode Apero. Affiche AVANT d'entrer dans une
// partie en Mode Apero (que l'on soit l'hote qui l'active ou un invite qui
// rejoint). Diligence editeur + protection utilisateur. onConfirm memorise
// le consentement (montre une seule fois) ; onCancel referme sans confirmer.
export default function AperoWarning({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="relative border-4 border-black bg-white w-full max-w-sm p-6 text-center"
        style={{ boxShadow: '8px 8px 0 #000' }}
      >
        <div className="text-4xl mb-2">🔞</div>
        <div
          style={{ fontFamily: '"Anton", sans-serif' }}
          className="text-2xl uppercase leading-none mb-3"
        >
          Mode Apéro
        </div>
        <ul className="text-sm leading-relaxed text-left space-y-2 mb-5">
          <li>• Réservé aux <b>18 ans et plus</b>.</li>
          <li>• Le jeu se joue avec <b>la boisson de ton choix</b>.</li>
          <li>• Bois de façon <b>responsable</b> : chaque règle est une suggestion, jamais une obligation.</li>
          <li className="opacity-70">L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</li>
        </ul>
        <button
          onClick={onConfirm}
          className="w-full border-4 border-black py-3 active:translate-x-[2px] active:translate-y-[2px]"
          style={{ backgroundColor: APERO_ACCENT, color: '#FFF', boxShadow: '4px 4px 0 #000' }}
        >
          <span style={{ fontFamily: '"Anton", sans-serif' }} className="text-xl uppercase">
            J'ai 18 ans et j'ai compris
          </span>
        </button>
        {onCancel && (
          <button onClick={onCancel} className="mt-3 w-full text-center">
            <span
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-50"
            >
              Annuler
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
