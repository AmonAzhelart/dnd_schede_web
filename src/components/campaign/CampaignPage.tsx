import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FaCopy, FaCheck, FaCheckDouble, FaComments, FaPaperPlane, FaUsers, FaTrash,
    FaSearch, FaTimes, FaChevronLeft, FaShieldAlt, FaHeart, FaBolt,
    FaBoxOpen, FaStar, FaStickyNote, FaCog, FaPlus, FaMinus, FaSkull, FaBook, FaEdit, FaShare, FaGlobe, FaLock,
} from 'react-icons/fa';
import { GiCastle, GiSwordman, GiSpellBook, GiSkills, GiCrossedSwords } from 'react-icons/gi';
import {
    createCampaign,
    deleteCampaign,
    saveMasterNotes,
    saveInitiativeCombat,
    sendCampaignMessage,
    subscribeMasterCampaigns,
    subscribeToPlayerChat,
    subscribeToCampaign,
    subscribeCampaignGlossary,
    addCampaignGlossaryEntry,
    updateCampaignGlossaryEntry,
    deleteCampaignGlossaryEntry,
    markChatRead,
    subscribeToChatMeta,
    type ChatMeta,
} from '../../services/campaign';
import { subscribeToCharacter } from '../../services/db';
import type { Campaign, CampaignMessage, CampaignGlossaryEntry, GlossarySection, MasterNote, InitiativeCombatState } from '../../types/campaign';
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
type MasterSection = 'players' | 'notes' | 'initiative' | 'info' | 'glossary';

