import { useState, useEffect } from 'react';
import { ref, set, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import Home from './Home.jsx';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';

// ============================================================
// MODE DEBUG (dev only) — visualiser chaque ecran sans monter
// une vraie partie. Le debug cree une VRAIE room "DEBG" dans
// Firebase et s'y abonne → tous les sorts (reroll, x2, charges)
// fonctionnent pour de vrai, en solo. La room est re-seedee a
// chaque changement de scenario et supprimee en quittant.
// ============================================================

const POOL = {
  // g = regle a boire (Mode Apero). c1 = collective, c3 = defi (@).
  c1: { t: 'Dua Lipa', cat: 'musique', spicy: false, g: "Ceux qui l'ont dans une playlist boivent 2" },
  c2: { t: 'Tokyo', cat: 'voyages', spicy: false },
  c3: { t: 'Guêpe à l\'apéro', cat: 'nature', spicy: false, g: '@Chasse une guêpe imaginaire ou bois 2' },
  c4: { t: 'Raclette', cat: 'bouffe', spicy: false },
  c5: { t: 'Pizza ananas', cat: 'bouffe', spicy: false, g: 'Team ananas boit 1, les puristes boivent 2' },
  c6: { t: 'Appeler ton ex', cat: 'bourre', spicy: false },
  c7: { t: 'Chaussettes-claquettes', cat: 'mode', spicy: false },
  c8: { t: 'Sushis', cat: 'bouffe', spicy: false },
  c9: { t: 'New York', cat: 'voyages', spicy: false },
  c10: { t: 'Messi', cat: 'sport', spicy: false },
  c11: { t: 'Tacos', cat: 'bouffe', spicy: false },
  c12: { t: 'Zelda', cat: 'gaming', spicy: false },
  c13: { t: 'Plage déserte', cat: 'voyages', spicy: false },
  c14: { t: 'Café noir', cat: 'bouffe', spicy: false },
  c15: { t: 'Basket', cat: 'sport', spicy: false },
  c16: { t: 'Bali', cat: 'voyages', spicy: false },
  c17: { t: 'Burger', cat: 'bouffe', spicy: false },
  c18: { t: 'Tennis', cat: 'sport', spicy: false },
  c19: { t: 'Glace choco', cat: 'bouffe', spicy: false },
  c20: { t: 'Islande', cat: 'voyages', spicy: false },
};

const MY_HAND = { c1: true, c2: true, c3: true, c4: true, c5: true, c6: true, c7: true };
const MY_HAND_AFTER_PLAY = { c2: true, c3: true, c4: true, c6: true, c7: true };
// Pioche : cartes qui ne sont ni en main ni posees → de quoi reroller.
const DECK = ['c8', 'c9', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18'];

const PLAYERS = {
  me: { name: 'Tim', score: 2, color: 'yellow', joinedAt: 1 },
  alex: { name: 'Thor', score: 3, color: 'blue', joinedAt: 2 },
  sam: { name: 'Chloé', score: 1, color: 'green', joinedAt: 3 },
  jo: { name: 'Adi', score: 4, color: 'violet', joinedAt: 4 },
  gui: { name: 'Guillaume', score: 2, color: 'orange', joinedAt: 5 },
};

const SCENARIOS = [
  { key: 'home', label: 'Accueil' },
  { key: 'lobby-host', label: 'Salon · host' },
  { key: 'lobby-guest', label: 'Salon · joueur' },
  { key: 'boss_choose-boss', label: 'Annonce · boss' },
  { key: 'boss_choose-wait', label: 'Annonce · attente' },
  { key: 'play-hand', label: '⭐ Poser sa carte' },
  { key: 'play-waited', label: 'Carte posée · attente' },
  { key: 'play-boss', label: 'En jeu · boss' },
  { key: 'reveal-boss', label: 'Choix · boss' },
  { key: 'reveal-guest', label: 'Choix · joueur' },
  { key: 'result', label: 'Résultat' },
  { key: 'result-defi', label: 'Résultat · défi' },
  { key: 'game_over', label: 'Fin de partie' },
];

const noop = () => {};

function buildScenario(key, mode, pick, apero, special, sorts) {
  const base = {
    host: null,
    round: 3,
    pool: POOL,
    deck: DECK,
    discard: [],
    special: special || null,
    settings: {
      winningScore: 5,
      cats: {},
      sorts: sorts
        ? { reroll: true, espion: true, vatout: true }
        : { reroll: false, espion: false, vatout: false },
      ...(apero ? { partyMode: true } : {}),
    },
    players: PLAYERS,
  };
  switch (key) {
    case 'home':
      return { kind: 'home' };
    case 'lobby-host':
      return { kind: 'lobby', room: { ...base, phase: 'lobby', host: 'me' } };
    case 'lobby-guest':
      return { kind: 'lobby', room: { ...base, phase: 'lobby', host: 'alex' } };
    case 'boss_choose-boss':
      return { kind: 'game', room: { ...base, phase: 'boss_choose', bossId: 'me' } };
    case 'boss_choose-wait':
      return { kind: 'game', room: { ...base, phase: 'boss_choose', bossId: 'alex' } };
    case 'play-hand':
      return { kind: 'game', room: { ...base, phase: 'play', bossId: 'alex', mode, hands: { me: MY_HAND }, played: { sam: 'c19' } } };
    case 'play-waited':
      return { kind: 'game', room: { ...base, phase: 'play', bossId: 'alex', mode, hands: { me: MY_HAND_AFTER_PLAY }, played: { me: 'c1', sam: 'c19' } } };
    case 'play-boss':
      return { kind: 'game', room: { ...base, phase: 'play', bossId: 'me', mode, played: { sam: 'c19', jo: 'c20' } } };
    case 'reveal-boss':
      return { kind: 'game', room: { ...base, phase: 'reveal', bossId: 'me', mode, played: { alex: 'c19', sam: 'c20', jo: 'c5' }, bossPick: pick ? 'c19' : null } };
    case 'reveal-guest':
      return { kind: 'game', room: { ...base, phase: 'reveal', bossId: 'alex', mode, hands: { me: MY_HAND_AFTER_PLAY }, played: { me: 'c1', sam: 'c20', jo: 'c5' }, bossPick: pick ? 'c20' : null } };
    case 'result':
      // Carte gagnante c5 = Pizza ananas (regle collective fun). Gagnant != boss.
      return { kind: 'game', room: { ...base, host: 'me', phase: 'result', bossId: 'alex', mode, played: { me: 'c1', sam: 'c20', jo: 'c5' }, winnerInfo: { playerId: 'jo', cardId: 'c5' } } };
    case 'result-defi':
      // Carte gagnante c3 (defi @) → roulette de designation (hors boss/gagnant).
      return { kind: 'game', room: { ...base, host: 'me', phase: 'result', bossId: 'alex', mode, played: { me: 'c1', sam: 'c20', jo: 'c3' }, winnerInfo: { playerId: 'jo', cardId: 'c3' } } };
    case 'game_over':
      return { kind: 'game', room: { ...base, host: 'me', phase: 'game_over', bossId: 'jo' } };
    default:
      return { kind: 'home' };
  }
}

export default function Debug() {
  const [key, setKey] = useState('play-hand');
  const [mode, setMode] = useState('like');
  const [pick, setPick] = useState(false);
  const [apero, setApero] = useState(false);
  const [special, setSpecial] = useState(null); // null | 'double' | 'chrono' | 'swap'
  const [sorts, setSorts] = useState(true);
  const [capturing, setCapturing] = useState(false); // masque la barre pour screener
  const [liveRoom, setLiveRoom] = useState(null);

  const scenario = buildScenario(key, mode, pick, apero, special, sorts);
  const SPECIAL_CYCLE = [null, 'double', 'chrono', 'swap'];

  // Abonnement permanent a la room debug
  useEffect(() => {
    const r = ref(db, 'rooms/DEBG');
    const unsub = onValue(r, (snap) => setLiveRoom(snap.val()));
    return () => {
      unsub();
      remove(r).catch(() => {});
    };
  }, []);

  // (Re)seed la room a chaque changement de scenario / mode / choix boss / options
  useEffect(() => {
    const sc = buildScenario(key, mode, pick, apero, special, sorts);
    if (sc.kind === 'home') {
      setLiveRoom(null);
      remove(ref(db, 'rooms/DEBG')).catch(() => {});
      return;
    }
    setLiveRoom(sc.room); // optimiste, evite le flash
    set(ref(db, 'rooms/DEBG'), sc.room).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mode, pick, apero, special, sorts]);

  function renderScreen() {
    if (scenario.kind === 'home') {
      return <Home playerId="me" onJoin={noop} />;
    }
    const room = liveRoom || scenario.room;
    if (scenario.kind === 'lobby') {
      return <Lobby room={room} roomCode="DEBG" playerId="me" onLeave={noop} />;
    }
    return <Game room={room} roomCode="DEBG" playerId="me" onLeave={noop} />;
  }

  const isGamePhase = !['home', 'lobby-host', 'lobby-guest'].includes(key);
  const isReveal = key.startsWith('reveal');

  // Mode capture : la barre disparait 5 s pour un screenshot propre.
  function startCapture() {
    setCapturing(true);
    setTimeout(() => setCapturing(false), 5000);
  }

  // Pendant la capture : uniquement l'ecran, plein, sans rien de debug.
  if (capturing) {
    return <div>{renderScreen()}</div>;
  }

  return (
    <div>
      {/* Barre de controle debug — fixe en haut */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-black text-white border-b-4 border-white">
        <div className="flex items-center gap-2 px-2 py-1.5 overflow-x-auto">
          <a
            href="/"
            className="shrink-0 px-2 py-1 border-2 border-white text-[11px] uppercase"
            style={{ fontFamily: '"Space Mono", monospace' }}
            title="Quitter le debug"
          >
            ✕
          </a>
          <span
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-sm uppercase text-yellow-300 shrink-0"
          >
            🐛 Debug
          </span>
          <button
            onClick={startCapture}
            className="shrink-0 px-2 py-1 border-2 border-yellow-300 text-yellow-300 text-[11px] uppercase"
            style={{ fontFamily: '"Space Mono", monospace' }}
            title="Masque la barre 5 s pour screenshoter"
          >
            📷 Capturer
          </button>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => setKey(s.key)}
              className="shrink-0 px-2 py-1 border-2 text-[11px] uppercase whitespace-nowrap"
              style={{
                fontFamily: '"Space Mono", monospace',
                backgroundColor: key === s.key ? '#FFE600' : 'transparent',
                color: key === s.key ? '#000' : '#FFF',
                borderColor: key === s.key ? '#FFE600' : '#555',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {isGamePhase && (
          <div className="flex items-center gap-2 px-2 pb-1.5 overflow-x-auto">
            <button
              onClick={() => setMode(mode === 'like' ? 'dislike' : 'like')}
              className="shrink-0 px-2 py-1 border-2 border-white text-[11px] uppercase"
              style={{ fontFamily: '"Space Mono", monospace' }}
            >
              Mode : {mode === 'like' ? "J'aime" : "J'aime pas"}
            </button>
            <button
              onClick={() => setApero((a) => !a)}
              className="shrink-0 px-2 py-1 border-2 text-[11px] uppercase"
              style={{
                fontFamily: '"Space Mono", monospace',
                backgroundColor: apero ? '#FBB417' : 'transparent',
                color: apero ? '#000' : '#FFF',
                borderColor: apero ? '#FBB417' : '#FFF',
              }}
            >
              🍻 Apéro : {apero ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() =>
                setSpecial(
                  SPECIAL_CYCLE[(SPECIAL_CYCLE.indexOf(special) + 1) % SPECIAL_CYCLE.length]
                )
              }
              className="shrink-0 px-2 py-1 border-2 text-[11px] uppercase"
              style={{
                fontFamily: '"Space Mono", monospace',
                backgroundColor: special ? '#FFE600' : 'transparent',
                color: special ? '#000' : '#FFF',
                borderColor: special ? '#FFE600' : '#FFF',
              }}
            >
              ⚡ Spécial : {special || 'off'}
            </button>
            <button
              onClick={() => setSorts((s) => !s)}
              className="shrink-0 px-2 py-1 border-2 text-[11px] uppercase"
              style={{
                fontFamily: '"Space Mono", monospace',
                backgroundColor: sorts ? '#FFF' : 'transparent',
                color: sorts ? '#000' : '#FFF',
                borderColor: '#FFF',
              }}
            >
              Sorts : {sorts ? 'ON' : 'OFF'}
            </button>
            {isReveal && (
              <button
                onClick={() => setPick(!pick)}
                className="shrink-0 px-2 py-1 border-2 text-[11px] uppercase"
                style={{
                  fontFamily: '"Space Mono", monospace',
                  backgroundColor: pick ? '#FF2D6F' : 'transparent',
                  borderColor: pick ? '#FF2D6F' : '#FFF',
                }}
              >
                Choix boss : {pick ? 'oui' : 'non'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ecran rendu, decale sous la barre */}
      <div style={{ paddingTop: isGamePhase ? '5.5rem' : '3rem' }}>
        {renderScreen()}
      </div>
    </div>
  );
}
