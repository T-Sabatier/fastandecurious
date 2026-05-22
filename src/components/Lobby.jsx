import { ref, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import { shuffle } from '../utils';
import { HAND_SIZE, YELLOW, PINK, PLAYER_COLORS, colorHex, colorFg } from '../cards';
import { subscribeCards, seedDefaultsIfEmpty } from '../cardsStore';
import { subscribeCategories, seedCategoriesIfEmpty } from '../categoriesStore';
import { ChevronRight, X, LogOut, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Lobby({ room, roomCode, playerId, onLeave }) {
  const isHost = room.host === playerId;
  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }));
  const [copied, setCopied] = useState(false);
  const [allCards, setAllCards] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const storedCats = room.settings?.cats || {};
  const cats = Object.fromEntries(
    allCategories.map((c) => [c.id, storedCats[c.id] ?? true])
  );

  useEffect(() => {
    seedDefaultsIfEmpty().catch(() => {});
    seedCategoriesIfEmpty().catch(() => {});
    const unsubCards = subscribeCards(setAllCards);
    const unsubCats = subscribeCategories(setAllCategories);
    return () => {
      unsubCards();
      unsubCats();
    };
  }, []);

  const totalAvailable = allCards.filter((c) => cats[c.cat]).length;
  const enoughPlayers = players.length >= 3;
  const enoughCards = totalAvailable >= players.length * HAND_SIZE + 8;
  const canStart = enoughPlayers && enoughCards && allCards.length > 0;

  async function toggleCat(id) {
    if (!isHost) return;
    await set(ref(db, `rooms/${roomCode}/settings/cats/${id}`), !cats[id]);
  }

  const winningScore = room.settings?.winningScore ?? 5;
  const SCORE_OPTIONS = [3, 5, 7, 10, 12, 15];

  async function pickWinningScore(n) {
    if (!isHost) return;
    await set(ref(db, `rooms/${roomCode}/settings/winningScore`), n);
  }

  const myColor = room.players?.[playerId]?.color || null;
  const takenColors = new Set(
    players.filter((p) => p.id !== playerId && p.color).map((p) => p.color)
  );

  async function pickColor(colorId) {
    if (takenColors.has(colorId)) return;
    const next = myColor === colorId ? null : colorId;
    await set(ref(db, `rooms/${roomCode}/players/${playerId}/color`), next);
  }

  async function startGame() {
    if (!isHost || !canStart) return;

    const enabled = allCards.filter((c) => cats[c.cat]);
    const shuffled = shuffle(enabled).map((c, i) => ({ ...c, id: `c${i}` }));
    const poolObj = Object.fromEntries(
      shuffled.map((c) => [c.id, { t: c.t, cat: c.cat, spicy: !!c.spicy }])
    );

    let cursor = 0;
    const handsObj = {};
    const playersUpdate = {};

    players.forEach((p) => {
      const handCards = shuffled.slice(cursor, cursor + HAND_SIZE);
      cursor += HAND_SIZE;
      handsObj[p.id] = Object.fromEntries(handCards.map((c) => [c.id, true]));
      playersUpdate[p.id] = {
        name: p.name,
        score: 0,
        joinedAt: p.joinedAt,
        ...(p.color ? { color: p.color } : {}),
      };
    });

    const remaining = shuffled.slice(cursor).map((c) => c.id);
    const randomBoss = players[Math.floor(Math.random() * players.length)].id;

    const updates = {
      phase: 'boss_choose',
      pool: poolObj,
      hands: handsObj,
      deck: remaining,
      discard: null,
      played: null,
      winnerInfo: null,
      mode: null,
      bossId: randomBoss,
      round: 1,
      players: playersUpdate,
    };

    await update(ref(db, `rooms/${roomCode}`), updates);
  }

  async function leaveLobby() {
    await remove(ref(db, `rooms/${roomCode}/players/${playerId}`));
    // If I was the only player, the room becomes empty — let's clean it up
    const remaining = players.filter((p) => p.id !== playerId);
    if (remaining.length === 0) {
      await remove(ref(db, `rooms/${roomCode}`));
    } else if (isHost) {
      // Transfer host to the next player
      await set(ref(db, `rooms/${roomCode}/host`), remaining[0].id);
    }
    onLeave();
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div style={{ backgroundColor: YELLOW, minHeight: '100vh' }} className="text-black">
      <div className="max-w-md mx-auto px-5 py-6 pb-32">
        <div className="flex items-center justify-between mb-6">
          <button onClick={leaveLobby} className="flex items-center gap-1.5">
            <LogOut size={18} />
            <span
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest"
            >
              Quitter
            </span>
          </button>
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-4xl uppercase"
          >
            Salon
          </div>
          <div className="w-14" />
        </div>

        <div
          className="border-4 border-black bg-black text-white p-5 mb-6 text-center"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mb-1"
          >
            Code de la room
          </div>
          <div className="flex items-center justify-center gap-3">
            <div
              style={{
                fontFamily: '"Anton", sans-serif',
                color: YELLOW,
                letterSpacing: '0.15em',
              }}
              className="text-5xl uppercase"
            >
              {roomCode}
            </div>
            <button
              onClick={copyCode}
              className="border-2 border-white p-2 active:opacity-70"
              aria-label="Copier"
            >
              {copied ? <Check size={20} color="#FFE600" /> : <Copy size={20} color="#FFF" />}
            </button>
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-60 mt-2"
          >
            Partage ce code à tes potes
          </div>
        </div>

        <div className="mb-6">
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Joueurs · {players.length}
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest mb-3 opacity-70"
          >
            Min. 3 joueurs pour lancer
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const isMe = p.id === playerId;
              const isTheHost = p.id === room.host;
              const pColor = colorHex(p.color);
              const bg = pColor || (isMe ? '#000' : '#FFF');
              const fg = pColor ? colorFg(p.color) : (isMe ? YELLOW : '#000');
              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: bg,
                    color: fg,
                    boxShadow: '3px 3px 0 #000',
                  }}
                  className="border-2 border-black px-3.5 py-2 flex items-center gap-2"
                >
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="uppercase text-xl leading-none"
                  >
                    {p.name}
                  </span>
                  {isTheHost && (
                    <span
                      style={{
                        fontFamily: '"Space Mono", monospace',
                        backgroundColor: YELLOW,
                        color: '#000',
                      }}
                      className="text-[9px] px-1 py-0.5 uppercase tracking-widest"
                    >
                      Host
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Ta couleur
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest mb-3 opacity-70"
          >
            Choisis-en une avant de lancer · une seule par joueur
          </div>
          <div className="flex flex-wrap gap-2">
            {PLAYER_COLORS.map((c) => {
              const taken = takenColors.has(c.id);
              const selected = myColor === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => pickColor(c.id)}
                  disabled={taken}
                  aria-label={c.id}
                  style={{
                    backgroundColor: c.hex,
                    boxShadow: selected ? '5px 5px 0 #000' : '3px 3px 0 #000',
                    transform: selected ? 'translate(-2px, -2px)' : 'none',
                    opacity: taken ? 0.25 : 1,
                    cursor: taken ? 'not-allowed' : 'pointer',
                    width: 44,
                    height: 44,
                    transition: 'all 120ms',
                  }}
                  className="border-4 border-black"
                />
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Score gagnant
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest mb-3 opacity-70"
          >
            Premier à {winningScore} points gagne
            {!isHost && ' · Seul le host peut changer'}
          </div>
          <div className="flex flex-wrap gap-2">
            {SCORE_OPTIONS.map((n) => {
              const selected = winningScore === n;
              return (
                <button
                  key={n}
                  onClick={() => pickWinningScore(n)}
                  disabled={!isHost}
                  style={{
                    backgroundColor: selected ? '#000' : '#FFF',
                    color: selected ? YELLOW : '#000',
                    boxShadow: '4px 4px 0 #000',
                    opacity: !isHost && !selected ? 0.6 : 1,
                    minWidth: 56,
                  }}
                  className="border-4 border-black px-4 py-2 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed"
                >
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="uppercase text-2xl leading-none"
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Catégories
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest mb-3 opacity-70"
          >
            {totalAvailable} cartes dans le paquet
            {!isHost && ' · Seul le host peut changer'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {allCategories.map((cat) => {
              const on = !!cats[cat.id];
              const isSpicy = cat.spicy;
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCat(cat.id)}
                  disabled={!isHost}
                  style={{
                    backgroundColor: on && isSpicy ? PINK : '#FFF',
                    color: on && isSpicy ? '#FFF' : '#000',
                    boxShadow: on ? '4px 4px 0 #000' : '2px 2px 0 #000',
                    transition: 'all 100ms',
                    opacity: on ? 1 : 0.4,
                  }}
                  className="border-4 border-black px-3 py-3 text-left flex items-center gap-2 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed"
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="uppercase text-lg leading-none"
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 border-t-4 border-black"
        style={{ backgroundColor: YELLOW }}
      >
        <div className="max-w-md mx-auto">
          {!isHost ? (
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-center text-[10px] uppercase tracking-widest opacity-60 py-3"
            >
              En attente que le host lance la partie…
            </div>
          ) : (
            <>
              {!enoughPlayers && (
                <div
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest mb-2 text-center"
                >
                  Il faut au moins 3 joueurs
                </div>
              )}
              {enoughPlayers && !enoughCards && (
                <div
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest mb-2 text-center"
                >
                  Pas assez de cartes — coche plus de catégories
                </div>
              )}
              <button
                onClick={startGame}
                disabled={!canStart}
                className="w-full border-4 border-black bg-black text-white py-4 disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px]"
                style={{ boxShadow: '6px 6px 0 #000' }}
              >
                <div className="flex items-center justify-center gap-3">
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="text-2xl uppercase tracking-wide"
                  >
                    Lancer la partie
                  </span>
                  <ChevronRight size={28} />
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
