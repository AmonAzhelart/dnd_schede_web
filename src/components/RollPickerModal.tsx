import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaDiceD20, FaCheck } from 'react-icons/fa';
import { useCharacterStore } from '../store/characterStore';
import {
    aggregateBonuses,
    ROLL_CHANNEL_LABELS,
    type ModifierCandidate,
    type RollContext,
} from '../services/modifiers';
import type { ModifierType } from '../types/dnd';

/** Single line in the "base" breakdown column (BAB / stat mod / size / …). */
export interface RollBreakdownLine {
    label: string;
    value: number;
}

/** A single roll panel inside the modal. The modal can show one or many
 *  segments (e.g. attack + damage together). Each segment is self-contained:
 *  own RollContext, own base breakdown, own dice expression. */
export interface RollSegment {
    ctx: RollContext;
    /** Heading label shown above the segment (e.g. "Tiro per colpire", "Danno"). */
    label: string;
    baseBreakdown: RollBreakdownLine[];
    /** Optional dice expression for the segment (e.g. weapon "1d6"). */
    baseDice?: string;
}

export interface RollPickerProps {
    // ── Single-segment shorthand (legacy / simple use cases) ──
    ctx?: RollContext;
    baseBreakdown?: RollBreakdownLine[];
    baseDice?: string;
    // ── OR multi-segment (e.g. attack+damage shown together) ──
    segments?: RollSegment[];
    /** Modal heading. Defaults to channel label when single-segment. */
    title?: string;
    subtitle?: string;
    /** Optional content rendered below the segments and above the buttons.
     *  Useful for spell descriptions, item flavor text, etc. */
    footer?: React.ReactNode;
    /** Optional callback invoked when the user clicks Confirm (after resources
     *  have been consumed). Useful for committing actions like spending a spell
     *  slot or marking an item as used. */
    onConfirm?: () => void;
    onClose: () => void;
}

const TYPE_LABEL: Record<ModifierType, string> = {
    enhancement: 'Potenziamento', armor: 'Armatura', deflection: 'Deviazione',
    dodge: 'Schivata', naturalArmor: 'Arm. naturale', shield: 'Scudo',
    circumstance: 'Circostanza', untyped: 'Senza tipo', resistance: 'Resistenza',
    sacred: 'Sacro', profane: 'Profano', insight: 'Intuizione',
    morale: 'Morale', luck: 'Fortuna', competence: 'Competenza',
    racial: 'Razziale', size: 'Taglia', synergy: 'Sinergia',
};

const ACCENT_BY_CHANNEL: Record<string, string> = {
    attack: 'var(--accent-crimson)',
    damage: 'var(--accent-crimson)',
    ac: 'var(--accent-gold)',
    initiative: 'var(--accent-arcane)',
    'save.fort': 'var(--accent-success)',
    'save.ref': 'var(--accent-arcane)',
    'save.will': 'var(--accent-gold)',
};

function getAccent(channel: string): string {
    if (ACCENT_BY_CHANNEL[channel]) return ACCENT_BY_CHANNEL[channel];
    if (channel.startsWith('skill.')) return 'var(--accent-arcane)';
    if (channel.startsWith('check.')) return 'var(--accent-gold)';
    return 'var(--accent-arcane)';
}

/** Normalize an "extra dice" expression like "1d6", "+2d6 fuoco" → "1d6". */
function cleanDice(s: string | undefined): string | null {
    if (!s) return null;
    const m = s.trim().match(/^\+?\s*(\d+\s*d\s*\d+)/i);
    return m ? m[1].replace(/\s+/g, '') : (s.trim() || null);
}

/** Sum dice expressions of the same face (e.g. "1d6"+"2d6" = "3d6").
 *  Mixed faces stay separate ("1d6 + 1d8"). */
function combineDice(parts: string[]): string {
    const buckets: Record<number, number> = {};
    const others: string[] = [];
    parts.forEach(p => {
        const m = p.match(/^(\d+)d(\d+)$/i);
        if (m) {
            const n = parseInt(m[1], 10);
            const f = parseInt(m[2], 10);
            buckets[f] = (buckets[f] ?? 0) + n;
        } else {
            others.push(p);
        }
    });
    const merged = Object.entries(buckets)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .map(([face, count]) => `${count}d${face}`);
    return [...merged, ...others].join(' + ');
}

