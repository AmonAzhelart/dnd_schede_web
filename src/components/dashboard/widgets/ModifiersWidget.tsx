import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import type { ActiveModifier, DurationUnit, ModifierType, StatType } from '../../../types/dnd';
import { DndIcon } from '../../DndIcon';
import { DndSelect } from '../../ui/DndSelect';

/* == Targets == */
type TargetDef = { id: string; label: string; short: string; group: 'stat' | 'save' | 'combat' };

const TARGETS: TargetDef[] = [
    { id: 'str', label: 'Forza', short: 'FOR', group: 'stat' },
    { id: 'dex', label: 'Destrezza', short: 'DES', group: 'stat' },
    { id: 'con', label: 'Costituzione', short: 'COS', group: 'stat' },
    { id: 'int', label: 'Intelligenza', short: 'INT', group: 'stat' },
    { id: 'wis', label: 'Saggezza', short: 'SAG', group: 'stat' },
    { id: 'cha', label: 'Carisma', short: 'CAR', group: 'stat' },
    { id: 'fortitude', label: 'TS Tempra', short: 'TMP', group: 'save' },
    { id: 'reflex', label: 'TS Riflessi', short: 'RIF', group: 'save' },
    { id: 'will', label: 'TS Volonta`', short: 'VOL', group: 'save' },
    { id: 'ac', label: 'Classe Armatura', short: 'CA', group: 'combat' },
    { id: 'hp', label: 'Punti Ferita', short: 'PF', group: 'combat' },
    { id: 'speed', label: 'Velocita`', short: 'MOV', group: 'combat' },
    { id: 'initiative', label: 'Iniziativa', short: 'INI', group: 'combat' },
    { id: 'bab', label: 'BAB / Attacco', short: 'BAB', group: 'combat' },
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
    { id: 'naturalArmor', label: 'Arm. Naturale' },
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
    { id: 'permanent', label: 'Permanente', short: '\u221e' },
];

