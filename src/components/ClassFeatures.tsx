import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaChevronDown, FaChevronRight, FaBolt, FaStar } from 'react-icons/fa';
import type { ClassFeature, ClassFeatureSubcategory, Modifier, StatType } from '../types/dnd';
import { ModifierEditor } from './ModifierEditor';
import { CreatureModifierEditor } from './CreatureModifierEditor';
import { ROLL_CHANNEL_LABELS } from '../services/modifiers';

type SubcategoryMeta = {
    key: ClassFeatureSubcategory;
    label: string;
    headerLabel: string;
    color: string;
    Icon: React.ComponentType<{ size?: number }>;
    emptyMsg: string;
};

const SUBCATEGORY_META: SubcategoryMeta[] = [
    {
        key: 'active',
        label: 'Capacità Attive',
        headerLabel: 'CAPACITÀ ATTIVE',
        color: 'var(--accent-warning)',
        Icon: FaBolt,
        emptyMsg: 'Nessuna capacità attiva. Es: Incanalare Divinità, Azione Impetuosa.',
    },
    {
        key: 'passive',
        label: 'Capacità Passive',
        headerLabel: 'CAPACITÀ PASSIVE',
        color: 'var(--accent-success)',
        Icon: FaStar,
        emptyMsg: 'Nessuna capacità passiva. Es: Stile di Combattimento, Sensi Acuti.',
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
    creatureModifiers: [],
});

// ── Edit Form ──────────────────────────────────────────────────────────────────
interface EditFormProps {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    save: () => void;
    cancel: () => void;
    editingId: string | null;
    color: string;
}

const EditForm: React.FC<EditFormProps> = ({ form, setForm, save, cancel, editingId, color }) => (
    <div style={{
        borderRadius: 8,
        border: `1px solid ${color}30`,
        background: `${color}07`,
        overflow: 'hidden',
    }}>
        {/* Form header */}
        <div style={{
            padding: '8px 14px',
            background: `${color}12`,
            borderBottom: `1px solid ${color}22`,
            display: 'flex', alignItems: 'center', gap: 8,
        }}>
            <span style={{
                fontFamily: 'var(--font-heading)', fontSize: '0.66rem',
                letterSpacing: '0.1em', color,
            }}>
                {editingId ? 'MODIFICA CAPACITÀ' : 'NUOVA CAPACITÀ'}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button onClick={cancel} type="button" className="btn-secondary" style={{ fontSize: '0.76rem', padding: '3px 10px' }}>
                    <FaTimes size={9} /> Annulla
                </button>
                <button
                    onClick={save}
                    type="button"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '0.76rem',
                        background: form.name.trim() ? `${color}20` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${form.name.trim() ? color + '55' : 'rgba(255,255,255,0.1)'}`,
                        color: form.name.trim() ? color : 'var(--text-muted)',
                        opacity: form.name.trim() ? 1 : 0.6,
                        fontFamily: 'var(--font-heading)',
                    }}
                >
                    <FaCheck size={9} /> {editingId ? 'Aggiorna' : 'Salva'}
                </button>
            </div>
        </div>

        {/* Identity section */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${color}15`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={fsLabel}>Nome capacità *</label>
                    <input
                        className="input"
                        autoFocus
                        placeholder="es. Incanalare Divinità"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter') save(); }}
                        style={{ fontSize: '0.85rem' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '0 0 auto' }}>
                    <label style={fsLabel}>Stato iniziale</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingTop: 4 }}>
                        <input type="checkbox" checked={form.active}
                            onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                        Attiva
                    </label>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={fsLabel}>Descrizione</label>
                <textarea
                    className="input"
                    placeholder="Descrivi l'effetto della capacità..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ minHeight: 60, fontSize: '0.82rem', resize: 'vertical' }}
                />
            </div>
        </div>

        {/* Resource (active only) */}
        {form.subcategory === 'active' && (
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${color}15`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={fsLabel}>Nome risorsa</label>
                    <input
                        className="input"
                        placeholder="es. Incanalare Divinità"
                        value={form.resourceName ?? ''}
                        onChange={e => setForm(f => ({ ...f, resourceName: e.target.value }))}
                        style={{ fontSize: '0.82rem' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '0 0 80px' }}>
                    <label style={fsLabel}>Usi max</label>
                    <input
                        className="input"
                        type="number" min={0}
                        value={form.resourceMax ?? ''}
                        onChange={e => setForm(f => ({ ...f, resourceMax: e.target.value === '' ? undefined : +e.target.value }))}
                        style={{ fontSize: '0.82rem', textAlign: 'center' }}
                    />
                </div>
            </div>
        )}

        {/* Modifiers */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${color}15` }}>
            <ModifierEditor
                modifiers={form.modifiers}
                onChange={mods => setForm(f => ({ ...f, modifiers: mods }))}
                accentColor={color}
                title="MODIFICATORI AL PERSONAGGIO"
                compact
            />
        </div>

        {/* Creature modifiers */}
        <div style={{ padding: '10px 14px' }}>
            <CreatureModifierEditor
                modifiers={form.creatureModifiers ?? []}
                onChange={cms => setForm(f => ({ ...f, creatureModifiers: cms }))}
                accentColor="var(--accent-gold)"
            />
        </div>
    </div>
);

