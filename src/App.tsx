import { useEffect, useState, useRef } from 'react';
import { useCharacterStore } from './store/characterStore';
import { auth, googleProvider } from './firebase';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { MapBoard } from './components/MapBoard';
import { AdventureDiary } from './components/AdventureDiary';
import { CharacterSheet } from './components/CharacterSheet';
import { SkeletonCharacterCard, SkeletonSheet } from './components/Skeleton';
import { getUserCharacters, createNewCharacterDb, saveCharacterToDb } from './services/db';
import type { CharacterBase } from './types/dnd';
import { GiSwordman, GiTreasureMap } from 'react-icons/gi';
import { FaBookOpen, FaGoogle, FaSignOutAlt, FaPlus, FaChevronLeft } from 'react-icons/fa';

type Tab = 'scheda' | 'diario' | 'mappe';

function App() {
  const { character, setCharacter } = useCharacterStore();
  const [activeTab, setActiveTab] = useState<Tab>('scheda');
  const [user, setUser] = useState<User | null>(null);
  const [userCharacters, setUserCharacters] = useState<CharacterBase[]>([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Auto-save ──────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCharRef = useRef<typeof character>(null);

  useEffect(() => {
    if (!character) {
      prevCharRef.current = null;
      return;
    }
    const prev = prevCharRef.current;
    prevCharRef.current = character;

    // Skip initial load and character switches — only save actual edits
    if (!prev || prev.id !== character.id) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCharacterToDb(character);
    }, 1500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [character]);

  // ── Save on page close ────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const char = useCharacterStore.getState().character;
      if (char) saveCharacterToDb(char);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Handle redirect result after Google login ────────
  useEffect(() => {
    setLoginLoading(true);
    getRedirectResult(auth)
      .then(result => {
        // result is null if no redirect happened, non-null on return from Google
        if (result?.user) {
          // onAuthStateChanged will handle setting the user
        }
      })
      .catch(err => console.error('Redirect result error', err))
      .finally(() => setLoginLoading(false));
  }, []);

  // ── Auth listener ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setLoadingChars(true);
        const chars = await getUserCharacters(u.uid);
        setUserCharacters(chars);
        setLoadingChars(false);
      } else {
        setCharacter(null as any);
      }
    });
    return unsub;
  }, [setCharacter]);

  const handleLogin = async () => {
    try { await signInWithRedirect(auth, googleProvider); }
    catch (e) { console.error('Login error', e); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCharacter(null as any);
    setUserCharacters([]);
  };

  const selectCharacter = (char: CharacterBase) => {
    setCharacter(char);
  };

  const handleCreateCharacter = async () => {
    if (!user) return;
    const name = prompt('Nome del personaggio:');
    if (!name?.trim()) return;
    setLoadingChars(true);
    const c = await createNewCharacterDb(user.uid, name.trim());
    setUserCharacters(prev => [...prev, c]);
    setLoadingChars(false);
    selectCharacter(c);
  };

  // ── LOGIN SCREEN ───────────────────────────────────────
  if (!user) {
    return (
      <div className="app-container centered">
        <div className="glass-panel animate-fade-in" style={{ width: 400, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚔️</div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>D&D Nexus</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Gestisci le tue avventure.<br />Accedi per iniziare.</p>
          <button className="btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '0.75rem 1.5rem' }} onClick={handleLogin} disabled={loginLoading}>
            <FaGoogle /> {loginLoading ? 'Caricamento…' : 'Accedi con Google'}
          </button>
        </div>
      </div>
    );
  }

  // ── CHARACTER SELECTION ────────────────────────────────
  if (!character) {
    return (
      <div className="app-container centered">
        <div className="glass-panel animate-fade-in flex-col gap-4" style={{ width: 520 }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="text-gradient" style={{ fontSize: '2rem' }}>D&D Nexus</h1>
            <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>Benvenuto, {user.displayName}</p>
          </div>

          <div className="divider" />

          <div>
            <div className="section-header">
              <span className="section-title">I Tuoi Avventurieri</span>
              <button className="btn-primary text-xs" onClick={handleCreateCharacter}><FaPlus /> Nuovo</button>
            </div>

            {loadingChars && (
              <div className="flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCharacterCard key={i} />
                ))}
              </div>
            )}

            {!loadingChars && userCharacters.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p className="text-muted" style={{ marginBottom: '1rem' }}>Nessun personaggio trovato.</p>
                <button className="btn-primary" onClick={handleCreateCharacter}><FaPlus /> Crea il tuo primo eroe</button>
              </div>
            )}

            <div className="flex-col gap-2">
              {userCharacters.map(c => (
                <button key={c.id} className="btn-secondary w-full" style={{ justifyContent: 'space-between', padding: '0.9rem 1.2rem', borderRadius: 'var(--radius-sm)' }} onClick={() => selectCharacter(c)}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>
                      {c.name.charAt(0)}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{c.name}</div>
                      <div className="text-xs text-muted">{c.race} {c.characterClass} — Lv. {c.level}</div>
                    </div>
                  </div>
                  <span className="text-muted" style={{ fontSize: '1.2rem' }}>›</span>
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />
          <button className="btn-ghost text-sm" style={{ justifyContent: 'center', color: 'var(--accent-crimson)' }} onClick={handleLogout}>
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN APP ───────────────────────────────────────────
  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'scheda', label: 'Scheda', icon: <GiSwordman size={18} /> },
    { id: 'diario', label: 'Diario & NPC', icon: <FaBookOpen size={16} /> },
    { id: 'mappe', label: 'Mappe', icon: <GiTreasureMap size={18} /> },
  ];

  return (
    <div className="app-container">
      {/* ── SIDEBAR (desktop only) ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ padding: '0.5rem 0 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>⚔️</div>
          <div className="text-gradient font-heading" style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}>D&D NEXUS</div>
        </div>

        {/* Character mini card */}
        <div className="card flex items-center gap-2" style={{ padding: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', fontSize: '1rem', flexShrink: 0 }}>
            {character.name.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="font-heading text-sm" style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{character.name}</div>
            <div className="text-xs text-muted">Lv. {character.level} {character.characterClass}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-col gap-1">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="flex-col gap-2" style={{ marginTop: 'auto' }}>
          <div className="divider" />
          <button className="nav-item" onClick={() => setCharacter(null as any)}>
            <FaChevronLeft size={14} /> Cambia Personaggio
          </button>
          <button className="nav-item" style={{ color: 'var(--accent-crimson)' }} onClick={handleLogout}>
            <FaSignOutAlt size={14} /> Logout
          </button>
          <div className="text-xs text-muted text-center" style={{ padding: '0.25rem 0' }}>
            {user.displayName}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {activeTab === 'scheda' && <CharacterSheet />}
        {activeTab === 'diario' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }} className="animate-fade-in">
            <div className="flex-col gap-4">
              <div className="section-header">
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Diario & NPC</h2>
              </div>
              <AdventureDiary />
            </div>
          </div>
        )}
        {activeTab === 'mappe' && (
          <div style={{ flex: 1, overflow: 'hidden', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
            <div className="section-header" style={{ flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Mappe Tattiche</h2>
              <span className="text-muted text-sm">Disegna il tuo dungeon</span>
            </div>
            <MapBoard />
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button className="mobile-nav-item" onClick={() => setCharacter(null as any)}>
          <FaChevronLeft size={16} />
          <span>Cambia</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
