import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaShieldAlt, FaRunning, FaBrain, FaInfoCircle, FaHeart, FaArrowUp, FaArrowDown, FaStar, FaExclamationTriangle, FaHistory, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { GiSwordsEmblem, GiUpgrade, GiDragonHead } from 'react-icons/gi';
import { useCharacterStore } from '../store/characterStore';
import type { BabProgression, SaveProgression, ClassLevel } from '../types/dnd';
import { CLASS_BAB_PRESETS, CLASS_SAVE_PRESETS, CLASS_HIT_DIE_PRESETS, computeClassBab, computeClassSaveBase, getHpForTotalLevel, DND35_XP_TABLE, getXpForLevel } from '../types/dnd';
import { classCatalog, type CatalogClass } from '../services/admin';
import { pickLocalized } from '../i18n';
import { ClassPickerModal } from './ClassPickerModal';
import './LevelsTab.css';

const BAB_OPTIONS: { value: BabProgression; label: string; hint: string }[] = [
    { value: 'high', label: 'Alta', hint: '×1' },
    { value: 'medium', label: 'Media', hint: '×¾' },
    { value: 'low', label: 'Bassa', hint: '×½' },
];

const HIT_DIE_OPTIONS: number[] = [4, 6, 8, 10, 12];

const SAVE_DEFS: {
    key: 'fortitude' | 'reflex' | 'will';
    field: 'fortSave' | 'refSave' | 'willSave';
    name: string;
    short: string;
    stat: string;
    Icon: React.ComponentType<{ size?: number }>;
}[] = [
        { key: 'fortitude', field: 'fortSave', name: 'Tempra', short: 'TEM', stat: 'COS', Icon: FaShieldAlt },
        { key: 'reflex', field: 'refSave', name: 'Riflessi', short: 'RIF', stat: 'DES', Icon: FaRunning },
        { key: 'will', field: 'willSave', name: 'Volontà', short: 'VOL', stat: 'SAG', Icon: FaBrain },
    ];