const fsLabel: React.CSSProperties = {
    fontSize: '0.6rem', color: 'var(--text-muted)',
    letterSpacing: '0.07em', textTransform: 'uppercase',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const STAT_SHORT: Record<StatType, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};

function channelLabel(ch: string): string {
    const found = ROLL_CHANNEL_LABELS.find(r => r.value === ch);
    if (found) return found.label;
    if (ch.startsWith('skill.')) return `Abilità: ${ch.slice(6)}`;
    if (ch.startsWith('check.')) return `Prova di ${STAT_SHORT[ch.slice(6) as StatType] ?? ch.slice(6).toUpperCase()}`;
    if (ch.startsWith('save.')) {
        const map: Record<string, string> = { fort: 'TS Tempra', ref: 'TS Riflessi', will: 'TS Volontà' };
        return map[ch.slice(5)] ?? ch;
    }
    return ch.toUpperCase();
}

function modifierSummary(m: Modifier) {
    const ch = m.appliesTo?.[0] ?? m.target;
    const typeLabels: Record<string, string> = {
        enhancement: 'Potenziamento', armor: 'Armatura', deflection: 'Deviazione',
        dodge: 'Schivata', naturalArmor: 'Arm. Naturale', shield: 'Scudo',
        circumstance: 'Circostanza', untyped: 'Senza tipo', resistance: 'Resistenza',
        sacred: 'Sacro', profane: 'Profano', insight: 'Intuizione',
        morale: 'Morale', luck: 'Fortuna', competence: 'Competenza',
        racial: 'Razziale', size: 'Taglia', synergy: 'Sinergia', alchemical: 'Alchemico',
    };
    const valueParts: string[] = [];
    if (m.value !== 0) valueParts.push(`${m.value >= 0 ? '+' : ''}${m.value}`);
    if (m.extraDice) valueParts.push(`+${m.extraDice.replace(/^\+\s*/, '')}`);
    const condParts: string[] = [];
    (m.conditions ?? []).forEach(c => {
        switch (c.kind) {
            case 'weaponType': condParts.push(c.value === 'melee' ? 'Mischia' : c.value === 'ranged' ? 'Distanza' : 'Lancio'); break;
            case 'weaponCategory': condParts.push(`Arma: ${c.value}`); break;
            case 'weaponName': condParts.push(`Con: ${c.value}`); break;
            case 'damageType': condParts.push(`Danno: ${c.value}`); break;
            case 'skillId': condParts.push(`Solo: ${c.value}`); break;
            case 'saveType': condParts.push({ fort: 'TS Tempra', ref: 'TS Riflessi', will: 'TS Volontà' }[c.value] ?? c.value); break;
            case 'abilityStat': condParts.push(`Prova ${STAT_SHORT[c.value] ?? c.value}`); break;
            case 'spellSchool': condParts.push(`Scuola: ${c.value}`); break;
            case 'spellName': condParts.push(`Magia: ${c.value}`); break;
            case 'spellDamageType': condParts.push(`Tipo: ${c.value}`); break;
            case 'spellMinLevel': condParts.push(`Lv ≥ ${c.value}`); break;
            case 'powerCategory': condParts.push(`Cat.: ${c.value}`); break;
            case 'powerName': condParts.push(`Potere: ${c.value}`); break;
        }
    });
    if (m.manualPrompt) condParts.push(m.manualPrompt);
    return {
        channel: channelLabel(ch),
        typeLabel: typeLabels[m.type] ?? m.type,
        valueStr: valueParts.join(' ') || '—',
        conditions: condParts.join(' · '),
        statOverride: m.statOverride ? STAT_SHORT[m.statOverride] : undefined,
    };
}

