import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';
import {
  getOrCreatePlayerId,
  getStoredRoom,
  setStoredRoom,
} from './utils';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';

export default function App() {
  const [playerId] = useState(getOrCreatePlayerId);
  const [roomCode, setRoomCode] = useState(getStoredRoom);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }
    setLoading(true);
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      const val = snap.val();
      if (!val) {
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
