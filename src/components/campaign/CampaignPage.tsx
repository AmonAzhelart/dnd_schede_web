import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FaCopy, FaCheck, FaComments, FaPaperPlane, FaUsers, FaTrash,
    FaSearch, FaTimes, FaChevronLeft, FaShieldAlt, FaHeart, FaBolt,
    FaBoxOpen, FaStar, FaStickyNote, FaCog, FaPlus, FaMinus, FaSkull,
} from 'react-icons/fa';
import { GiCastle, GiSwordman, GiSpellBook, GiSkills, GiCrossedSwords } from 'react-icons/gi';
import {
    createCampaign,
    deleteCampaign,
    saveMasterNotes,
    sendCampaignMessage,
    subscribeMasterCampaigns,
    subscribeToPlayerChat,
    subscribeToCampaign,
} from '../../services/campaign';
import { subscribeToCharacter } from '../../services/db';
import type { Campaign, CampaignMessage, MasterNote } from '../../types/campaign';
import type { CharacterBase } from '../../types/dnd';
import {
    StatsTab, SkillsTab, InventoryTab, SpellsTab, FeatsTab,
} from './MasterCharacterViewer';
import { useChatToast } from '../../contexts/chatToastContext';
import {
    computeEffectiveStat, computeTotalBab, computeTotalMaxHp,
} from '../../services/characterCompute';
import './CampaignPage.css';

type MasterView = 'loading' | 'list' | 'create' | 'master';
type DetailTab = 'chat' | 'stats' | 'skills' | 'inventory' | 'spells' | 'feats';
type MasterSection = 'players' | 'notes' | 'initiative' | 'info';

interface InitCombatant {
    id: string;
    name: string;
    initiative: number;
    currentHp: number;
    maxHp: number;
    isPlayer: boolean;
    playerId?: string;
    conditions: string[];
}

const DND_CONDITIONS = [
    'Accecato', 'Assordato', 'Confuso', 'Esausto',
    'Grapple', 'Inebetito', 'Nauseato', 'Paralizzato',
    'Paura', 'Prono', 'Rallentato', 'Scosso',
    'Spaventato', 'Stordito', 'Veleno',
];

interface Props {
    userId: string;
    userEmail: string;
    userDisplayName: string;
    /** If provided, skip list and open this campaign directly in master view */
    initialCampaign?: Campaign;
    /** Called when user clicks back-to-list (only when initialCampaign is provided) */
    onBack?: () => void;
}

function formatNoteDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    } catch { return ''; }
}

// ─────────────────────── Highlight helper ────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="chat-search-mark">{part}</mark>
                    : part
            )}
        </>
    );
}

// ─────────────────────── Chat panel (shared, exported) ───────────────────────

export interface CampaignChatPanelProps {
    campaignId: string;
    playerId: string;
    from: 'player' | 'master';
    fromName: string;
    messages?: CampaignMessage[];
}

