/**
 * Shared creature stat-block components used by BestiaryPage and the
 * SummonsWidget popup.
 */
import React, { useState } from 'react';
import { FaTimes, FaDragon, FaPlus, FaTrash } from 'react-icons/fa';
import { v4 as uuid } from 'uuid';
import type { Creature, CreatureStatOverride, CreatureRuntimeModifier, CreatureRuntimeStat, ModifierType } from '../types/dnd';
import { aggregateBonuses } from '../services/modifiers';
import './Bestiary.css';

/* ── helpers ───────────────────────────────────────────────────── */
export const mod = (score: number) => Math.floor((score - 10) / 2);
export const signMod = (score: number) => {
    const m = mod(score);
    return (m >= 0 ? '+' : '') + m;
};

/* ═══════════════════════════════════════════════════════════════
   Effective creature stats computation
   Combines appliedOverrides (baked at summon time from feats/items)
   and runtimeModifiers (added live during play) with 3.5e stacking.
   Ability score changes propagate to derived stats:
     CON delta → Tempra, DEX delta → CA + Riflessi,
     STR delta → attacco + danno (mischia), WIS delta → Volontà.
═══════════════════════════════════════════════════════════════ */
export interface EffectiveCreatureStats {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
    ac: number;
    hp: number;
    fort: number;
    reflex: number;
    will: number;
    /** Delta to add to all stored attackBonus values */
    attackDelta: number;
    /** Delta to add to all stored damage values */
    damageDelta: number;
}

export function computeEffectiveCreatureStats(
    creature: Creature,
    staticOverrides: CreatureStatOverride[],
    runtimeMods: CreatureRuntimeModifier[],
): EffectiveCreatureStats {
    const allMods = [
        ...staticOverrides.map(o => ({ stat: o.stat as string, value: o.value, type: o.type })),
        ...runtimeMods.map(r => ({ stat: r.stat as string, value: r.value, type: r.type })),
    ];
    const bonus = (stat: string) =>
        aggregateBonuses(allMods.filter(m => m.stat === stat).map(m => ({ type: m.type as ModifierType, value: m.value })));

    const strB = bonus('str'), dexB = bonus('dex'), conB = bonus('con');
    const wisB = bonus('wis');

    // Ability mod deltas after bonuses
    const dStrMod = mod(creature.str + strB) - mod(creature.str);
    const dDexMod = mod(creature.dex + dexB) - mod(creature.dex);
    const dConMod = mod(creature.con + conB) - mod(creature.con);
    const dWisMod = mod(creature.wis + wisB) - mod(creature.wis);

    // In D&D 3.5e the CON modifier applies once per Hit Die.
    // Parse HD count from hpDice (e.g. "4d8+8" → 4, "2d10" → 2).
    const hdMatch = creature.hpDice?.match(/^(\d+)d\d+/);
    const hdCount = hdMatch ? parseInt(hdMatch[1], 10) : 0;

    return {
        str: creature.str + strB,
        dex: creature.dex + dexB,
        con: creature.con + conB,
        int: creature.int + bonus('int'),
        wis: creature.wis + wisB,
        cha: creature.cha + bonus('cha'),
        ac: creature.ac + bonus('ac') + dDexMod,
        hp: creature.hp + bonus('hp') + dConMod * hdCount,
        fort: creature.fortitude + bonus('fort') + dConMod,
        reflex: creature.reflex + bonus('ref') + dDexMod,
        will: creature.will + bonus('will') + dWisMod,
        attackDelta: bonus('attack') + dStrMod,
        damageDelta: bonus('damage') + dStrMod,
    };
}

/* ═══════════════════════════════════════════════════════════════
   Runtime modifier panel (add/remove live buffs on a creature)
═══════════════════════════════════════════════════════════════ */
const RUNTIME_STAT_OPTIONS: { value: CreatureRuntimeStat; label: string }[] = [
    { value: 'str', label: 'Forza (FOR)' },
    { value: 'dex', label: 'Destrezza (DES)' },
    { value: 'con', label: 'Costituzione (COS)' },
    { value: 'int', label: 'Intelligenza (INT)' },
    { value: 'wis', label: 'Saggezza (SAG)' },
    { value: 'cha', label: 'Carisma (CAR)' },
    { value: 'ac', label: 'CA (diretto)' },
    { value: 'hp', label: 'PF massimi' },
    { value: 'fort', label: 'TS Tempra' },
    { value: 'ref', label: 'TS Riflessi' },
    { value: 'will', label: 'TS Volontà' },
    { value: 'attack', label: 'Tiro per colpire' },
    { value: 'damage', label: 'Danno' },
];

