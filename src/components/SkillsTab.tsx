/**
 * SkillsTab — full-page skill management with responsive multi-column layout.
 *
 * Features:
 * - Multi-column CSS grid, adapts from 1 to 4 columns based on viewport width.
 * - Skill-point budget display: total, spent (non-class = 2 pts/rank), remaining.
 * - Roll button on every skill row (opens RollPickerModal).
 * - Toggle class/non-class per skill directly from the dot icon.
 * - Inline rank ± controls that respect the point-cost rule visually.
 * - Search + filter bar.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaMinus, FaSearch, FaDiceD20, FaTrash, FaEdit, FaCheck, FaTimes, FaLock, FaUnlock, FaLink } from 'react-icons/fa';
import { useCharacterStore } from '../store/characterStore';
import { CLASS_SKILL_POINTS } from '../types/dnd';
import type { Skill, CustomSkillSynergy } from '../types/dnd';
import { getSrdSynergiesForCharacterSkill } from '../data/skillSynergies';
import { useSkillDisplayName } from '../hooks/useSkillDisplayName';
import { RollPickerModal, type RollBreakdownLine } from './RollPickerModal';
import type { RollContext } from '../services/modifiers';
import { SkillModal } from './SkillModal';
import { SkillEditModal } from './SkillEditModal';
import { SkillImportWizard } from './SkillImportWizard';
import { ModifierArrows } from './dashboard/widgets/ModifierAura';


// ─── Skill-point budget helpers ──────────────────────────────────────────────

function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
}

/**
 * Compute total skill-point budget for a character.
 * D&D 3.5 rule: level 1 → (sp + INT mod) × 4; each subsequent level → +( sp + INT mod ).
 * Human / other race extra skill points are stored in `character.skillExtraPool`.
 */
export function computeSkillBudget(character: import('../types/dnd').CharacterBase): number {
    const intMod = abilityMod(character.baseStats?.int ?? 10);
    let budget = 0;

    if (character.classLevels && character.classLevels.length > 0) {
        // Multiclass: iterate over class entries.
        // The very first total character level gets the ×4 multiplier.
        let firstLevelDone = false;
        // Sort by "order" is unknown; we just apply ×4 once for the first class first level.
        for (const cl of character.classLevels) {
            const sp = CLASS_SKILL_POINTS[cl.className] ?? 2;
            const perLevel = Math.max(1, sp + intMod);
            if (!firstLevelDone && cl.level >= 1) {
                budget += perLevel * 4;          // level-1 bonus
                budget += perLevel * (cl.level - 1); // remaining levels in this class
                firstLevelDone = true;
            } else {
                budget += perLevel * cl.level;
            }
        }
    } else {
        // Single-class (or no classLevels data).
        const sp = CLASS_SKILL_POINTS[character.characterClass] ?? 2;
        const perLevel = Math.max(1, sp + intMod);
        const level = Math.max(1, character.level ?? 1);
        // level 1: ×4 → (perLevel*4) + subsequent levels (level-1)*perLevel
        budget = perLevel * (level + 3);
    }

    // Race / feat extra pool set manually on the character.
    budget += character.skillExtraPool ?? 0;
    return Math.max(0, budget);
}

/** Total skill points spent, counting non-class skills at 2 pts/rank. */
export function computeUsedSkillPoints(skills: Skill[]): number {
    return skills.reduce((s, sk) => s + (sk.ranks ?? 0) * (sk.classSkill ? 1 : 2), 0);
}

// ─── Stat colour palette ─────────────────────────────────────────────────────

const STAT_COLOR: Record<string, string> = {
    str: '#e74c3c', dex: '#27ae60', con: '#e67e22',
    int: '#3498db', wis: '#9b59b6', cha: '#e91e8c',
};
const STAT_LABEL: Record<string, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};

const tier = (n: number): string =>
    n >= 10 ? 'tier-elite'
        : n >= 6 ? 'tier-good'
            : n >= 2 ? 'tier-mid'
                : n >= 0 ? 'tier-low'
                    : 'tier-bad';

