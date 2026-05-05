/**
 * SkillEditModal — full edit popup for a skill.
 *
 * Sections:
 *  1. Basic fields (name, stat, classSkill, canUseUntrained, armorCheckPenalty)
 *  2. Synergies — unified editable list (SRD rules pre-loaded + user-defined).
 *     No distinction between "SRD" and "custom" — all rows are editable.
 */
import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaTimes, FaPlus, FaTrash, FaCheck, FaEdit } from 'react-icons/fa';
import { useCharacterStore } from '../store/characterStore';
import type { Skill, StatType, CustomSkillSynergy } from '../types/dnd';
import { getSrdSynergiesForCharacterSkill } from '../data/skillSynergies';

// ─── Stat options ─────────────────────────────────────────────────────────────

const STATS: { value: StatType; label: string }[] = [
    { value: 'str', label: 'Forza (FOR)' },
    { value: 'dex', label: 'Destrezza (DES)' },
    { value: 'con', label: 'Costituzione (COS)' },
    { value: 'int', label: 'Intelligenza (INT)' },
    { value: 'wis', label: 'Saggezza (SAG)' },
    { value: 'cha', label: 'Carisma (CAR)' },
];

// ─── Synergy form state ───────────────────────────────────────────────────────

interface SynFormState {
    sourceSkillId: string;
    targetSkillId: string;
    ranksRequired: number;
    bonus: number;
    note: string;
}

const emptyForm = (): SynFormState => ({ sourceSkillId: '', targetSkillId: '', ranksRequired: 5, bonus: 2, note: '' });

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
    skill: Skill;
    onClose: () => void;
}

