/**
 * Inline editor for `CreatureModifier[]` — used inside Feat and ClassFeature
 * edit forms so the user can define which stat bonuses apply to summoned
 * creatures / animal companions when the feat/feature is active.
 */
import React from 'react';
import { FaPlus, FaTimes, FaDragon, FaPaw } from 'react-icons/fa';
import type { CreatureModifier, CreatureModifierAppliesTo, ModifierType } from '../types/dnd';
import { ThemeProvider } from '@mui/material/styles';
import MuiSelect from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { dndMuiTheme } from './ModifierEditor';

// ── Opzioni ───────────────────────────────────────────────────────────────────
const APPLIES_TO_OPTIONS: { value: CreatureModifierAppliesTo; label: string }[] = [
    { value: 'allSummons', label: 'Tutte le evocazioni' },
    { value: 'allPets',    label: 'Tutti i compagni' },
    { value: 'all',        label: 'Evocazioni + Compagni' },
];

const STAT_OPTIONS: { value: CreatureModifier['stat']; label: string }[] = [
    { value: 'str', label: 'Forza (FOR)' },
    { value: 'dex', label: 'Destrezza (DES)' },
    { value: 'con', label: 'Costituzione (COS)' },
    { value: 'int', label: 'Intelligenza (INT)' },
    { value: 'wis', label: 'Saggezza (SAG)' },
    { value: 'cha', label: 'Carisma (CAR)' },
    { value: 'ac',  label: 'Classe Armatura' },
    { value: 'hp',  label: 'Punti Ferita (PF)' },
];

const TYPE_OPTIONS: { value: ModifierType; label: string }[] = [
    { value: 'enhancement',  label: 'Potenziamento' },
    { value: 'naturalArmor', label: 'Arm. Naturale' },
    { value: 'morale',       label: 'Morale' },
    { value: 'luck',         label: 'Fortuna' },
    { value: 'sacred',       label: 'Sacro' },
    { value: 'profane',      label: 'Profano' },
    { value: 'size',         label: 'Taglia' },
    { value: 'dodge',        label: 'Schivata' },
    { value: 'deflection',   label: 'Deviazione' },
    { value: 'circumstance', label: 'Circostanza' },
    { value: 'insight',      label: 'Intuizione' },
    { value: 'untyped',      label: 'Senza tipo' },
];

const empty = (): CreatureModifier => ({
    appliesTo: 'allSummons',
    stat: 'str',
    value: 4,
    type: 'enhancement',
});

