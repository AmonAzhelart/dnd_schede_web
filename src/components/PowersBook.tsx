import React, { useState, useMemo } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import {
    FaPlus, FaTrash, FaEdit, FaCheck, FaTimes,
    FaChevronDown, FaChevronRight,
    FaInfinity, FaSyncAlt, FaClock, FaPlay, FaSearch,
} from 'react-icons/fa';
import { GiMagicGate, GiScrollUnfurled, GiSpellBook, GiBrain, GiMagicShield } from 'react-icons/gi';
import type { CharacterPower, PowerCategory, UsageType, StatType } from '../types/dnd';
import './PowersBook.css';

// ────────────────────────────────────────────────────────────── constants ──

type CatMeta = {
    label: string;
    shortLabel: string;
    Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    color: string;
    emptyTitle: string;
    emptyHint: string;
    defaultUsage: UsageType;
};

const CATEGORY_META: Record<PowerCategory, CatMeta> = {
    INVOCATION: {
        label: 'Invocazioni', shortLabel: 'Invoc.',
        Icon: GiMagicGate, color: '#a29bfe',
        emptyTitle: 'Nessuna invocazione',
        emptyHint: 'Le invocazioni del Warlock o del Dragonfire Adept si usano a volonta.\nEs: Occhio Siniestro, Forma Gassosa, Volo.',
        defaultUsage: 'AT_WILL',
    },
    MYSTERY: {
        label: 'Misteri', shortLabel: 'Misteri',
        Icon: GiScrollUnfurled, color: '#74b9ff',
        emptyTitle: 'Nessun mistero',
        emptyHint: 'I misteri del Shadowcaster si imparano e si usano come incantesimi preparati.\nEs: Ombre Vincolanti, Velo di Oscurita.',
        defaultUsage: 'PER_DAY',
    },
    UTTERANCE: {
        label: 'Detti', shortLabel: 'Detti',
        Icon: GiSpellBook, color: '#fdcb6e',
        emptyTitle: 'Nessun detto',
        emptyHint: 'I Detti del Truenamer alterano la realta pronunciando il nome vero delle cose.\nEs: Nota del Malessere, Linea di Resistenza.',
        defaultUsage: 'PER_DAY',
    },
    PSIONIC: {
        label: 'Poteri Psionici', shortLabel: 'Psionici',
        Icon: GiBrain, color: '#00cec9',
        emptyTitle: 'Nessun potere psionico',
        emptyHint: 'I poteri psionici funzionano tramite punti potere (PP).\nEs: Colpo Psionico, Telecinesi, Metamorfosi.',
        defaultUsage: 'PER_DAY',
    },
    SPELL: {
        label: 'Capacita Magiche', shortLabel: 'Cap.Mag.',
        Icon: GiMagicShield, color: '#c9a84c',
        emptyTitle: 'Nessuna capacita magica',
        emptyHint: 'Capacita innate, poteri razziali o spell-like abilities.\nEs: Luce delle Fate (Elfo), Forma Gassosa (Vampiro).',
        defaultUsage: 'PER_DAY',
    },
};

const USAGE_META: Record<UsageType, { label: string; color: string }> = {
    AT_WILL: { label: 'A volonta', color: 'var(--accent-success)' },
    PER_DAY: { label: '/giorno', color: 'var(--accent-warning)' },
    VANCIAN: { label: 'Preparata', color: 'var(--accent-ice)' },
    SPONTANEOUS: { label: 'Spontanea', color: 'var(--accent-arcane)' },
    COOLDOWN: { label: 'Ricarica', color: 'var(--accent-crimson)' },
};

const GRADES = ['least', 'lesser', 'greater', 'dark', 'apprentice', 'initiate', 'master'];
const STATS: StatType[] = ['int', 'wis', 'cha', 'str', 'dex', 'con'];
const ORDERED_CATEGORIES: PowerCategory[] = ['INVOCATION', 'MYSTERY', 'UTTERANCE', 'PSIONIC', 'SPELL'];

