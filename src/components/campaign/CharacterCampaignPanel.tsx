import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaBook, FaComments, FaSearch, FaSignOutAlt, FaTimes, FaUserShield } from 'react-icons/fa';
import { GiCastle } from 'react-icons/gi';
import { GlossaryDetailsModal, type GlossaryHoverEntry } from '../notes/notesShared';
import '../dashboard/widgets/styles/notes.css';
import {
    findCampaignByCode,
    joinCampaign,
    leaveCampaign,
    subscribeToCampaign,
    subscribeToPlayerChat,
    subscribePlayerCampaignGlossary,
} from '../../services/campaign';
import type { Campaign, CampaignMessage, CampaignGlossaryEntry } from '../../types/campaign';
import { useCharacterStore } from '../../store/characterStore';
import { CampaignChatPanel } from './CampaignPage';
import './CampaignPage.css';

const CAT_COLORS_CCP: Record<CampaignGlossaryEntry['category'], string> = {
    person: '#6ab4ff', place: '#6aff9e', item: '#ffb46a', lore: '#c86aff', other: '#aaaaaa',
};
const CAT_LABELS_CCP: Record<CampaignGlossaryEntry['category'], string> = {
    person: 'Persona', place: 'Luogo', item: 'Oggetto', lore: 'Lore', other: 'Altro',
};
const ALL_CATS_CCP = ['person', 'place', 'item', 'lore', 'other'] as const;

// ─── Glossary tab sub-component ───────────────────────────────────────────────

interface GlossaryTabProps {
    entries: CampaignGlossaryEntry[];
    glossSearch: string;
    setGlossSearch: (v: string) => void;
    glossCatFilter: CampaignGlossaryEntry['category'] | 'all';
    setGlossCatFilter: (v: CampaignGlossaryEntry['category'] | 'all') => void;
    onOpenModal: (entry: GlossaryHoverEntry) => void;
}

