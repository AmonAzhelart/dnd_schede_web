/**
 * CompanionPanel — full companion detail view with:
 *  - Stat block with effective stats (overrides + equipment + runtime mods)
 *  - Privilege/feature management (like ClassFeature for characters)
 *  - Equipment management (barding, collars, etc.)
 *  - HP tracking, conditions, runtime modifiers
 *  - Notes
 */
import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
    FaTimes, FaEdit, FaSave, FaTrash, FaPlus, FaMinus, FaSkull,
    FaHeart, FaChevronDown, FaChevronUp, FaStar, FaScroll,
    FaShieldAlt, FaSyncAlt, FaBolt, FaInfoCircle, FaBoxOpen,
} from 'react-icons/fa';
import { GiScrollUnfurled, GiMagicSwirl, GiSwordman, GiHeartPlus } from 'react-icons/gi';
import type {
    ActivePet, CompanionFeature, CompanionEquipment,
    CreatureRuntimeModifier, ModifierType, CreatureRuntimeStat,
} from '../types/dnd';
import { computeEffectiveCreatureStats, CreaturePortrait, RuntimeModifierPanel, signMod } from './CreatureStatBlock';
import './Bestiary.css';
import './CompanionPanel.css';

/* ─── Helpers ─────────────────────────────────────────────────── */
const sign = (n: number) => (n >= 0 ? '+' : '') + n;
const pctColor = (p: number) => p > 0.6 ? 'healthy' : p > 0.3 ? 'wounded' : p > 0 ? 'critical' : 'dead';

const SLOT_LABELS: Record<CompanionEquipment['slot'], string> = {
    armatura: 'Armatura',
    barding: 'Barding',
    collare: 'Collare',
    borsetta: 'Borsetta',
    altro: 'Altro',
};

const RUNTIME_STAT_LABELS: Record<CreatureRuntimeStat, string> = {
    str: 'Forza', dex: 'Destrezza', con: 'Costituzione',
    int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma',
    ac: 'CA', hp: 'PF', fort: 'TS Tempra', ref: 'TS Riflessi',
    will: 'TS Volontà', attack: 'Attacco', damage: 'Danno',
};

const MODIFIER_TYPE_OPTIONS: { value: ModifierType; label: string }[] = [
    { value: 'enhancement', label: 'Enhancement' },
    { value: 'morale', label: 'Morale' },
    { value: 'luck', label: 'Fortuna' },
    { value: 'competence', label: 'Competenza' },
    { value: 'dodge', label: 'Schivata (cumul.)' },
    { value: 'deflection', label: 'Deflection' },
    { value: 'naturalArmor', label: 'CA Naturale' },
    { value: 'size', label: 'Taglia' },
    { value: 'untyped', label: 'Non tipizzato' },
    { value: 'circumstance', label: 'Circostanza' },
    { value: 'racial', label: 'Razziale' },
    { value: 'insight', label: 'Intuizione' },
    { value: 'resistance', label: 'Resistenza' },
    { value: 'sacred', label: 'Sacro' },
    { value: 'profane', label: 'Profano' },
    { value: 'alchemical', label: 'Alchemico' },
];

const RUNTIME_STAT_OPTIONS: { value: CreatureRuntimeStat; label: string }[] = Object.entries(RUNTIME_STAT_LABELS).map(([value, label]) => ({ value: value as CreatureRuntimeStat, label }));

/* ─── compute effective stats including equipment mods ──────── */
function computePetEffectiveStats(pet: ActivePet) {
    // Build extra runtime mods from active equipment
    const equipMods: CreatureRuntimeModifier[] = (pet.equipment ?? [])
        .filter(e => e.equipped)
        .flatMap(e =>
            e.modifiers.map(m => ({
                id: `equip-${e.id}-${m.stat}`,
                name: e.name,
                stat: m.stat,
                value: m.value,
                type: m.type,
            } as CreatureRuntimeModifier))
        );
    // Active feature mods
    const featMods: CreatureRuntimeModifier[] = (pet.features ?? [])
        .filter(f => f.active)
        .flatMap(f =>
            f.modifiers.map(m => ({
                id: `feat-${f.id}-${m.stat}`,
                name: f.name,
                stat: m.stat,
                value: m.value,
                type: m.type,
            } as CreatureRuntimeModifier))
        );
    const allRuntime = [...(pet.runtimeModifiers ?? []), ...equipMods, ...featMods];
    return computeEffectiveCreatureStats(pet.creature, pet.appliedOverrides, allRuntime);
}

