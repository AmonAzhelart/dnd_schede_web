import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaShieldAlt, FaRunning, FaBrain, FaInfoCircle, FaHeart, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { GiSwordsEmblem, GiUpgrade } from 'react-icons/gi';
import { useCharacterStore } from '../store/characterStore';
import type { BabProgression, SaveProgression, ClassLevel } from '../types/dnd';
import { CLASS_BAB_PRESETS, CLASS_SAVE_PRESETS, CLASS_HIT_DIE_PRESETS, computeClassBab, computeClassSaveBase, getHpForTotalLevel } from '../types/dnd';
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
        getTotalBab, getSaveBreakdown, getTotalMaxHp,
        addHpLevelEntry, removeLastHpLevelEntry, reorderHpLevelLog,
    } = useCharacterStore();

    if (!character) return null;
    const classLevels = character.classLevels ?? [];
    const hpLevelLog = character.hpLevelLog ?? [];
    const totalLevel = classLevels.reduce((s, cl) => s + cl.level, 0);
    const totalMaxHp = getTotalMaxHp();

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

    const handleClassNameChange = (cl: ClassLevel, name: string) => {
        const bab = CLASS_BAB_PRESETS[name];
        const sv = CLASS_SAVE_PRESETS[name];
        const hd = CLASS_HIT_DIE_PRESETS[name];
        updateClassLevel({
            ...cl,
            className: name,
            babProgression: bab ?? cl.babProgression,
            fortSave: sv?.fort ?? cl.fortSave,
            refSave: sv?.ref ?? cl.refSave,
            willSave: sv?.will ?? cl.willSave,
            hitDie: hd ?? cl.hitDie,
        });
    };

    const handleLevelUp = (cl: ClassLevel) => {
        const newLevel = Math.min(20, cl.level + 1);
        if (newLevel <= cl.level) return;
        updateClassLevel({ ...cl, level: newLevel });
        addHpLevelEntry({ id: uuidv4(), classId: cl.id, classLevelNumber: newLevel });
    };

    const handleLevelDown = (cl: ClassLevel) => {
        const newLevel = Math.max(1, cl.level - 1);
        if (newLevel >= cl.level) return;
        removeLastHpLevelEntry(cl.id);
        updateClassLevel({ ...cl, level: newLevel });
    };

    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

    return (
        <div className="levels-tab animate-fade-in">

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
                const isPreset = !!CLASS_BAB_PRESETS[cl.className];
                const datalistId = `classlist-${cl.id}`;
                const die = cl.hitDie;

                return (
                    <div key={cl.id} className="lv-card">
                        {/* Head */}
                        <div className="lv-card-head">
                            <div className="lv-class-input">
                                <input
                                    className="input"
                                    list={datalistId}
                                    value={cl.className}
                                    placeholder="Nome classe (es. Guerriero)"
                                    onChange={e => handleClassNameChange(cl, e.target.value)}
                                />
                                <datalist id={datalistId}>
                                    {Object.keys(CLASS_BAB_PRESETS).map(n => <option key={n} value={n} />)}
                                </datalist>
                                {isPreset && <span className="lv-preset-tag">Preset</span>}
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
                                    onClick={() => handleLevelUp(cl)}
                                    disabled={cl.level >= 20}
                                    aria-label="Aumenta livello"
                                >+</button>
                            </div>

                            <div title="Progressione del Bonus di Attacco Base">
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

                            <div title="Dado Vita (Hit Die)">
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
                    </ul>
                </div>
            </details>
        </div>
    );
};
