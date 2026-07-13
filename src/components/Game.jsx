import { useState, useEffect } from 'react';
import { ref, update, runTransaction, remove, set } from 'firebase/database';
import { db } from '../firebase';
import {
  shuffle,
  toArray,
  fitCard,
  fitBig,
} from '../utils';
import {
  WINNING_SCORE,
  HAND_SIZE,
  YELLOW,
  PINK,
  LIKE_GREEN,
  DISLIKE_RED,
  CATEGORIES,
  colorHex,
  colorFg,
} from '../cards';

const CAT_EMOJI = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.emoji])
);
function catEmojiOf(card) {
  return CAT_EMOJI[card?.cat] || '';
}
import {
  Heart,
  HeartCrack,
  ChevronRight,
  Trophy,
  LogOut,
  Clock,
  Eye,
  X,
  Zap,
} from 'lucide-react';

export default function Game({ room, roomCode, playerId, onLeave }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [vatoutArmed, setVatoutArmed] = useState(false);
  const [espionArming, setEspionArming] = useState(false);
  const [espionReveal, setEspionReveal] = useState({});
  const [espionDone, setEspionDone] = useState(false);
  const [sortsOpen, setSortsOpen] = useState(false);

  const isHost = room.host === playerId;
  const isBoss = room.bossId === playerId;

  const players = Object.entries(room.players || {}).map(([id, p]) => ({
    id,
    ...p,
  }));
  const playerById = Object.fromEntries(players.map((p) => [p.id, p]));
  const boss = room.bossId ? playerById[room.bossId] : null;
  const bossColor = colorHex(boss?.color);

  const myHandCardIds = Object.keys(room.hands?.[playerId] || {});
  const pool = room.pool || {};

  // Sorts (pouvoirs) actives par l'host + ce que j'ai deja consomme.
  const sorts = room.settings?.sorts || {};
  const myUsed = room.players?.[playerId]?.sortsUsed || {};

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

  // --- Timer par tour (settings.turnTimer, 0 = off) -----------------------
  // Demarre quand le VIP annonce j'aime/j'aime pas (playStartedAt). A zero,
  // le client du retardataire joue sa PREMIERE carte (tri par id : choix
  // deterministe → idempotent meme si le host enforce en parallele).
  const turnTimer = room.settings?.turnTimer || 0;
  const timerActive =
    turnTimer > 0 && room.phase === 'play' && !!room.playStartedAt;
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!timerActive) return undefined;
    const iv = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(iv);
  }, [timerActive]);
  const timerRemaining = timerActive
    ? Math.max(0, Math.ceil((room.playStartedAt + turnTimer * 1000 - nowTs) / 1000))
    : null;

  // Expiration (moi) : je n'ai pas joue → une carte part toute seule.
  useEffect(() => {
    if (!timerActive || isBoss || iHavePlayed || timerRemaining > 0) return;
    const first = [...myHandCardIds].sort()[0];
    if (!first) return;
    update(ref(db, `rooms/${roomCode}`), {
      [`hands/${playerId}/${first}`]: null,
      [`played/${playerId}`]: first,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, timerRemaining, isBoss, iHavePlayed]);

  // Filet de securite (host, +4s de grace) : joue pour les joueurs absents
  // (tel verrouille, app fermee) pour ne jamais bloquer la manche. Meme
  // carte deterministe que l'auto-play local → pas de double jeu.
  useEffect(() => {
    if (!timerActive || !isHost) return;
    if (room.playStartedAt + (turnTimer + 4) * 1000 > nowTs) return;
    const updates = {};
    players.forEach((p) => {
      if (p.id === room.bossId || playedObj[p.id]) return;
      const hand = Object.keys(room.hands?.[p.id] || {}).sort();
      if (hand.length === 0) return;
      updates[`hands/${p.id}/${hand[0]}`] = null;
      updates[`played/${p.id}`] = hand[0];
    });
    if (Object.keys(updates).length > 0) {
      update(ref(db, `rooms/${roomCode}`), updates).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, isHost, nowTs]);
  // -------------------------------------------------------------------------

  // Safety net: si bossId pointe vers un joueur disparu (boss qui a quitte
  // sans nettoyer), le host reassigne le boss et reset la phase
  useEffect(() => {
    if (!isHost) return;
    const inGamePhase = ['boss_choose', 'play', 'reveal'].includes(room.phase);
    if (!inGamePhase) return;
    if (room.bossId && playerById[room.bossId]) return;
    if (players.length === 0) return;
    runTransaction(ref(db, `rooms/${roomCode}`), (cur) => {
      if (!cur) return undefined;
      if (cur.bossId && cur.players?.[cur.bossId]) return undefined;
      const remainingIds = Object.keys(cur.players || {});
      if (remainingIds.length === 0) return undefined;
      return {
        ...cur,
        bossId: remainingIds[0],
        phase: 'boss_choose',
        mode: null,
        played: null,
        winnerInfo: null,
      };
    });
  }, [isHost, room.phase, room.bossId, players.length, playerById, roomCode]);

  // Reset local state on phase / round changes
  useEffect(() => {
    setSelectedCard(null);
    setVatoutArmed(false);
    setEspionArming(false);
    setEspionReveal({});
    setEspionDone(false);
    setSortsOpen(false);
  }, [room.phase, room.round, room.bossId]);

  async function bossChooseMode(m) {
    if (!isBoss || busy) return;
    setBusy(true);
    try {
      await update(ref(db, `rooms/${roomCode}`), {
        mode: m,
        phase: 'play',
        played: null,
        bossPick: null,
        vatout: null,
        // Depart du timer par tour (si active dans les reglages du salon)
        playStartedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function playCard() {
    if (!selectedCard || isBoss || iHavePlayed || busy) return;
    setBusy(true);
    const useVatout = vatoutArmed && sorts.vatout && !myUsed.vatout;
    try {
      const updates = {
        [`hands/${playerId}/${selectedCard}`]: null,
        [`played/${playerId}`]: selectedCard,
      };
      if (useVatout) {
        updates[`vatout/${playerId}`] = true;
        updates[`players/${playerId}/sortsUsed/vatout`] = true;
      }
      await update(ref(db, `rooms/${roomCode}`), updates);
    } finally {
      setBusy(false);
      setSelectedCard(null);
      setVatoutArmed(false);
    }
  }

  // SORT Reroll : rejette ma main et repioche HAND_SIZE cartes. Transaction
  // pour eviter les conflits si plusieurs joueurs rerollent en meme temps.
  async function rerollHand() {
    if (isBoss || iHavePlayed || busy) return;
    if (!sorts.reroll || myUsed.reroll) return;
    if (!confirm('Rejeter ta main et repiocher 7 nouvelles cartes ? (1 seule fois)')) return;
    setBusy(true);
    try {
      await runTransaction(ref(db, `rooms/${roomCode}`), (cur) => {
        if (!cur || cur.phase !== 'play') return undefined;
        if (cur.played?.[playerId]) return undefined;
        if (cur.players?.[playerId]?.sortsUsed?.reroll) return undefined;
        const myHand = Object.keys(cur.hands?.[playerId] || {});
        let deck = toArray(cur.deck);
        let discard = [...toArray(cur.discard), ...myHand];
        const newHand = {};
        for (let i = 0; i < HAND_SIZE; i++) {
          if (deck.length === 0 && discard.length > 0) {
            deck = shuffle(discard);
            discard = [];
          }
          if (deck.length > 0) newHand[deck.shift()] = true;
        }
        cur.hands = cur.hands || {};
        cur.hands[playerId] = newHand;
        cur.deck = deck;
        cur.discard = discard;
        cur.players[playerId].sortsUsed = {
          ...(cur.players[playerId].sortsUsed || {}),
          reroll: true,
        };
        return cur;
      });
    } finally {
      setBusy(false);
      setSelectedCard(null);
    }
  }

  // SORT Espion : revele (pour moi seul) qui a pose la carte tapee.
  async function consumeEspion(cardId) {
    if (!espionArming || espionDone || espionReveal[cardId]) return;
    setEspionReveal((r) => ({ ...r, [cardId]: true }));
    setEspionArming(false);
    setEspionDone(true); // verrou local : une seule carte revelee, pas de re-arme
    if (sorts.espion && !myUsed.espion) {
      await update(ref(db, `rooms/${roomCode}`), {
        [`players/${playerId}/sortsUsed/espion`]: true,
      }).catch(() => {});
    }
  }

  async function bossPickWinner(entry) {
    if (!isBoss || busy) return;
    setBusy(true);
    try {
      await update(ref(db, `rooms/${roomCode}`), {
        winnerInfo: { playerId: entry.playerId, cardId: entry.cardId },
        phase: 'result',
        bossPick: null,
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
      // SORT Va-tout : si le gagnant avait parie, sa carte vaut +2.
      const gain = room.vatout?.[winnerId] ? 2 : 1;
      const winnerNewScore = winnerCurrentScore + gain;
      updates[`players/${winnerId}/score`] = winnerNewScore;
      // Le va-tout est valable un seul tour → on le remet a zero.
      updates['vatout'] = null;

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

      const targetScore = room.settings?.winningScore ?? WINNING_SCORE;
      if (winnerNewScore >= targetScore) {
        updates['phase'] = 'game_over';
        // Compteur de victoires de la session : il survit au retour au lobby
        // (backToLobby ne touche pas `wins`) et meurt avec la room.
        updates[`wins/${winnerId}`] = (room.wins?.[winnerId] || 0) + 1;
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
        playersReset[p.id] = {
          name: p.name,
          score: 0,
          joinedAt: p.joinedAt,
          ...(p.color ? { color: p.color } : {}),
        };
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
      const wasBoss = room.bossId === playerId;
      const updates = {
        [`players/${playerId}`]: null,
        [`hands/${playerId}`]: null,
      };
      if (remaining.length === 0) {
        await remove(ref(db, `rooms/${roomCode}`));
        onLeave();
        return;
      }
      if (isHost) {
        updates.host = remaining[0].id;
      }
      if (wasBoss) {
        updates.bossId = remaining[0].id;
        updates.phase = 'boss_choose';
        updates.mode = null;
        updates.played = null;
        updates.winnerInfo = null;
        updates.bossPick = null;
      } else {
        updates[`played/${playerId}`] = null;
      }
      await update(ref(db, `rooms/${roomCode}`), updates);
      onLeave();
    } finally {
      setBusy(false);
    }
  }

  // ============ COMMON SUBCOMPONENTS ============

  const TopBar = ({ right }) => (
    <div className="px-4 py-3 border-b-4 border-black bg-yellow-300" style={{ backgroundColor: YELLOW }}>
      <div className="flex items-center justify-between max-w-xl mx-auto">
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
    </div>
  );

  const Scoreboard = () => (
    <div className="px-4 py-2 border-b-4 border-black bg-white/40">
      <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xl mx-auto">
        {players.map((p) => {
          const isPlayerBoss = p.id === room.bossId;
          const isMe = p.id === playerId;
          const pColor = colorHex(p.color);
          const bg = pColor || (isPlayerBoss ? '#000' : '#FFF');
          const fg = pColor ? colorFg(p.color) : (isPlayerBoss ? YELLOW : '#000');
          const outline = isPlayerBoss
            ? '3px solid ' + YELLOW
            : isMe
              ? '2px solid ' + PINK
              : 'none';
          return (
            <div
              key={p.id}
              style={{
                backgroundColor: bg,
                color: fg,
                fontFamily: '"Anton", sans-serif',
                outline,
                outlineOffset: '1px',
              }}
              className="border-2 border-black px-2 py-1 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span className="uppercase text-sm leading-none">
                {p.name}
              </span>
              <span
                style={{
                  backgroundColor: '#000',
                  color: YELLOW,
                }}
                className="text-xs leading-none px-1.5 py-0.5"
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
          <div className="flex-1 px-5 py-6 flex flex-col max-w-xl mx-auto w-full text-center">
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[11px] uppercase tracking-[0.35em] opacity-70 mb-4"
            >
              C'est ton tour
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                lineHeight: 0.88,
                fontSize: fitBig(boss?.name || ''),
                color: bossColor || '#000',
                WebkitTextStroke: '5px #000',
                paintOrder: 'stroke fill',
                letterSpacing: '0.08em',
              }}
              className="uppercase break-words mb-2"
            >
              {boss?.name || '…'}
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

            <div className="flex flex-col gap-6 mt-2">
              <button
                onClick={() => bossChooseMode('like')}
                disabled={busy}
                className="border-4 border-black p-4 active:translate-x-[3px] active:translate-y-[3px] flex items-center justify-between"
                style={{
                  backgroundColor: LIKE_GREEN,
                  color: '#000',
                  boxShadow: '6px 6px 0 #000',
                  transform: 'rotate(-1deg)',
                }}
              >
                <div
                  style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.9 }}
                  className="text-3xl uppercase"
                >
                  J'aime
                </div>
                <Heart size={36} fill="#000" strokeWidth={0} />
              </button>

              <button
                onClick={() => bossChooseMode('dislike')}
                disabled={busy}
                className="border-4 border-black p-4 active:translate-x-[3px] active:translate-y-[3px] flex items-center justify-between"
                style={{
                  backgroundColor: DISLIKE_RED,
                  color: '#FFF',
                  boxShadow: '6px 6px 0 #000',
                  transform: 'rotate(1deg)',
                }}
              >
                <div
                  style={{
                    fontFamily: '"Anton", sans-serif',
                    lineHeight: 0.9,
                    color: '#FFF',
                  }}
                  className="text-3xl uppercase"
                >
                  J'aime pas
                </div>
                <HeartCrack size={36} color="#FFF" strokeWidth={2.5} />
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
              fontSize: fitBig(boss?.name || ''),
              color: bossColor || '#000',
              WebkitTextStroke: '5px #000',
              paintOrder: 'stroke fill',
              letterSpacing: '0.08em',
            }}
            className="uppercase mb-2 break-words"
          >
            {boss?.name || '…'}
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
          <div className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-xl mx-auto w-full">
            <div
              className="border-4 border-black p-3 flex items-center justify-between w-full max-w-sm mb-6"
              style={{
                backgroundColor: room.mode === 'like' ? LIKE_GREEN : DISLIKE_RED,
                color: room.mode === 'like' ? '#000' : '#FFF',
                boxShadow: '5px 5px 0 #000',
                transform: room.mode === 'like' ? 'rotate(-1deg)' : 'rotate(1deg)',
              }}
            >
              <div
                style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.9 }}
                className="text-3xl uppercase"
              >
                {room.mode === 'like' ? "J'aime" : "J'aime pas"}
              </div>
              {room.mode === 'like' ? (
                <Heart size={32} fill="#000" strokeWidth={0} />
              ) : (
                <HeartCrack size={32} color="#FFF" strokeWidth={2.5} />
              )}
            </div>
            <Clock size={56} strokeWidth={2.5} />
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                lineHeight: 0.9,
              }}
              className="text-3xl uppercase mb-4 mt-3"
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
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              {players
                .filter((p) => p.id !== room.bossId)
                .map((p) => {
                  const hasPlayed = !!playedObj[p.id];
                  const pColor = colorHex(p.color);
                  const bg = pColor || (hasPlayed ? '#000' : '#FFF');
                  const fg = pColor ? colorFg(p.color) : (hasPlayed ? YELLOW : '#000');
                  return (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: bg,
                        color: fg,
                        opacity: hasPlayed ? 1 : 0.5,
                        fontFamily: '"Anton", sans-serif',
                        boxShadow: '3px 3px 0 #000',
                      }}
                      className="border-2 border-black px-4 py-2 uppercase text-xl leading-none"
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
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-xl mx-auto w-full">
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 mb-2"
            >
              Ta carte
            </div>
            <div
              className="border-4 border-black p-5 mb-6 max-w-xs w-full relative"
              style={{
                backgroundColor: '#FFF',
                color: '#000',
                boxShadow: '8px 8px 0 #000',
                transform: 'rotate(-2deg)',
              }}
            >
              <span
                className="absolute top-1.5 right-2 text-lg leading-none opacity-80 select-none"
                aria-hidden
              >
                {catEmojiOf(myCard)}
              </span>
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
              style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.95 }}
              className="text-3xl uppercase mb-3"
            >
              En attente<br />des autres
            </div>
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                backgroundColor: '#000',
                color: YELLOW,
                boxShadow: '4px 4px 0 #000',
              }}
              className="inline-block border-4 border-black px-4 py-2 text-2xl uppercase"
            >
              {playedCount} / {nonBossCount} ont posé
            </div>
          </div>
        </div>
      );
    }

    // Non-boss player : main directement, banniere mode en haut
    const isLike = room.mode === 'like';
    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar right={`${playedCount}/${nonBossCount}`} />
        <Scoreboard />
        <div className="px-4 pt-3 pb-6 max-w-xl mx-auto w-full">
          <div
            className="border-4 border-black p-4 flex items-center justify-between gap-3"
            style={{
              backgroundColor: isLike ? LIKE_GREEN : DISLIKE_RED,
              color: isLike ? '#000' : '#FFF',
              boxShadow: '5px 5px 0 #000',
              transform: isLike ? 'rotate(-1deg)' : 'rotate(1deg)',
            }}
          >
            <div
              style={{ fontFamily: '"Anton", sans-serif', lineHeight: 0.95 }}
              className="text-2xl uppercase min-w-0 break-words"
            >
              <span
                style={{
                  color: bossColor || (isLike ? '#000' : '#FFF'),
                  WebkitTextStroke: isLike ? '0.6px #000' : '0.6px #FFF',
                  paintOrder: 'stroke fill',
                }}
              >
                {boss?.name || '…'}
              </span>{' '}
              veut {isLike ? "J'aime" : "J'aime pas"}
            </div>
            {isLike ? (
              <Heart size={40} fill="#000" strokeWidth={0} className="shrink-0" />
            ) : (
              <HeartCrack size={40} color="#FFF" strokeWidth={2.5} className="shrink-0" />
            )}
          </div>
        </div>

        <div className="flex-1 px-4 pb-32 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
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
                    backgroundColor: isSel ? PINK : '#FFF',
                    color: isSel ? '#FFF' : '#000',
                    boxShadow: isSel ? '6px 6px 0 #000' : '4px 4px 0 #000',
                    transform: isSel ? 'translate(-2px, -2px)' : 'none',
                    transition: 'all 120ms',
                    minHeight: '100px',
                  }}
                  className="border-4 border-black p-3 pt-5 text-center flex items-center justify-center relative"
                >
                  {/* Petit badge catégorie, discret en haut à droite */}
                  <span
                    className="absolute top-1.5 right-2 text-base leading-none opacity-70 select-none"
                    aria-hidden
                  >
                    {catEmojiOf(card)}
                  </span>
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
          <div className="max-w-xl mx-auto">
            {timerActive && !isBoss && !iHavePlayed && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg leading-none" aria-hidden>
                  ⏱
                </span>
                <span
                  style={{
                    fontFamily: '"Anton", sans-serif',
                    color: timerRemaining <= 5 ? DISLIKE_RED : '#000',
                  }}
                  className="text-2xl uppercase leading-none tabular-nums"
                >
                  {timerRemaining}s
                </span>
                {timerRemaining <= 5 && (
                  <span
                    style={{ fontFamily: '"Space Mono", monospace', color: DISLIKE_RED }}
                    className="text-[10px] uppercase tracking-widest"
                  >
                    dépêche-toi !
                  </span>
                )}
              </div>
            )}
            {(sorts.reroll || sorts.vatout) &&
              (sortsOpen ? (
                <div className="flex gap-2 mb-2 items-stretch">
                  {sorts.reroll && (
                    <button
                      onClick={rerollHand}
                      disabled={busy || myUsed.reroll}
                      className="flex-1 border-4 border-black bg-white py-2 disabled:opacity-30 active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-1.5"
                      style={{ boxShadow: '4px 4px 0 #000' }}
                    >
                      <span className="text-lg leading-none">🎲</span>
                      <span
                        style={{ fontFamily: '"Anton", sans-serif' }}
                        className="text-sm uppercase leading-none"
                      >
                        {myUsed.reroll ? 'Reroll utilisé' : 'Reroll'}
                      </span>
                    </button>
                  )}
                  {sorts.vatout && (
                    <button
                      onClick={() => !myUsed.vatout && setVatoutArmed((v) => !v)}
                      disabled={busy || myUsed.vatout}
                      className="flex-1 border-4 border-black py-2 disabled:opacity-30 active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: vatoutArmed ? DISLIKE_RED : '#FFF',
                        color: vatoutArmed ? '#FFF' : '#000',
                        boxShadow: '4px 4px 0 #000',
                      }}
                    >
                      <span className="text-lg leading-none">🔥</span>
                      <span
                        style={{ fontFamily: '"Anton", sans-serif' }}
                        className="text-sm uppercase leading-none"
                      >
                        {myUsed.vatout
                          ? 'x2 utilisé'
                          : vatoutArmed
                            ? 'x2 activé !'
                            : 'x2'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setSortsOpen(false)}
                    aria-label="Fermer les sorts"
                    className="border-4 border-black bg-black text-white px-3 active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center"
                    style={{ boxShadow: '4px 4px 0 #000' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={() => setSortsOpen(true)}
                    className="border-4 border-black bg-white px-3 py-1.5 active:translate-x-[2px] active:translate-y-[2px] flex items-center gap-1.5"
                    style={{
                      boxShadow: '4px 4px 0 #000',
                      backgroundColor: vatoutArmed ? DISLIKE_RED : '#FFF',
                      color: vatoutArmed ? '#FFF' : '#000',
                    }}
                  >
                    <Zap size={16} fill="currentColor" strokeWidth={0} />
                    <span
                      style={{ fontFamily: '"Anton", sans-serif' }}
                      className="text-sm uppercase leading-none"
                    >
                      {vatoutArmed ? 'x2 armé' : 'Sorts'}
                    </span>
                  </button>
                </div>
              ))}
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
                  {selectedCard
                    ? vatoutArmed
                      ? 'Jouer en x2 🔥'
                      : 'Jouer cette carte'
                    : 'Choisis une carte'}
                </span>
                {selectedCard && <ChevronRight size={24} />}
              </div>
            </button>
          </div>
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
          <div className="px-5 pt-3 pb-2 max-w-xl mx-auto w-full">
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
          <div className="flex-1 px-4 pb-32 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mt-3 max-w-xl mx-auto">
              {playedEntries.map((entry, i) => {
                const card = pool[entry.cardId];
                if (!card) return null;
                const isSel = room.bossPick === entry.cardId;
                const rot = i % 2 === 0 ? '-1.5deg' : '1.5deg';
                return (
                  <button
                    key={i}
                    onClick={() => {
                      set(
                        ref(db, `rooms/${roomCode}/bossPick`),
                        entry.cardId
                      ).catch(() => {});
                    }}
                    disabled={busy}
                    style={{
                      backgroundColor: '#FFF',
                      color: '#000',
                      boxShadow: isSel ? '8px 8px 0 #000' : '5px 5px 0 #000',
                      transform: isSel
                        ? `rotate(${rot}) translate(-3px, -3px)`
                        : `rotate(${rot})`,
                      outline: isSel ? `4px solid ${PINK}` : 'none',
                      outlineOffset: isSel ? '3px' : '0',
                      minHeight: '120px',
                      transition: 'all 120ms',
                    }}
                    className="border-4 border-black p-4 pt-6 text-center flex items-center justify-center active:translate-x-[2px] active:translate-y-[2px] relative"
                  >
                    <span
                      className="absolute top-1.5 right-2 text-base leading-none opacity-70 select-none"
                      aria-hidden
                    >
                      {catEmojiOf(card)}
                    </span>
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
            <div className="max-w-xl mx-auto">
              <button
                onClick={() => {
                  const entry = playedEntries.find((e) => e.cardId === room.bossPick);
                  if (entry) bossPickWinner(entry);
                }}
                disabled={!room.bossPick || busy}
                className="w-full border-4 border-black bg-black text-white py-4 disabled:opacity-30 active:translate-x-[2px] active:translate-y-[2px]"
                style={{ boxShadow: '6px 6px 0 #000' }}
              >
                <div className="flex items-center justify-center gap-3">
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="text-xl uppercase tracking-wide"
                  >
                    {room.bossPick ? 'Valider mon choix' : 'Choisis une carte'}
                  </span>
                  {room.bossPick && <ChevronRight size={24} />}
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Non-boss: MODE PROJECTEUR — fond noir, le boss "scanne" les cartes.
    // Changement radical de fond (noir au lieu du jaune) = signal visuel le
    // plus fort que ce n'est PAS a moi de jouer, sans rien avoir a lire.
    const revealIsLike = room.mode === 'like';
    const modeColor = revealIsLike ? LIKE_GREEN : DISLIKE_RED;
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }} className="text-white flex flex-col">
        <TopBar right={`${playedEntries.length} CARTES`} />
        <Scoreboard />

        {/* Entete projecteur : gros nom du boss qui pulse + halo couleur du mode */}
        <div className="relative px-4 pt-6 pb-4 text-center overflow-hidden">
          <div
            className="boss-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              width: 320,
              height: 220,
              background: `radial-gradient(ellipse at center, ${bossColor || modeColor}66 0%, transparent 70%)`,
              filter: 'blur(10px)',
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center">
            <Eye size={28} color={modeColor} strokeWidth={2.5} className="mb-1 animate-pulse" />
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                lineHeight: 0.9,
                fontSize: fitBig(boss?.name || ''),
                color: bossColor || '#FFF',
                letterSpacing: '0.06em',
              }}
              className="uppercase break-words"
            >
              {boss?.name || '…'}
            </div>
            <div
              className="inline-flex items-center gap-2 mt-2 border-2 px-3 py-1"
              style={{ borderColor: modeColor, color: modeColor }}
            >
              {revealIsLike ? (
                <Heart size={16} fill={modeColor} strokeWidth={0} />
              ) : (
                <HeartCrack size={16} color={modeColor} strokeWidth={2.5} />
              )}
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-base uppercase leading-none"
              >
                choisit ce qu'il {revealIsLike ? 'aime' : 'aime pas'}
              </span>
            </div>
            {sorts.espion && (
              <button
                onClick={() =>
                  !myUsed.espion && !espionDone && setEspionArming((v) => !v)
                }
                disabled={myUsed.espion || espionDone}
                className="mt-3 inline-flex items-center gap-2 border-2 px-3 py-1.5 disabled:opacity-40"
                style={{
                  borderColor: espionArming ? YELLOW : '#666',
                  backgroundColor: espionArming ? YELLOW : 'transparent',
                  color: espionArming ? '#000' : '#FFF',
                }}
              >
                <span className="text-base leading-none">🕵️</span>
                <span
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="text-sm uppercase leading-none"
                >
                  {myUsed.espion || espionDone
                    ? 'Espion utilisé'
                    : espionArming
                      ? 'Tape une carte…'
                      : 'Espion'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Cartes sombres "sur scene" + faisceau de projecteur qui balaie */}
        <div className="flex-1 px-4 pb-8 overflow-y-auto">
          <div className="relative max-w-xl mx-auto">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 spotlight-sweep z-10"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
              }}
              aria-hidden
            />
            <div className="grid grid-cols-2 gap-3 mt-1">
              {playedEntries.map((entry, i) => {
                const card = pool[entry.cardId];
                if (!card) return null;
                const isBossPick = room.bossPick === entry.cardId;
                const rot = i % 2 === 0 ? '-1.5deg' : '1.5deg';
                const revealed = espionReveal[entry.cardId];
                const author = playerById[entry.playerId];
                return (
                  <div
                    key={i}
                    onClick={() => consumeEspion(entry.cardId)}
                    style={{
                      backgroundColor: isBossPick ? '#FFF' : '#33333a',
                      color: isBossPick ? '#000' : '#c9c9d2',
                      borderColor: isBossPick
                        ? PINK
                        : espionArming && !revealed
                          ? YELLOW
                          : '#55555f',
                      boxShadow: isBossPick
                        ? `0 0 0 4px ${PINK}, 0 0 32px ${PINK}`
                        : 'none',
                      opacity: isBossPick ? 1 : 0.82,
                      transform: isBossPick
                        ? `rotate(${rot}) scale(1.06)`
                        : `rotate(${rot})`,
                      minHeight: '120px',
                      transition: 'all 160ms',
                      cursor: espionArming && !revealed ? 'pointer' : 'default',
                    }}
                    className="border-4 p-4 pt-6 text-center flex items-center justify-center relative"
                  >
                    <span
                      className="absolute top-1.5 right-2 text-base leading-none select-none"
                      style={{ filter: isBossPick ? 'none' : 'grayscale(0.6)', opacity: isBossPick ? 0.85 : 0.6 }}
                      aria-hidden
                    >
                      {catEmojiOf(card)}
                    </span>
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
                    {revealed && author && (
                      <div
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 border-2 border-black px-2 py-0.5 whitespace-nowrap"
                        style={{
                          backgroundColor: colorHex(author.color) || '#000',
                          color: colorHex(author.color)
                            ? colorFg(author.color)
                            : '#FFF',
                          fontFamily: '"Anton", sans-serif',
                          boxShadow: '2px 2px 0 #000',
                        }}
                      >
                        <span className="text-sm uppercase leading-none">
                          🕵️ {author.name || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ PHASE: RESULT ============
  if (room.phase === 'result' && room.winnerInfo) {
    const winnerP = playerById[room.winnerInfo.playerId];
    const winnerCard = pool[room.winnerInfo.cardId];
    const winnerGain = room.vatout?.[room.winnerInfo.playerId] ? 2 : 1;
    const winnerNewScore = (winnerP?.score || 0) + winnerGain;
    const willWinGame = winnerNewScore >= (room.settings?.winningScore ?? WINNING_SCORE);
    const iAmWinner = room.winnerInfo.playerId === playerId;

    return (
      <div style={baseWrap} className="text-black flex flex-col">
        <TopBar />
        <Scoreboard />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-6 max-w-xl mx-auto w-full">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mb-2"
          >
            Carte choisie
          </div>
          <div
            className="border-4 border-black p-6 mb-6 max-w-sm w-full relative"
            style={{
              backgroundColor: '#000',
              color: YELLOW,
              boxShadow: '8px 8px 0 #000',
              transform: 'rotate(-2deg)',
            }}
          >
            <span
              className="absolute top-1.5 right-2 text-lg leading-none opacity-80 select-none"
              aria-hidden
            >
              {catEmojiOf(winnerCard)}
            </span>
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
              color: colorHex(winnerP?.color) || '#000',
              WebkitTextStroke: '5px #000',
              paintOrder: 'stroke fill',
              letterSpacing: '0.08em',
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
            +{winnerGain} point{winnerGain > 1 ? 's' : ''}
          </div>
          {winnerGain > 1 && (
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                backgroundColor: DISLIKE_RED,
                color: '#FFF',
                boxShadow: '4px 4px 0 #000',
                transform: 'rotate(-2deg)',
              }}
              className="inline-block border-4 border-black px-3 py-1 text-lg uppercase mt-3 ml-2"
            >
              🔥 x2 réussi
            </div>
          )}
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
                    : `À ${winnerP?.name} de jouer`}
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-8 max-w-xl mx-auto w-full">
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
              color: colorHex(champ?.color) || '#000',
              WebkitTextStroke: '5px #000',
              paintOrder: 'stroke fill',
              letterSpacing: '0.08em',
            }}
            className="uppercase mb-8 break-words"
          >
            {champ?.name || '?'}
          </div>

          <div className="w-full max-w-sm space-y-2 mb-8">
            {ranked.map((p, i) => {
              const pColor = colorHex(p.color);
              const bg = pColor || (i === 0 ? '#000' : '#FFF');
              // Noms en blanc (lisere noir) sur les fonds colores : plus
              // lisible et plus homogene que le noir sur certaines couleurs.
              const fg = pColor ? '#FFF' : (i === 0 ? YELLOW : '#000');
              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: bg,
                    color: fg,
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
                      style={{
                        fontFamily: '"Anton", sans-serif',
                        WebkitTextStroke: '1px #000',
                        paintOrder: 'stroke fill',
                        letterSpacing: '0.05em',
                      }}
                      className="text-xl uppercase leading-none"
                    >
                      {p.name}
                    </span>
                    {(room.wins?.[p.id] || 0) > 0 && (
                      <span
                        style={{ fontFamily: '"Space Mono", monospace' }}
                        className="text-xs whitespace-nowrap"
                        title="Victoires dans cette room"
                      >
                        🏆×{room.wins[p.id]}
                      </span>
                    )}
                  </div>
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="text-2xl"
                  >
                    {p.score || 0}
                  </span>
                </div>
              );
            })}
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
