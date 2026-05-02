/**
 * Shared editor for the new structured `Modifier` model (channel-based with
 * conditions + manual prompt). Used by ItemModal, Inventory, Feats and
 * ClassFeatures so all three tabs offer the exact same UX.
 *
 * Backward-compatible: legacy `target`-based modifiers without `appliesTo`
 * are auto-converted on first edit (the legacy `target` is mapped onto the
 * matching channel and stored in `appliesTo`).
 */
import React, { useMemo, useState } from 'react';
import {
    FaPlus, FaTimes, FaBolt, FaHandPointer, FaChevronDown, FaChevronRight,
} from 'react-icons/fa';
import { DndIcon } from './DndIcon';
import type {
    Modifier, ModifierType, ModifierCondition, RollChannel, StatType,
} from '../types/dnd';
import { useCharacterStore } from '../store/characterStore';
import { ROLL_CHANNEL_LABELS } from '../services/modifiers';

const MOD_TYPES: { value: ModifierType; label: string }[] = [
    { value: 'enhancement', label: 'Potenziamento' },
    { value: 'armor', label: 'Armatura' },
    { value: 'shield', label: 'Scudo' },
    { value: 'naturalArmor', label: 'Arm. Naturale' },
    { value: 'deflection', label: 'Deviazione' },
    { value: 'dodge', label: 'Schivata' },
    { value: 'circumstance', label: 'Circostanza' },
    { value: 'untyped', label: 'Senza tipo' },
    { value: 'morale', label: 'Morale' },
    { value: 'luck', label: 'Fortuna' },
    { value: 'competence', label: 'Competenza' },
    { value: 'insight', label: 'Intuizione' },
    { value: 'resistance', label: 'Resistenza' },
    { value: 'sacred', label: 'Sacro' },
    { value: 'profane', label: 'Profano' },
    { value: 'racial', label: 'Razziale' },
    { value: 'size', label: 'Taglia' },
    { value: 'synergy', label: 'Sinergia' },
    { value: 'alchemical', label: 'Alchemico' },
];

const COND_KIND_LABELS: { value: ModifierCondition['kind']; label: string; icon: { category: string; name: string } }[] = [
    { value: 'weaponType',      label: 'Tipo arma',          icon: { category: 'combat',  name: 'melee' } },
    { value: 'weaponCategory',  label: 'Categoria arma',     icon: { category: 'weapon',  name: 'sword' } },
    { value: 'weaponName',      label: 'Nome arma',          icon: { category: 'weapon',  name: 'dagger' } },
    { value: 'damageType',      label: 'Tipo danno',         icon: { category: 'damage',  name: 'fire' } },
    { value: 'skillId',         label: 'Abilità specifica',  icon: { category: 'skill',   name: 'arcana' } },
    { value: 'saveType',        label: 'Tiro salvezza',      icon: { category: 'd20test', name: 'saving-throw' } },
    { value: 'abilityStat',     label: 'Caratteristica',     icon: { category: 'ability', name: 'strength' } },
    { value: 'spellSchool',     label: 'Scuola magia',       icon: { category: 'spell',   name: 'evocation' } },
    { value: 'spellName',       label: 'Incantesimo',        icon: { category: 'spell',   name: 'octagon' } },
    { value: 'spellDamageType', label: 'Tipo magia',         icon: { category: 'damage',  name: 'lightning' } },
    { value: 'spellMinLevel',   label: 'Livello min. magia', icon: { category: 'spell',   name: 'upcast' } },
];

function ensureAppliesTo(mod: Modifier): Modifier {
    if (mod.appliesTo && mod.appliesTo.length > 0) return mod;
    const t = (mod.target || '').toLowerCase().trim();
    let channel: RollChannel | string | null = null;
    if (!t) channel = null;
    else if (t === 'fortitude') channel = 'save.fort';
    else if (t === 'reflex') channel = 'save.ref';
    else if (t === 'will') channel = 'save.will';
    else if (t.startsWith('skill.') || t.startsWith('check.') || t.startsWith('save.')
        || ['attack', 'damage', 'ac', 'initiative', 'cmb', 'cmd'].includes(t)) channel = t;
    if (!channel) return mod;
    return { ...mod, appliesTo: [channel as RollChannel] };
}

// ──────────────────────────────────────────────────────────────────────────────

export interface ModifierEditorProps {
    modifiers: Modifier[];
    onChange: (next: Modifier[]) => void;
    accentColor?: string;
    title?: string;
    /** @deprecated — kept for compat, layout is always compact now */
    compact?: boolean;
}