// ─── Column headers ───────────────────────────────────────────────────────────

const ColHeaders: React.FC = () => (
    <div className="skills-tab-col-headers">
        <span className="skills-tab-col-hdr" style={{ width: 18 }} title="Classe / fuori classe">●</span>
        <span className="skills-tab-col-hdr" style={{ flex: 1 }}>ABILITÀ</span>
        <span className="skills-tab-col-hdr" style={{ width: 28 }} title="Usabile senza gradi">S.G.</span>
        <span className="skills-tab-col-hdr" style={{ width: 38 }}>CAR.</span>
        <span className="skills-tab-col-hdr" style={{ width: 92 }}>GRADI</span>
        <span className="skills-tab-col-hdr" style={{ width: 32 }}>MOD</span>
        <span className="skills-tab-col-hdr" style={{ width: 40 }}>TOT.</span>
        <span className="skills-tab-col-hdr" style={{ width: 72 }}>AZIONI</span>
    </div>
);

// ─── Two-column alphabetical grid (column-major order) ───────────────────────

const SkillColumns: React.FC<{ skills: Skill[]; renderRow: (s: Skill) => React.ReactNode }> = ({ skills, renderRow }) => {
    const mid = Math.ceil(skills.length / 2);
    const cols = [skills.slice(0, mid), skills.slice(mid)].filter(c => c.length > 0);
    return (
        <div className="skills-tab-grid">
            {cols.map((col, i) => (
                <div key={i} className="skills-tab-column">
                    <ColHeaders />
                    {col.map(renderRow)}
                </div>
            ))}
        </div>
    );
};

// ─── Component ───────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'class' | 'trained' | 'untrained';

