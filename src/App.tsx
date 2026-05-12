import { useEffect, useState, useRef } from 'react';
import { useCharacterStore } from './store/characterStore';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { MapBoard } from './components/MapBoard';
import { AdventureDiary } from './components/AdventureDiary';
import { NotesPage } from './components/NotesPage';
import { CharacterSheet } from './components/CharacterSheet';
import { SkeletonCharacterCard, SkeletonSheet } from './components/Skeleton';
import { getUserCharacters, createCharacterWithDataDb, saveCharacterToDb, deleteCharacterDb, backfillCatalogClassIds } from './services/db';
import type { CharacterBase } from './types/dnd';
import { CharacterWizard } from './components/wizard/CharacterWizard';
import { GiSwordman, GiTreasureMap, GiCastle } from 'react-icons/gi';
import { FaBookOpen, FaGoogle, FaSignOutAlt, FaPlus, FaChevronLeft, FaCog, FaTrash, FaCommentDots } from 'react-icons/fa';
import { isEmailAllowed, isSuperAdmin, getInvite } from './services/admin';
import { BackOffice, type Section } from './components/backoffice/BackOffice';
import { MobileShell } from './components/mobile/MobileShell';
import { LanguageSwitcher } from './components/ui/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { FeedbackChat } from './components/FeedbackChat';
import { CampaignPage } from './components/campaign/CampaignPage';
import { CharacterCampaignPanel } from './components/campaign/CharacterCampaignPanel';
import { PlayerChatNotifier } from './components/campaign/PlayerChatNotifier';
import { CampaignGlossaryNotifier } from './components/campaign/CampaignGlossaryNotifier';
import { subscribeMasterCampaigns } from './services/campaign';
import type { Campaign } from './types/campaign';

type Tab = 'scheda' | 'note' | 'mappe' | 'feedback' | 'backoffice' | 'campagna';
type LandingTab = 'personaggi' | 'campagne';