export const LevelsTab: React.FC = () => {
    const {
        character, addClassLevel, updateClassLevel, deleteClassLevel,
        getTotalBab, getSaveBreakdown, getTotalMaxHp, getStatModifier,
        addHpLevelEntry, removeLastHpLevelEntry, reorderHpLevelLog,
        setCurrentXp, setLevelAdjustment, setRaceHitDice, setXpConfig,
        getEcl, getXpForNextLevel, addXpLogEntry, removeXpLogEntry,
        setClassFeatures,
    } = useCharacterStore();

    if (!character) return null;
    const classLevels = character.classLevels ?? [];
    const hpLevelLog = character.hpLevelLog ?? [];
    const totalLevel = classLevels.reduce((s, cl) => s + cl.level, 0);
    const conMod = getStatModifier('con');
    const totalMaxHp = getTotalMaxHp();

    // XP & ECL state
    const currentXp = character.currentXp ?? 0;
    const la = character.levelAdjustment ?? 0;
    const raceHD = character.raceHitDice ?? 0;
    const ecl = getEcl();
    const xpNextLevel = getXpForNextLevel();
    const canLevelUp = currentXp >= xpNextLevel && totalLevel > 0;
    const xpThisLevel = getXpForLevel(ecl, character.useCustomXpTable ? character.customXpThresholds : undefined);
    const xpProgress = xpNextLevel > xpThisLevel ? Math.min(100, ((currentXp - xpThisLevel) / (xpNextLevel - xpThisLevel)) * 100) : 100;
    const xpLog = character.xpLog ?? [];

    // Custom XP table state
    const [editingCustomXp, setEditingCustomXp] = useState(false);
    const [customThresholdsDraft, setCustomThresholdsDraft] = useState<string[]>(() =>
        (character.customXpThresholds ?? DND35_XP_TABLE).map(String)
    );

    // Catalog classes (for auto-fill and features display)
    const [catalogClasses, setCatalogClasses] = useState<CatalogClass[]>([]);
    useEffect(() => { classCatalog.list().then(setCatalogClasses); }, []);

    // Expanded class features toggle per card
    const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
    const toggleFeatures = (id: string) =>
        setExpandedFeatures(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    // ── Auto-sync catalog class features into character.classFeatures ──
    const classLevelsKey = classLevels.map(cl => `${cl.id}:${cl.catalogClassId ?? ''}:${cl.level}`).join('|');
    useEffect(() => {
        if (!character || catalogClasses.length === 0) return;

        const existing = character.classFeatures ?? [];
        // Split: catalog-derived vs manually added
        const manual = existing.filter(f => !f.catalogFeatureId);
        const catalogDerived = existing.filter(f => !!f.catalogFeatureId);

        // Build desired set of catalog features
        const desired: (typeof existing[number])[] = [];
        for (const cl of classLevels) {
            if (!cl.catalogClassId) continue;
            const catalogCls = catalogClasses.find(c => c.id === cl.catalogClassId);
            if (!catalogCls) continue;
            for (const feat of catalogCls.featuresByLevel) {
                if (feat.level > cl.level) continue;
                // Check if already exists (match by catalogFeatureId + catalogClassLevelId)
                const already = catalogDerived.find(
                    f => f.catalogFeatureId === feat.id && f.catalogClassLevelId === cl.id
                );
                if (already) {
                    desired.push(already);
                } else {
                    desired.push({
                        id: uuidv4(),
                        name: pickLocalized(feat.name, 'it'),
                        description: feat.description
                            ? (typeof feat.description === 'string' ? feat.description : pickLocalized(feat.description, 'it'))
                            : '',
                        subcategory: feat.subcategory,
                        modifiers: feat.modifiers ?? [],
                        creatureModifiers: feat.creatureModifiers ?? [],
                        active: feat.subcategory === 'active',
                        resourceName: feat.resourceName,
                        resourceMax: feat.resourceMax,
                        resourceUsed: 0,
                        catalogFeatureId: feat.id,
                        catalogClassLevelId: cl.id,
                    });
                }
            }
        }

        const next = [...manual, ...desired];
        // Only update if something changed (compare by ids)
        const existingIds = existing.map(f => f.id).join(',');
        const nextIds = next.map(f => f.id).join(',');
        if (existingIds !== nextIds) {
            setClassFeatures(next);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classLevelsKey, catalogClasses]);

    // XP log form state
    const [xpLogForm, setXpLogForm] = useState({ amount: '', description: '' });

    // Class picker state
    const [isClassPickerOpen, setIsClassPickerOpen] = useState(false);
    const [classPickerForId, setClassPickerForId] = useState<string | null>(null);

    // Mobile tab navigation
    const [mobileTab, setMobileTab] = useState<'stats' | 'xp' | 'classi' | 'pf'>('stats');

    // For each log entry (position = total char level), compute HP per class
    const logEntriesByClass = new Map<string, { totalLevel: number; hp: number }[]>();
    hpLevelLog.forEach((entry, idx) => {
        const cl = classLevels.find(c => c.id === entry.classId);
        const die = cl?.hitDie ?? 0;
        const charLevel = idx + 1;
        const hp = die ? getHpForTotalLevel(die, charLevel) : 0;
        if (!logEntriesByClass.has(entry.classId)) logEntriesByClass.set(entry.classId, []);
        logEntriesByClass.get(entry.classId)!.push({ totalLevel: charLevel, hp });
    });

    const addNew = () => {
        const id = uuidv4();
        addClassLevel({
            id,
            className: '',
            level: 1,
            babProgression: 'high',
            fortSave: 'good',
            refSave: 'poor',
            willSave: 'poor',
        });
        addHpLevelEntry({ id: uuidv4(), classId: id, classLevelNumber: 1 });
    };

    const handleClassSelect = (cl: ClassLevel, name: string, catalogClass?: CatalogClass) => {
        if (catalogClass) {
            updateClassLevel({
                ...cl,
                className: name,
                catalogClassId: catalogClass.id,
                babProgression: catalogClass.babProgression,
                fortSave: catalogClass.fortitude,
                refSave: catalogClass.reflex,
                willSave: catalogClass.will,
                hitDie: catalogClass.hitDie,
            });
        } else {
            // Fallback: use static presets (for custom/legacy class names)
            const bab = CLASS_BAB_PRESETS[name];
            const sv = CLASS_SAVE_PRESETS[name];
            const hd = CLASS_HIT_DIE_PRESETS[name];
            updateClassLevel({
                ...cl,
                className: name,
                catalogClassId: undefined,
                babProgression: bab ?? cl.babProgression,
                fortSave: sv?.fort ?? cl.fortSave,
                refSave: sv?.ref ?? cl.refSave,
                willSave: sv?.will ?? cl.willSave,
                hitDie: hd ?? cl.hitDie,
            });
        }
    };

    // Level-up preview state
    const [levelUpPreview, setLevelUpPreview] = useState<ClassLevel | null>(null);

    const handleLevelUp = (cl: ClassLevel) => {
        const newLevel = Math.min(20, cl.level + 1);
        if (newLevel <= cl.level) return;
        updateClassLevel({ ...cl, level: newLevel });
        addHpLevelEntry({ id: uuidv4(), classId: cl.id, classLevelNumber: newLevel });
    };

    const requestLevelUp = (cl: ClassLevel) => {
        if (cl.level >= 20) return;
        setLevelUpPreview(cl);
    };

    const confirmLevelUp = () => {
        if (!levelUpPreview) return;
        handleLevelUp(levelUpPreview);
        setLevelUpPreview(null);
    };

    const handleLevelDown = (cl: ClassLevel) => {
        const newLevel = Math.max(1, cl.level - 1);
        if (newLevel >= cl.level) return;
        removeLastHpLevelEntry(cl.id);
        updateClassLevel({ ...cl, level: newLevel });
    };

    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

    return (
        <>
            <div className="levels-tab animate-fade-in" data-mobile-tab={mobileTab}>

                {/* ─── Mobile tab navigation ─────────────────────── */}
                <div className="lv-mob-tabs">
                    <button className={`lv-mob-tab${mobileTab === 'stats' ? ' active' : ''}`} onClick={() => setMobileTab('stats')}>
                        <GiUpgrade size={16} />
                        <span>Sommario</span>
                    </button>
                    <button className={`lv-mob-tab${mobileTab === 'xp' ? ' active' : ''}`} onClick={() => setMobileTab('xp')}>
                        <FaStar size={14} />
                        <span>PE</span>
                    </button>
                    <button className={`lv-mob-tab${mobileTab === 'classi' ? ' active' : ''}`} onClick={() => setMobileTab('classi')}>
                        <GiDragonHead size={16} />
                        <span>Classi</span>
                    </button>
                    <button className={`lv-mob-tab${mobileTab === 'pf' ? ' active' : ''}`} onClick={() => setMobileTab('pf')}>
                        <FaHeart size={14} />
                        <span>PF</span>
                    </button>
                </div>

                {/* ─── STATS SECTION ──────────────────────────────── */}
                <div className="lv-section lv-section-stats">

                {/* ─── Hero summary ─────────────────────────────── */}
                <div className="lv-hero">
                    <div className="lv-hero-cell gold">
                        <div className="lv-cap">Livello Totale</div>
                        <div className="lv-hero-row1">
                            <GiUpgrade className="lv-icon" />
                            <span className="lv-big">{totalLevel || 0}</span>
                        </div>
                        <div className="lv-sub">{classLevels.length} {classLevels.length === 1 ? 'classe' : 'classi'}</div>
                    </div>

                    <div className="lv-hero-cell crimson">
                        <div className="lv-cap">BAB Totale</div>
                        <div className="lv-hero-row1">
                            <GiSwordsEmblem className="lv-icon" />
                            <span className="lv-big">{fmt(getTotalBab())}</span>
                        </div>
                        <div className="lv-sub">
                            {classLevels.length === 0
                                ? <span>nessuna classe</span>
                                : classLevels.map(cl => (
                                    <span key={cl.id} className="chip">
                                        {cl.className || '?'} {cl.level} → +{computeClassBab(cl.level, cl.babProgression)}
                                    </span>
                                ))}
                        </div>
                    </div>

                    <div className="lv-hero-cell hp">
                        <div className="lv-cap">PF Max (classi)</div>
                        <div className="lv-hero-row1">
                            <FaHeart className="lv-icon" size={14} />
                            <span className="lv-big">{totalMaxHp}</span>
                        </div>
                        <div className="lv-sub">
                            {classLevels.length === 0
                                ? <span>nessuna classe</span>
                                : classLevels.map(cl => {
                                    const die = cl.hitDie;
                                    if (!die) return (
                                        <span key={cl.id} className="chip" style={{ color: 'var(--accent-gold)' }}>
                                            {cl.className || '?'}: dado ?
                                        </span>
                                    );
                                    const classHp = (logEntriesByClass.get(cl.id) ?? []).reduce((s, e) => s + e.hp, 0);
                                    return (
                                        <span key={cl.id} className="chip">
                                            {cl.className || '?'} d{die} → {classHp}
                                        </span>
                                    );
                                })}
                            {totalLevel > 0 && conMod !== 0 && (
                                <span className="chip" style={{ color: conMod > 0 ? 'var(--accent-gold)' : 'var(--accent-crimson)' }}>
                                    CON {fmt(conMod)} × {totalLevel} liv = {fmt(conMod * totalLevel)}
                                </span>
                            )}
                        </div>
                    </div>

                    {SAVE_DEFS.map(s => {
                        const b = getSaveBreakdown(s.key);
                        const cellClass = s.key === 'fortitude' ? 'fort' : s.key === 'reflex' ? 'ref' : 'will';
                        return (
                            <div key={s.key} className={`lv-hero-cell arcane ${cellClass}`}>
                                <div className="lv-cap">{s.name}</div>
                                <div className="lv-hero-row1">
                                    <s.Icon size={16} />
                                    <span className="lv-big">{fmt(b.total)}</span>
                                </div>
                                <div className="lv-sub">
                                    <span className="chip">{b.base} base</span>
                                    <span className="chip">{fmt(b.ability)} {s.stat}</span>
                                    {b.magic !== 0 && <span className="chip">{fmt(b.magic)} mag</span>}
                                    {b.misc !== 0 && <span className="chip">{fmt(b.misc)} alt</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ─── Level-up alert ────────────────────────────── */}
                {canLevelUp && (
                    <div className="lv-levelup-alert">
                        <FaExclamationTriangle size={16} className="lv-levelup-icon" />
                        <div>
                            <strong>Pronto per salire di livello!</strong>
                            <div className="lv-levelup-sub">
                                Hai raggiunto {currentXp.toLocaleString('it-IT')} PE · ECL attuale: {ecl} → prossimo ECL: {ecl + 1}
                            </div>
                        </div>
                    </div>
                )}

                </div>{/* /lv-section-stats */}

                {/* ─── XP SECTION ─────────────────────────────────── */}
                <div className="lv-section lv-section-xp">

                {/* ─── XP Panel ──────────────────────────────────── */}
                <div className="lv-xp-panel">
                    <div className="lv-xp-header">
                        <span className="lv-xp-title"><FaStar size={12} /> Punti Esperienza (PE)</span>
                        <div className="lv-xp-ecl-badge" title="Livello Effettivo del Personaggio (ECL)">
                            ECL {ecl}
                            {(la > 0 || raceHD > 0) && (
                                <span className="lv-xp-ecl-breakdown">
                                    ({totalLevel} classi{la > 0 ? ` + ${la} LA` : ''}{raceHD > 0 ? ` + ${raceHD} HD razza` : ''})
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="lv-xp-row">
                        <div className="lv-xp-field">
                            <label className="lv-xp-label">PE Attuali</label>
                            <input
                                type="number"
                                className="input lv-xp-input"
                                value={currentXp}
                                min={0}
                                step={100}
                                onChange={e => setCurrentXp(Number(e.target.value))}
                            />
                        </div>
                        <div className="lv-xp-field">
                            <label className="lv-xp-label">PE per prossimo livello</label>
                            <div className="lv-xp-next">{xpNextLevel.toLocaleString('it-IT')}</div>
                        </div>
                        <div className="lv-xp-field lv-xp-field--la">
                            <label className="lv-xp-label" title="Level Adjustment: penalità di livello per razze potenti (D&D 3.5)">
                                <GiDragonHead size={11} /> Mod. di Livello (LA)
                            </label>
                            <input
                                type="number"
                                className="input lv-xp-input"
                                value={la}
                                min={0}
                                max={10}
                                onChange={e => setLevelAdjustment(Number(e.target.value))}
                            />
                        </div>
                        <div className="lv-xp-field lv-xp-field--la">
                            <label className="lv-xp-label" title="Dadi Vita razziali (es. 6 per un Minotauro)">
                                DV Razziali (HD)
                            </label>
                            <input
                                type="number"
                                className="input lv-xp-input"
                                value={raceHD}
                                min={0}
                                max={30}
                                onChange={e => setRaceHitDice(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="lv-xp-bar-wrap" title={`${currentXp.toLocaleString('it-IT')} / ${xpNextLevel.toLocaleString('it-IT')} PE`}>
                        <div className="lv-xp-bar-track">
                            <div
                                className={`lv-xp-bar-fill${canLevelUp ? ' full' : ''}`}
                                style={{ width: `${xpProgress}%` }}
                            />
                        </div>
                        <span className="lv-xp-bar-label">
                            {currentXp.toLocaleString('it-IT')} / {xpNextLevel.toLocaleString('it-IT')} PE
                            {' '}({Math.floor(xpProgress)}%)
                        </span>
                    </div>

                    {/* Custom XP table toggle */}
                    <div className="lv-xp-custom-toggle">
                        <label className="lv-xp-toggle-label">
                            <input
                                type="checkbox"
                                checked={character.useCustomXpTable ?? false}
                                onChange={e => {
                                    setXpConfig(e.target.checked, character.customXpThresholds ?? [...DND35_XP_TABLE]);
                                    setCustomThresholdsDraft((character.customXpThresholds ?? DND35_XP_TABLE).map(String));
                                }}
                            />
                            Usa tabella PE personalizzata
                        </label>
                        {character.useCustomXpTable && (
                            <button
                                className="btn btn-ghost lv-xp-edit-btn"
                                onClick={() => {
                                    setCustomThresholdsDraft((character.customXpThresholds ?? DND35_XP_TABLE).map(String));
                                    setEditingCustomXp(v => !v);
                                }}
                            >
                                {editingCustomXp ? 'Chiudi' : 'Modifica tabella'}
                            </button>
                        )}
                    </div>

                    {/* Custom XP table editor */}
                    {character.useCustomXpTable && editingCustomXp && (
                        <div className="lv-xp-table-editor">
                            <div className="lv-xp-table-grid">
                                {customThresholdsDraft.map((val, idx) => (
                                    <div key={idx} className="lv-xp-table-cell">
                                        <label className="lv-xp-table-lbl">Lv.{idx + 1}</label>
                                        <input
                                            type="number"
                                            className="input lv-xp-table-input"
                                            value={val}
                                            min={0}
                                            step={100}
                                            onChange={e => {
                                                const next = [...customThresholdsDraft];
                                                next[idx] = e.target.value;
                                                setCustomThresholdsDraft(next);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="lv-xp-table-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        const parsed = customThresholdsDraft.map(v => Math.max(0, Number(v) || 0));
                                        setXpConfig(true, parsed);
                                        setEditingCustomXp(false);
                                    }}
                                >
                                    Salva tabella
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        const reset = [...DND35_XP_TABLE];
                                        setCustomThresholdsDraft(reset.map(String));
                                        setXpConfig(true, reset);
                                    }}
                                >
                                    Ripristina standard
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── XP Log ─────────────────────────────────────── */}
                <details className="lv-xp-log-details" open={xpLog.length > 0}>
                    <summary>
                        <FaHistory size={11} /> Storico PE ({xpLog.length})
                    </summary>
                    <div className="lv-xp-log-body">
                        <div className="lv-xp-log-form">
                            <input
                                type="number"
                                className="input lv-xp-log-input"
                                placeholder="PE ottenuti"
                                value={xpLogForm.amount}
                                min={0}
                                onChange={e => setXpLogForm({ ...xpLogForm, amount: e.target.value })}
                            />
                            <input
                                type="text"
                                className="input lv-xp-log-input lv-xp-log-desc"
                                placeholder="Descrizione (es. Sconfitta Goblin, Fine sessione...)"
                                value={xpLogForm.description}
                                onChange={e => setXpLogForm({ ...xpLogForm, description: e.target.value })}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    const amt = Number(xpLogForm.amount);
                                    if (amt > 0 && xpLogForm.description.trim()) {
                                        addXpLogEntry(amt, xpLogForm.description.trim());
                                        setXpLogForm({ amount: '', description: '' });
                                    }
                                }}
                            >
                                <FaPlus size={10} /> Aggiungi
                            </button>
                        </div>

                        {xpLog.length === 0 ? (
                            <div className="lv-xp-log-empty">Nessun PE guadagnato ancora</div>
                        ) : (
                            <div className="lv-xp-log-list">
                                {xpLog.map((entry) => {
                                    const date = new Date(entry.createdAt);
                                    const dateStr = date.toLocaleDateString('it-IT', {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    });
                                    return (
                                        <div key={entry.id} className="lv-xp-log-entry">
                                            <div className="lv-xp-log-header">
                                                <span className="lv-xp-log-amount">+{entry.amount}</span>
                                                <span className="lv-xp-log-desc">{entry.description}</span>
                                                <span className="lv-xp-log-date">{dateStr}</span>
                                                <button
                                                    className="lv-xp-log-del"
                                                    onClick={() => removeXpLogEntry(entry.id)}
                                                    title="Rimuovi entry"
                                                    aria-label="Rimuovi"
                                                >
                                                    <FaTrash size={10} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </details>

                </div>{/* /lv-section-xp */}

                {/* ─── CLASSI SECTION ─────────────────────────────── */}
                <div className="lv-section lv-section-classi">

                {/* ─── Section header ────────────────────────────── */}
                <div className="lv-section-head">
                    <h3>Classi del Personaggio</h3>
                    <button className="btn btn-primary" onClick={addNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FaPlus size={11} /> Aggiungi Classe
                    </button>
                </div>

                {/* ─── Empty state ───────────────────────────────── */}
                {classLevels.length === 0 && (
                    <div className="lv-empty">
                        <div className="em-title">Nessuna classe configurata</div>
                        <div style={{ marginBottom: '0.8rem' }}>
                            Aggiungi una classe per calcolare automaticamente <strong>BAB</strong> e <strong>Tiri Salvezza</strong>.
                        </div>
                        <button className="btn btn-primary" onClick={addNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <FaPlus size={11} /> Aggiungi la tua prima classe
                        </button>
                    </div>
                )}

                {/* ─── Class cards ──────────────────────────────── */}
                {classLevels.map(cl => {
                    const babVal = computeClassBab(cl.level, cl.babProgression);
                    void CLASS_BAB_PRESETS; // preset lookup now in handleClassSelect
                    const die = cl.hitDie;
                    const catalogCls = cl.catalogClassId
                        ? catalogClasses.find(c => c.id === cl.catalogClassId)
                        : undefined;
                    const featuresAtLevel = (catalogCls?.featuresByLevel ?? [])
                        .filter(f => f.level <= cl.level)
                        .sort((a, b) => a.level - b.level);
                    const isFeaturesExpanded = expandedFeatures.has(cl.id);

                    return (
                        <div key={cl.id} className="lv-card">
                            {/* Head */}
                            <div className="lv-card-head">
                                <div className="lv-class-picker">
                                    <button
                                        className="lv-class-picker-btn"
                                        onClick={() => {
                                            setClassPickerForId(cl.id);
                                            setIsClassPickerOpen(true);
                                        }}
                                    >
                                        {cl.className || 'Seleziona classe...'}
                                    </button>
                                </div>

                                <div className="lv-stepper" title="Livello in questa classe">
                                    <button
                                        className="minus"
                                        onClick={() => handleLevelDown(cl)}
                                        disabled={cl.level <= 1}
                                        aria-label="Diminuisci livello"
                                    >−</button>
                                    <div className="lv-num">{cl.level}</div>
                                    <button
                                        className="plus"
                                        onClick={() => requestLevelUp(cl)}
                                        disabled={cl.level >= 20}
                                        aria-label="Aumenta livello"
                                    >+</button>
                                </div>

                                <div className="lv-bab-wrap" title="Progressione del Bonus di Attacco Base">
                                    <div style={{ fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3, textAlign: 'center' }}>
                                        BAB
                                    </div>
                                    <div className="lv-seg crimson">
                                        {BAB_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                className={cl.babProgression === opt.value ? 'active' : ''}
                                                onClick={() => updateClassLevel({ ...cl, babProgression: opt.value })}
                                                title={`Progressione ${opt.label} (${opt.hint})`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="lv-hd-wrap" title="Dado Vita (Hit Die)">
                                    <div style={{ fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3, textAlign: 'center' }}>
                                        Dado Vita
                                    </div>
                                    <div className="lv-seg hp-seg">
                                        {HIT_DIE_OPTIONS.map(d => (
                                            <button
                                                key={d}
                                                className={cl.hitDie === d ? 'active' : ''}
                                                onClick={() => updateClassLevel({ ...cl, hitDie: d })}
                                                title={`d${d}`}
                                            >
                                                d{d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    className="lv-del-btn"
                                    title="Rimuovi questa classe"
                                    onClick={() => deleteClassLevel(cl.id)}
                                    aria-label="Rimuovi classe"
                                >
                                    <FaTrash size={13} />
                                </button>
                            </div>

                            {/* Saves grid */}
                            <div className="lv-saves-grid">
                                {SAVE_DEFS.map(s => {
                                    const prog = (cl[s.field] ?? 'poor') as SaveProgression;
                                    const base = computeClassSaveBase(cl.level, prog);
                                    const cellCls = s.key === 'fortitude' ? 'fort' : s.key === 'reflex' ? 'ref' : 'will';
                                    return (
                                        <div key={s.key} className={`lv-save-cell ${cellCls}`}>
                                            <div className="lv-save-head">
                                                <span className="lv-save-name">
                                                    <s.Icon size={11} /> {s.name}
                                                </span>
                                                <span className="lv-save-val">+{base}</span>
                                            </div>
                                            <div className="lv-seg" style={{ width: '100%' }}>
                                                <button
                                                    className={prog === 'good' ? 'active' : ''}
                                                    onClick={() => updateClassLevel({ ...cl, [s.field]: 'good' })}
                                                    style={{ flex: 1 }}
                                                    title="2 + (Livello / 2)"
                                                >
                                                    Buono
                                                </button>
                                                <button
                                                    className={prog === 'poor' ? 'active' : ''}
                                                    onClick={() => updateClassLevel({ ...cl, [s.field]: 'poor' })}
                                                    style={{ flex: 1 }}
                                                    title="Livello / 3"
                                                >
                                                    Scarso
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Catalog class info bar */}
                            {catalogCls && (
                                <div className="lv-catalog-bar">
                                    {catalogCls.skillPointsPerLevel > 0 && (
                                        <span className="lv-catalog-chip">{catalogCls.skillPointsPerLevel} pt abilità/lv</span>
                                    )}
                                    {catalogCls.spellcasting?.type !== 'none' && catalogCls.spellcasting?.type && (
                                        <span className="lv-catalog-chip spell">
                                            {catalogCls.spellcasting.type === 'arcane' ? '✦ Arcano' : '✦ Divino'}
                                            {catalogCls.spellcasting.stat ? ` (${catalogCls.spellcasting.stat.toUpperCase()})` : ''}
                                        </span>
                                    )}
                                    {featuresAtLevel.length > 0 && (
                                        <button
                                            className="lv-catalog-chip btn-feat-toggle"
                                            onClick={() => toggleFeatures(cl.id)}
                                        >
                                            {isFeaturesExpanded ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />}
                                            {featuresAtLevel.length} privilegi
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Class features from catalog */}
                            {catalogCls && isFeaturesExpanded && featuresAtLevel.length > 0 && (
                                <div className="lv-features-list">
                                    {featuresAtLevel.map(f => {
                                        const modCount = (f.modifiers?.length ?? 0) + (f.creatureModifiers?.length ?? 0);
                                        return (
                                            <div key={f.id} className={`lv-feature-row ${f.subcategory}`}>
                                                <span className="lv-feature-lv">Lv.{f.level}</span>
                                                <span className={`lv-feature-tag ${f.subcategory}`}>
                                                    {f.subcategory === 'active' ? 'Attivo' : 'Passivo'}
                                                </span>
                                                <span className="lv-feature-name">{pickLocalized(f.name, 'it')}</span>
                                                {f.resourceName && (
                                                    <span className="lv-feature-resource" title={`Risorsa: ${f.resourceName} (max ${f.resourceMax ?? '?'})`}>
                                                        {f.resourceName}{f.resourceMax ? ` ×${f.resourceMax}` : ''}
                                                    </span>
                                                )}
                                                {modCount > 0 && (
                                                    <span className="lv-feature-modcount" title={`${modCount} modificatori meccanici`}>+{modCount}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* HP breakdown */}
                            {die ? (
                                <div className="lv-hp-section">
                                    <div className="lv-hp-head">
                                        <FaHeart size={10} />
                                        <span>Punti Ferita per Livello</span>
                                        <span className="lv-hp-die">d{die}</span>
                                    </div>
                                    <div className="lv-hp-grid">
                                        {(logEntriesByClass.get(cl.id) ?? []).map((e, i) => {
                                            const isFirst = e.totalLevel === 1;
                                            const isEven = e.totalLevel % 2 === 0;
                                            return (
                                                <div key={i} className={`lv-hp-cell ${isFirst ? 'first' : isEven ? 'even' : 'odd'}`}>
                                                    <span className="lv-hp-lvnum">Lv.{e.totalLevel}</span>
                                                    <span className="lv-hp-val">+{e.hp}</span>
                                                    {isFirst && <span className="lv-hp-tag">max</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="lv-hp-missing">
                                    <FaHeart size={10} /> Seleziona il dado vita per calcolare i PF
                                </div>
                            )}

                            {/* Footer */}
                            <div className="lv-card-foot">
                                <span>
                                    {cl.className || 'Classe'} <strong style={{ color: 'var(--text-primary)' }}>{cl.level}</strong>
                                </span>
                                <span>
                                    BAB <span className="lv-foot-bab">+{babVal}</span>
                                    {' · '}
                                    TS: <span style={{ color: 'var(--accent-arcane)' }}>
                                        +{computeClassSaveBase(cl.level, cl.fortSave ?? 'poor')}
                                        {' / '}
                                        +{computeClassSaveBase(cl.level, cl.refSave ?? 'poor')}
                                        {' / '}
                                        +{computeClassSaveBase(cl.level, cl.willSave ?? 'poor')}
                                    </span>
                                    {die && (
                                        <>
                                            {' · '}
                                            <FaHeart size={9} style={{ color: 'var(--accent-hp)', verticalAlign: 'middle', marginRight: 2 }} />
                                            <span style={{ color: 'var(--accent-hp)' }}>
                                                {(logEntriesByClass.get(cl.id) ?? []).reduce((s, e) => s + e.hp, 0)} PF
                                            </span>
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                    );
                })}

                </div>{/* /lv-section-classi */}

                {/* ─── PF SECTION ─────────────────────────────────── */}
                <div className="lv-section lv-section-pf">

                {/* ─── HP Acquisition log ──────────────────────── */}
                {hpLevelLog.length > 0 && (
                    <details className="lv-formula lv-hp-log-details" open>
                        <summary><FaHeart size={11} /> Ordine Acquisizione Livelli</summary>
                        <div className="lv-hp-log">
                            {hpLevelLog.map((entry, idx) => {
                                const cl = classLevels.find(c => c.id === entry.classId);
                                const className = cl?.className || '?';
                                const die = cl?.hitDie;
                                const totalCharLevel = idx + 1;
                                const hp = die ? getHpForTotalLevel(die, totalCharLevel) : null;
                                const isFirst = totalCharLevel === 1;
                                const isEven = totalCharLevel % 2 === 0;
                                return (
                                    <div key={entry.id} className="lv-log-row">
                                        <span className="lv-log-pos">{idx + 1}</span>
                                        <span className="lv-log-class">{className}</span>
                                        <span className="lv-log-lvnum">Lv.{entry.classLevelNumber}</span>
                                        {hp !== null ? (
                                            <span className={`lv-log-hp ${isFirst ? 'first' : isEven ? 'even' : 'odd'}`}>
                                                +{hp} PF
                                                {isFirst && <span className="lv-hp-tag">max</span>}
                                            </span>
                                        ) : (
                                            <span className="lv-log-hp missing">dado ?</span>
                                        )}
                                        <div className="lv-log-btns">
                                            <button
                                                disabled={idx === 0}
                                                onClick={() => {
                                                    const newLog = [...hpLevelLog];
                                                    [newLog[idx - 1], newLog[idx]] = [newLog[idx], newLog[idx - 1]];
                                                    reorderHpLevelLog(newLog);
                                                }}
                                                title="Sposta su"
                                                aria-label="Sposta su"
                                            ><FaArrowUp size={9} /></button>
                                            <button
                                                disabled={idx === hpLevelLog.length - 1}
                                                onClick={() => {
                                                    const newLog = [...hpLevelLog];
                                                    [newLog[idx], newLog[idx + 1]] = [newLog[idx + 1], newLog[idx]];
                                                    reorderHpLevelLog(newLog);
                                                }}
                                                title="Sposta giù"
                                                aria-label="Sposta giù"
                                            ><FaArrowDown size={9} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </details>
                )}

                {/* ─── Formulas ─────────────────────────────────── */}
                <details className="lv-formula">
                    <summary><FaInfoCircle size={12} /> Formule (D&amp;D 3.5)</summary>
                    <div className="lv-formula-body">
                        <ul>
                            <li><strong>BAB:</strong> Alto = <code>Livello</code> · Medio = <code>⌊Livello × 0,75⌋</code> · Basso = <code>⌊Livello × 0,5⌋</code></li>
                            <li><strong>TS Buono:</strong> <code>2 + ⌊Livello / 2⌋</code> — <strong>TS Scarso:</strong> <code>⌊Livello / 3⌋</code></li>
                            <li><strong>Tempra</strong> = base + mod. Costituzione · <strong>Riflessi</strong> = base + mod. Destrezza · <strong>Volontà</strong> = base + mod. Saggezza</li>
                            <li>I contributi delle singole classi vengono <em>sommati</em> per personaggi multiclasse.</li>
                            <li><strong>PF Lv.1:</strong> massimo del dado vita · <strong>PF Lv. pari:</strong> <code>⌊dado/2⌋</code> · <strong>PF Lv. dispari (≥3):</strong> <code>⌊dado/2⌋ + 1</code></li>
                            <li><strong>PF Max totale</strong> = somma PF da classi + modificatore COS × livello totale</li>
                            <li><strong>ECL</strong> (Livello Effettivo) = livelli di classe + Modificatore di Livello (LA) + DV razziali</li>
                            <li><strong>PE per prossimo livello</strong> si basa sull'ECL, non solo sui livelli di classe.</li>
                            <li>Esempi: Drow (LA +2) con 1 livello da Mago → ECL 3, ha bisogno di 6.000 PE per salire.</li>
                        </ul>
                    </div>
                </details>

                </div>{/* /lv-section-pf */}
            </div>

            {/* Class Picker Modal */}
            <ClassPickerModal
                isOpen={isClassPickerOpen}
                onClose={() => {
                    setIsClassPickerOpen(false);
                    setClassPickerForId(null);
                }}
                onSelect={(className, catalogClass) => {
                    const cl = classLevels.find(c => c.id === classPickerForId);
                    if (cl) {
                        handleClassSelect(cl, className, catalogClass);
                    }
                }}
                currentValue={classPickerForId ? classLevels.find(c => c.id === classPickerForId)?.className : ''}
            />

            {/* ─── Level-up preview modal ──────────────────────────── */}
            {levelUpPreview && (() => {
                const cl = levelUpPreview;
                const newLevel = cl.level + 1;
                const catalogCls = catalogClasses.find(c => c.id === cl.catalogClassId);
                const newFeatures = catalogCls?.featuresByLevel.filter(f => f.level === newLevel) ?? [];
                const babNow = computeClassBab(cl.level, cl.babProgression);
                const babNew = computeClassBab(newLevel, cl.babProgression);
                const saves = [
                    { name: 'Tempra', prog: cl.fortSave, Icon: FaShieldAlt },
                    { name: 'Riflessi', prog: cl.refSave, Icon: FaRunning },
                    { name: 'Volontà', prog: cl.willSave, Icon: FaBrain },
                ] as const;
                return (
                    <div className="lv-up-overlay" onClick={() => setLevelUpPreview(null)}>
                        <div className="lv-up-modal" onClick={e => e.stopPropagation()}>
                            <div className="lv-up-header">
                                <GiUpgrade size={20} className="lv-up-icon" />
                                <div>
                                    <div className="lv-up-title">Aumento di livello</div>
                                    <div className="lv-up-subtitle">{cl.className || 'Classe'} · Livello {cl.level} → {newLevel}</div>
                                </div>
                                <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setLevelUpPreview(null)}>✕</button>
                            </div>

                            <div className="lv-up-body">
                                {/* Stats preview */}
                                <div className="lv-up-stats">
                                    <div className="lv-up-stat">
                                        <GiSwordsEmblem size={13} />
                                        <span className="lv-up-stat-label">BAB</span>
                                        <span className="lv-up-stat-old">+{babNow}</span>
                                        <span className="lv-up-arrow">→</span>
                                        <span className="lv-up-stat-new">+{babNew}</span>
                                        {babNew > babNow && <span className="lv-up-delta">+{babNew - babNow}</span>}
                                    </div>
                                    <div className="lv-up-stat">
                                        <FaHeart size={11} />
                                        <span className="lv-up-stat-label">Dado vita</span>
                                        <span className="lv-up-stat-new">d{cl.hitDie}</span>
                                        {(cl.hitDie ?? 0) > 0 && <span className="lv-up-delta">+{Math.ceil((cl.hitDie ?? 0) / 2)} avg</span>}
                                    </div>
                                    {saves.map(sv => {
                                        const progField = sv.name === 'Tempra' ? cl.fortSave : sv.name === 'Riflessi' ? cl.refSave : cl.willSave;
                                        if (!progField) return null;
                                        const baseNow = computeClassSaveBase(cl.level, progField);
                                        const baseNew = computeClassSaveBase(newLevel, progField);
                                        return (
                                            <div key={sv.name} className="lv-up-stat">
                                                <sv.Icon size={11} />
                                                <span className="lv-up-stat-label">{sv.name}</span>
                                                <span className="lv-up-stat-old">{fmt(baseNow)}</span>
                                                <span className="lv-up-arrow">→</span>
                                                <span className="lv-up-stat-new">{fmt(baseNew)}</span>
                                                {baseNew > baseNow && <span className="lv-up-delta">+{baseNew - baseNow}</span>}
                                            </div>
                                        );
                                    })}
                                    {(catalogCls?.skillPointsPerLevel ?? 0) > 0 && (
                                        <div className="lv-up-stat">
                                            <FaStar size={11} />
                                            <span className="lv-up-stat-label">Punti abilità</span>
                                            <span className="lv-up-stat-new">+{catalogCls!.skillPointsPerLevel}</span>
                                        </div>
                                    )}
                                </div>

                                {/* New features */}
                                {newFeatures.length > 0 && (
                                    <div className="lv-up-feats-section">
                                        <div className="lv-up-feats-title">Nuovi privilegi al livello {newLevel}</div>
                                        <div className="lv-up-feats-list">
                                            {newFeatures.map(f => (
                                                <div key={f.id} className="lv-up-feat-row">
                                                    <span className={`lv-feature-tag ${f.subcategory}`}>
                                                        {f.subcategory === 'active' ? 'Attivo' : 'Passivo'}
                                                    </span>
                                                    <div className="lv-up-feat-info">
                                                        <span className="lv-up-feat-name">{pickLocalized(f.name, 'it')}</span>
                                                        {f.description && (
                                                            <span className="lv-up-feat-desc">{pickLocalized(f.description as any, 'it')}</span>
                                                        )}
                                                        {(f.modifiers?.length ?? 0) + (f.creatureModifiers?.length ?? 0) > 0 && (
                                                            <span className="lv-feature-modcount" title="Modificatori meccanici">
                                                                +{(f.modifiers?.length ?? 0) + (f.creatureModifiers?.length ?? 0)} mod
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {newFeatures.length === 0 && !catalogCls && (
                                    <div className="lv-up-no-feats">Nessuna classe dal catalogo associata — i privilegi non vengono importati automaticamente.</div>
                                )}
                            </div>

                            <div className="lv-up-footer">
                                <button className="btn-ghost" onClick={() => setLevelUpPreview(null)}>Annulla</button>
                                <button className="btn-primary lv-up-confirm" onClick={confirmLevelUp}>
                                    <GiUpgrade size={14} /> Conferma livello {newLevel}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};
