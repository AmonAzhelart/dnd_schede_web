/**
 * Shared editor for the new structured `Modifier` model (channel-based with
 * conditions + manual prompt). Used by ItemModal, Inventory, Feats and
 * ClassFeatures so all three tabs offer the exact same UX.
 *
 * Backward-compatible: legacy `target`-based modifiers without `appliesTo`
 * are auto-converted on first edit (the legacy `target` is mapped onto the
 * matching channel and stored in `appliesTo`).
 */
import React, { useMemo } from 'react';
import { FaPlus, FaTimes, FaBolt, FaHandPointer } from 'react-icons/fa';
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

const COND_KIND_LABELS: { value: ModifierCondition['kind']; label: string }[] = [
    { value: 'weaponType', label: 'Tipo arma (mischia/distanza/lancio)' },
    { value: 'weaponCategory', label: 'Categoria arma (es. arco)' },
    { value: 'weaponName', label: 'Nome arma (es. Spada Lunga)' },
    { value: 'damageType', label: 'Tipo di danno' },
    { value: 'skillId', label: 'Solo per abilità specifica' },
    { value: 'saveType', label: 'Solo per TS specifico' },
    { value: 'abilityStat', label: 'Solo per prova di caratteristica' },
    { value: 'spellSchool', label: 'Solo per scuola di magia' },
    { value: 'spellName', label: 'Solo per incantesimo specifico' },
    { value: 'spellDamageType', label: 'Solo per tipo di magia (energia)' },
    { value: 'spellMinLevel', label: 'Solo per magie di livello minimo' },
];

/** Migrate a legacy modifier (free-form `target`) into the new `appliesTo`
 *  shape on its first edit. */
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
    if (!channel) return mod; // Keep legacy stat-based target untouched
    return { ...mod, appliesTo: [channel as RollChannel] };
}

// ──────────────────────────────────────────────────────────────────────────────

export interface ModifierEditorProps {
    modifiers: Modifier[];
    onChange: (next: Modifier[]) => void;
    /** Accent color for the section heading (matches the parent UI). */
    accentColor?: string;
    /** Optional title override. */
    title?: string;
    /** Compact layout for tight cards (Feats list). */
    compact?: boolean;
}

