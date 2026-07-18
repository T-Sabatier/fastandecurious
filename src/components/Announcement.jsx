import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { subscribeAnnouncement } from '../announcement';
import { PINK } from '../cards';

// Pop-up d'annonce : affiché UNE fois par annonce (tant que l'id ne change pas).
// Piloté par /admin, poussé en direct à tous, sans mise à jour de l'app.
const SEEN_KEY = 'snaptap_announce_seen';

export default function Announcement() {
  const [ann, setAnn] = useState(null);
  const [seenId, setSeenId] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(SEEN_KEY) : null
  );

  useEffect(() => subscribeAnnouncement(setAnn), []);

  if (!ann || !ann.id || String(ann.id) === seenId) return null;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, String(ann.id));
    } catch {
      /* ignore */
    }
    setSeenId(String(ann.id));
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative border-4 border-black bg-white w-full max-w-sm p-6"
        style={{ boxShadow: '8px 8px 0 #000' }}
      >
        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute top-3 right-3 active:opacity-50"
        >
          <X size={24} strokeWidth={3} />
        </button>
        {ann.title && (
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-2xl uppercase leading-none mb-3 mt-1 pr-6"
          >
            {ann.title}
          </div>
        )}
        {ann.body && (
          <p className="text-sm whitespace-pre-line mb-5">{ann.body}</p>
        )}
        <button
          onClick={close}
          className="w-full border-4 border-black py-2 active:translate-x-[2px] active:translate-y-[2px]"
          style={{ backgroundColor: PINK, color: '#FFF', boxShadow: '4px 4px 0 #000' }}
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
  );
}