function App() {
  const { t } = useTranslation();
  const { character, setCharacter } = useCharacterStore();
  const [activeTab, setActiveTab] = useState<Tab>('scheda');
  const [user, setUser] = useState<User | null>(null);
  const [userCharacters, setUserCharacters] = useState<CharacterBase[]>([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CharacterBase | null>(null);
  /** Sections allowed for this user from their Firestore invite (undefined = superAdmin = all). */
  const [userSections, setUserSections] = useState<Section[] | undefined>(undefined);
  /** Tab shown in the character-selection landing (characters vs campaigns). */
  const [landingTab, setLandingTab] = useState<LandingTab>('personaggi');
  /** Campaign opened full-screen from the inline list */
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  /** All campaigns for the current user (for inline list) */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [showCampaignCreate, setShowCampaignCreate] = useState(false);
  const [campaignCreateName, setCampaignCreateName] = useState('');
  const [campaignCreateDesc, setCampaignCreateDesc] = useState('');
  const [campaignCreating, setCampaignCreating] = useState(false);
  const [showLandingFeedback, setShowLandingFeedback] = useState(false);
  /** Unread campaign messages count (player side). */
  const [unreadCampaignCount, setUnreadCampaignCount] = useState(0);

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

  // ── Auth listener ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setAccessChecked(false);
        const allowed = await isEmailAllowed(u.email);
        setAccessAllowed(allowed);
        setAccessChecked(true);
        if (!allowed) {
          setLoadingChars(false);
          setUserCharacters([]);
          return;
        }
        // Load backoffice section permissions
        if (!isSuperAdmin(u.email)) {
          const inv = await getInvite(u.email);
          setUserSections(inv?.sections?.length ? (inv.sections as Section[]) : undefined);
        } else {
          setUserSections(undefined); // superAdmin sees everything
        }
        setLoadingChars(true);
        const chars = await getUserCharacters(u.uid);
        const migratedChars = await backfillCatalogClassIds(chars);
        setUserCharacters(migratedChars);
        setLoadingChars(false);
      } else {
        setAccessChecked(true);
        setAccessAllowed(false);
        setCharacter(null as any);
      }
    });
    return unsub;
  }, [setCharacter]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
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

  const handleCreateCharacter = () => {
    if (!user) return;
    setShowWizard(true);
  };

  const handleDeleteCharacter = async (char: CharacterBase) => {
    await deleteCharacterDb(char.id);
    setUserCharacters(prev => prev.filter(c => c.id !== char.id));
    if (character?.id === char.id) setCharacter(null as any);
    setConfirmDelete(null);
  };

  // ── Subscribe to master campaigns when on campagne tab ─────────
  useEffect(() => {
    if (!user || landingTab !== 'campagne') return;
    setCampaignsLoading(true);
    const unsub = subscribeMasterCampaigns(user.uid, (camps) => {
      setCampaigns(camps);
      setCampaignsLoading(false);
    });
    return () => { unsub(); setCampaignsLoading(false); };
  }, [user, landingTab]);

  const handleCampaignCreate = async () => {
    if (!user || !campaignCreateName.trim()) return;
    setCampaignCreating(true);
    try {
      const { createCampaign } = await import('./services/campaign');
      const c = await createCampaign(user.uid, user.email ?? '', user.displayName ?? '', campaignCreateName, campaignCreateDesc);
      setCampaignCreateName('');
      setCampaignCreateDesc('');
      setShowCampaignCreate(false);
      setSelectedCampaign(c);
    } finally { setCampaignCreating(false); }
  };

  const handleWizardComplete = async (charData: Omit<CharacterBase, 'id'>) => {
    setShowWizard(false);
    setLoadingChars(true);
    const c = await createCharacterWithDataDb(charData);
    setUserCharacters(prev => [...prev, c]);
    setLoadingChars(false);
    selectCharacter(c);
  };

  // ── ACCESS DENIED (non-invited user) ──────────────────
  if (user && accessChecked && !accessAllowed) {
    return (
      <div className="app-container centered">
        <div className="glass-panel animate-fade-in" style={{ width: 440, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
          <h1 className="text-gradient" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Accesso solo su invito</h1>
          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
            L'account <strong>{user.email}</strong> non è autorizzato.<br />
            Contatta l'amministratore per richiedere un invito.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <LanguageSwitcher />
          </div>
          <button className="btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={handleLogout}>
            <FaSignOutAlt /> {t('app.logout')}
          </button>
        </div>
      </div>
    );
  }

  // ── LOGIN SCREEN ───────────────────────────────────────
  if (!user) {
    return (
      <div className="app-container centered">
        <div className="glass-panel animate-fade-in" style={{ width: 400, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚔️</div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>D&D Nexus</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Gestisci le tue avventure.<br />Accesso solo su invito.</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <LanguageSwitcher />
          </div>
          <button className="btn-primary w-full" style={{ justifyContent: 'center', fontSize: '1rem', padding: '0.75rem 1.5rem' }} onClick={handleLogin}>
            <FaGoogle /> Accedi con Google
          </button>
        </div>
      </div>
    );
  }

  const superAdmin = isSuperAdmin(user.email);
  const hasBackofficeAccess = superAdmin || !!userSections;

  // ── BACKOFFICE-ONLY VIEW (no character required) ──────
  if (hasBackofficeAccess && activeTab === 'backoffice' && !character) {
    return (
      <div className="app-container animate-fade-in" style={{ flexDirection: 'column', background: 'var(--bg-base)' }}>
        <BackOffice
          currentUserEmail={user.email ?? ''}
          allowedSections={userSections}
          onBack={() => setActiveTab('scheda')}
        />
        <MobileShell
          appTab={activeTab}
          setAppTab={(id) => setActiveTab(id as Tab)}
          navItems={[{ id: 'backoffice' as Tab, label: 'Back-Office', icon: <FaCog size={16} /> }]}
          onSwitchCharacter={() => setActiveTab('scheda')}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // ── FULL-SCREEN FEEDBACK (from landing) ───────────────────────
  if (!character && showLandingFeedback && user) {
    return (
      <div className="app-container animate-fade-in" style={{ flexDirection: 'column', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'var(--bg-surface)' }}>
          <button className="btn-ghost text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setShowLandingFeedback(false)}>
            <FaChevronLeft size={12} /> Indietro
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', fontSize: '1rem' }}>Feedback</div>
          <div style={{ width: 80 }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FeedbackChat
            userId={user.uid}
            userEmail={user.email ?? ''}
            userDisplayName={user.displayName ?? user.email ?? ''}
          />
        </div>
      </div>
    );
  }

  // ── FULL-SCREEN CAMPAIGN MASTER VIEW (opened from inline list) ──
  if (!character && selectedCampaign && user) {
    return (
      <div className="app-container animate-fade-in" style={{ flexDirection: 'column', background: 'var(--bg-base)' }}>
        <CampaignPage
          userId={user.uid}
          userEmail={user.email ?? ''}
          userDisplayName={user.displayName ?? user.email ?? ''}
          initialCampaign={selectedCampaign}
          onBack={() => setSelectedCampaign(null)}
        />
      </div>
    );
  }

  if (!character) {
    return (
      <>
        <div className="app-container centered">
          <div className="glass-panel animate-fade-in flex-col gap-4" style={{ width: 520 }}>
            <div style={{ textAlign: 'center' }}>
              <h1 className="text-gradient" style={{ fontSize: '2rem' }}>D&D Nexus</h1>
              <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>Benvenuto, {user.displayName}</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                <LanguageSwitcher compact />
              </div>
            </div>

            <div className="divider" />

            {/* ── Landing tab switcher ── */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.25rem' }}>
              <button
                className={`btn-ghost w-full ${landingTab === 'personaggi' ? 'active' : ''}`}
                style={{ justifyContent: 'center', flex: 1, ...(landingTab === 'personaggi' ? { background: 'rgba(201,168,76,0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(201,168,76,0.3)' } : {}) }}
                onClick={() => setLandingTab('personaggi')}
              >
                <GiSwordman size={14} /> Personaggi
              </button>
              <button
                className={`btn-ghost w-full ${landingTab === 'campagne' ? 'active' : ''}`}
                style={{ justifyContent: 'center', flex: 1, ...(landingTab === 'campagne' ? { background: 'rgba(201,168,76,0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(201,168,76,0.3)' } : {}) }}
                onClick={() => setLandingTab('campagne')}
              >
                <GiCastle size={14} /> Campagne
              </button>
            </div>

            <div>
              {/* ── Section header ── */}
              {landingTab === 'personaggi' && (
                <>
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
                      <div key={c.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                        <button className="btn-secondary w-full" style={{ justifyContent: 'space-between', padding: '0.9rem 1.2rem', borderRadius: 'var(--radius-sm)', flex: 1 }} onClick={() => selectCharacter(c)}>
                          <div className="flex items-center gap-3">
                            <div style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: c.avatarUrl ? `center/cover no-repeat url(${c.avatarUrl})` : 'rgba(201,168,76,0.15)',
                              border: '1px solid rgba(201,168,76,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: 'var(--font-heading)',
                              color: 'var(--accent-gold)',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}>
                              {!c.avatarUrl && c.name.charAt(0)}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{c.name}</div>
                              <div className="text-xs text-muted">{c.race} {c.characterClass} — Lv. {c.level}</div>
                            </div>
                          </div>
                          <span className="text-muted" style={{ fontSize: '1.2rem' }}>›</span>
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ color: 'var(--accent-crimson)', padding: '0 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(192,57,43,0.25)', flexShrink: 0 }}
                          title={`Elimina ${c.name}`}
                          onClick={() => setConfirmDelete(c)}>
                          <FaTrash size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Campagne inline list ── */}
              {landingTab === 'campagne' && (
                <>
                  <div className="section-header">
                    <span className="section-title">Le Tue Campagne</span>
                    <button className="btn-primary text-xs" onClick={() => setShowCampaignCreate(v => !v)}>
                      <FaPlus /> Nuova
                    </button>
                  </div>

                  {/* Inline create form */}
                  {showCampaignCreate && (
                    <div className="flex-col gap-2" style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(201,168,76,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(201,168,76,0.15)' }}>
                      <input
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.45rem 0.7rem', fontSize: '0.88rem', fontFamily: 'inherit', width: '100%' }}
                        placeholder="Nome campagna *"
                        value={campaignCreateName}
                        onChange={e => setCampaignCreateName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCampaignCreate()}
                        autoFocus
                      />
                      <input
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '0.45rem 0.7rem', fontSize: '0.85rem', fontFamily: 'inherit', width: '100%' }}
                        placeholder="Descrizione (opzionale)"
                        value={campaignCreateDesc}
                        onChange={e => setCampaignCreateDesc(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }} onClick={() => { setShowCampaignCreate(false); setCampaignCreateName(''); setCampaignCreateDesc(''); }}>Annulla</button>
                        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }} onClick={handleCampaignCreate} disabled={!campaignCreateName.trim() || campaignCreating}>
                          {campaignCreating ? 'Creazione…' : 'Crea'}
                        </button>
                      </div>
                    </div>
                  )}

                  {campaignsLoading && (
                    <div className="flex-col gap-2">
                      {Array.from({ length: 2 }).map((_, i) => <SkeletonCharacterCard key={i} />)}
                    </div>
                  )}

                  {!campaignsLoading && campaigns.length === 0 && !showCampaignCreate && (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <p className="text-muted" style={{ marginBottom: '1rem' }}>Nessuna campagna ancora.</p>
                      <button className="btn-primary" onClick={() => setShowCampaignCreate(true)}><FaPlus /> Crea la tua prima campagna</button>
                    </div>
                  )}

                  <div className="flex-col gap-2">
                    {campaigns.map(c => {
                      const playerCount = Object.keys(c.playerCharacters ?? {}).length;
                      return (
                        <button key={c.id} className="btn-secondary w-full" style={{ justifyContent: 'space-between', padding: '0.9rem 1.2rem', borderRadius: 'var(--radius-sm)' }} onClick={() => setSelectedCampaign(c)}>
                          <div className="flex items-center gap-3">
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)', flexShrink: 0 }}>
                              <GiCastle size={18} />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{c.name}</div>
                              <div className="text-xs text-muted">{playerCount} giocator{playerCount === 1 ? 'e' : 'i'} · <code style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', opacity: 0.7 }}>{c.inviteCode}</code></div>
                            </div>
                          </div>
                          <span className="text-muted" style={{ fontSize: '1.2rem' }}>›</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="divider" />
            {superAdmin && (
              <button className="btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => setActiveTab('backoffice')}>
                <FaCog /> Back-Office
              </button>
            )}
            {!superAdmin && (
              <button className="btn-ghost text-sm w-full" style={{ justifyContent: 'center', color: 'var(--text-muted)' }} onClick={() => setShowLandingFeedback(true)}>
                <FaCommentDots /> Feedback
              </button>
            )}
            <button className="btn-ghost text-sm" style={{ justifyContent: 'center', color: 'var(--accent-crimson)' }} onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* ── CHARACTER CREATION WIZARD ── */}
        {showWizard && user && (
          <CharacterWizard
            userId={user.uid}
            onComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        )}

        {/* ── CONFIRM DELETE DIALOG ── */}
        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: 380, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)', marginBottom: '0.5rem', fontSize: '1.2rem' }}>Elimina Personaggio</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Sei sicuro di voler eliminare <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong>?
              </p>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.78rem' }}>
                Tutti i dati del personaggio (scheda, diario, talenti, abilità) verranno rimossi in modo definitivo e irreversibile.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => setConfirmDelete(null)}>
                  Annulla
                </button>
                <button
                  className="btn-primary w-full"
                  style={{ justifyContent: 'center', background: 'var(--accent-crimson)', borderColor: 'var(--accent-crimson)' }}
                  onClick={() => handleDeleteCharacter(confirmDelete)}>
                  <FaTrash size={11} /> Elimina
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── MAIN APP ───────────────────────────────────────────
  const navItems: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'scheda', label: 'Scheda', icon: <GiSwordman size={18} /> },
    { id: 'note', label: 'Note & Glossario', icon: <FaBookOpen size={16} /> },
    { id: 'mappe', label: 'Mappe', icon: <GiTreasureMap size={18} /> },
    { id: 'campagna', label: 'Campagna', icon: <GiCastle size={17} />, badge: unreadCampaignCount || undefined },
    ...(!superAdmin ? [{ id: 'feedback' as Tab, label: 'Feedback', icon: <FaCommentDots size={15} /> }] : []),
    ...(hasBackofficeAccess ? [{ id: 'backoffice' as Tab, label: 'Back-Office', icon: <FaCog size={16} /> }] : []),
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
              {!!item.badge && <span className="nav-badge">{item.badge > 9 ? '9+' : item.badge}</span>}
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
        {activeTab === 'note' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
            <NotesPage />
          </div>
        )}
        {activeTab === 'mappe' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="animate-fade-in">
            <MapBoard />
          </div>
        )}
        {activeTab === 'backoffice' && hasBackofficeAccess && (
          <BackOffice currentUserEmail={user.email ?? ''} allowedSections={userSections} onBack={() => setActiveTab('scheda')} />
        )}
        {activeTab === 'campagna' && user && (
          <CharacterCampaignPanel
            userId={user.uid}
            userDisplayName={user.displayName ?? user.email ?? ''}
          />
        )}
        {activeTab === 'feedback' && !superAdmin && user && (
          <FeedbackChat
            userId={user.uid}
            userEmail={user.email ?? ''}
            userDisplayName={user.displayName ?? user.email ?? ''}
          />
        )}
      </main>

      {/* ── MOBILE / TABLET BOTTOM SHELL ── */}
      <MobileShell
        appTab={activeTab}
        setAppTab={(id) => setActiveTab(id as Tab)}
        navItems={navItems}
        onSwitchCharacter={() => setCharacter(null as any)}
        onLogout={handleLogout}
      />

      {/* ── ALWAYS-ON: player chat notification listener ── */}
      {user && (
        <PlayerChatNotifier
          isCampaignTabActive={activeTab === 'campagna'}
          onNavigateToCampaign={() => setActiveTab('campagna')}
          onUnreadCountChange={setUnreadCampaignCount}
        />
      )}

      {/* ── ALWAYS-ON: campaign glossary popup notifier ── */}
      {user && <CampaignGlossaryNotifier />}
    </div>
  );
}

export default App;
