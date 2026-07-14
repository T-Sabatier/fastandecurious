// URL publique du jeu (QR codes, liens de partage depuis l'app native).
// www est le domaine de production Vercel (l'apex snaptapparty.com redirige).
export const PUBLIC_URL = 'https://www.snaptapparty.com';

// Style "sticker" des pseudos : blanc + contour noir, IDENTIQUE pour tous
// les joueurs et lisible sur n'importe quelle couleur de fond.
export const NAME_STYLE = {
  color: '#FFF',
  WebkitTextStroke: '0.12em #000',
  paintOrder: 'stroke fill',
  // Anton est tres condensee : un peu d'air entre les lettres, d'autant que
  // le contour noir grignote l'espace inter-lettres.
  letterSpacing: '0.09em',
};

// Duree de vie max d'une room (lobby OU partie en cours). Au-dela, la room est
// consideree comme abandonnee et supprimee — meme en pleine partie.
export const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // 4h

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Avoid confusing characters (I, O, 0, 1)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

export function getOrCreatePlayerId() {
  let id = localStorage.getItem('fc_playerId');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem('fc_playerId', id);
  }
  return id;
}

export function getStoredName() {
  return localStorage.getItem('fc_playerName') || '';
}

export function setStoredName(name) {
  localStorage.setItem('fc_playerName', name);
}

export function getStoredRoom() {
  return localStorage.getItem('fc_currentRoom') || null;
}

export function setStoredRoom(code) {
  if (code) localStorage.setItem('fc_currentRoom', code);
  else localStorage.removeItem('fc_currentRoom');
}

export function fitCard(text) {
  const len = text.length;
  if (len < 8) return '1.9rem';
  if (len < 14) return '1.5rem';
  if (len < 20) return '1.15rem';
  if (len < 28) return '0.95rem';
  return '0.82rem';
}

export function fitBig(text) {
  const len = text.length;
  if (len < 10) return '3.5rem';
  if (len < 16) return '2.6rem';
  if (len < 24) return '1.8rem';
  return '1.3rem';
}

// Safely convert a Firebase array/object into an array
export function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((x) => x != null);
  return Object.values(val).filter((x) => x != null);
}