function GlossaryTabContent({ entries, glossSearch, setGlossSearch, glossCatFilter, setGlossCatFilter, onOpenModal }: GlossaryTabProps) {
    const filtered = useMemo(() => entries.filter(e => {
        if (glossCatFilter !== 'all' && e.category !== glossCatFilter) return false;
        if (glossSearch.trim()) {
            const q = glossSearch.toLowerCase();
            const infoText = (e.sections ?? []).map(s => `${s.label} ${s.content}`).join(' ') || e.info || '';
            return e.term.toLowerCase().includes(q) || infoText.toLowerCase().includes(q);
        }
        return true;
    }), [entries, glossSearch, glossCatFilter]);

    // Group by category (preserve ALL_CATS_CCP order)
    const grouped = useMemo(() => {
        const map = new Map<CampaignGlossaryEntry['category'], CampaignGlossaryEntry[]>();
        for (const cat of ALL_CATS_CCP) map.set(cat, []);
        for (const e of filtered) map.get(e.category)?.push(e);
        return map;
    }, [filtered]);

    function openEntry(entry: CampaignGlossaryEntry) {
        const info = (entry.sections ?? []).length > 0
            ? entry.sections.map(sec => sec.label ? `${sec.label}\n${sec.content}` : sec.content).join('\n\n')
            : (entry.info || 'Nessuna descrizione disponibile.');
        onOpenModal({ id: `cmp-${entry.id}`, term: entry.term, info, category: entry.category });
    }

    return (
        <div className="campaign-player-tab-content campaign-glossary-tab">
            <div className="campaign-gloss-search">
                <FaSearch size={9} className="campaign-gloss-search-ico" />
                <input
                    className="campaign-gloss-search-inp"
                    placeholder="Cerca voci…"
                    value={glossSearch}
                    onChange={e => setGlossSearch(e.target.value)}
                />
                {glossSearch && (
                    <button className="campaign-gloss-clear-btn" onClick={() => setGlossSearch('')}>
                        <FaTimes size={8} />
                    </button>
                )}
            </div>

            {/* Category filters */}
            <div className="campaign-gloss-filters">
                {(['all', ...ALL_CATS_CCP] as const).map(c => (
                    <button
                        key={c}
                        className={`campaign-gloss-cat-filter ${glossCatFilter === c ? 'active' : ''}`}
                        style={{ '--filter-c': c === 'all' ? 'var(--accent-gold)' : CAT_COLORS_CCP[c as CampaignGlossaryEntry['category']] } as React.CSSProperties}
                        onClick={() => setGlossCatFilter(c === glossCatFilter ? 'all' : c as CampaignGlossaryEntry['category'])}
                    >
                        {c === 'all' ? 'Tutti' : CAT_LABELS_CCP[c as CampaignGlossaryEntry['category']]}
                    </button>
                ))}
            </div>

            {entries.length === 0 ? (
                <div className="campaign-player-tab-empty">
                    <FaBook size={24} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                    <span>Il Master non ha ancora condiviso voci di glossario.</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="campaign-player-tab-empty">
                    <FaSearch size={20} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                    <span>Nessun risultato per "{glossSearch || CAT_LABELS_CCP[glossCatFilter as CampaignGlossaryEntry['category']]}"</span>
                </div>
            ) : (
                <div className="campaign-glossary-list">
                    {ALL_CATS_CCP.map(cat => {
                        const group = grouped.get(cat) ?? [];
                        if (group.length === 0) return null;
                        return (
                            <div key={cat} className="campaign-glossary-group">
                                <div className="campaign-glossary-group-header" style={{ '--group-c': CAT_COLORS_CCP[cat] } as React.CSSProperties}>
                                    <span className="campaign-glossary-dot" style={{ background: CAT_COLORS_CCP[cat] }} />
                                    {CAT_LABELS_CCP[cat]}
                                    <span className="campaign-player-tab-badge">{group.length}</span>
                                </div>
                                {group.map(entry => {
                                    const preview = (entry.sections ?? []).length > 0
                                        ? (entry.sections[0].content ?? '').slice(0, 70)
                                        : (entry.info ?? '').slice(0, 70);
                                    return (
                                        <button
                                            key={entry.id}
                                            className="campaign-glossary-entry"
                                            onClick={() => openEntry(entry)}
                                        >
                                            <span className="campaign-glossary-dot" style={{ background: CAT_COLORS_CCP[entry.category] }} />
                                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.term}</div>
                                                {preview && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}{preview.length >= 70 ? '…' : ''}</div>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    userId: string;
    userDisplayName: string;
}

export function CharacterCampaignPanel({ userId, userDisplayName }: Props) {
    const { character, setCharacter } = useCharacterStore();

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [chatMessages, setChatMessages] = useState<CampaignMessage[]>([]);
    const [campaignGlossary, setCampaignGlossary] = useState<CampaignGlossaryEntry[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [playerTab, setPlayerTab] = useState<'chat' | 'glossary'>('chat');
    const [glossSearch, setGlossSearch] = useState('');
    const [glossCatFilter, setGlossCatFilter] = useState<CampaignGlossaryEntry['category'] | 'all'>('all');
    const [glossModal, setGlossModal] = useState<GlossaryHoverEntry | null>(null);

    // ── Subscribe to linked campaign (real-time) ──────────
    useEffect(() => {
        if (!character?.campaignId) {
            setCampaign(null);
            return;
        }
        return subscribeToCampaign(character.campaignId, c => setCampaign(c));
    }, [character?.campaignId]);

    // ── Subscribe to chat messages (for display) ──────────
    useEffect(() => {
        if (!character?.campaignId) {
            setChatMessages([]);
            return;
        }
        return subscribeToPlayerChat(character.campaignId, userId, setChatMessages);
    }, [character?.campaignId, userId]);

    // ── Subscribe to campaign glossary ────────────────────
    useEffect(() => {
        if (!character?.campaignId) {
            setCampaignGlossary([]);
            return;
        }
        return subscribePlayerCampaignGlossary(character.campaignId, userId, setCampaignGlossary);
    }, [character?.campaignId, userId]);

    async function handleJoin() {
        if (!character || joinCode.length < 6 || joining) return;
        setJoining(true);
        setJoinError('');
        try {
            const found = await findCampaignByCode(joinCode);
            if (!found) {
                setJoinError('Codice non valido. Controlla e riprova.');
                return;
            }
            await joinCampaign(found.id, found.masterId, userId, character.id, character.name, userDisplayName);
            setCharacter({ ...character, campaignId: found.id, masterId: found.masterId });
        } catch {
            setJoinError("Errore durante l'adesione alla campagna.");
        } finally {
            setJoining(false);
        }
    }

    async function handleLeave() {
        if (!character?.campaignId) return;
        await leaveCampaign(character.campaignId, userId, character.id);
        const updated = { ...character };
        delete updated.campaignId;
        delete updated.masterId;
        setCharacter(updated);
        setCampaign(null);
        setConfirmLeave(false);
    }

    if (!character) return null;

    // ── Not linked ────────────────────────────────────────
    if (!character.campaignId) {
        return (
            <div className="campaign-page animate-fade-in">
                <div className="campaign-form-panel">
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗺️</div>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>
                            Campagna
                        </h2>
                        <p className="text-muted text-sm">
                            Collegati a una campagna con il codice invito del tuo Master.<br />
                            Personaggio: <strong style={{ color: 'var(--text-primary)' }}>{character.name}</strong>
                        </p>
                    </div>

                    <div className="campaign-field">
                        <label>Codice Invito</label>
                        <input
                            value={joinCode}
                            onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setJoinError(''); }}
                            placeholder="ABCDEF"
                            maxLength={6}
                            autoFocus
                            style={{ textTransform: 'uppercase', letterSpacing: '0.25em', fontFamily: 'monospace', fontSize: '1.3rem', textAlign: 'center' }}
                        />
                        {joinError && <span className="campaign-error">{joinError}</span>}
                    </div>

                    <button
                        className="btn-primary w-full"
                        style={{ justifyContent: 'center' }}
                        onClick={handleJoin}
                        disabled={joinCode.length < 6 || joining}
                    >
                        <GiCastle /> {joining ? 'Connessione…' : 'Unisciti alla Campagna'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Linked but campaign data still loading ─────────────
    if (!campaign) {
        return (
            <div className="campaign-page">
                <div className="campaign-loading">Caricamento campagna…</div>
            </div>
        );
    }

    // ── Player view ────────────────────────────────────────
    return (
        <div className="campaign-page">
            <div className="campaign-player-page">
                {/* Header */}
                <div className="campaign-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2>{campaign.name}</h2>
                        {campaign.description && (
                            <p className="text-muted text-sm" style={{ margin: 0 }}>{campaign.description}</p>
                        )}
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.75rem', flexShrink: 0 }}>
                        <FaUserShield style={{ marginRight: 4 }} />
                        {campaign.masterDisplayName}
                    </span>
                </div>

                {/* Character info row */}
                <div className="campaign-player-char-info">
                    <div className="campaign-char-avatar" style={{ width: 48, height: 48, fontSize: '1.3rem' }}>
                        {character.avatarUrl
                            ? <img src={character.avatarUrl} alt={character.name} />
                            : character.name.charAt(0)
                        }
                    </div>
                    <div>
                        <div className="font-heading" style={{ color: 'var(--text-primary)' }}>{character.name}</div>
                        <div className="text-xs text-muted">{character.race} {character.characterClass} — Lv. {character.level}</div>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="campaign-player-tabs">
                    <button
                        className={`campaign-player-tab${playerTab === 'chat' ? ' active' : ''}`}
                        onClick={() => setPlayerTab('chat')}
                    >
                        <FaComments size={12} />
                        Chat con il Master
                    </button>
                    <button
                        className={`campaign-player-tab${playerTab === 'glossary' ? ' active' : ''}`}
                        onClick={() => setPlayerTab('glossary')}
                    >
                        <FaBook size={12} />
                        Glossario
                        {campaignGlossary.length > 0 && (
                            <span className="campaign-player-tab-badge">{campaignGlossary.length}</span>
                        )}
                    </button>
                </div>

                {/* Tab content */}
                {playerTab === 'glossary' && (
                    <GlossaryTabContent
                        entries={campaignGlossary}
                        glossSearch={glossSearch}
                        setGlossSearch={setGlossSearch}
                        glossCatFilter={glossCatFilter}
                        setGlossCatFilter={setGlossCatFilter}
                        onOpenModal={setGlossModal}
                    />
                )}

                {playerTab === 'chat' && (
                    <div className="campaign-chat-section">
                        <CampaignChatPanel
                            campaignId={character.campaignId}
                            playerId={userId}
                            from="player"
                            fromName={userDisplayName}
                            messages={chatMessages}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="campaign-player-footer">
                    <button
                        className="btn-ghost text-sm"
                        style={{ color: 'var(--accent-crimson)' }}
                        onClick={() => setConfirmLeave(true)}
                    >
                        <FaSignOutAlt /> Lascia la campagna
                    </button>
                </div>
            </div>

            {/* Glossary popup */}
            {glossModal && (
                <GlossaryDetailsModal
                    entry={glossModal}
                    onClose={() => setGlossModal(null)}
                />
            )}

            {/* Confirm leave modal */}
            {confirmLeave && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="glass-panel animate-fade-in" style={{ width: 340, textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚪</div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)', marginBottom: '0.5rem' }}>
                            Lascia la Campagna
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                            Sei sicuro di voler scollegare <strong style={{ color: 'var(--text-primary)' }}>{character.name}</strong> dalla campagna <strong style={{ color: 'var(--text-primary)' }}>{campaign.name}</strong>?
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => setConfirmLeave(false)}>
                                Annulla
                            </button>
                            <button
                                className="btn-primary w-full"
                                style={{ justifyContent: 'center', background: 'var(--accent-crimson)', borderColor: 'var(--accent-crimson)' }}
                                onClick={handleLeave}
                            >
                                <FaSignOutAlt size={11} /> Lascia
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
