import { useState, useEffect } from 'react';
import { ref, set, get, remove, query, orderByChild, endAt } from 'firebase/database';
import { db } from '../firebase';
import {
  makeRoomCode,
  getStoredName,
  setStoredName,
  getStoredParty,
  setStoredParty,
  getStoredAperoUnlock,
  setStoredAperoUnlock,
  ROOM_TTL_MS,
} from '../utils';
import { CATEGORIES, YELLOW, AMBER, PINK, APERO_ACCENT, MAX_PLAYERS } from '../cards';
import { ChevronRight, Lock, X } from 'lucide-react';
import InstallButton from './InstallButton.jsx';

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
  // Preference "Mode Apero" (jeu a boire) + possession du mode (produit paye).
  // Le mode ne s'active que si l'utilisateur le POSSEDE (aperoOwned). Tant que
  // le billing n'est pas branche : verrouille, deblocable via bouton dev.
  const [party, setParty] = useState(getStoredParty);
  const [aperoOwned, setAperoOwned] = useState(getStoredAperoUnlock);
  const [aperoTeaser, setAperoTeaser] = useState(false);
  // Mode apero reellement actif = voulu ET possede.
  const partyActive = party && aperoOwned;
  function toggleParty() {
    const v = !party;
    setParty(v);
    setStoredParty(v);
  }
  function unlockAperoForTest() {
    setStoredAperoUnlock(true);
    setAperoOwned(true);
    setAperoTeaser(false);
  }

  useEffect(() => {
    // Sweep au chargement : on ne recupere QUE les rooms trop vieilles (> TTL)
    // via une requete indexee sur createdAt → leger meme avec beaucoup de rooms.
    // (necessite "rooms": { ".indexOn": ["createdAt"] } dans les regles Firebase)
    const cutoff = Date.now() - ROOM_TTL_MS;
    const oldRooms = query(ref(db, 'rooms'), orderByChild('createdAt'), endAt(cutoff));
    get(oldRooms)
      .then((snap) => {
        if (!snap.exists()) return;
        Object.keys(snap.val()).forEach((code) => {
          remove(ref(db, `rooms/${code}`)).catch(() => {});
        });
      })
      .catch(() => {});
  }, []);

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
      exists = snap.exists();
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
              fontSize: 'clamp(2.75rem, 18vw, 7rem)',
            }}
            className="uppercase whitespace-nowrap flex items-end gap-3"
          >
            <span>Snap</span>
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
              {partyActive ? 'Mode apéro : on mise des gorgées' : "Devine ce qu'ils aiment ou pas…"}
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
                {party ? 'Activé · on mise des gorgées !' : 'Jeu à boire · active-le'}
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
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={4}
            className="flex-1 min-w-0 border-4 border-black bg-white px-2 py-2 outline-none placeholder-black/30 text-center text-2xl tracking-widest"
            style={{
              boxShadow: '4px 4px 0 #000',
              fontFamily: '"Anton", sans-serif',
            }}
          />
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

        <div
          className="mt-10 border-4 border-black bg-white p-4"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase mb-2"
          >
            Règles
          </div>
          <ul className="text-sm leading-relaxed space-y-1">
            <li>• 3 joueurs minimum, chacun sur son appareil</li>
            <li>• Main de <b>7 cartes</b> chacun</li>
            <li>• Un joueur tiré au sort annonce <b>J'AIME</b> ou <b>J'AIME PAS</b></li>
            <li>• Les autres posent une carte face cachée</li>
            <li>• Il choisit sa carte préférée → <b>+1 point</b></li>
            <li>• Premier à <b>5 points</b> gagne</li>
          </ul>
        </div>

        <div className="mt-10">
          <InstallButton variant="block" />
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

      {/* Teaser Mode Apero (produit paye). Le paiement n'est pas branche :
          CTA "bientot", + bouton dev pour debloquer et tester. */}
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
            <p className="text-sm mb-2">
              Transforme Snap Tap en <b>jeu à boire</b> : tu mises des gorgées
              sur tes cartes, et la carte choisie fait boire tout le salon.
            </p>
            <p
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[9px] uppercase tracking-widest opacity-50 mb-4"
            >
              À consommer avec modération
            </p>
            <div className="border-t-2 border-black/10 pt-4 flex items-end justify-between gap-3">
              <p className="text-sm opacity-80 flex-1">
                L'hôte débloque, <b>tout le salon</b> en profite.
              </p>
              <div
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-3xl leading-none shrink-0"
              >
                4,99&nbsp;€
              </div>
            </div>
            <button
              onClick={() => setAperoTeaser(false)}
              className="mt-5 w-full border-4 border-black bg-black text-white py-3 active:translate-x-[2px] active:translate-y-[2px]"
              style={{ boxShadow: '4px 4px 0 #000' }}
            >
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-xl uppercase"
              >
                Bientôt en boutique
              </span>
            </button>
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
    </div>
  );
}