const newId = () => `mod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

interface DraftForm {
    name: string; target: string; value: number;
    type: ModifierType; unit: DurationUnit; duration: number; source: string;
}
const EMPTY_DRAFT: DraftForm = { name: '', target: 'str', value: 1, type: 'enhancement', unit: 'minute', duration: 10, source: '' };

/* == Compact active mod row == */
interface RowProps { mod: ActiveModifier; micro: boolean; onPause(): void; onEdit(): void; onArchive(): void; }
const ModRow: React.FC<RowProps> = ({ mod, micro, onPause, onEdit, onArchive }) => {
    const tDef = TARGET_BY_ID[String(mod.target)];
    const isBuff = mod.value > 0;
    const isPermanent = mod.unit === 'permanent' || mod.remaining == null;
    const expiring = !isPermanent && (mod.remaining ?? 0) <= 1;
    const sign = mod.value >= 0 ? '+' : '\u2212';
    const abs = Math.abs(mod.value);
    const unitShort = UNIT_OPTIONS.find(u => u.id === mod.unit)?.short ?? '';
    const typeLbl = MODIFIER_TYPES.find(t => t.id === mod.type)?.label ?? mod.type;
    return (
        <div className={'w-mod-row' + (isBuff ? ' is-buff' : ' is-malus') + (mod.paused ? ' is-paused' : '') + (expiring ? ' is-expiring' : '')}>
            <span className={'w-mod-pill' + (isBuff ? ' is-buff' : ' is-malus')}>{sign}{abs}</span>
            <div className="w-mod-info">
                <span className="w-mod-name">{mod.name}</span>
                {!micro && <span className="w-mod-sub">{tDef?.short ?? tDef?.label ?? String(mod.target)}{' \u00b7 '}{typeLbl}</span>}
            </div>
            {!micro && (
                <div className={'w-mod-dur' + (expiring ? ' is-expiring' : '')}>
                    {isPermanent
                        ? <span className="w-mod-dur-perm">\u221e</span>
                        : <><span className="w-mod-dur-num">{mod.remaining}</span><span className="w-mod-dur-unit">{unitShort}</span></>}
                </div>
            )}
            <div className="w-mod-acts">
                <button className="w-mod-act" title={mod.paused ? 'Riattiva' : 'Pausa'} onClick={onPause}>{mod.paused ? '\u25b6' : '\u23f8'}</button>
                <button className="w-mod-act" title="Modifica" onClick={onEdit}>{'\u270e'}</button>
                <button className="w-mod-act is-danger" title="Archivia" onClick={onArchive}>{'\u00d7'}</button>
            </div>
        </div>
    );
};

/* == History row == */
interface HistRowProps { mod: ActiveModifier; onReactivate(): void; }
const HistRow: React.FC<HistRowProps> = ({ mod, onReactivate }) => {
    const tDef = TARGET_BY_ID[String(mod.target)];
    const isBuff = mod.value > 0;
    const sign = mod.value >= 0 ? '+' : '\u2212';
    const abs = Math.abs(mod.value);
    return (
        <div className={'w-mod-row is-history' + (isBuff ? ' is-buff' : ' is-malus')}>
            <span className={'w-mod-pill' + (isBuff ? ' is-buff' : ' is-malus')}>{sign}{abs}</span>
            <div className="w-mod-info">
                <span className="w-mod-name">{mod.name}</span>
                <span className="w-mod-sub">{tDef?.short ?? tDef?.label ?? String(mod.target)}{' \u00b7 '}{MODIFIER_TYPES.find(t => t.id === mod.type)?.label ?? mod.type}</span>
            </div>
            <button className="w-mod-reactivate" title="Riattiva" onClick={onReactivate}>{'\u21ba'}</button>
        </div>
    );
};

/* == Widget == */
export const ModifiersWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const character = useCharacterStore(s => s.character);
    const addActiveModifier = useCharacterStore(s => s.addActiveModifier);
    const updateActiveModifier = useCharacterStore(s => s.updateActiveModifier);
    const archiveActiveModifier = useCharacterStore(s => s.archiveActiveModifier);
    const toggleActiveModifierPause = useCharacterStore(s => s.toggleActiveModifierPause);
    const tickActiveModifiers = useCharacterStore(s => s.tickActiveModifiers);
    const clearTemporaryActiveModifiers = useCharacterStore(s => s.clearTemporaryActiveModifiers);
    const reactivateModifier = useCharacterStore(s => s.reactivateModifier);
    const clearModifiersHistory = useCharacterStore(s => s.clearModifiersHistory);

    const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [tab, setTab] = useState<'active' | 'history'>('active');
    const [historyQuery, setHistoryQuery] = useState('');

    /* Lock body scroll while modal is open */
    useEffect(() => {
        if (!showForm) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [showForm]);

    if (!character) return null;

    const micro = size.pixelW < 240;
    const small = size.pixelW < 340;

    const list = character.activeModifiers ?? [];
    const history = character.modifiersHistory ?? [];

    const sorted = useMemo(() => list.slice().sort((a, b) => {
        if (!!a.paused !== !!b.paused) return a.paused ? 1 : -1;
        const s = Math.sign(b.value) - Math.sign(a.value);
        if (s !== 0) return s;
        return (a.remaining ?? 1e9) - (b.remaining ?? 1e9);
    }), [list]);

    const buffCount = list.filter(m => !m.paused && m.value > 0).length;
    const malusCount = list.filter(m => !m.paused && m.value < 0).length;

    const startEdit = (mod: ActiveModifier) => {
        setEditingId(mod.id);
        setDraft({ name: mod.name, target: String(mod.target), value: mod.value, type: mod.type, unit: mod.unit, duration: mod.initial ?? mod.remaining ?? 1, source: mod.source ?? '' });
        setShowForm(true);
    };
    const cancelEdit = () => { setEditingId(null); setDraft(EMPTY_DRAFT); setShowForm(false); };

    const submit = () => {
        const name = draft.name.trim() || `${draft.value >= 0 ? 'Bonus' : 'Malus'} a ${TARGET_BY_ID[draft.target]?.label ?? draft.target}`;
        const isPerm = draft.unit === 'permanent';
        const remaining = isPerm ? null : Math.max(1, Math.floor(draft.duration || 1));
        const initial = isPerm ? null : remaining;
        if (editingId) {
            const existing = list.find(m => m.id === editingId);
            if (existing) updateActiveModifier({ ...existing, name, target: draft.target as StatType | string, value: draft.value, type: draft.type, unit: draft.unit, remaining, initial, source: draft.source.trim() || undefined });
        } else {
            addActiveModifier({ id: newId(), name, target: draft.target as StatType | string, value: draft.value, type: draft.type, unit: draft.unit, remaining, initial, createdAt: new Date().toISOString(), source: draft.source.trim() || undefined });
        }
        cancelEdit();
    };

    return (
        <div className={'w-mod-root' + (micro ? ' is-micro' : small ? ' is-small' : '')}>

            <header className="w-mod-header">
                <div className="w-mod-counters">
                    <span className={'w-mod-counter is-buff' + (buffCount === 0 ? ' is-zero' : '')} title="Bonus attivi">
                        <DndIcon category="attribute" name="bonus" size={12} />
                        <span>{buffCount}</span>
                    </span>
                    <span className={'w-mod-counter is-malus' + (malusCount === 0 ? ' is-zero' : '')} title="Malus attivi">
                        <DndIcon category="attribute" name="penalty" size={12} />
                        <span>{malusCount}</span>
                    </span>
                </div>
                <div className="w-mod-tick">
                    <button type="button" className="w-mod-tick-btn" title="Avanza 1 round" onClick={() => tickActiveModifiers('round', 1)}>-1 rd</button>
                    <button type="button" className="w-mod-tick-btn" title="Avanza 1 minuto" onClick={() => { tickActiveModifiers('round', 10); tickActiveModifiers('minute', 1); }}>-1 min</button>
                    {!micro && (
                        <button type="button" className="w-mod-tick-btn is-rest" title="Riposo lungo" onClick={() => { if (confirm('Rimuovere tutti i modificatori temporanei?')) clearTemporaryActiveModifiers(); }}>{'\u23fe'}</button>
                    )}
                </div>
            </header>

            <div className="w-mod-tabs">
                <button type="button" className={'w-mod-tab' + (tab === 'active' ? ' is-active' : '')} onClick={() => setTab('active')}>
                    {'Attivi' + (list.length > 0 ? ` (${list.length})` : '')}
                </button>
                <button type="button" className={'w-mod-tab' + (tab === 'history' ? ' is-active' : '')} onClick={() => setTab('history')}>
                    {'Storico' + (history.length > 0 ? ` (${history.length})` : '')}
                </button>
            </div>

            {tab === 'active' && (
                <>
                    <div className="w-mod-list w-scroll">
                        {sorted.length === 0 ? (
                            <div className="w-empty w-mod-empty">
                                <DndIcon category="util" name="star" size={22} />
                                <span>Nessun modificatore attivo</span>
                            </div>
                        ) : sorted.map(mod => (
                            <ModRow key={mod.id} mod={mod} micro={micro}
                                onPause={() => toggleActiveModifierPause(mod.id)}
                                onEdit={() => startEdit(mod)}
                                onArchive={() => archiveActiveModifier(mod.id)}
                            />
                        ))}
                    </div>
                    <button type="button" className="w-mod-add-btn" onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); setShowForm(true); }}>
                        <span>+</span><span>Aggiungi modificatore</span>
                    </button>
                </>
            )}

            {tab === 'history' && (
                <>
                    {history.length > 0 && (
                        <div className="w-mod-search">
                            <span className="w-mod-search-ico">⌕</span>
                            <input
                                type="text"
                                className="w-mod-search-input"
                                placeholder="Cerca nome, target, sorgente…"
                                value={historyQuery}
                                onChange={e => setHistoryQuery(e.target.value)}
                            />
                            {historyQuery && (
                                <button type="button" className="w-mod-search-clear" onClick={() => setHistoryQuery('')} title="Pulisci">×</button>
                            )}
                        </div>
                    )}
                    <div className="w-mod-list w-scroll">
                        {(() => {
                            if (history.length === 0) {
                                return (
                                    <div className="w-empty w-mod-empty">
                                        <DndIcon category="util" name="star" size={22} />
                                        <span>Nessun modificatore in archivio</span>
                                    </div>
                                );
                            }
                            const q = historyQuery.trim().toLowerCase();
                            const filtered = q
                                ? history.filter(m => {
                                    const t = TARGET_BY_ID[String(m.target)];
                                    const haystack = `${m.name} ${m.source ?? ''} ${t?.label ?? m.target} ${t?.short ?? ''}`.toLowerCase();
                                    return haystack.includes(q);
                                })
                                : history;
                            if (filtered.length === 0) {
                                return (
                                    <div className="w-empty w-mod-empty">
                                        <span>Nessun risultato per "{historyQuery}"</span>
                                    </div>
                                );
                            }
                            return filtered.map(mod => (
                                <HistRow key={mod.id} mod={mod} onReactivate={() => reactivateModifier(mod.id)} />
                            ));
                        })()}
                    </div>
                    {history.length > 0 && (
                        <button type="button" className="w-mod-clear-hist" onClick={() => { if (confirm('Cancellare tutto lo storico?')) clearModifiersHistory(); }}>
                            Cancella storico
                        </button>
                    )}
                </>
            )}

            {/* ── Modal / bottom-sheet form ── */}
            {showForm && createPortal(
                <div className="w-mod-modal-overlay" onClick={cancelEdit}>
                    <div className="w-mod-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="w-mod-modal-grip" aria-hidden="true" />
                        <div className="w-mod-modal-header">
                            <span className="w-mod-modal-title">
                                {editingId ? 'Modifica modificatore' : 'Nuovo modificatore'}
                            </span>
                            <button type="button" className="w-mod-modal-close" onClick={cancelEdit} aria-label="Chiudi">×</button>
                        </div>

                        <div className="w-mod-modal-body">
                            <label className="w-mod-form-cell">
                                <span className="w-mod-form-lbl">Nome</span>
                                <input
                                    className="input w-mod-input"
                                    placeholder="es. Forza del Toro"
                                    value={draft.name}
                                    autoFocus
                                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                                />
                            </label>

                            <div className="w-mod-form-grid">
                                <label className="w-mod-form-cell">
                                    <span className="w-mod-form-lbl">Target</span>
                                    <DndSelect
                                        ariaLabel="Target"
                                        value={String(draft.target)}
                                        onChange={v => setDraft(d => ({ ...d, target: v }))}
                                        options={[
                                            ...TARGETS.filter(t => t.group === 'stat').map(t => ({ value: t.id, label: t.label, group: 'Caratteristiche' })),
                                            ...TARGETS.filter(t => t.group === 'save').map(t => ({ value: t.id, label: t.label, group: 'Tiri Salvezza' })),
                                            ...TARGETS.filter(t => t.group === 'combat').map(t => ({ value: t.id, label: t.label, group: 'Combattimento' })),
                                        ]}
                                    />
                                </label>
                                <label className="w-mod-form-cell">
                                    <span className="w-mod-form-lbl">Valore</span>
                                    <div className="w-mod-value-row">
                                        <button type="button" className={'w-mod-sign-btn' + (draft.value < 0 ? ' is-active is-malus' : '')} onClick={() => setDraft(d => ({ ...d, value: -Math.abs(d.value || 1) }))}>−</button>
                                        <input type="number" className="input w-mod-input w-mod-value-input" value={Math.abs(draft.value)} onChange={e => setDraft(d => { const n = Math.max(0, parseInt(e.target.value || '0', 10)); return { ...d, value: d.value < 0 ? -n : n }; })} />
                                        <button type="button" className={'w-mod-sign-btn' + (draft.value > 0 ? ' is-active is-buff' : '')} onClick={() => setDraft(d => ({ ...d, value: Math.abs(d.value || 1) }))}>+</button>
                                    </div>
                                </label>
                                <label className="w-mod-form-cell">
                                    <span className="w-mod-form-lbl">Tipo</span>
                                    <DndSelect
                                        ariaLabel="Tipo"
                                        value={draft.type}
                                        onChange={v => setDraft(d => ({ ...d, type: v as ModifierType }))}
                                        options={MODIFIER_TYPES.map(t => ({ value: t.id, label: t.label }))}
                                    />
                                </label>
                                <label className="w-mod-form-cell">
                                    <span className="w-mod-form-lbl">Durata</span>
                                    <div className="w-mod-value-row">
                                        <input type="number" className="input w-mod-input w-mod-value-input" value={draft.duration} disabled={draft.unit === 'permanent'} onChange={e => setDraft(d => ({ ...d, duration: Math.max(1, parseInt(e.target.value || '1', 10)) }))} />
                                        <DndSelect
                                            ariaLabel="Unità"
                                            value={draft.unit}
                                            onChange={v => setDraft(d => ({ ...d, unit: v as DurationUnit }))}
                                            options={UNIT_OPTIONS.map(u => ({ value: u.id, label: u.label }))}
                                        />
                                    </div>
                                </label>
                                <label className="w-mod-form-cell" style={{ gridColumn: '1 / -1' }}>
                                    <span className="w-mod-form-lbl">Sorgente</span>
                                    <input className="input w-mod-input" placeholder="Incantesimo, oggetto, situazione…" value={draft.source} onChange={e => setDraft(d => ({ ...d, source: e.target.value }))} />
                                </label>
                            </div>
                        </div>

                        <div className="w-mod-modal-footer">
                            <button type="button" className="w-mod-form-btn" onClick={cancelEdit}>Annulla</button>
                            <button type="button" className={'w-mod-form-btn is-primary' + (draft.value >= 0 ? ' is-buff' : ' is-malus')} onClick={submit}>
                                {editingId ? 'Salva' : 'Applica'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
