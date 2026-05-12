/**
 * TransformationsWidget — gestione delle Trasformazioni del personaggio.
 *
 * Funzionalità:
 * - Banner di trasformazione attiva con HP tracking e stats principali
 * - Lista delle trasformazioni salvate (legate al bestiario personale)
 * - Picker dal bestiario per aggiungere nuove forme
 * - Attivazione / disattivazione con un clic
 */
import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
    FaTimes, FaPlus, FaTrash, FaEdit, FaSave, FaSkull,
    FaCheck, FaBolt, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import { GiMagicSwirl } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import type { TransformationEntry, BestiaryEntry } from '../../../types/dnd';
import { CreaturePortrait, computeEffectiveCreatureStats } from '../../CreatureStatBlock';
import type { WidgetRenderProps } from '../widgetTypes';

/* ─── helpers ─────────────────────────────────────────────────── */
const sign = (n: number) => (n >= 0 ? '+' : '') + n;
const mod = (v: number) => Math.floor((v - 10) / 2);
const hpColor = (pct: number) =>
    pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f0c040' : pct > 0 ? '#e67e22' : '#636e72';

const STAT_LABELS: [keyof import('../../../types/dnd').Creature, string, boolean][] = [
    ['str', 'For', true],  // true = from creature
    ['dex', 'Des', true],
    ['con', 'Cos', true],
    ['int', 'Int', false], // false = from character
    ['wis', 'Sag', false],
    ['cha', 'Car', false],
];

