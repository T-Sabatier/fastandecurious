import { useState, useEffect, useMemo } from 'react';
import { YELLOW, PINK, PACKS } from '../cards';
import {
  subscribeCards,
  seedDefaultsIfEmpty,
  addCard,
  updateCard,
  deleteCard,
  getStaleDefaults,
  purgeStaleDefaults,
} from '../cardsStore';
import {
  subscribeCategories,
  seedCategoriesIfEmpty,
  addCategory,
  deleteCategory,
  setCategoryPack,
} from '../categoriesStore';
import { Lock, Plus, Pencil, Trash2, Check, X, ArrowLeft } from 'lucide-react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';

// L'acces admin passe par Firebase Auth (email/mot de passe) : la verification
// est faite COTE SERVEUR par les regles de securite (voir database.rules.json,
// noeud /admin). Un simple code cote client serait lisible dans le bundle JS.
export default function Admin() {
  const [user, setUser] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Les joueurs sont connectes anonymement : seul un compte email = admin.
  const unlocked = user && !user.isAnonymous;

  async function handleLogin() {
    if (!auth) {
      setAuthError('Auth Firebase indisponible (clé API invalide ?)');
      return;
    }
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('Email et mot de passe requis');
      return;
    }
    setBusy(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
    } catch (e) {
      setAuthError(
        e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
          ? 'Identifiants incorrects'
          : `Connexion impossible (${e.code || e.message})`
      );
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked) {
    return (
      <LockScreen
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        codeError={authError}
        busy={busy}
        onSubmit={handleLogin}
      />
    );
  }

  return <Dashboard onLogout={() => signOut(auth)} />;
}