/* ═══════════════════════════════════════════════════════════════
   Feature editor modal
═══════════════════════════════════════════════════════════════ */
interface FeatureEditorProps {
    initial: CompanionFeature | null;
    onSave: (f: CompanionFeature) => void;
    onCancel: () => void;
}

const EMPTY_FEATURE = (): CompanionFeature => ({
    id: uuid(),
    name: '',
    description: '',
    featureType: 'EX',
    active: true,
    modifiers: [],
});

const FeatureEditor: React.FC<FeatureEditorProps> = ({ initial, onSave, onCancel }) => {
    const [form, setForm] = useState<CompanionFeature>(initial ?? EMPTY_FEATURE());
    const set = (patch: Partial<CompanionFeature>) => setForm(f => ({ ...f, ...patch }));

    const addMod = () => set({
        modifiers: [...form.modifiers, { stat: 'str', value: 2, type: 'enhancement' }],
    });
    const updMod = (idx: number, patch: Partial<CompanionFeature['modifiers'][0]>) =>
        set({ modifiers: form.modifiers.map((m, i) => i === idx ? { ...m, ...patch } : m) });
    const delMod = (idx: number) => set({ modifiers: form.modifiers.filter((_, i) => i !== idx) });

    return (
        <div className="cp-modal-overlay">
            <div className="cp-modal">
                <div className="cp-modal-header">
                    <span>{initial ? 'Modifica Privilegio' : 'Nuovo Privilegio'}</span>
                    <button className="btn-ghost" onClick={onCancel}><FaTimes /></button>
                </div>
                <div className="cp-modal-body">
                    <div className="cp-grid2">
                        <div className="cp-field">
                            <label>Nome *</label>
                            <input className="input w-full" value={form.name} onChange={e => set({ name: e.target.value })} placeholder="es. Attacco Furtivo" />
                        </div>
                        <div className="cp-field">
                            <label>Tipo</label>
                            <select className="input w-full" value={form.featureType} onChange={e => set({ featureType: e.target.value as CompanionFeature['featureType'] })}>
                                <option value="EX">EX – Straordinario</option>
                                <option value="SP">SP – Magico</option>
                                <option value="SU">SU – Soprannaturale</option>
                                <option value="PA">PA – Passivo</option>
                            </select>
                        </div>
                    </div>
                    <div className="cp-field">
                        <label>Descrizione</label>
                        <textarea className="input w-full" rows={3} value={form.description} onChange={e => set({ description: e.target.value })} />
                    </div>
                    <div className="cp-grid3">
                        <div className="cp-field">
                            <label>Nome risorsa (es. "Ruggito")</label>
                            <input className="input w-full" value={form.resourceName ?? ''} onChange={e => set({ resourceName: e.target.value || undefined })} placeholder="opzionale" />
                        </div>
                        <div className="cp-field">
                            <label>Usi max</label>
                            <input className="input w-full" type="number" min={1} value={form.resourceMax ?? ''} onChange={e => set({ resourceMax: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                    </div>

                    {/* Modifiers */}
                    <div className="cp-section-title">
                        <span>Modificatori alle statistiche</span>
                        <button className="btn-secondary text-xs" onClick={addMod}><FaPlus /> Aggiungi</button>
                    </div>
                    {form.modifiers.map((m, i) => (
                        <div key={i} className="cp-mod-row">
                            <select className="input" value={m.stat} onChange={e => updMod(i, { stat: e.target.value as CreatureRuntimeStat })}>
                                {RUNTIME_STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input className="input" type="number" value={m.value} onChange={e => updMod(i, { value: Number(e.target.value) })} style={{ width: 72 }} />
                            <select className="input" value={m.type} onChange={e => updMod(i, { type: e.target.value as ModifierType })}>
                                {MODIFIER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => delMod(i)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
                <div className="cp-modal-footer">
                    <button className="btn-secondary text-sm" onClick={onCancel}>Annulla</button>
                    <button className="btn-primary text-sm" onClick={() => form.name.trim() && onSave(form)}><FaSave /> Salva</button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   Equipment editor modal
═══════════════════════════════════════════════════════════════ */
interface EquipmentEditorProps {
    initial: CompanionEquipment | null;
    onSave: (e: CompanionEquipment) => void;
    onCancel: () => void;
}

const EMPTY_EQUIPMENT = (): CompanionEquipment => ({
    id: uuid(),
    name: '',
    slot: 'altro',
    equipped: true,
    modifiers: [],
});

const EquipmentEditor: React.FC<EquipmentEditorProps> = ({ initial, onSave, onCancel }) => {
    const [form, setForm] = useState<CompanionEquipment>(initial ?? EMPTY_EQUIPMENT());
    const set = (patch: Partial<CompanionEquipment>) => setForm(f => ({ ...f, ...patch }));

    const addMod = () => set({
        modifiers: [...form.modifiers, { stat: 'ac', value: 2, type: 'armor' as ModifierType }],
    });
    const updMod = (idx: number, patch: Partial<CompanionEquipment['modifiers'][0]>) =>
        set({ modifiers: form.modifiers.map((m, i) => i === idx ? { ...m, ...patch } : m) });
    const delMod = (idx: number) => set({ modifiers: form.modifiers.filter((_, i) => i !== idx) });

    return (
        <div className="cp-modal-overlay">
            <div className="cp-modal">
                <div className="cp-modal-header">
                    <span>{initial ? 'Modifica Equipaggiamento' : 'Nuovo Oggetto'}</span>
                    <button className="btn-ghost" onClick={onCancel}><FaTimes /></button>
                </div>
                <div className="cp-modal-body">
                    <div className="cp-grid2">
                        <div className="cp-field">
                            <label>Nome *</label>
                            <input className="input w-full" value={form.name} onChange={e => set({ name: e.target.value })} placeholder="es. Barding di Mithral" />
                        </div>
                        <div className="cp-field">
                            <label>Slot</label>
                            <select className="input w-full" value={form.slot} onChange={e => set({ slot: e.target.value as CompanionEquipment['slot'] })}>
                                {Object.entries(SLOT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="cp-field">
                        <label>Descrizione</label>
                        <textarea className="input w-full" rows={2} value={form.description ?? ''} onChange={e => set({ description: e.target.value || undefined })} />
                    </div>
                    <div className="cp-field">
                        <label>Peso (kg)</label>
                        <input className="input" type="number" min={0} step={0.1} value={form.weight ?? ''} onChange={e => set({ weight: e.target.value ? Number(e.target.value) : undefined })} style={{ width: 100 }} />
                    </div>

                    {/* Modifiers */}
                    <div className="cp-section-title">
                        <span>Bonus all'equipaggiamento</span>
                        <button className="btn-secondary text-xs" onClick={addMod}><FaPlus /> Aggiungi</button>
                    </div>
                    {form.modifiers.map((m, i) => (
                        <div key={i} className="cp-mod-row">
                            <select className="input" value={m.stat} onChange={e => updMod(i, { stat: e.target.value as CreatureRuntimeStat })}>
                                {RUNTIME_STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input className="input" type="number" value={m.value} onChange={e => updMod(i, { value: Number(e.target.value) })} style={{ width: 72 }} />
                            <select className="input" value={m.type} onChange={e => updMod(i, { type: e.target.value as ModifierType })}>
                                {MODIFIER_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => delMod(i)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
                <div className="cp-modal-footer">
                    <button className="btn-secondary text-sm" onClick={onCancel}>Annulla</button>
                    <button className="btn-primary text-sm" onClick={() => form.name.trim() && onSave(form)}><FaSave /> Salva</button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   BOND STARS — inline compact
═══════════════════════════════════════════════════════════════ */
const BondStars: React.FC<{ level: number; onChange: (n: number) => void }> = ({ level, onChange }) => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => (
            <FaStar
                key={n}
                onClick={() => onChange(n === level ? 0 : n)}
                style={{
                    cursor: 'pointer',
                    color: n <= level ? 'var(--accent-gold)' : 'rgba(255,255,255,0.12)',
                    fontSize: '0.75rem',
                    transition: 'color 0.15s',
                }}
            />
        ))}
    </div>
);

/* ═══════════════════════════════════════════════════════════════
   COMPANION PANEL (main export)
═══════════════════════════════════════════════════════════════ */
type CPanelTab = 'stats' | 'privilegi' | 'equipaggiamento' | 'note';

export interface CompanionPanelProps {
    pet: ActivePet;
    onClose: () => void;
    onUpdatePet: (pet: ActivePet) => void;
    onUpdateHp: (delta: number) => void;
    onAddRuntimeModifier: (mod: CreatureRuntimeModifier) => void;
    onRemoveRuntimeModifier: (id: string) => void;
    onUpdateFeature: (f: CompanionFeature) => void;
    onRemoveFeature: (id: string) => void;
    onToggleFeature: (id: string) => void;
    onUseFeatureResource: (id: string) => void;
    onResetFeatureResource: (id: string) => void;
    onUpdateEquipment: (e: CompanionEquipment) => void;
    onRemoveEquipment: (id: string) => void;
    onToggleEquipment: (id: string) => void;
    onDismiss: () => void;
}

export const CompanionPanel: React.FC<CompanionPanelProps> = ({
    pet, onClose, onUpdatePet, onUpdateHp,
    onAddRuntimeModifier, onRemoveRuntimeModifier,
    onUpdateFeature, onRemoveFeature, onToggleFeature, onUseFeatureResource, onResetFeatureResource,
    onUpdateEquipment, onRemoveEquipment, onToggleEquipment,
    onDismiss,
}) => {
    const [tab, setTab] = useState<CPanelTab>('stats');
    const [hpDelta, setHpDelta] = useState(1);
    const [editingFeature, setEditingFeature] = useState<CompanionFeature | 'new' | null>(null);
    const [editingEquipment, setEditingEquipment] = useState<CompanionEquipment | 'new' | null>(null);
    const [editNickname, setEditNickname] = useState(false);
    const [nicknameInput, setNicknameInput] = useState(pet.nickname ?? '');

    const eff = computePetEffectiveStats(pet);
    const pct = eff.hp > 0 ? Math.max(0, pet.currentHp / eff.hp) : 0;
    const { creature } = pet;

    const features = pet.features ?? [];
    const equipment = pet.equipment ?? [];

    const tabItems: { id: CPanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'stats', label: 'Statistiche', icon: <GiSwordman /> },
        { id: 'privilegi', label: 'Privilegi', icon: <GiScrollUnfurled />, badge: features.length || undefined },
        { id: 'equipaggiamento', label: 'Equipaggiamento', icon: <FaShieldAlt />, badge: equipment.filter(e => e.equipped).length || undefined },
        { id: 'note', label: 'Note', icon: <FaScroll /> },
    ];

    const saveFeature = (f: CompanionFeature) => {
        onUpdateFeature(f);
        setEditingFeature(null);
    };
    const saveEquipment = (e: CompanionEquipment) => {
        onUpdateEquipment(e);
        setEditingEquipment(null);
    };
    const saveNickname = () => {
        onUpdatePet({ ...pet, nickname: nicknameInput.trim() || undefined });
        setEditNickname(false);
    };

    return (
        <>
            {/* Feature editor modal */}
            {editingFeature !== null && (
                <FeatureEditor
                    initial={editingFeature === 'new' ? null : editingFeature}
                    onSave={saveFeature}
                    onCancel={() => setEditingFeature(null)}
                />
            )}
            {/* Equipment editor modal */}
            {editingEquipment !== null && (
                <EquipmentEditor
                    initial={editingEquipment === 'new' ? null : editingEquipment}
                    onSave={saveEquipment}
                    onCancel={() => setEditingEquipment(null)}
                />
            )}

            <div className="cp-panel animate-fade-in">
                {/* ── HEADER: compact single row ── */}
                <div className="cp-header">
                    <CreaturePortrait creature={creature} size={52} />
                    <div className="cp-header-info">
                        {editNickname ? (
                            <div className="cp-name-edit-row">
                                <input
                                    className="input"
                                    style={{ flex: 1, fontSize: '1rem', fontFamily: 'var(--font-heading)', padding: '3px 8px' }}
                                    value={nicknameInput}
                                    onChange={e => setNicknameInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveNickname(); if (e.key === 'Escape') setEditNickname(false); }}
                                    autoFocus
                                />
                                <button className="btn-primary text-xs" style={{ padding: '4px 8px' }} onClick={saveNickname}><FaSave /></button>
                                <button className="btn-ghost text-xs" onClick={() => setEditNickname(false)}><FaTimes /></button>
                            </div>
                        ) : (
                            <div className="cp-name" onClick={() => setEditNickname(true)} title="Clicca per modificare il nome">
                                {pet.nickname ?? creature.name}
                                <FaEdit className="cp-name-edit-icon" />
                            </div>
                        )}
                        <div className="cp-header-row2">
                            <span className="cp-meta">
                                {creature.size} {creature.type}
                                {creature.challengeRating ? ` · CR ${creature.challengeRating}` : ''}
                                {creature.alignment ? ` · ${creature.alignment}` : ''}
                            </span>
                            <BondStars
                                level={pet.bondLevel ?? 0}
                                onChange={n => onUpdatePet({ ...pet, bondLevel: n })}
                            />
                        </div>
                    </div>
                    <div className="cp-header-actions">
                        <button className="cp-close-btn" onClick={onClose} title="Chiudi"><FaTimes /></button>
                        <button className="cp-dismiss-btn" onClick={() => { if (confirm(`Rimuovere ${pet.nickname ?? creature.name}?`)) { onDismiss(); } }} title="Rimuovi compagno"><FaTrash /></button>
                    </div>
                </div>

                {/* ── HP STRIP: all in one line ── */}
                <div className="cp-hp-strip">
                    <div className="cp-hp-bar-row">
                        <FaHeart className="cp-hp-heart" style={{ color: pet.currentHp > 0 ? 'var(--accent-crimson)' : '#636e72', flexShrink: 0 }} />
                        <div className="tracker-hp-bar" style={{ flex: 1 }}>
                            <div className={`tracker-hp-fill ${pctColor(pct)}`} style={{ width: `${pct * 100}%` }} />
                        </div>
                        <span className="cp-hp-fraction">
                            <span style={{ color: pet.currentHp <= 0 ? '#636e72' : pet.currentHp < eff.hp * 0.3 ? 'var(--accent-crimson)' : 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                                {pet.currentHp}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 2px' }}>/</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{eff.hp}</span>
                            {pet.currentHp <= 0 && <FaSkull style={{ color: '#636e72', marginLeft: 4, fontSize: '0.8rem' }} />}
                        </span>
                    </div>
                    <div className="cp-hp-controls">
                        <button className="btn-secondary cp-hp-btn" onClick={() => onUpdateHp(-hpDelta)}><FaMinus /></button>
                        <input
                            type="number" min={1} value={hpDelta}
                            onChange={e => setHpDelta(Math.max(1, Number(e.target.value) || 1))}
                            className="input cp-hp-input"
                        />
                        <button className="btn-primary cp-hp-btn" onClick={() => onUpdateHp(hpDelta)}><FaPlus /></button>
                        <button className="btn-ghost cp-hp-heal-btn" onClick={() => onUpdateHp(eff.hp - pet.currentHp)} title="Cura tutto">
                            <GiHeartPlus /> <span className="cp-hp-heal-label">Cura tutto</span>
                        </button>
                    </div>
                </div>

                {/* ── TABS ── */}
                <div className="cp-tabs">
                    {tabItems.map(t => (
                        <button
                            key={t.id}
                            className={`cp-tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon} {t.label}
                            {t.badge ? <span className="cp-tab-badge">{t.badge}</span> : null}
                        </button>
                    ))}
                </div>

                {/* ── CONTENT ── */}
                <div className="cp-content">

                    {/* ─── STATS TAB ─── */}
                    {tab === 'stats' && (
                        <div className="cp-stats-tab">
                            {/* Combat metrics */}
                            <div className="cp-metrics-grid">
                                {[
                                    { label: 'CA', val: eff.ac.toString(), color: 'var(--accent-gold)' },
                                    { label: 'BAB', val: `+${creature.bab}` },
                                    { label: 'VEL', val: `${creature.speed}m` },
                                    ...(creature.fly ? [{ label: 'VOLO', val: `${creature.fly}m` }] : []),
                                    ...(creature.swim ? [{ label: 'NUOTO', val: `${creature.swim}m` }] : []),
                                    ...(creature.climb ? [{ label: 'SCALATA', val: `${creature.climb}m` }] : []),
                                ].map(s => (
                                    <div key={s.label} className="cp-metric-box">
                                        <div className="cp-metric-label">{s.label}</div>
                                        <div className="cp-metric-val" style={{ color: s.color }}>{s.val}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Ability scores */}
                            <div className="cp-ability-grid">
                                {[
                                    { key: 'str', label: 'FOR', base: creature.str, eff: eff.str },
                                    { key: 'dex', label: 'DES', base: creature.dex, eff: eff.dex },
                                    { key: 'con', label: 'COS', base: creature.con, eff: eff.con },
                                    { key: 'int', label: 'INT', base: creature.int, eff: eff.int },
                                    { key: 'wis', label: 'SAG', base: creature.wis, eff: eff.wis },
                                    { key: 'cha', label: 'CAR', base: creature.cha, eff: eff.cha },
                                ].map(s => {
                                    const delta = s.eff - s.base;
                                    return (
                                        <div key={s.key} className="cp-ability-box">
                                            <div className="cp-ability-label">{s.label}</div>
                                            <div className="cp-ability-score">{s.eff}</div>
                                            <div className="cp-ability-mod">{signMod(s.eff)}</div>
                                            {delta !== 0 && (
                                                <div className={`cp-ability-delta ${delta > 0 ? 'pos' : 'neg'}`}>
                                                    {delta > 0 ? '+' : ''}{delta}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Saves */}
                            <div className="cp-saves-row">
                                {[
                                    { label: 'Tempra', val: eff.fort, hint: `base ${sign(creature.fortitude)}` },
                                    { label: 'Riflessi', val: eff.reflex, hint: `base ${sign(creature.reflex)}` },
                                    { label: 'Volontà', val: eff.will, hint: `base ${sign(creature.will)}` },
                                ].map(s => (
                                    <div key={s.label} className="cp-save-box" title={s.hint}>
                                        <div className="cp-save-label">{s.label}</div>
                                        <div className="cp-save-val">{sign(s.val)}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Defenses */}
                            {(creature.damageReduction || creature.spellResistance || creature.resistances || creature.immunities || creature.weaknesses) && (
                                <div className="cp-defense-block">
                                    {creature.damageReduction && <div className="cp-def-line"><span className="cp-def-key">RD</span>{creature.damageReduction}</div>}
                                    {(creature.spellResistance ?? 0) > 0 && <div className="cp-def-line"><span className="cp-def-key">RI</span>{creature.spellResistance}</div>}
                                    {creature.resistances && <div className="cp-def-line"><span className="cp-def-key">Res.</span>{creature.resistances}</div>}
                                    {creature.immunities && <div className="cp-def-line"><span className="cp-def-key">Imm.</span>{creature.immunities}</div>}
                                    {creature.weaknesses && <div className="cp-def-line"><span className="cp-def-key">Vuln.</span>{creature.weaknesses}</div>}
                                </div>
                            )}

                            {/* Attacks */}
                            {creature.actions.length > 0 && (
                                <>
                                    <div className="cp-section-title"><span>Attacchi</span></div>
                                    <div className="cp-attacks-list">
                                        {creature.actions.map(a => (
                                            <div key={a.id} className="cp-attack-row">
                                                <span className="cp-attack-name">{a.name}</span>
                                                {a.attackBonus != null && (
                                                    <span className="cp-attack-bonus">
                                                        {sign((a.attackBonus ?? 0) + eff.attackDelta)}
                                                    </span>
                                                )}
                                                {a.damage && (
                                                    <span className="cp-attack-damage">{a.damage}{eff.damageDelta !== 0 ? ` ${sign(eff.damageDelta)}` : ''}</span>
                                                )}
                                                {a.damageType && <span className="cp-attack-type">{a.damageType}</span>}
                                                <span className="cp-attack-range">{a.range ?? 'Mischia'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Special abilities */}
                            {creature.specialAbilities.length > 0 && (
                                <>
                                    <div className="cp-section-title"><span>Capacità Speciali</span></div>
                                    {creature.specialAbilities.map(a => (
                                        <div key={a.id} className="cp-ability-entry">
                                            <span className="cp-ability-entry-name">{a.name} <span className="cp-ability-tag">{a.abilityType}</span></span>
                                            <p className="cp-ability-entry-desc">{a.description}</p>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Runtime modifiers */}
                            <RuntimeModifierPanel
                                modifiers={pet.runtimeModifiers ?? []}
                                onAdd={onAddRuntimeModifier}
                                onRemove={onRemoveRuntimeModifier}
                            />

                            {/* Static override chips */}
                            {pet.appliedOverrides.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <div className="cp-section-title"><span>Modificatori da talenti/oggetti (al momento dell'aggiunta)</span></div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {pet.appliedOverrides.map((o, i) => (
                                            <span key={i} className={`override-chip${o.value < 0 ? ' negative' : ''}`} style={{ fontSize: '0.65rem' }}>
                                                {o.source}: {o.stat.toUpperCase()} {o.value >= 0 ? '+' : ''}{o.value}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── PRIVILEGI TAB ─── */}
                    {tab === 'privilegi' && (
                        <div className="cp-tab-content">
                            <div className="cp-tab-header">
                                <span className="cp-tab-title">Privilegi del Compagno</span>
                                <button className="btn-primary text-xs" onClick={() => setEditingFeature('new')}>
                                    <FaPlus /> Nuovo privilegio
                                </button>
                            </div>
                            {features.length === 0 && (
                                <div className="cp-empty">
                                    <GiScrollUnfurled style={{ fontSize: '2rem', opacity: 0.3, marginBottom: 8 }} />
                                    <p>Nessun privilegio. Aggiungi capacità speciali, talenti e abilità che il tuo compagno ha sviluppato.</p>
                                </div>
                            )}
                            <div className="cp-features-list">
                                {features.map(f => (
                                    <div key={f.id} className={`cp-feature-card ${f.active ? 'active' : 'inactive'}`}>
                                        <div className="cp-feature-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button
                                                    className={`cp-feature-toggle ${f.active ? 'on' : 'off'}`}
                                                    onClick={() => onToggleFeature(f.id)}
                                                    title={f.active ? 'Attivo – clicca per disattivare' : 'Inattivo – clicca per attivare'}
                                                >
                                                    <FaBolt />
                                                </button>
                                                <span className="cp-feature-name">{f.name}</span>
                                                <span className="cp-feature-type-badge">{f.featureType}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-ghost text-xs" onClick={() => setEditingFeature(f)}><FaEdit /></button>
                                                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }}
                                                    onClick={() => { if (confirm(`Rimuovere "${f.name}"?`)) onRemoveFeature(f.id); }}>
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </div>
                                        {f.description && <p className="cp-feature-desc">{f.description}</p>}
                                        {/* Modifiers preview */}
                                        {f.modifiers.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                                {f.modifiers.map((m, i) => (
                                                    <span key={i} className={`override-chip${m.value < 0 ? ' negative' : ''}`} style={{ fontSize: '0.65rem' }}>
                                                        {RUNTIME_STAT_LABELS[m.stat]} {m.value >= 0 ? '+' : ''}{m.value} ({m.type})
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Resource tracking */}
                                        {f.resourceName && f.resourceMax != null && (
                                            <div className="cp-resource-row">
                                                <span className="cp-resource-name">{f.resourceName}</span>
                                                <div className="cp-resource-pips">
                                                    {Array.from({ length: f.resourceMax }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`cp-resource-pip ${i < (f.resourceMax! - (f.resourceUsed ?? 0)) ? 'available' : 'spent'}`}
                                                        />
                                                    ))}
                                                </div>
                                                <button className="btn-ghost text-xs" onClick={() => onUseFeatureResource(f.id)}
                                                    disabled={(f.resourceUsed ?? 0) >= f.resourceMax!} title="Usa">
                                                    Usa
                                                </button>
                                                <button className="btn-ghost text-xs" onClick={() => onResetFeatureResource(f.id)} title="Ripristina">
                                                    <FaSyncAlt />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── EQUIPAGGIAMENTO TAB ─── */}
                    {tab === 'equipaggiamento' && (
                        <div className="cp-tab-content">
                            <div className="cp-tab-header">
                                <span className="cp-tab-title">Equipaggiamento</span>
                                <button className="btn-primary text-xs" onClick={() => setEditingEquipment('new')}>
                                    <FaPlus /> Nuovo oggetto
                                </button>
                            </div>

                            {/* Summary of equipped bonuses */}
                            {equipment.filter(e => e.equipped).length > 0 && (() => {
                                const equipped = equipment.filter(e => e.equipped);
                                const allMods = equipped.flatMap(e => e.modifiers);
                                if (allMods.length === 0) return null;
                                return (
                                    <div className="cp-equip-summary">
                                        <div className="cp-section-title" style={{ marginBottom: 6 }}><span>Bonus attivi da equipaggiamento</span></div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {allMods.map((m, i) => (
                                                <span key={i} className={`override-chip${m.value < 0 ? ' negative' : ''}`} style={{ fontSize: '0.65rem' }}>
                                                    {RUNTIME_STAT_LABELS[m.stat]} {m.value >= 0 ? '+' : ''}{m.value} ({m.type})
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {equipment.length === 0 && (
                                <div className="cp-empty">
                                    <FaBoxOpen style={{ fontSize: '2rem', opacity: 0.3, marginBottom: 8 }} />
                                    <p>Nessun oggetto. Aggiungi barding, collari magici e altri oggetti che potenziamo il tuo compagno.</p>
                                </div>
                            )}

                            <div className="cp-equip-list">
                                {equipment.map(e => (
                                    <div key={e.id} className={`cp-equip-card ${e.equipped ? 'equipped' : 'stowed'}`}>
                                        <div className="cp-equip-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button
                                                    className={`cp-equip-toggle ${e.equipped ? 'on' : 'off'}`}
                                                    onClick={() => onToggleEquipment(e.id)}
                                                    title={e.equipped ? 'Indossato – clicca per rimuovere' : 'Non indossato – clicca per indossare'}
                                                >
                                                    <FaShieldAlt />
                                                </button>
                                                <div>
                                                    <span className="cp-equip-name">{e.name}</span>
                                                    <span className="cp-equip-slot">{SLOT_LABELS[e.slot]}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-ghost text-xs" onClick={() => setEditingEquipment(e)}><FaEdit /></button>
                                                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }}
                                                    onClick={() => { if (confirm(`Rimuovere "${e.name}"?`)) onRemoveEquipment(e.id); }}>
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </div>
                                        {e.description && <p className="cp-equip-desc">{e.description}</p>}
                                        {e.modifiers.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                                {e.modifiers.map((m, i) => (
                                                    <span key={i} className={`override-chip${m.value < 0 ? ' negative' : ''} ${!e.equipped ? 'stowed-chip' : ''}`} style={{ fontSize: '0.65rem' }}>
                                                        {RUNTIME_STAT_LABELS[m.stat]} {m.value >= 0 ? '+' : ''}{m.value}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {e.weight && <div className="cp-equip-weight">{e.weight} kg</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── NOTE TAB ─── */}
                    {tab === 'note' && (
                        <div className="cp-tab-content">
                            <div className="cp-tab-header">
                                <span className="cp-tab-title">Note sul Compagno</span>
                            </div>
                            <textarea
                                className="input w-full"
                                rows={12}
                                value={pet.notes ?? ''}
                                onChange={e => onUpdatePet({ ...pet, notes: e.target.value })}
                                placeholder="Scrivi note su questo compagno: storia, comportamenti, addestramento, legami speciali…"
                                style={{ resize: 'vertical', fontSize: '0.9rem', lineHeight: 1.6 }}
                            />
                            <div className="cp-field" style={{ marginTop: 12 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Punti Esperienza</label>
                                <input
                                    className="input"
                                    type="number"
                                    min={0}
                                    value={pet.xp ?? ''}
                                    onChange={e => onUpdatePet({ ...pet, xp: e.target.value ? Number(e.target.value) : undefined })}
                                    placeholder="0"
                                    style={{ width: 140 }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