// ── Stili condivisi ───────────────────────────────────────────────────────────
const stepBtnSt: React.CSSProperties = {
    width: 26, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4, cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: '1rem', flexShrink: 0,
    userSelect: 'none',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    modifiers: CreatureModifier[];
    onChange: (next: CreatureModifier[]) => void;
    accentColor?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// CreatureModifierEditor
// ═════════════════════════════════════════════════════════════════════════════
export const CreatureModifierEditor: React.FC<Props> = ({
    modifiers,
    onChange,
    accentColor = 'var(--accent-gold)',
}) => {
    const add    = () => onChange([...modifiers, empty()]);
    const remove = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));
    const update = (i: number, patch: Partial<CreatureModifier>) =>
        onChange(modifiers.map((m, idx) => idx === i ? { ...m, ...patch } : m));

    const focusSx = {
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: accentColor,
        },
        '& label.Mui-focused': { color: accentColor },
    };

    return (
        <ThemeProvider theme={dndMuiTheme}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* ── Intestazione sezione ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 10,
                }}>
                    <span style={{
                        fontSize: '0.62rem', color: accentColor, letterSpacing: '0.1em',
                        textTransform: 'uppercase', fontFamily: 'var(--font-heading)',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <FaDragon size={9} />
                        Modificatori alle Creature
                        {modifiers.length > 0 && (
                            <span style={{
                                background: `${accentColor}22`, border: `1px solid ${accentColor}44`,
                                borderRadius: 10, padding: '0 6px', fontSize: '0.58rem', color: accentColor,
                            }}>{modifiers.length}</span>
                        )}
                    </span>
                    <button
                        type="button" onClick={add}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                            background: `${accentColor}18`, border: `1px solid ${accentColor}50`,
                            color: accentColor, fontSize: '0.74rem', fontFamily: 'var(--font-heading)',
                        }}
                    >
                        <FaPlus size={8} /> Aggiungi
                    </button>
                </div>

                {/* ── Stato vuoto ── */}
                {modifiers.length === 0 && (
                    <div style={{
                        padding: '14px 0', textAlign: 'center',
                        fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic',
                    }}>
                        Nessun bonus a creature evocate o compagni.
                    </div>
                )}

                {/* ── Lista ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {modifiers.map((cm, i) => {
                        const positive = cm.value >= 0;
                        const statLabel    = STAT_OPTIONS.find(o => o.value === cm.stat)?.label      ?? cm.stat;
                        const targetLabel  = APPLIES_TO_OPTIONS.find(o => o.value === cm.appliesTo)?.label ?? cm.appliesTo;
                        const valStr       = positive ? `+${cm.value}` : `${cm.value}`;

                        return (
                            <div key={i} style={{
                                borderRadius: 8,
                                border: `1px solid ${accentColor}30`,
                                overflow: 'hidden',
                                background: 'var(--bg-surface)',
                            }}>
                                {/* ── Header: accent bar · valore · rimuovi ── */}
                                <div style={{
                                    display: 'flex', alignItems: 'center',
                                    background: `${accentColor}10`,
                                    borderBottom: `1px solid ${accentColor}22`,
                                    padding: '8px 10px 8px 0',
                                    gap: 0,
                                }}>
                                    {/* Accent bar */}
                                    <div style={{ width: 4, alignSelf: 'stretch', background: accentColor, flexShrink: 0 }} />

                                    {/* Stepper valore */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center',
                                        padding: '0 12px',
                                        borderRight: `1px solid ${accentColor}22`,
                                        gap: 0, flexShrink: 0,
                                    }}>
                                        <button type="button" onClick={() => update(i, { value: cm.value - 1 })} style={stepBtnSt}>−</button>
                                        <input
                                            type="number"
                                            value={cm.value}
                                            onChange={e => update(i, { value: parseInt(e.target.value, 10) || 0 })}
                                            title="Positivo = bonus, negativo = penalità"
                                            style={{
                                                width: 52, textAlign: 'center',
                                                fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700,
                                                background: 'transparent', border: 'none', outline: 'none',
                                                color: positive ? 'var(--accent-success)' : 'var(--accent-crimson)',
                                                padding: '0 4px', MozAppearance: 'textfield' as never,
                                            }}
                                        />
                                        <button type="button" onClick={() => update(i, { value: cm.value + 1 })} style={stepBtnSt}>+</button>
                                    </div>

                                    {/* Summary */}
                                    <div style={{ flex: 1, padding: '0 12px', minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.76rem', fontFamily: 'var(--font-heading)',
                                            color: accentColor, letterSpacing: '0.03em',
                                            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                                        }}>
                                            <FaPaw size={9} />
                                            <span>{targetLabel}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>—</span>
                                            <span style={{ color: positive ? 'var(--accent-success)' : 'var(--accent-crimson)' }}>
                                                {valStr}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                                                {statLabel}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Rimuovi */}
                                    <button
                                        type="button" onClick={() => remove(i)} title="Rimuovi"
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'rgba(192,57,43,0.45)', padding: '4px 0 4px 10px', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', transition: 'color 120ms',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-crimson)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(192,57,43,0.45)')}
                                    >
                                        <FaTimes size={13} />
                                    </button>
                                </div>

                                {/* ── Corpo: tre select ── */}
                                <div style={{
                                    display: 'flex', gap: 8, flexWrap: 'wrap',
                                    padding: '10px 14px',
                                }}>
                                    <FormControl size="small" sx={{ flex: '1 1 160px', ...focusSx }}>
                                        <InputLabel>Bersaglio</InputLabel>
                                        <MuiSelect
                                            value={cm.appliesTo}
                                            label="Bersaglio"
                                            onChange={e => update(i, { appliesTo: e.target.value as CreatureModifierAppliesTo })}
                                        >
                                            {APPLIES_TO_OPTIONS.map(o => (
                                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                            ))}
                                        </MuiSelect>
                                    </FormControl>

                                    <FormControl size="small" sx={{ flex: '1 1 140px', ...focusSx }}>
                                        <InputLabel>Statistica</InputLabel>
                                        <MuiSelect
                                            value={cm.stat}
                                            label="Statistica"
                                            onChange={e => update(i, { stat: e.target.value as CreatureModifier['stat'] })}
                                        >
                                            {STAT_OPTIONS.map(o => (
                                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                            ))}
                                        </MuiSelect>
                                    </FormControl>

                                    <FormControl size="small" sx={{ flex: '1 1 140px', ...focusSx }}>
                                        <InputLabel>Tipo bonus</InputLabel>
                                        <MuiSelect
                                            value={cm.type}
                                            label="Tipo bonus"
                                            onChange={e => update(i, { type: e.target.value as ModifierType })}
                                        >
                                            {TYPE_OPTIONS.map(o => (
                                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                            ))}
                                        </MuiSelect>
                                    </FormControl>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ThemeProvider>
    );
};
