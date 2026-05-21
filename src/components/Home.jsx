import { useState } from 'react';
import { ref, set, get } from 'firebase/database';
import { db } from '../firebase';
import {
  makeRoomCode,
  getStoredName,
  setStoredName,
} from '../utils';
import { CATEGORIES, YELLOW } from '../cards';
import { ChevronRight } from 'lucide-react';

export default function Home({ playerId, onJoin, initialError }) {
  const [name, setName] = useState(getStoredName);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);

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
      settings: { cats: defaultCats },
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
      style={{ backgroundColor: YELLOW, minHeight: '100vh' }}
      className="text-black"
    >
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="mb-10">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] tracking-[0.3em] mb-2 uppercase"
          >
            ▸ Multijoueur · Web
          </div>
          <h1
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.82,
              letterSpacing: '-0.02em',
            }}
            className="text-7xl uppercase"
          >
            Fast &<br />
            Curious
          </h1>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1 flex-1 bg-black"></div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest"
            >
              Chacun sur son tel
            </div>
          </div>
        </div>

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
            <li>• Le joueur <b>👑</b> annonce <b>J'AIME</b> ou <b>J'AIME PAS</b></li>
            <li>• Les autres posent une carte face cachée</li>
            <li>• Le <b>👑</b> choisit sa préférée → <b>+1 point</b></li>
            <li>• Premier à <b>5 points</b> gagne</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
