import { useState, useEffect } from 'react';
import { ref, update, runTransaction, remove, set } from 'firebase/database';
import { db } from '../firebase';
import {
  shuffle,
  toArray,
  fitCard,
  fitBig,
} from '../utils';
import { WINNING_SCORE, YELLOW, PINK } from '../cards';
import {
  Heart,
  HeartCrack,
  Eye,
  ChevronRight,
  Trophy,
  LogOut,
  Clock,
} from 'lucide-react';

export default function Game({ room, roomCode, playerId, onLeave }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [handRevealed, setHandRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const isHost = room.host === playerId;
  const isBoss = room.bossId === playerId;

  const players = Object.entries(room.players || {}).map(([id, p]) => ({
    id,
    ...p,
  }));
  const playerById = Object.fromEntries(players.map((p) => [p.id, p]));
  const boss = room.bossId ? playerById[room.bossId] : null;

  const myHandCardIds = Object.keys(room.hands?.[playerId] || {});
  const pool = room.pool || {};

  const playedObj = room.played || {};
  const playedEntries = Object.entries(playedObj).map(([pid, cid]) => ({
    playerId: pid,
    cardId: cid,
  }));
  const iHavePlayed = !!playedObj[playerId];
  const nonBossCount = players.length - 1;
  const playedCount = playedEntries.length;

  // Auto-transition: play → reveal once everyone has played
  useEffect(() => {
    if (
      room.phase === 'play' &&
      nonBossCount > 0 &&
      playedCount >= nonBossCount
    ) {
      runTransaction(ref(db, `rooms/${roomCode}/phase`), (cur) => {
        if (cur === 'play') return 'reveal';
        return undefined;
      });
    }
  }, [room.phase, playedCount, nonBossCount, roomCode]);

  // Reset local state on phase / round changes
  useEffect(() => {
    setSelectedCard(null);
    setHandRevealed(false);
  }, [room.phase, room.round, room.bossId]);

  async function bossChooseMode(m) {
    if (!isBoss || busy) return;
    setBusy(true);
    try {
      await update(ref(db, `rooms/${roomCode}`), {
        mode: m,
        phase: 'play',
        played: null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function playCard() {
    if (!selectedCard || isBoss || iHavePlayed || busy) return;
    setBusy(true);
    try {
      await update(ref(db, `rooms/${roomCode}`), {
        [`hands/${playerId}/${selectedCard}`]: null,
        [`played/${playerId}`]: selectedCard,
      });
    } finally {
      setBusy(false);
      setSelectedCard(null);
      setHandRevealed(false);
    }
  }

  async function bossPickWinner(entry) {
    if (!isBoss || busy) return;
    setBusy(true);
    try {
      await update(ref(db, `rooms/${roomCode}`), {
        winnerInfo: { playerId: entry.playerId, cardId: entry.cardId },
        phase: 'result',
      });
    } finally {
      setBusy(false);
    }
  }

  async function continueAfterResult() {
    if (!isHost || busy || !room.winnerInfo) return;
    setBusy(true);
    try {
      const updates = {};
      const winnerId = room.winnerInfo.playerId;
      const winnerCurrentScore = playerById[winnerId]?.score || 0;
      const winnerNewScore = winnerCurrentScore + 1;
      updates[`players/${winnerId}/score`] = winnerNewScore;

      // Move played cards to discard
      const playedCardIds = Object.values(playedObj);
      let currentDeck = toArray(room.deck);
      let currentDiscard = [...toArray(room.discard), ...playedCardIds];

      // Refill hands of non-boss players
      const nonBossIds = players
        .map((p) => p.id)
        .filter((id) => id !== room.bossId);

      nonBossIds.forEach((pid) => {
        if (currentDeck.length === 0 && currentDiscard.length > 0) {
          currentDeck = shuffle(currentDiscard);
          currentDiscard = [];
        }
        if (currentDeck.length > 0) {
          const drawn = currentDeck.shift();
          updates[`hands/${pid}/${drawn}`] = true;
        }
      });

      updates['deck'] = currentDeck;
      updates['discard'] = currentDiscard;

      if (winnerNewScore >= WINNING_SCORE) {
        updates['phase'] = 'game_over';
      } else {
        updates['phase'] = 'boss_choose';
        updates['bossId'] = winnerId;
        updates['mode'] = null;
        updates['played'] = null;
        updates['winnerInfo'] = null;
        updates['round'] = (room.round || 1) + 1;
      }

      await update(ref(db, `rooms/${roomCode}`), updates);
    } finally {
      setBusy(false);
    }
  }

  async function backToLobby() {
    if (!isHost || busy) return;
    setBusy(true);
    try {
      // Reset scores, clear game state, go back to lobby
      const playersReset = {};
      players.forEach((p) => {
        playersReset[p.id] = { name: p.name, score: 0, joinedAt: p.joinedAt };
      });
      await update(ref(db, `rooms/${roomCode}`), {
        phase: 'lobby',
        pool: null,
        hands: null,
        deck: null,
        discard: null,
        played: null,
        winnerInfo: null,
        mode: null,
        bossId: null,
        round: null,
        players: playersReset,
      });
    } finally {
      setBusy(false);
    }
  }

  async function leaveGame() {
    if (busy) return;
    if (!confirm('Quitter la partie ?')) return;
    setBusy(true);
    try {
      const remaining = players.filter((p) => p.id !== playerId);
      await remove(ref(db, `rooms/${roomCode}/players/${playerId}`));
      await remove(ref(db, `rooms/${roomCode}/hands/${playerId}`));
      if (remaining.length === 0) {
        await remove(ref(db, `rooms/${roomCode}`));
      } else if (isHost) {
        await set(ref(db, `rooms/${roomCode}/host`), remaining[0].id);
      }
      onLeave();
    } finally {
      setBusy(false);
    }
  }

  // ============ COMMON SUBCOMPONENTS ============

  const TopBar = ({ right }) => (
    <div className="px-4 py-3 flex items-center justify-between border-b-4 border-black bg-yellow-300" style={{ backgroundColor: YELLOW }}>
      <button onClick={leaveGame} className="flex items-center gap-1.5">
        <LogOut size={16} />
        <span
          style={{ fontFamily: '"Space Mono", monospace' }}
          className="text-[10px] uppercase tracking-widest"
        >
          Quitter
        </span>
      </button>
      <div
        style={{ fontFamily: '"Anton", sans-serif' }}
        className="text-lg uppercase tracking-tight"
      >
        Room {roomCode}
      </div>
      <div
        style={{ fontFamily: '"Space Mono", monospace' }}
        className="text-[10px] uppercase tracking-widest text-right min-w-[60px]"
      >
        {right || ''}
      </div>
    </div>
  );

  const Scoreboard = () => (
    <div className="px-4 py-2 border-b-4 border-black bg-white/40">
      <div className="flex items-center gap-2 overflow-x-auto">
        {players.map((p) => {
          const isPlayerBoss = p.id === room.bossId;
          const isMe = p.id === playerId;
          return (
            <div
              key={p.id}
              style={{
                backgroundColor: isPlayerBoss ? '#000' : '#FFF',
                color: isPlayerBoss ? YELLOW : '#000',
                fontFamily: '"Anton", sans-serif',
                outline: isMe ? '2px solid ' + PINK : 'none',
                outlineOffset: '1px',
              }}
              className="border-2 border-black px-2 py-1 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span className="uppercase text-xs leading-none">
                {p.name}
                {isMe && ' (toi)'}
              </span>
              <span
                style={{
                  backgroundColor: isPlayerBoss ? YELLOW : '#000',
                  color: isPlayerBoss ? '#000' : YELLOW,
                }}
                className="text-[10px] leading-none px-1.5 py-0.5"
              >
                {p.score || 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const baseWrap = {
    minHeight: '100vh',
    backgroundColor: YELLOW,
  };

  // ============ PHASE: BOSS_CHOOSE ============
  if (room.phase === 'boss_choose') {
    if (isBoss) {
      return (
        <div style={baseWrap} className="text-black flex flex-col">
          <TopBar right={`TOUR ${room.round || 1}`} />
          <Scoreboard />
          <div className="flex-1 px-5 py-6 flex flex-col">
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-70"
            >
              C'est ton tour
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                lineHeight: 0.88,
                fontSize: fitBig(boss.name),
              }}
              className="uppercase break-words mb-2"
            >
              Tu es le boss
            </div>
            <div
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-2xl uppercase mb-1 mt-4"
            >
              Annonce ton mode
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-70 mb-6"
            >
              Les autres poseront en fonction
            </div>

            <div className="flex flex-col gap-4 flex-1 justify-center">
              <button
                onClick={() => bossChooseMode('like')}
                disabled={busy}
                className="border-4 border-black p-6 active:translate-x-[3px] active:translate-y-[3px] flex items-center justify-between"
                style={{
                  backgroundColor: '#FFF',
                  boxShadow: '8px 8px 0 #000',
                  transform: 'rotate(-1deg)',
                }}
              >
                <div className="text-left">
                  <div
                    style={{ fontFamily: '"Space Mono", monospace' }}
                    className="text-[10px] uppercase tracking-widest opacity-60"
                  >
                    Mode
                  </div>
                  <div
                    style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.9 }}
                    className="text-5xl uppercase"
                  >
                    J'aime
                  </div>
                </div>
                <Heart size={48} fill="#000" strokeWidth={0} />
              </button>

              <button
                onClick={() => bossChooseMode('dislike')}
                disabled={busy}
                className="border-4 border-black p-6 active:translate-x-[3px] active:translate-y-[3px] flex items-center justify-between"
                style={{
                  backgroundColor: '#000',
                  color: '#FFF',
                  boxShadow: '8px 8px 0 #000',
                  transform: 'rotate(1deg)',
                }}
              >
                <div className="text-left">
                  <div
                    style={{ fontFamily: '"Space Mono", monospace' }}
                    className="text-[10px] uppercase tracking-widest opacity-60"
                  >
                    Mode
                  </div>
                  <div
                    style={{
                      fontFamily: '"Anton", sans-serif',
                      lineHeight: 0.9,
                      color: YELLOW,
                    }}
                    className="text-5xl uppercase"
                  >
                    J'aime pas
                  </div>
                </div>
                <HeartCrack size={48} color={YELLOW} fill={YELLOW} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      );
    }
    // Non-boss waiting
    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar right={`TOUR ${room.round || 1}`} />
        <Scoreboard />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Clock size={64} strokeWidth={2.5} />
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mt-4 mb-2"
          >
            En attente
          </div>
          <div
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.9,
              fontSize: fitBig(boss.name),
            }}
            className="uppercase mb-2 break-words"
          >
            {boss.name}
          </div>
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase opacity-80"
          >
            choisit son mode…
          </div>
        </div>
      </div>
    );
  }

  // ============ PHASE: PLAY ============
  if (room.phase === 'play') {
    if (isBoss) {
      // Boss waits while others play
      return (
        <div style={baseWrap} className="text-black flex flex-col">
          <TopBar right={`${playedCount}/${nonBossCount}`} />
          <Scoreboard />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <Clock size={64} strokeWidth={2.5} />
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mt-4 mb-2"
            >
              Mode {room.mode === 'like' ? "❤️ J'aime" : "💔 J'aime pas"}
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                lineHeight: 0.9,
              }}
              className="text-4xl uppercase mb-4"
            >
              Les joueurs<br />posent leur carte
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                backgroundColor: '#000',
                color: YELLOW,
              }}
              className="border-4 border-black px-4 py-2 text-2xl"
            >
              {playedCount} / {nonBossCount}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {players
                .filter((p) => p.id !== room.bossId)
                .map((p) => {
                  const hasPlayed = !!playedObj[p.id];
                  return (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: hasPlayed ? '#000' : '#FFF',
                        color: hasPlayed ? YELLOW : '#000',
                        opacity: hasPlayed ? 1 : 0.5,
                        fontFamily: '"Anton", sans-serif',
                      }}
                      className="border-2 border-black px-3 py-1.5 uppercase text-sm leading-none"
                    >
                      {hasPlayed ? '✓ ' : '… '}
                      {p.name}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      );
    }

    // Non-boss player
    if (iHavePlayed) {
      const myPlayedCardId = playedObj[playerId];
      const myCard = pool[myPlayedCardId];
      return (
        <div style={baseWrap} className="text-black flex flex-col">
          <TopBar right={`${playedCount}/${nonBossCount}`} />
          <Scoreboard />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mb-2"
            >
              Ta carte
            </div>
            <div
              className="border-4 border-black p-5 mb-6 max-w-xs w-full"
              style={{
                backgroundColor: myCard?.spicy ? PINK : '#000',
                color: myCard?.spicy ? '#FFF' : YELLOW,
                boxShadow: '8px 8px 0 #000',
                transform: 'rotate(-2deg)',
              }}
            >
              <div
                style={{
                  fontFamily: '"Anton", sans-serif',
                  lineHeight: 0.92,
                  fontSize: fitBig(myCard?.t || ''),
                }}
                className="uppercase"
              >
                {myCard?.t || '?'}
              </div>
            </div>
            <div
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-xl uppercase opacity-80 mb-2"
            >
              En attente des autres
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60"
            >
              {playedCount} / {nonBossCount} ont posé
            </div>
          </div>
        </div>
      );
    }

    // Non-boss player who hasn't played
    if (!handRevealed) {
      return (
        <div style={baseWrap} className="text-black flex flex-col">
          <TopBar />
          <Scoreboard />
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mb-2"
            >
              À toi de jouer
            </div>
            <div
              className="border-4 border-black bg-white p-4 mb-8 w-full max-w-sm"
              style={{ boxShadow: '5px 5px 0 #000' }}
            >
              <div
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[10px] uppercase tracking-widest opacity-60 mb-1"
              >
                Le boss {boss.name} veut
              </div>
              <div
                style={{
                  fontFamily: '"Anton", sans-serif',
                  color: room.mode === 'like' ? '#000' : PINK,
                }}
                className="text-3xl uppercase"
              >
                {room.mode === 'like' ? "❤️ J'aime" : "💔 J'aime pas"}
              </div>
            </div>

            <button
              onClick={() => setHandRevealed(true)}
              className="border-4 border-black bg-black text-white py-4 px-8 active:translate-x-[2px] active:translate-y-[2px] flex items-center gap-3"
              style={{ boxShadow: '6px 6px 0 #000' }}
            >
              <Eye size={22} />
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-xl uppercase tracking-wide"
              >
                Voir ma main
              </span>
            </button>
          </div>
        </div>
      );
    }

    // Hand revealed, picking card
    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar right={`${playedCount}/${nonBossCount}`} />
        <Scoreboard />
        <div className="px-5 pt-3 pb-2">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60"
          >
            Ta main
          </div>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <div
              style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.9 }}
              className="text-2xl uppercase"
            >
              Boss {boss.name} →
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                color: room.mode === 'like' ? '#000' : PINK,
                lineHeight: 0.9,
              }}
              className="text-2xl uppercase"
            >
              {room.mode === 'like' ? "j'aime" : "j'aime pas"}
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 pb-32 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {myHandCardIds.map((cid) => {
              const card = pool[cid];
              if (!card) return null;
              const isSel = selectedCard === cid;
              const isSpicy = card.spicy;
              return (
                <button
                  key={cid}
                  onClick={() => setSelectedCard(cid)}
                  style={{
                    backgroundColor: isSel ? (isSpicy ? PINK : '#000') : '#FFF',
                    color: isSel ? '#FFF' : '#000',
                    boxShadow: isSel ? '6px 6px 0 #000' : '4px 4px 0 #000',
                    transform: isSel ? 'translate(-2px, -2px)' : 'none',
                    transition: 'all 120ms',
                    minHeight: '100px',
                  }}
                  className="border-4 border-black p-3 text-center flex items-center justify-center"
                >
                  <div
                    style={{
                      fontFamily: '"Anton", sans-serif',
                      lineHeight: 0.95,
                      fontSize: fitCard(card.t),
                    }}
                    className="uppercase"
                  >
                    {card.t}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 p-4 border-t-4 border-black"
          style={{ backgroundColor: YELLOW }}
        >
          <button
            onClick={playCard}
            disabled={!selectedCard || busy}
            className="w-full border-4 border-black bg-black text-white py-4 disabled:opacity-30 active:translate-x-[2px] active:translate-y-[2px]"
            style={{ boxShadow: '6px 6px 0 #000' }}
          >
            <div className="flex items-center justify-center gap-3">
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-xl uppercase tracking-wide"
              >
                {selectedCard ? 'Jouer cette carte' : 'Choisis une carte'}
              </span>
              {selectedCard && <ChevronRight size={24} />}
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ============ PHASE: REVEAL ============
  if (room.phase === 'reveal') {
    if (isBoss) {
      return (
        <div style={baseWrap} className="text-black flex flex-col">
          <TopBar right={`${playedEntries.length} CARTES`} />
          <Scoreboard />
          <div className="px-5 pt-3 pb-2">
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60"
            >
              C'est ton tour de choisir
            </div>
            <div
              style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.95 }}
              className="text-2xl uppercase mt-1"
            >
              Choisis la carte que tu{' '}
              <span style={{ color: room.mode === 'like' ? '#000' : PINK }}>
                {room.mode === 'like' ? 'aimes le plus' : 'aimes le moins'}
              </span>
            </div>
          </div>
          <div className="flex-1 px-4 pb-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mt-3">
              {playedEntries.map((entry, i) => {
                const card = pool[entry.cardId];
                if (!card) return null;
                const isSpicy = card.spicy;
                const variants = [
                  { bg: '#FFF', fg: '#000' },
                  { bg: '#000', fg: YELLOW },
                  { bg: isSpicy ? PINK : '#FFF', fg: isSpicy ? '#FFF' : '#000' },
                  { bg: '#FFF', fg: '#000' },
                  { bg: '#000', fg: YELLOW },
                  { bg: '#FFF', fg: '#000' },
                  { bg: '#000', fg: YELLOW },
                  { bg: '#FFF', fg: '#000' },
                  { bg: '#FFF', fg: '#000' },
                ];
                const cv = variants[i % variants.length];
                const rot = i % 2 === 0 ? '-1.5deg' : '1.5deg';
                return (
                  <button
                    key={i}
                    onClick={() => bossPickWinner(entry)}
                    disabled={busy}
                    style={{
                      backgroundColor: cv.bg,
                      color: cv.fg,
                      boxShadow: '5px 5px 0 #000',
                      transform: `rotate(${rot})`,
                      minHeight: '120px',
                    }}
                    className="border-4 border-black p-4 text-center flex items-center justify-center active:translate-x-[2px] active:translate-y-[2px]"
                  >
                    <div
                      style={{
                        fontFamily: '"Anton", sans-serif',
                        lineHeight: 0.95,
                        fontSize: fitCard(card.t),
                      }}
                      className="uppercase"
                    >
                      {card.t}
                    </div>
                  </button>
                );
              })}
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-50 mt-4 text-center"
            >
              L'auteur·e sera révélé·e après ton choix
            </div>
          </div>
        </div>
      );
    }

    // Non-boss waiting for boss to pick
    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar />
        <Scoreboard />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Clock size={64} strokeWidth={2.5} />
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mt-4 mb-2"
          >
            En attente
          </div>
          <div
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.9,
              fontSize: fitBig(boss.name),
            }}
            className="uppercase mb-2 break-words"
          >
            {boss.name}
          </div>
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase opacity-80"
          >
            choisit la carte gagnante…
          </div>
        </div>
      </div>
    );
  }

  // ============ PHASE: RESULT ============
  if (room.phase === 'result' && room.winnerInfo) {
    const winnerP = playerById[room.winnerInfo.playerId];
    const winnerCard = pool[room.winnerInfo.cardId];
    const winnerNewScore = (winnerP?.score || 0) + 1;
    const willWinGame = winnerNewScore >= WINNING_SCORE;
    const iAmWinner = room.winnerInfo.playerId === playerId;

    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar />
        <Scoreboard />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-6">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mb-2"
          >
            Le boss a choisi
          </div>
          <div
            className="border-4 border-black p-6 mb-6 max-w-sm w-full"
            style={{
              backgroundColor: winnerCard?.spicy ? PINK : '#000',
              color: winnerCard?.spicy ? '#FFF' : YELLOW,
              boxShadow: '8px 8px 0 #000',
              transform: 'rotate(-2deg)',
            }}
          >
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                lineHeight: 0.92,
                fontSize: fitBig(winnerCard?.t || ''),
              }}
              className="uppercase"
            >
              {winnerCard?.t || '?'}
            </div>
          </div>

          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mb-1"
          >
            Posée par
          </div>
          <div
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.9,
              fontSize: fitBig(winnerP?.name || ''),
            }}
            className="uppercase mb-2 break-words"
          >
            {winnerP?.name || '?'} {iAmWinner && '🎉'}
          </div>
          <div
            style={{
              fontFamily: '"Anton", sans-serif',
              backgroundColor: '#000',
              color: YELLOW,
              boxShadow: '4px 4px 0 #000',
              transform: 'rotate(3deg)',
            }}
            className="inline-block border-4 border-black px-3 py-2 text-2xl uppercase"
          >
            +1 point
          </div>
        </div>

        <div
          className="p-4 border-t-4 border-black"
          style={{ backgroundColor: YELLOW }}
        >
          {isHost ? (
            <button
              onClick={continueAfterResult}
              disabled={busy}
              className="w-full border-4 border-black bg-black text-white py-4 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
              style={{ boxShadow: '6px 6px 0 #000' }}
            >
              <div className="flex items-center justify-center gap-3">
                <span
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="text-xl uppercase tracking-wide"
                >
                  {willWinGame
                    ? 'Voir le gagnant'
                    : `${winnerP?.name} devient boss`}
                </span>
                <ChevronRight size={24} />
              </div>
            </button>
          ) : (
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest text-center py-3 opacity-60"
            >
              En attente du host pour continuer…
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ PHASE: GAME_OVER ============
  if (room.phase === 'game_over') {
    const ranked = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    const champ = ranked[0];
    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-8">
          <Trophy size={80} strokeWidth={2.5} />
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mt-4 mb-2"
          >
            Champion·ne du jour
          </div>
          <div
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.85,
              fontSize: fitBig(champ?.name || ''),
            }}
            className="uppercase mb-8 break-words"
          >
            {champ?.name || '?'}
          </div>

          <div className="w-full max-w-sm space-y-2 mb-8">
            {ranked.map((p, i) => (
              <div
                key={p.id}
                style={{
                  backgroundColor: i === 0 ? '#000' : '#FFF',
                  color: i === 0 ? YELLOW : '#000',
                  boxShadow: '4px 4px 0 #000',
                }}
                className="border-4 border-black px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    style={{ fontFamily: '"Space Mono", monospace' }}
                    className="text-xs opacity-70"
                  >
                    #{i + 1}
                  </span>
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="text-xl uppercase leading-none"
                  >
                    {p.name}
                  </span>
                </div>
                <span
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="text-2xl"
                >
                  {p.score || 0}
                </span>
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              onClick={backToLobby}
              disabled={busy}
              className="border-4 border-black bg-black text-white py-3 px-6 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
              style={{ boxShadow: '4px 4px 0 #000' }}
            >
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-lg uppercase"
              >
                Retour au salon
              </span>
            </button>
          ) : (
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60"
            >
              En attente du host…
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
