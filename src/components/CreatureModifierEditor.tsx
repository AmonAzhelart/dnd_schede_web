/**
 * Inline editor for `CreatureModifier[]` — used inside Feat and ClassFeature
 * edit forms so the user can define which stat bonuses apply to summoned
 * creatures / animal companions when the feat/feature is active.
 */
import React from 'react';
import { FaPlus, FaTimes, FaDragon } from 'react-icons/fa';
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

    return (
        <div style={{ marginBottom: 8 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: modifiers.length ? 6 : 0 }}>
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: accentColor, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FaDragon size={8} /> MODIFICATORI ALLE CREATURE EVOCATE
                </span>
                <button
                    type="button"
                    onClick={add}
                    style={{ fontSize: '0.7rem', padding: '2px 8px', background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 4, color: accentColor, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                    <FaPlus size={8} /> Aggiungi
                </button>
            </div>

            {modifiers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {modifiers.map((cm, i) => (
                        <div key={i} style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', background: `${accentColor}0a`, border: `1px solid ${accentColor}22`, borderRadius: 6, padding: '5px 8px' }}>
                            {/* appliesTo */}
                            <select
                                value={cm.appliesTo}
                                onChange={e => update(i, { appliesTo: e.target.value as CreatureModifierAppliesTo })}
                                style={{ ...sel, flex: '1 1 120px' }}
                            >
                                {APPLIES_TO_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* stat */}
                            <select
                                value={cm.stat}
                                onChange={e => update(i, { stat: e.target.value as CreatureModifier['stat'] })}
                                style={{ ...sel, flex: '1 1 100px' }}
                            >
                                {STAT_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* value */}
                            <input
                                type="number"
                                value={cm.value}
                                onChange={e => update(i, { value: parseInt(e.target.value, 10) || 0 })}
                                style={{ ...sel, width: 54, textAlign: 'center' }}
                                title="Valore (positivo = bonus, negativo = penalità)"
                            />

                            {/* type */}
                            <select
                                value={cm.type}
                                onChange={e => update(i, { type: e.target.value as ModifierType })}
                                style={{ ...sel, flex: '1 1 100px' }}
                            >
                                {TYPE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* remove */}
                            <button
                                type="button"
                                onClick={() => remove(i)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '2px 4px', flexShrink: 0 }}
                            >
                                <FaTimes size={11} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
