import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import { Virtuoso } from 'react-virtuoso';
import type { Feat } from '../types/dnd';

const MOD_TYPES = [
    { value: 'enhancement', label: 'Potenziamento' }, { value: 'armor', label: 'Armatura' },
    { value: 'deflection', label: 'Deviazione' }, { value: 'dodge', label: 'Schivata' },
    { value: 'naturalArmor', label: 'Arm. Naturale' }, { value: 'shield', label: 'Scudo' },
    { value: 'circumstance', label: 'Circostanza' }, { value: 'untyped', label: 'Senza tipo' },
    { value: 'resistance', label: 'Resistenza' }, { value: 'sacred', label: 'Sacro' },
    { value: 'profane', label: 'Profano' }, { value: 'insight', label: 'Intuizione' },
];

const EMPTY_FEAT = (): Omit<Feat, 'id'> => ({
    name: '', description: '', modifiers: [], active: true,
});

type FeatCategory = 'feat' | 'defect' | 'racial' | 'class';

// We store category in description prefix as a simple approach, or we extend Feat type.
// Instead: use a local map (sessionStorage-like in memory) OR just use a separate field.
// Since Feat type doesn't have category yet, we encode it as a tag in description.
// Better: we extend types â€” but to avoid that, show all feats and let user mark with a prefix badge.

// We'll use a separate subtype key stored in name prefix "[D]" for defects.
const isDefect = (f: Feat) => f.name.startsWith('[D] ');
const displayName = (f: Feat) => isDefect(f) ? f.name.slice(4) : f.name;

// â”€â”€ Sub-component prop interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface EditFormProps {
    form: Omit<Feat, 'id'>;
    setForm: React.Dispatch<React.SetStateAction<Omit<Feat, 'id'>>>;
    save: () => void;
    cancel: () => void;
    editingId: string | null;
    isDefectForm: boolean;
    setIsDefectForm: (v: boolean) => void;
    addMod: () => void;
    removeMod: (i: number) => void;
    updateMod: (i: number, field: string, val: unknown) => void;
    allTargetOptions: { value: string; label: string }[];
}
interface FeatRowProps {
    feat: Feat;
    editingId: string | null;
    toggleFeat: (id: string) => void;
    startEdit: (feat: Feat) => void;
    deleteFeat: (id: string) => void;
    editFormProps: EditFormProps;
}
interface SectionHeaderProps {
    label: string;
    color: string;
    count: number;
}

