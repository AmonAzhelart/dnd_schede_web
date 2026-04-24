import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import type { ClassFeature, ClassFeatureSubcategory } from '../types/dnd';

const MOD_TYPES = [
    { value: 'enhancement', label: 'Potenziamento' }, { value: 'armor', label: 'Armatura' },
    { value: 'deflection', label: 'Deviazione' }, { value: 'dodge', label: 'Schivata' },
    { value: 'naturalArmor', label: 'Arm. Naturale' }, { value: 'shield', label: 'Scudo' },
    { value: 'circumstance', label: 'Circostanza' }, { value: 'untyped', label: 'Senza tipo' },
    { value: 'resistance', label: 'Resistenza' }, { value: 'sacred', label: 'Sacro' },
    { value: 'profane', label: 'Profano' }, { value: 'insight', label: 'Intuizione' },
];

type SubcategoryMeta = {
    key: ClassFeatureSubcategory;
    label: string;
    headerLabel: string;
    color: string;
    emptyMsg: string;
};

const SUBCATEGORY_META: SubcategoryMeta[] = [
    {
        key: 'active',
        label: 'Capacità Attive',
        headerLabel: 'CAPACITÀ ATTIVE',
        color: 'var(--accent-warning)',
        emptyMsg: 'Nessuna capacità attiva. Es: Incanalare Divinità, Azione Impetuosa.',
    },
    {
        key: 'passive',
        label: 'Capacità Passive',
        headerLabel: 'CAPACITÀ PASSIVE',
        color: 'var(--accent-success)',
        emptyMsg: 'Nessuna capacità passiva. Es: Stile di Combattimento, Sensi Acuti.',
    },
    {
        key: 'option',
        label: 'Talenti & Opzioni',
        headerLabel: 'TALENTI & OPZIONI DI PERSONALIZZAZIONE',
        color: 'var(--accent-arcane)',
        emptyMsg: 'Nessuna opzione. Es: Invocazioni Occulte, Manovre del Guerriero, Metamorfosi.',
    },
];

type FormState = Omit<ClassFeature, 'id'>;

const emptyForm = (sub: ClassFeatureSubcategory): FormState => ({
    name: '',
    description: '',
    subcategory: sub,
    modifiers: [],
    active: true,
    resourceName: '',
    resourceMax: undefined,
    resourceUsed: 0,
});

// ── Edit Form ──────────────────────────────────────────────────────────────────
interface EditFormProps {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    save: () => void;
    cancel: () => void;
    editingId: string | null;
    addMod: () => void;
    removeMod: (i: number) => void;
    updateMod: (i: number, field: string, val: unknown) => void;
    allTargetOptions: { value: string; label: string }[];
    color: string;
}