/* ─── ActiveBanner ─────────────────────────────────────────────── */
interface ActiveBannerProps {
    activeName: string;
    creature: import('../../../types/dnd').Creature;
    currentHp: number;
    onHpDelta: (d: number) => void;
    onHpSet: (hp: number) => void;
    onDeactivate: () => void;
}
const ActiveBanner: React.FC<ActiveBannerProps> = ({
    activeName, creature, currentHp, onHpDelta, onHpSet, onDeactivate,
}) => {
    const { getEffectiveStat, getStatModifier, getSaveBreakdown, getTotalMaxHp, getTotalBab, getSizeAttackModifier } = useCharacterStore();
    const [expanded, setExpanded] = useState(false);
    const [hpInput, setHpInput] = useState('');
    const maxHp = getTotalMaxHp();
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const hc = hpColor(pct);
    const dead = currentHp <= 0;

    const fort = getSaveBreakdown('fortitude');
    const ref = getSaveBreakdown('reflex');
    const will = getSaveBreakdown('will');
    const bab = getTotalBab();
    const sizeMod = getSizeAttackModifier();

    const applyHpInput = () => {
        const n = parseInt(hpInput, 10);
        if (!isNaN(n)) onHpSet(n);
        setHpInput('');
    };

    // Per Metamorfosi: solo abilità EX speciali d'attacco vengono acquisite.
    // Le qualità speciali EX e tutte le SP/SU sono soppresse.
    const gainedAbilities = creature.specialAbilities.filter(a => a.abilityType === 'EX');
    const suppressedAbilities = creature.specialAbilities.filter(a => a.abilityType !== 'EX');

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(139,69,19,0.25) 0%, rgba(80,40,10,0.35) 100%)',
            border: '1px solid rgba(205,133,63,0.4)',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 8,
        }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreaturePortrait creature={creature} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <GiMagicSwirl style={{ color: '#cd853f', flexShrink: 0 }} />
                        <span style={{
                            fontFamily: 'var(--font-heading)', fontSize: '0.9rem',
                            color: dead ? 'var(--text-muted)' : 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{activeName}</span>
                        {dead && <FaSkull style={{ color: '#636e72', flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: pct * 100 + '%', background: hc, borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', color: hc, flexShrink: 0 }}>
                            {currentHp}/{maxHp}
                        </span>
                    </div>
                </div>
                {/* Quick HP buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button className="btn-ghost" style={{ fontSize: '0.65rem', color: 'var(--accent-success)', padding: '2px 6px', lineHeight: 1 }}
                        onClick={() => onHpDelta(1)} title="+1 PF">+1</button>
                    <button className="btn-ghost" style={{ fontSize: '0.65rem', color: 'var(--accent-crimson)', padding: '2px 6px', lineHeight: 1 }}
                        onClick={() => onHpDelta(-1)} title="-1 PF">-1</button>
                </div>
                <button className="btn-ghost" style={{ padding: '4px 6px', color: '#cd853f', fontSize: '0.72rem' }}
                    onClick={() => setExpanded(e => !e)} title="Dettagli">
                    {expanded ? <FaChevronUp /> : <FaChevronDown />}
                </button>
                <button className="btn-ghost" style={{ padding: '4px 6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}
                    onClick={onDeactivate} title="Termina Trasformazione"><FaTimes /></button>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div style={{ marginTop: 10, borderTop: '1px solid rgba(205,133,63,0.2)', paddingTop: 8 }}>
                    {/* Stats row — creature (FOR/DES/COS) vs character (INT/SAG/CAR) */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {STAT_LABELS.map(([k, label, fromCreature]) => {
                            const val = fromCreature
                                ? getEffectiveStat(k as import('../../../types/dnd').StatType)
                                : getStatModifier(k as import('../../../types/dnd').StatType) * 2 + 10; // reverse: mod → score
                            // For character stats show the raw score directly from getEffectiveStat
                            const score = fromCreature
                                ? getEffectiveStat(k as import('../../../types/dnd').StatType)
                                : getEffectiveStat(k as import('../../../types/dnd').StatType);
                            const m2 = mod(score);
                            return (
                                <div key={k} style={{
                                    flex: '1 1 40px',
                                    background: fromCreature ? 'rgba(139,69,19,0.25)' : 'rgba(0,0,0,0.2)',
                                    border: fromCreature ? '1px solid rgba(205,133,63,0.35)' : '1px solid transparent',
                                    borderRadius: 5, padding: '4px 5px', textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: '0.55rem', color: fromCreature ? '#cd853f' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {label}{fromCreature ? '▼' : ''}
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.1 }}>{score}</div>
                                    <div style={{ fontSize: '0.62rem', color: m2 >= 0 ? '#2ecc71' : '#e74c3c' }}>{sign(m2)}</div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Combat stats */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        {[
                            { label: 'CA', val: getEffectiveStat('ac') },
                            { label: 'BAB', val: sign(bab) },
                            { label: 'Vel.', val: getEffectiveStat('speed') + 'm' },
                        ].map(s => (
                            <div key={s.label} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.72rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                                <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>{s.val}</span>
                            </div>
                        ))}
                        {[
                            { label: 'Tmp', val: sign(fort.total), title: `Base ${sign(fort.base)} + COS ${sign(fort.ability)}` },
                            { label: 'Rif', val: sign(ref.total), title: `Base ${sign(ref.base)} + DES ${sign(ref.ability)}` },
                            { label: 'Vol', val: sign(will.total), title: `Base ${sign(will.base)} + SAG ${sign(will.ability)}` },
                        ].map(s => (
                            <div key={s.label} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.72rem' }} title={s.title}>
                                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                                <span style={{ fontFamily: 'var(--font-heading)', color: '#74b9ff' }}>{s.val}</span>
                            </div>
                        ))}
                    </div>
                    {/* Manual HP setter */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>Imposta PF:</span>
                        <input
                            type="number" min={0} max={maxHp}
                            value={hpInput}
                            onChange={e => setHpInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && applyHpInput()}
                            style={{ width: 55, fontSize: '0.75rem', padding: '2px 5px' }}
                            placeholder={String(currentHp)}
                        />
                        <button className="btn-ghost" style={{ padding: '2px 6px', color: 'var(--accent-success)', fontSize: '0.7rem' }}
                            onClick={applyHpInput}><FaCheck /></button>
                    </div>
                    {/* Actions */}
                    {creature.actions.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Azioni</div>
                            {creature.actions.map(a => {
                                const atkStat = a.attackStat ?? 'str';
                                const atkMod = atkStat === 'none' ? 0 : getStatModifier(atkStat as import('../../../types/dnd').StatType);
                                const total = bab + atkMod + sizeMod;
                                return (
                                    <div key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: '0.72rem', marginBottom: 2 }}>
                                        <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)', flexShrink: 0 }}>{a.name}</span>
                                        {a.attackBonus != null && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Att {sign(total)}</span>}
                                        {a.damage && <span style={{ color: 'var(--accent-gold)', flexShrink: 0 }}>Dg {a.damage}</span>}
                                        {a.notes && <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* Special abilities — per Metamorfosi: solo EX d'attacco acquisite */}
                    {gainedAbilities.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Abilità Speciali Acquisite (EX)</div>
                            {gainedAbilities.map(a => (
                                <div key={a.id} style={{ fontSize: '0.68rem', marginBottom: 3 }}>
                                    <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-arcane)' }}>{a.name}</span>
                                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>[{a.abilityType}]</span>
                                    {a.description && <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>{a.description}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    {suppressedAbilities.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Soppresse (SP/SU/qualità EX)</div>
                            {suppressedAbilities.map(a => (
                                <div key={a.id} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.5, textDecoration: 'line-through', marginBottom: 1 }}>
                                    {a.name} [{a.abilityType}]
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ─── TransformationCard ──────────────────────────────────────── */
interface TransformationCardProps {
    entry: TransformationEntry;
    isActive: boolean;
    onActivate: () => void;
    onEdit: () => void;
    onDelete: () => void;
}
const TransformationCard: React.FC<TransformationCardProps> = ({
    entry, isActive, onActivate, onEdit, onDelete,
}) => {
    const c = entry.creature;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: isActive ? 'rgba(139,69,19,0.2)' : 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid ' + (isActive ? 'rgba(205,133,63,0.45)' : 'rgba(255,255,255,0.06)'),
            padding: '6px 8px', marginBottom: 4,
        }}>
            <CreaturePortrait creature={c} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                    {c.size} {c.type} · PF {c.hp} · CA {c.ac}
                </div>
            </div>
            {isActive
                ? <span style={{ fontSize: '0.62rem', color: '#cd853f', fontFamily: 'var(--font-heading)', flexShrink: 0 }}>ATTIVA</span>
                : (
                    <button className="btn-ghost" style={{ padding: '3px 7px', color: '#cd853f', fontSize: '0.68rem', flexShrink: 0 }}
                        onClick={onActivate} title="Attiva trasformazione">
                        <FaBolt />
                    </button>
                )
            }
            <button className="btn-ghost" style={{ padding: '3px 6px', color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}
                onClick={onEdit} title="Modifica"><FaEdit /></button>
            <button className="btn-ghost" style={{ padding: '3px 6px', color: 'var(--accent-crimson)', fontSize: '0.65rem', flexShrink: 0 }}
                onClick={onDelete} title="Elimina"><FaTrash /></button>
        </div>
    );
};

/* ─── EditModal ────────────────────────────────────────────────── */
interface EditModalProps {
    initial: Partial<TransformationEntry>;
    bestiaryEntries: BestiaryEntry[];
    onSave: (entry: TransformationEntry) => void;
    onCancel: () => void;
}
const EditModal: React.FC<EditModalProps> = ({ initial, bestiaryEntries, onSave, onCancel }) => {
    const [name, setName] = useState(initial.name ?? '');
    const [selectedBestiaryId, setSelectedBestiaryId] = useState(initial.bestiaryEntryId ?? '');
    const [overrideStats, setOverrideStats] = useState(initial.overrideStats ?? true);
    const [overrideAttacks, setOverrideAttacks] = useState(initial.overrideAttacks ?? true);
    const [notes, setNotes] = useState(initial.notes ?? '');

    const selectedEntry = bestiaryEntries.find(e => e.id === selectedBestiaryId);

    const handleSave = () => {
        if (!selectedEntry) return;
        const entry: TransformationEntry = {
            id: initial.id ?? uuid(),
            name: name.trim() || selectedEntry.creature.name,
            bestiaryEntryId: selectedBestiaryId,
            creature: selectedEntry.creature,
            overrideStats,
            overrideAttacks,
            notes: notes.trim() || undefined,
            addedAt: initial.addedAt ?? new Date().toISOString(),
        };
        onSave(entry);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={onCancel}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 420,
                border: '1px solid rgba(205,133,63,0.3)', display: 'flex', flexDirection: 'column', gap: 12,
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#cd853f' }}>
                        {initial.id ? 'Modifica Trasformazione' : 'Nuova Trasformazione'}
                    </span>
                    <button className="btn-ghost" onClick={onCancel}><FaTimes /></button>
                </div>

                {/* Bestiary picker */}
                <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        Creatura dal Bestiario *
                    </label>
                    {bestiaryEntries.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-surface)', borderRadius: 6 }}>
                            Il bestiario personale è vuoto. Aggiungi prima una creatura dal Bestiario.
                        </div>
                    ) : (
                        <select
                            value={selectedBestiaryId}
                            onChange={e => {
                                setSelectedBestiaryId(e.target.value);
                                const found = bestiaryEntries.find(b => b.id === e.target.value);
                                if (found && !name) setName(found.creature.name);
                            }}
                            style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px' }}
                        >
                            <option value="">— Seleziona creatura —</option>
                            {bestiaryEntries.map(b => (
                                <option key={b.id} value={b.id}>{b.creature.name} ({b.creature.size} {b.creature.type})</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Name override */}
                <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        Nome forma (opzionale, es. "Orso Selvatico")
                    </label>
                    <input
                        type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder={selectedEntry?.creature.name ?? 'Nome trasformazione'}
                        style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', boxSizing: 'border-box' }}
                    />
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={overrideStats} onChange={e => setOverrideStats(e.target.checked)} />
                        <span>Sostituisce statistiche (FOR/DES/COS/etc, PF, CA, Velocità)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={overrideAttacks} onChange={e => setOverrideAttacks(e.target.checked)} />
                        <span>Sostituisce attacchi con le azioni della creatura</span>
                    </label>
                </div>

                {/* Notes */}
                <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Note</label>
                    <textarea
                        value={notes} onChange={e => setNotes(e.target.value)}
                        rows={2} placeholder="Note sulla trasformazione..."
                        style={{ width: '100%', fontSize: '0.78rem', padding: '5px 8px', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                </div>

                {/* Preview */}
                {selectedEntry && (
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Anteprima</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CreaturePortrait creature={selectedEntry.creature} size={30} />
                            <div>
                                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.82rem' }}>{selectedEntry.creature.name}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    PF {selectedEntry.creature.hp} · CA {computeEffectiveCreatureStats(selectedEntry.creature, [], []).ac} · BAB {sign(selectedEntry.creature.bab)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={onCancel}>Annulla</button>
                    <button className="btn-primary" onClick={handleSave} disabled={!selectedEntry}
                        style={{ background: '#8b4513', borderColor: '#cd853f' }}>
                        <FaSave /> Salva
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   TransformationsWidget
═══════════════════════════════════════════════════════════════════ */
export const TransformationsWidget: React.FC<WidgetRenderProps> = ({ goTo }) => {
    const {
        character,
        addTransformation, updateTransformation, removeTransformation,
        activateTransformation, deactivateTransformation,
        updateTransformationHp, setTransformationHp,
    } = useCharacterStore();

    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<Partial<TransformationEntry> | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const transformations = character?.transformations ?? [];
    const active = character?.activeTransformation;
    const bestiaryEntries = character?.bestiary ?? [];

    const openAdd = () => {
        setEditingEntry({});
        setShowModal(true);
    };
    const openEdit = (entry: TransformationEntry) => {
        setEditingEntry(entry);
        setShowModal(true);
    };
    const handleSave = (entry: TransformationEntry) => {
        if (transformations.find(t => t.id === entry.id)) {
            updateTransformation(entry);
        } else {
            addTransformation(entry);
        }
        setShowModal(false);
        setEditingEntry(null);
    };
    const handleDelete = (id: string) => {
        removeTransformation(id);
        setConfirmDeleteId(null);
    };

    const activeEntry = active ? transformations.find(t => t.id === active.transformationId) : null;
    const activeName = activeEntry?.name ?? active?.creature.name ?? '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6, overflowY: 'auto' }}>
            {/* Active transformation banner */}
            {active && (
                <ActiveBanner
                    activeName={activeName}
                    creature={active.creature}
                    currentHp={active.currentHp}
                    onHpDelta={updateTransformationHp}
                    onHpSet={setTransformationHp}
                    onDeactivate={deactivateTransformation}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {transformations.length === 0 ? 'Nessuna forma salvata' : `${transformations.length} form${transformations.length === 1 ? 'a' : 'e'} salват${transformations.length === 1 ? 'a' : 'e'}`}
                </span>
                <button className="btn-ghost" style={{ padding: '3px 7px', color: '#cd853f', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={openAdd} title="Aggiungi Trasformazione">
                    <FaPlus /> Aggiungi
                </button>
            </div>

            {/* Saved transformations list */}
            {transformations.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
                    <GiMagicSwirl style={{ fontSize: 28, opacity: 0.3 }} />
                    <span style={{ fontSize: '0.75rem' }}>
                        Aggiungi trasformazioni dal bestiario personale
                    </span>
                    {bestiaryEntries.length === 0 && (
                        <button className="btn-secondary text-xs" onClick={() => goTo?.('bestiary')}>
                            Apri Bestiario
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {transformations.map(entry => (
                        <React.Fragment key={entry.id}>
                            {confirmDeleteId === entry.id ? (
                                <div style={{
                                    background: 'rgba(231,76,60,0.12)', borderRadius: 8,
                                    border: '1px solid rgba(231,76,60,0.35)',
                                    padding: '8px 10px', marginBottom: 4,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                                        Eliminare "{entry.name}"?
                                    </span>
                                    <button className="btn-ghost" style={{ padding: '3px 7px', color: 'var(--accent-crimson)', fontSize: '0.7rem' }}
                                        onClick={() => handleDelete(entry.id)}>Sì</button>
                                    <button className="btn-ghost" style={{ padding: '3px 7px', color: 'var(--text-muted)', fontSize: '0.7rem' }}
                                        onClick={() => setConfirmDeleteId(null)}>No</button>
                                </div>
                            ) : (
                                <TransformationCard
                                    entry={entry}
                                    isActive={active?.transformationId === entry.id}
                                    onActivate={() => activateTransformation(entry.id)}
                                    onEdit={() => openEdit(entry)}
                                    onDelete={() => setConfirmDeleteId(entry.id)}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Quick nav to bestiary */}
            {goTo && bestiaryEntries.length > 0 && (
                <button className="btn-secondary text-xs" style={{ marginTop: 'auto', flexShrink: 0 }}
                    onClick={() => goTo('bestiary')}>
                    Apri Bestiario
                </button>
            )}

            {/* Edit/Add modal */}
            {showModal && editingEntry !== null && (
                <EditModal
                    initial={editingEntry}
                    bestiaryEntries={bestiaryEntries}
                    onSave={handleSave}
                    onCancel={() => { setShowModal(false); setEditingEntry(null); }}
                />
            )}
        </div>
    );
};