export const ModifierEditor: React.FC<ModifierEditorProps> = ({
    modifiers, onChange, accentColor = 'var(--accent-arcane)', title = 'MODIFICATORI', compact,
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

    const update = (i: number, mutate: (m: Modifier) => Modifier) => {
        const next = modifiers.map((m, idx) => idx === i ? mutate(ensureAppliesTo(m)) : m);
        onChange(next);
    };

    const addMod = () => {
        onChange([...modifiers, {
            target: 'attack', value: 1, type: 'enhancement', source: '',
            appliesTo: ['attack'],
        }]);
    };
    const removeMod = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));

    const setChannel = (i: number, channel: string) => update(i, m => ({
        ...m,
        target: channel,
        appliesTo: [channel as RollChannel],
    }));

    const addCondition = (i: number, kind: ModifierCondition['kind']) => update(i, m => {
        const conds = [...(m.conditions ?? [])];
        const initial: ModifierCondition = (() => {
            switch (kind) {
                case 'weaponType': return { kind, value: 'melee' };
                case 'weaponCategory': return { kind, value: '' };
                case 'weaponName': return { kind, value: '' };
                case 'damageType': return { kind, value: '' };
                case 'skillId': return { kind, value: '' };
                case 'saveType': return { kind, value: 'fort' };
                case 'abilityStat': return { kind, value: 'str' };
                case 'spellSchool': return { kind, value: '' };
                case 'spellName': return { kind, value: '' };
                case 'spellDamageType': return { kind, value: '' };
                case 'spellMinLevel': return { kind, value: 1 };
            }
        })();
        conds.push(initial);
        return { ...m, conditions: conds };
    });
    const updateCondition = (i: number, ci: number, value: string) => update(i, m => {
        const conds = (m.conditions ?? []).map((c, idx) => {
            if (idx !== ci) return c;
            // spellMinLevel stores a numeric value; everything else is a string.
            if (c.kind === 'spellMinLevel') {
                const n = Math.max(0, Math.min(9, parseInt(value, 10) || 0));
                return { ...c, value: n };
            }
            return { ...c, value: value as never };
        });
        return { ...m, conditions: conds };
    });
    const removeCondition = (i: number, ci: number) => update(i, m => ({
        ...m,
        conditions: (m.conditions ?? []).filter((_, idx) => idx !== ci),
    }));

    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{title}</span>
                <button
                    type="button"
                    onClick={addMod}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: accentColor, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                    <FaPlus size={8} /> Aggiungi
                </button>
            </div>

            {modifiers.length === 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>
                    Nessun modificatore. L'effetto sarà solo descrittivo.
                </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modifiers.map((rawMod, i) => {
                    const mod = ensureAppliesTo(rawMod);
                    const channel = mod.appliesTo?.[0] ?? mod.target;
                    const isManual = !!mod.manualPrompt || mod.scope === 'conditional';
                    const hasAuto = (mod.conditions?.length ?? 0) > 0;
                    return (
                        <div key={i} style={{
                            border: `1px solid ${accentColor}33`,
                            background: `${accentColor}08`,
                            borderRadius: 5,
                            padding: compact ? 6 : 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                        }}>
                            {/* Row 1: channel, value, type, delete */}
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                    className="input"
                                    value={channel}
                                    onChange={e => setChannel(i, e.target.value)}
                                    style={{ flex: '1 1 180px', fontSize: '0.78rem' }}
                                >
                                    {grouped.map(([group, items]) => (
                                        <optgroup key={group} label={group}>
                                            {items.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </optgroup>
                                    ))}
                                </select>
                                <input
                                    className="input"
                                    type="number"
                                    value={mod.value}
                                    onChange={e => update(i, m => ({ ...m, value: parseInt(e.target.value) || 0 }))}
                                    style={{ width: 56, fontSize: '0.78rem', textAlign: 'center' }}
                                    title="Bonus piatto"
                                />
                                {channel === 'damage' && (
                                    <input
                                        className="input"
                                        value={mod.extraDice ?? ''}
                                        onChange={e => update(i, m => ({ ...m, extraDice: e.target.value || undefined }))}
                                        placeholder="+ dadi (es. 1d6)"
                                        style={{ width: 92, fontSize: '0.78rem' }}
                                        title="Dadi di danno extra (es. 1d6 fuoco)"
                                    />
                                )}
                                <select
                                    className="input"
                                    value={mod.type}
                                    onChange={e => update(i, m => ({ ...m, type: e.target.value as ModifierType }))}
                                    style={{ flex: '0 0 140px', fontSize: '0.78rem' }}
                                >
                                    {MOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeMod(i)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 3 }}
                                    title="Rimuovi"
                                >
                                    <FaTimes size={11} />
                                </button>
                            </div>

                            {/* Row 2: stat override (optional) */}
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }} title="Sostituisce la caratteristica di default usata per questo tiro">
                                    Usa caratteristica:
                                </span>
                                <select
                                    className="input"
                                    value={mod.statOverride ?? ''}
                                    onChange={e => update(i, m => ({
                                        ...m,
                                        statOverride: e.target.value ? e.target.value as StatType : undefined,
                                    }))}
                                    style={{ flex: '0 0 120px', fontSize: '0.76rem' }}
                                    title="Weapon Finesse, Grazia della Lama, ecc."
                                >
                                    <option value="">— Default —</option>
                                    {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as StatType[]).map(s => (
                                        <option key={s} value={s}>{s.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 3: scope chooser */}
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                <label title="Si applica sempre quando la sorgente è attiva (e le condizioni sono soddisfatte)" style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={!isManual}
                                        onChange={() => update(i, m => ({ ...m, scope: 'always', manualPrompt: undefined }))}
                                    />
                                    <FaBolt size={9} /> Auto
                                </label>
                                <label title="Mostrato come spunta opzionale al momento del tiro" style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={isManual}
                                        onChange={() => update(i, m => ({ ...m, scope: 'conditional', manualPrompt: m.manualPrompt ?? '' }))}
                                    />
                                    <FaHandPointer size={9} /> Toggle
                                </label>
                                {isManual && (
                                    <input
                                        className="input"
                                        placeholder="Etichetta (es. 'Se entro 18 m')"
                                        value={mod.manualPrompt ?? ''}
                                        onChange={e => update(i, m => ({ ...m, manualPrompt: e.target.value, scope: 'conditional' }))}
                                        style={{ flex: 1, fontSize: '0.74rem', minWidth: 140 }}
                                    />
                                )}
                            </div>

                            {/* Conditions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                                        CONDIZIONI {hasAuto ? `(${mod.conditions!.length})` : ''}
                                    </span>
                                    <select
                                        value=""
                                        onChange={e => {
                                            if (e.target.value) addCondition(i, e.target.value as ModifierCondition['kind']);
                                            e.target.value = '';
                                        }}
                                        className="input"
                                        style={{ fontSize: '0.7rem', padding: '2px 4px', width: 150 }}
                                    >
                                        <option value="">+ Aggiungi…</option>
                                        {COND_KIND_LABELS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {(mod.conditions ?? []).map((c, ci) => (
                                    <ConditionRow
                                        key={ci}
                                        cond={c}
                                        skills={skillOptions}
                                        onChange={v => updateCondition(i, ci, v)}
                                        onRemove={() => removeCondition(i, ci)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────

const ConditionRow: React.FC<{
    cond: ModifierCondition;
    skills: { id: string; name: string }[];
    onChange: (value: string) => void;
    onRemove: () => void;
}> = ({ cond, skills, onChange, onRemove }) => {
    const labelMap: Record<ModifierCondition['kind'], string> = {
        weaponType: 'Tipo arma',
        weaponCategory: 'Categoria',
        weaponName: 'Nome arma',
        damageType: 'Tipo danno',
        skillId: 'Abilità',
        saveType: 'TS',
        abilityStat: 'Caratteristica',
        spellSchool: 'Scuola',
        spellName: 'Magia',
        spellDamageType: 'Tipo magia',
        spellMinLevel: 'Liv. min.',
    };

    const renderValueInput = () => {
        switch (cond.kind) {
            case 'weaponType':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)} style={{ flex: 1, fontSize: '0.74rem' }}>
                        <option value="melee">Mischia</option>
                        <option value="ranged">A distanza</option>
                        <option value="thrown">Lancio</option>
                    </select>
                );
            case 'saveType':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)} style={{ flex: 1, fontSize: '0.74rem' }}>
                        <option value="fort">Tempra</option>
                        <option value="ref">Riflessi</option>
                        <option value="will">Volontà</option>
                    </select>
                );
            case 'abilityStat':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)} style={{ flex: 1, fontSize: '0.74rem' }}>
                        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as StatType[]).map(s => (
                            <option key={s} value={s}>{s.toUpperCase()}</option>
                        ))}
                    </select>
                );
            case 'skillId':
                return (
                    <select className="input" value={cond.value} onChange={e => onChange(e.target.value)} style={{ flex: 1, fontSize: '0.74rem' }}>
                        <option value="">— Seleziona —</option>
                        {skills.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                );
            case 'spellMinLevel':
                return (
                    <input
                        className="input"
                        type="number"
                        min={0}
                        max={9}
                        value={cond.value}
                        onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.74rem' }}
                    />
                );
            default:
                return (
                    <input
                        className="input"
                        value={String(cond.value)}
                        onChange={e => onChange(e.target.value)}
                        placeholder={cond.kind === 'weaponCategory' ? 'es. arco, spada lunga…' :
                            cond.kind === 'weaponName' ? 'es. Lama Solare' :
                                cond.kind === 'spellSchool' ? 'es. Evocazione, Necromanzia…' :
                                    cond.kind === 'spellName' ? 'es. Palla di Fuoco' :
                                        cond.kind === 'spellDamageType' ? 'es. fuoco, freddo, elettricità' :
                                            'es. p, t, fuoco…'}
                        style={{ flex: 1, fontSize: '0.74rem' }}
                    />
                );
        }
    };

    return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '3px 6px', borderRadius: 4 }}>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', minWidth: 70 }}>{labelMap[cond.kind]}</span>
            {renderValueInput()}
            <button
                type="button"
                onClick={onRemove}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 2 }}
            >
                <FaTimes size={9} />
            </button>
        </div>
    );
};