const EditForm: React.FC<EditFormProps> = ({
    form, setForm, save, cancel, editingId, addMod, removeMod, updateMod, allTargetOptions, color
}) => (
    <div style={{
        padding: '12px',
        background: `${color}0d`,
        border: `1px solid ${color}33`,
        borderRadius: 6,
        margin: '4px 0',
    }}>
        {/* Name + active toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
                className="input"
                autoFocus
                placeholder="Nome capacità *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
                style={{ flex: '1 1 200px', fontSize: '0.85rem' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Attiva
            </label>
        </div>

        {/* Description */}
        <textarea
            className="input"
            placeholder="Descrizione..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ width: '100%', minHeight: 52, fontSize: '0.82rem', resize: 'vertical', marginBottom: 8 }}
        />

        {/* Resource fields — only for 'active' */}
        {form.subcategory === 'active' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="input"
                    placeholder="Nome risorsa (es. Incanalare Divinità)"
                    value={form.resourceName ?? ''}
                    onChange={e => setForm(f => ({ ...f, resourceName: e.target.value }))}
                    style={{ flex: '1 1 160px', fontSize: '0.82rem' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Usi max:</span>
                    <input
                        className="input"
                        type="number"
                        min={0}
                        value={form.resourceMax ?? ''}
                        onChange={e => setForm(f => ({ ...f, resourceMax: e.target.value === '' ? undefined : +e.target.value }))}
                        style={{ width: 56, fontSize: '0.82rem', textAlign: 'center' }}
                    />
                </div>
            </div>
        )}

        {/* Modifiers */}
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MODIFICATORI AL PERSONAGGIO</span>
                <button
                    onClick={addMod}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                    <FaPlus size={8} /> Aggiungi
                </button>
            </div>
            {form.modifiers.map((mod, i) => (
                <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}>
                    <input
                        className="input"
                        list="cf-mod-targets-datalist"
                        value={mod.target}
                        onChange={e => updateMod(i, 'target', e.target.value)}
                        placeholder="Bersaglio (es. skill.ascoltare)"
                        style={{ flex: 1, fontSize: '0.78rem' }}
                    />
                    <datalist id="cf-mod-targets-datalist">
                        {allTargetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </datalist>
                    <input
                        className="input"
                        type="number"
                        value={mod.value}
                        onChange={e => updateMod(i, 'value', +e.target.value)}
                        style={{ width: 52, fontSize: '0.78rem', textAlign: 'center' }}
                    />
                    <select
                        className="input"
                        value={mod.type}
                        onChange={e => updateMod(i, 'type', e.target.value)}
                        style={{ flex: 1, fontSize: '0.78rem' }}
                    >
                        {MOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button
                        onClick={() => removeMod(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 3 }}
                    >
                        <FaTimes size={10} />
                    </button>
                </div>
            ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={cancel} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Annulla</button>
            <button
                onClick={save}
                className="btn-primary"
                style={{ fontSize: '0.8rem', opacity: form.name.trim() ? 1 : 0.5 }}
            >
                <FaCheck size={10} /> {editingId ? 'Aggiorna' : 'Salva'}
            </button>
        </div>
    </div>
);

// ── Feature Row ────────────────────────────────────────────────────────────────
interface FeatureRowProps {
    feature: ClassFeature;
    editingId: string | null;
    onEdit: (f: ClassFeature) => void;
    onDelete: (id: string) => void;
    onSpend: (id: string) => void;
    onRecover: (id: string) => void;
    editFormElement: React.ReactNode;
    color: string;
}

const FeatureRow: React.FC<FeatureRowProps> = ({
    feature, editingId, onEdit, onDelete, onSpend, onRecover, editFormElement, color
}) => {
    if (editingId === feature.id) return <>{editFormElement}</>;

    const hasResource = feature.subcategory === 'active'
        && feature.resourceMax != null
        && feature.resourceMax > 0;
    const usedCount = feature.resourceUsed ?? 0;
    const maxCount = feature.resourceMax ?? 0;
    const exhausted = hasResource && usedCount >= maxCount;

    return (
        <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.035)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
            {/* Left accent bar */}
            <div style={{
                width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
                background: feature.active ? color : 'var(--text-muted)',
            }} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: 'var(--font-heading)', fontSize: '0.9rem',
                    color: feature.active ? color : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                }}>
                    {feature.name}
                    {exhausted && (
                        <span style={{
                            fontSize: '0.6rem', padding: '1px 6px', borderRadius: 3,
                            background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.35)',
                            color: 'var(--accent-crimson)',
                        }}>
                            ESAURITA
                        </span>
                    )}
                </div>

                {feature.description && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 3, fontStyle: 'italic', lineHeight: 1.45 }}>
                        {feature.description}
                    </div>
                )}

                {/* Resource pips */}
                {hasResource && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {feature.resourceName || 'Usi'}:
                        </span>
                        <div style={{ display: 'flex', gap: 3 }}>
                            {Array.from({ length: maxCount }).map((_, i) => (
                                <div key={i} style={{
                                    width: 11, height: 11, borderRadius: '50%',
                                    background: i < usedCount ? 'rgba(192,57,43,0.3)' : color,
                                    opacity: i < usedCount ? 0.4 : 0.85,
                                    border: `1px solid ${i < usedCount ? 'var(--accent-crimson)' : color}`,
                                    flexShrink: 0,
                                }} />
                            ))}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {maxCount - usedCount}/{maxCount}
                        </span>
                    </div>
                )}

                {/* Modifier badges */}
                {feature.modifiers.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                        {feature.modifiers.map((m, i) => {
                            const targetLabel = m.target.toLowerCase().startsWith('skill.')
                                ? m.target.slice(6).replace(/^\w/, c => c.toUpperCase())
                                : m.target.toUpperCase();
                            return (
                                <span key={i} style={{
                                    fontSize: '0.68rem', padding: '1px 7px', borderRadius: 3,
                                    background: `${color}18`, border: `1px solid ${color}44`, color,
                                }}>
                                    {m.value >= 0 ? '+' : ''}{m.value} {targetLabel}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Resource use / recover buttons */}
            {hasResource && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                    <button
                        onClick={() => onSpend(feature.id)}
                        disabled={exhausted}
                        style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem',
                            cursor: exhausted ? 'not-allowed' : 'pointer',
                            background: exhausted ? 'rgba(192,57,43,0.08)' : `${color}18`,
                            border: `1px solid ${exhausted ? 'rgba(192,57,43,0.25)' : `${color}44`}`,
                            color: exhausted ? 'var(--accent-crimson)' : color,
                            opacity: exhausted ? 0.5 : 1,
                        }}
                    >
                        Usa
                    </button>
                    <button
                        onClick={() => onRecover(feature.id)}
                        disabled={usedCount === 0}
                        style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem',
                            cursor: usedCount === 0 ? 'not-allowed' : 'pointer',
                            background: 'rgba(39,174,96,0.08)',
                            border: '1px solid rgba(39,174,96,0.25)',
                            color: 'var(--accent-success)',
                            opacity: usedCount === 0 ? 0.4 : 1,
                        }}
                    >
                        Rec.
                    </button>
                </div>
            )}

            <button
                onClick={() => onEdit(feature)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 5px', flexShrink: 0 }}
            >
                <FaEdit size={11} />
            </button>
            <button
                onClick={() => onDelete(feature.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '4px 5px', opacity: 0.5, flexShrink: 0 }}
            >
                <FaTrash size={11} />
            </button>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
interface ClassFeaturesProps {
    /** When set, render only that subcategory's section without the wrapping header/chevron. */
    restrictTo?: ClassFeatureSubcategory;
    /** Hide the outer toolbar (counts + Reset). Useful when embedding inside a tabbed page. */
    hideToolbar?: boolean;
}

export const ClassFeatures: React.FC<ClassFeaturesProps> = ({ restrictTo, hideToolbar }) => {
    const {
        character,
        addClassFeature, updateClassFeature, deleteClassFeature,
        spendClassFeatureResource, recoverClassFeatureResource, resetClassFeatureResources,
    } = useCharacterStore();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [addingTo, setAddingTo] = useState<ClassFeatureSubcategory | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm('active'));
    const [collapsed, setCollapsed] = useState<Set<ClassFeatureSubcategory>>(new Set());

    if (!character) return null;

    const features = character.classFeatures ?? [];

    // Build modifier target options (shared with Feats logic)
    const skillTargetOptions = Object.values(character.skills).map(s => ({
        value: `skill.${s.name.toLowerCase()}`,
        label: `Abilità: ${s.name}`,
    }));
    const statOptions = [
        { value: 'str', label: 'Forza (STR)' }, { value: 'dex', label: 'Destrezza (DEX)' },
        { value: 'con', label: 'Costituzione (CON)' }, { value: 'int', label: 'Intelligenza (INT)' },
        { value: 'wis', label: 'Saggezza (WIS)' }, { value: 'cha', label: 'Carisma (CHA)' },
        { value: 'ac', label: 'Classe Armatura (AC)' }, { value: 'hp', label: 'Punti Ferita (HP)' },
        { value: 'bab', label: 'Bonus Att. Base (BAB)' }, { value: 'initiative', label: 'Iniziativa' },
        { value: 'reflex', label: 'Tiro Salvezza: Riflessi' },
        { value: 'fortitude', label: 'Tiro Salvezza: Tempra' },
        { value: 'will', label: 'Tiro Salvezza: Volontà' },
    ];
    const allTargetOptions = [...statOptions, ...skillTargetOptions];

    const activeColor = SUBCATEGORY_META.find(m => m.key === (form.subcategory ?? 'active'))?.color ?? 'var(--accent-gold)';

    const save = () => {
        if (!form.name.trim()) return;
        if (editingId) {
            updateClassFeature({ ...form, id: editingId });
        } else {
            addClassFeature({ ...form, id: uuidv4(), resourceUsed: 0 });
        }
        cancel();
    };

    const cancel = () => {
        setEditingId(null);
        setAddingTo(null);
        setForm(emptyForm('active'));
    };

    const startEdit = (f: ClassFeature) => {
        setForm({ ...f });
        setEditingId(f.id);
        setAddingTo(null);
        // Auto-expand the section containing this feature
        setCollapsed(prev => {
            const next = new Set(prev);
            next.delete(f.subcategory);
            return next;
        });
    };

    const startAdd = (sub: ClassFeatureSubcategory) => {
        setForm(emptyForm(sub));
        setAddingTo(sub);
        setEditingId(null);
        // Auto-expand the target section
        setCollapsed(prev => {
            const next = new Set(prev);
            next.delete(sub);
            return next;
        });
    };

    const toggleCollapsed = (key: ClassFeatureSubcategory) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const addMod = () => setForm(f => ({
        ...f,
        modifiers: [...f.modifiers, { target: 'str', value: 1, type: 'enhancement' as const, source: '' }],
    }));
    const removeMod = (i: number) => setForm(f => ({
        ...f, modifiers: f.modifiers.filter((_, idx) => idx !== i),
    }));
    const updateMod = (i: number, field: string, val: unknown) =>
        setForm(f => ({ ...f, modifiers: f.modifiers.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }));

    const editFormProps: EditFormProps = {
        form, setForm, save, cancel, editingId, addMod, removeMod, updateMod, allTargetOptions, color: activeColor,
    };

    const hasSpentResources = features.some(
        f => f.subcategory === 'active' && (f.resourceUsed ?? 0) > 0
    );

    const totalCount = features.length;
    const visibleMeta = restrictTo
        ? SUBCATEGORY_META.filter(m => m.key === restrictTo)
        : SUBCATEGORY_META;
    const isRestricted = !!restrictTo;
    const restrictMeta = isRestricted ? SUBCATEGORY_META.find(m => m.key === restrictTo) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>

            {/* ── Header ─────────────────────────────── */}
            {!hideToolbar && <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {totalCount === 0 ? (
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            Privilegi di Classe
                        </span>
                    ) : (
                        SUBCATEGORY_META.map(meta => {
                            const count = features.filter(f => f.subcategory === meta.key).length;
                            if (count === 0) return null;
                            return (
                                <span key={meta.key} style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', color: meta.color }}>
                                    {count} {meta.label}
                                </span>
                            );
                        })
                    )}
                </div>
                {hasSpentResources && (
                    <button
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => resetClassFeatureResources()}
                    >
                        Reset Risorse
                    </button>
                )}
            </div>}

            {/* When restricted: show a clean inline action bar instead of section headers */}
            {isRestricted && restrictMeta && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: restrictMeta.color }}>
                        {features.filter(f => f.subcategory === restrictTo).length} {restrictMeta.label}
                    </span>
                    {restrictTo === 'active' && hasSpentResources && (
                        <button
                            className="btn-secondary"
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => resetClassFeatureResources()}
                        >
                            Reset Risorse
                        </button>
                    )}
                    <button
                        onClick={() => startAdd(restrictTo!)}
                        disabled={addingTo !== null || editingId !== null}
                        className="btn-primary"
                        style={{
                            marginLeft: 'auto', fontSize: '0.82rem',
                            opacity: (addingTo !== null || editingId !== null) ? 0.5 : 1,
                        }}
                    >
                        <FaPlus size={11} /> Nuovo
                    </button>
                </div>
            )}

            {/* ── Sections ───────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {visibleMeta.map(meta => {
                    const sectionFeatures = features.filter(f => f.subcategory === meta.key);
                    const isCollapsed = collapsed.has(meta.key);
                    const isAddingHere = addingTo === meta.key;
                    const bodyVisible = isRestricted ? true : (!isCollapsed || isAddingHere);

                    return (
                        <div key={meta.key} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>

                            {/* Section header (hidden when restricted) */}
                            {!isRestricted && <div
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 14px',
                                    background: 'rgba(255,255,255,0.025)',
                                    borderBottom: bodyVisible ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    cursor: 'pointer', userSelect: 'none',
                                }}
                                onClick={() => toggleCollapsed(meta.key)}
                            >
                                <span style={{ color: meta.color, fontSize: '0.7rem', lineHeight: 1 }}>
                                    {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                                </span>
                                <span style={{
                                    fontFamily: 'var(--font-heading)', fontSize: '0.67rem',
                                    letterSpacing: '0.12em', color: meta.color, flex: 1,
                                }}>
                                    {meta.headerLabel}
                                </span>
                                <span style={{
                                    fontSize: '0.6rem',
                                    background: `${meta.color}22`, border: `1px solid ${meta.color}44`,
                                    color: meta.color, borderRadius: 8, padding: '0 6px', marginRight: 8,
                                }}>
                                    {sectionFeatures.length}
                                </span>
                                <button
                                    onClick={e => { e.stopPropagation(); startAdd(meta.key); }}
                                    disabled={isAddingHere || editingId !== null}
                                    style={{
                                        background: `${meta.color}18`,
                                        border: `1px solid ${meta.color}44`,
                                        color: meta.color,
                                        borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem',
                                        display: 'flex', alignItems: 'center', gap: 3,
                                        opacity: (isAddingHere || editingId !== null) ? 0.4 : 1,
                                        cursor: (isAddingHere || editingId !== null) ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <FaPlus size={9} /> Aggiungi
                                </button>
                            </div>}

                            {/* Section body */}
                            {bodyVisible && (
                                <>
                                    {isAddingHere && (
                                        <div style={{ padding: '8px 12px' }}>
                                            <EditForm {...editFormProps} />
                                        </div>
                                    )}
                                    {sectionFeatures.map(feature => (
                                        <FeatureRow
                                            key={feature.id}
                                            feature={feature}
                                            editingId={editingId}
                                            onEdit={startEdit}
                                            onDelete={deleteClassFeature}
                                            onSpend={spendClassFeatureResource}
                                            onRecover={recoverClassFeatureResource}
                                            editFormElement={
                                                <div style={{ padding: '8px 12px' }}>
                                                    <EditForm {...editFormProps} />
                                                </div>
                                            }
                                            color={meta.color}
                                        />
                                    ))}
                                    {sectionFeatures.length === 0 && !isAddingHere && (
                                        <div style={{
                                            padding: '1.5rem', textAlign: 'center',
                                            color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic',
                                        }}>
                                            {meta.emptyMsg}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
