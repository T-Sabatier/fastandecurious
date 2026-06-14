import { useState } from 'react';
import Home from './Home.jsx';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';

// ============================================================
// MODE DEBUG (dev only) — visualiser chaque ecran sans recreer
// de partie. Donnees 100% bidon, aucune ecriture Firebase tant
// qu'on ne clique pas sur les boutons d'action du jeu.
// ============================================================

const POOL = {
  c1: { t: 'Pizza', cat: 'bouffe', spicy: false },
  c2: { t: 'Tokyo', cat: 'voyages', spicy: false },
  c3: { t: 'Mbappé', cat: 'sport', spicy: false },
  c4: { t: 'Nutella', cat: 'bouffe', spicy: false },
  c5: { t: 'Lingerie noire fine', cat: 'coquin', spicy: true },
  c6: { t: 'Mario Kart', cat: 'gaming', spicy: false },
  c7: { t: 'Coucher de soleil', cat: 'nature', spicy: false },
};

const PLAYERS = {
  me: { name: 'Toi', score: 2, color: 'yellow', joinedAt: 1 },
  alex: { name: 'Alex', score: 3, color: 'blue', joinedAt: 2 },
  sam: { name: 'Sam', score: 1, color: 'green', joinedAt: 3 },
  jo: { name: 'Jo', score: 4, color: 'violet', joinedAt: 4 },
};

const MY_HAND = { c1: true, c2: true, c3: true, c4: true, c6: true, c7: true };

const SCENARIOS = [
  { key: 'home', label: 'Accueil' },
  { key: 'lobby-host', label: 'Salon · host' },
  { key: 'lobby-guest', label: 'Salon · joueur' },
  { key: 'boss_choose-boss', label: 'Annonce · boss' },
  { key: 'boss_choose-wait', label: 'Annonce · attente' },
  { key: 'play-hand', label: 'Poser sa carte' },
  { key: 'play-waited', label: 'Carte posée · attente' },
  { key: 'play-boss', label: 'En jeu · boss' },
  { key: 'reveal-boss', label: 'Choix · boss' },
  { key: 'reveal-guest', label: '⭐ Choix · joueur' },
  { key: 'result', label: 'Résultat' },
  { key: 'game_over', label: 'Fin de partie' },
];

const noop = () => {};

export default function Debug() {
  const [key, setKey] = useState('reveal-guest');
  const [mode, setMode] = useState('like');
  const [pick, setPick] = useState(false);

  const base = {
    host: null,
    round: 3,
    pool: POOL,
    deck: [],
    discard: [],
    settings: {
      winningScore: 5,
      cats: {},
      sorts: { reroll: true, espion: true, vatout: true },
    },
    players: PLAYERS,
  };

  const g = (room) => (
    <Game room={room} roomCode="DEBG" playerId="me" onLeave={noop} />
  );

  function render() {
    switch (key) {
      case 'home':
        return <Home playerId="me" onJoin={noop} />;
      case 'lobby-host':
        return <Lobby room={{ ...base, phase: 'lobby', host: 'me' }} roomCode="DEBG" playerId="me" onLeave={noop} />;
      case 'lobby-guest':
        return <Lobby room={{ ...base, phase: 'lobby', host: 'alex' }} roomCode="DEBG" playerId="me" onLeave={noop} />;
      case 'boss_choose-boss':
        return g({ ...base, phase: 'boss_choose', bossId: 'me' });
      case 'boss_choose-wait':
        return g({ ...base, phase: 'boss_choose', bossId: 'alex' });
      case 'play-hand':
        return g({ ...base, phase: 'play', bossId: 'alex', mode, hands: { me: MY_HAND }, played: { sam: 'c3' } });
      case 'play-waited':
        return g({ ...base, phase: 'play', bossId: 'alex', mode, hands: { me: {} }, played: { me: 'c1', sam: 'c3' } });
      case 'play-boss':
        return g({ ...base, phase: 'play', bossId: 'me', mode, played: { sam: 'c3', jo: 'c5' } });
      case 'reveal-boss':
        return g({ ...base, phase: 'reveal', bossId: 'me', mode, played: { alex: 'c2', sam: 'c3', jo: 'c5' }, bossPick: pick ? 'c2' : null });
      case 'reveal-guest':
        return g({ ...base, phase: 'reveal', bossId: 'alex', mode, played: { me: 'c1', sam: 'c3', jo: 'c5' }, bossPick: pick ? 'c3' : null });
      case 'result':
        return g({ ...base, host: 'me', phase: 'result', bossId: 'alex', mode, played: { me: 'c1', sam: 'c3', jo: 'c5' }, winnerInfo: { playerId: 'jo', cardId: 'c5' } });
      case 'game_over':
        return g({ ...base, host: 'me', phase: 'game_over', bossId: 'jo' });
      default:
        return null;
    }
  }

  const isGamePhase = !['home', 'lobby-host', 'lobby-guest'].includes(key);
  const isReveal = key.startsWith('reveal');

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
          <div className="flex items-center gap-2 px-2 pb-1.5">
            <button
              onClick={() => setMode(mode === 'like' ? 'dislike' : 'like')}
              className="shrink-0 px-2 py-1 border-2 border-white text-[11px] uppercase"
              style={{ fontFamily: '"Space Mono", monospace' }}
            >
              Mode : {mode === 'like' ? "J'aime" : "J'aime pas"}
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
        {render()}
      </div>
    </div>
  );
}