export const SkillEditModal: React.FC<Props> = ({ skill, onClose }) => {
    const { character, updateSkill, replaceSkillSynergies } = useCharacterStore();

    // ── Skill draft ───────────────────────────────────────────────────────────
    const [draft, setDraft] = useState<Skill>({ ...skill });

    // ── Unified synergy draft (local — committed on save) ─────────────────────
    // Initialise once: existing stored synergies + any SRD synergies that aren't
    // yet overridden by a stored entry (identified by matching source+target IDs).
    const initialSynergies = useMemo((): CustomSkillSynergy[] => {
        if (!character) return [];
        // Only synergies where this skill is the SOURCE.
        const stored = (character.customSynergies ?? []).filter(
            s => s.sourceSkillId === skill.id,
        );
        const managed = character.managedSynergySkillIds ?? [];
        if (managed.includes(skill.id)) return stored;

        // Not yet managed → pre-load SRD entries where this skill is the source.
        const srdEntries = getSrdSynergiesForCharacterSkill(skill.id, skill.name, character.skills)
            .filter(srd => srd.sourceSkillId === skill.id);
        const toAdd = srdEntries.filter(srd => {
            return !stored.some(
                s => s.sourceSkillId === srd.sourceSkillId && s.targetSkillId === srd.targetSkillId,
            );
        });
        return [...stored, ...toAdd];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once on mount

    const [draftSynergies, setDraftSynergies] = useState<CustomSkillSynergy[]>(initialSynergies);

    // ── Add / edit form state ─────────────────────────────────────────────────
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState<SynFormState>(emptyForm());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<SynFormState | null>(null);

    if (!character) return null;

    const allSkillsList = Object.values(character.skills).sort((a, b) =>
        a.name.localeCompare(b.name),
    );

    // ── Save handler (commits draft to store) ─────────────────────────────────
    const handleSave = () => {
        if (!draft.name.trim()) return;
        updateSkill({ ...draft, id: skill.id });
        replaceSkillSynergies(skill.id, draftSynergies);
        onClose();
    };

    // ── Draft synergy CRUD ────────────────────────────────────────────────────
    const handleAddSynergy = () => {
        if (!addForm.targetSkillId || addForm.targetSkillId === skill.id) return;
        setDraftSynergies(prev => [...prev, {
            id: uuidv4(),
            sourceSkillId: skill.id,
            targetSkillId: addForm.targetSkillId,
            ranksRequired: addForm.ranksRequired,
            bonus: addForm.bonus,
            note: addForm.note.trim() || undefined,
        }]);
        setShowAddForm(false);
        setAddForm(emptyForm());
    };

    const startEditSyn = (syn: CustomSkillSynergy) => {
        setEditingId(syn.id);
        setEditForm({ sourceSkillId: syn.sourceSkillId, targetSkillId: syn.targetSkillId, ranksRequired: syn.ranksRequired, bonus: syn.bonus, note: syn.note ?? '' });
    };

    const handleSaveSynEdit = () => {
        if (!editingId || !editForm || !editForm.targetSkillId || editForm.targetSkillId === skill.id) return;
        setDraftSynergies(prev => prev.map(s => s.id === editingId ? { ...s, sourceSkillId: skill.id, targetSkillId: editForm.targetSkillId, ranksRequired: editForm.ranksRequired, bonus: editForm.bonus, note: editForm.note.trim() || undefined } : s));
        setEditingId(null);
        setEditForm(null);
    };

    // ── Skill select options ──────────────────────────────────────────────────
    const skillOptions = allSkillsList.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
    ));

    // ── Synergy row ───────────────────────────────────────────────────────────
    const renderSynRow = (syn: CustomSkillSynergy) => {
        const src = character.skills[syn.sourceSkillId];
        const tgt = character.skills[syn.targetSkillId];
        const isEditing = editingId === syn.id;

        if (isEditing && editForm) {
            return (
                <div key={syn.id} className="skill-edit-syn-row skill-edit-syn-row--editing">
                    <div className="skill-edit-syn-form-grid">
                        <div className="skill-edit-syn-form-field skill-edit-syn-form-field--wide">
                            <label className="skill-edit-syn-label">Destinatario (riceve il bonus)</label>
                            <select className="input input-sm" value={editForm.targetSkillId} onChange={e => setEditForm({ ...editForm, targetSkillId: e.target.value })}>
                                <option value="">— seleziona abilità —</option>
                                {skillOptions}
                            </select>
                        </div>
                        <div className="skill-edit-syn-form-field">
                            <label className="skill-edit-syn-label">Gradi richiesti</label>
                            <input type="number" className="input input-sm" min={1} max={20} value={editForm.ranksRequired} onChange={e => setEditForm({ ...editForm, ranksRequired: Math.max(1, +e.target.value) })} />
                        </div>
                        <div className="skill-edit-syn-form-field">
                            <label className="skill-edit-syn-label">Bonus</label>
                            <input type="number" className="input input-sm" min={1} max={10} value={editForm.bonus} onChange={e => setEditForm({ ...editForm, bonus: Math.max(1, +e.target.value) })} />
                        </div>
                        <div className="skill-edit-syn-form-field skill-edit-syn-form-field--wide">
                            <label className="skill-edit-syn-label">Nota (opzionale)</label>
                            <input type="text" className="input input-sm" placeholder="es. Solo in ambienti naturali" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} />
                        </div>
                    </div>
                    <div className="skill-edit-syn-actions">
                        <button className="btn-ghost btn-sm" onClick={handleSaveSynEdit} title="Salva"><FaCheck size={10} /></button>
                        <button className="btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditForm(null); }} title="Annulla"><FaTimes size={10} /></button>
                    </div>
                </div>
            );
        }

        return (
            <div key={syn.id} className="skill-edit-syn-row skill-edit-syn-row--custom">
                <span className="skill-edit-syn-arrow">→</span>
                <span className="skill-edit-syn-name">{tgt?.name ?? '?'}</span>
                <span className="skill-edit-syn-ranks">≥{syn.ranksRequired} gr.</span>
                <span className="skill-edit-syn-bonus">+{syn.bonus}</span>
                {syn.note && <span className="skill-edit-syn-note" title={syn.note}>ℹ</span>}
                <div className="skill-edit-syn-actions">
                    <button className="btn-ghost btn-sm" onClick={() => startEditSyn(syn)} title="Modifica"><FaEdit size={9} /></button>
                    <button className="btn-ghost btn-sm danger" onClick={() => setDraftSynergies(prev => prev.filter(s => s.id !== syn.id))} title="Elimina"><FaTrash size={9} /></button>
                </div>
            </div>
        );
    };

    // ── Add form ──────────────────────────────────────────────────────────────
    const renderAddForm = () => (
        <div className="skill-edit-syn-add-form">
            <div className="skill-edit-syn-form-grid">
                <div className="skill-edit-syn-form-field skill-edit-syn-form-field--wide">
                    <label className="skill-edit-syn-label">Destinatario (riceve il bonus)</label>
                    <select className="input input-sm" value={addForm.targetSkillId} onChange={e => setAddForm({ ...addForm, targetSkillId: e.target.value })}>
                        <option value="">— seleziona abilità —</option>
                        {skillOptions}
                    </select>
                </div>
                <div className="skill-edit-syn-form-field">
                    <label className="skill-edit-syn-label">Gradi richiesti</label>
                    <input type="number" className="input input-sm" min={1} max={20} value={addForm.ranksRequired} onChange={e => setAddForm({ ...addForm, ranksRequired: Math.max(1, +e.target.value) })} />
                </div>
                <div className="skill-edit-syn-form-field">
                    <label className="skill-edit-syn-label">Bonus</label>
                    <input type="number" className="input input-sm" min={1} max={10} value={addForm.bonus} onChange={e => setAddForm({ ...addForm, bonus: Math.max(1, +e.target.value) })} />
                </div>
                <div className="skill-edit-syn-form-field skill-edit-syn-form-field--wide">
                    <label className="skill-edit-syn-label">Nota (opzionale)</label>
                    <input type="text" className="input input-sm" placeholder="es. Solo con creature domestiche" value={addForm.note} onChange={e => setAddForm({ ...addForm, note: e.target.value })} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="btn-primary btn-sm" onClick={handleAddSynergy} disabled={!addForm.targetSkillId || addForm.targetSkillId === skill.id}>
                    <FaCheck size={9} /> Aggiungi
                </button>
                <button className="btn-ghost btn-sm" onClick={() => { setShowAddForm(false); setAddForm(emptyForm()); }}>
                    <FaTimes size={9} /> Annulla
                </button>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box skill-edit-modal flex-col gap-4">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex justify-between items-center">
                    <h3 className="font-heading" style={{ color: 'var(--accent-gold)' }}>
                        Modifica Abilità
                    </h3>
                    <button className="btn-ghost" onClick={onClose}><FaTimes /></button>
                </div>

                {/* ── Basic fields ───────────────────────────────────────── */}
                <section className="skill-edit-section">
                    <div className="skill-edit-field-row">
                        <label className="skill-edit-field-label">Nome</label>
                        <input
                            className="input"
                            value={draft.name}
                            autoFocus
                            onChange={e => setDraft({ ...draft, name: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                        />
                    </div>

                    <div className="skill-edit-field-row">
                        <label className="skill-edit-field-label">Caratteristica</label>
                        <select className="input" value={draft.stat} onChange={e => setDraft({ ...draft, stat: e.target.value as StatType })}>
                            {STATS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>

                    <div className="skill-edit-checks">
                        <label className="skill-edit-check">
                            <input type="checkbox" checked={draft.classSkill} onChange={e => setDraft({ ...draft, classSkill: e.target.checked })} />
                            Di classe
                        </label>
                        <label className="skill-edit-check">
                            <input type="checkbox" checked={draft.canUseUntrained} onChange={e => setDraft({ ...draft, canUseUntrained: e.target.checked })} />
                            Senza gradi
                        </label>
                        <label className="skill-edit-check">
                            <input type="checkbox" checked={draft.armorCheckPenalty} onChange={e => setDraft({ ...draft, armorCheckPenalty: e.target.checked })} />
                            Pen. armatura
                        </label>
                    </div>
                </section>

                {/* ── Synergies (unified list) ────────────────────────────── */}
                <section className="skill-edit-section">
                    <div className="skill-edit-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Sinergie</span>
                        {!showAddForm && (
                            <button className="btn-ghost btn-sm" onClick={() => { setShowAddForm(true); setAddForm(emptyForm()); }} title="Aggiungi sinergia">
                                <FaPlus size={9} /> Nuova
                            </button>
                        )}
                    </div>

                    {draftSynergies.length === 0 && !showAddForm && (
                        <p className="text-muted text-sm" style={{ fontStyle: 'italic', margin: '4px 0' }}>
                            Nessuna sinergia per questa abilità.
                        </p>
                    )}

                    {draftSynergies.map(renderSynRow)}

                    {showAddForm && renderAddForm()}
                </section>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-ghost" onClick={onClose}>Annulla</button>
                    <button className="btn-primary" onClick={handleSave} disabled={!draft.name.trim()}>
                        Salva Abilità
                    </button>
                </div>
            </div>
        </div>
    );
};