const MODIFIER_TYPE_OPTIONS: { value: ModifierType; label: string }[] = [
    { value: 'enhancement', label: 'Enhancement' },
    { value: 'morale', label: 'Morale' },
    { value: 'luck', label: 'Fortuna' },
    { value: 'competence', label: 'Competenza' },
    { value: 'dodge', label: 'Schivata (cumul.)' },
    { value: 'deflection', label: 'Deflection' },
    { value: 'naturalArmor', label: 'CA Naturale' },
    { value: 'size', label: 'Taglia' },
    { value: 'untyped', label: 'Non tipizzato (cumul.)' },
    { value: 'circumstance', label: 'Circostanza (cumul.)' },
    { value: 'racial', label: 'Razziale' },
    { value: 'insight', label: 'Intuizione' },
    { value: 'resistance', label: 'Resistenza' },
    { value: 'synergy', label: 'Sinergia (cumul.)' },
    { value: 'sacred', label: 'Sacro' },
    { value: 'profane', label: 'Profano' },
    { value: 'alchemical', label: 'Alchemico' },
];

export interface RuntimeModifierPanelProps {
    modifiers: CreatureRuntimeModifier[];
    onAdd: (mod: CreatureRuntimeModifier) => void;
    onRemove: (id: string) => void;
    onTick?: (id: string) => void;
}