export const SkillsTab: React.FC = () => {
    const {
        character, setCharacter,
        getEffectiveSkill, getSkillBreakdown,
        updateSkill, deleteSkill,
        getActiveModifierDelta,
    } = useCharacterStore();

    const { i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';
    const skillName = useSkillDisplayName();

    const [q, setQ] = useState('');
    const [filter, setFilter] = useState<FilterKey>('all');
    const [usabilityTab, setUsabilityTab] = useState<'usable' | 'unusable'>('usable');
    const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
    const [showImportWizard, setShowImportWizard] = useState(false);
    const [picker, setPicker] = useState<{
        ctx: RollContext; title: string; breakdown: RollBreakdownLine[];
    } | null>(null);
    // Edit modal: stores the skill being edited (null = closed)
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    // Extra pool editor (manual override for race/feat bonus)
    const [editingPool, setEditingPool] = useState(false);
    const [poolDraft, setPoolDraft] = useState('');

    if (!character) return null;

    const allSkills = Object.values(character.skills);
    const budget = computeSkillBudget(character);
    const used = computeUsedSkillPoints(allSkills);
    const remaining = budget - used;

    // ── Filter + search ───────────────────────────────────────────────────────
    const filtered = allSkills.filter(s => {
        if (q && !skillName(s).toLowerCase().includes(q.toLowerCase())) return false;
        if (filter === 'class' && !s.classSkill) return false;
        if (filter === 'trained' && (s.ranks ?? 0) < 1) return false;
        if (filter === 'untrained' && (s.ranks ?? 0) > 0) return false;
        return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const usable = filtered.filter(s => getSkillBreakdown(s.id).usable);
    const unusable = filtered.filter(s => !getSkillBreakdown(s.id).usable);

    // ── Max ranks (D&D 3.5: class = level+3, cross = floor((level+3)/2)) ──────
    const totalLevel = character.classLevels?.reduce((s, c) => s + c.level, 0) ?? (character.level ?? 1);
    const maxClassRanks = totalLevel + 3;

    // ── Rank change with implicit cost check ──────────────────────────────────
    const changeRanks = (skill: Skill, delta: number) => {
        const newRanks = Math.max(0, (skill.ranks ?? 0) + delta);
        updateSkill({ ...skill, ranks: newRanks });
    };

    // ── Roll picker ───────────────────────────────────────────────────────────
    const openPicker = (skill: Skill) => {
        const bd = getSkillBreakdown(skill.id);
        const synergyLines: RollBreakdownLine[] = bd.synergies.map(syn => ({
            label: `Sinergia (${syn.sourceName})`,
            value: syn.bonus,
        }));
        setPicker({
            ctx: { channel: `skill.${skill.id}`, skillId: skill.id, skillName: skill.name },
            title: skillName(skill),
            breakdown: [
                { label: 'Gradi', value: skill.ranks ?? 0 },
                { label: `Mod. ${STAT_LABEL[skill.stat] ?? skill.stat}`, value: bd.statMod ?? 0 },
                ...(bd.classBonus > 0 ? [{ label: 'Bonus di classe', value: bd.classBonus }] : []),
                ...synergyLines,
            ],
        });
    };

    // ── Extra pool save ───────────────────────────────────────────────────────
    const savePool = () => {
        const v = parseInt(poolDraft, 10);
        if (!isNaN(v)) setCharacter({ ...character, skillExtraPool: v });
        setEditingPool(false);
    };

    // ── Outgoing synergies for a skill (what it grants to others) ─────────────
    const getOutgoingSynergies = (skill: Skill): CustomSkillSynergy[] => {
        const managed = character.managedSynergySkillIds ?? [];
        const stored = (character.customSynergies ?? []).filter(s => s.sourceSkillId === skill.id);
        if (managed.includes(skill.id)) return stored;
        const srd = getSrdSynergiesForCharacterSkill(skill.id, skill.name, character.skills)
            .filter(s => s.sourceSkillId === skill.id);
        const toAdd = srd.filter(s => !stored.some(cs => cs.targetSkillId === s.targetSkillId));
        return [...stored, ...toAdd];
    };

    // ── Row render ────────────────────────────────────────────────────────────
    const renderRow = (skill: Skill) => {
        const total = getEffectiveSkill(skill.id);
        const ranks = skill.ranks ?? 0;
        const cost = skill.classSkill ? 1 : 2;
        const maxR = skill.classSkill ? maxClassRanks : Math.floor(maxClassRanks / 2);
        const statColor = STAT_COLOR[skill.stat] ?? 'var(--text-muted)';

        const delta = getActiveModifierDelta(`skill.${skill.id}`) + getActiveModifierDelta(`skill.${skill.name.toLowerCase()}`);
        const auraClass = delta > 0 ? 'w-mod-aura-buff' : delta < 0 ? 'w-mod-aura-malus' : '';

        // Synergy bonuses active on this skill
        const bd = getSkillBreakdown(skill.id);
        const activeSynergies = bd.synergies;

        // Outgoing synergies this skill grants to others
        const outgoing = getOutgoingSynergies(skill);

        // Helper: localized name for a skill by id
        const tgtName = (id: string) => {
            const tgt = character.skills[id];
            return tgt ? skillName(tgt) : '?';
        };

        // When the pool is empty (or would go negative), visually warn on + button
        const canAfford = remaining >= cost;
        const overMax = ranks > maxR;

        return (
            <div
                key={skill.id}
                className={`skills-tab-row${auraClass ? ' ' + auraClass : ''}${!bd.usable ? ' skills-tab-row--unusable' : ''}`}
            >
                {auraClass && <ModifierArrows delta={delta} count={2} />}

                {/* Class dot (toggle) */}
                <button
                    className="skills-tab-dot-btn"
                    title={skill.classSkill ? 'Abilità di classe — clicca per cambiarla in fuori classe' : 'Fuori classe (costo 2/grado) — clicca per marcarla di classe'}
                    onClick={() => updateSkill({ ...skill, classSkill: !skill.classSkill })}
                    aria-label={skill.classSkill ? 'classe' : 'fuori classe'}
                >
                    <span className={skill.classSkill ? 'skill-class-dot' : 'skill-cross-dot'} />
                </button>

                {/* Name */}
                <div className="skills-tab-name">
                    <span
                        className={`skills-tab-name-text${skill.classSkill ? ' skills-tab-name--class' : ''}`}
                        title={skill.name}
                    >{skillName(skill)}</span>
                    {outgoing.length > 0 && (
                        <div className="skills-tab-grants">
                            {outgoing.map(syn => {
                                const active = (skill.ranks ?? 0) >= syn.ranksRequired;
                                return (
                                    <span
                                        key={syn.id}
                                        className={`skills-tab-grant-chip${active ? ' skills-tab-grant-chip--active' : ''}`}
                                        title={`≥${syn.ranksRequired} gradi → ${tgtName(syn.targetSkillId)} +${syn.bonus}${syn.note ? ` (${syn.note})` : ''}`}
                                    >
                                        →&nbsp;{tgtName(syn.targetSkillId)}&nbsp;<span className="skills-tab-grant-bonus">+{syn.bonus}</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
                {/* Forces a line-break on mobile so controls wrap to a second line */}
                <span className="skills-tab-row-break" />

                {/* Untrained toggle */}
                <button
                    className={`skills-tab-ut-btn${skill.canUseUntrained ? ' skills-tab-ut-btn--on' : ''}`}
                    title={skill.canUseUntrained ? 'Usabile senza gradi — clicca per richiedere gradi' : 'Richiede gradi — clicca per rendere usabile senza gradi'}
                    onClick={() => updateSkill({ ...skill, canUseUntrained: !skill.canUseUntrained })}
                >
                    {skill.canUseUntrained ? <FaUnlock size={9} /> : <FaLock size={9} />}
                </button>

                {/* Stat badge */}
                <span
                    className="skills-tab-stat"
                    style={{ background: `${statColor}20`, color: statColor, border: `1px solid ${statColor}40` }}
                    title={`Base: ${STAT_LABEL[skill.stat]} ${bd.statMod >= 0 ? '+' : ''}${bd.statMod}`}
                >
                    {STAT_LABEL[skill.stat] ?? skill.stat.toUpperCase()}
                </span>

                {/* Ranks control */}
                <div className="skills-tab-ranks">
                    <button
                        className="skill-rank-btn"
                        onClick={() => changeRanks(skill, -1)}
                        disabled={ranks <= 0}
                        title="Riduci gradi"
                    ><FaMinus size={7} /></button>
                    <span
                        className={`skills-tab-ranks-val${overMax ? ' over-max' : ''}`}
                        title={`Gradi: ${ranks} · Max: ${maxR} · Costo: ${cost} pt/grado${overMax ? ' ⚠ SOPRA IL MASSIMO' : ''}`}
                    >
                        {ranks}{overMax && <span className="skills-tab-overmax-badge" title={`Massimo consentito: ${maxR}`}>!</span>}
                    </span>
                    <button
                        className={`skill-rank-btn${!canAfford ? ' over-budget' : ''}${overMax ? ' over-max' : ''}`}
                        onClick={() => changeRanks(skill, 1)}
                        title={`Aumenta gradi (costo: ${cost} punt${cost > 1 ? 'i' : 'o'})${!canAfford ? ' — punti insufficienti' : ''}${overMax ? ` — ⚠ già sopra il massimo (${maxR})` : ''}`}
                    ><FaPlus size={7} /></button>
                    {/* Non-class cost indicator */}
                    {cost === 2 && (
                        <span className="skills-tab-cost-badge" title="Abilità fuori classe: 2 punti per grado">×2</span>
                    )}
                </div>

                {/* Stat mod chip */}
                <span className="skills-tab-modchip" title={`Modificatore ${STAT_LABEL[skill.stat]}`}>
                    {bd.statMod >= 0 ? '+' : ''}{bd.statMod}
                </span>

                {/* Class bonus chip */}
                {bd.classBonus > 0 && (
                    <span className="skills-tab-classbns" title="Bonus abilità di classe (+3)">
                        +{bd.classBonus}cls
                    </span>
                )}

                {/* Synergy chip(s) */}
                {activeSynergies.length > 0 && (
                    <span
                        className="skills-tab-synergy-badge"
                        title={activeSynergies.map(s => `+${s.bonus} sinergia da ${s.sourceName}`).join(' · ')}
                    >
                        <FaLink size={7} />
                        +{activeSynergies.reduce((s, x) => s + x.bonus, 0)}
                    </span>
                )}

                {/* Total */}
                <span className={`skills-tab-total ${tier(total)}`} title={bd.usable ? '' : 'Abilità non utilizzabile senza gradi'}>
                    {total >= 0 ? '+' : ''}{total}
                </span>

                {/* Actions */}
                <div className="skills-tab-actions">
                    <button
                        className="skills-tab-icon-btn roll-btn"
                        title={`Prova di ${skill.name}`}
                        onClick={() => openPicker(skill)}
                    >
                        <FaDiceD20 size={11} />
                    </button>
                    <button
                        className="skills-tab-icon-btn"
                        title="Modifica"
                        onClick={() => setEditingSkill(skill)}
                    >
                        <FaEdit size={9} />
                    </button>
                    <button className="skills-tab-icon-btn danger" title="Elimina" onClick={() => deleteSkill(skill.id)}>
                        <FaTrash size={9} />
                    </button>
                </div>
            </div>
        );
    };

    const FILTERS: [FilterKey, string][] = [['all', 'Tutte'], ['class', 'Di classe'], ['trained', 'Con gradi'], ['untrained', 'Senza gradi']];

    const progressPct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
    const progressColor = remaining < 0 ? 'var(--accent-crimson)' : remaining === 0 ? 'var(--accent-gold)' : 'var(--accent-success)';

    return (
        <div className="skills-tab-root animate-fade-in">

            {/* ─── Budget bar ─────────────────────────────────────────────── */}
            <div className="skills-tab-budget glass-panel">
                <div className="skills-tab-budget-left">
                    <span className="skills-tab-budget-title">Punti Abilità</span>
                    <div className="skills-tab-budget-progress">
                        <div
                            className="skills-tab-budget-fill"
                            style={{ width: `${progressPct}%`, background: progressColor }}
                        />
                    </div>
                </div>
                <div className="skills-tab-budget-nums">
                    <div className="skills-tab-budget-num">
                        <span className="skills-tab-budget-num-label">Pool</span>
                        <span className="skills-tab-budget-num-val" style={{ color: 'var(--text-primary)' }}>{budget}</span>
                    </div>
                    <div className="skills-tab-budget-sep" />
                    <div className="skills-tab-budget-num">
                        <span className="skills-tab-budget-num-label">Spesi</span>
                        <span className="skills-tab-budget-num-val" style={{ color: 'var(--accent-gold)' }}>{used}</span>
                    </div>
                    <div className="skills-tab-budget-sep" />
                    <div className="skills-tab-budget-num">
                        <span className="skills-tab-budget-num-label">Rimasti</span>
                        <span className="skills-tab-budget-num-val" style={{ color: progressColor, fontWeight: 700 }}>
                            {remaining < 0 ? '⚠ ' : ''}{remaining}
                        </span>
                    </div>
                </div>
                {/* Extra pool editor */}
                <div className="skills-tab-budget-extra">
                    <span className="skills-tab-budget-num-label">Extra (razza/altro):</span>
                    {editingPool ? (
                        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                            <input
                                type="number"
                                className="skills-tab-pool-input"
                                value={poolDraft}
                                autoFocus
                                onChange={e => setPoolDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') savePool(); if (e.key === 'Escape') setEditingPool(false); }}
                            />
                            <button className="skills-tab-icon-btn" onClick={savePool} title="Salva"><FaCheck size={9} /></button>
                            <button className="skills-tab-icon-btn" onClick={() => setEditingPool(false)} title="Annulla"><FaTimes size={9} /></button>
                        </span>
                    ) : (
                        <button
                            className="skills-tab-pool-edit-btn"
                            onClick={() => { setPoolDraft(String(character.skillExtraPool ?? 0)); setEditingPool(true); }}
                        >
                            {character.skillExtraPool ?? 0}
                            <FaEdit size={8} style={{ marginLeft: 3 }} />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Rule hint ──────────────────────────────────────────────── */}
            <div className="skills-tab-rule-hint">
                <span className="skill-class-dot" /> = abilità di classe (1 pt/grado, max {maxClassRanks} gradi)
                &nbsp;&nbsp;
                <span className="skill-cross-dot" /> = fuori classe (<strong>2 pt/grado</strong>, max {Math.floor(maxClassRanks / 2)} gradi)
            </div>

            {/* ─── Toolbar ────────────────────────────────────────────────── */}
            <div className="skills-tab-toolbar">
                <div className="skills-tab-search-wrap">
                    <FaSearch size={10} className="skills-tab-search-icon" />
                    <input
                        className="input skills-tab-search"
                        placeholder="Cerca abilità…"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                    />
                </div>
                <div className="skills-tab-filters">
                    {FILTERS.map(([k, l]) => (
                        <button
                            key={k}
                            className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                            onClick={() => setFilter(k)}
                        >{l}</button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <button className="btn btn-secondary btn-sm" onClick={() => setShowImportWizard(true)} style={{ fontSize: '0.7rem' }}>Importa preset</button>
                <button className="btn btn-primary btn-sm" onClick={() => setIsSkillModalOpen(true)} style={{ fontSize: '0.7rem' }}>
                    <FaPlus size={9} /> Nuova
                </button>
            </div>

            {/* ─── Usable / Unusable tab switcher ───────────────────────────── */}
            {(usable.length > 0 || unusable.length > 0) && (
                <div className="skills-tab-usability-tabs">
                    <button
                        className={`skills-tab-usability-tab${usabilityTab === 'usable' ? ' active' : ''}`}
                        onClick={() => setUsabilityTab('usable')}
                    >
                        Utilizzabili
                        <span className="skills-tab-usability-count">{usable.length}</span>
                    </button>
                    <button
                        className={`skills-tab-usability-tab${usabilityTab === 'unusable' ? ' active' : ''}`}
                        onClick={() => setUsabilityTab('unusable')}
                    >
                        Non utilizzabili
                        <span className="skills-tab-usability-count">{unusable.length}</span>
                    </button>
                </div>
            )}

            {/* ─── Skill grid (scrollable) ─────────────────────────────────── */}
            <div className="skills-tab-scroll">
                {usable.length === 0 && unusable.length === 0 && (
                    <p className="text-muted text-sm" style={{ padding: '1rem 0', textAlign: 'center' }}>
                        {q ? 'Nessuna abilità trovata.' : 'Nessuna abilità. Aggiungi nuove abilità o importa i preset.'}
                    </p>
                )}

                {usabilityTab === 'usable' && usable.length > 0 && (
                    <SkillColumns skills={usable} renderRow={renderRow} />
                )}
                {usabilityTab === 'usable' && usable.length === 0 && (usable.length + unusable.length) > 0 && (
                    <p className="text-muted text-sm" style={{ padding: '1rem 0', textAlign: 'center' }}>Nessuna abilità utilizzabile con i filtri correnti.</p>
                )}

                {usabilityTab === 'unusable' && unusable.length > 0 && (
                    <SkillColumns skills={unusable} renderRow={renderRow} />
                )}
                {usabilityTab === 'unusable' && unusable.length === 0 && (usable.length + unusable.length) > 0 && (
                    <p className="text-muted text-sm" style={{ padding: '1rem 0', textAlign: 'center' }}>Nessuna abilità non utilizzabile con i filtri correnti.</p>
                )}
            </div>

            {/* ─── Modals ─────────────────────────────────────────────────── */}
            {picker && (
                <RollPickerModal
                    ctx={picker.ctx}
                    title={picker.title}
                    baseBreakdown={picker.breakdown}
                    onClose={() => setPicker(null)}
                />
            )}
            {isSkillModalOpen && <SkillModal onClose={() => setIsSkillModalOpen(false)} />}
            {editingSkill && (
                <SkillEditModal skill={editingSkill} onClose={() => setEditingSkill(null)} />
            )}
            {showImportWizard && <SkillImportWizard onClose={() => setShowImportWizard(false)} />}
        </div>
    );
};