// â”€â”€ Sub-components at module level (prevents remount on parent re-render) â”€â”€â”€â”€â”€
const EditForm: React.FC<EditFormProps> = ({ form, setForm, save, cancel, editingId, isDefectForm, setIsDefectForm, addMod, removeMod, updateMod, allTargetOptions }) => (
    <div style={{ padding: '12px', background: isDefectForm ? 'rgba(192,57,43,0.07)' : 'rgba(155,89,182,0.07)', border: `1px solid ${isDefectForm ? 'rgba(192,57,43,0.25)' : 'rgba(155,89,182,0.25)'}`, borderRadius: 6, margin: '4px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" autoFocus placeholder={isDefectForm ? 'Nome difetto *' : 'Nome talento *'} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
                style={{ flex: '1 1 200px', fontSize: '0.85rem' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={isDefectForm} onChange={e => setIsDefectForm(e.target.checked)} />
                Ãˆ un Difetto
            </label>
            {!isDefectForm && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                    Attivo
                </label>
            )}
        </div>
        <textarea className="input" placeholder="Descrizione..." value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ width: '100%', minHeight: 52, fontSize: '0.82rem', resize: 'vertical', marginBottom: 8 }} />
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MODIFICATORI AL PERSONAGGIO</span>
                <button onClick={addMod} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-arcane)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <FaPlus size={8} /> Aggiungi
                </button>
            </div>
            {form.modifiers.map((mod, i) => (
                <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}>
                    <input className="input" list="mod-targets-datalist" value={mod.target}
                        onChange={e => updateMod(i, 'target', e.target.value)}
                        placeholder="Bersaglio (es. skill.ascoltare)"
                        style={{ flex: 1, fontSize: '0.78rem' }} />
                    <datalist id="mod-targets-datalist">
                        {allTargetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </datalist>
                    <input className="input" type="number" value={mod.value} onChange={e => updateMod(i, 'value', +e.target.value)}
                        style={{ width: 52, fontSize: '0.78rem', textAlign: 'center' }} />
                    <select className="input" value={mod.type} onChange={e => updateMod(i, 'type', e.target.value)}
                        style={{ flex: 1, fontSize: '0.78rem' }}>
                        {MOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button onClick={() => removeMod(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 3 }}>
                        <FaTimes size={10} />
                    </button>
                </div>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={cancel} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Annulla</button>
            <button onClick={save} className="btn-primary" style={{ fontSize: '0.8rem', opacity: form.name.trim() ? 1 : 0.5 }}>
                <FaCheck size={10} /> {editingId ? 'Aggiorna' : 'Salva'}
            </button>
        </div>
    </div>
);

const FeatRow: React.FC<FeatRowProps> = ({ feat, editingId, toggleFeat, startEdit, deleteFeat, editFormProps }) => {
    if (editingId === feat.id) return <EditForm {...editFormProps} />;
    const def = isDefect(feat);
    const accentColor = def ? 'var(--accent-crimson)' : 'var(--accent-arcane)';
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.035)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: feat.active || def ? accentColor : 'var(--text-muted)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: feat.active || def ? accentColor : 'var(--text-muted)' }}>
                    {displayName(feat)}
                </div>
                {feat.description && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 3, fontStyle: 'italic', lineHeight: 1.45 }}>
                        {feat.description}
                    </div>
                )}
                {feat.modifiers.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {feat.modifiers.map((m, i) => {
                            const targetLabel = m.target.toLowerCase().startsWith('skill.')
                                ? m.target.slice(6).replace(/^\w/, c => c.toUpperCase())
                                : m.target.toUpperCase();
                            return (
                                <span key={i} style={{
                                    fontSize: '0.68rem', padding: '1px 7px', borderRadius: 3,
                                    background: `${accentColor}18`, border: `1px solid ${accentColor}44`, color: accentColor
                                }}>
                                    {m.value >= 0 ? '+' : ''}{m.value} {targetLabel}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
            {!def && (
                <button onClick={() => toggleFeat(feat.id)}
                    style={{
                        padding: '3px 9px', borderRadius: 4, fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0,
                        background: feat.active ? 'rgba(192,57,43,0.1)' : 'rgba(155,89,182,0.1)',
                        border: `1px solid ${feat.active ? 'rgba(192,57,43,0.35)' : 'rgba(155,89,182,0.35)'}`,
                        color: feat.active ? 'var(--accent-crimson)' : 'var(--accent-arcane)'
                    }}>
                    {feat.active ? 'Disattiva' : 'Attiva'}
                </button>
            )}
            <button onClick={() => startEdit(feat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 5px', flexShrink: 0 }}>
                <FaEdit size={11} />
            </button>
            <button onClick={() => deleteFeat(feat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '4px 5px', opacity: 0.5, flexShrink: 0 }}>
                <FaTrash size={11} />
            </button>
        </div>
    );
};

const SectionHeader: React.FC<SectionHeaderProps> = ({ label, color, count }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.67rem', letterSpacing: '0.12em', color }}>{label}</span>
        <span style={{ fontSize: '0.6rem', background: `${color}22`, border: `1px solid ${color}44`, color, borderRadius: 8, padding: '0 6px' }}>{count}</span>
    </div>
);

export const Feats: React.FC = () => {
    const { character, toggleFeat, addFeat, updateFeat, deleteFeat } = useCharacterStore();

    // Build datalist options for modifier targets
    const skillTargetOptions = character
        ? Object.values(character.skills).map(s => ({ value: `skill.${s.name.toLowerCase()}`, label: `AbilitÃ : ${s.name}` }))
        : [];
    const statOptions = [
        { value: 'str', label: 'Forza (STR)' }, { value: 'dex', label: 'Destrezza (DEX)' },
        { value: 'con', label: 'Costituzione (CON)' }, { value: 'int', label: 'Intelligenza (INT)' },
        { value: 'wis', label: 'Saggezza (WIS)' }, { value: 'cha', label: 'Carisma (CHA)' },
        { value: 'ac', label: 'Classe Armatura (AC)' }, { value: 'hp', label: 'Punti Ferita (HP)' },
        { value: 'bab', label: 'Bonus Att. Base (BAB)' }, { value: 'initiative', label: 'Iniziativa' },
        { value: 'reflex', label: 'Tiro Salvezza: Riflessi' }, { value: 'fortitude', label: 'Tiro Salvezza: Tempra' },
        { value: 'will', label: 'Tiro Salvezza: VolontÃ ' },
    ];
    const allTargetOptions = [...statOptions, ...skillTargetOptions];
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [form, setForm] = useState<Omit<Feat, 'id'>>(EMPTY_FEAT());
    const [isDefectForm, setIsDefectForm] = useState(false);

    if (!character) return null;

    const feats = character.feats.filter(f => !isDefect(f));
    const defects = character.feats.filter(f => isDefect(f));

    const save = () => {
        if (!form.name.trim()) return;
        const finalName = isDefectForm ? `[D] ${form.name}` : form.name;
        if (editingId) {
            updateFeat({ ...form, name: finalName, id: editingId });
        } else {
            addFeat({ ...form, name: finalName, id: uuidv4() });
        }
        cancel();
    };

    const startEdit = (feat: Feat) => {
        const def = isDefect(feat);
        setIsDefectForm(def);
        setForm({ name: displayName(feat), description: feat.description, modifiers: [...feat.modifiers], active: feat.active });
        setEditingId(feat.id);
        setIsAdding(false);
    };

    const cancel = () => {
        setEditingId(null); setIsAdding(false); setIsDefectForm(false); setForm(EMPTY_FEAT());
    };

    const addMod = () => setForm(f => ({ ...f, modifiers: [...f.modifiers, { target: 'str', value: 1, type: 'enhancement' as any, source: '' }] }));
    const removeMod = (i: number) => setForm(f => ({ ...f, modifiers: f.modifiers.filter((_, idx) => idx !== i) }));
    const updateMod = (i: number, field: string, val: any) =>
        setForm(f => ({ ...f, modifiers: f.modifiers.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }));

    const editFormProps: EditFormProps = { form, setForm, save, cancel, editingId, isDefectForm, setIsDefectForm, addMod, removeMod, updateMod, allTargetOptions };
    const featRowProps = { editingId, toggleFeat, startEdit, deleteFeat, editFormProps };

    // Build flat rows for Virtuoso
    type FlatRow =
        | { kind: 'header'; label: string; color: string; count: number }
        | { kind: 'feat'; feat: Feat };
    const rows: FlatRow[] = [];
    if (feats.length > 0) {
        rows.push({ kind: 'header', label: 'TALENTI', color: 'var(--accent-arcane)', count: feats.length });
        feats.forEach(f => rows.push({ kind: 'feat', feat: f }));
    }
    if (defects.length > 0) {
        rows.push({ kind: 'header', label: 'DIFETTI', color: 'var(--accent-crimson)', count: defects.length });
        defects.forEach(f => rows.push({ kind: 'feat', feat: f }));
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
            {/* Header */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-arcane)' }}>
                        {feats.length} Talenti
                    </span>
                    {defects.length > 0 && (
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--accent-crimson)' }}>
                            · {defects.length} Difetti
                        </span>
                    )}
                </div>
                <button className="btn-primary" style={{ fontSize: '0.82rem' }}
                    onClick={() => { setIsAdding(true); setEditingId(null); setForm(EMPTY_FEAT()); setIsDefectForm(false); }}
                    disabled={isAdding}>
                    <FaPlus size={11} /> Nuovo
                </button>
            </div>

            {isAdding && <div style={{ flexShrink: 0 }}><EditForm {...editFormProps} /></div>}

            {/* Virtuoso list */}
            <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
                {rows.length === 0 && !isAdding ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Nessun talento o difetto. Clicca &quot;+ Nuovo&quot; per aggiungerne uno.
                    </div>
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={rows}
                        itemContent={(_index, row) => {
                            if (row.kind === 'header') {
                                return <SectionHeader label={row.label} color={row.color} count={row.count} />;
                            }
                            return <FeatRow feat={row.feat} {...featRowProps} />;
                        }}
                    />
                )}
            </div>
        </div>
    );
};