/** Inline value cell: "+1", "+1 +1d6", "+1d6". */
function valueCell(c: ModifierCandidate, color: string): React.ReactNode {
    const dice = cleanDice(c.extraDice);
    const parts: string[] = [];
    if (c.value !== 0) parts.push(`${c.value > 0 ? '+' : ''}${c.value}`);
    if (dice) parts.push(`+${dice}`);
    return (
        <span style={{ fontFamily: 'var(--font-mono, monospace)', color }}>
            {parts.join(' ') || '—'}
        </span>
    );
}

interface ResolvedSegment extends RollSegment {
    accent: string;
    candidates: ModifierCandidate[];
    auto: ModifierCandidate[];
    optional: ModifierCandidate[];
    blocked: ModifierCandidate[];
}

export const RollPickerModal: React.FC<RollPickerProps> = ({
    ctx, baseBreakdown, baseDice, segments, title, subtitle, footer, onConfirm, onClose,
}) => {
    const getApplicableModifiers = useCharacterStore(s => s.getApplicableModifiers);
    const character = useCharacterStore(s => s.character);
    const spendClassFeatureResource = useCharacterStore(s => s.spendClassFeatureResource);

    // Normalize props → segments[] (single-segment shorthand wraps to array).
    const rawSegments: RollSegment[] = useMemo(() => {
        if (segments && segments.length > 0) return segments;
        if (ctx) {
            const lbl = ROLL_CHANNEL_LABELS.find(r => r.value === ctx.channel)?.label ?? ctx.channel;
            return [{ ctx, label: lbl, baseBreakdown: baseBreakdown ?? [], baseDice }];
        }
        return [];
    }, [segments, ctx, baseBreakdown, baseDice]);

    // Resolve candidates per segment.
    const resolved: ResolvedSegment[] = useMemo(() => rawSegments.map(seg => {
        const cands = getApplicableModifiers(seg.ctx);
        return {
            ...seg,
            accent: getAccent(seg.ctx.channel),
            candidates: cands,
            auto: cands.filter(c => c.auto),
            optional: cands.filter(c => !c.auto && c.available),
            blocked: cands.filter(c => !c.available),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [getApplicableModifiers, JSON.stringify(rawSegments.map(s => s.ctx))]);

    // Selection state keyed by `${segIdx}:${candId}`.
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [confirmed, setConfirmed] = useState(false);
    useEffect(() => {
        setSelected({});
        setConfirmed(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(rawSegments.map(s => s.ctx))]);

    const isSelected = (segIdx: number, id: string) => !!selected[`${segIdx}:${id}`];
    const toggleSelected = (segIdx: number, id: string, on: boolean) =>
        setSelected(s => ({ ...s, [`${segIdx}:${id}`]: on }));

    /** Per-segment derived totals + dice. */
    const segmentTotals = resolved.map((seg, i) => {
        const baseTotal = seg.baseBreakdown.reduce((s, b) => s + b.value, 0);
        const autoBonus = aggregateBonuses(seg.auto);
        const chosen = seg.optional.filter(o => isSelected(i, o.id));
        const allApplied = [...seg.auto, ...chosen];
        const totalBonus = aggregateBonuses(allApplied);
        const optionalDelta = totalBonus - autoBonus;
        const grandTotal = baseTotal + totalBonus;
        const diceParts: string[] = [];
        const baseClean = cleanDice(seg.baseDice);
        if (baseClean) diceParts.push(baseClean);
        allApplied.forEach(c => {
            const d = cleanDice(c.extraDice);
            if (d) diceParts.push(d);
        });
        return { baseTotal, autoBonus, optionalDelta, grandTotal, allApplied, chosen, diceParts };
    });

    /** Resources consumed (deduped) across every applied modifier in any segment. */
    const consumables = useMemo(() => {
        if (!character) return [] as { id: string; name: string; remaining: number; max: number }[];
        const sources = new Set<string>();
        segmentTotals.forEach(({ allApplied }) => {
            allApplied.forEach(c => {
                if (c.sourceKind === 'feature') sources.add(c.sourceId);
            });
        });
        return (character.classFeatures ?? [])
            .filter(f => sources.has(f.id))
            .filter(f => (f.resourceMax ?? 0) > 0)
            .map(f => ({
                id: f.id,
                name: f.name,
                max: f.resourceMax ?? 0,
                remaining: (f.resourceMax ?? 0) - (f.resourceUsed ?? 0),
            }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [character, JSON.stringify(segmentTotals.map(s => s.allApplied.map(a => a.sourceId)))]);

    const handleConfirm = () => {
        consumables.forEach(c => {
            if (c.remaining > 0) spendClassFeatureResource(c.id);
        });
        if (onConfirm) onConfirm();
        setConfirmed(true);
        setTimeout(() => onClose(), 600);
    };

    // Header accent: use first segment's accent.
    const headerAccent = resolved[0]?.accent ?? 'var(--accent-arcane)';
    const headerTitle = title
        ?? (resolved.length === 1
            ? resolved[0].label
            : resolved.map(s => s.label).join(' + '));

    const renderSegment = (seg: ResolvedSegment, i: number) => {
        const t = segmentTotals[i];
        const accent = seg.accent;
        return (
            <div key={i} style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: 10, borderRadius: 8,
                background: `${accent}08`,
                border: `1px solid ${accent}33`,
            }}>
                {/* Segment heading (only if there are multiple) */}
                {resolved.length > 1 && (
                    <div style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '1.05rem',
                        color: accent,
                        letterSpacing: '0.04em',
                        borderBottom: `1px dashed ${accent}44`,
                        paddingBottom: 4,
                    }}>
                        {seg.label}
                    </div>
                )}

                {/* Base breakdown */}
                <div style={{
                    padding: 10, borderRadius: 6,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>
                        BASE
                    </div>
                    {seg.baseBreakdown.length === 0 && !seg.baseDice ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {seg.baseBreakdown.map((b, k) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                    <span>{b.label}</span>
                                    <span style={{ fontFamily: 'var(--font-mono, monospace)', color: accent }}>
                                        {b.value >= 0 ? '+' : ''}{b.value}
                                    </span>
                                </div>
                            ))}
                            {seg.baseDice && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                    <span>Dadi base</span>
                                    <span style={{ fontFamily: 'var(--font-mono, monospace)', color: accent }}>
                                        {cleanDice(seg.baseDice)}
                                    </span>
                                </div>
                            )}
                            {seg.baseBreakdown.length > 0 && (
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    marginTop: 4, paddingTop: 4,
                                    borderTop: '1px dashed rgba(255,255,255,0.1)',
                                    fontSize: '0.82rem', fontWeight: 600,
                                }}>
                                    <span>Totale base</span>
                                    <span style={{ fontFamily: 'var(--font-mono, monospace)', color: accent }}>
                                        {t.baseTotal >= 0 ? '+' : ''}{t.baseTotal}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Auto */}
                {seg.auto.length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>
                            BONUS AUTOMATICI
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {seg.auto.map(c => (
                                <div key={c.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '5px 9px', borderRadius: 5,
                                    background: 'rgba(39,174,96,0.07)',
                                    border: '1px solid rgba(39,174,96,0.18)',
                                    fontSize: '0.8rem',
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span>{c.sourceName}</span>
                                        {c.label && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{c.label}</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                                        {valueCell(c, 'var(--accent-success)')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Optional */}
                {seg.optional.length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>
                            BONUS OPZIONALI · scegli quali applicare
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {seg.optional.map(c => {
                                const on = isSelected(i, c.id);
                                return (
                                    <label key={c.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '5px 9px', borderRadius: 5,
                                        background: on ? `${accent}15` : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${on ? `${accent}55` : 'rgba(255,255,255,0.07)'}`,
                                        cursor: 'pointer', fontSize: '0.8rem',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={e => toggleSelected(i, c.id, e.target.checked)}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>{c.sourceName}</span>
                                                {c.label && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{c.label}</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{TYPE_LABEL[c.type] ?? c.type}</span>
                                            {valueCell(c, accent)}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Blocked */}
                {seg.blocked.length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4 }}>
                            NON APPLICABILI
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {seg.blocked.map(c => (
                                <div key={c.id} style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    padding: '3px 7px', fontSize: '0.72rem',
                                    color: 'var(--text-muted)', opacity: 0.7,
                                }}>
                                    <span>{c.sourceName}{c.label ? ` · ${c.label}` : ''}</span>
                                    <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                                        {c.value >= 0 ? '+' : ''}{c.value}
                                        {c.extraDice ? ` +${cleanDice(c.extraDice)}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {seg.candidates.length === 0 && (
                    <div style={{
                        fontSize: '0.78rem', color: 'var(--text-muted)',
                        fontStyle: 'italic', textAlign: 'center', padding: 4,
                    }}>
                        Nessun modificatore aggiuntivo per questo {seg.label.toLowerCase()}.
                    </div>
                )}

                {/* Per-segment total */}
                <div style={{
                    padding: '10px 12px', borderRadius: 6,
                    background: `${accent}12`,
                    border: `1px solid ${accent}55`,
                    display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: 'var(--font-heading)',
                    }}>
                        <span style={{ fontSize: '0.88rem' }}>
                            {seg.label}: somma da aggiungere al d20
                        </span>
                        <span style={{
                            fontSize: '1.7rem', color: accent,
                            fontFamily: 'var(--font-mono, monospace)',
                        }}>
                            {t.grandTotal >= 0 ? '+' : ''}{t.grandTotal}
                        </span>
                    </div>
                    {t.diceParts.length > 0 && (
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.12)',
                            fontSize: '0.82rem',
                        }}>
                            <span style={{ color: 'var(--text-muted)' }}>Dadi da tirare</span>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', color: accent }}>
                                {combineDice(t.diceParts)}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const modalContent = (
        <div
            className="modal-overlay"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div
                className="modal-box flex-col gap-3"
                style={{
                    maxWidth: 720, width: '94%', maxHeight: '90vh', overflow: 'auto',
                    border: `1px solid ${headerAccent}66`,
                    boxShadow: `0 14px 60px ${headerAccent}22`,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                        <div style={{
                            fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: headerAccent,
                            letterSpacing: '0.04em',
                        }}>{headerTitle}</div>
                        {subtitle && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                {subtitle}
                            </div>
                        )}
                    </div>
                    <button className="btn-ghost" onClick={onClose} aria-label="Chiudi">
                        <FaTimes />
                    </button>
                </div>

                {/* Segments */}
                {resolved.map((seg, i) => renderSegment(seg, i))}

                {/* Optional footer (spell description, item flavor, etc.) */}
                {footer}

                {/* Roll-it-yourself reminder */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                    fontStyle: 'italic', justifyContent: 'center',
                }}>
                    <FaDiceD20 /> Tira tu i dadi e somma i modificatori indicati.
                </div>

                {/* Resources preview */}
                {consumables.length > 0 && (
                    <div style={{
                        padding: '8px 12px', borderRadius: 6,
                        background: 'rgba(192,57,43,0.08)',
                        border: '1px solid rgba(192,57,43,0.22)',
                        fontSize: '0.78rem',
                    }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', letterSpacing: '0.1em', marginBottom: 4 }}>
                            ALLA CONFERMA VERRANNO USATE
                        </div>
                        {consumables.map(c => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{c.name}</span>
                                <span style={{ color: c.remaining > 0 ? 'var(--accent-crimson)' : 'var(--text-muted)' }}>
                                    {c.remaining > 0
                                        ? `−1 uso (${c.remaining}/${c.max} rimanenti)`
                                        : 'esaurita'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.85rem' }}>
                        Chiudi
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleConfirm}
                        disabled={confirmed}
                        style={{
                            fontSize: '0.9rem',
                            opacity: confirmed ? 0.6 : 1,
                            background: confirmed ? 'var(--accent-success)' : undefined,
                        }}
                        title={consumables.length > 0
                            ? 'Conferma il tiro e consuma le risorse elencate'
                            : 'Conferma il tiro'}
                    >
                        <FaCheck size={11} /> {confirmed ? 'Confermato' : 'Conferma tiro'}
                    </button>
                </div>
            </div>
        </div>
    );

    // Portal so the modal stays viewport-centered regardless of ancestors.
    return createPortal(modalContent, document.body);
};