// ──────────────────────────────────────────────────── empty form factory ──

const emptyPower = (cat: PowerCategory): Omit<CharacterPower, 'id'> => ({
    name: '', description: '',
    category: cat,
    usageType: CATEGORY_META[cat].defaultUsage,
    grade: '', allowedClasses: [],
    levelEquivalent: undefined, components: '',
    castingTime: '', range: '', duration: '', savingThrow: '',
    attackMode: 'none', baseDice: '', damageType: '', saveStat: 'cha',
    usesMax: 1, usesUsed: 0, cooldownDice: '1d4', cooldownRemaining: 0,
});

// ──────────────────────────────────────────────────────── small helpers ──

function rollDice(expr: string): number {
    const m = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) return 1;
    let t = 0;
    for (let i = 0; i < Number(m[1]); i++) t += Math.floor(Math.random() * Number(m[2])) + 1;
    return Math.max(1, t + (m[3] ? Number(m[3]) : 0));
}

// ─────────────────────────────────────────────────── sub-components ──────

// ── Pip row ──────────────────────────────────────────────────────────────
const PipRow: React.FC<{
    max: number; used: number;
    onUse: () => void; onRecover: () => void;
    color: string;
}> = ({ max, used, onUse, onRecover, color }) => {
    const avail = max - used;
    return (
        <div className="pb-pips">
            {max <= 12 ? (
                Array.from({ length: max }, (_, i) => (
                    <div key={i} className="pb-pip" style={{
                        background: i < used ? 'rgba(255,255,255,0.12)' : color,
                        border: `1px solid ${color}`,
                    }} />
                ))
            ) : (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color }}>{avail}/{max}</span>
            )}
            <button className="pb-micro-btn" onClick={onUse} disabled={avail <= 0} title="Usa" style={{ marginLeft: 2 }}>
                <FaPlay size={7} />
            </button>
            <button className="pb-micro-btn" onClick={onRecover} disabled={used <= 0} title="Recupera">
                <FaSyncAlt size={7} />
            </button>
        </div>
    );
};

// ── Cooldown control ─────────────────────────────────────────────────────
const CooldownControl: React.FC<{
    remaining: number; onTick: () => void; onUse: () => void;
}> = ({ remaining, onTick, onUse }) => (
    <div className="pb-pips">
        {remaining > 0 ? (
            <>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-crimson)', minWidth: 22 }}>
                    {remaining}r
                </span>
                <button className="pb-micro-btn" onClick={onTick} title="-1 round"><FaClock size={7} /></button>
            </>
        ) : (
            <button className="pb-micro-btn" onClick={onUse} title="Usa (inizia ricarica)">
                <FaPlay size={7} />
            </button>
        )}
    </div>
);

// ── Edit / Add form ──────────────────────────────────────────────────────
interface EditFormProps {
    form: Omit<CharacterPower, 'id'>;
    setForm: React.Dispatch<React.SetStateAction<Omit<CharacterPower, 'id'>>>;
    save: () => void;
    cancel: () => void;
    isNew: boolean;
}

