import { useEffect, useRef, useState } from 'react';
import { FaBook, FaComments, FaSignOutAlt, FaUserShield } from 'react-icons/fa';
import { GiCastle } from 'react-icons/gi';
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

                {/* Campaign Glossary */}
                {campaignGlossary.length > 0 && (
                    <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.5rem 0.4rem', fontFamily: 'var(--font-heading)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <FaBook size={12} style={{ color: 'var(--accent-gold)' }} />
                            Glossario Campagna
                            <span style={{ marginLeft: '0.25rem', background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{campaignGlossary.length}</span>
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto', padding: '0 1rem 0.5rem' }}>
                            {campaignGlossary.map(entry => (
                                <div key={entry.id} style={{ display: 'flex', gap: '0.5rem', padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'flex-start' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS_CCP[entry.category], flexShrink: 0, marginTop: 6 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.term}</span>
                                            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 10, border: `1px solid ${CAT_COLORS_CCP[entry.category]}55`, color: CAT_COLORS_CCP[entry.category], opacity: 0.85 }}>{CAT_LABELS_CCP[entry.category]}</span>
                                        </div>
                                        {/* Sections revealed by master */}
                                        {(entry.sections ?? []).length > 0
                                            ? (entry.sections ?? []).map(sec => (
                                                <div key={sec.id} style={{ marginTop: '0.3rem', paddingLeft: '0.5rem', borderLeft: `2px solid ${CAT_COLORS_CCP[entry.category]}44` }}>
                                                    {sec.label && <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{sec.label}</div>}
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{sec.content}</div>
                                                </div>
                                            ))
                                            : entry.info && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{entry.info}</div>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chat */}
                <div className="campaign-chat-section">
                    <h3><FaComments /> Chat con il Master</h3>
                    <CampaignChatPanel
                        campaignId={character.campaignId}
                        playerId={userId}
                        from="player"
                        fromName={userDisplayName}
                        messages={chatMessages}
                    />
                </div>

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