export const ModifierEditor: React.FC<ModifierEditorProps> = ({
    modifiers, onChange,
    accentColor = 'var(--accent-arcane)',
    title = 'MODIFICATORI',
}) => {
    const character = useCharacterStore(s => s.character);

    const skillOptions = useMemo(() => character
        ? Object.values(character.skills).map(s => ({ id: s.id, name: s.name }))
        : [], [character]);

    const channelOptions = useMemo(() => {
        const skillEntries = skillOptions.map(s => ({
            value: `skill.${s.id}` as RollChannel,
            label: `Abilità: ${s.name}`,
            group: 'Abilità',
        }));
        return [...ROLL_CHANNEL_LABELS, ...skillEntries];
    }, [skillOptions]);

    const grouped = useMemo(() => {
        const map = new Map<string, typeof channelOptions>();
        channelOptions.forEach(o => {
            const arr = map.get(o.group) ?? [];
            arr.push(o);
            map.set(o.group, arr);
        });
        return Array.from(map.entries());
    }, [channelOptions]);

    const update = (i: number, fn: (m: Modifier) => Modifier) =>
        onChange(modifiers.map((m, idx) => idx === i ? fn(ensureAppliesTo(m)) : m));

    const addMod = () => onChange([...modifiers, {
        target: 'attack', value: 1, type: 'untyped', source: '',
        appliesTo: ['attack'],
    }]);

    const removeMod = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));

    const setChannel = (i: number, ch: string) => update(i, m => ({
        ...m, target: ch, appliesTo: [ch as RollChannel],
    }));

    const addCondition = (i: number, kind: ModifierCondition['kind']) => update(i, m => {
        const initial: ModifierCondition = (() => {
            switch (kind) {
                case 'weaponType':   return { kind, value: 'melee' };
                case 'saveType':     return { kind, value: 'fort' };
                case 'abilityStat':  return { kind, value: 'str' };
                case 'spellMinLevel': return { kind, value: 1 };
                default:             return { kind, value: '' };
            }
        })();
        return { ...m, conditions: [...(m.conditions ?? []), initial] };
    });

    const updateCondition = (i: number, ci: number, value: string) => update(i, m => {
        const conds = (m.conditions ?? []).map((c, idx) => {
            if (idx !== ci) return c;
            if (c.kind === 'spellMinLevel') return { ...c, value: Math.max(0, Math.min(9, parseInt(value, 10) || 0)) };
            return { ...c, value: value as never };
        });
        return { ...m, conditions: conds };
    });

    const removeCondition = (i: number, ci: number) => update(i, m => ({
        ...m, conditions: (m.conditions ?? []).filter((_, idx) => idx !== ci),
    }));

    return (
        <div>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: modifiers.length ? 8 : 4,
            }}>
                <span style={{
                    fontSize: '0.62rem', color: accentColor,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    fontFamily: 'var(--font-heading)',
                    display: 'flex', alignItems: 'center', gap: 5,
                }}>
                    {title}
                    {modifiers.length > 0 && (
                        <span style={{
                            background: `${accentColor}22`, border: `1px solid ${accentColor}44`,
                            borderRadius: 8, padding: '0 5px', fontSize: '0.58rem', color: accentColor,
                        }}>{modifiers.length}</span>
                    )}
                </span>
                <button
                    type="button"
                    onClick={addMod}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                        background: `${accentColor}15`, border: `1px solid ${accentColor}40`,
                        color: accentColor, fontSize: '0.72rem',
                    }}
                >
                    <FaPlus size={8} /> Aggiungi
                </button>
            </div>

            {/* Empty */}
            {modifiers.length === 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                    Nessun modificatore — l'effetto sarà solo descrittivo.
                </p>
            )}

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modifiers.map((rawMod, i) => {
                    const mod = ensureAppliesTo(rawMod);
                    const ch = mod.appliesTo?.[0] ?? mod.target;
                    return (
                        <ModifierRow
                            key={i}
                            mod={mod}
                            channel={ch}
                            accentColor={accentColor}
                            grouped={grouped}
                            skillOptions={skillOptions}
                            channelOptions={channelOptions}
                            onUpdate={fn => update(i, fn)}
                            onRemove={() => removeMod(i)}
                            onSetChannel={ch2 => setChannel(i, ch2)}
                            onAddCondition={kind => addCondition(i, kind)}
                            onUpdateCondition={(ci, v) => updateCondition(i, ci, v)}
                            onRemoveCondition={ci => removeCondition(i, ci)}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
// ModifierRow — single modifier as a compact inline row + expandable panel
// ──────────────────────────────────────────────────────────────────────────────

interface ModifierRowProps {
    mod: Modifier;
    channel: string;
    accentColor: string;
    grouped: [string, { value: string; label: string; group: string }[]][];
    channelOptions: { value: string; label: string; group: string }[];
    skillOptions: { id: string; name: string }[];
    onUpdate: (fn: (m: Modifier) => Modifier) => void;
    onRemove: () => void;
    onSetChannel: (ch: string) => void;
    onAddCondition: (kind: ModifierCondition['kind']) => void;
    onUpdateCondition: (ci: number, v: string) => void;
    onRemoveCondition: (ci: number) => void;
}

const ModifierRow: React.FC<ModifierRowProps> = ({
    mod, channel, accentColor, grouped, skillOptions, channelOptions,
    onUpdate, onRemove, onSetChannel, onAddCondition, onUpdateCondition, onRemoveCondition,
}) => {
    const [expanded, setExpanded] = useState(false);
    const isManual = !!mod.manualPrompt || mod.scope === 'conditional';
    const conditions = mod.conditions ?? [];
    const hasAdvanced = isManual || conditions.length > 0
        || mod.statOverride !== undefined
        || !!mod.extraDice;

    const channelLabel = channelOptions.find(o => o.value === channel)?.label ?? channel;

    const numBtnSt = (left: boolean): React.CSSProperties => ({
        width: 22, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: left ? '4px 0 0 4px' : '0 4px 4px 0',
        cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem', flexShrink: 0,
        userSelect: 'none' as const,
    });

    return (
        <div style={{
            borderRadius: 7,
            border: `1px solid ${accentColor}28`,
            overflow: 'hidden',
        }}>
            {/* Primary row */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px',
                background: `${accentColor}08`,
            }}>
                {/* Channel select */}
                <select
                    className="input"
                    value={channel}
                    onChange={e => onSetChannel(e.target.value)}
                    style={{ flex: '1 1 140px', fontSize: '0.78rem', minWidth: 0 }}
                >
                    {grouped.map(([group, items]) => (
                        <optgroup key={group} label={group}>
                            {items.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </optgroup>
                    ))}
                </select>

                {/* Value stepper */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <button type="button" style={numBtnSt(true)}
                        onClick={() => onUpdate(m => ({ ...m, value: m.value - 1 }))}>−</button>
                    <input
                        type="number"
                        value={mod.value}
                        onChange={e => onUpdate(m => ({ ...m, value: parseInt(e.target.value) || 0 }))}
                        style={{
                            width: 44, textAlign: 'center', fontSize: '0.88rem',
                            fontFamily: 'var(--font-heading)', fontWeight: 700,
                            background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)',
                            borderLeft: 'none', borderRight: 'none', borderRadius: 0,
                            color: mod.value >= 0 ? 'var(--accent-success)' : 'var(--accent-crimson)',
                            outline: 'none', padding: '3px 0',
                        }}
                    />
                    <button type="button" style={numBtnSt(false)}
                        onClick={() => onUpdate(m => ({ ...m, value: m.value + 1 }))}>+</button>
                </div>

                {/* Type select */}
                <select
                    className="input"
                    value={mod.type}
                    onChange={e => onUpdate(m => ({ ...m, type: e.target.value as ModifierType }))}
                    style={{ flex: '0 0 108px', fontSize: '0.75rem' }}
                >
                    {MOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {/* Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {isManual && (
                        <span title="Su richiesta" style={{
                            fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4,
                            background: 'rgba(230,126,34,0.15)', border: '1px solid rgba(230,126,34,0.35)',
                            color: 'var(--accent-warning)',
                        }}>toggle</span>
                    )}
                    {conditions.length > 0 && (
                        <span title={`${conditions.length} condizioni`} style={{
                            fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4,
                            background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)',
                            color: 'var(--accent-gold)',
                        }}>{conditions.length} cond.</span>
                    )}
                </div>

                {/* Expand */}
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    title="Opzioni avanzate"
                    style={{
                        background: expanded ? `${accentColor}18` : 'none',
                        border: `1px solid ${expanded ? accentColor + '44' : 'transparent'}`,
                        cursor: 'pointer',
                        color: hasAdvanced ? accentColor : (expanded ? accentColor : 'var(--text-muted)'),
                        padding: '3px 6px', borderRadius: 4, flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.66rem',
                    }}
                >
                    {expanded ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />}
                    <span>adv</span>
                </button>

                {/* Remove */}
                <button
                    type="button"
                    onClick={onRemove}
                    title="Rimuovi"
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent-crimson)', padding: '3px 4px', flexShrink: 0,
                        display: 'flex', alignItems: 'center',
                    }}
                >
                    <FaTimes size={11} />
                </button>
            </div>

            {/* Summary bar (when collapsed) */}
            {!expanded && (
                <div style={{
                    padding: '3px 10px',
                    fontSize: '0.64rem', color: accentColor,
                    background: `${accentColor}05`,
                    borderTop: `1px solid ${accentColor}18`,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {channelLabel} {mod.value >= 0 ? `+${mod.value}` : mod.value}
                    {mod.extraDice ? ` + ${mod.extraDice}` : ''}
                    {isManual && mod.manualPrompt ? ` · ${mod.manualPrompt}` : ''}
                    {conditions.map(c => ` · ${condSummary(c)}`).join('')}
                </div>
            )}

            {/* Advanced panel (when expanded) */}
            {expanded && (
                <div style={{
                    padding: '10px 12px',
                    background: `${accentColor}05`,
                    borderTop: `1px solid ${accentColor}18`,
                    display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {/* Extra dice + stat override */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 140px' }}>
                            <label style={labelSt}>+ Dadi extra (es. 1d6 fuoco)</label>
                            <input
                                className="input"
                                value={mod.extraDice ?? ''}
                                onChange={e => onUpdate(m => ({ ...m, extraDice: e.target.value || undefined }))}
                                placeholder="vuoto = nessuno"
                                style={{ fontSize: '0.78rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '0 0 130px' }}>
                            <label style={labelSt}>Usa caratteristica</label>
                            <select
                                className="input"
                                value={mod.statOverride ?? ''}
                                onChange={e => onUpdate(m => ({ ...m, statOverride: e.target.value ? e.target.value as StatType : undefined }))}
                                style={{ fontSize: '0.78rem' }}
                                title="Sostituisce la stat di default (es. DES per Weapon Finesse)"
                            >
                                <option value="">— default —</option>
                                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as StatType[]).map(s => (
                                    <option key={s} value={s}>{s.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Attivazione */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={labelSt}>Attivazione</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                type="button"
                                onClick={() => onUpdate(m => ({ ...m, scope: 'always', manualPrompt: undefined }))}
                                style={{
                                    flex: 1, padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    fontSize: '0.74rem',
                                    border: `1px solid ${!isManual ? 'var(--accent-success)55' : 'rgba(255,255,255,0.09)'}`,
                                    background: !isManual ? 'rgba(39,174,96,0.12)' : 'rgba(255,255,255,0.03)',
                                    color: !isManual ? 'var(--accent-success)' : 'var(--text-muted)',
                                }}
                            >
                                <FaBolt size={9} /> Sempre
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdate(m => ({ ...m, scope: 'conditional', manualPrompt: m.manualPrompt ?? '' }))}
                                style={{
                                    flex: 1, padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    fontSize: '0.74rem',
                                    border: `1px solid ${isManual ? 'var(--accent-warning)55' : 'rgba(255,255,255,0.09)'}`,
                                    background: isManual ? 'rgba(230,126,34,0.12)' : 'rgba(255,255,255,0.03)',
                                    color: isManual ? 'var(--accent-warning)' : 'var(--text-muted)',
                                }}
                            >
                                <FaHandPointer size={9} /> Su richiesta
                            </button>
                        </div>
                        {isManual && (
                            <input
                                className="input"
                                placeholder="Etichetta del toggle (es. 'Entro 9 m da un alleato')"
                                value={mod.manualPrompt ?? ''}
                                onChange={e => onUpdate(m => ({ ...m, manualPrompt: e.target.value, scope: 'conditional' }))}
                                style={{ fontSize: '0.78rem' }}
                            />
                        )}
                    </div>

                    {/* Conditions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={labelSt}>
                                Condizioni{conditions.length > 0 ? ` (${conditions.length})` : ''}
                            </label>
                            <ConditionAdder onAdd={onAddCondition} />
                        </div>
                        {conditions.length === 0 && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                                Nessuna — si applica sempre al bersaglio.
                            </p>
                        )}
                        {conditions.map((c, ci) => (
                            <ConditionRow
                                key={ci}
                                cond={c}
                                skills={skillOptions}
                                onChange={v => onUpdateCondition(ci, v)}
                                onRemove={() => onRemoveCondition(ci)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
    fontSize: '0.6rem', color: 'var(--text-muted)',
    letterSpacing: '0.07em', textTransform: 'uppercase',
};

function condSummary(c: ModifierCondition): string {
    switch (c.kind) {
        case 'weaponType': return c.value === 'melee' ? 'Mischia' : c.value === 'ranged' ? 'Distanza' : 'Lancio';
        case 'saveType': return c.value === 'fort' ? 'Tempra' : c.value === 'ref' ? 'Riflessi' : 'Volontà';
        case 'spellMinLevel': return `Lv ≥ ${c.value}`;
        default: return String(c.value);
    }
}

// ── ConditionAdder ────────────────────────────────────────────────────────────

const ConditionAdder: React.FC<{ onAdd: (kind: ModifierCondition['kind']) => void }> = ({ onAdd }) => {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px',
                    borderRadius: 4, cursor: 'pointer', fontSize: '0.68rem',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--text-secondary)',
                }}
            >
                <FaPlus size={7} /> Aggiungi
            </button>
            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
                    <div style={{
                        position: 'absolute', right: 0, bottom: '100%', marginBottom: 4,
                        background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 7, zIndex: 50, minWidth: 210,
                        boxShadow: '0 -4px 28px rgba(0,0,0,0.55)',
                        overflow: 'hidden',
                    }}>
                        {COND_KIND_LABELS.map(c => (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => { onAdd(c.value); setOpen(false); }}
                                style={{
                                    display: 'flex', width: '100%', gap: 7, alignItems: 'center',
                                    padding: '7px 12px', fontSize: '0.76rem', cursor: 'pointer',
                                    background: 'none', border: 'none', color: 'var(--text-primary)',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    transition: 'background 80ms', textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                <DndIcon category={c.icon.category} name={c.icon.name} size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                {c.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ── ConditionRow ──────────────────────────────────────────────────────────────

const ConditionRow: React.FC<{
    cond: ModifierCondition;
    skills: { id: string; name: string }[];
    onChange: (v: string) => void;
    onRemove: () => void;
}> = ({ cond, skills, onChange, onRemove }) => {
    const meta = COND_KIND_LABELS.find(c => c.value === cond.kind);

    const valueInput = () => {
        switch (cond.kind) {
            case 'weaponType':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.76rem' }}>
                        <option value="melee">Mischia</option>
                        <option value="ranged">A distanza</option>
                        <option value="thrown">Lancio</option>
                    </select>
                );
            case 'saveType':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.76rem' }}>
                        <option value="fort">Tempra</option>
                        <option value="ref">Riflessi</option>
                        <option value="will">Volontà</option>
                    </select>
                );
            case 'abilityStat':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.76rem' }}>
                        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as StatType[]).map(s => (
                            <option key={s} value={s}>{s.toUpperCase()}</option>
                        ))}
                    </select>
                );
            case 'skillId':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.76rem' }}>
                        <option value="">— Abilità —</option>
                        {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                );
            case 'spellMinLevel':
                return (
                    <input type="number" className="input" min={0} max={9}
                        value={cond.value} onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.76rem' }} />
                );
            default:
                return (
                    <input className="input" value={String(cond.value)} onChange={e => onChange(e.target.value)}
                        placeholder={
                            cond.kind === 'weaponCategory' ? 'es. arco, spada lunga…' :
                            cond.kind === 'weaponName' ? 'es. Lama Solare' :
                            cond.kind === 'spellSchool' ? 'es. Evocazione…' :
                            cond.kind === 'spellName' ? 'es. Palla di Fuoco' :
                            cond.kind === 'spellDamageType' ? 'es. fuoco, freddo…' : '…'
                        }
                        style={{ flex: 1, fontSize: '0.76rem' }}
                    />
                );
        }
    };

    return (
        <div style={{
            display: 'flex', gap: 5, alignItems: 'center',
            background: 'rgba(255,255,255,0.035)', padding: '4px 7px',
            borderRadius: 5, border: '1px solid rgba(255,255,255,0.07)',
        }}>
            {meta && <DndIcon category={meta.icon.category} name={meta.icon.name} size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', minWidth: 72, flexShrink: 0 }}>
                {meta?.label ?? cond.kind}
            </span>
            {valueInput()}
            <button type="button" onClick={onRemove}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 2, flexShrink: 0 }}>
                <FaTimes size={9} />
            </button>
        </div>
    );
};