export function CampaignChatPanel({ campaignId, playerId, from, fromName, messages: externalMessages }: CampaignChatPanelProps) {
    const [localMessages, setLocalMessages] = useState<CampaignMessage[]>([]);
    const [pendingMsgs, setPendingMsgs] = useState<CampaignMessage[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (externalMessages !== undefined) return;
        return subscribeToPlayerChat(campaignId, playerId, setLocalMessages);
    }, [campaignId, playerId, externalMessages]);

    const serverMessages = externalMessages ?? localMessages;
    const allMessages: CampaignMessage[] = [
        ...serverMessages,
        ...pendingMsgs.filter(p => !serverMessages.some(m => m.text === p.text && m.from === p.from)),
    ];

    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return allMessages;
        const q = searchQuery.toLowerCase();
        return allMessages.filter(m => m.text.toLowerCase().includes(q));
    }, [allMessages, searchQuery]);

    // Scroll to bottom only when not searching
    useEffect(() => {
        if (!searchQuery) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [allMessages.length, searchQuery]);

    async function handleSend() {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setText('');
        setSending(true);
        const pendId = `__pend_${Date.now()}`;
        const optMsg: CampaignMessage = { id: pendId, text: trimmed, from, fromName, timestamp: null as any };
        setPendingMsgs(prev => [...prev, optMsg]);
        try {
            await sendCampaignMessage(campaignId, playerId, trimmed, from, fromName);
        } finally {
            setSending(false);
            setTimeout(() => setPendingMsgs(prev => prev.filter(m => m.id !== pendId)), 500);
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }

    function toggleSearch() {
        setSearchOpen(v => {
            if (v) setSearchQuery('');
            else setTimeout(() => searchInputRef.current?.focus(), 50);
            return !v;
        });
    }

    return (
        <div className="cc-chat">
            {/* Toolbar */}
            <div className="cc-chat-toolbar">
                {searchOpen ? (
                    <div className="cc-search-bar">
                        <FaSearch size={12} className="cc-search-icon" />
                        <input
                            ref={searchInputRef}
                            className="cc-search-input"
                            placeholder="Cerca nei messaggi…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <span className="cc-search-count">
                                {filteredMessages.length} risultat{filteredMessages.length === 1 ? 'o' : 'i'}
                            </span>
                        )}
                        <button className="cc-search-close" onClick={toggleSearch}><FaTimes size={11} /></button>
                    </div>
                ) : (
                    <div className="cc-chat-toolbar-right">
                        <span className="cc-chat-count">{allMessages.length} messaggi</span>
                        <button className="cc-icon-btn" onClick={toggleSearch} title="Cerca nei messaggi">
                            <FaSearch size={13} />
                        </button>
                    </div>
                )}
            </div>

            {/* Messages */}
            <div className="cc-messages">
                {filteredMessages.length === 0 && (
                    <p className="campaign-chat-empty">
                        {searchQuery ? 'Nessun messaggio corrisponde alla ricerca.' : 'Nessun messaggio ancora. Inizia la conversazione!'}
                    </p>
                )}
                {filteredMessages.map(msg => {
                    const isPending = msg.id.startsWith('__pend_');
                    return (
                        <div key={msg.id} className={`campaign-chat-bubble ${msg.from === from ? 'is-me' : 'is-other'} ${isPending ? 'is-pending' : ''}`}>
                            {msg.from !== from && (
                                <span className="campaign-chat-sender">{msg.fromName}</span>
                            )}
                            <span className="campaign-chat-text">
                                <HighlightText text={msg.text} query={searchQuery} />
                            </span>
                            <span className="campaign-chat-ts">
                                {isPending ? '…' : msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="campaign-chat-input-row">
                <textarea
                    className="campaign-chat-textarea"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Scrivi un messaggio… (Invio per inviare)"
                    rows={2}
                    disabled={sending}
                />
                <button
                    className="campaign-chat-send-btn"
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    aria-label="Invia"
                >
                    <FaPaperPlane />
                </button>
            </div>
        </div>
    );
}

// ─────────────────────── Player list item ────────────────────────────────────

function PlayerListItem({
    uid, info, char, unread, selected, onClick,
}: {
    uid: string;
    info: { characterName: string; playerName: string };
    char?: CharacterBase;
    unread: number;
    selected: boolean;
    onClick: () => void;
}) {
    const currentHp = char?.hpDetails?.current ?? char?.baseStats?.hp ?? 0;
    const maxHp = char ? (char.hpDetails?.max ?? computeTotalMaxHp(char)) : 0;
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const hpColor = hpPct > 0.5 ? '#4caf7d' : hpPct > 0.25 ? '#f0c040' : 'var(--accent-crimson)';

    return (
        <button className={`md-player-item ${selected ? 'selected' : ''}`} onClick={onClick}>
            <div className="campaign-char-avatar">
                {char?.avatarUrl
                    ? <img src={char.avatarUrl} alt={info.characterName} />
                    : info.characterName.charAt(0)
                }
            </div>
            <div className="md-player-info">
                <div className="md-player-char">{info.characterName}</div>
                <div className="md-player-name">{info.playerName}</div>
                {char && (
                    <div className="md-player-sub">{char.race} {char.characterClass} — Lv.{char.level}</div>
                )}
                {char && maxHp > 0 && (
                    <div className="md-hp-bar-wrap">
                        <div className="md-hp-bar" style={{ width: `${hpPct * 100}%`, background: hpColor }} />
                        <span className="md-hp-label">{currentHp}/{maxHp}</span>
                    </div>
                )}
            </div>
            {unread > 0 && (
                <span className="campaign-unread-badge md-badge">{unread > 9 ? '9+' : unread}</span>
            )}
        </button>
    );
}

// ─────────────────────── Detail panel ────────────────────────────────────────

function DetailPanel({
    uid, info, char, messages, campaignId, masterName, unread,
    onMarkRead, tab, onTabChange,
}: {
    uid: string;
    info: { characterName: string; playerName: string };
    char?: CharacterBase;
    messages: CampaignMessage[];
    campaignId: string;
    masterName: string;
    unread: number;
    onMarkRead: () => void;
    tab: DetailTab;
    onTabChange: (t: DetailTab) => void;
}) {
    // Auto-mark chat as read when on chat tab
    useEffect(() => {
        if (tab === 'chat') onMarkRead();
    }, [tab, messages.length]);

    const ac = char ? computeEffectiveStat(char, 'ac') : null;
    const bab = char ? computeTotalBab(char) : null;
    const currentHp = char?.hpDetails?.current ?? char?.baseStats?.hp ?? 0;
    const maxHp = char ? (char.hpDetails?.max ?? computeTotalMaxHp(char)) : 0;
    const totalTempHp = char
        ? (char.hpDetails?.tempHp ?? 0) + (char.activeModifiers ?? []).filter(m => !m.paused && m.target === 'hp' && m.value > 0).reduce((s, m) => s + m.value, 0)
        : 0;
    const initiative = char ? computeEffectiveStat(char, 'initiative') : null;

    function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

    return (
        <div className="md-detail">
            {/* Detail header */}
            <div className="md-detail-header">
                <div className="campaign-char-avatar" style={{ width: 44, height: 44, fontSize: '1.2rem' }}>
                    {char?.avatarUrl
                        ? <img src={char.avatarUrl} alt={info.characterName} />
                        : info.characterName.charAt(0)
                    }
                </div>
                <div className="md-detail-title">
                    <h3>{info.characterName}</h3>
                    <div className="md-detail-sub">{info.playerName}</div>
                    {char && (
                        <div className="md-detail-sub">{char.race} {char.characterClass} — Lv. {char.level}</div>
                    )}
                </div>

                {/* Quick stats */}
                {char && (
                    <div className="md-quick-stats">
                        <div className="md-qs-item" style={{ color: currentHp <= 0 ? 'var(--accent-crimson)' : undefined }}>
                            <FaHeart size={10} style={{ color: 'var(--accent-crimson)' }} />
                            <span>{currentHp}/{maxHp}</span>
                        </div>
                        {totalTempHp > 0 && (
                            <div className="md-qs-item" style={{ borderColor: 'rgba(100,200,255,0.4)', background: 'rgba(100,200,255,0.08)', color: '#7fdbff' }}>
                                <FaHeart size={10} style={{ color: '#7fdbff' }} />
                                <span>+{totalTempHp}</span>
                            </div>
                        )}
                        <div className="md-qs-item">
                            <FaShieldAlt size={10} style={{ color: 'var(--accent-ice, #7fdbff)' }} />
                            <span>{ac}</span>
                        </div>
                        <div className="md-qs-item">
                            <GiSwordman size={12} style={{ color: 'var(--accent-gold)' }} />
                            <span>{bab != null && bab >= 0 ? `+${bab}` : bab}</span>
                        </div>
                        <div className="md-qs-item">
                            <FaBolt size={10} style={{ color: '#fdcb6e' }} />
                            <span>{initiative != null ? fmt(initiative) : '—'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="md-tabs">
                <button className={`md-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => onTabChange('chat')}>
                    <FaComments size={13} />
                    Chat
                    {unread > 0 && tab !== 'chat' && (
                        <span className="campaign-unread-badge md-tab-badge">{unread > 9 ? '9+' : unread}</span>
                    )}
                </button>
                {char && (<>
                    <button className={`md-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => onTabChange('stats')}>
                        <GiSwordman size={14} /> Statistiche
                    </button>
                    <button className={`md-tab ${tab === 'skills' ? 'active' : ''}`} onClick={() => onTabChange('skills')}>
                        <GiSkills size={14} /> Competenze
                    </button>
                    <button className={`md-tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => onTabChange('inventory')}>
                        <FaBoxOpen size={12} /> Inventario
                    </button>
                    <button className={`md-tab ${tab === 'spells' ? 'active' : ''}`} onClick={() => onTabChange('spells')}>
                        <GiSpellBook size={14} /> Magie
                    </button>
                    <button className={`md-tab ${tab === 'feats' ? 'active' : ''}`} onClick={() => onTabChange('feats')}>
                        <FaStar size={12} /> Talenti
                    </button>
                </>)}
            </div>

            {/* Tab content */}
            <div className="md-tab-content">
                {tab === 'chat' && (
                    <CampaignChatPanel
                        campaignId={campaignId}
                        playerId={uid}
                        from="master"
                        fromName={masterName}
                        messages={messages}
                    />
                )}
                {tab !== 'chat' && char && (
                    <div className="md-sheet-wrap" style={{ padding: '0.75rem 1rem' }}>
                        {tab === 'stats'     && <StatsTab char={char} />}
                        {tab === 'skills'    && <SkillsTab char={char} />}
                        {tab === 'inventory' && <InventoryTab char={char} />}
                        {tab === 'spells'    && <SpellsTab char={char} />}
                        {tab === 'feats'     && <FeatsTab char={char} />}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────── Notes panel ─────────────────────────────────────────

function NotesPanel({ campaign, campaignId }: { campaign: Campaign; campaignId: string }) {
    const [notes, setNotes] = useState<MasterNote[]>(campaign.masterNotes ?? []);
    const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
    const saveTimer = useRef<ReturnType<typeof setTimeout>>();

    // Sync if campaign.masterNotes changes externally (real-time subscription)
    useEffect(() => {
        setNotes(n => {
            const incoming = campaign.masterNotes ?? [];
            if (JSON.stringify(incoming) === JSON.stringify(n)) return n;
            return incoming;
        });
    }, [campaign.masterNotes]);

    const selectedNote = notes.find(n => n.id === selectedId) ?? null;

    function scheduleAutoSave(updated: MasterNote[]) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveMasterNotes(campaignId, updated), 1500);
    }

    function addNote() {
        const n: MasterNote = {
            id: crypto.randomUUID(),
            title: '',
            content: '',
            updatedAt: new Date().toISOString(),
        };
        const updated = [n, ...notes];
        setNotes(updated);
        setSelectedId(n.id);
        scheduleAutoSave(updated);
    }

    function updateNote(id: string, patch: Partial<MasterNote>) {
        const updated = notes.map(n =>
            n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
        );
        setNotes(updated);
        scheduleAutoSave(updated);
    }

    function deleteNote(id: string) {
        const updated = notes.filter(n => n.id !== id);
        setNotes(updated);
        if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
        scheduleAutoSave(updated);
    }

    return (
        <div className="notes-panel">
            <div className="notes-sidebar">
                <div className="notes-sidebar-header">
                    <span className="notes-sidebar-title"><FaStickyNote size={12} /> Note DM</span>
                    <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={addNote}>
                        <FaPlus size={10} /> Nuova
                    </button>
                </div>
                <div className="notes-list">
                    {notes.length === 0 && (
                        <div className="notes-empty-list">Nessuna nota. Creane una!</div>
                    )}
                    {notes.map(n => (
                        <button
                            key={n.id}
                            className={`notes-list-item ${n.id === selectedId ? 'selected' : ''}`}
                            onClick={() => setSelectedId(n.id)}
                        >
                            <span className="notes-item-title">{n.title || '(senza titolo)'}</span>
                            <span className="notes-item-date">{formatNoteDate(n.updatedAt)}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="notes-editor">
                {selectedNote ? (
                    <>
                        <div className="notes-editor-top">
                            <input
                                className="notes-title-input"
                                value={selectedNote.title}
                                onChange={e => updateNote(selectedNote.id, { title: e.target.value })}
                                placeholder="Titolo nota…"
                            />
                            <button
                                className="btn-ghost"
                                style={{ padding: '0.25rem 0.5rem', color: 'var(--accent-crimson)', flexShrink: 0 }}
                                onClick={() => deleteNote(selectedNote.id)}
                                title="Elimina nota"
                            >
                                <FaTrash size={11} />
                            </button>
                        </div>
                        <textarea
                            className="notes-content"
                            value={selectedNote.content}
                            onChange={e => updateNote(selectedNote.id, { content: e.target.value })}
                            placeholder="Scrivi le tue note di campagna, appunti su NPC, trame segrete…"
                        />
                    </>
                ) : (
                    <div className="notes-empty-editor">
                        <FaStickyNote size={32} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '0.75rem' }} />
                        <p className="text-muted text-sm">Seleziona una nota o creane una nuova.</p>
                        <button className="btn-primary" onClick={addNote}>
                            <FaPlus size={11} /> Nuova Nota
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────── Initiative tracker ───────────────────────────────────

function InitiativeTracker({
    linkedChars, playerCharacters,
}: {
    linkedChars: Record<string, CharacterBase>;
    playerCharacters: Campaign['playerCharacters'];
}) {
    const [combatants, setCombatants] = useState<InitCombatant[]>([]);
    const [round, setRound] = useState(1);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [addName, setAddName] = useState('');
    const [addInit, setAddInit] = useState('');
    const [addHp, setAddHp] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [showCondMenu, setShowCondMenu] = useState<string | null>(null);

    const sorted = useMemo(
        () => [...combatants].sort((a, b) => b.initiative - a.initiative),
        [combatants],
    );

    const currentId = sorted[currentIdx % Math.max(sorted.length, 1)]?.id;

    function nextTurn() {
        if (sorted.length === 0) return;
        const next = (currentIdx + 1) % sorted.length;
        if (next === 0) setRound(r => r + 1);
        setCurrentIdx(next);
    }

    function prevTurn() {
        if (sorted.length === 0) return;
        const prev = currentIdx === 0 ? sorted.length - 1 : currentIdx - 1;
        if (currentIdx === 0) setRound(r => Math.max(1, r - 1));
        setCurrentIdx(prev);
    }

    function resetCombat() {
        setCombatants([]);
        setRound(1);
        setCurrentIdx(0);
    }

    function addCombatant() {
        if (!addName.trim()) return;
        const entry: InitCombatant = {
            id: crypto.randomUUID(),
            name: addName.trim(),
            initiative: parseInt(addInit) || 0,
            currentHp: parseInt(addHp) || 10,
            maxHp: parseInt(addHp) || 10,
            isPlayer: false,
            conditions: [],
        };
        setCombatants(prev => [...prev, entry]);
        setAddName(''); setAddInit(''); setAddHp('');
        setShowAdd(false);
    }

    function populateFromPlayers() {
        const existing = new Set(combatants.filter(c => c.isPlayer).map(c => c.playerId));
        const toAdd: InitCombatant[] = [];
        Object.entries(playerCharacters).forEach(([uid, info]) => {
            if (existing.has(uid)) return;
            const char = linkedChars[uid];
            const hp = char?.hpDetails?.current ?? char?.baseStats?.hp ?? 10;
            const maxHp = char ? (char.hpDetails?.max ?? computeTotalMaxHp(char)) : hp;
            toAdd.push({
                id: crypto.randomUUID(),
                name: info.characterName,
                initiative: 0,
                currentHp: hp,
                maxHp,
                isPlayer: true,
                playerId: uid,
                conditions: [],
            });
        });
        setCombatants(prev => [...prev, ...toAdd]);
    }

    function adjustHp(id: string, delta: number) {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, currentHp: Math.min(c.maxHp, c.currentHp + delta) }
            : c,
        ));
    }

    function updateInit(id: string, val: string) {
        const n = parseInt(val);
        if (isNaN(n)) return;
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, initiative: n } : c));
    }

    function toggleCondition(id: string, cond: string) {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            const has = c.conditions.includes(cond);
            return { ...c, conditions: has ? c.conditions.filter(x => x !== cond) : [...c.conditions, cond] };
        }));
    }

    function removeCombatant(id: string) {
        const idx = sorted.findIndex(c => c.id === id);
        setCombatants(prev => prev.filter(c => c.id !== id));
        if (idx <= currentIdx && currentIdx > 0) setCurrentIdx(i => i - 1);
    }

    return (
        <div className="init-tracker">
            {/* Header */}
            <div className="init-header">
                <span className="init-round-badge">Round {round}</span>
                <div className="init-turn-nav">
                    <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={prevTurn} disabled={sorted.length === 0}>
                        <FaChevronLeft size={10} />
                    </button>
                    <span className="init-current-name">
                        {sorted.length === 0 ? '— nessun combattente —' : (sorted[currentIdx % sorted.length]?.name ?? '—')}
                    </span>
                    <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={nextTurn} disabled={sorted.length === 0}>
                        <GiCrossedSwords size={12} />
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                    {Object.keys(playerCharacters).length > 0 && (
                        <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }} onClick={populateFromPlayers} title="Aggiungi PG">
                            <FaUsers size={11} /> PG
                        </button>
                    )}
                    <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }} onClick={() => setShowAdd(v => !v)}>
                        <FaPlus size={10} /> Aggiungi
                    </button>
                    <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', color: 'var(--accent-crimson)' }} onClick={resetCombat}>
                        Reset
                    </button>
                </div>
            </div>

            {/* Add form */}
            {showAdd && (
                <div className="init-add-form">
                    <input className="init-form-input" style={{ flex: 2 }} placeholder="Nome combattente" value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCombatant()} autoFocus />
                    <input className="init-form-input" style={{ width: 60 }} placeholder="Init" type="number" value={addInit} onChange={e => setAddInit(e.target.value)} />
                    <input className="init-form-input" style={{ width: 60 }} placeholder="PF" type="number" value={addHp} onChange={e => setAddHp(e.target.value)} />
                    <button className="btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} onClick={addCombatant} disabled={!addName.trim()}>
                        <FaPlus size={10} />
                    </button>
                    <button className="btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={() => setShowAdd(false)}>
                        <FaTimes size={11} />
                    </button>
                </div>
            )}

            {/* Combatant list */}
            <div className="init-list">
                {sorted.length === 0 && (
                    <div className="init-empty">
                        <GiCrossedSwords size={36} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '0.75rem' }} />
                        <p className="text-muted text-sm">Nessun combattente. Aggiungi PG o nemici.</p>
                    </div>
                )}
                {sorted.map((c) => {
                    const isCurrent = c.id === currentId;
                    const hpPct = c.maxHp > 0 ? Math.max(0, c.currentHp / c.maxHp) : 0;
                    const hpColor = c.currentHp <= 0 ? 'var(--accent-crimson)' : hpPct > 0.5 ? '#4caf7d' : hpPct > 0.25 ? '#f0c040' : 'var(--accent-crimson)';
                    return (
                        <div key={c.id} className={`init-entry ${isCurrent ? 'current' : ''}`}>
                            <div className="init-init-badge">{c.initiative >= 0 ? `+${c.initiative}` : c.initiative}</div>
                            <div className="init-entry-main">
                                <div className="init-entry-name">
                                    {isCurrent && <GiCrossedSwords size={11} style={{ color: 'var(--accent-gold)', marginRight: 4, flexShrink: 0 }} />}
                                    {c.name}
                                    {c.isPlayer && <span className="init-pg-badge">PG</span>}
                                </div>
                                {c.conditions.length > 0 && (
                                    <div className="init-conditions">
                                        {c.conditions.map(cond => (
                                            <span key={cond} className="init-cond-badge" onClick={() => toggleCondition(c.id, cond)}>
                                                {cond} ×
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="init-hp-controls">
                                <button onClick={() => adjustHp(c.id, -1)} title="-1 PF"><FaMinus size={8} /></button>
                                <span className="init-hp-val" style={{ color: hpColor }}>{c.currentHp}/{c.maxHp}</span>
                                <button onClick={() => adjustHp(c.id, 1)} title="+1 PF"><FaPlus size={8} /></button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="btn-ghost"
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}
                                    onClick={() => setShowCondMenu(m => m === c.id ? null : c.id)}
                                    title="Condizioni"
                                >
                                    <FaSkull size={10} />
                                </button>
                                {showCondMenu === c.id && (
                                    <div className="init-cond-menu" onClick={e => e.stopPropagation()}>
                                        {DND_CONDITIONS.map(cond => (
                                            <button
                                                key={cond}
                                                className={`init-cond-menu-item ${c.conditions.includes(cond) ? 'active' : ''}`}
                                                onClick={() => toggleCondition(c.id, cond)}
                                            >
                                                {cond}
                                            </button>
                                        ))}
                                        <button className="init-cond-menu-close" onClick={() => setShowCondMenu(null)}>Chiudi</button>
                                    </div>
                                )}
                            </div>
                            <button
                                className="btn-ghost"
                                style={{ padding: '0.2rem 0.4rem', color: 'rgba(192,57,43,0.6)' }}
                                onClick={() => removeCombatant(c.id)}
                                title="Rimuovi"
                            >
                                <FaTimes size={10} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────── Campaign info panel ─────────────────────────────────

function CampaignInfoPanel({
    campaign, onDelete, onCopyCode, copied,
}: {
    campaign: Campaign;
    onDelete: () => void;
    onCopyCode: () => void;
    copied: boolean;
}) {
    const playerCount = Object.keys(campaign.playerCharacters ?? {}).length;
    return (
        <div className="camp-info-panel">
            <section className="camp-info-section">
                <h4 className="mcv-section-title">Dettagli Campagna</h4>
                <div className="camp-info-row">
                    <span className="camp-info-label">Nome</span>
                    <span className="camp-info-value">{campaign.name}</span>
                </div>
                {campaign.description && (
                    <div className="camp-info-row">
                        <span className="camp-info-label">Descrizione</span>
                        <span className="camp-info-value">{campaign.description}</span>
                    </div>
                )}
                <div className="camp-info-row">
                    <span className="camp-info-label">Codice Invito</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code className="campaign-invite-code" style={{ fontSize: '1rem' }}>{campaign.inviteCode}</code>
                        <button className="btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={onCopyCode}>
                            {copied ? <FaCheck style={{ color: 'var(--accent-gold)' }} /> : <FaCopy size={12} />}
                        </button>
                    </div>
                </div>
                <div className="camp-info-row">
                    <span className="camp-info-label">Giocatori</span>
                    <span className="camp-info-value">{playerCount}</span>
                </div>
            </section>

            {playerCount > 0 && (
                <section className="camp-info-section">
                    <h4 className="mcv-section-title">Avventurieri Collegati</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {Object.entries(campaign.playerCharacters ?? {}).map(([, info]) => (
                            <div key={info.characterId} className="camp-info-player-row">
                                <div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 500 }}>{info.characterName}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{info.playerName}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="camp-info-section">
                <h4 className="mcv-section-title" style={{ color: 'var(--accent-crimson)' }}>Zona Pericolosa</h4>
                <button
                    className="btn-ghost w-full"
                    style={{ justifyContent: 'center', color: 'var(--accent-crimson)', border: '1px solid rgba(192,57,43,0.3)' }}
                    onClick={onDelete}
                >
                    <FaTrash size={11} /> Elimina Campagna
                </button>
            </section>
        </div>
    );
}

// ─────────────────────── Campaign list view ───────────────────────────────────

function CampaignListView({
    campaigns,
    loading,
    showCreate,
    createName,
    createDesc,
    creating,
    onSelect,
    onShowCreate,
    onCreateName,
    onCreateDesc,
    onCreate,
    onCancelCreate,
}: {
    campaigns: Campaign[];
    loading: boolean;
    showCreate: boolean;
    createName: string;
    createDesc: string;
    creating: boolean;
    onSelect: (c: Campaign) => void;
    onShowCreate: () => void;
    onCreateName: (v: string) => void;
    onCreateDesc: (v: string) => void;
    onCreate: () => void;
    onCancelCreate: () => void;
}) {
    return (
        <div className="cl-page">
            {/* Header */}
            <div className="cl-page-header">
                <div className="md-sidebar-title" style={{ fontSize: '0.95rem' }}>
                    <GiCastle size={16} />
                    Le Mie Campagne
                    <span className="md-count">{campaigns.length}</span>
                </div>
                {!showCreate && (
                    <button className="btn-ghost" style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }} onClick={onShowCreate}>
                        <FaPlus size={10} /> Nuova
                    </button>
                )}
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="cl-create-form animate-fade-in">
                    <div className="campaign-field">
                        <label>Nome campagna *</label>
                        <input value={createName} onChange={e => onCreateName(e.target.value)} placeholder="Es. La Torre Oscura" maxLength={80} autoFocus
                            onKeyDown={e => e.key === 'Enter' && onCreate()} />
                    </div>
                    <div className="campaign-field">
                        <label>Descrizione</label>
                        <textarea value={createDesc} onChange={e => onCreateDesc(e.target.value)} placeholder="Descrizione breve…" rows={2} maxLength={500} />
                    </div>
                    <div className="cl-create-actions">
                        <button className="btn-secondary" onClick={onCancelCreate} disabled={creating}>Annulla</button>
                        <button className="btn-primary" onClick={onCreate} disabled={!createName.trim() || creating}>
                            {creating ? 'Creazione…' : <><FaPlus size={10} /> Crea</>}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="cl-list">
                {loading && (
                    <div className="campaign-loading" style={{ height: 'auto', padding: '2rem' }}>Caricamento…</div>
                )}

                {!loading && campaigns.length === 0 && !showCreate && (
                    <div className="md-empty" style={{ alignItems: 'center', padding: '3rem 1.5rem' }}>
                        <GiCastle size={40} style={{ color: 'rgba(201,168,76,0.2)', marginBottom: '1rem' }} />
                        <p className="text-muted text-sm" style={{ textAlign: 'center', marginBottom: '1rem' }}>Nessuna campagna ancora.</p>
                        <button className="btn-primary" onClick={onShowCreate}>
                            <FaPlus size={10} /> Crea la tua prima campagna
                        </button>
                    </div>
                )}

                {campaigns.map(c => {
                    const playerCount = Object.keys(c.playerCharacters ?? {}).length;
                    return (
                        <button key={c.id} className="cl-item" onClick={() => onSelect(c)}>
                            <div className="cl-item-avatar"><GiCastle /></div>
                            <div className="cl-item-info">
                                <div className="cl-item-name">{c.name}</div>
                                {c.description && (
                                    <div className="cl-item-desc">{c.description}</div>
                                )}
                                <div className="cl-item-meta">
                                    <span><FaUsers size={10} /> {playerCount} giocator{playerCount === 1 ? 'e' : 'i'}</span>
                                    <code className="campaign-invite-code" style={{ fontSize: '0.7rem' }}>{c.inviteCode}</code>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────── Master page ─────────────────────────────────────────

export function CampaignPage({ userId, userEmail, userDisplayName, initialCampaign, onBack }: Props) {
    const toast = useChatToast();

    // ── Campaign list state ───────────────────────────────
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [view, setView] = useState<MasterView>(initialCampaign ? 'master' : 'loading');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [creating, setCreating] = useState(false);

    // ── Master view state ─────────────────────────────────
    const [masterCampaign, setMasterCampaign] = useState<Campaign | null>(initialCampaign ?? null);
    const [section, setSection] = useState<MasterSection>('players');
    const [linkedChars, setLinkedChars] = useState<Record<string, CharacterBase>>({});
    const [selectedUid, setSelectedUid] = useState<string | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>('chat');
    const [mobileDetail, setMobileDetail] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [allMessages, setAllMessages] = useState<Record<string, CampaignMessage[]>>({});
    const [chatReadAt, setChatReadAt] = useState<Record<string, number>>({});
    const [copied, setCopied] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const prevMsgCountsRef = useRef<Record<string, number>>({});
    const initialLoadDoneRef = useRef<Record<string, boolean>>({});

    // ── When opened via initialCampaign, restore chatReadAt from localStorage ──
    useEffect(() => {
        if (!initialCampaign?.id) return;
        try {
            const stored = localStorage.getItem(`dnd_chatReadAt_${userId}_${initialCampaign.id}`);
            if (stored) setChatReadAt(JSON.parse(stored));
        } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Subscribe to all master campaigns (only needed for list view) ───
    useEffect(() => {
        if (initialCampaign) return; // skip — we came from inline list, no need
        return subscribeMasterCampaigns(userId, (camps) => {
            setCampaigns(camps);
            setView(prev => prev === 'loading' ? 'list' : prev);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // ── Subscribe to selected campaign doc ───────────────
    useEffect(() => {
        if (!masterCampaign?.id) return;
        return subscribeToCampaign(masterCampaign.id, c => { if (c) setMasterCampaign(c); });
    }, [masterCampaign?.id]);

    // ── Subscribe to linked characters ───────────────────
    useEffect(() => {
        if (view !== 'master' || !masterCampaign?.playerCharacters) return;
        const entries = Object.entries(masterCampaign.playerCharacters);
        const unsubs = entries.map(([uid, info]) =>
            subscribeToCharacter(info.characterId, char => {
                if (char) setLinkedChars(prev => ({ ...prev, [uid]: char }));
            }),
        );
        return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, masterCampaign?.id, JSON.stringify(Object.keys(masterCampaign?.playerCharacters ?? {}))]);

    // ── Subscribe to player chats ─────────────────────────
    useEffect(() => {
        if (view !== 'master' || !masterCampaign?.id) return;
        const playerIds = Object.keys(masterCampaign.playerCharacters ?? {});
        const unsubs = playerIds.map(uid =>
            subscribeToPlayerChat(masterCampaign!.id, uid, msgs =>
                setAllMessages(prev => ({ ...prev, [uid]: msgs })),
            ),
        );
        return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, masterCampaign?.id, JSON.stringify(Object.keys(masterCampaign?.playerCharacters ?? {}))]);

    // ── Toast notifications ───────────────────────────────
    useEffect(() => {
        Object.entries(allMessages).forEach(([uid, msgs]) => {
            const prev = prevMsgCountsRef.current[uid] ?? 0;
            const curr = msgs.length;
            if (!initialLoadDoneRef.current[uid]) {
                prevMsgCountsRef.current[uid] = curr;
                initialLoadDoneRef.current[uid] = true;
                // Auto-mark all pre-existing messages as read so no stale badge appears
                setChatReadAt(prevRead => {
                    if (prevRead[uid] != null) return prevRead; // already have a stored timestamp
                    const lastPlayerTs = msgs
                        .filter(m => m.from === 'player' && m.timestamp != null)
                        .reduce((max, m) => {
                            try { return Math.max(max, m.timestamp!.toDate().getTime()); } catch { return max; }
                        }, 0);
                    const readAt = lastPlayerTs > 0 ? lastPlayerTs : Date.now();
                    const updated = { ...prevRead, [uid]: readAt };
                    if (masterCampaign?.id) {
                        try { localStorage.setItem(`dnd_chatReadAt_${userId}_${masterCampaign.id}`, JSON.stringify(updated)); } catch {}
                    }
                    return updated;
                });
                return;
            }
            if (curr > prev) {
                const fromPlayer = msgs.slice(prev).filter(m => m.from === 'player');
                if (fromPlayer.length > 0 && (selectedUid !== uid || detailTab !== 'chat')) {
                    const last = fromPlayer[fromPlayer.length - 1];
                    const info = masterCampaign?.playerCharacters?.[uid];
                    const title = info ? `${info.playerName} (${info.characterName})` : 'Giocatore';
                    const preview = last.text.length > 70 ? last.text.slice(0, 70) + '…' : last.text;
                    toast.push(title, preview, () => selectPlayer(uid));
                }
            }
            prevMsgCountsRef.current[uid] = curr;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allMessages]);

    // ── Helpers ───────────────────────────────────────────

    function getUnreadCount(uid: string): number {
        const msgs = allMessages[uid] ?? [];
        const readAt = chatReadAt[uid] ?? 0;
        return msgs.filter(m =>
            m.from === 'player' && m.timestamp != null && m.timestamp.toDate().getTime() > readAt,
        ).length;
    }

    function markRead(uid: string) {
        const now = Date.now();
        setChatReadAt(p => {
            const updated = { ...p, [uid]: now };
            if (masterCampaign?.id) {
                try { localStorage.setItem(`dnd_chatReadAt_${userId}_${masterCampaign.id}`, JSON.stringify(updated)); } catch {}
            }
            return updated;
        });
    }

    function selectPlayer(uid: string) {
        setSelectedUid(uid);
        setDetailTab('chat');
        setMobileDetail(true);
        markRead(uid);
        setSection('players');
    }

    function openCampaign(c: Campaign) {
        // Restore persisted read timestamps for this campaign
        try {
            const stored = localStorage.getItem(`dnd_chatReadAt_${userId}_${c.id}`);
            setChatReadAt(stored ? JSON.parse(stored) : {});
        } catch { setChatReadAt({}); }

        setMasterCampaign(c);
        setSection('players');
        setSelectedUid(null);
        setMobileDetail(false);
        setPlayerSearch('');
        setAllMessages({});
        prevMsgCountsRef.current = {};
        initialLoadDoneRef.current = {};
        setView('master');
    }

    function backToList() {
        if (onBack) { onBack(); return; }
        setMasterCampaign(null);
        setSelectedUid(null);
        setLinkedChars({});
        setAllMessages({});
        setConfirmDelete(false);
        setView('list');
    }

    async function handleCreate() {
        if (!createName.trim()) return;
        setCreating(true);
        try {
            const c = await createCampaign(userId, userEmail, userDisplayName, createName, createDesc);
            setCreateName(''); setCreateDesc('');
            setShowCreateForm(false);
            openCampaign(c);
        } finally { setCreating(false); }
    }

    async function handleDeleteCampaign() {
        if (!masterCampaign) return;
        const charIds = Object.values(masterCampaign.playerCharacters || {}).map(p => p.characterId);
        await deleteCampaign(masterCampaign.id, charIds);
        backToList();
    }

    function handleCopyCode() {
        if (!masterCampaign) return;
        navigator.clipboard.writeText(masterCampaign.inviteCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // ── Views ─────────────────────────────────────────────

    if (view === 'loading') {
        return <div className="campaign-page"><div className="campaign-loading">Caricamento…</div></div>;
    }

    if (view === 'list') {
        return (
            <div className="campaign-page">
                <CampaignListView
                    campaigns={campaigns}
                    loading={false}
                    showCreate={showCreateForm}
                    createName={createName}
                    createDesc={createDesc}
                    creating={creating}
                    onSelect={openCampaign}
                    onShowCreate={() => setShowCreateForm(true)}
                    onCreateName={setCreateName}
                    onCreateDesc={setCreateDesc}
                    onCreate={handleCreate}
                    onCancelCreate={() => { setShowCreateForm(false); setCreateName(''); setCreateDesc(''); }}
                />
            </div>
        );
    }

    if (view === 'master' && masterCampaign) {
        const playerEntries = Object.entries(masterCampaign.playerCharacters || {});
        const filteredPlayers = playerSearch.trim()
            ? playerEntries.filter(([, info]) =>
                info.characterName.toLowerCase().includes(playerSearch.toLowerCase()) ||
                info.playerName.toLowerCase().includes(playerSearch.toLowerCase()),
            )
            : playerEntries;

        const totalUnread = playerEntries.reduce((s, [uid]) => s + getUnreadCount(uid), 0);
        const selectedInfo = selectedUid ? masterCampaign.playerCharacters?.[selectedUid] : null;
        const selectedChar = selectedUid ? linkedChars[selectedUid] : undefined;

        const metaNav: { id: MasterSection; label: string; icon: React.ReactNode; badge?: number }[] = [
            { id: 'players',    label: 'Avventurieri', icon: <FaUsers size={16} />,         badge: totalUnread || undefined },
            { id: 'notes',      label: 'Note DM',      icon: <FaStickyNote size={16} /> },
            { id: 'initiative', label: 'Iniziativa',   icon: <GiCrossedSwords size={18} /> },
            { id: 'info',       label: 'Campagna',     icon: <FaCog size={15} /> },
        ];

        return (
            <div className="campaign-page campaign-master">
                {/* ── Top header ── */}
                <div className="campaign-header">
                    <button className="btn-ghost" style={{ padding: '0.3rem 0.6rem', flexShrink: 0 }} onClick={backToList}>
                        <FaChevronLeft size={11} /> Campagne
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2>{masterCampaign.name}</h2>
                        {masterCampaign.description && (
                            <p className="text-muted text-sm" style={{ margin: 0 }}>{masterCampaign.description}</p>
                        )}
                    </div>
                    <div className="campaign-invite-row" style={{ flexShrink: 0 }}>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>Codice:</span>
                        <code className="campaign-invite-code">{masterCampaign.inviteCode}</code>
                        <button className="btn-ghost" onClick={handleCopyCode} title="Copia codice" style={{ padding: '0.25rem 0.5rem' }}>
                            {copied ? <FaCheck style={{ color: 'var(--accent-gold)' }} /> : <FaCopy size={12} />}
                        </button>
                    </div>
                </div>

                {/* ── Master body: meta-nav + section content ── */}
                <div className="master-body">

                    {/* ── Left meta-nav ── */}
                    <nav className="master-meta-nav">
                        {metaNav.map(item => (
                            <button
                                key={item.id}
                                className={`master-meta-btn ${section === item.id ? 'active' : ''}`}
                                onClick={() => setSection(item.id)}
                                title={item.label}
                            >
                                <span className="meta-icon">{item.icon}</span>
                                <span className="meta-label">{item.label}</span>
                                {item.badge != null && item.badge > 0 && (
                                    <span className="meta-badge">{item.badge > 9 ? '9+' : item.badge}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* ── Section content ── */}
                    <div className="master-section-content">

                        {/* PLAYERS section */}
                        {section === 'players' && (
                            <div className={`md-layout ${mobileDetail ? 'mobile-detail' : ''}`}>
                                <aside className="md-sidebar">
                                    <div className="md-sidebar-header">
                                        <div className="md-sidebar-title">
                                            <FaUsers size={13} />
                                            Avventurieri
                                            <span className="md-count">{playerEntries.length}</span>
                                            {totalUnread > 0 && (
                                                <span className="campaign-unread-badge" style={{ position: 'static', marginLeft: 2 }}>
                                                    {totalUnread > 9 ? '9+' : totalUnread}
                                                </span>
                                            )}
                                        </div>
                                        {playerEntries.length > 2 && (
                                            <div className="md-search-box">
                                                <FaSearch size={11} className="md-search-icon" />
                                                <input
                                                    className="md-search-input"
                                                    placeholder="Cerca giocatore…"
                                                    value={playerSearch}
                                                    onChange={e => setPlayerSearch(e.target.value)}
                                                />
                                                {playerSearch && (
                                                    <button className="md-search-clear" onClick={() => setPlayerSearch('')}>
                                                        <FaTimes size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="md-player-list">
                                        {filteredPlayers.length === 0 ? (
                                            <div className="md-empty">
                                                {playerEntries.length === 0
                                                    ? <>
                                                        <p className="text-muted text-sm" style={{ textAlign: 'center' }}>Nessun giocatore ancora.</p>
                                                        <p className="text-muted text-sm" style={{ textAlign: 'center' }}>
                                                            Condividi <code className="campaign-invite-code" style={{ fontSize: '0.9rem' }}>{masterCampaign.inviteCode}</code>
                                                        </p>
                                                    </>
                                                    : <p className="text-muted text-sm" style={{ textAlign: 'center' }}>Nessun risultato.</p>
                                                }
                                            </div>
                                        ) : (
                                            filteredPlayers.map(([uid, info]) => (
                                                <PlayerListItem
                                                    key={uid}
                                                    uid={uid}
                                                    info={info}
                                                    char={linkedChars[uid]}
                                                    unread={getUnreadCount(uid)}
                                                    selected={selectedUid === uid}
                                                    onClick={() => selectPlayer(uid)}
                                                />
                                            ))
                                        )}
                                    </div>
                                </aside>

                                <div className="md-detail-area">
                                    {mobileDetail && (
                                        <button className="md-back-btn" onClick={() => setMobileDetail(false)}>
                                            <FaChevronLeft size={12} /> Giocatori
                                        </button>
                                    )}
                                    {selectedUid && selectedInfo ? (
                                        <DetailPanel
                                            uid={selectedUid}
                                            info={selectedInfo}
                                            char={selectedChar}
                                            messages={allMessages[selectedUid] ?? []}
                                            campaignId={masterCampaign.id}
                                            masterName={userDisplayName}
                                            unread={getUnreadCount(selectedUid)}
                                            onMarkRead={() => markRead(selectedUid)}
                                            tab={detailTab}
                                            onTabChange={setDetailTab}
                                        />
                                    ) : (
                                        <div className="md-empty-detail">
                                            <GiCastle size={48} style={{ color: 'rgba(201,168,76,0.2)', marginBottom: '1rem' }} />
                                            <p className="text-muted">Seleziona un avventuriero dalla lista</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* NOTES section */}
                        {section === 'notes' && (
                            <NotesPanel campaign={masterCampaign} campaignId={masterCampaign.id} />
                        )}

                        {/* INITIATIVE section */}
                        {section === 'initiative' && (
                            <InitiativeTracker
                                linkedChars={linkedChars}
                                playerCharacters={masterCampaign.playerCharacters ?? {}}
                            />
                        )}

                        {/* INFO section */}
                        {section === 'info' && (
                            <CampaignInfoPanel
                                campaign={masterCampaign}
                                onDelete={() => setConfirmDelete(true)}
                                onCopyCode={handleCopyCode}
                                copied={copied}
                            />
                        )}
                    </div>
                </div>

                {/* Confirm delete modal */}
                {confirmDelete && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div className="glass-panel animate-fade-in" style={{ width: 360, textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)', marginBottom: '0.5rem' }}>Elimina Campagna</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                                Sei sicuro di voler eliminare <strong style={{ color: 'var(--text-primary)' }}>{masterCampaign.name}</strong>?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
                                Tutti i giocatori verranno scollegati e le chat eliminate.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => setConfirmDelete(false)}>Annulla</button>
                                <button className="btn-primary w-full" style={{ justifyContent: 'center', background: 'var(--accent-crimson)', borderColor: 'var(--accent-crimson)' }} onClick={handleDeleteCampaign}>
                                    <FaTrash size={11} /> Elimina
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
}

