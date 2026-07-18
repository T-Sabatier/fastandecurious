import { ref, set, remove, update } from 'firebase/database';
import { Capacitor } from '@capacitor/core';
import { db } from '../firebase';
import { shuffle, getStoredName, setStoredName, PUBLIC_URL, NAME_STYLE } from '../utils';
import { HAND_SIZE, YELLOW, AMBER, PINK, PLAYER_COLORS, SORTS, PACKS, colorHex, colorFg } from '../cards';
import { subscribeCards, seedDefaultsIfEmpty } from '../cardsStore';
import { subscribeCategories, seedCategoriesIfEmpty } from '../categoriesStore';
import { useBilling } from '../purchases';
import { ChevronRight, X, LogOut, Copy, Check, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';
import InstallButton from './InstallButton.jsx';
import InstallNudge from './InstallNudge.jsx';
import InstallCta from './InstallCta.jsx';

export default function Lobby({ room, roomCode, playerId, onLeave }) {
  const isHost = room.host === playerId;
  // Mode Apero (jeu a boire) : active a la creation via le switch d'accueil.
  const partyMode = !!room.settings?.partyMode;
  // Fond ambre "biere" quand le Mode Apero est actif (sinon jaune).
  const baseColor = partyMode ? AMBER : YELLOW;
  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }));
  const [linkCopied, setLinkCopied] = useState(false);
  const me = room.players?.[playerId];
  const myName = (me?.name || '').trim();
  const [nameInput, setNameInput] = useState(() => me?.name || getStoredName());
  const allNamed = players.every((p) => (p.name || '').trim().length > 0);
  // Dans l'app native, window.location.origin vaut capacitor://localhost :
  // le QR doit toujours pointer vers l'URL publique (fallback navigateur pour
  // ceux qui n'ont pas l'app ; App Link ouvre l'app chez ceux qui l'ont).
  const joinUrl = Capacitor.isNativePlatform()
    ? `${PUBLIC_URL}/?room=${roomCode}`
    : typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${roomCode}`
      : '';
  const [allCards, setAllCards] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  // Pack dont on affiche le teaser (tap sur une categorie verrouillee).
  const [teaserPackId, setTeaserPackId] = useState(null);

  // Meta des packs premium (emoji + label) indexee par id, pour l'affichage.
  const packById = Object.fromEntries(PACKS.map((p) => [p.id, p]));

  // Possession des packs (RevenueCat en natif, fallback web). mode_apero
  // debloque AUSSI la categorie Bourre-e, dispo ensuite dans les DEUX modes.
  const {
    apero: aperoOwned,
    ultra: ultraOwned,
    prices,
    billingAvailable,
    busy: shopBusy,
    purchase,
  } = useBilling();
  const packOwned = { mode_apero: aperoOwned, pack_ultra: ultraOwned };
  // Achat d'un pack depuis le teaser (teaserPackId = l'ID du produit Play).
  async function buyPackFromTeaser(productId) {
    try {
      await purchase(productId);
    } catch {
      /* annulation / erreur : on referme, le joueur peut reessayer */
    }
    setTeaserPackId(null);
  }

  // Categorie premium verrouillee pour MOI. Sans champ `pack` → gratuite.
  const isLocked = (cat) => {
    if (!cat.pack) return false;
    return !packOwned[cat.pack];
  };

  const storedCats = room.settings?.cats || {};
  const cats = Object.fromEntries(
    allCategories.map((c) => [
      c.id,
      // L'hote ne peut pas jouer une categorie qu'il ne possede pas.
      isHost && isLocked(c) ? false : (storedCats[c.id] ?? true),
    ])
  );

  // Affichage : categories gratuites d'abord, packs verrouilles a la fin.
  const sortedCategories = [...allCategories].sort(
    (a, b) => (isLocked(a) ? 1 : 0) - (isLocked(b) ? 1 : 0)
  );
  const lockedCount = allCategories.filter(isLocked).length;

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

  // Les brouillons (draft) sont invisibles en partie : ils n'existent que
  // dans l'admin, en attente de validation/publication.
  const playableCards = allCards.filter((c) => !c.draft);
  const totalAvailable = playableCards.filter((c) => cats[c.cat]).length;
  const enoughPlayers = players.length >= 3;
  const enoughCards = totalAvailable >= players.length * HAND_SIZE + 8;
  const canStart = enoughPlayers && enoughCards && playableCards.length > 0 && allNamed;

  async function toggleCat(id) {
    if (!isHost) return;
    const cat = allCategories.find((c) => c.id === id);
    if (cat && isLocked(cat)) return; // premium non possede : achat requis
    await set(ref(db, `rooms/${roomCode}/settings/cats/${id}`), !cats[id]);
  }

  const sorts = room.settings?.sorts || {};
  async function toggleSort(id) {
    if (!isHost) return;
    await set(ref(db, `rooms/${roomCode}/settings/sorts/${id}`), !sorts[id]);
  }

  const winningScore = room.settings?.winningScore ?? 5;
  const SCORE_OPTIONS = [3, 5, 7, 10, 12, 15];

  // Timer par tour (secondes) : 0 = desactive. A l'expiration, une carte
  // est jouee automatiquement pour les retardataires (voir Game.jsx).
  const turnTimer = room.settings?.turnTimer ?? 0;
  const TIMER_OPTIONS = [0, 15, 30, 60];

  async function pickTurnTimer(n) {
    if (!isHost) return;
    await set(ref(db, `rooms/${roomCode}/settings/turnTimer`), n);
  }

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

    const enabled = playableCards.filter((c) => cats[c.cat]);
    const shuffled = shuffle(enabled).map((c, i) => ({ ...c, id: `c${i}` }));
    const poolObj = Object.fromEntries(
      shuffled.map((c) => [c.id, { t: c.t, cat: c.cat, spicy: !!c.spicy }])
    );

    let cursor = 0;
    const handsObj = {};
    const playersUpdate = {};

    // Auto-attribution d'une couleur aux joueurs qui n'en ont pas choisi :
    // sinon leur nom s'affiche en noir en jeu. On pioche une couleur LIBRE au
    // hasard (les 16 couleurs couvrent toujours les 10 joueurs max).
    const usedColors = new Set(players.filter((p) => p.color).map((p) => p.color));
    const freeColors = shuffle(
      PLAYER_COLORS.filter((c) => !usedColors.has(c.id)).map((c) => c.id)
    );
    let colorCursor = 0;
    const colorFor = (p) =>
      p.color || freeColors[colorCursor++] || PLAYER_COLORS[0].id;

    players.forEach((p) => {
      const handCards = shuffled.slice(cursor, cursor + HAND_SIZE);
      cursor += HAND_SIZE;
      handsObj[p.id] = Object.fromEntries(handCards.map((c) => [c.id, true]));
      playersUpdate[p.id] = {
        name: p.name,
        score: 0,
        joinedAt: p.joinedAt,
        color: colorFor(p),
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

  async function saveName() {
    const n = nameInput.trim();
    if (!n) return;
    setStoredName(n);
    await set(ref(db, `rooms/${roomCode}/players/${playerId}/name`), n);
  }

  async function kickPlayer(p) {
    if (!isHost || p.id === playerId) return;
    if (!confirm(`Exclure ${p.name} du salon ?`)) return;
    await remove(ref(db, `rooms/${roomCode}/players/${p.id}`));
    await remove(ref(db, `rooms/${roomCode}/hands/${p.id}`)).catch(() => {});
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div style={{ backgroundColor: baseColor, minHeight: '100vh' }} className={`text-black${partyMode ? ' apero-bg' : ''}`}>
      {/* Incitation a installer l'app (navigateur Android, 1x/session). */}
      <InstallNudge />
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
          className="border-4 border-black bg-black text-white p-5 mb-6"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0 text-center">
              <div
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[10px] uppercase tracking-widest opacity-60 mb-1"
              >
                Code de la room
              </div>
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
                onClick={copyLink}
                className="mt-3 inline-flex items-center gap-2 border-2 border-white px-3 py-2 active:opacity-70"
              >
                {linkCopied ? <Check size={14} color="#FFE600" /> : <Copy size={14} color="#FFF" />}
                <span
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest"
                >
                  {linkCopied ? 'Lien copié' : 'Copier le lien'}
                </span>
              </button>
            </div>

            <div className="flex flex-col items-center">
              <div className="border-4 border-white p-1.5 bg-white">
                <QRCodeSVG value={joinUrl} size={110} level="M" />
              </div>
              <div
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[9px] uppercase tracking-widest opacity-60 mt-2"
              >
                Scanne
              </div>
            </div>
          </div>
        </div>

        {/* Regles du Mode Apero — visibles par TOUS les joueurs (pas que l'hote)
            quand le mode est active, pour que chacun connaisse la regle a boire. */}
        {partyMode && (
        <div
          className="border-4 border-black p-4 mb-6"
          style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '6px 6px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-2"
          >
            🍻 Mode Apéro
          </div>
          <ul className="text-sm leading-relaxed space-y-1">
            <li>• En jouant, tu <b>mises 1 à 4 gorgées</b> sur ta carte</li>
            <li>• Ta carte choisie → tu ne bois pas, tu marques, et <b>tout le monde boit ta mise</b></li>
            <li>• Sinon → tu bois la <b>mise de la carte gagnante</b></li>
          </ul>
        </div>
        )}

        {/* Saisie du prenom — affichee seulement tant qu'on n'a pas de prenom.
            L'host (et tout joueur deja nomme) ne la voit pas : il l'a deja mis. */}
        {!myName && (
        <div
          className="border-4 border-black bg-white p-4 mb-6"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Ton prénom
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest opacity-70 mb-3"
          >
            Entre ton prénom pour rejoindre 👇
          </div>
          <div className="flex items-stretch gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveName();
                  e.currentTarget.blur();
                }
              }}
              placeholder="Prénom…"
              maxLength={20}
              autoFocus={!myName}
              className="flex-1 min-w-0 border-4 border-black bg-white px-3 py-3 outline-none placeholder-black/30 text-lg"
              style={{ boxShadow: '4px 4px 0 #000' }}
            />
            <button
              onClick={saveName}
              disabled={!nameInput.trim()}
              className="border-4 border-black bg-black text-white px-4 disabled:opacity-30 active:translate-x-[2px] active:translate-y-[2px] flex items-center"
              style={{ boxShadow: '4px 4px 0 #000' }}
            >
              <span
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-lg uppercase"
              >
                OK
              </span>
            </button>
          </div>
        </div>
        )}

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
          {/* Pastilles triées par largeur (longs noms d'abord) puis étirées
              pour remplir chaque ligne : plus de vide en drapeau à droite. */}
          <div className="flex flex-wrap gap-2">
            {[...players]
              .sort((a, b) => {
                const w = (p) =>
                  (p.name?.trim().length || 1) +
                  (p.id === room.host ? 5 : 2) +
                  ((room.wins?.[p.id] || 0) > 0 ? 4 : 0);
                return w(b) - w(a);
              })
              .map((p) => {
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
                  className="border-2 border-black px-3.5 py-2 flex items-center gap-2 min-w-0 grow"
                >
                  <span
                    style={{ fontFamily: '"Anton", sans-serif', ...NAME_STYLE }}
                    className="uppercase text-xl leading-none flex-1 truncate"
                  >
                    {p.name?.trim() || '…'}
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
                  {isHost && !isTheHost && (
                    <button
                      onClick={() => kickPlayer(p)}
                      aria-label={`Exclure ${p.name}`}
                      title={`Exclure ${p.name}`}
                      className="ml-0.5 -mr-1 flex items-center justify-center active:opacity-50"
                      style={{ color: fg }}
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
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

        {isHost && (
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
        )}

        {isHost && (
        <div className="mb-8">
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Timer par tour
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest mb-3 opacity-70"
          >
            {turnTimer > 0
              ? `${turnTimer}s pour jouer sa carte, sinon carte au hasard !`
              : 'Sans limite de temps'}
          </div>
          <div className="flex flex-wrap gap-2">
            {TIMER_OPTIONS.map((n) => {
              const selected = turnTimer === n;
              return (
                <button
                  key={n}
                  onClick={() => pickTurnTimer(n)}
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
                    {n === 0 ? 'Off' : `${n}s`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {isHost && (
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
            {sortedCategories.map((cat) => {
              // Pack premium non possede : tuile verrouillee (grisee, hachuree,
              // cadenas + pastille du pack). Tap → teaser d'achat (a venir).
              if (isLocked(cat)) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setTeaserPackId(cat.pack)}
                    style={{
                      backgroundColor: '#E9E9E9',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent 0 7px, rgba(0,0,0,0.05) 7px 14px)',
                      boxShadow: '2px 2px 0 #000',
                    }}
                    className="relative border-4 border-black px-3 py-3 text-left flex items-center gap-2.5 active:translate-x-[2px] active:translate-y-[2px]"
                  >
                    <span
                      style={{ backgroundColor: PINK }}
                      className="shrink-0 w-7 h-7 border-2 border-black flex items-center justify-center"
                    >
                      <Lock size={15} strokeWidth={3.5} color="#FFF" />
                    </span>
                    <span
                      style={{ fontFamily: '"Anton", sans-serif' }}
                      className="uppercase text-lg leading-none flex-1 truncate text-black/45"
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              }
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
          {lockedCount > 0 && (
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest mt-3 opacity-60 flex items-center gap-1.5"
            >
              <Lock size={12} strokeWidth={3} />
              {lockedCount} catégories verrouillées · Pack Ultra
            </div>
          )}
        </div>
        )}

        {isHost && (
        <div className="mb-8">
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase mb-1"
          >
            Sorts
          </div>
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest mb-3 opacity-70"
          >
            Pouvoirs spéciaux · 1 usage chacun par joueur
          </div>
          <div className="flex flex-col gap-3">
            {SORTS.map((s) => {
              const on = !!sorts[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSort(s.id)}
                  disabled={!isHost}
                  style={{
                    backgroundColor: on ? '#000' : '#FFF',
                    color: on ? '#FFF' : '#000',
                    boxShadow: on ? '4px 4px 0 #000' : '2px 2px 0 #000',
                    transition: 'all 100ms',
                    opacity: on ? 1 : 0.55,
                  }}
                  className="border-4 border-black px-3 py-3 text-left flex items-center gap-3 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed"
                >
                  <span className="text-2xl shrink-0">{s.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{ fontFamily: '"Anton", sans-serif' }}
                      className="uppercase text-lg leading-none"
                    >
                      {s.label}
                    </div>
                    <div
                      style={{ fontFamily: '"Space Mono", monospace' }}
                      className="text-[9px] uppercase tracking-widest opacity-70 mt-1"
                    >
                      {s.desc}
                    </div>
                  </div>
                  <div
                    className="shrink-0 border-2 px-2 py-1 text-[10px] uppercase tracking-widest"
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      borderColor: on ? YELLOW : '#000',
                      color: on ? YELLOW : '#000',
                    }}
                  >
                    {on ? 'ON' : 'OFF'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        <InstallButton variant="block" />
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 border-t-4 border-black"
        style={{ backgroundColor: baseColor }}
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
              {enoughPlayers && enoughCards && !allNamed && (
                <div
                  style={{ fontFamily: '"Space Mono", monospace' }}
                  className="text-[10px] uppercase tracking-widest mb-2 text-center"
                >
                  En attente que tout le monde entre son prénom
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

      {/* Teaser pack premium (tap sur une categorie verrouillee). En natif :
          achat reel (RevenueCat) ; sur web : "Dispo dans l'app". */}
      {teaserPackId && (() => {
        const pack = packById[teaserPackId];
        const packCats = allCategories.filter((c) => c.pack === teaserPackId);
        const packCardCount = playableCards.filter((c) =>
          packCats.some((pc) => pc.id === c.cat)
        ).length;
        const hasSpicy = packCats.some((c) => c.spicy);
        return (
          <div
            onClick={() => setTeaserPackId(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative border-4 border-black bg-white w-full max-w-sm p-6"
              style={{ boxShadow: '8px 8px 0 #000' }}
            >
              <button
                onClick={() => setTeaserPackId(null)}
                aria-label="Fermer"
                className="absolute top-3 right-3 active:opacity-50"
              >
                <X size={24} strokeWidth={3} />
              </button>
              <div
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-3xl uppercase leading-none mb-1 mt-1 text-center"
              >
                {pack?.label}
              </div>
              <div
                style={{ fontFamily: '"Space Mono", monospace' }}
                className="text-[10px] uppercase tracking-widest opacity-60 mb-4 text-center"
              >
                Pack premium · {packCats.length} catégorie
                {packCats.length > 1 ? 's' : ''} · {packCardCount} cartes
              </div>
              {hasSpicy && (
                <div
                  style={{
                    backgroundColor: PINK,
                    color: '#FFF',
                    boxShadow: '3px 3px 0 #000',
                  }}
                  className="border-2 border-black px-3 py-2 mb-4 flex items-center justify-center gap-2"
                >
                  <span className="text-lg leading-none">🌶️</span>
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="uppercase text-sm leading-tight"
                  >
                    Inclut le Coquin +18
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-5 justify-center">
                {packCats.map((c) => (
                  <span
                    key={c.id}
                    className="border-2 border-black px-2 py-1 flex items-center gap-1.5"
                    style={{ boxShadow: '2px 2px 0 #000' }}
                  >
                    <span className="text-base">{c.emoji}</span>
                    <span
                      style={{ fontFamily: '"Anton", sans-serif' }}
                      className="uppercase text-sm leading-none"
                    >
                      {c.label}
                    </span>
                  </span>
                ))}
              </div>
              <div className="border-t-2 border-black/10 pt-4 flex items-end justify-between gap-3">
                <p className="text-sm opacity-80 flex-1">
                  Si l'hôte a le pack, <b>tout le salon</b> en profite.
                </p>
                <div
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="text-3xl leading-none shrink-0"
                >
                  {prices[teaserPackId] || '4,99 €'}
                </div>
              </div>
              {billingAvailable ? (
                <button
                  onClick={() => buyPackFromTeaser(teaserPackId)}
                  disabled={shopBusy}
                  className="mt-5 w-full border-4 border-black bg-black text-white py-3 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
                  style={{ boxShadow: '4px 4px 0 #000' }}
                >
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="text-xl uppercase"
                  >
                    {shopBusy ? '…' : `Acheter ${prices[teaserPackId] || '4,99 €'}`}
                  </span>
                </button>
              ) : (
                <div className="mt-5">
                  <InstallCta onNavigate={() => setTeaserPackId(null)} />
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
