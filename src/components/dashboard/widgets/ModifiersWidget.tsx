import React, { useMemo, useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import type { ActiveModifier, DurationUnit, ModifierType, StatType } from '../../../types/dnd';
import { DndIcon } from '../../DndIcon';

/* ────────────────────────────────────────────────────────────────────────── */
/* Targets the user can buff or weaken.                                      */
/* ────────────────────────────────────────────────────────────────────────── */
type TargetDef = { id: string; label: string; group: 'stat' | 'save' | 'combat'; iconCategory?: string; iconName?: string };

const TARGETS: TargetDef[] = [
    { id: 'str', label: 'Forza', group: 'stat', iconCategory: 'ability', iconName: 'strength' },
    { id: 'dex', label: 'Destrezza', group: 'stat', iconCategory: 'ability', iconName: 'dexterity' },
    { id: 'con', label: 'Costituzione', group: 'stat', iconCategory: 'ability', iconName: 'constitution' },
    { id: 'int', label: 'Intelligenza', group: 'stat', iconCategory: 'ability', iconName: 'intelligence' },
    { id: 'wis', label: 'Saggezza', group: 'stat', iconCategory: 'ability', iconName: 'wisdom' },
    { id: 'cha', label: 'Carisma', group: 'stat', iconCategory: 'ability', iconName: 'charisma' },
    { id: 'fortitude', label: 'TS Tempra', group: 'save', iconCategory: 'attribute', iconName: 'saving-throw' },
    { id: 'reflex', label: 'TS Riflessi', group: 'save', iconCategory: 'attribute', iconName: 'saving-throw' },
    { id: 'will', label: 'TS Volontà', group: 'save', iconCategory: 'attribute', iconName: 'saving-throw' },
    { id: 'ac', label: 'Classe Armatura', group: 'combat', iconCategory: 'attribute', iconName: 'ac' },
    { id: 'hp', label: 'Punti Ferita', group: 'combat' },
    { id: 'speed', label: 'Velocità', group: 'combat' },
    { id: 'initiative', label: 'Iniziativa', group: 'combat' },
    { id: 'bab', label: 'BAB / Attacco', group: 'combat' },
];

const TARGET_BY_ID: Record<string, TargetDef> = Object.fromEntries(TARGETS.map(t => [t.id, t]));

const MODIFIER_TYPES: { id: ModifierType; label: string }[] = [
    { id: 'untyped', label: 'Senza Tipo' },
    { id: 'enhancement', label: 'Potenziamento' },
    { id: 'morale', label: 'Morale' },
    { id: 'luck', label: 'Fortuna' },
    { id: 'competence', label: 'Competenza' },
    { id: 'dodge', label: 'Schivare' },
    { id: 'deflection', label: 'Deviazione' },
    { id: 'armor', label: 'Armatura' },
    { id: 'shield', label: 'Scudo' },
    { id: 'naturalArmor', label: 'Armatura Naturale' },
    { id: 'size', label: 'Taglia' },
    { id: 'circumstance', label: 'Circostanza' },
    { id: 'racial', label: 'Razziale' },
    { id: 'insight', label: 'Intuito' },
    { id: 'resistance', label: 'Resistenza' },
    { id: 'profane', label: 'Profano' },
    { id: 'sacred', label: 'Sacro' },
    { id: 'alchemical', label: 'Alchemico' },
    { id: 'synergy', label: 'Sinergia' },
];

const UNIT_OPTIONS: { id: DurationUnit; label: string; short: string }[] = [
    { id: 'round', label: 'Round (6s)', short: 'rd' },
    { id: 'turn', label: 'Turni', short: 'tn' },
    { id: 'minute', label: 'Minuti', short: 'min' },
    { id: 'hour', label: 'Ore', short: 'h' },
    { id: 'permanent', label: 'Permanente', short: '∞' },
];

/* ────────────────────────────────────────────────────────────────────────── */

const newId = () => `mod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

interface DraftForm {
    name: string;
    target: string;
    value: number;
    type: ModifierType;
    unit: DurationUnit;
    duration: number;
    source: string;
    notes: string;
}

const EMPTY_DRAFT: DraftForm = {
    name: '',
    target: 'str',
    value: 1,
    type: 'enhancement',
    unit: 'minute',
    duration: 10,
    source: '',
    notes: '',
};

export const ModifiersWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const character = useCharacterStore(s => s.character);
    const addActiveModifier = useCharacterStore(s => s.addActiveModifier);
    const updateActiveModifier = useCharacterStore(s => s.updateActiveModifier);
    const removeActiveModifier = useCharacterStore(s => s.removeActiveModifier);
    const toggleActiveModifierPause = useCharacterStore(s => s.toggleActiveModifierPause);
    const tickActiveModifiers = useCharacterStore(s => s.tickActiveModifiers);
    const clearTemporaryActiveModifiers = useCharacterStore(s => s.clearTemporaryActiveModifiers);

    const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    if (!character) return null;

    const compact = size.pixelW < 320 || size.pixelH < 240;
    const tiny = size.pixelW < 220;

    const list = character.activeModifiers ?? [];
    // Sort: active before paused, then bonuses before maluses, then by remaining
    const sorted = useMemo(() => list.slice().sort((a, b) => {
        if (!!a.paused !== !!b.paused) return a.paused ? 1 : -1;
        const sign = Math.sign(b.value) - Math.sign(a.value);
        if (sign !== 0) return sign;
        const ar = a.remaining ?? 1e9;
        const br = b.remaining ?? 1e9;
        return ar - br;
    }), [list]);

    const buffCount = list.filter(m => !m.paused && m.value > 0).length;
    const malusCount = list.filter(m => !m.paused && m.value < 0).length;

    const startEdit = (mod: ActiveModifier) => {
        setEditingId(mod.id);
        setDraft({
            name: mod.name,
            target: String(mod.target),
            value: mod.value,
            type: mod.type,
            unit: mod.unit,
            duration: mod.initial ?? mod.remaining ?? 0,
            source: mod.source ?? '',
            notes: mod.notes ?? '',
        });
        setShowForm(true);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
        setShowForm(false);
    };

    const submit = () => {
        const name = draft.name.trim() || `${draft.value >= 0 ? 'Bonus' : 'Malus'} a ${TARGET_BY_ID[draft.target]?.label ?? draft.target}`;
        const isPermanent = draft.unit === 'permanent';
        const remaining = isPermanent ? null : Math.max(1, Math.floor(draft.duration || 1));
        const initial = isPermanent ? null : remaining;
        if (editingId) {
            const existing = list.find(m => m.id === editingId);
            if (existing) {
                updateActiveModifier({
                    ...existing,
                    name,
                    target: draft.target as StatType | string,
                    value: draft.value,
                    type: draft.type,
                    unit: draft.unit,
                    remaining,
                    initial,
                    source: draft.source.trim() || undefined,
                    notes: draft.notes.trim() || undefined,
                });
            }
        } else {
            const mod: ActiveModifier = {
                id: newId(),
                name,
                target: draft.target as StatType | string,
                value: draft.value,
                type: draft.type,
                unit: draft.unit,
                remaining,
                initial,
                createdAt: new Date().toISOString(),
                source: draft.source.trim() || undefined,
                notes: draft.notes.trim() || undefined,
            };
            addActiveModifier(mod);
        }
        cancelEdit();
    };

    /* ── Render ────────────────────────────────────────────────── */
    return (
        <div className={`w-mod-root ${compact ? 'is-compact' : ''} ${tiny ? 'is-tiny' : ''}`}>

            {/* Header — counters + tick controls */}
            <header className="w-mod-header">
                <div className="w-mod-counters">
                    <span className="w-mod-counter is-buff" title="Bonus attivi">
                        <DndIcon category="attribute" name="bonus" size={14} />
                        <span>{buffCount}</span>
                    </span>
                    <span className="w-mod-counter is-malus" title="Malus attivi">
                        <DndIcon category="attribute" name="penalty" size={14} />
                        <span>{malusCount}</span>
                    </span>
                </div>
                <div className="w-mod-tick">
                    <button
                        type="button"
                        className="w-mod-tick-btn"
                        title="Avanza di 1 round"
                        onClick={() => tickActiveModifiers('round', 1)}
                    >−1 rd</button>
                    <button
                        type="button"
                        className="w-mod-tick-btn"
                        title="Avanza di 1 minuto (10 round)"
                        onClick={() => { tickActiveModifiers('round', 10); tickActiveModifiers('minute', 1); }}
                    >−1 min</button>
                    {!compact && (
                        <button
                            type="button"
                            className="w-mod-tick-btn"
                            title="Riposo: rimuove tutti gli effetti temporanei"
                            onClick={() => { if (confirm('Rimuovere tutti i modificatori temporanei?')) clearTemporaryActiveModifiers(); }}
                        >Riposo</button>
                    )}
                </div>
            </header>

            {/* Body — list of active modifiers */}
            <div className="w-mod-list w-scroll">
                {sorted.length === 0 ? (
                    <div className="w-empty w-mod-empty">
                        <DndIcon category="util" name="star" size={26} />
                        <span>Nessun modificatore attivo</span>
                        <span className="w-mod-empty-hint">Aggiungine uno per applicare un bonus o un malus temporaneo.</span>
                    </div>
                ) : sorted.map(mod => {
                    const target = TARGET_BY_ID[String(mod.target)];
                    const isBuff = mod.value > 0;
                    const isMalus = mod.value < 0;
                    const isPermanent = mod.unit === 'permanent' || mod.remaining == null;
                    const expiringSoon = !isPermanent && (mod.remaining ?? 0) <= 1;
                    const sign = mod.value >= 0 ? '+' : '−';
                    const abs = Math.abs(mod.value);
                    const unitShort = UNIT_OPTIONS.find(u => u.id === mod.unit)?.short ?? '';
                    return (
                        <div
                            key={mod.id}
                            className={
                                'w-mod-card '
                                + (isBuff ? 'is-buff ' : '')
                                + (isMalus ? 'is-malus ' : '')
                                + (mod.paused ? 'is-paused ' : '')
                                + (expiringSoon ? 'is-expiring ' : '')
                            }
                        >
                            <div className="w-mod-card-pulse" aria-hidden="true" />

                            <div className="w-mod-card-icon">
                                {target?.iconCategory && target?.iconName ? (
                                    <DndIcon category={target.iconCategory} name={target.iconName} size={tiny ? 18 : 22} />
                                ) : (
                                    <DndIcon category="attribute" name={isBuff ? 'bonus' : 'penalty'} size={tiny ? 18 : 22} />
                                )}
                            </div>

                            <div className="w-mod-card-body">
                                <div className="w-mod-card-row">
                                    <span className="w-mod-card-name" title={mod.name}>{mod.name}</span>
                                    <span className={`w-mod-card-value ${isBuff ? 'is-buff' : isMalus ? 'is-malus' : ''}`}>
                                        <span className="w-mod-card-value-sign">{sign}</span>
                                        <span className="w-mod-card-value-num">{abs}</span>
                                    </span>
                                </div>
                                <div className="w-mod-card-meta">
                                    <span className="w-mod-card-target">{target?.label ?? String(mod.target)}</span>
                                    <span className="w-mod-card-dot">·</span>
                                    <span className="w-mod-card-type">{MODIFIER_TYPES.find(t => t.id === mod.type)?.label ?? mod.type}</span>
                                    {mod.source && (<><span className="w-mod-card-dot">·</span><span className="w-mod-card-source">{mod.source}</span></>)}
                                </div>
                            </div>

                            <div className="w-mod-card-duration">
                                {isPermanent ? (
                                    <span className="w-mod-card-duration-perm" title="Permanente">∞</span>
                                ) : (
                                    <span className={`w-mod-card-duration-rem ${expiringSoon ? 'is-expiring' : ''}`} title={`Restano ${mod.remaining} ${unitShort}`}>
                                        <span className="w-mod-card-duration-num">{mod.remaining}</span>
                                        <span className="w-mod-card-duration-unit">{unitShort}</span>
                                    </span>
                                )}
                            </div>

                            <div className="w-mod-card-actions">
                                <button
                                    type="button"
                                    className="w-mod-card-btn"
                                    title={mod.paused ? 'Riattiva' : 'Pausa'}
                                    onClick={() => toggleActiveModifierPause(mod.id)}
                                >
                                    {mod.paused ? '▶' : '⏸'}
                                </button>
                                <button
                                    type="button"
                                    className="w-mod-card-btn"
                                    title="Modifica"
                                    onClick={() => startEdit(mod)}
                                >✎</button>
                                <button
                                    type="button"
                                    className="w-mod-card-btn is-danger"
                                    title="Rimuovi"
                                    onClick={() => removeActiveModifier(mod.id)}
                                >×</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer / form */}
            {!showForm ? (
                <button
                    type="button"
                    className="w-mod-add-btn"
                    onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); setShowForm(true); }}
                >
                    <span className="w-mod-add-plus">＋</span>
                    <span>Aggiungi modificatore</span>
                </button>
            ) : (
                <div className="w-mod-form">
                    <div className="w-mod-form-row">
                        <input
                            className="input w-mod-input"
                            placeholder="Nome (es. Forza del Toro)"
                            value={draft.name}
                            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        />
                    </div>

                    <div className="w-mod-form-grid">
                        <label className="w-mod-form-cell">
                            <span className="w-mod-form-lbl">Target</span>
                            <select
                                className="input w-mod-input"
                                value={draft.target}
                                onChange={e => setDraft(d => ({ ...d, target: e.target.value }))}
                            >
                                <optgroup label="Caratteristiche">
                                    {TARGETS.filter(t => t.group === 'stat').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </optgroup>
                                <optgroup label="Tiri Salvezza">
                                    {TARGETS.filter(t => t.group === 'save').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </optgroup>
                                <optgroup label="Combattimento">
                                    {TARGETS.filter(t => t.group === 'combat').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </optgroup>
                            </select>
                        </label>

                        <label className="w-mod-form-cell">
                            <span className="w-mod-form-lbl">Valore</span>
                            <div className="w-mod-value-row">
                                <button
                                    type="button"
                                    className={`w-mod-sign-btn ${draft.value < 0 ? 'is-active is-malus' : ''}`}
                                    onClick={() => setDraft(d => ({ ...d, value: -Math.abs(d.value || 1) }))}
                                    title="Malus"
                                >−</button>
                                <input
                                    type="number"
                                    className="input w-mod-input w-mod-value-input"
                                    value={Math.abs(draft.value)}
                                    onChange={e => setDraft(d => {
                                        const n = Math.max(0, parseInt(e.target.value || '0', 10));
                                        return { ...d, value: d.value < 0 ? -n : n };
                                    })}
                                />
                                <button
                                    type="button"
                                    className={`w-mod-sign-btn ${draft.value > 0 ? 'is-active is-buff' : ''}`}
                                    onClick={() => setDraft(d => ({ ...d, value: Math.abs(d.value || 1) }))}
                                    title="Bonus"
                                >＋</button>
                            </div>
                        </label>

                        <label className="w-mod-form-cell">
                            <span className="w-mod-form-lbl">Tipo</span>
                            <select
                                className="input w-mod-input"
                                value={draft.type}
                                onChange={e => setDraft(d => ({ ...d, type: e.target.value as ModifierType }))}
                            >
                                {MODIFIER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </label>

                        <label className="w-mod-form-cell">
                            <span className="w-mod-form-lbl">Durata</span>
                            <div className="w-mod-value-row">
                                <input
                                    type="number"
                                    className="input w-mod-input w-mod-value-input"
                                    value={draft.duration}
                                    disabled={draft.unit === 'permanent'}
                                    onChange={e => setDraft(d => ({ ...d, duration: Math.max(1, parseInt(e.target.value || '1', 10)) }))}
                                />
                                <select
                                    className="input w-mod-input"
                                    value={draft.unit}
                                    onChange={e => setDraft(d => ({ ...d, unit: e.target.value as DurationUnit }))}
                                >
                                    {UNIT_OPTIONS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                </select>
                            </div>
                        </label>
                    </div>

                    {!compact && (
                        <div className="w-mod-form-row">
                            <input
                                className="input w-mod-input"
                                placeholder="Sorgente (incantesimo, oggetto, situazione…)"
                                value={draft.source}
                                onChange={e => setDraft(d => ({ ...d, source: e.target.value }))}
                            />
                        </div>
                    )}

                    <div className="w-mod-form-actions">
                        <button type="button" className="w-mod-form-btn" onClick={cancelEdit}>Annulla</button>
                        <button
                            type="button"
                            className={`w-mod-form-btn is-primary ${draft.value >= 0 ? 'is-buff' : 'is-malus'}`}
                            onClick={submit}
                        >
                            {editingId ? 'Salva' : 'Applica'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
