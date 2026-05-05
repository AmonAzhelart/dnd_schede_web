/**
 * ModifierEditor — editor per il modello Modifier strutturato (channel-based).
 * Compatibile con modificatori legacy (target senza appliesTo).
 */
import React, { useMemo, useState } from 'react';
import { FaPlus, FaTimes, FaBolt, FaHandPointer, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { DndIcon } from './DndIcon';
import type { Modifier, ModifierType, ModifierCondition, RollChannel, StatType } from '../types/dnd';
import { useCharacterStore } from '../store/characterStore';
import { ROLL_CHANNEL_LABELS } from '../services/modifiers';

// ── MUI ───────────────────────────────────────────────────────────────────────
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Autocomplete from '@mui/material/Autocomplete';
import MuiSelect from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

// ── Tema MUI dark-fantasy (esportato per riuso) ───────────────────────────────
export const dndMuiTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#9b59b6' },
        background: { paper: '#1c1c27', default: '#0d0d0f' },
        text: { primary: '#e8e4d8', secondary: '#9a9ab0' },
    },
    typography: { fontFamily: '"Inter", sans-serif', fontSize: 13 },
    shape: { borderRadius: 6 },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#1c1c27',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.12)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.22)',
                    },
                },
                input: { padding: '6px 10px' },
            },
        },
        MuiAutocomplete: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#1c1c27',
                    backgroundImage: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                },
                option: {
                    fontSize: '0.82rem',
                    '&[aria-selected="true"]': {
                        backgroundColor: 'rgba(155,89,182,0.2) !important',
                    },
                    '&.Mui-focused': {
                        backgroundColor: 'rgba(255,255,255,0.06) !important',
                    },
                },
                groupLabel: {
                    backgroundColor: '#0d0d0f',
                    color: '#9a9ab0',
                    fontSize: '0.58rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight: '2.2',
                },
                groupUl: { padding: 0 },
                noOptions: { fontSize: '0.82rem', color: '#9a9ab0' },
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: { fontSize: '0.82rem', padding: '6px 10px' },
                icon: { color: '#9a9ab0' },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontSize: '0.82rem',
                    minHeight: 36,
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(155,89,182,0.2)',
                        '&:hover': { backgroundColor: 'rgba(155,89,182,0.28)' },
                    },
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontSize: '0.78rem',
                    color: '#9a9ab0',
                    '&.Mui-focused': { color: '#9b59b6' },
                },
            },
        },
    },
});