const EditForm: React.FC<EditFormProps> = ({ form, setForm, save, cancel, isNew }) => {
    const upd = <K extends keyof Omit<CharacterPower, 'id'>>(k: K, v: Omit<CharacterPower, 'id'>[K]) =>
        setForm(f => ({ ...f, [k]: v }));

    return (
        <div className="pb-form">
            <div className="pb-form-header">{isNew ? 'Nuovo potere' : 'Modifica potere'}</div>

            <div className="pb-form-row">
                <div className="pb-form-field" style={{ flex: '2 1 180px' }}>
                    <div className="pb-form-label">Nome</div>
                    <input className="pb-form-input" value={form.name} onChange={e => upd('name', e.target.value)}
                        placeholder="Es: Occhio Siniestro" autoFocus />
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 130px' }}>
                    <div className="pb-form-label">Categoria</div>
                    <select className="pb-form-select" value={form.category}
                        onChange={e => upd('category', e.target.value as PowerCategory)}>
                        {ORDERED_CATEGORIES.map(c => (
                            <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                        ))}
                    </select>
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 120px' }}>
                    <div className="pb-form-label">Tipo utilizzo</div>
                    <select className="pb-form-select" value={form.usageType}
                        onChange={e => upd('usageType', e.target.value as UsageType)}>
                        {(Object.keys(USAGE_META) as UsageType[]).map(u => (
                            <option key={u} value={u}>{USAGE_META[u].label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="pb-form-row">
                <div className="pb-form-field" style={{ flex: '1 1 100px' }}>
                    <div className="pb-form-label">Grado</div>
                    <input className="pb-form-input" value={form.grade ?? ''} onChange={e => upd('grade', e.target.value)}
                        placeholder="Es: least" list="pb-grade-dl" />
                    <datalist id="pb-grade-dl">{GRADES.map(g => <option key={g} value={g} />)}</datalist>
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 70px' }}>
                    <div className="pb-form-label">Liv. eq.</div>
                    <input className="pb-form-input" type="number" min={0} max={9}
                        value={form.levelEquivalent ?? ''}
                        onChange={e => upd('levelEquivalent', e.target.value === '' ? undefined : Number(e.target.value))}
                        placeholder="0-9" />
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 90px' }}>
                    <div className="pb-form-label">Componenti</div>
                    <input className="pb-form-input" value={form.components ?? ''} onChange={e => upd('components', e.target.value)} placeholder="V, S, M" />
                </div>
                <div className="pb-form-field" style={{ flex: '0 0 80px' }}>
                    <div className="pb-form-label">Stat TS</div>
                    <select className="pb-form-select" value={form.saveStat ?? 'cha'} onChange={e => upd('saveStat', e.target.value as StatType)}>
                        {STATS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                </div>
            </div>

            <div className="pb-form-row">
                <div className="pb-form-field" style={{ flex: '1 1 110px' }}>
                    <div className="pb-form-label">Tempo</div>
                    <input className="pb-form-input" value={form.castingTime ?? ''} onChange={e => upd('castingTime', e.target.value)} placeholder="1 az. standard" />
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 90px' }}>
                    <div className="pb-form-label">Gittata</div>
                    <input className="pb-form-input" value={form.range ?? ''} onChange={e => upd('range', e.target.value)} placeholder="9 m" />
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 100px' }}>
                    <div className="pb-form-label">Durata</div>
                    <input className="pb-form-input" value={form.duration ?? ''} onChange={e => upd('duration', e.target.value)} placeholder="Istantanea" />
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 100px' }}>
                    <div className="pb-form-label">Tiro salvezza</div>
                    <input className="pb-form-input" value={form.savingThrow ?? ''} onChange={e => upd('savingThrow', e.target.value)} placeholder="Tempra nega" />
                </div>
            </div>

            <div className="pb-form-row">
                <div className="pb-form-field" style={{ flex: '1 1 120px' }}>
                    <div className="pb-form-label">Modalita attacco</div>
                    <select className="pb-form-select" value={form.attackMode ?? 'none'}
                        onChange={e => upd('attackMode', e.target.value as CharacterPower['attackMode'])}>
                        <option value="none">Nessuno</option>
                        <option value="rangedTouch">Tocco a distanza</option>
                        <option value="meleeTouch">Tocco in mischia</option>
                        <option value="ray">Raggio</option>
                        <option value="normal">Normale</option>
                        <option value="save">Solo TS</option>
                    </select>
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 80px' }}>
                    <div className="pb-form-label">Dadi danno</div>
                    <input className="pb-form-input" value={form.baseDice ?? ''} onChange={e => upd('baseDice', e.target.value)} placeholder="2d6" />
                </div>
                <div className="pb-form-field" style={{ flex: '1 1 80px' }}>
                    <div className="pb-form-label">Tipo danno</div>
                    <input className="pb-form-input" value={form.damageType ?? ''} onChange={e => upd('damageType', e.target.value)} placeholder="Fuoco" />
                </div>
            </div>

            {form.usageType === 'PER_DAY' && (
                <div className="pb-form-row">
                    <div className="pb-form-field" style={{ flex: '0 0 100px' }}>
                        <div className="pb-form-label">Usi / giorno</div>
                        <input className="pb-form-input" type="number" min={1} max={20}
                            value={form.usesMax ?? 1} onChange={e => upd('usesMax', Number(e.target.value))} />
                    </div>
                </div>
            )}
            {form.usageType === 'COOLDOWN' && (
                <div className="pb-form-row">
                    <div className="pb-form-field" style={{ flex: '0 0 130px' }}>
                        <div className="pb-form-label">Dado ricarica (round)</div>
                        <input className="pb-form-input" value={form.cooldownDice ?? '1d4'} onChange={e => upd('cooldownDice', e.target.value)} placeholder="1d4" />
                    </div>
                </div>
            )}

            <div className="pb-form-field" style={{ flex: 1 }}>
                <div className="pb-form-label">Descrizione</div>
                <textarea className="pb-form-textarea" rows={3}
                    value={form.description ?? ''}
                    onChange={e => upd('description', e.target.value)}
                    placeholder="Effetto, meccanica, note..." />
            </div>

            <div className="pb-form-actions">
                <button className="pb-form-btn ghost" onClick={cancel}><FaTimes size={10} /> Annulla</button>
                <button className="pb-form-btn primary" onClick={save} disabled={!form.name.trim()}>
                    <FaCheck size={10} /> {isNew ? 'Aggiungi' : 'Salva'}
                </button>
            </div>
        </div>
    );
};

// ── Single power card ────────────────────────────────────────────────────
interface CardProps {
    power: CharacterPower;
    catColor: string;
    isEditing: boolean;
    editForm: Omit<CharacterPower, 'id'>;
    setEditForm: React.Dispatch<React.SetStateAction<Omit<CharacterPower, 'id'>>>;
    onEdit: () => void;
    onDelete: () => void;
    saveEdit: () => void;
    cancelEdit: () => void;
    onUse: (cd?: number) => void;
    onRecover: () => void;
    onTick: () => void;
}

const PowerCard: React.FC<CardProps> = ({
    power, catColor, isEditing, editForm, setEditForm,
    onEdit, onDelete, saveEdit, cancelEdit,
    onUse, onRecover, onTick,
}) => {
    const [expanded, setExpanded] = useState(false);
    const usage = USAGE_META[power.usageType];
    const hasDetail = !!(power.description || power.castingTime || power.range || power.duration || power.savingThrow || power.baseDice || power.components);

    return (
        <div className={'pb-card' + (isEditing ? ' editing' : '')}>
            <div className="pb-card-main">
                <div className="pb-card-stripe" style={{ background: usage.color }} />

                {hasDetail ? (
                    <button className="pb-card-toggle" onClick={() => setExpanded(e => !e)} title="Dettagli">
                        {expanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                    </button>
                ) : <div style={{ width: 18 }} />}

                <div className="pb-card-info">
                    <div className="pb-card-name">{power.name}</div>
                    <div className="pb-card-meta">
                        {power.grade && (
                            <span className="pb-card-grade" style={{ background: catColor + '18', color: catColor }}>
                                {power.grade}
                            </span>
                        )}
                        {power.levelEquivalent !== undefined && (
                            <span className="pb-card-lv">Lv {power.levelEquivalent}</span>
                        )}
                    </div>
                </div>

                <span className="pb-usage-badge" style={{ background: usage.color + '20', color: usage.color }}>
                    {power.usageType === 'AT_WILL' ? <FaInfinity size={9} /> : usage.label}
                </span>

                {power.usageType === 'PER_DAY' && (
                    <PipRow
                        max={power.usesMax ?? 1} used={power.usesUsed ?? 0}
                        onUse={() => onUse()} onRecover={onRecover}
                        color={usage.color}
                    />
                )}
                {power.usageType === 'COOLDOWN' && (
                    <CooldownControl
                        remaining={power.cooldownRemaining ?? 0}
                        onTick={onTick}
                        onUse={() => onUse(rollDice(power.cooldownDice ?? '1d4'))}
                    />
                )}

                <button className="pb-icon-btn" onClick={onEdit} title="Modifica"><FaEdit size={12} /></button>
                <button className="pb-icon-btn danger" onClick={onDelete} title="Elimina"><FaTrash size={11} /></button>
            </div>

            {expanded && !isEditing && hasDetail && (
                <div className="pb-detail">
                    <div className="pb-detail-chips">
                        {power.castingTime && <span className="pb-detail-chip"><span>Tempo</span>{power.castingTime}</span>}
                        {power.range && <span className="pb-detail-chip"><span>Gittata</span>{power.range}</span>}
                        {power.duration && <span className="pb-detail-chip"><span>Durata</span>{power.duration}</span>}
                        {power.savingThrow && <span className="pb-detail-chip"><span>TS</span>{power.savingThrow}</span>}
                        {power.components && <span className="pb-detail-chip"><span>Comp.</span>{power.components}</span>}
                        {power.baseDice && (
                            <span className="pb-detail-chip">
                                <span>Danno</span>{power.baseDice}{power.damageType ? ' ' + power.damageType : ''}
                            </span>
                        )}
                    </div>
                    {power.description && <p className="pb-detail-desc">{power.description}</p>}
                </div>
            )}

            {isEditing && (
                <EditForm form={editForm} setForm={setEditForm} save={saveEdit} cancel={cancelEdit} isNew={false} />
            )}
        </div>
    );
};

// ──────────────────────────────────────────────────── main component ──────

export const PowersBook: React.FC = () => {
    const { character, addPower, updatePower, deletePower, usePower, recoverPower, tickPowerCooldowns } = useCharacterStore();

    const [activeTab, setActiveTab] = useState<PowerCategory>('INVOCATION');
    const [search, setSearch] = useState('');
    const [gradeFilter, setGradeFilter] = useState<string | null>(null);
    const [addingForm, setAddingForm] = useState<Omit<CharacterPower, 'id'> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Omit<CharacterPower, 'id'>>(emptyPower('INVOCATION'));

    if (!character) return null;

    const allPowers = character.powers ?? [];
    const meta = CATEGORY_META[activeTab];

    const counts = useMemo(() =>
        Object.fromEntries(
            ORDERED_CATEGORIES.map(c => [c, allPowers.filter(p => p.category === c).length])
        ) as Record<PowerCategory, number>,
        [allPowers],
    );

    const grades = useMemo(() => {
        const set = new Set<string>();
        allPowers.filter(p => p.category === activeTab && p.grade).forEach(p => set.add(p.grade!));
        return Array.from(set).sort();
    }, [allPowers, activeTab]);

    const visible = useMemo(() => {
        const ql = search.trim().toLowerCase();
        return allPowers.filter(p => {
            if (p.category !== activeTab) return false;
            if (ql && !p.name.toLowerCase().includes(ql)) return false;
            if (gradeFilter && p.grade !== gradeFilter) return false;
            return true;
        });
    }, [allPowers, activeTab, search, gradeFilter]);

    const startAdd = () => {
        setAddingForm(emptyPower(activeTab));
        setEditingId(null);
    };

    const confirmAdd = () => {
        if (!addingForm || !addingForm.name.trim()) return;
        addPower({ ...addingForm, id: uuidv4() });
        setAddingForm(null);
    };

    const startEdit = (p: CharacterPower) => {
        setEditingId(p.id);
        setEditForm({ ...p });
        setAddingForm(null);
    };

    const confirmEdit = () => {
        if (!editingId || !editForm.name.trim()) return;
        updatePower({ ...editForm, id: editingId });
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (editingId === id) setEditingId(null);
        deletePower(id);
    };

    const handleTabChange = (cat: PowerCategory) => {
        setActiveTab(cat);
        setSearch('');
        setGradeFilter(null);
        setAddingForm(null);
        setEditingId(null);
    };

    return (
        <div className="pb-root">
            <div className="pb-cover">
                <div className="pb-cover-icon"><meta.Icon size={34} /></div>
                <div>
                    <div className="pb-cover-title">Libro dei Poteri</div>
                    <div className="pb-cover-subtitle">Invocazioni · Misteri · Detti · Psionici · Capacita Magiche</div>
                </div>
            </div>

            <div className="pb-tabs" role="tablist">
                {ORDERED_CATEGORIES.map(cat => {
                    const m = CATEGORY_META[cat];
                    const isActive = cat === activeTab;
                    return (
                        <button
                            key={cat}
                            role="tab"
                            aria-selected={isActive}
                            className={'pb-tab' + (isActive ? ' active' : '')}
                            style={isActive ? { color: m.color, borderBottomColor: m.color } : {}}
                            onClick={() => handleTabChange(cat)}
                        >
                            <m.Icon size={13} style={{ color: isActive ? m.color : undefined }} />
                            {m.shortLabel}
                            <span className="pb-tab-badge">{counts[cat]}</span>
                        </button>
                    );
                })}
            </div>

            <div className="pb-toolbar">
                <div className="pb-search-wrap">
                    <FaSearch size={10} className="pb-search-icon" />
                    <input
                        className="pb-search-input"
                        placeholder={'Cerca ' + meta.label.toLowerCase() + '...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="pb-add-btn" onClick={startAdd} style={{ borderColor: meta.color + '50', color: meta.color }}>
                    <FaPlus size={10} /> Aggiungi
                </button>
            </div>

            {grades.length > 0 && (
                <div className="pb-grade-bar">
                    <button
                        className={'pb-grade-pill' + (gradeFilter === null ? ' active' : '')}
                        onClick={() => setGradeFilter(null)}
                    >tutti</button>
                    {grades.map(g => (
                        <button
                            key={g}
                            className={'pb-grade-pill' + (gradeFilter === g ? ' active' : '')}
                            onClick={() => setGradeFilter(g === gradeFilter ? null : g)}
                        >{g}</button>
                    ))}
                </div>
            )}

            <div className="pb-body">
                {addingForm && (
                    <EditForm
                        form={addingForm}
                        setForm={setAddingForm as React.Dispatch<React.SetStateAction<Omit<CharacterPower, 'id'>>>}
                        save={confirmAdd}
                        cancel={() => setAddingForm(null)}
                        isNew
                    />
                )}

                {visible.map(p => (
                    <PowerCard
                        key={p.id}
                        power={p}
                        catColor={meta.color}
                        isEditing={editingId === p.id}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        onEdit={() => editingId === p.id ? setEditingId(null) : startEdit(p)}
                        onDelete={() => handleDelete(p.id)}
                        saveEdit={confirmEdit}
                        cancelEdit={() => setEditingId(null)}
                        onUse={cd => usePower(p.id, cd)}
                        onRecover={() => recoverPower(p.id)}
                        onTick={() => tickPowerCooldowns(1)}
                    />
                ))}

                {visible.length === 0 && !addingForm && (
                    <div className="pb-empty">
                        <div className="pb-empty-icon"><meta.Icon size={40} /></div>
                        <div className="pb-empty-title">{meta.emptyTitle}</div>
                        <div className="pb-empty-hint">{meta.emptyHint}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PowersBook;
