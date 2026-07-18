import { useState, useEffect } from 'react';
import { ref, onValue, remove, get } from 'firebase/database';
import { db } from './firebase';
import { MAX_PLAYERS } from './cards';
import {
  getOrCreatePlayerId,
  getStoredRoom,
  setStoredRoom,
  ROOM_TTL_MS,
} from './utils';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import Admin from './components/Admin.jsx';
import Debug from './components/Debug.jsx';

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname === '/admin';

  // Mode debug (dev uniquement) : ?debug dans l'URL → galerie d'ecrans
  const isDebugRoute =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug');

  const [playerId] = useState(getOrCreatePlayerId);
  const [roomCode, setRoomCode] = useState(getStoredRoom);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  if (isAdminRoute) {
    return <Admin />;
  }

  if (isDebugRoute) {
    return <Debug />;
  }

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }
    setLoading(true);
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      const val = snap.val();
      const playerCount = val?.players ? Object.keys(val.players).length : 0;
      // Room trop vieille (> TTL) → consideree abandonnee, meme en pleine partie.
      const expired = val?.createdAt && val.createdAt < Date.now() - ROOM_TTL_MS;
      if (!val || playerCount === 0 || expired) {
        // Room inexistante / vide / expiree → on la supprime et on sort
        if (val && (playerCount === 0 || expired)) {
          remove(ref(db, `rooms/${roomCode}`)).catch(() => {});
        }
        setStoredRoom(null);
        setRoomCode(null);
        setRoom(null);
      } else {
        setRoom(val);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [roomCode]);

  // Presence dans le lobby : on ne retire JAMAIS un joueur automatiquement.
  // Changer d'appli / verrouiller l'ecran sur mobile ne fait donc plus sortir
  // du salon. Le seul moyen de retirer quelqu'un est : soit il clique "Quitter",
  // soit l'host le kick manuellement (voir Lobby.jsx).

  // Scan du QR / ouverture d'un lien ?room=CODE → on rejoint DIRECTEMENT le
  // salon (sans passer par l'accueil). Le joueur est cree avec un prenom
  // eventuellement vide ; il le saisira (ainsi que sa couleur) dans le lobby.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = (new URLSearchParams(window.location.search).get('room') || '')
      .trim()
      .toUpperCase()
      .slice(0, 4);
    if (!code || code.length !== 4) return;
    // Deja dans cette room : rien a faire. Mais si une AUTRE room traine en
    // memoire (session precedente), le QR scanne GAGNE : on bascule dessus —
    // sinon le scan etait ignore et on atterrissait sur l'accueil.
    if (code === roomCode) return;
    let cancelled = false;
    setAutoJoining(true);
    (async () => {
      try {
        const snap = await get(ref(db, `rooms/${code}`));
        if (cancelled) return;
        if (!snap.exists()) {
          setJoinError('Room introuvable');
          clearRoomUrl();
          setAutoJoining(false);
          return;
        }
        const r = snap.val();
        const alreadyIn = r.players && r.players[playerId];
        // Deja dans la room (reconnexion / lien rouvert) → on rebascule direct.
        if (alreadyIn) {
          setStoredRoom(code);
          setRoomCode(code);
          setAutoJoining(false);
          return;
        }
        // Nouveau joueur : on NE rejoint PAS automatiquement (sinon il arrive
        // sans prenom). On valide la room, puis l'accueil affiche la modal de
        // join (prenom + Rejoindre) qui l'ajoutera au bon moment.
        if (r.phase !== 'lobby') {
          setJoinError('Partie déjà en cours dans cette room');
          clearRoomUrl();
          setAutoJoining(false);
          return;
        }
        if (Object.keys(r.players || {}).length >= MAX_PLAYERS) {
          setJoinError(`Room complète (${MAX_PLAYERS} joueurs max)`);
          clearRoomUrl();
          setAutoJoining(false);
          return;
        }
        if (cancelled) return;
        setAutoJoining(false);
      } catch (e) {
        if (!cancelled) {
          setJoinError('Erreur de connexion, réessaie');
          setAutoJoining(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retire ?room=CODE de l'URL : évite que la modal de join se re-déclenche
  // après avoir rejoint, quitté, ou si la room n'existe plus.
  function clearRoomUrl() {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  function joinRoom(code) {
    setStoredRoom(code);
    setRoomCode(code);
    clearRoomUrl();
  }

  function leaveRoom() {
    setStoredRoom(null);
    setRoomCode(null);
    setRoom(null);
    clearRoomUrl();
  }

  if (autoJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        <div style={{ fontFamily: '"Anton", sans-serif' }} className="text-2xl uppercase">
          Connexion à la room…
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return <Home playerId={playerId} onJoin={joinRoom} initialError={joinError} />;
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        <div style={{ fontFamily: '"Anton", sans-serif' }} className="text-2xl uppercase">
          Connexion…
        </div>
      </div>
    );
  }

  // Player not in the room (kicked or stale code)
  if (!room.players || !room.players[playerId]) {
    return <Home playerId={playerId} onJoin={joinRoom} initialError="Tu n'es plus dans cette room" onLeftover={leaveRoom} />;
  }

  if (room.phase === 'lobby') {
    return (
      <Lobby
        room={room}
        roomCode={roomCode}
        playerId={playerId}
        onLeave={leaveRoom}
      />
    );
  }

  return (
    <Game
      room={room}
      roomCode={roomCode}
      playerId={playerId}
      onLeave={leaveRoom}
    />
  );
}