export const RuntimeModifierPanel: React.FC<RuntimeModifierPanelProps> = ({ modifiers, onAdd, onRemove }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [stat, setStat] = useState<CreatureRuntimeStat>('str');
    const [value, setValue] = useState<string>('+2');
    const [type, setType] = useState<ModifierType>('enhancement');
    const [rounds, setRounds] = useState('');

    const handleAdd = () => {
        const numVal = parseInt(value, 10);
        if (isNaN(numVal) || numVal === 0) return;
        onAdd({
            id: uuid(),
            name: name.trim() || (RUNTIME_STAT_OPTIONS.find(o => o.value === stat)?.label ?? stat),
            stat,
            value: numVal,
            type,
            roundsRemaining: rounds ? Math.max(1, parseInt(rounds, 10)) : null,
        });
        setName('');
        setValue('+2');
        setRounds('');
        setOpen(false);
    };

    return (
        <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                    Modificatori attivi
                </span>
                <button
                    className="btn-ghost text-xs"
                    style={{ padding: '2px 6px', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setOpen(o => !o)}
                    title="Aggiungi modificatore temporaneo"
                >
                    <FaPlus /> Aggiungi
                </button>
            </div>

            {/* Existing modifiers */}
            {modifiers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {modifiers.map(m => (
                        <span
                            key={m.id}
                            className={`override-chip${m.value < 0 ? ' negative' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            <span>{m.name}: {m.stat.toUpperCase()} {m.value >= 0 ? '+' : ''}{m.value}</span>
                            {m.roundsRemaining != null && (
                                <span style={{ opacity: 0.7 }}>({m.roundsRemaining}r)</span>
                            )}
                            <button
                                className="btn-ghost"
                                style={{ padding: 0, lineHeight: 1, color: 'inherit', opacity: 0.7 }}
                                onClick={() => onRemove(m.id)}
                                title="Rimuovi"
                            >
                                <FaTrash style={{ fontSize: '0.6rem' }} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Add form */}
            {open && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Nome (opzionale)</label>
                            <input className="input w-full" style={{ fontSize: '0.8rem', padding: '3px 6px' }}
                                value={name} onChange={e => setName(e.target.value)} placeholder="es. Benedizione" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Stat bersaglio</label>
                            <select className="input w-full" style={{ fontSize: '0.8rem', padding: '3px 6px' }}
                                value={stat} onChange={e => setStat(e.target.value as CreatureRuntimeStat)}>
                                {RUNTIME_STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Valore (es. +4, -2)</label>
                            <input className="input w-full" style={{ fontSize: '0.8rem', padding: '3px 6px' }}
                                value={value} onChange={e => setValue(e.target.value)} placeholder="+2" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Tipo</label>
                            <select className="input w-full" style={{ fontSize: '0.8rem', padding: '3px 6px' }}
                                value={type} onChange={e => setType(e.target.value as ModifierType)}>
                                {MODIFIER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Round (vuoto = permanente)</label>
                            <input className="input w-full" type="number" min={1} style={{ fontSize: '0.8rem', padding: '3px 6px' }}
                                value={rounds} onChange={e => setRounds(e.target.value)} placeholder="∞" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>Annulla</button>
                        <button className="btn-primary text-xs" onClick={handleAdd}><FaPlus /> Applica</button>
                    </div>
                </div>
            )}
        </div>
    );
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
    runtimeModifiers?: CreatureRuntimeModifier[];
    onAddRuntimeModifier?: (mod: CreatureRuntimeModifier) => void;
    onRemoveRuntimeModifier?: (id: string) => void;
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
    creature, overrides, runtimeModifiers, onAddRuntimeModifier, onRemoveRuntimeModifier,
    onClose,
    actionLabel, onAction, actionIcon,
    actionLabel2, onAction2, actionIcon2,
    extra, headless,
}) => {
    const eff = computeEffectiveCreatureStats(creature, overrides ?? [], runtimeModifiers ?? []);

    const sign = (n: number) => (n >= 0 ? '+' : '') + n;

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

            {/* Static override chips (from feats/items at summon time) */}
            {(overrides ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className="text-xs text-muted">Modificatori da talenti/oggetti:</span>
                    {overrides!.map((o, i) => (
                        <span key={i} className={`override-chip${o.value < 0 ? ' negative' : ''}`}>
                            {o.source}: {o.stat.toUpperCase()} {o.value > 0 ? '+' : ''}{o.value}
                        </span>
                    ))}
                </div>
            )}

            {/* Runtime modifier panel (only when callbacks provided = active creature) */}
            {onAddRuntimeModifier && onRemoveRuntimeModifier && (
                <RuntimeModifierPanel
                    modifiers={runtimeModifiers ?? []}
                    onAdd={onAddRuntimeModifier}
                    onRemove={onRemoveRuntimeModifier}
                />
            )}

            {/* Defenses row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {[
                    { label: 'PF', val: `${eff.hp}${creature.hpDice ? ` (${creature.hpDice})` : ''}`, color: 'var(--accent-crimson)' },
                    { label: 'CA', val: eff.ac.toString(), color: 'var(--accent-gold)' },
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
                    { key: 'str', label: 'FOR', val: eff.str }, { key: 'dex', label: 'DES', val: eff.dex },
                    { key: 'con', label: 'COS', val: eff.con }, { key: 'int', label: 'INT', val: eff.int },
                    { key: 'wis', label: 'SAG', val: eff.wis }, { key: 'cha', label: 'CAR', val: eff.cha },
                ].map(s => (
                    <div key={s.key} className="creature-ability-box">
                        <div className="creature-ability-label">{s.label}</div>
                        <div className="creature-ability-score">{s.val}</div>
                        <div className="creature-ability-mod">{signMod(s.val)}</div>
                    </div>
                ))}
            </div>

            {/* Saves — fully computed including ability propagation */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {[
                    { label: 'Tempra', val: eff.fort, base: creature.fortitude, hint: 'base + CON + bonus' },
                    { label: 'Riflessi', val: eff.reflex, base: creature.reflex, hint: 'base + DES + bonus' },
                    { label: 'Volontà', val: eff.will, base: creature.will, hint: 'base + SAG + bonus' },
                ].map(s => (
                    <div key={s.label}
                        style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', textAlign: 'center' }}
                        title={`${s.hint} = ${sign(s.val)} (base: ${sign(s.base)})`}
                    >
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.label}</div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem' }}>{sign(s.val)}</div>
                        {s.val !== s.base && (
                            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', opacity: 0.7 }}>base {sign(s.base)}</div>
                        )}
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

            {/* Actions — attack bonus and damage include modifier deltas */}
            {(creature.actions ?? []).length > 0 && (
                <div>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', marginBottom: 6, color: 'var(--accent-gold)' }}>Attacchi</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {creature.actions.map(a => {
                            const effAtk = a.attackBonus !== undefined ? a.attackBonus + eff.attackDelta : undefined;
                            return (
                                <div key={a.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                                    {effAtk !== undefined && (
                                        <span className="text-sm text-muted">
                                            Att: {sign(effAtk)}
                                            {eff.attackDelta !== 0 && (
                                                <span style={{ opacity: 0.6 }}> (base {sign(a.attackBonus!)})</span>
                                            )}
                                        </span>
                                    )}
                                    {a.damage && (
                                        <span className="text-sm text-muted">
                                            Danno: {a.damage}{eff.damageDelta !== 0 ? ` ${sign(eff.damageDelta)}` : ''} {a.damageType}
                                        </span>
                                    )}
                                    {a.criticalRange && <span className="text-sm text-muted">Critico: {a.criticalRange} {a.criticalMultiplier}</span>}
                                    {a.range && <span className="text-sm text-muted">{a.range}</span>}
                                    {a.notes && <span className="text-sm text-muted">{a.notes}</span>}
                                </div>
                            );
                        })}
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
