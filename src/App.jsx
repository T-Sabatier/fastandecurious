import { useState, useEffect } from 'react';
import { ref, onValue, onDisconnect, remove } from 'firebase/database';
import { db } from './firebase';
import {
  getOrCreatePlayerId,
  getStoredRoom,
  setStoredRoom,
} from './utils';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import Admin from './components/Admin.jsx';

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname === '/admin';

  const [playerId] = useState(getOrCreatePlayerId);
  const [roomCode, setRoomCode] = useState(getStoredRoom);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  if (isAdminRoute) {
    return <Admin />;
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
      if (!val || playerCount === 0) {
        // Room inexistante OU plus aucun joueur → on la supprime et on sort
        if (val && playerCount === 0) {
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

  // Nettoyage auto si le joueur ferme l'onglet — uniquement dans le lobby
  // (en partie on garde sa place pour permettre une reconnexion).
  // Si je suis le SEUL joueur, onDisconnect supprime toute la room (sinon il
  // resterait une coquille vide que personne n'est là pour effacer). S'il y a
  // d'autres joueurs, on ne retire que mon noeud ; quand il n'en reste qu'un,
  // son effet se re-arme automatiquement sur la suppression de toute la room.
  const playerCount =
    room?.players ? Object.keys(room.players).length : 0;
  useEffect(() => {
    if (!roomCode || !room || !room.players || !room.players[playerId]) return;
    if (room.phase !== 'lobby') return;
    const target =
      playerCount <= 1
        ? ref(db, `rooms/${roomCode}`)
        : ref(db, `rooms/${roomCode}/players/${playerId}`);
    const od = onDisconnect(target);
    od.remove();
    return () => {
      od.cancel().catch(() => {});
    };
  }, [roomCode, room?.phase, playerId, playerCount]);

  function joinRoom(code) {
    setStoredRoom(code);
    setRoomCode(code);
  }

  function leaveRoom() {
    setStoredRoom(null);
    setRoomCode(null);
    setRoom(null);
  }

  if (!roomCode) {
    return <Home playerId={playerId} onJoin={joinRoom} />;
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