function LockScreen({
  emailInput,
  setEmailInput,
  passwordInput,
  setPasswordInput,
  codeError,
  busy,
  onSubmit,
}) {
  return (
    <div style={{ backgroundColor: YELLOW, minHeight: '100vh' }} className="text-black">
      <div className="max-w-md mx-auto px-5 py-10">
        <button
          onClick={() => (window.location.href = '/')}
          className="flex items-center gap-1.5 mb-8"
        >
          <ArrowLeft size={18} />
          <span
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] uppercase tracking-widest"
          >
            Retour au jeu
          </span>
        </button>

        <div className="mb-8">
          <div
            style={{ fontFamily: '"Space Mono", monospace' }}
            className="text-[10px] tracking-[0.3em] mb-2 uppercase"
          >
            ▸ Zone admin
          </div>
          <h1
            style={{
              fontFamily: '"Anton", sans-serif',
              lineHeight: 0.82,
              letterSpacing: '-0.02em',
            }}
            className="text-6xl uppercase"
          >
            Cartes<br />Admin
          </h1>
        </div>

        <div
          className="border-4 border-black bg-white p-5"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Lock size={18} />
            <span
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest"
            >
              Connexion admin
            </span>
          </div>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="admin@email.com"
            autoComplete="username"
            className="w-full border-4 border-black bg-white px-3 py-3 outline-none text-lg mb-3"
            style={{ boxShadow: '4px 4px 0 #000' }}
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full border-4 border-black bg-white px-3 py-3 outline-none text-lg mb-3"
            style={{ boxShadow: '4px 4px 0 #000' }}
          />
          <button
            onClick={onSubmit}
            disabled={busy}
            className="w-full border-4 border-black bg-black text-white py-3 active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-60"
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            <span style={{ fontFamily: '"Anton", sans-serif' }} className="text-xl uppercase">
              {busy ? 'Connexion…' : 'Entrer'}
            </span>
          </button>
          {codeError && (
            <div className="mt-3 text-sm border-2 border-black bg-white px-2 py-1">
              ⚠️ {codeError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newSpicy, setNewSpicy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editSpicy, setEditSpicy] = useState(false);
  const [busy, setBusy] = useState(false);

  // Categories CRUD state
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [newCatSpicy, setNewCatSpicy] = useState(false);
  const [catsExpanded, setCatsExpanded] = useState(false);

  useEffect(() => {
    // Seed puis purge automatique : supprime (avec tombstone) les cartes par
    // defaut obsoletes — anciennes versions renommees/deplacees que de vieux
    // clients en cache pourraient avoir re-seedees. Silencieux et idempotent.
    seedDefaultsIfEmpty()
      .then(() => getStaleDefaults())
      .then((stale) => {
        if (stale.length > 0) {
          console.log(`[admin] purge de ${stale.length} carte(s) obsolete(s)`, stale.map((s) => `${s.t} (${s.cat})`));
          return purgeStaleDefaults(stale);
        }
        return 0;
      })
      .catch(() => {});
    seedCategoriesIfEmpty().catch(() => {});
    const unsubCards = subscribeCards(setCards);
    const unsubCats = subscribeCategories(setCategories);
    return () => {
      unsubCards();
      unsubCats();
    };
  }, []);

  useEffect(() => {
    if (!newCat && categories.length > 0) {
      setNewCat(categories[0].id);
    }
  }, [categories, newCat]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return cards
      .filter((c) => filterCat === 'all' || c.cat === filterCat)
      .filter((c) => !s || (c.t || '').toLowerCase().includes(s))
      .sort((a, b) => (a.cat + a.t).localeCompare(b.cat + b.t));
  }, [cards, filterCat, search]);

  const countByCat = useMemo(() => {
    const m = {};
    cards.forEach((c) => {
      m[c.cat] = (m[c.cat] || 0) + 1;
    });
    return m;
  }, [cards]);

  async function handleAdd() {
    const t = newText.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await addCard({ t, cat: newCat, spicy: newSpicy });
      setNewText('');
      setNewSpicy(false);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(card) {
    setEditingId(card.id);
    setEditText(card.t);
    setEditCat(card.cat);
    setEditSpicy(!!card.spicy);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
    setEditCat('');
    setEditSpicy(false);
  }

  async function saveEdit() {
    const t = editText.trim();
    if (!t || !editingId || busy) return;
    setBusy(true);
    try {
      await updateCard(editingId, { t, cat: editCat, spicy: editSpicy });
      cancelEdit();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (busy) return;
    if (!confirm('Supprimer cette carte ?')) return;
    setBusy(true);
    try {
      await deleteCard(id);
    } finally {
      setBusy(false);
    }
  }

  function slugifyCatId(s) {
    return (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 20);
  }

  async function handleAddCat() {
    const label = newCatLabel.trim();
    const emoji = newCatEmoji.trim();
    if (!label || !emoji || busy) return;
    const id = slugifyCatId(label);
    if (!id) {
      alert('Nom invalide');
      return;
    }
    if (categories.some((c) => c.id === id)) {
      alert('Une categorie avec ce nom existe deja');
      return;
    }
    setBusy(true);
    try {
      await addCategory({ id, label, emoji, spicy: newCatSpicy });
      setNewCatLabel('');
      setNewCatEmoji('');
      setNewCatSpicy(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCat(cat) {
    const n = countByCat[cat.id] || 0;
    const msg =
      n > 0
        ? `Supprimer "${cat.label}" ? ${n} carte(s) lie(es) deviendront orphelines (toujours en base, plus selectionnables).`
        : `Supprimer la categorie "${cat.label}" ?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteCategory(cat.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ backgroundColor: YELLOW, minHeight: '100vh' }} className="text-black">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => (window.location.href = '/')}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft size={18} />
            <span
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest"
            >
              Retour au jeu
            </span>
          </button>
          <div className="flex items-center gap-3">
            <div
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-2xl uppercase"
            >
              Admin · Cartes
            </div>
            <button
              onClick={onLogout}
              title="Se déconnecter"
              className="border-2 border-black bg-white px-2 py-1"
              style={{
                fontFamily: '"Space Mono", monospace',
                boxShadow: '2px 2px 0 #000',
              }}
            >
              <span className="text-[10px] uppercase tracking-widest">Sortir</span>
            </button>
          </div>
          <div className="w-14" />
        </div>

        <div
          className="border-4 border-black bg-white p-4 mb-6"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <button
            onClick={() => setCatsExpanded((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <div
              style={{ fontFamily: '"Anton", sans-serif' }}
              className="text-xl uppercase"
            >
              Catégories ({categories.length})
            </div>
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest"
            >
              {catsExpanded ? '− Replier' : '+ Gérer'}
            </div>
          </button>
          {catsExpanded && (
            <div className="mt-4">
              <div className="space-y-2 mb-4">
                {categories.map((c) => {
                  const n = countByCat[c.id] || 0;
                  return (
                    <div
                      key={c.id}
                      className="border-2 border-black bg-white px-3 py-2 flex items-center gap-2"
                      style={{ boxShadow: '3px 3px 0 #000' }}
                    >
                      <span className="text-xl">{c.emoji}</span>
                      <span
                        style={{ fontFamily: '"Anton", sans-serif' }}
                        className="uppercase flex-1"
                      >
                        {c.label}
                      </span>
                      <span
                        style={{
                          backgroundColor: c.spicy ? PINK : '#000',
                          color: c.spicy ? '#FFF' : YELLOW,
                          fontFamily: '"Space Mono", monospace',
                        }}
                        className="text-[10px] uppercase tracking-widest px-1.5 py-0.5"
                      >
                        {n} cart{n > 1 ? 'es' : 'e'}
                      </span>
                      <select
                        value={c.pack || ''}
                        onChange={(e) => setCategoryPack(c.id, e.target.value || null)}
                        disabled={busy}
                        title="Pack premium (vide = gratuite)"
                        style={{ fontFamily: '"Space Mono", monospace' }}
                        className="border-2 border-black bg-white text-[10px] uppercase px-1 py-1 max-w-[110px]"
                      >
                        <option value="">Gratuit</option>
                        {PACKS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.emoji} {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDeleteCat(c)}
                        disabled={busy}
                        className="border-2 border-black bg-black text-white p-1.5 active:opacity-60"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div
                style={{ fontFamily: '"Anton", sans-serif' }}
                className="text-base uppercase mb-2"
              >
                Nouvelle catégorie
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <input
                  value={newCatEmoji}
                  onChange={(e) => setNewCatEmoji(e.target.value)}
                  placeholder="🎯"
                  maxLength={4}
                  className="w-16 border-4 border-black bg-white px-2 py-2 outline-none text-center text-xl"
                  style={{ boxShadow: '3px 3px 0 #000' }}
                />
                <input
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="Nom (ex: Politique)"
                  maxLength={30}
                  className="flex-1 min-w-[140px] border-4 border-black bg-white px-3 py-2 outline-none"
                  style={{ boxShadow: '3px 3px 0 #000' }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 mb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCatSpicy}
                    onChange={(e) => setNewCatSpicy(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span
                    style={{ fontFamily: '"Space Mono", monospace' }}
                    className="text-xs uppercase tracking-widest"
                  >
                    🌶️ Spicy
                  </span>
                </label>
                <button
                  onClick={handleAddCat}
                  disabled={!newCatLabel.trim() || !newCatEmoji.trim() || busy}
                  className="border-4 border-black bg-black text-white px-3 py-2 disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] flex items-center gap-2"
                  style={{ boxShadow: '3px 3px 0 #000' }}
                >
                  <Plus size={16} />
                  <span
                    style={{ fontFamily: '"Anton", sans-serif' }}
                    className="uppercase text-sm"
                  >
                    Ajouter
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="border-4 border-black bg-white p-4 mb-6"
          style={{ boxShadow: '6px 6px 0 #000' }}
        >
          <div
            style={{ fontFamily: '"Anton", sans-serif' }}
            className="text-xl uppercase mb-3"
          >
            Ajouter une carte
          </div>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Texte de la carte"
            maxLength={50}
            className="w-full border-4 border-black bg-white px-3 py-2 outline-none mb-3"
            style={{ boxShadow: '3px 3px 0 #000' }}
          />
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              className="border-4 border-black bg-white px-2 py-2"
              style={{ boxShadow: '3px 3px 0 #000', fontFamily: '"Anton", sans-serif' }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newSpicy}
                onChange={(e) => setNewSpicy(e.target.checked)}
                className="w-5 h-5"
              />
              <span style={{ fontFamily: '"Space Mono", monospace' }} className="text-xs uppercase tracking-widest">
                🌶️ Spicy
              </span>
            </label>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newText.trim() || busy}
            className="border-4 border-black bg-black text-white px-4 py-2 disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] flex items-center gap-2"
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            <Plus size={18} />
            <span style={{ fontFamily: '"Anton", sans-serif' }} className="uppercase">
              Ajouter
            </span>
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 min-w-[120px] border-4 border-black bg-white px-3 py-2 outline-none"
            style={{ boxShadow: '3px 3px 0 #000' }}
          />
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="border-4 border-black bg-white px-2 py-2"
            style={{ boxShadow: '3px 3px 0 #000', fontFamily: '"Anton", sans-serif' }}
          >
            <option value="all">Toutes ({cards.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label} ({countByCat[c.id] || 0})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 pb-10">
          {filtered.length === 0 && (
            <div
              style={{ fontFamily: '"Space Mono", monospace' }}
              className="text-[10px] uppercase tracking-widest opacity-60 text-center py-6"
            >
              Aucune carte
            </div>
          )}
          {filtered.map((c) => {
            const isEditing = editingId === c.id;
            const cat = categories.find((x) => x.id === c.cat);
            if (isEditing) {
              return (
                <div
                  key={c.id}
                  className="border-4 border-black bg-white p-3"
                  style={{ boxShadow: '4px 4px 0 #000' }}
                >
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={50}
                    className="w-full border-2 border-black bg-white px-2 py-1 outline-none mb-2"
                  />
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <select
                      value={editCat}
                      onChange={(e) => setEditCat(e.target.value)}
                      className="border-2 border-black bg-white px-2 py-1"
                      style={{ fontFamily: '"Anton", sans-serif' }}
                    >
                      {categories.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.emoji} {x.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSpicy}
                        onChange={(e) => setEditSpicy(e.target.checked)}
                        className="w-5 h-5"
                      />
                      <span style={{ fontFamily: '"Space Mono", monospace' }} className="text-xs uppercase tracking-widest">
                        🌶️ Spicy
                      </span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={busy || !editText.trim()}
                      className="border-2 border-black bg-black text-white px-3 py-1 disabled:opacity-40 flex items-center gap-1"
                    >
                      <Check size={16} />
                      <span style={{ fontFamily: '"Anton", sans-serif' }} className="uppercase text-sm">
                        Enregistrer
                      </span>
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="border-2 border-black bg-white px-3 py-1 flex items-center gap-1"
                    >
                      <X size={16} />
                      <span style={{ fontFamily: '"Anton", sans-serif' }} className="uppercase text-sm">
                        Annuler
                      </span>
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className="border-2 border-black bg-white px-3 py-2 flex items-center gap-3"
                style={{ boxShadow: '3px 3px 0 #000' }}
              >
                <span
                  style={{
                    backgroundColor: c.spicy ? PINK : '#000',
                    color: c.spicy ? '#FFF' : YELLOW,
                    fontFamily: '"Space Mono", monospace',
                  }}
                  className="text-[9px] uppercase tracking-widest px-1.5 py-0.5"
                >
                  {cat?.emoji} {cat?.label || c.cat}
                </span>
                <span
                  style={{ fontFamily: '"Anton", sans-serif' }}
                  className="uppercase flex-1 leading-tight"
                >
                  {c.t}
                </span>
                <button
                  onClick={() => startEdit(c)}
                  disabled={busy}
                  className="border-2 border-black bg-white p-1.5 active:opacity-60"
                  aria-label="Modifier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={busy}
                  className="border-2 border-black bg-black text-white p-1.5 active:opacity-60"
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
