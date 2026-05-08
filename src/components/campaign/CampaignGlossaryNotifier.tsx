/**
 * Always-mounted component (renders null + popup).
 * Subscribes to the player's visible campaign glossary entries.
 * Tracks seen state per SECTION (entryId::sectionId) so that when the master
 * reveals additional sections later, the player gets notified again.
 */
import { useEffect, useRef, useState } from 'react';
import { FaBook, FaTimes } from 'react-icons/fa';
import { subscribePlayerCampaignGlossary } from '../../services/campaign';
import { useCharacterStore } from '../../store/characterStore';
import type { CampaignGlossaryEntry, GlossarySection } from '../../types/campaign';

const CAT_COLORS: Record<CampaignGlossaryEntry['category'], string> = {
    person: '#6ab4ff', place: '#6aff9e', item: '#ffb46a', lore: '#c86aff', other: '#aaaaaa',
};
const CAT_LABELS: Record<CampaignGlossaryEntry['category'], string> = {
    person: 'Persona', place: 'Luogo', item: 'Oggetto', lore: 'Lore', other: 'Altro',
};

/** Key stored in localStorage per campaign. */
function seenKey(campaignId: string) { return `glossary-seen-v2-${campaignId}`; }

function getSeenKeys(campaignId: string): Set<string> {
    try {
        const raw = localStorage.getItem(seenKey(campaignId));
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
}

function markSeenKeys(campaignId: string, keys: string[]) {
    try {
        const seen = getSeenKeys(campaignId);
        keys.forEach(k => seen.add(k));
        localStorage.setItem(seenKey(campaignId), JSON.stringify([...seen]));
    } catch { /* ignore */ }
}

/** A pending notification: an entry + the sections that are newly visible. */
interface GlossaryNotif {
    entry: CampaignGlossaryEntry;
    /** Newly visible sections (or empty array for legacy entries with no sections). */
    newSections: GlossarySection[];
}

export function CampaignGlossaryNotifier() {
    const { character } = useCharacterStore();
    const campaignId = character?.campaignId;
    const userId = character?.userId;

    const initialLoadDoneRef = useRef(false);
    const [pending, setPending] = useState<GlossaryNotif[]>([]);
    const [current, setCurrent] = useState<GlossaryNotif | null>(null);

    useEffect(() => {
        initialLoadDoneRef.current = false;
        setPending([]);
        setCurrent(null);
    }, [campaignId, userId]);

    useEffect(() => {
        if (!campaignId || !userId) return;

        return subscribePlayerCampaignGlossary(campaignId, userId, entries => {
            if (!initialLoadDoneRef.current) {
                // First snapshot: silently mark everything as seen
                const keysToMark: string[] = [];
                entries.forEach(e => {
                    if ((e.sections ?? []).length > 0) {
                        e.sections.forEach(s => keysToMark.push(`${e.id}::${s.id}`));
                    } else {
                        keysToMark.push(e.id); // legacy
                    }
                });
                markSeenKeys(campaignId, keysToMark);
                initialLoadDoneRef.current = true;
                return;
            }

            const seen = getSeenKeys(campaignId);
            const newNotifs: GlossaryNotif[] = [];
            const toMark: string[] = [];

            for (const entry of entries) {
                const hasSections = (entry.sections ?? []).length > 0;
                if (hasSections) {
                    const newSections = entry.sections.filter(s => !seen.has(`${entry.id}::${s.id}`));
                    if (newSections.length > 0) {
                        newSections.forEach(s => toMark.push(`${entry.id}::${s.id}`));
                        newNotifs.push({ entry, newSections });
                    }
                } else {
                    // Legacy entry
                    if (!seen.has(entry.id)) {
                        toMark.push(entry.id);
                        newNotifs.push({ entry, newSections: [] });
                    }
                }
            }

            if (newNotifs.length > 0) {
                markSeenKeys(campaignId, toMark);
                setPending(prev => [...prev, ...newNotifs]);
            }
        });
    }, [campaignId, userId]);

    useEffect(() => {
        if (!current && pending.length > 0) {
            setCurrent(pending[0]);
            setPending(prev => prev.slice(1));
        }
    }, [pending, current]);

    if (!current) return null;

    const { entry, newSections } = current;
    const catColor = CAT_COLORS[entry.category];

    const isNewEntry = newSections.length === entry.sections?.length;
    const title = isNewEntry
        ? 'Nuova voce nel Glossario Campagna'
        : `${newSections.length} nuova sezione${newSections.length > 1 ? ' rivelata' : ' rivelata'} — ${entry.term}`;

    function dismiss() { setCurrent(null); }

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            onClick={dismiss}
        >
            <div
                className="glass-panel animate-fade-in"
                style={{ width: 440, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaBook size={14} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.82rem', color: 'var(--text-muted)', flex: 1 }}>
                        {title}
                    </span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }} onClick={dismiss}>
                        <FaTimes size={13} />
                    </button>
                </div>

                {/* Entry title + category */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: catColor, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{entry.term}</span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, border: `1px solid ${catColor}55`, color: catColor }}>
                        {CAT_LABELS[entry.category]}
                    </span>
                </div>

                {/* New sections */}
                {newSections.length > 0
                    ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {newSections.map(sec => (
                                <div key={sec.id} style={{ paddingLeft: '0.75rem', borderLeft: `3px solid ${catColor}66` }}>
                                    {sec.label && (
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                            {sec.label}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                                        {sec.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )
                    : entry.info && (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{entry.info}</p>
                    )
                }

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {pending.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                            +{pending.length} altra{pending.length > 1 ? 'e' : ''} in attesa
                        </span>
                    )}
                    <button className="btn-secondary" onClick={dismiss}>Chiudi</button>
                    {pending.length > 0 && (
                        <button className="btn-primary" onClick={dismiss}>Prossima →</button>
                    )}
                </div>
            </div>
        </div>
    );
}