interface InitCombatant {
    id: string;
    name: string;
    initiative: number;
    currentHp: number;
    maxHp: number;
    ac?: number;
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
    const [chatMeta, setChatMeta] = useState<ChatMeta>({ playerReadAt: null, masterReadAt: null });
    const bottomRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (externalMessages !== undefined) return;
        return subscribeToPlayerChat(campaignId, playerId, setLocalMessages);
    }, [campaignId, playerId, externalMessages]);

    // Subscribe to read timestamps
    useEffect(() => {
        return subscribeToChatMeta(campaignId, playerId, setChatMeta);
    }, [campaignId, playerId]);

    // Mark our side as read whenever we mount or new messages arrive
    useEffect(() => {
        markChatRead(campaignId, playerId, from).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId, playerId, from, (externalMessages ?? localMessages).length]);

    const serverMessages = externalMessages ?? localMessages;
    const allMessages: CampaignMessage[] = [
        ...serverMessages,
        ...pendingMsgs.filter(p => !serverMessages.some(m => m.text === p.text && m.from === p.from)),
    ];

    // Timestamp at which the OTHER party last read the chat
    const otherReadAt = from === 'player' ? chatMeta.masterReadAt : chatMeta.playerReadAt;

    function isMessageRead(msg: CampaignMessage): boolean {
        return msg.timestamp != null && otherReadAt != null &&
            otherReadAt.toMillis() >= msg.timestamp.toMillis();
    }

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
                    const isMe = msg.from === from;
                    const read = isMe && !isPending && isMessageRead(msg);
                    return (
                        <div key={msg.id} className={`campaign-chat-bubble ${isMe ? 'is-me' : 'is-other'} ${isPending ? 'is-pending' : ''}`}>
                            {!isMe && (
                                <span className="campaign-chat-sender">{msg.fromName}</span>
                            )}
                            <span className="campaign-chat-text">
                                <HighlightText text={msg.text} query={searchQuery} />
                            </span>
                            <div className="campaign-chat-footer">
                                <span className="campaign-chat-ts">
                                    {isPending ? '…' : msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                                {isMe && !isPending && (
                                    <span className={`chat-read-tick${read ? ' is-read' : ''}`} title={read ? 'Letto' : 'Inviato'}>
                                        {read ? <FaCheckDouble size={10} /> : <FaCheck size={10} />}
                                    </span>
                                )}
                            </div>
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
                        {tab === 'stats' && <StatsTab char={char} />}
                        {tab === 'skills' && <SkillsTab char={char} />}
                        {tab === 'inventory' && <InventoryTab char={char} />}
                        {tab === 'spells' && <SpellsTab char={char} />}
                        {tab === 'feats' && <FeatsTab char={char} />}
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

// ─────────────────────── Master Glossary panel ───────────────────────────────

const CAT_COLORS_GLOSS: Record<CampaignGlossaryEntry['category'], string> = {
    person: '#6ab4ff', place: '#6aff9e', item: '#ffb46a', lore: '#c86aff', other: '#aaaaaa',
};
const CAT_LABELS_GLOSS: Record<CampaignGlossaryEntry['category'], string> = {
    person: 'Persona', place: 'Luogo', item: 'Oggetto', lore: 'Lore', other: 'Altro',
};
const ALL_CATS_GLOSS: CampaignGlossaryEntry['category'][] = ['person', 'place', 'item', 'lore', 'other'];

function newSectionId() { return `s${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

// ── Section Share Modal ──────────────────────────────────────────────────────
// Shows every section of an entry; for each section the master picks:
//   "Tutti" | "Nessuno" | specific players.

type SectionMode = 'all' | 'none' | 'select';
interface SectionSharingState { mode: SectionMode; selected: string[]; }

interface SectionShareModalProps {
    entry: CampaignGlossaryEntry;
    playerCharacters: Campaign['playerCharacters'];
    onConfirm: (sections: GlossarySection[]) => void;
    onClose: () => void;
}

function SectionShareModal({ entry, playerCharacters, onConfirm, onClose }: SectionShareModalProps) {
    const players = Object.entries(playerCharacters);
    const sections = entry.sections ?? [];

    const [states, setStates] = useState<Record<string, SectionSharingState>>(() => {
        const map: Record<string, SectionSharingState> = {};
        sections.forEach(sec => {
            map[sec.id] = {
                mode: sec.isPublic ? 'all' : sec.visibleToPlayerIds.length > 0 ? 'select' : 'none',
                selected: [...sec.visibleToPlayerIds],
            };
        });
        return map;
    });

    function setMode(secId: string, mode: SectionMode) {
        setStates(prev => ({ ...prev, [secId]: { ...prev[secId], mode } }));
    }
    function togglePlayer(secId: string, uid: string) {
        setStates(prev => {
            const cur = prev[secId];
            const selected = cur.selected.includes(uid)
                ? cur.selected.filter(x => x !== uid)
                : [...cur.selected, uid];
            return { ...prev, [secId]: { ...cur, selected } };
        });
    }
    function handleConfirm() {
        const updated = sections.map(sec => {
            const st = states[sec.id] ?? { mode: 'none', selected: [] };
            return { ...sec, isPublic: st.mode === 'all', visibleToPlayerIds: st.mode === 'select' ? st.selected : [] };
        });
        onConfirm(updated);
    }

    if (sections.length === 0) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div className="glass-panel animate-fade-in" style={{ width: 380 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <FaShare size={13} style={{ color: 'var(--accent-gold)' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>Condividi: <em style={{ color: 'var(--accent-gold)' }}>{entry.term}</em></h3>
                        <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={onClose}><FaTimes size={13} /></button>
                    </div>
                    <p className="text-muted text-sm">Nessuna sezione presente. Aggiungine almeno una dalla modalità di modifica per poter condividere.</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                        <button className="btn-secondary" onClick={onClose}>Chiudi</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={onClose}>
            <div className="glass-panel animate-fade-in mg-share-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexShrink: 0 }}>
                    <FaShare size={13} style={{ color: 'var(--accent-gold)' }} />
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                        Condividi: <em style={{ color: 'var(--accent-gold)' }}>{entry.term}</em>
                    </h3>
                    <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={onClose}><FaTimes size={13} /></button>
                </div>

                {/* Sections list */}
                <div className="mg-share-sections">
                    {sections.map(sec => {
                        const st = states[sec.id] ?? { mode: 'none', selected: [] };
                        return (
                            <div key={sec.id} className="mg-share-section">
                                <div className="mg-share-sec-header">
                                    <span className="mg-share-sec-label">{sec.label || <em style={{ color: 'var(--text-muted)' }}>Sezione senza titolo</em>}</span>
                                    <div className="mg-share-sec-modes">
                                        <button
                                            className={`mg-mode-btn ${st.mode === 'none' ? 'active-private' : ''}`}
                                            onClick={() => setMode(sec.id, 'none')}
                                            title="Nascosta">
                                            <FaLock size={9} /> Nascosta
                                        </button>
                                        <button
                                            className={`mg-mode-btn ${st.mode === 'all' ? 'active-public' : ''}`}
                                            onClick={() => setMode(sec.id, 'all')}
                                            title="Tutti i giocatori">
                                            <FaGlobe size={9} /> Tutti
                                        </button>
                                        {players.length > 0 && (
                                            <button
                                                className={`mg-mode-btn ${st.mode === 'select' ? 'active-select' : ''}`}
                                                onClick={() => setMode(sec.id, 'select')}
                                                title="Giocatori specifici">
                                                <FaUsers size={9} /> Seleziona
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {sec.content && <div className="mg-share-sec-preview">{sec.content.length > 100 ? sec.content.slice(0, 100) + '…' : sec.content}</div>}
                                {st.mode === 'select' && (
                                    <div className="mg-share-player-list">
                                        {players.map(([uid, info]) => (
                                            <label key={uid} className="mg-share-player-row">
                                                <input type="checkbox"
                                                    checked={st.selected.includes(uid)}
                                                    onChange={() => togglePlayer(sec.id, uid)}
                                                    style={{ accentColor: 'var(--accent-gold)' }} />
                                                <span className="mg-share-player-char">{info.characterName}</span>
                                                <span className="mg-share-player-name">({info.playerName})</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Quick actions */}
                <div className="mg-share-quick">
                    <span className="text-muted" style={{ fontSize: '0.72rem' }}>Rapido:</span>
                    <button className="btn-ghost" style={{ fontSize: '0.72rem', color: '#6aff9e' }}
                        onClick={() => setStates(prev => {
                            const next = { ...prev };
                            sections.forEach(s => { next[s.id] = { mode: 'all', selected: [] }; });
                            return next;
                        })}>
                        <FaGlobe size={9} /> Tutto pubblico
                    </button>
                    <button className="btn-ghost" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                        onClick={() => setStates(prev => {
                            const next = { ...prev };
                            sections.forEach(s => { next[s.id] = { mode: 'none', selected: [] }; });
                            return next;
                        })}>
                        <FaLock size={9} /> Tutto nascosto
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button className="btn-secondary" onClick={onClose}>Annulla</button>
                    <button className="btn-primary" onClick={handleConfirm}>
                        <FaCheck size={11} /> Salva condivisione
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Entry editor ─────────────────────────────────────────────────────────────
// Inline form used both for new entries and for editing existing ones.

interface EntryFormProps {
    entry: CampaignGlossaryEntry;
    onChange: (entry: CampaignGlossaryEntry) => void;
    onSave: () => void;
    onCancel: () => void;
}

function EntryForm({ entry, onChange, onSave, onCancel }: EntryFormProps) {
    function updateSection(idx: number, field: keyof GlossarySection, value: string) {
        const sections = [...(entry.sections ?? [])];
        sections[idx] = { ...sections[idx], [field]: value };
        onChange({ ...entry, sections });
    }
    function addSection() {
        const sections = [...(entry.sections ?? []), { id: newSectionId(), label: '', content: '', isPublic: false, visibleToPlayerIds: [] }];
        onChange({ ...entry, sections });
    }
    function removeSection(idx: number) {
        const sections = (entry.sections ?? []).filter((_, i) => i !== idx);
        onChange({ ...entry, sections });
    }

    return (
        <div className="mg-edit-form">
            {/* Term + category */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input className="mg-inp" placeholder="Termine…" autoFocus value={entry.term}
                    onChange={e => onChange({ ...entry, term: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
                <div className="mg-cat-sel">
                    {ALL_CATS_GLOSS.map(c => (
                        <button key={c} className={`mg-cat-btn sm ${entry.category === c ? 'active' : ''}`}
                            style={{ '--cat-c': CAT_COLORS_GLOSS[c] } as React.CSSProperties}
                            onClick={() => onChange({ ...entry, category: c })}
                            title={CAT_LABELS_GLOSS[c]}>{CAT_LABELS_GLOSS[c]}</button>
                    ))}
                </div>
            </div>

            {/* Private master notes */}
            <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <FaLock size={9} /> Note private (solo tu le vedi)
                </div>
                <textarea className="mg-ta" rows={2} placeholder="Appunti riservati al master…" value={entry.info}
                    onChange={e => onChange({ ...entry, info: e.target.value })} />
            </div>

            {/* Sections */}
            <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FaBook size={9} /> Sezioni condivisibili
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>— ognuna può essere rivelata ai giocatori singolarmente</span>
                </div>

                {(entry.sections ?? []).length === 0 && (
                    <div className="mg-sections-empty">Nessuna sezione ancora. Aggiungine una per condividere informazioni con i giocatori.</div>
                )}

                {(entry.sections ?? []).map((sec, idx) => (
                    <div key={sec.id} className="mg-section-row">
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <input className="mg-inp mg-sec-label-inp" placeholder="Titolo sezione (es. Aspetto, Segreto…)" value={sec.label}
                                onChange={e => updateSection(idx, 'label', e.target.value)} />
                            {sec.isPublic && <FaGlobe size={10} title="Pubblica" style={{ color: '#6aff9e', flexShrink: 0 }} />}
                            {!sec.isPublic && sec.visibleToPlayerIds.length > 0 && <FaLock size={10} title="Condivisa con alcuni" style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />}
                            {!sec.isPublic && sec.visibleToPlayerIds.length === 0 && <FaLock size={10} title="Nascosta" style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}
                            <button className="btn-ghost" style={{ padding: '0.2rem 0.35rem', color: 'var(--accent-crimson)', marginLeft: 'auto', flexShrink: 0 }}
                                onClick={() => removeSection(idx)} title="Rimuovi sezione">
                                <FaTrash size={9} />
                            </button>
                        </div>
                        <textarea className="mg-ta" rows={2} placeholder="Contenuto della sezione…" value={sec.content}
                            onChange={e => updateSection(idx, 'content', e.target.value)} />
                    </div>
                ))}

                <button className="btn-ghost mg-add-section-btn" onClick={addSection}>
                    <FaPlus size={9} /> Aggiungi sezione
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={onCancel}>Annulla</button>
                <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={onSave}
                    disabled={!entry.term.trim()}>
                    <FaCheck size={10} /> Salva
                </button>
            </div>
        </div>
    );
}

// ── Entry detail modal ────────────────────────────────────────────────────────

interface EntryDetailModalProps {
    entry: CampaignGlossaryEntry;
    playerCharacters: Campaign['playerCharacters'];
    onEdit: () => void;
    onShare: () => void;
    onDelete: () => void;
    onClose: () => void;
    playerCount: number;
}

function EntryDetailModal({ entry, playerCharacters, onEdit, onShare, onDelete, onClose, playerCount }: EntryDetailModalProps) {
    const sections = entry.sections ?? [];
    const status = (() => {
        if (sections.some(s => s.isPublic)) return 'public';
        if (sections.some(s => s.visibleToPlayerIds.length > 0)) return 'partial';
        return 'hidden';
    })();

    function sectionLabel(sec: GlossarySection): React.ReactNode {
        if (sec.isPublic) return <span style={{ color: '#6aff9e', fontSize: '0.62rem' }}><FaGlobe size={8} /> Tutti</span>;
        if (sec.visibleToPlayerIds.length > 0) {
            const names = sec.visibleToPlayerIds.map(uid => playerCharacters[uid]?.characterName ?? uid).join(', ');
            return <span style={{ color: 'var(--accent-gold)', fontSize: '0.62rem' }}><FaLock size={8} /> {names}</span>;
        }
        return <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem' }}><FaLock size={8} /> Nascosta</span>;
    }

    return (
        <div className="mg-detail-overlay" onClick={onClose}>
            <div className="mg-detail-modal glass-panel" onClick={e => e.stopPropagation()}>
                <div className="mg-detail-header">
                    <div className="mg-entry-dot" style={{ background: CAT_COLORS_GLOSS[entry.category], width: 10, height: 10, flexShrink: 0 }} />
                    <span className="mg-detail-term">{entry.term}</span>
                    <span className="mg-cat-badge" style={{ '--cat-c': CAT_COLORS_GLOSS[entry.category] } as React.CSSProperties}>
                        {CAT_LABELS_GLOSS[entry.category]}
                    </span>
                    <span className={`mg-share-badge ${status}`} style={{ marginLeft: 4 }}>
                        {status === 'public' ? <FaGlobe size={9} /> : <FaLock size={9} />}
                        {' '}{status === 'public' ? 'Tutti' : status === 'partial' ? 'Parziale' : 'Nascosta'}
                    </span>
                    <button className="mg-detail-close" onClick={onClose} title="Chiudi">
                        <FaTimes size={13} />
                    </button>
                </div>

                {entry.info && (
                    <div className="mg-detail-private">
                        <FaLock size={9} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>{entry.info}</span>
                    </div>
                )}

                {sections.length > 0 && (
                    <div className="mg-detail-sections">
                        {sections.map(sec => (
                            <div key={sec.id} className="mg-detail-section">
                                <div className="mg-detail-sec-header">
                                    <span className="mg-detail-sec-label">{sec.label || <em style={{ fontWeight: 400 }}>Sezione</em>}</span>
                                    {sectionLabel(sec)}
                                </div>
                                {sec.content && <div className="mg-detail-sec-content">{sec.content}</div>}
                            </div>
                        ))}
                    </div>
                )}

                {sections.length === 0 && !entry.info && (
                    <div className="mg-detail-empty">
                        <p>Nessun contenuto. Modifica la voce per aggiungere sezioni.</p>
                    </div>
                )}

                <div className="mg-detail-actions">
                    {playerCount > 0 && sections.length > 0 && (
                        <button className="btn-ghost" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }} onClick={onShare}>
                            <FaShare size={10} /> Condividi
                        </button>
                    )}
                    <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={onEdit}>
                        <FaEdit size={10} /> Modifica
                    </button>
                    <button className="btn-ghost" style={{ fontSize: '0.8rem', color: 'var(--accent-crimson)' }} onClick={onDelete}>
                        <FaTrash size={10} /> Elimina
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Glossary edit modal ────────────────────────────────────────────────────────

interface GlossaryEditModalProps {
    editState: NonNullable<GlossaryEditState>;
    onChange: (entry: CampaignGlossaryEntry) => void;
    onSave: () => void;
    onCancel: () => void;
}

function GlossaryEditModal({ editState, onChange, onSave, onCancel }: GlossaryEditModalProps) {
    return (
        <div className="mg-edit-overlay" onClick={onCancel}>
            <div className="mg-edit-modal glass-panel" onClick={e => e.stopPropagation()}>
                <div className="mg-modal-header">
                    <span>{editState.isNew ? 'Nuova voce' : `Modifica: ${editState.entry.term}`}</span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px' }} onClick={onCancel} title="Chiudi">
                        <FaTimes size={13} />
                    </button>
                </div>
                <EntryForm
                    entry={editState.entry}
                    onChange={onChange}
                    onSave={onSave}
                    onCancel={onCancel}
                />
            </div>
        </div>
    );
}

// ── MasterGlossaryPanel ──────────────────────────────────────────────────────

interface MasterGlossaryPanelProps {
    campaignId: string;
    masterId: string;
    playerCharacters: Campaign['playerCharacters'];
}

type GlossaryEditState = {
    entry: CampaignGlossaryEntry;
    isNew: boolean;
} | null;

function MasterGlossaryPanel({ campaignId, masterId, playerCharacters }: MasterGlossaryPanelProps) {
    const [entries, setEntries] = useState<CampaignGlossaryEntry[]>([]);
    const [editState, setEditState] = useState<GlossaryEditState>(null);
    const [viewEntry, setViewEntry] = useState<CampaignGlossaryEntry | null>(null);
    const [shareEntry, setShareEntry] = useState<CampaignGlossaryEntry | null>(null);
    const [catFilter, setCatFilter] = useState<CampaignGlossaryEntry['category'] | 'all'>('all');

    useEffect(() => subscribeCampaignGlossary(campaignId, setEntries), [campaignId]);

    const filtered = catFilter === 'all' ? entries : entries.filter(e => e.category === catFilter);

    function newEntry(): CampaignGlossaryEntry {
        return { id: '', term: '', info: '', category: 'other', createdAt: null, sharedByMasterId: masterId, isPublic: false, visibleToPlayerIds: [], sections: [] };
    }

    async function handleSave() {
        if (!editState || !editState.entry.term.trim()) return;
        if (editState.isNew) {
            await addCampaignGlossaryEntry(campaignId, masterId, {
                term: editState.entry.term.trim(),
                info: editState.entry.info,
                category: editState.entry.category,
                isPublic: false,
                visibleToPlayerIds: [],
                sections: editState.entry.sections ?? [],
            });
        } else {
            await updateCampaignGlossaryEntry(campaignId, editState.entry);
        }
        setEditState(null);
    }

    async function handleDelete(id: string) {
        await deleteCampaignGlossaryEntry(campaignId, id);
    }

    async function handleShareSections(sections: GlossarySection[]) {
        if (!shareEntry) return;
        await updateCampaignGlossaryEntry(campaignId, { ...shareEntry, sections });
        setShareEntry(null);
    }

    const playerCount = Object.keys(playerCharacters).length;

    // Compute a summary sharing status for an entry
    function entrySharingStatus(entry: CampaignGlossaryEntry): 'public' | 'partial' | 'hidden' {
        const sections = entry.sections ?? [];
        if (sections.some(s => s.isPublic)) return 'public';
        if (sections.some(s => s.visibleToPlayerIds.length > 0)) return 'partial';
        return 'hidden';
    }

    function sectionSharingLabel(sec: GlossarySection, playerChars: Campaign['playerCharacters']): React.ReactNode {
        if (sec.isPublic) return <span style={{ color: '#6aff9e', fontSize: '0.62rem' }}><FaGlobe size={8} /> Tutti</span>;
        if (sec.visibleToPlayerIds.length > 0) {
            const names = sec.visibleToPlayerIds.map(uid => playerChars[uid]?.characterName ?? uid).join(', ');
            return <span style={{ color: 'var(--accent-gold)', fontSize: '0.62rem' }}><FaLock size={8} /> {names}</span>;
        }
        return <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem' }}><FaLock size={8} /> Nascosta</span>;
    }

    return (
        <div className="mg-panel">
            <div className="mg-header">
                <FaBook size={14} style={{ color: 'var(--accent-gold)' }} />
                <span>Glossario Campagna</span>
                <span className="mg-count">{entries.length}</span>
                <button className="btn-primary" style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                    onClick={() => setEditState({ entry: newEntry(), isNew: true })}>
                    <FaPlus size={10} /> Nuova voce
                </button>
            </div>

            {/* Category filter */}
            <div className="mg-cat-filter">
                <button className={`mg-cat-btn ${catFilter === 'all' ? 'active' : ''}`} onClick={() => setCatFilter('all')}>Tutti</button>
                {ALL_CATS_GLOSS.map(c => (
                    <button key={c} className={`mg-cat-btn ${catFilter === c ? 'active' : ''}`}
                        style={{ '--cat-c': CAT_COLORS_GLOSS[c] } as React.CSSProperties}
                        onClick={() => setCatFilter(c)}>{CAT_LABELS_GLOSS[c]}</button>
                ))}
            </div>

            <div className="mg-body">
                {filtered.length === 0 && (
                    <div className="mg-empty">
                        <FaBook size={36} style={{ color: 'rgba(255,255,255,0.07)', marginBottom: '1rem' }} />
                        <p className="text-muted text-sm">Nessuna voce nel glossario. Creane una per iniziare.</p>
                    </div>
                )}

                {filtered.map(entry => {
                    const status = entrySharingStatus(entry);
                    const sections = entry.sections ?? [];

                    return (
                        <div key={entry.id} className="mg-entry" style={{ cursor: 'pointer' }}
                            onClick={() => setViewEntry(entry)}>
                            <div className="mg-entry-dot" style={{ background: CAT_COLORS_GLOSS[entry.category] }} />
                            <div className="mg-entry-body">
                                <div className="mg-entry-top">
                                    <span className="mg-term">{entry.term}</span>
                                    <span className="mg-cat-badge" style={{ '--cat-c': CAT_COLORS_GLOSS[entry.category] } as React.CSSProperties}>
                                        {CAT_LABELS_GLOSS[entry.category]}
                                    </span>
                                    <span className={`mg-share-badge ${status}`}>
                                        {status === 'public' ? <FaGlobe size={9} /> : <FaLock size={9} />}
                                        {' '}{status === 'public' ? 'Tutti' : status === 'partial' ? 'Parziale' : 'Nascosta'}
                                    </span>
                                </div>

                                {entry.info && (
                                    <div className="mg-private-note">
                                        <FaLock size={8} /> {entry.info}
                                    </div>
                                )}

                                {sections.length > 0 && (
                                    <div className="mg-sections-summary">
                                        {sections.map(sec => (
                                            <div key={sec.id} className="mg-sec-summary-row">
                                                <span className="mg-sec-summary-label">{sec.label || <em>Sezione</em>}</span>
                                                {sectionSharingLabel(sec, playerCharacters)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {sections.length === 0 && (
                                    <div className="mg-no-sections">Nessuna sezione &mdash; clicca per aggiungerne.</div>
                                )}
                            </div>
                            <div className="mg-entry-acts" onClick={e => e.stopPropagation()}>
                                {playerCount > 0 && sections.length > 0 && (
                                    <button className="btn-ghost" style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', color: 'var(--accent-gold)' }}
                                        onClick={() => setShareEntry(entry)} title="Gestisci condivisione sezioni">
                                        <FaShare size={10} />
                                    </button>
                                )}
                                <button className="btn-ghost" style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                                    onClick={() => setEditState({ entry: { ...entry }, isNew: false })} title="Modifica">
                                    <FaEdit size={10} />
                                </button>
                                <button className="btn-ghost" style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', color: 'var(--accent-crimson)' }}
                                    onClick={() => handleDelete(entry.id)} title="Elimina">
                                    <FaTrash size={10} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {shareEntry && (
                <SectionShareModal
                    entry={shareEntry}
                    playerCharacters={playerCharacters}
                    onConfirm={handleShareSections}
                    onClose={() => setShareEntry(null)}
                />
            )}

            {viewEntry && (
                <EntryDetailModal
                    entry={viewEntry}
                    playerCharacters={playerCharacters}
                    onEdit={() => { setEditState({ entry: { ...viewEntry }, isNew: false }); setViewEntry(null); }}
                    onShare={() => { setShareEntry(viewEntry); setViewEntry(null); }}
                    onDelete={() => { handleDelete(viewEntry.id); setViewEntry(null); }}
                    onClose={() => setViewEntry(null)}
                    playerCount={playerCount}
                />
            )}

            {editState && (
                <GlossaryEditModal
                    editState={editState}
                    onChange={entry => setEditState({ ...editState, entry })}
                    onSave={handleSave}
                    onCancel={() => setEditState(null)}
                />
            )}
        </div>
    );
}

// ─────────────────────── Initiative tracker ───────────────────────────────────

function InitiativeTracker({
    linkedChars, playerCharacters, campaignId, savedCombat,
}: {
    linkedChars: Record<string, CharacterBase>;
    playerCharacters: Campaign['playerCharacters'];
    campaignId: string;
    savedCombat?: InitiativeCombatState;
}) {
    const [combatants, setCombatants] = useState<InitCombatant[]>(() => savedCombat?.combatants ?? []);
    const [round, setRound] = useState(() => savedCombat?.round ?? 1);
    const [currentIdx, setCurrentIdx] = useState(() => savedCombat?.currentIdx ?? 0);
    const [addName, setAddName] = useState('');
    const [addInit, setAddInit] = useState('');
    const [addHp, setAddHp] = useState('');
    const [addAc, setAddAc] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [showCondMenu, setShowCondMenu] = useState<string | null>(null);
    const [hpEditId, setHpEditId] = useState<string | null>(null);
    const [hpDeltaStr, setHpDeltaStr] = useState('');
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstMount = useRef(true);

    // Sync player HP and AC from real-time linkedChars
    useEffect(() => {
        setCombatants(prev => {
            if (prev.length === 0) return prev;
            let changed = false;
            const next = prev.map(c => {
                if (!c.isPlayer || !c.playerId) return c;
                const char = linkedChars[c.playerId];
                if (!char) return c;
                const currentHp = char.hpDetails?.current ?? char.baseStats?.hp ?? c.currentHp;
                const maxHp = char.hpDetails?.max ?? computeTotalMaxHp(char);
                const ac = computeEffectiveStat(char, 'ac');
                if (c.currentHp === currentHp && c.maxHp === maxHp && c.ac === ac) return c;
                changed = true;
                return { ...c, currentHp, maxHp, ac };
            });
            return changed ? next : prev;
        });
    }, [linkedChars]);

    // Auto-save to Firestore (debounced 1.5 s) whenever combat state changes
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveInitiativeCombat(campaignId, { combatants, round, currentIdx });
        }, 1500);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatants, round, currentIdx]);

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
        saveInitiativeCombat(campaignId, null);
    }

    function addCombatant() {
        if (!addName.trim()) return;
        const hp = parseInt(addHp) || 10;
        const entry: InitCombatant = {
            id: crypto.randomUUID(),
            name: addName.trim(),
            initiative: parseInt(addInit) || 0,
            currentHp: hp,
            maxHp: hp,
            ac: parseInt(addAc) || undefined,
            isPlayer: false,
            conditions: [],
        };
        setCombatants(prev => [...prev, entry]);
        setAddName(''); setAddInit(''); setAddHp(''); setAddAc('');
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
            const ac = char ? computeEffectiveStat(char, 'ac') : undefined;
            toAdd.push({
                id: crypto.randomUUID(),
                name: info.characterName,
                initiative: 0,
                currentHp: hp,
                maxHp,
                ac,
                isPlayer: true,
                playerId: uid,
                conditions: [],
            });
        });
        setCombatants(prev => [...prev, ...toAdd]);
    }

    function applyHpDelta(id: string, delta: number) {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, currentHp: Math.max(0, Math.min(c.maxHp, c.currentHp + delta)) }
            : c,
        ));
        setHpEditId(null);
        setHpDeltaStr('');
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

    const hpDelta = Math.abs(parseInt(hpDeltaStr) || 0);

    return (
        <div className="init-tracker">
            {/* ── Header ── */}
            <div className="init-header">
                {/* Top row: round + turn counter + actions */}
                <div className="init-header-top">
                    <div className="init-round-badge">
                        <GiCrossedSwords size={10} />
                        Round {round}
                    </div>
                    {sorted.length > 0 && (
                        <span className="init-turn-counter">
                            Turno&nbsp;{(currentIdx % sorted.length) + 1}&nbsp;/&nbsp;{sorted.length}
                        </span>
                    )}
                    <div className="init-header-actions">
                        {Object.keys(playerCharacters).length > 0 && (
                            <button className="init-action-btn" onClick={populateFromPlayers} title="Aggiungi tutti i PG alla scena">
                                <FaUsers size={10} /> PG
                            </button>
                        )}
                        <button className={`init-action-btn${showAdd ? ' active' : ''}`} onClick={() => setShowAdd(v => !v)}>
                            <FaPlus size={9} /> Mostro
                        </button>
                        <button className="init-action-btn init-reset-btn" onClick={resetCombat} title="Resetta il combattimento">
                            Reset
                        </button>
                    </div>
                </div>
                {/* Bottom row: turn navigation */}
                <div className="init-header-nav">
                    <button className="init-nav-btn" onClick={prevTurn} disabled={sorted.length === 0} title="Turno precedente">
                        <FaChevronLeft size={10} />
                    </button>
                    <div className="init-current-info">
                        {sorted.length > 0 ? (
                            <>
                                <GiCrossedSwords size={13} className="init-current-sword" />
                                <span className="init-current-name">
                                    {sorted[currentIdx % sorted.length]?.name ?? '—'}
                                </span>
                            </>
                        ) : (
                            <span className="init-current-empty">— nessun combattente —</span>
                        )}
                    </div>
                    <button className="init-nav-btn init-nav-next" onClick={nextTurn} disabled={sorted.length === 0} title="Fine turno">
                        Fine turno <GiCrossedSwords size={10} />
                    </button>
                </div>
            </div>

            {/* Add form */}
            {showAdd && (
                <div className="init-add-form">
                    <input
                        className="init-form-input init-form-name"
                        placeholder="Nome mostro / NPC"
                        value={addName}
                        onChange={e => setAddName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCombatant()}
                        autoFocus
                    />
                    <div className="init-form-field">
                        <label className="init-form-label">Init</label>
                        <input className="init-form-input init-form-short" type="number" value={addInit} onChange={e => setAddInit(e.target.value)} />
                    </div>
                    <div className="init-form-field">
                        <label className="init-form-label">PF</label>
                        <input className="init-form-input init-form-short" type="number" value={addHp} onChange={e => setAddHp(e.target.value)} />
                    </div>
                    <div className="init-form-field">
                        <label className="init-form-label">CA</label>
                        <input className="init-form-input init-form-short" type="number" value={addAc} onChange={e => setAddAc(e.target.value)} />
                    </div>
                    <div className="init-form-actions">
                        <button className="btn-primary" style={{ padding: '0.28rem 0.7rem' }} onClick={addCombatant} disabled={!addName.trim()}>
                            <FaPlus size={10} />
                        </button>
                        <button className="btn-ghost" style={{ padding: '0.28rem 0.5rem' }} onClick={() => setShowAdd(false)}>
                            <FaTimes size={11} />
                        </button>
                    </div>
                </div>
            )}

                    {/* ── Column headers ── */}
                    {sorted.length > 0 && (
                        <div className="init-col-headers">
                            <span>Init</span>
                            <span>Combattente</span>
                            <span>PF</span>
                            <span>CA</span>
                            <span />
                        </div>
                    )}

                    {/* ── List ── */}
                    <div className="init-list">
                        {sorted.length === 0 && (
                            <div className="init-empty">
                                <div className="init-empty-watermark">⚔</div>
                                <p className="init-empty-title">Nessun combattente</p>
                                <p className="init-empty-sub">
                                    Usa <strong>PG</strong> per aggiungere i giocatori<br />
                                    o <strong>Mostro</strong> per nemici e NPC
                                </p>
                            </div>
                        )}
                        {sorted.map((c) => {
                            const isCurrent = c.id === currentId;
                            const hpPct = c.maxHp > 0 ? Math.max(0, c.currentHp / c.maxHp) : 0;
                            const hpColor = c.currentHp <= 0 ? '#c0392b' : hpPct > 0.5 ? '#4caf7d' : hpPct > 0.25 ? '#f0c040' : '#e05030';
                            const isHpEditing = hpEditId === c.id;

                            return (
                                <div
                                    key={c.id}
                                    className={[
                                        'init-entry',
                                        isCurrent ? 'current' : '',
                                        c.currentHp <= 0 ? 'dead' : '',
                                        c.isPlayer ? 'is-player' : 'is-monster',
                                    ].filter(Boolean).join(' ')}
                                >
                                    {/* Initiative */}
                                    <div className="init-init-col">
                                        <input
                                            className="init-init-input"
                                            type="number"
                                            value={c.initiative}
                                            onChange={e => updateInit(c.id, e.target.value)}
                                            title="Modifica iniziativa"
                                        />
                                    </div>

                                    {/* Name + HP bar + conditions */}
                                    <div className="init-entry-main">
                                        <div className="init-entry-name">
                                            {isCurrent && <GiCrossedSwords size={10} className="init-entry-sword" />}
                                            <span className="init-name-text">{c.name}</span>
                                            {c.isPlayer && <span className="init-pg-badge">PG</span>}
                                            {c.currentHp <= 0 && <span className="init-ko-badge">KO</span>}
                                        </div>
                                        <div className="init-hp-bar-wrap">
                                            <div
                                                className="init-hp-bar"
                                                style={{ width: `${hpPct * 100}%`, background: hpColor, boxShadow: `0 0 5px ${hpColor}55` }}
                                            />
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

                                    {/* HP */}
                                    <div className="init-hp-col">
                                        {isHpEditing ? (
                                            <div className="init-hp-edit">
                                                <input
                                                    className="init-hp-edit-input"
                                                    type="number"
                                                    min="0"
                                                    value={hpDeltaStr}
                                                    onChange={e => setHpDeltaStr(e.target.value)}
                                                    placeholder="0"
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') applyHpDelta(c.id, -hpDelta);
                                                        if (e.key === 'Escape') { setHpEditId(null); setHpDeltaStr(''); }
                                                    }}
                                                />
                                                <button className="init-hp-dmg-btn" onClick={() => applyHpDelta(c.id, -hpDelta)} disabled={hpDelta === 0} title={`-${hpDelta} PF (danno)`}>
                                                    <FaMinus size={8} />
                                                </button>
                                                <button className="init-hp-heal-btn" onClick={() => applyHpDelta(c.id, hpDelta)} disabled={hpDelta === 0} title={`+${hpDelta} PF (cura)`}>
                                                    <FaPlus size={8} />
                                                </button>
                                                <button className="init-hp-cancel-btn" onClick={() => { setHpEditId(null); setHpDeltaStr(''); }}>
                                                    <FaTimes size={8} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span
                                                className={`init-hp-chip${!c.isPlayer ? ' editable' : ''}`}
                                                style={{ color: hpColor }}
                                                onClick={() => !c.isPlayer && setHpEditId(c.id)}
                                                title={c.isPlayer ? 'PF in tempo reale dal personaggio' : 'Clicca per modificare PF'}
                                            >
                                                {c.isPlayer && <FaHeart size={8} className="init-hp-sync-icon" />}
                                                <span className="init-hp-current">{c.currentHp}</span>
                                                <span className="init-hp-sep">/{c.maxHp}</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* CA */}
                                    <div className="init-ac-col">
                                        {c.ac != null ? (
                                            <span className="init-ac-chip">
                                                <FaShieldAlt size={9} />
                                                {c.ac}
                                            </span>
                                        ) : (
                                            <span className="init-ac-empty">—</span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="init-entry-actions">
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                className="init-action-icon-btn"
                                                onClick={() => setShowCondMenu(m => m === c.id ? null : c.id)}
                                                title="Condizioni"
                                            >
                                                <FaSkull size={9} />
                                                {c.conditions.length > 0 && (
                                                    <span className="init-cond-count">{c.conditions.length}</span>
                                                )}
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
                                            className="init-action-icon-btn init-remove-btn"
                                            onClick={() => removeCombatant(c.id)}
                                            title="Rimuovi dal combattimento"
                                        >
                                            <FaTimes size={9} />
                                        </button>
                                    </div>
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

            export function CampaignPage({userId, userEmail, userDisplayName, initialCampaign, onBack}: Props) {
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
                    const [linkedChars, setLinkedChars] = useState<Record<string, CharacterBase>>({ });
                        const [selectedUid, setSelectedUid] = useState<string | null>(null);
                        const [detailTab, setDetailTab] = useState<DetailTab>('chat');
                            const [mobileDetail, setMobileDetail] = useState(false);
                            const [playerSearch, setPlayerSearch] = useState('');
                            const [allMessages, setAllMessages] = useState<Record<string, CampaignMessage[]>>({ });
                                const [chatReadAt, setChatReadAt] = useState<Record<string, number>>({ });
                                    const [copied, setCopied] = useState(false);
                                    const [confirmDelete, setConfirmDelete] = useState(false);

                                    const prevMsgCountsRef = useRef<Record<string, number>>({ });
                                        const initialLoadDoneRef = useRef<Record<string, boolean>>({ });

    // ── When opened via initialCampaign, restore chatReadAt from localStorage ──
    useEffect(() => {
        if (!initialCampaign?.id) return;
                                            try {
            const stored = localStorage.getItem(`dnd_chatReadAt_${userId}_${initialCampaign.id}`);
                                            if (stored) setChatReadAt(JSON.parse(stored));
        } catch { /* ignore */}
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
                if (char) setLinkedChars(prev => ({...prev, [uid]: char }));
            }),
                                            );
        return () => unsubs.forEach(u => u());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, masterCampaign?.id, JSON.stringify(Object.keys(masterCampaign?.playerCharacters ?? { }))]);

    // ── Subscribe to player chats ─────────────────────────
    useEffect(() => {
        if (view !== 'master' || !masterCampaign?.id) return;
                                            const playerIds = Object.keys(masterCampaign.playerCharacters ?? { });
        const unsubs = playerIds.map(uid =>
            subscribeToPlayerChat(masterCampaign!.id, uid, msgs =>
                setAllMessages(prev => ({...prev, [uid]: msgs })),
                                            ),
                                            );
        return () => unsubs.forEach(u => u());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, masterCampaign?.id, JSON.stringify(Object.keys(masterCampaign?.playerCharacters ?? { }))]);

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
                                                                try { localStorage.setItem(`dnd_chatReadAt_${userId}_${masterCampaign.id}`, JSON.stringify(updated)); } catch { }
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
            const updated = {...p, [uid]: now };
                                            if (masterCampaign?.id) {
                try {localStorage.setItem(`dnd_chatReadAt_${userId}_${masterCampaign.id}`, JSON.stringify(updated)); } catch { }
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
                                            setChatReadAt(stored ? JSON.parse(stored) : { });
        } catch {setChatReadAt({}); }

                                            setMasterCampaign(c);
                                            setSection('players');
                                            setSelectedUid(null);
                                            setMobileDetail(false);
                                            setPlayerSearch('');
                                            setAllMessages({ });
                                            prevMsgCountsRef.current = { };
                                            initialLoadDoneRef.current = { };
                                            setView('master');
    }

                                            function backToList() {
        if (onBack) {onBack(); return; }
                                            setMasterCampaign(null);
                                            setSelectedUid(null);
                                            setLinkedChars({ });
                                            setAllMessages({ });
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
        } finally {setCreating(false); }
    }

                                            async function handleDeleteCampaign() {
        if (!masterCampaign) return;
                                            const charIds = Object.values(masterCampaign.playerCharacters || { }).map(p => p.characterId);
                                            await deleteCampaign(masterCampaign.id, charIds);
                                            backToList();
    }

                                            function handleCopyCode() {
        if (!masterCampaign) return;
        navigator.clipboard.writeText(masterCampaign.inviteCode).catch(() => { });
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
        const playerEntries = Object.entries(masterCampaign.playerCharacters || { });
                                            const filteredPlayers = playerSearch.trim()
            ? playerEntries.filter(([, info]) =>
                                            info.characterName.toLowerCase().includes(playerSearch.toLowerCase()) ||
                                            info.playerName.toLowerCase().includes(playerSearch.toLowerCase()),
                                            )
                                            : playerEntries;

        const totalUnread = playerEntries.reduce((s, [uid]) => s + getUnreadCount(uid), 0);
                                            const selectedInfo = selectedUid ? masterCampaign.playerCharacters?.[selectedUid] : null;
                                            const selectedChar = selectedUid ? linkedChars[selectedUid] : undefined;

                                            const metaNav: {id: MasterSection; label: string; icon: React.ReactNode; badge?: number }[] = [
                                            {id: 'players', label: 'Avventurieri', icon: <FaUsers size={16} />, badge: totalUnread || undefined },
                                            {id: 'notes', label: 'Note DM', icon: <FaStickyNote size={16} /> },
                                            {id: 'glossary', label: 'Glossario', icon: <FaBook size={15} /> },
                                            {id: 'initiative', label: 'Iniziativa', icon: <GiCrossedSwords size={18} /> },
                                            {id: 'info', label: 'Campagna', icon: <FaCog size={15} /> },
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

                                                        {/* GLOSSARY section */}
                                                        {section === 'glossary' && (
                                                            <MasterGlossaryPanel
                                                                campaignId={masterCampaign.id}
                                                                masterId={userId}
                                                                playerCharacters={masterCampaign.playerCharacters ?? {}}
                                                            />
                                                        )}

                                                        {/* INITIATIVE section — always mounted to preserve combat state across tab changes */}
                                                        <div style={{ display: section === 'initiative' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                                                            <InitiativeTracker
                                                                linkedChars={linkedChars}
                                                                playerCharacters={masterCampaign.playerCharacters ?? {}}
                                                                campaignId={masterCampaign.id}
                                                                savedCombat={masterCampaign.initiativeCombat}
                                                            />
                                                        </div>

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

