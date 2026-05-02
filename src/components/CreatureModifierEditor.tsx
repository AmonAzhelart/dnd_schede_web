/**
 * Inline editor for `CreatureModifier[]` — used inside Feat and ClassFeature
 * edit forms so the user can define which stat bonuses apply to summoned
 * creatures / animal companions when the feat/feature is active.
 */
import React from 'react';
import { FaPlus, FaTimes, FaDragon, FaPaw } from 'react-icons/fa';
import type { CreatureModifier, CreatureModifierAppliesTo, ModifierType } from '../types/dnd';

const APPLIES_TO_OPTIONS: { value: CreatureModifierAppliesTo; label: string }[] = [
    { value: 'allSummons', label: 'Tutte le evocazioni' },
    { value: 'allPets', label: 'Tutti i compagni' },
    { value: 'all', label: 'Evocazioni + Compagni' },
];

const STAT_OPTIONS: { value: CreatureModifier['stat']; label: string }[] = [
    { value: 'str', label: 'Forza (FOR)' },
    { value: 'dex', label: 'Destrezza (DES)' },
    { value: 'con', label: 'Costituzione (COS)' },
    { value: 'int', label: 'Intelligenza (INT)' },
    { value: 'wis', label: 'Saggezza (SAG)' },
    { value: 'cha', label: 'Carisma (CAR)' },
    { value: 'ac', label: 'Classe Armatura' },
    { value: 'hp', label: 'Punti Ferita (PF)' },
];

const TYPE_OPTIONS: { value: ModifierType; label: string }[] = [
    { value: 'enhancement', label: 'Potenziamento' },
    { value: 'naturalArmor', label: 'Arm. Naturale' },
    { value: 'morale', label: 'Morale' },
    { value: 'luck', label: 'Fortuna' },
    { value: 'sacred', label: 'Sacro' },
    { value: 'profane', label: 'Profano' },
    { value: 'size', label: 'Taglia' },
    { value: 'dodge', label: 'Schivata' },
    { value: 'deflection', label: 'Deviazione' },
    { value: 'circumstance', label: 'Circostanza' },
    { value: 'insight', label: 'Intuizione' },
    { value: 'untyped', label: 'Senza tipo' },
];

const empty = (): CreatureModifier => ({
    appliesTo: 'allSummons',
    stat: 'str',
    value: 4,
    type: 'enhancement',
});

interface Props {
    modifiers: CreatureModifier[];
    onChange: (next: CreatureModifier[]) => void;
    accentColor?: string;
}

const sel: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5,
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    padding: '3px 6px',
    cursor: 'pointer',
};

export const CreatureModifierEditor: React.FC<Props> = ({
    modifiers,
    onChange,
    accentColor = 'var(--accent-gold)',
}) => {
    const add = () => onChange([...modifiers, empty()]);
    const remove = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));
    const update = (i: number, patch: Partial<CreatureModifier>) =>
        onChange(modifiers.map((m, idx) => idx === i ? { ...m, ...patch } : m));

    const valBtnStyle = (delta: number): React.CSSProperties => ({
        width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: delta < 0 ? '4px 0 0 4px' : '0 4px 4px 0',
        cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', flexShrink: 0,
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* ── Section header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: 6, borderBottom: `1px solid ${accentColor}30`,
            }}>
                <span style={{
                    fontSize: '0.65rem', color: accentColor, letterSpacing: '0.12em',
                    textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                    display: 'flex', alignItems: 'center', gap: 5,
                }}>
                    <FaDragon size={9} /> Modificatori alle Creature
                    {modifiers.length > 0 && (
                        <span style={{
                            background: `${accentColor}22`, border: `1px solid ${accentColor}44`,
                            borderRadius: 10, padding: '0 6px', fontSize: '0.6rem', color: accentColor,
                        }}>{modifiers.length}</span>
                    )}
                </span>
                <button
                    type="button"
                    onClick={add}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: `${accentColor}18`, border: `1px solid ${accentColor}44`,
                        color: accentColor, fontSize: '0.75rem', fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.04em',
                    }}
                >
                    <FaPlus size={9} /> Aggiungi
                </button>
            </div>

            {modifiers.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
                    Nessun bonus a creature evocate o compagni.
                </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modifiers.map((cm, i) => {
                    const valStr = cm.value >= 0 ? `+${cm.value}` : `${cm.value}`;
                    const statLabel = STAT_OPTIONS.find(o => o.value === cm.stat)?.label ?? cm.stat;
                    const targetLabel = APPLIES_TO_OPTIONS.find(o => o.value === cm.appliesTo)?.label ?? cm.appliesTo;
                    const typeLabel = TYPE_OPTIONS.find(o => o.value === cm.type)?.label ?? cm.type;
                    return (
                        <div key={i} style={{
                            borderRadius: 8,
                            border: `1px solid ${accentColor}30`,
                            background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}04 100%)`,
                            overflow: 'hidden',
                        }}>
                            {/* Card header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 10px',
                                background: `${accentColor}12`,
                                borderBottom: `1px solid ${accentColor}20`,
                            }}>
                                <span style={{
                                    fontSize: '0.76rem', fontFamily: 'var(--font-heading)',
                                    color: accentColor, letterSpacing: '0.03em',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                    <FaPaw size={9} />
                                    {targetLabel} — {statLabel} {valStr} [{typeLabel}]
                                </span>
                                <button
                                    type="button"
                                    onClick={() => remove(i)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--accent-crimson)', padding: '2px 4px',
                                        display: 'flex', alignItems: 'center', borderRadius: 4,
                                    }}
                                >
                                    <FaTimes size={12} />
                                </button>
                            </div>

                            {/* Card body */}
                            <div style={{ padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 130px' }}>
                                    <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bersaglio</label>
                                    <select
                                        value={cm.appliesTo}
                                        onChange={e => update(i, { appliesTo: e.target.value as CreatureModifierAppliesTo })}
                                        style={{ ...sel, width: '100%' }}
                                    >
                                        {APPLIES_TO_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 120px' }}>
                                    <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statistica</label>
                                    <select
                                        value={cm.stat}
                                        onChange={e => update(i, { stat: e.target.value as CreatureModifier['stat'] })}
                                        style={{ ...sel, width: '100%' }}
                                    >
                                        {STAT_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valore</label>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <button type="button" style={valBtnStyle(-1)} onClick={() => update(i, { value: cm.value - 1 })}>−</button>
                                        <input
                                            type="number"
                                            value={cm.value}
                                            onChange={e => update(i, { value: parseInt(e.target.value, 10) || 0 })}
                                            title="Positivo = bonus, negativo = penalità"
                                            style={{
                                                ...sel, width: 52, textAlign: 'center',
                                                fontFamily: 'var(--font-heading)', fontWeight: 600,
                                                fontSize: '0.9rem', borderRadius: 0,
                                                borderLeft: 'none', borderRight: 'none',
                                                color: cm.value >= 0 ? 'var(--accent-success)' : 'var(--accent-crimson)',
                                            }}
                                        />
                                        <button type="button" style={valBtnStyle(1)} onClick={() => update(i, { value: cm.value + 1 })}>+</button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 120px' }}>
                                    <label style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</label>
                                    <select
                                        value={cm.type}
                                        onChange={e => update(i, { type: e.target.value as ModifierType })}
                                        style={{ ...sel, width: '100%' }}
                                    >
                                        {TYPE_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
