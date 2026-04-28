/**
 * Shared creature stat-block components used by BestiaryPage and the
 * SummonsWidget popup.
 */
import React, { useCallback } from 'react';
import { FaTimes, FaDragon } from 'react-icons/fa';
import type { Creature, CreatureStatOverride } from '../types/dnd';
import './Bestiary.css';

/* ── helpers ───────────────────────────────────────────────────── */
export const mod = (score: number) => Math.floor((score - 10) / 2);
export const signMod = (score: number) => {
    const m = mod(score);
    return (m >= 0 ? '+' : '') + m;
};

/* ═══════════════════════════════════════════════════════════════
   CreaturePortrait
═══════════════════════════════════════════════════════════════ */
export interface PortraitProps {
    creature: Creature;
    size?: number;
    className?: string;
}

export const CreaturePortrait: React.FC<PortraitProps> = ({ creature, size = 48, className }) => {
    const style: React.CSSProperties = {
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: 'var(--radius-sm)',
        flexShrink: 0,
    };
    if (creature.imageData && creature.imageType === 'svg') {
        return (
            <div
                className={className}
                style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--bg-surface)' }}
                dangerouslySetInnerHTML={{ __html: creature.imageData }}
            />
        );
    }
    if (creature.imageData) {
        return <img src={creature.imageData} alt={creature.name} style={style} className={className} />;
    }
    return (
        <div
            className={className}
            style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', color: 'var(--accent-gold)', fontSize: size * 0.5 }}
        >
            <FaDragon />
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   StatBlock
═══════════════════════════════════════════════════════════════ */
export interface StatBlockProps {
    creature: Creature;
    overrides?: CreatureStatOverride[];
    onClose: () => void;
    actionLabel?: string;
    onAction?: () => void;
    actionIcon?: React.ReactNode;
    actionLabel2?: string;
    onAction2?: () => void;
    actionIcon2?: React.ReactNode;
    /** Extra content rendered below the description (e.g. HP controls) */
    extra?: React.ReactNode;
    /** If true, suppress the header row (portrait + name + close btn).
     *  Use when the parent renders its own header. */
    headless?: boolean;
}

export const StatBlock: React.FC<StatBlockProps> = ({
    creature, overrides, onClose,
    actionLabel, onAction, actionIcon,
    actionLabel2, onAction2, actionIcon2,
    extra, headless,
}) => {
    const effectiveStat = useCallback((key: keyof Creature) => {
        const base = (creature[key] as number) ?? 0;
        const bonus = (overrides ?? []).filter(o => o.stat === key).reduce((s, o) => s + o.value, 0);
        return base + bonus;
    }, [creature, overrides]);

    const effStr = effectiveStat('str'), effDex = effectiveStat('dex'), effCon = effectiveStat('con');
    const effInt = effectiveStat('int'), effWis = effectiveStat('wis'), effCha = effectiveStat('cha');
    const effHp = effectiveStat('hp'), effAc = effectiveStat('ac');

    return (
        <div className="creature-sheet">
            {!headless && (
            <div className="creature-sheet-header">
                <CreaturePortrait creature={creature} size={96} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>{creature.name}</h3>
                    <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                        {creature.size} {creature.type}{creature.subtype ? ` (${creature.subtype})` : ''} · {creature.alignment ?? 'N'}
                    </div>
                    <div className="flex gap-2" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                        {creature.challengeRating && <span className="badge-cr">CR {creature.challengeRating}</span>}
                        <span className="badge-type">{creature.type}</span>
                        {(creature.tags ?? []).map(t => <span key={t} className="badge-type" style={{ opacity: 0.75 }}>{t}</span>)}
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    {actionLabel && onAction && (
                        <button className="btn-primary text-sm" onClick={onAction}>{actionIcon} {actionLabel}</button>
                    )}
                    {actionLabel2 && onAction2 && (
                        <button className="btn-secondary text-sm" onClick={onAction2}>{actionIcon2} {actionLabel2}</button>
                    )}
                    <button className="btn-ghost text-sm" onClick={onClose}><FaTimes /> Chiudi</button>
                </div>
            </div>
            )}

            {/* Override chips */}
            {(overrides ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className="text-xs text-muted">Modificatori applicati:</span>
                    {overrides!.map((o, i) => (
                        <span key={i} className={`override-chip${o.value < 0 ? ' negative' : ''}`}>
                            {o.source}: {o.stat.toUpperCase()} {o.value > 0 ? '+' : ''}{o.value}
                        </span>
                    ))}
                </div>
            )}

            {/* Defenses row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {[
                    { label: 'PF', val: `${effHp}${creature.hpDice ? ` (${creature.hpDice})` : ''}`, color: 'var(--accent-crimson)' },
                    { label: 'CA', val: effAc.toString(), color: 'var(--accent-gold)' },
                    { label: 'BAB', val: `+${creature.bab}` },
                    { label: 'VEL', val: `${creature.speed}m` },
                    ...(creature.fly ? [{ label: 'VOLO', val: `${creature.fly}m` }] : []),
                    ...(creature.swim ? [{ label: 'NUOTO', val: `${creature.swim}m` }] : []),
                ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', textAlign: 'center', minWidth: 72 }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: s.color ?? 'inherit' }}>{s.val}</div>
                    </div>
                ))}
            </div>

            {/* Ability scores */}
            <div className="creature-ability-grid">
                {[
                    { key: 'str', label: 'FOR', val: effStr }, { key: 'dex', label: 'DES', val: effDex },
                    { key: 'con', label: 'COS', val: effCon }, { key: 'int', label: 'INT', val: effInt },
                    { key: 'wis', label: 'SAG', val: effWis }, { key: 'cha', label: 'CAR', val: effCha },
                ].map(s => (
                    <div key={s.key} className="creature-ability-box">
                        <div className="creature-ability-label">{s.label}</div>
                        <div className="creature-ability-score">{s.val}</div>
                        <div className="creature-ability-mod">{signMod(s.val)}</div>
                    </div>
                ))}
            </div>

            {/* Saves */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {[
                    { label: 'Tempra', val: creature.fortitude },
                    { label: 'Riflessi', val: creature.reflex },
                    { label: 'Volontà', val: creature.will },
                ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.label}</div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem' }}>{s.val >= 0 ? '+' : ''}{s.val}</div>
                    </div>
                ))}
            </div>

            {/* Defense extras */}
            {(creature.damageReduction || creature.spellResistance || creature.resistances || creature.immunities || creature.weaknesses) && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {creature.damageReduction && <span className="text-sm"><strong>RD</strong> {creature.damageReduction}</span>}
                    {creature.spellResistance ? <span className="text-sm"><strong>RI</strong> {creature.spellResistance}</span> : null}
                    {creature.resistances && <span className="text-sm"><strong>Resistenze</strong> {creature.resistances}</span>}
                    {creature.immunities && <span className="text-sm"><strong>Immunità</strong> {creature.immunities}</span>}
                    {creature.weaknesses && <span className="text-sm"><strong>Vulnerabilità</strong> {creature.weaknesses}</span>}
                </div>
            )}

            {/* Actions */}
            {(creature.actions ?? []).length > 0 && (
                <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', marginBottom: 6, color: 'var(--accent-gold)' }}>Attacchi</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {creature.actions.map(a => (
                            <div key={a.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                                <span style={{ fontWeight: 600 }}>{a.name}</span>
                                {a.attackBonus !== undefined && <span className="text-sm text-muted">Att: {a.attackBonus >= 0 ? '+' : ''}{a.attackBonus}</span>}
                                {a.damage && <span className="text-sm text-muted">Dano: {a.damage} {a.damageType}</span>}
                                {a.criticalRange && <span className="text-sm text-muted">Critico: {a.criticalRange} {a.criticalMultiplier}</span>}
                                {a.range && <span className="text-sm text-muted">{a.range}</span>}
                                {a.notes && <span className="text-sm text-muted">{a.notes}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Special abilities */}
            {(creature.specialAbilities ?? []).length > 0 && (
                <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', marginBottom: 6, color: 'var(--accent-arcane)' }}>Capacità Speciali</h4>
                    {creature.specialAbilities.map(a => (
                        <div key={a.id} style={{ background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{a.name}</span> <span className="text-xs text-muted">({a.abilityType})</span>
                            {a.description && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{a.description}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Spells */}
            {(creature.spellsKnown ?? []).length > 0 && (
                <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', marginBottom: 6, color: 'var(--accent-arcane)' }}>Incantesimi Conosciuti</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {creature.spellsKnown!.map(s => (
                            <span key={s.id} className="badge-type" title={s.description}>{s.name} (lv. {s.level})</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Description */}
            {creature.description && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{creature.description}</p>
                </div>
            )}

            {/* Footer meta */}
            {(creature.habitat || creature.organization || creature.source) && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {creature.habitat && <span><strong>Habitat:</strong> {creature.habitat}</span>}
                    {creature.organization && <span><strong>Organizzazione:</strong> {creature.organization}</span>}
                    {creature.source && <span><strong>Fonte:</strong> {creature.source}</span>}
                </div>
            )}

            {/* Caller-injected extra content (e.g. live HP tracker) */}
            {extra}
        </div>
    );
};