// ── Feature Card ───────────────────────────────────────────────────────────────
interface FeatureCardProps {
    feature: ClassFeature;
    editingId: string | null;
    onEdit: (f: ClassFeature) => void;
    onDelete: (id: string) => void;
    onSpend: (id: string) => void;
    onRecover: (id: string) => void;
    editFormElement: React.ReactNode;
    color: string;
    meta: SubcategoryMeta;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
    feature, editingId, onEdit, onDelete, onSpend, onRecover, editFormElement, color,
}) => {
    const [expanded, setExpanded] = useState(false);

    if (editingId === feature.id) return <div style={{ margin: '0 0 6px' }}>{editFormElement}</div>;

    const hasResource = feature.subcategory === 'active'
        && feature.resourceMax != null && feature.resourceMax > 0;
    const usedCount = feature.resourceUsed ?? 0;
    const maxCount = feature.resourceMax ?? 0;
    const exhausted = hasResource && usedCount >= maxCount;
    const remaining = maxCount - usedCount;

    const hasMods = feature.modifiers.length > 0;
    const hasDesc = !!feature.description?.trim();
    const isExpandable = hasDesc || hasMods;

    return (
        <div style={{
            borderRadius: 8,
            border: `1px solid ${color}25`,
            background: feature.active ? `${color}07` : 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
            opacity: feature.active ? 1 : 0.65,
            transition: 'opacity 0.15s',
        }}>
            {/* Colored top stripe */}
            <div style={{ height: 2, background: feature.active ? color : 'rgba(255,255,255,0.1)' }} />

            {/* Card header */}
            <div
                style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 12px 8px',
                    cursor: isExpandable ? 'pointer' : 'default',
                }}
                onClick={() => isExpandable && setExpanded(v => !v)}
            >
                {/* Expand chevron */}
                <div style={{ paddingTop: 2, color, opacity: 0.6, flexShrink: 0, width: 12 }}>
                    {isExpandable
                        ? (expanded ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />)
                        : null
                    }
                </div>

                {/* Name + badges */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: hasResource ? 6 : 0 }}>
                        <span style={{
                            fontFamily: 'var(--font-heading)', fontSize: '0.92rem',
                            color: feature.active ? color : 'var(--text-muted)',
                            letterSpacing: '0.02em',
                        }}>
                            {feature.name}
                        </span>
                        {!feature.active && (
                            <span style={inactiveBadge}>INATTIVA</span>
                        )}
                        {exhausted && (
                            <span style={exhaustedBadge}>ESAURITA</span>
                        )}
                        {/* Modifier badges (collapsed) */}
                        {!expanded && hasMods && feature.modifiers.map((m, i) => {
                            const s = modifierSummary(m);
                            return (
                                <span key={i} style={{
                                    fontSize: '0.62rem', padding: '1px 6px', borderRadius: 3,
                                    background: `${color}15`, border: `1px solid ${color}35`, color,
                                    fontFamily: 'var(--font-mono, monospace)',
                                }}>
                                    {s.valueStr} {s.channel}
                                </span>
                            );
                        })}
                    </div>

                    {/* Resource pips */}
                    {hasResource && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                {feature.resourceName || 'Usi'}:
                            </span>
                            <div style={{ display: 'flex', gap: 3 }}>
                                {Array.from({ length: maxCount }).map((_, i) => (
                                    <div key={i} style={{
                                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                        background: i < usedCount ? 'rgba(192,57,43,0.3)' : color,
                                        opacity: i < usedCount ? 0.3 : 0.85,
                                        border: `1px solid ${i < usedCount ? 'var(--accent-crimson)' : color}`,
                                    }} />
                                ))}
                            </div>
                            <span style={{ fontSize: '0.63rem', color: remaining === 0 ? 'var(--accent-crimson)' : 'var(--text-muted)' }}>
                                {remaining}/{maxCount}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, paddingTop: 1 }}>
                    {hasResource && (
                        <>
                            <button
                                onClick={e => { e.stopPropagation(); onSpend(feature.id); }}
                                disabled={exhausted}
                                style={{
                                    padding: '2px 7px', borderRadius: 4, fontSize: '0.66rem',
                                    cursor: exhausted ? 'not-allowed' : 'pointer',
                                    background: exhausted ? 'rgba(192,57,43,0.08)' : `${color}15`,
                                    border: `1px solid ${exhausted ? 'rgba(192,57,43,0.25)' : `${color}40`}`,
                                    color: exhausted ? 'var(--accent-crimson)' : color,
                                    opacity: exhausted ? 0.5 : 1,
                                }}
                            >Usa</button>
                            <button
                                onClick={e => { e.stopPropagation(); onRecover(feature.id); }}
                                disabled={usedCount === 0}
                                style={{
                                    padding: '2px 7px', borderRadius: 4, fontSize: '0.66rem',
                                    cursor: usedCount === 0 ? 'not-allowed' : 'pointer',
                                    background: 'rgba(39,174,96,0.07)',
                                    border: '1px solid rgba(39,174,96,0.22)',
                                    color: 'var(--accent-success)',
                                    opacity: usedCount === 0 ? 0.4 : 1,
                                }}
                            >Rec.</button>
                        </>
                    )}
                    <button
                        onClick={e => { e.stopPropagation(); onEdit(feature); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 5px' }}
                        title="Modifica"
                    ><FaEdit size={11} /></button>
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(feature.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '4px 5px', opacity: 0.5 }}
                        title="Elimina"
                    ><FaTrash size={11} /></button>
                </div>
            </div>

            {/* Expanded panel */}
            {expanded && (
                <div style={{
                    padding: '0 12px 12px 24px',
                    borderTop: `1px solid ${color}15`,
                    paddingTop: 10,
                    display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                    {hasDesc && (
                        <div style={{
                            fontSize: '0.81rem', color: 'var(--text-secondary)',
                            lineHeight: 1.6, fontStyle: 'italic',
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 5,
                            borderLeft: `2px solid ${color}55`,
                        }}>
                            {feature.description}
                        </div>
                    )}
                    {hasMods && (
                        <div>
                            <div style={{
                                fontSize: '0.6rem', letterSpacing: '0.1em',
                                color: 'var(--text-muted)', marginBottom: 6,
                            }}>
                                MODIFICATORI ({feature.modifiers.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {feature.modifiers.map((m, i) => {
                                    const s = modifierSummary(m);
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '5px 8px', borderRadius: 5,
                                            background: `${color}0c`,
                                            border: `1px solid ${color}22`,
                                            flexWrap: 'wrap',
                                        }}>
                                            <span style={{
                                                fontFamily: 'var(--font-mono, monospace)',
                                                fontSize: '0.9rem', fontWeight: 700,
                                                color, minWidth: 36,
                                            }}>{s.valueStr}</span>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', flex: 1 }}>{s.channel}</span>
                                            {s.statOverride && (
                                                <span style={{
                                                    fontSize: '0.62rem', padding: '1px 5px', borderRadius: 3,
                                                    background: 'rgba(155,89,182,0.14)',
                                                    border: '1px solid rgba(155,89,182,0.3)',
                                                    color: 'var(--accent-arcane)',
                                                }}>usa {s.statOverride}</span>
                                            )}
                                            <span style={{
                                                fontSize: '0.62rem', padding: '1px 5px', borderRadius: 3,
                                                background: `${color}12`, border: `1px solid ${color}2a`,
                                                color: 'var(--text-muted)',
                                            }}>{s.typeLabel}</span>
                                            {s.conditions && (
                                                <span style={{
                                                    fontSize: '0.62rem', padding: '1px 5px', borderRadius: 3,
                                                    background: 'rgba(241,196,15,0.1)',
                                                    border: '1px solid rgba(241,196,15,0.22)',
                                                    color: 'var(--accent-gold)',
                                                }}>{s.conditions}</span>
                                            )}
                                            {m.scope === 'conditional' && (
                                                <span style={{
                                                    fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3,
                                                    background: 'rgba(52,152,219,0.1)',
                                                    border: '1px solid rgba(52,152,219,0.25)',
                                                    color: 'var(--accent-ice)',
                                                }}>toggle</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {!hasDesc && !hasMods && (
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                            Nessuna descrizione o modificatore configurato.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

const inactiveBadge: React.CSSProperties = {
    fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3,
    background: 'rgba(100,100,100,0.12)', border: '1px solid rgba(100,100,100,0.25)',
    color: 'var(--text-muted)',
};
const exhaustedBadge: React.CSSProperties = {
    fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3,
    background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)',
    color: 'var(--accent-crimson)',
};

// ── Main Component ─────────────────────────────────────────────────────────────
interface ClassFeaturesProps {
    restrictTo?: ClassFeatureSubcategory;
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

    const features = (character.classFeatures ?? []).map(f =>
        f.subcategory === 'active' ? f : { ...f, subcategory: 'passive' as const }
    );

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
        setCollapsed(prev => { const n = new Set(prev); n.delete(f.subcategory); return n; });
    };

    const startAdd = (sub: ClassFeatureSubcategory) => {
        setForm(emptyForm(sub));
        setAddingTo(sub);
        setEditingId(null);
        setCollapsed(prev => { const n = new Set(prev); n.delete(sub); return n; });
    };

    const toggleCollapsed = (key: ClassFeatureSubcategory) => {
        setCollapsed(prev => {
            const n = new Set(prev);
            if (n.has(key)) n.delete(key); else n.add(key);
            return n;
        });
    };

    const editFormProps: EditFormProps = { form, setForm, save, cancel, editingId, color: activeColor };

    const hasSpentResources = features.some(f => f.subcategory === 'active' && (f.resourceUsed ?? 0) > 0);
    const visibleMeta = restrictTo
        ? SUBCATEGORY_META.filter(m => m.key === restrictTo)
        : SUBCATEGORY_META;
    const isRestricted = !!restrictTo;
    const restrictMeta = isRestricted ? SUBCATEGORY_META.find(m => m.key === restrictTo) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Toolbar ── */}
            {!hideToolbar && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        {features.length === 0 ? (
                            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Privilegi di Classe
                            </span>
                        ) : (
                            SUBCATEGORY_META.map(meta => {
                                const count = features.filter(f => f.subcategory === meta.key).length;
                                if (count === 0) return null;
                                return (
                                    <span key={meta.key} style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', color: meta.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <meta.Icon size={11} /> {count} {meta.label}
                                    </span>
                                );
                            })
                        )}
                    </div>
                    {hasSpentResources && (
                        <button className="btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => resetClassFeatureResources()}>
                            Reset Risorse
                        </button>
                    )}
                </div>
            )}

            {/* Restricted header */}
            {isRestricted && restrictMeta && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: restrictMeta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <restrictMeta.Icon size={13} /> {features.filter(f => f.subcategory === restrictTo).length} {restrictMeta.label}
                    </span>
                    {restrictTo === 'active' && hasSpentResources && (
                        <button className="btn-secondary" style={{ fontSize: '0.78rem' }} onClick={() => resetClassFeatureResources()}>
                            Reset Risorse
                        </button>
                    )}
                    <button
                        onClick={() => startAdd(restrictTo!)}
                        disabled={addingTo !== null || editingId !== null}
                        className="btn-primary"
                        style={{ marginLeft: 'auto', fontSize: '0.82rem', opacity: (addingTo !== null || editingId !== null) ? 0.5 : 1 }}
                    >
                        <FaPlus size={11} /> Nuovo
                    </button>
                </div>
            )}

            {/* ── Sections ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: '1rem' }}>
                {visibleMeta.map(meta => {
                    const sectionFeatures = features.filter(f => f.subcategory === meta.key);
                    const isCollapsed = collapsed.has(meta.key);
                    const isAddingHere = addingTo === meta.key;
                    const bodyVisible = isRestricted ? true : (!isCollapsed || isAddingHere);

                    return (
                        <div key={meta.key} className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>

                            {/* Section header */}
                            {!isRestricted && (
                                <div
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '9px 14px',
                                        background: `${meta.color}0c`,
                                        borderBottom: bodyVisible ? `1px solid ${meta.color}18` : 'none',
                                        cursor: 'pointer', userSelect: 'none',
                                    }}
                                    onClick={() => toggleCollapsed(meta.key)}
                                >
                                    <span style={{ color: meta.color, fontSize: '0.68rem', lineHeight: 1 }}>
                                        {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                                    </span>
                                    <meta.Icon size={11} style={{ color: meta.color, flexShrink: 0 }} />
                                    <span style={{
                                        fontFamily: 'var(--font-heading)', fontSize: '0.67rem',
                                        letterSpacing: '0.12em', color: meta.color, flex: 1,
                                    }}>
                                        {meta.headerLabel}
                                    </span>
                                    <span style={{
                                        fontSize: '0.6rem',
                                        background: `${meta.color}20`, border: `1px solid ${meta.color}40`,
                                        color: meta.color, borderRadius: 8, padding: '0 6px', marginRight: 8,
                                    }}>
                                        {sectionFeatures.length}
                                    </span>
                                    <button
                                        onClick={e => { e.stopPropagation(); startAdd(meta.key); }}
                                        disabled={isAddingHere || editingId !== null}
                                        style={{
                                            background: `${meta.color}15`,
                                            border: `1px solid ${meta.color}40`,
                                            color: meta.color,
                                            borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem',
                                            display: 'flex', alignItems: 'center', gap: 3,
                                            opacity: (isAddingHere || editingId !== null) ? 0.4 : 1,
                                            cursor: (isAddingHere || editingId !== null) ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <FaPlus size={9} /> Aggiungi
                                    </button>
                                </div>
                            )}

                            {/* Section body */}
                            {bodyVisible && (
                                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {isAddingHere && (
                                        <EditForm {...editFormProps} />
                                    )}
                                    {sectionFeatures.map(feature => (
                                        <FeatureCard
                                            key={feature.id}
                                            feature={feature}
                                            editingId={editingId}
                                            onEdit={startEdit}
                                            onDelete={deleteClassFeature}
                                            onSpend={spendClassFeatureResource}
                                            onRecover={recoverClassFeatureResource}
                                            editFormElement={<EditForm {...editFormProps} />}
                                            color={meta.color}
                                            meta={meta}
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
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
