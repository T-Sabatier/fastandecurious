import { useState, useEffect } from 'react';
import { ref, set, get } from 'firebase/database';
import { db } from '../firebase';
import {
  makeRoomCode,
  getStoredName,
  setStoredName,
  getStoredParty,
  setStoredParty,
  setStoredAperoUnlock,
  getStoredAperoConsent,
  setStoredAperoConsent,
  ROOM_TTL_MS,
  openExternal,
} from '../utils';
import { CATEGORIES, YELLOW, AMBER, PINK, APERO_ACCENT, MAX_PLAYERS } from '../cards';
import { useBilling, PRODUCT_APERO, PRODUCT_ULTRA } from '../purchases';
import { bumpStats } from '../stats';
import { ChevronRight, Lock, X, ClipboardPaste } from 'lucide-react';
import InstallButton from './InstallButton.jsx';
import InstallCta from './InstallCta.jsx';

function getCodeFromUrl() {
  if (typeof window === 'undefined') return '';
  const fromQuery = new URLSearchParams(window.location.search).get('room');
  return (fromQuery || '').trim().toUpperCase().slice(0, 4);
}

export default function Home({ playerId, onJoin, initialError }) {
  const [name, setName] = useState(getStoredName);
  const [joinCode, setJoinCode] = useState(getCodeFromUrl);
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [invitedCode] = useState(getCodeFromUrl);
  // Arrivée via QR / lien avec un code → modal de join dédiée (prénom + Rejoindre)
  // pour éviter que le joueur clique par réflexe sur "Créer une partie".
  // Pas de modal si une erreur est déjà présente (room introuvable, kické…).
  const [showJoinModal, setShowJoinModal] = useState(!!invitedCode && !initialError);
  // Preference "Mode Apero" (jeu a boire) + possession du mode (produit paye).
  // Le mode ne s'active que si l'utilisateur le POSSEDE (aperoOwned). Tant que
  // le billing n'est pas branche : verrouille, deblocable via bouton dev.
  const [party, setParty] = useState(getStoredParty);
  const [aperoTeaser, setAperoTeaser] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopError, setShopError] = useState('');
  // Possession des packs : RevenueCat en natif, fallback web (flag/Firebase).
  const {
    apero: aperoOwned,
    ultra: ultraOwned,
    prices,
    billingAvailable,
    busy: shopBusy,
    purchase,
    restore,
  } = useBilling();
  // Mode apero reellement actif = voulu ET possede.
  const partyActive = party && aperoOwned;
  // Avertissement 18+ / alcool : affiche AVANT la premiere activation du mode.
  const [aperoWarning, setAperoWarning] = useState(false);
  function toggleParty() {
    // Passage de OFF a ON sans avoir jamais consenti → on montre l'avertissement
    // et on active seulement apres confirmation.
    if (!party && !getStoredAperoConsent()) {
      setAperoWarning(true);
      return;
    }
    const v = !party;
    setParty(v);
    setStoredParty(v);
  }
  function confirmAperoWarning() {
    setStoredAperoConsent();
    setAperoWarning(false);
    setParty(true);
    setStoredParty(true);
  }
  function unlockAperoForTest() {
    setStoredAperoUnlock(true);
    setAperoTeaser(false);
    // Fallback web/dev : le hook re-lit le flag sur l'event focus.
    window.dispatchEvent(new Event('focus'));
  }
  // Lance l'achat d'un pack (natif). Gere l'annulation et les erreurs.
  async function buyPack(productId) {
    setShopError('');
    try {
      await purchase(productId);
    } catch (e) {
      setShopError('Erreur : ' + (e?.message || e?.code || String(e)));
    }
  }
  // Nettoie un code colle/tape : garde seulement les 4 caracteres valides
  // (le lien partage colle parfois "https://...?room=ABCD" → on extrait ABCD).
  function cleanCode(raw) {
    const s = (raw || '').toUpperCase();
    const fromUrl = s.match(/ROOM=([A-HJ-NP-Z2-9]{4})/);
    if (fromUrl) return fromUrl[1];
    return s.replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 4);
  }

  async function pasteCode() {
    try {
      const txt = await navigator.clipboard.readText();
      const c = cleanCode(txt);
      if (c) setJoinCode(c);
    } catch {
      /* presse-papier inaccessible (permissions) : l'utilisateur colle a la main */
    }
  }

  async function restorePurchases() {
    setShopError('');
    try {
      await restore();
    } catch (e) {
      setShopError('Erreur : ' + (e?.message || e?.code || String(e)));
    }
  }

  // NB : le sweep des rooms expirées ne se fait plus ici. Les règles Firebase
  // n'autorisent plus la LISTE de /rooms aux joueurs (anti-énumération des
  // codes) : le nettoyage tourne à l'ouverture du dashboard /admin, et
  // createRoom réutilise les codes des rooms expirées (ci-dessous).

  async function createRoom() {
    const n = name.trim();
    if (!n) {
      setError('Mets ton prénom');
      return;
    }
    setBusy(true);
    setError('');
    setStoredName(n);

    let code;
    let exists = true;
    let tries = 0;
    while (exists && tries < 10) {
      code = makeRoomCode();
      const snap = await get(ref(db, `rooms/${code}`));
      // Une room expirée (> TTL) compte comme libre : son code est réutilisé
      // (le set() ci-dessous l'écrase), ce qui recycle les rooms abandonnées.
      const v = snap.val();
      const expired = v?.createdAt && v.createdAt < Date.now() - ROOM_TTL_MS;
      exists = snap.exists() && !expired;
      tries++;
    }
    if (exists) {
      setError('Impossible de créer une room, réessaye');
      setBusy(false);
      return;
    }

    const defaultCats = Object.fromEntries(CATEGORIES.map((c) => [c.id, true]));

    const room = {
      host: playerId,
      phase: 'lobby',
      createdAt: Date.now(),
      players: {
        [playerId]: {
          name: n,
          score: 0,
          joinedAt: Date.now(),
        },
      },
      settings: {
        cats: defaultCats,
        winningScore: 5,
        sorts: { reroll: false, espion: false, vatout: false },
        // Mode Apero pre-active si l'hote le POSSEDE et l'a choisi sur l'accueil.
        ...(partyActive ? { partyMode: true } : {}),
      },
    };

    try {
      await set(ref(db, `rooms/${code}`), room);
      bumpStats({ gamesCreated: 1, ...(partyActive ? { partyCreated: 1 } : {}) });
      onJoin(code);
    } catch (e) {
      setError('Erreur Firebase : vérifie tes règles (mode test)');
      setBusy(false);
    }
  }

  async function joinRoom() {
    const n = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!n) {
      setError('Mets ton prénom');
      return;
    }
    if (code.length !== 4) {
      setError('Le code fait 4 lettres');
      return;
    }
    // Charset strict (celui de makeRoomCode) : pas de caractères exotiques
    // dans le chemin Firebase (les règles refuseraient de toute façon).
    if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) {
      setError('Code invalide');
      return;
    }
    setBusy(true);
    setError('');

    try {
      const snap = await get(ref(db, `rooms/${code}`));
      if (!snap.exists()) {
        setError('Room introuvable');
        setBusy(false);
        return;
      }

      const r = snap.val();
      const alreadyIn = r.players && r.players[playerId];

      if (r.phase !== 'lobby' && !alreadyIn) {
        setError('Partie déjà en cours dans cette room');
        setBusy(false);
        return;
      }

      if (!alreadyIn && Object.keys(r.players || {}).length >= MAX_PLAYERS) {
        setError(`Room complète (${MAX_PLAYERS} joueurs max)`);
        setBusy(false);
        return;
      }

      setStoredName(n);

      await set(ref(db, `rooms/${code}/players/${playerId}`), {
        name: n,
        score: r.players?.[playerId]?.score || 0,
        joinedAt: r.players?.[playerId]?.joinedAt || Date.now(),
      });

      onJoin(code);
    } catch (e) {
      setError('Erreur Firebase : vérifie ta config .env');
      setBusy(false);
    }
  }

  return (
    <div
      style={{ backgroundColor: partyActive ? AMBER : YELLOW, minHeight: '100vh' }}
      className={`text-black overflow-x-hidden${partyActive ? ' apero-bg' : ''}`}
    >
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="mb-10">
          <h1
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.82,
              letterSpacing: '-0.02em',
              fontSize: 'clamp(3.25rem, 22vw, 7rem)',
            }}
            className="uppercase whitespace-nowrap flex items-center justify-center gap-3"
          >
            <span>
              {partyActive ? (
                <>
                  Sn
                  <span
                    style={{
                      color: '#FFF',
                      WebkitTextStroke: `4px ${APERO_ACCENT}`,
                      paintOrder: 'stroke fill',
                    }}
                  >
                    ap
                  </span>
                </>
              ) : (
                'Snap'
              )}
            </span>
            <span
              className="inline-block px-5 py-2 -rotate-2 leading-none"
              style={{
                backgroundColor: partyActive ? APERO_ACCENT : PINK,
                color: '#fff',
                border: '4px solid #000',
                boxShadow: '6px 6px 0 #000',
              }}
            >
              {partyActive ? 'Éro' : 'Tap'}
            </span>
          </h1>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1 flex-1 bg-black"></div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest whitespace-nowrap text-black"
            >
              {partyActive ? 'Mode apéro : les cartes font boire' : "Devine ce qu'ils aiment ou pas…"}
            </div>
          </div>
        </div>

        {/* Switch Mode Apero (jeu a boire) — sur l'accueil pour la decouverte.
            Pre-active le mode a la creation d'une partie ; change l'ambiance. */}
        {aperoOwned ? (
          // Mode possede : simple interrupteur On/Off.
          <button
            onClick={toggleParty}
            className="w-full border-4 border-black p-4 mb-8 flex items-center justify-between active:translate-x-[2px] active:translate-y-[2px]"
            style={{
              backgroundColor: party ? APERO_ACCENT : '#FFF',
              color: party ? '#FFF' : '#000',
              boxShadow: party ? '6px 6px 0 #000' : '4px 4px 0 #000',
              transition: 'all 120ms',
            }}
          >
            <div className="text-left min-w-0">
              <div
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-2xl uppercase leading-none"
              >
                Mode Apéro
              </div>
              <div
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[10px] uppercase tracking-widest mt-1 opacity-80"
              >
                {party ? 'Activé · les cartes font boire !' : 'Jeu à boire · active-le'}
              </div>
            </div>
            <div
              className="border-2 px-3 py-1.5 text-sm uppercase tracking-widest shrink-0"
              style={{
                fontFamily: '"Space Mono", monospace',
                borderColor: party ? '#FFF' : '#000',
              }}
            >
              {party ? 'ON' : 'OFF'}
            </div>
          </button>
        ) : (
          // Mode NON possede : verrouille, affiche le prix, ouvre le teaser.
          <button
            onClick={() => setAperoTeaser(true)}
            className="w-full border-4 border-black bg-white p-4 mb-8 flex items-center justify-between gap-3 active:translate-x-[2px] active:translate-y-[2px]"
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                style={{ backgroundColor: PINK }}
                className="shrink-0 w-8 h-8 border-2 border-black flex items-center justify-center"
              >
                <Lock size={16} strokeWidth={3.5} color="#FFF" />
              </span>
              <div className="text-left min-w-0">
                <div
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="text-2xl uppercase leading-none"
                >
                  Mode Apéro
                </div>
                <div
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest mt-1 opacity-70"
                >
                  Jeu à boire · premium
                </div>
              </div>
            </div>
            <div
              className="border-2 border-black px-2.5 py-1.5 text-sm uppercase tracking-widest shrink-0"
              style={{ fontFamily: '"Space Mono", monospace' }}
            >
              4,99 €
            </div>
          </button>
        )}

        {invitedCode && (
          <div
            className="mb-6 border-4 border-black bg-black text-white p-4 text-center"
            style={{ boxShadow: '6px 6px 0 #000' }}
          >
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mb-1"
            >
              Tu as été invité dans la room
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                color: YELLOW,
                letterSpacing: '0.15em',
              }}
              className="text-4xl uppercase"
            >
              {invitedCode}
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mt-1"
            >
              Mets ton prénom et rejoins 👇
            </div>
          </div>
        )}

        <div className="mb-8">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-sm uppercase tracking-widest mb-2 opacity-80"
          >
            Ton prénom
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom…"
            maxLength={20}
            className="w-full border-4 border-black bg-white px-3 py-3 outline-none placeholder-black/30 text-lg"
            style={{ boxShadow: '4px 4px 0 #000' }}
          />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 flex-1 bg-black"></div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-sm uppercase tracking-widest"
          >
            Lancer
          </div>
          <div className="h-1 flex-1 bg-black"></div>
        </div>

        <button
          onClick={createRoom}
          disabled={busy}
          className="w-full border-4 border-black bg-black text-white py-2 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
          style={{ boxShadow: '4px 4px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase tracking-wide"
          >
            Créer une partie
          </div>
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="h-1 flex-1 bg-black"></div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-sm uppercase tracking-widest text-center"
          >
            Ou rejoins avec un code
          </div>
          <div className="h-1 flex-1 bg-black"></div>
        </div>

        <div className="flex items-stretch gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(cleanCode(e.target.value))}
            onPaste={(e) => {
              e.preventDefault();
              setJoinCode(cleanCode(e.clipboardData.getData('text')));
            }}
            placeholder="CODE"
            maxLength={4}
            inputMode="text"
            autoCapitalize="characters"
            className="flex-1 min-w-0 border-4 border-black bg-white px-2 py-2 outline-none placeholder-black/30 text-center text-2xl tracking-widest"
            style={{
              boxShadow: '4px 4px 0 #000',
              fontFamily: '"Anton", sans-serif',
            }}
          />
          <button
            onClick={pasteCode}
            aria-label="Coller le code"
            title="Coller"
            className="border-4 border-black bg-white px-3 active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center"
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            <ClipboardPaste size={20} />
          </button>
          <button
            onClick={joinRoom}
            disabled={busy || joinCode.trim().length !== 4}
            className="border-4 border-black bg-black text-white px-4 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-30 flex items-center justify-center gap-1"
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            <span
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-lg uppercase"
            >
              Rejoindre
            </span>
            <ChevronRight size={20} />
          </button>
        </div>

        {error && (
          <div
            className="mt-4 border-4 border-black bg-white p-3 text-sm"
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={() => setShowShop(true)}
          className="mt-6 w-full border-4 border-black py-3 active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2"
          style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '4px 4px 0 #000' }}
        >
          <span className="text-xl leading-none">🛒</span>
          <span
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase tracking-wide"
          >
            Boutique
          </span>
        </button>

        <div
          className="mt-10 border-4 border-black bg-white p-4"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase mb-2"
          >
            {partyActive ? '🍻 Règles apéro' : 'Règles'}
          </div>
          {partyActive ? (
            <ul className="text-sm leading-relaxed space-y-1">
              <li>• 3 joueurs minimum, chacun sur son appareil</li>
              <li>• Main de <b>7 cartes</b> chacun</li>
              <li>• Un joueur tiré au sort annonce <b>J'AIME</b> ou <b>J'AIME PAS</b></li>
              <li>• Il choisit sa carte préférée → <b>+1 point</b> pour son auteur</li>
              <li>• Et la carte choisie <b>déclenche une règle à boire</b> pour la table</li>
              <li>• « Ceux qui ont Spotify boivent 2 », « le gagnant distribue 3 »…</li>
            </ul>
          ) : (
            <ul className="text-sm leading-relaxed space-y-1">
              <li>• 3 joueurs minimum, chacun sur son appareil</li>
              <li>• Main de <b>7 cartes</b> chacun</li>
              <li>• Un joueur tiré au sort annonce <b>J'AIME</b> ou <b>J'AIME PAS</b></li>
              <li>• Les autres posent une carte face cachée</li>
              <li>• Il choisit sa carte préférée → <b>+1 point</b></li>
              <li>• Premier à <b>5 points</b> gagne</li>
            </ul>
          )}
        </div>

        <div className="mt-10">
          <InstallButton variant="block" />
        </div>

        {/* Footer légal. */}
        <div className="mt-8 pt-6 border-t-2 border-black/10 text-center">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
          >
            <a
              href="https://www.snaptapparty.com/privacy"
              onClick={(e) => {
                e.preventDefault();
                openExternal('https://www.snaptapparty.com/privacy');
              }}
              className="underline"
            >
              Confidentialité
            </a>
            <span aria-hidden>·</span>
            <a
              href="https://www.snaptapparty.com/conditions"
              onClick={(e) => {
                e.preventDefault();
                openExternal('https://www.snaptapparty.com/conditions');
              }}
              className="underline"
            >
              Conditions
            </a>
            <span aria-hidden>·</span>
            <a
              href="https://www.snaptapparty.com/mentions-legales"
              onClick={(e) => {
                e.preventDefault();
                openExternal('https://www.snaptapparty.com/mentions-legales');
              }}
              className="underline"
            >
              Mentions légales
            </a>
          </div>
        </div>
      </div>
      {import.meta.env.DEV && (
        <a
          href="?debug"
          className="fixed bottom-3 left-3 z-50 border-2 border-black bg-black text-white px-2 py-1 text-[10px] uppercase tracking-widest"
          style={{ fontFamily: '"Space Mono", monospace' }}
        >
          🐛 Debug
        </a>
      )}

      {/* Modal de join : ouverte auto quand on arrive avec un code (QR / lien).
          Prénom + gros bouton Rejoindre → évite le clic réflexe sur "Créer". */}
      {showJoinModal && invitedCode && (
        <div
          onClick={() => setShowJoinModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative border-4 border-black bg-white w-full max-w-sm p-6"
            style={{ boxShadow: '8px 8px 0 #000' }}
          >
            <button
              onClick={() => setShowJoinModal(false)}
              aria-label="Fermer"
              className="absolute top-3 right-3 active:opacity-50"
            >
              <X size={24} strokeWidth={3} />
            </button>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 text-center mb-1 mt-1"
            >
              Tu rejoins la partie
            </div>
            <div
              style={{ fontFamily: '"Anton", sans-serif', letterSpacing: '0.15em' }}
              className="text-5xl uppercase text-center mb-5"
            >
              {invitedCode}
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-sm uppercase tracking-widest mb-2 opacity-80"
            >
              Ton prénom
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              placeholder="Prénom…"
              maxLength={20}
              autoFocus
              className="w-full border-4 border-black bg-white px-3 py-3 outline-none placeholder-black/30 text-lg mb-4"
              style={{ boxShadow: '4px 4px 0 #000' }}
            />
            {error && <div className="mb-4 text-sm text-red-600">⚠️ {error}</div>}
            <button
              onClick={joinRoom}
              disabled={busy || !name.trim()}
              className="w-full border-4 border-black py-3 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-40"
              style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '4px 4px 0 #000' }}
            >
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-2xl uppercase"
              >
                Rejoindre
              </span>
            </button>
            <button
              onClick={() => setShowJoinModal(false)}
              className="mt-3 w-full text-center"
            >
              <span
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[10px] uppercase tracking-widest opacity-50"
              >
                Ou créer une partie à la place
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Avertissement 18+ / alcool — affiche une seule fois, avant la
          premiere activation du Mode Apero. Protege l'editeur (diligence) et
          l'utilisateur : rappel majeur, alcool non obligatoire, moderation. */}
      {aperoWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
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
              <li>• Le jeu se joue avec <b>la boisson de ton choix</b> — <b>sans alcool, c'est encore mieux</b>.</li>
              <li>• Bois de façon <b>responsable</b> : chaque règle est une suggestion, jamais une obligation.</li>
              <li className="opacity-70">L'abus d'alcool est dangereux pour la santé, à consommer avec modération.</li>
            </ul>
            <button
              onClick={confirmAperoWarning}
              className="w-full border-4 border-black py-3 active:translate-x-[2px] active:translate-y-[2px]"
              style={{ backgroundColor: APERO_ACCENT, color: '#FFF', boxShadow: '4px 4px 0 #000' }}
            >
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-xl uppercase"
              >
                J'ai 18 ans et j'ai compris
              </span>
            </button>
            <button
              onClick={() => setAperoWarning(false)}
              className="mt-3 w-full text-center"
            >
              <span
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[10px] uppercase tracking-widest opacity-50"
              >
                Annuler
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Teaser Mode Apero (produit paye). En natif : achat reel (RevenueCat) ;
          sur web : "Dispo dans l'app". + bouton dev pour debloquer et tester. */}
      {aperoTeaser && (
        <div
          onClick={() => setAperoTeaser(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative border-4 border-black bg-white w-full max-w-sm p-6"
            style={{ boxShadow: '8px 8px 0 #000' }}
          >
            <button
              onClick={() => setAperoTeaser(false)}
              aria-label="Fermer"
              className="absolute top-3 right-3 active:opacity-50"
            >
              <X size={24} strokeWidth={3} />
            </button>
            <div
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-3xl uppercase leading-none mb-1 mt-1 text-center"
            >
              Mode Apéro
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mb-4 text-center"
            >
              Premium · jeu à boire
            </div>
            <p className="text-sm mb-4">
              Transforme Snap Tap en <b>jeu à boire</b> : chaque carte choisie
              déclenche une règle qui fait boire la table.
            </p>
            <div className="border-t-2 border-black/10 pt-4 flex items-end justify-between gap-3">
              <p className="text-sm opacity-80 flex-1">
                L'hôte débloque, <b>tout le salon</b> en profite.
              </p>
              <div
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-3xl leading-none shrink-0"
              >
                {prices[PRODUCT_APERO] || '4,99 €'}
              </div>
            </div>
            {billingAvailable ? (
              <button
                onClick={async () => {
                  await buyPack(PRODUCT_APERO);
                  setAperoTeaser(false);
                }}
                disabled={shopBusy}
                className="mt-5 w-full border-4 border-black bg-black text-white py-3 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
                style={{ boxShadow: '4px 4px 0 #000' }}
              >
                <span
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="text-xl uppercase"
                >
                  {shopBusy ? '…' : `Acheter ${prices[PRODUCT_APERO] || '4,99 €'}`}
                </span>
              </button>
            ) : (
              <div className="mt-5">
                <InstallCta onNavigate={() => setAperoTeaser(false)} />
              </div>
            )}
            {import.meta.env.DEV && (
              <button
                onClick={unlockAperoForTest}
                className="mt-2 w-full border-2 border-black bg-white py-2 text-[10px] uppercase tracking-widest active:opacity-60"
                style={{ fontFamily: '"Space Mono", monospace' }}
              >
                🔧 Activer pour tester (dev)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Boutique : packs premium accessibles depuis l'accueil. */}
      {showShop && (
        <div
          onClick={() => setShowShop(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative border-4 border-black bg-white w-full max-w-sm p-6 max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: '8px 8px 0 #000' }}
          >
            <button
              onClick={() => setShowShop(false)}
              aria-label="Fermer"
              className="absolute top-3 right-3 active:opacity-50"
            >
              <X size={24} strokeWidth={3} />
            </button>
            <div
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-3xl uppercase leading-none mb-1 mt-1 text-center"
            >
              🛒 Boutique
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mb-5 text-center"
            >
              Packs premium
            </div>
            {!billingAvailable && (
              <div
                className="border-2 border-black px-3 py-2 mb-4 flex items-center justify-center gap-2 text-center"
                style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '3px 3px 0 #000' }}
              >
                <span className="text-base leading-none">📱</span>
                <span
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[11px] uppercase tracking-wide leading-tight"
                >
                  Achats disponibles uniquement sur l'app mobile
                </span>
              </div>
            )}
            <div className="space-y-4">
              {[
                {
                  emoji: '🍻',
                  name: 'Mode Apéro',
                  desc: 'Le jeu à boire : chaque carte choisie fait boire la table. Inclut la catégorie « Bourré·e ».',
                  productId: PRODUCT_APERO,
                  owned: aperoOwned,
                },
                {
                  emoji: '🌶️',
                  name: 'Pack Ultra',
                  desc: '7 catégories premium : Coquin (+18), Jeux vidéo, Dessins animés, Tech, Culture FR, Mode, Politique.',
                  productId: PRODUCT_ULTRA,
                  owned: ultraOwned,
                },
              ].map((p) => {
                const price = prices[p.productId] || '4,99 €';
                return (
                  <div
                    key={p.name}
                    className="border-4 border-black p-4"
                    style={{ boxShadow: '4px 4px 0 #000' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl leading-none">{p.emoji}</span>
                      <span
                        style={{ fontFamily: '"Anton", sans-serif' }}
                        className="text-2xl uppercase leading-none flex-1 min-w-0"
                      >
                        {p.name}
                      </span>
                      {!p.owned && (
                        <span
                          style={{ fontFamily: '"Anton", sans-serif' }}
                          className="text-xl leading-none shrink-0"
                        >
                          {price}
                        </span>
                      )}
                    </div>
                    <p className="text-sm opacity-80 mb-3">{p.desc}</p>
                    {p.owned ? (
                      <div
                        className="w-full border-2 border-black py-2 flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#22C55E', color: '#000' }}
                      >
                        <span className="text-sm leading-none">✓</span>
                        <span
                          style={{ fontFamily: '"Space Mono", monospace' }}
                          className="text-[11px] uppercase tracking-widest"
                        >
                          Débloqué
                        </span>
                      </div>
                    ) : billingAvailable ? (
                      <button
                        onClick={() => buyPack(p.productId)}
                        disabled={shopBusy}
                        className="w-full border-2 border-black py-2 disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px]"
                        style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '3px 3px 0 #000' }}
                      >
                        <span
                          style={{ fontFamily: '"Space Mono", monospace' }}
                          className="text-[11px] uppercase tracking-widest"
                        >
                          {shopBusy ? '…' : `Acheter ${price}`}
                        </span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {shopError && (
              <div className="mt-3 text-center text-xs text-red-600 break-words">{shopError}</div>
            )}
            {billingAvailable ? (
              <button
                onClick={restorePurchases}
                disabled={shopBusy}
                className="mt-4 w-full underline disabled:opacity-50"
              >
                <span
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest opacity-70"
                >
                  Restaurer mes achats
                </span>
              </button>
            ) : (
              <div className="mt-5">
                <div
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest opacity-60 mb-3 text-center"
                >
                  Ces packs s'achètent dans l'app mobile
                </div>
                <InstallCta onNavigate={() => setShowShop(false)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