// ── Tipi bonus ────────────────────────────────────────────────────────────────
const MOD_TYPES: { value: ModifierType; label: string }[] = [
    { value: 'untyped', label: 'Senza tipo' },
    { value: 'enhancement', label: 'Potenziamento' },
    { value: 'armor', label: 'Armatura' },
    { value: 'shield', label: 'Scudo' },
    { value: 'naturalArmor', label: 'Arm. Naturale' },
    { value: 'deflection', label: 'Deviazione' },
    { value: 'dodge', label: 'Schivata' },
    { value: 'circumstance', label: 'Circostanza' },
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

// ── Condizioni disponibili ────────────────────────────────────────────────────
const COND_KINDS: { value: ModifierCondition['kind']; label: string; icon: { category: string; name: string } }[] = [
    { value: 'weaponType', label: 'Tipo arma', icon: { category: 'combat', name: 'melee' } },
    { value: 'weaponCategory', label: 'Categoria arma', icon: { category: 'weapon', name: 'sword' } },
    { value: 'weaponName', label: 'Nome arma', icon: { category: 'weapon', name: 'dagger' } },
    { value: 'damageType', label: 'Tipo danno', icon: { category: 'damage', name: 'fire' } },
    { value: 'skillId', label: 'Abilità specifica', icon: { category: 'skill', name: 'arcana' } },
    { value: 'saveType', label: 'Tiro salvezza', icon: { category: 'd20test', name: 'saving-throw' } },
    { value: 'abilityStat', label: 'Caratteristica', icon: { category: 'ability', name: 'strength' } },
    { value: 'spellSchool', label: 'Scuola magia', icon: { category: 'spell', name: 'evocation' } },
    { value: 'spellName', label: 'Incantesimo', icon: { category: 'spell', name: 'octagon' } },
    { value: 'spellDamageType', label: 'Tipo magia', icon: { category: 'damage', name: 'lightning' } },
    { value: 'spellMinLevel', label: 'Livello min. magia', icon: { category: 'spell', name: 'upcast' } },
];

// ── Migrazione legacy ─────────────────────────────────────────────────────────
function ensureAppliesTo(mod: Modifier): Modifier {
    if (mod.appliesTo && mod.appliesTo.length > 0) return mod;
    const t = (mod.target || '').toLowerCase().trim();
    let channel: string | null = null;
    if (!t) channel = null;
    else if (t === 'fortitude') channel = 'save.fort';
    else if (t === 'reflex') channel = 'save.ref';
    else if (t === 'will') channel = 'save.will';
    else if (
        t.startsWith('skill.') || t.startsWith('check.') || t.startsWith('save.') ||
        ['attack', 'damage', 'ac', 'initiative', 'cmb', 'cmd'].includes(t)
    ) channel = t;
    if (!channel) return mod;
    return { ...mod, appliesTo: [channel as RollChannel] };
}

// ── Tipo canale opzione ───────────────────────────────────────────────────────
type ChannelOption = { value: string; label: string; group: string };

// ── Prop pubbliche ────────────────────────────────────────────────────────────
export interface ModifierEditorProps {
    modifiers: Modifier[];
    onChange: (next: Modifier[]) => void;
    accentColor?: string;
    title?: string;
    compact?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// ModifierEditor — contenitore principale
// ═════════════════════════════════════════════════════════════════════════════
export const ModifierEditor: React.FC<ModifierEditorProps> = ({
    modifiers, onChange,
    accentColor = 'var(--accent-arcane)',
    title = 'MODIFICATORI',
}) => {
    const character = useCharacterStore(s => s.character);

    const skillOptions = useMemo(() =>
        character ? Object.values(character.skills).map(s => ({ id: s.id, name: s.name })) : [],
        [character]);

    const weaponOptions = useMemo(() =>
        character ? character.inventory.filter(i => i.type === 'weapon').map(i => i.name) : [],
        [character]);

    const channelOptions: ChannelOption[] = useMemo(() => {
        const skills = skillOptions.map(s => ({
            value: `skill.${s.id}` as RollChannel,
            label: `Abilità: ${s.name}`,
            group: 'Abilità',
        }));
        return [...ROLL_CHANNEL_LABELS, ...skills];
    }, [skillOptions]);

    const update = (i: number, fn: (m: Modifier) => Modifier) =>
        onChange(modifiers.map((m, idx) => idx === i ? fn(ensureAppliesTo(m)) : m));

    const addMod = () => onChange([...modifiers, {
        target: 'attack', value: 1, type: 'untyped', source: '', appliesTo: ['attack'],
    }]);

    const removeMod = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));
    const setChannel = (i: number, ch: string) => update(i, m => ({ ...m, target: ch, appliesTo: [ch as RollChannel] }));

    const addCondition = (i: number, kind: ModifierCondition['kind']) => update(i, m => {
        const init: ModifierCondition = (() => {
            switch (kind) {
                case 'weaponType': return { kind, value: 'melee' };
                case 'saveType': return { kind, value: 'fort' };
                case 'abilityStat': return { kind, value: 'str' };
                case 'spellMinLevel': return { kind, value: 1 };
                default: return { kind, value: '' };
            }
        })();
        return { ...m, conditions: [...(m.conditions ?? []), init] };
    });

    const updateCondition = (i: number, ci: number, value: string) => update(i, m => ({
        ...m,
        conditions: (m.conditions ?? []).map((c, idx) => {
            if (idx !== ci) return c;
            if (c.kind === 'spellMinLevel') return { ...c, value: Math.max(0, Math.min(9, parseInt(value) || 0)) };
            return { ...c, value: value as never };
        }),
    }));

    const removeCondition = (i: number, ci: number) => update(i, m => ({
        ...m, conditions: (m.conditions ?? []).filter((_, idx) => idx !== ci),
    }));

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
                        {title}
                        {modifiers.length > 0 && (
                            <span style={{
                                background: `${accentColor}22`, border: `1px solid ${accentColor}44`,
                                borderRadius: 10, padding: '0 6px', fontSize: '0.58rem', color: accentColor,
                            }}>{modifiers.length}</span>
                        )}
                    </span>
                    <button
                        type="button" onClick={addMod}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                            background: `${accentColor}18`, border: `1px solid ${accentColor}50`,
                            color: accentColor, fontSize: '0.74rem', fontFamily: 'var(--font-heading)',
                        }}
                    >
                        <FaPlus size={8} /> Aggiungi modificatore
                    </button>
                </div>

                {/* ── Stato vuoto ── */}
                {modifiers.length === 0 && (
                    <div style={{
                        padding: '14px 0', textAlign: 'center',
                        fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic',
                    }}>
                        Nessun modificatore — l'effetto sarà solo descrittivo.
                    </div>
                )}

                {/* ── Lista modificatori ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {modifiers.map((rawMod, i) => {
                        const mod = ensureAppliesTo(rawMod);
                        const ch = mod.appliesTo?.[0] ?? mod.target;
                        return (
                            <ModifierCard
                                key={i}
                                mod={mod}
                                channel={ch}
                                accentColor={accentColor}
                                channelOptions={channelOptions}
                                skillOptions={skillOptions}
                                weaponOptions={weaponOptions}
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
        </ThemeProvider>
    );
};

// ═════════════════════════════════════════════════════════════════════════════
// ModifierCard — singolo modificatore come form card sempre espanso
// ═════════════════════════════════════════════════════════════════════════════
interface ModifierCardProps {
    mod: Modifier;
    channel: string;
    accentColor: string;
    channelOptions: ChannelOption[];
    skillOptions: { id: string; name: string }[];
    weaponOptions: string[];
    onUpdate: (fn: (m: Modifier) => Modifier) => void;
    onRemove: () => void;
    onSetChannel: (ch: string) => void;
    onAddCondition: (kind: ModifierCondition['kind']) => void;
    onUpdateCondition: (ci: number, v: string) => void;
    onRemoveCondition: (ci: number) => void;
}

const ModifierCard: React.FC<ModifierCardProps> = ({
    mod, channel, accentColor, channelOptions, skillOptions, weaponOptions,
    onUpdate, onRemove, onSetChannel, onAddCondition, onUpdateCondition, onRemoveCondition,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const isManual = !!mod.manualPrompt || mod.scope === 'conditional';
    const conditions = mod.conditions ?? [];
    const hasAdvanced = !!mod.extraDice || mod.statOverride !== undefined;
    const positive = mod.value >= 0;

    const channelMeta = channelOptions.find(o => o.value === channel) ?? null;

    const focusSx = {
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: accentColor,
        },
        '& label.Mui-focused': { color: accentColor },
    };

    return (
        <div style={{
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
                {/* Accent bar laterale */}
                <div style={{ width: 4, alignSelf: 'stretch', background: accentColor, flexShrink: 0 }} />

                {/* Stepper valore */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '0 12px',
                    borderRight: `1px solid ${accentColor}22`,
                    gap: 0, flexShrink: 0,
                }}>
                    <button type="button" onClick={() => onUpdate(m => ({ ...m, value: m.value - 1 }))} style={stepBtnSt}>−</button>
                    <input
                        type="number"
                        value={mod.value}
                        onChange={e => onUpdate(m => ({ ...m, value: parseInt(e.target.value) || 0 }))}
                        style={{
                            width: 52, textAlign: 'center',
                            fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700,
                            background: 'transparent', border: 'none', outline: 'none',
                            color: positive ? 'var(--accent-success)' : 'var(--accent-crimson)',
                            padding: '0 4px', MozAppearance: 'textfield' as never,
                        }}
                    />
                    <button type="button" onClick={() => onUpdate(m => ({ ...m, value: m.value + 1 }))} style={stepBtnSt}>+</button>
                </div>

                {/* Pulsante rimuovi */}
                <button
                    type="button" onClick={onRemove} title="Rimuovi modificatore"
                    style={{
                        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(192,57,43,0.45)', padding: '4px 0 4px 10px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', transition: 'color 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-crimson)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(192,57,43,0.45)')}
                >
                    <FaTimes size={13} />
                </button>
            </div>

            {/* ── Bersaglio + Tipo ── */}
            <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
                padding: '10px 14px',
                borderBottom: `1px solid rgba(255,255,255,0.05)`,
            }}>
                {/* Bersaglio — Autocomplete con ricerca */}
                <Autocomplete<ChannelOption, false, true>
                    size="small"
                    options={channelOptions}
                    groupBy={o => o.group}
                    getOptionLabel={o => o.label}
                    value={channelMeta}
                    onChange={(_, v) => { if (v) onSetChannel(v.value); }}
                    isOptionEqualToValue={(o, v) => o.value === v.value}
                    disableClearable
                    sx={{ flex: '1 1 200px', ...focusSx }}
                    renderInput={params => (
                        <TextField
                            {...params}
                            label="Bersaglio"
                            variant="outlined"
                            size="small"
                        />
                    )}
                />

                {/* Tipo bonus — Select */}
                <FormControl size="small" sx={{ flex: '0 0 150px', ...focusSx }}>
                    <InputLabel>Tipo bonus</InputLabel>
                    <MuiSelect
                        value={mod.type}
                        label="Tipo bonus"
                        onChange={e => onUpdate(m => ({ ...m, type: e.target.value as ModifierType }))}
                    >
                        {MOD_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </MuiSelect>
                </FormControl>
            </div>

            {/* ── Corpo card ── */}
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Attivazione */}
                <div>
                    <div style={sectionLabel}>Quando si applica</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                        <button
                            type="button"
                            onClick={() => onUpdate(m => ({ ...m, scope: 'always', manualPrompt: undefined }))}
                            style={{
                                flex: 1, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                fontSize: '0.8rem', fontFamily: 'var(--font-heading)', transition: 'all 130ms',
                                border: `1px solid ${!isManual ? 'var(--accent-success)66' : 'rgba(255,255,255,0.08)'}`,
                                background: !isManual ? 'rgba(39,174,96,0.14)' : 'rgba(255,255,255,0.02)',
                                color: !isManual ? 'var(--accent-success)' : 'var(--text-muted)',
                                fontWeight: !isManual ? 600 : 400,
                            }}
                        >
                            <FaBolt size={10} /> Sempre attivo
                        </button>
                        <button
                            type="button"
                            onClick={() => onUpdate(m => ({ ...m, scope: 'conditional', manualPrompt: m.manualPrompt ?? '' }))}
                            style={{
                                flex: 1, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                fontSize: '0.8rem', fontFamily: 'var(--font-heading)', transition: 'all 130ms',
                                border: `1px solid ${isManual ? 'var(--accent-warning)66' : 'rgba(255,255,255,0.08)'}`,
                                background: isManual ? 'rgba(230,126,34,0.14)' : 'rgba(255,255,255,0.02)',
                                color: isManual ? 'var(--accent-warning)' : 'var(--text-muted)',
                                fontWeight: isManual ? 600 : 400,
                            }}
                        >
                            <FaHandPointer size={10} /> Solo su richiesta
                        </button>
                    </div>
                    {isManual && (
                        <input
                            className="input"
                            placeholder="Etichetta del toggle mostrata al tiro (es. 'Entro 9 m da un alleato')"
                            value={mod.manualPrompt ?? ''}
                            onChange={e => onUpdate(m => ({ ...m, manualPrompt: e.target.value, scope: 'conditional' }))}
                            style={{ marginTop: 6, fontSize: '0.8rem', width: '100%' }}
                        />
                    )}
                </div>

                {/* Condizioni */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={sectionLabel}>
                            Condizioni (filtri applicazione){conditions.length > 0 ? ` · ${conditions.length}` : ''}
                        </div>
                    </div>

                    {conditions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                            {conditions.map((c, ci) => (
                                <ConditionRow
                                    key={ci}
                                    cond={c}
                                    skills={skillOptions}
                                    weapons={weaponOptions}
                                    accentColor={accentColor}
                                    onChange={v => onUpdateCondition(ci, v)}
                                    onRemove={() => onRemoveCondition(ci)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Aggiungi condizione — MUI Select con icone */}
                    <FormControl size="small" fullWidth sx={focusSx}>
                        <MuiSelect
                            displayEmpty
                            value=""
                            onChange={e => {
                                if (e.target.value) onAddCondition(e.target.value as ModifierCondition['kind']);
                            }}
                            renderValue={() => (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                    ＋ Aggiungi condizione…
                                </span>
                            )}
                        >
                            {COND_KINDS.map(c => (
                                <MenuItem key={c.value} value={c.value}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <DndIcon category={c.icon.category} name={c.icon.name} size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        {c.label}
                                    </span>
                                </MenuItem>
                            ))}
                        </MuiSelect>
                    </FormControl>
                </div>

                {/* Opzioni avanzate */}
                <div>
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                            background: 'none', border: 'none', padding: 0,
                            color: hasAdvanced ? accentColor : 'var(--text-muted)',
                            fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}
                    >
                        {showAdvanced ? <FaChevronDown size={8} /> : <FaChevronRight size={8} />}
                        Opzioni avanzate
                        {hasAdvanced && !showAdvanced && (
                            <span style={{
                                background: `${accentColor}22`, border: `1px solid ${accentColor}44`,
                                borderRadius: 8, padding: '0 5px', fontSize: '0.56rem', color: accentColor,
                            }}>configurate</span>
                        )}
                    </button>

                    {showAdvanced && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <label style={fieldLabel}>Dadi extra (es. 1d6 fuoco)</label>
                                <input
                                    className="input"
                                    value={mod.extraDice ?? ''}
                                    onChange={e => onUpdate(m => ({ ...m, extraDice: e.target.value || undefined }))}
                                    placeholder="vuoto = nessuno"
                                    style={{ fontSize: '0.8rem' }}
                                />
                            </div>
                            <FormControl size="small" sx={{ flex: '0 0 150px', ...focusSx }}>
                                <InputLabel title="Usa questa caratteristica al posto di quella di default (es. DES per Weapon Finesse)">
                                    Sostituisci car.
                                </InputLabel>
                                <MuiSelect
                                    value={mod.statOverride ?? ''}
                                    label="Sostituisci car."
                                    onChange={e => onUpdate(m => ({
                                        ...m,
                                        statOverride: e.target.value ? e.target.value as StatType : undefined,
                                    }))}
                                >
                                    <MenuItem value="">— default —</MenuItem>
                                    {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as StatType[]).map(s => (
                                        <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>
                                    ))}
                                </MuiSelect>
                            </FormControl>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Stili condivisi ───────────────────────────────────────────────────────────
const stepBtnSt: React.CSSProperties = {
    width: 26, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4, cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: '1rem', flexShrink: 0,
    userSelect: 'none',
};

const sectionLabel: React.CSSProperties = {
    fontSize: '0.6rem', color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
};

const fieldLabel: React.CSSProperties = {
    fontSize: '0.6rem', color: 'var(--text-muted)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
};

// ═════════════════════════════════════════════════════════════════════════════
// ConditionRow — singola condizione con editor del valore
// ═════════════════════════════════════════════════════════════════════════════
const ConditionRow: React.FC<{
    cond: ModifierCondition;
    skills: { id: string; name: string }[];
    weapons: string[];
    accentColor: string;
    onChange: (v: string) => void;
    onRemove: () => void;
}> = ({ cond, skills, weapons, accentColor, onChange, onRemove }) => {
    const meta = COND_KINDS.find(c => c.value === cond.kind);

    const focusSx = {
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: accentColor,
        },
    };

    const valueControl = () => {
        switch (cond.kind) {
            case 'weaponType':
                return (
                    <MuiSelect size="small" value={cond.value} sx={{ flex: 1, fontSize: '0.8rem', ...focusSx }}
                        onChange={e => onChange(e.target.value as string)}>
                        <MenuItem value="melee">Mischia</MenuItem>
                        <MenuItem value="ranged">A distanza</MenuItem>
                        <MenuItem value="thrown">Lancio</MenuItem>
                    </MuiSelect>
                );
            case 'saveType':
                return (
                    <MuiSelect size="small" value={cond.value} sx={{ flex: 1, fontSize: '0.8rem', ...focusSx }}
                        onChange={e => onChange(e.target.value as string)}>
                        <MenuItem value="fort">Tempra</MenuItem>
                        <MenuItem value="ref">Riflessi</MenuItem>
                        <MenuItem value="will">Volontà</MenuItem>
                    </MuiSelect>
                );
            case 'abilityStat':
                return (
                    <MuiSelect size="small" value={cond.value} sx={{ flex: 1, fontSize: '0.8rem', ...focusSx }}
                        onChange={e => onChange(e.target.value as string)}>
                        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as StatType[]).map(s => (
                            <MenuItem key={s} value={s}>{s.toUpperCase()}</MenuItem>
                        ))}
                    </MuiSelect>
                );
            case 'skillId':
                return (
                    <MuiSelect size="small" value={cond.value} displayEmpty sx={{ flex: 1, fontSize: '0.8rem', ...focusSx }}
                        onChange={e => onChange(e.target.value as string)}>
                        <MenuItem value="">— Seleziona abilità —</MenuItem>
                        {skills.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </MuiSelect>
                );
            case 'spellMinLevel':
                return (
                    <input type="number" className="input" min={0} max={9}
                        value={cond.value} onChange={e => onChange(e.target.value)}
                        style={{ flex: 1, fontSize: '0.8rem' }} />
                );
            case 'weaponName':
                return (
                    <Autocomplete<string, false, false, true>
                        freeSolo
                        size="small"
                        options={weapons}
                        value={String(cond.value)}
                        onChange={(_, v) => { if (v) onChange(v); }}
                        onInputChange={(_, v) => onChange(v)}
                        sx={{ flex: 1, ...focusSx }}
                        renderInput={params => (
                            <TextField {...params} size="small" placeholder="es. Lama Solare" />
                        )}
                        noOptionsText="Nessuna arma in inventario"
                    />
                );
            default:
                return (
                    <input className="input" value={String(cond.value)} onChange={e => onChange(e.target.value)}
                        placeholder={
                            cond.kind === 'weaponCategory' ? 'es. arco, spada lunga…' :
                                cond.kind === 'spellSchool' ? 'es. Evocazione…' :
                                    cond.kind === 'spellName' ? 'es. Palla di Fuoco' :
                                        cond.kind === 'spellDamageType' ? 'es. fuoco, freddo…' : '…'
                        }
                        style={{ flex: 1, fontSize: '0.8rem' }}
                    />
                );
        }
    };

    return (
        <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '6px 8px',
        }}>
            {meta && (
                <DndIcon
                    category={meta.icon.category} name={meta.icon.name} size={14}
                    style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                />
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 88, flexShrink: 0 }}>
                {meta?.label ?? cond.kind}
            </span>
            {valueControl()}
            <button type="button" onClick={onRemove}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(192,57,43,0.5)', padding: '2px', flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-crimson)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(192,57,43,0.5)')}
            >
                <FaTimes size={11} />
            </button>
        </div>
    );
};
