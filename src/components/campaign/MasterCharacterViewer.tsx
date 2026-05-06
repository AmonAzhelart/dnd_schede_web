import { useState } from 'react';
import { FaShieldAlt, FaHeart, FaBolt, FaWind, FaBook, FaBoxOpen, FaStar } from 'react-icons/fa';
import { GiSwordman, GiSpellBook, GiSkills } from 'react-icons/gi';
import type { CharacterBase, Spell } from '../../types/dnd';
import {
    calcStatMod,
    computeEffectiveStat,
    computeStatMod,
    computeTotalBab,
    computeTotalMaxHp,
    computeSaveBreakdown,
    computeSkillTotal,
    computeMultipleAttacks,
} from '../../services/characterCompute';

type ViewerTab = 'stats' | 'skills' | 'inventory' | 'spells' | 'feats';

const STAT_LABELS: Record<string, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};

// ─── Modifier glow helpers ───────────────────────────────────────────────────

function statModified(char: CharacterBase, target: string): boolean {
    return (char.activeModifiers ?? []).some(m => !m.paused && m.target === target);
}

function skillModified(char: CharacterBase, skillId: string, skillName: string): boolean {
    return (char.activeModifiers ?? []).some(
        m => !m.paused && (
            m.target === `skill.${skillId}` ||
            m.target === `skill.${skillName}` ||
            m.target === skillId ||
            m.target === skillName
        ),
    );
}

const SCHOOL_COLOR: Record<string, string> = {
    'Evocazione': 'var(--accent-crimson)',
    'Invocazione': 'var(--accent-gold)',
    'Abiurazione': 'var(--accent-ice)',
    'Ammaliamento': 'var(--accent-arcane)',
    'Divinazione': 'var(--accent-success)',
    'Illusione': '#a29bfe',
    'Necromanzia': '#636e72',
    'Trasmutazione': '#fdcb6e',
};

interface Props {
    character: CharacterBase;
}

export function MasterCharacterViewer({ character: char }: Props) {
    const [tab, setTab] = useState<ViewerTab>('stats');

    const tabs: { id: ViewerTab; label: string; icon: React.ReactNode }[] = [
        { id: 'stats', label: 'Statistiche', icon: <GiSwordman size={14} /> },
        { id: 'skills', label: 'Competenze', icon: <GiSkills size={14} /> },
        { id: 'inventory', label: 'Inventario', icon: <FaBoxOpen size={13} /> },
        { id: 'spells', label: 'Magie', icon: <GiSpellBook size={14} /> },
        { id: 'feats', label: 'Talenti', icon: <FaStar size={12} /> },
    ];

    return (
        <div className="mcv-root">
            <div className="mcv-tabs">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        className={`mcv-tab-btn ${tab === t.id ? 'active' : ''}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            <div className="mcv-body">
                {tab === 'stats' && <StatsTab char={char} />}
                {tab === 'skills' && <SkillsTab char={char} />}
                {tab === 'inventory' && <InventoryTab char={char} />}
                {tab === 'spells' && <SpellsTab char={char} />}
                {tab === 'feats' && <FeatsTab char={char} />}
            </div>
        </div>
    );
}

// ─── Stats Tab ──────────────────────────────────────────────────────────────

export function StatsTab({ char }: { char: CharacterBase }) {
    const coreStats: (keyof typeof STAT_LABELS)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    const bab = computeTotalBab(char);
    const babAttacks = computeMultipleAttacks(char);
    const maxHp = char.hpDetails?.max ?? computeTotalMaxHp(char);
    const currentHp = char.hpDetails?.current ?? char.baseStats.hp ?? maxHp;
    // Temp HP: manual hpDetails.tempHp + positive 'hp' active modifiers (like HpWidget)
    const tempHpBase = char.hpDetails?.tempHp ?? 0;
    const tempHpFromMods = (char.activeModifiers ?? [])
        .filter(m => !m.paused && m.target === 'hp' && m.value > 0)
        .reduce((s, m) => s + m.value, 0);
    const totalTempHp = tempHpBase + tempHpFromMods;
    const nonLethal = char.hpDetails?.nonLethal ?? 0;
    const ac = computeEffectiveStat(char, 'ac');
    const initiative = computeEffectiveStat(char, 'initiative');
    const speed = char.movement?.base ?? char.baseStats.speed ?? 30;

    const fortSave = computeSaveBreakdown(char, 'fortitude');
    const refSave = computeSaveBreakdown(char, 'reflex');
    const willSave = computeSaveBreakdown(char, 'will');

    function fmtSigned(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

    return (
        <div className="mcv-stats-grid">
            {/* Ability scores */}
            <section className="mcv-section">
                <h4 className="mcv-section-title">Caratteristiche</h4>
                <div className="mcv-ability-grid">
                    {coreStats.map(stat => {
                        const val = computeEffectiveStat(char, stat as any);
                        const m = calcStatMod(val);
                        const glow = statModified(char, stat);
                        return (
                            <div key={stat} className={`mcv-ability-cell ${glow ? 'mcv-mod-glow' : ''}`}>
                                <div className="mcv-ability-label">{STAT_LABELS[stat]}</div>
                                <div className="mcv-ability-val">{val}</div>
                                <div className={`mcv-ability-mod ${m >= 0 ? 'pos' : 'neg'}`}>
                                    {fmtSigned(m)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Combat */}
            <section className="mcv-section">
                <h4 className="mcv-section-title">Combattimento</h4>
                <div className="mcv-combat-row">
                    <div className={`mcv-combat-stat ${statModified(char, 'hp') ? 'mcv-mod-glow' : ''}`}>
                        <FaHeart size={11} style={{ color: 'var(--accent-crimson)' }} />
                        <span className="mcv-combat-label">PF</span>
                        <span className="mcv-combat-val" style={{ color: currentHp <= 0 ? 'var(--accent-crimson)' : undefined }}>
                            {currentHp}/{maxHp}
                        </span>
                    </div>
                    {totalTempHp > 0 && (
                        <div className="mcv-combat-stat" style={{ borderColor: 'rgba(100,200,255,0.4)', background: 'rgba(100,200,255,0.08)' }}>
                            <FaHeart size={11} style={{ color: '#7fdbff' }} />
                            <span className="mcv-combat-label">PF Temp.</span>
                            <span className="mcv-combat-val" style={{ color: '#7fdbff' }}>+{totalTempHp}</span>
                        </div>
                    )}
                    {nonLethal > 0 && (
                        <div className="mcv-combat-stat" style={{ borderColor: 'rgba(255,200,0,0.3)' }}>
                            <span className="mcv-combat-label">Non letale</span>
                            <span className="mcv-combat-val" style={{ color: '#f0c040' }}>-{nonLethal}</span>
                        </div>
                    )}
                    <div className={`mcv-combat-stat ${statModified(char, 'ac') ? 'mcv-mod-glow' : ''}`}>
                        <FaShieldAlt size={11} style={{ color: 'var(--accent-ice)' }} />
                        <span className="mcv-combat-label">CA</span>
                        <span className="mcv-combat-val">{ac}</span>
                    </div>
                    <div className={`mcv-combat-stat ${statModified(char, 'bab') ? 'mcv-mod-glow' : ''}`}>
                        <GiSwordman size={13} style={{ color: 'var(--accent-gold)' }} />
                        <span className="mcv-combat-label">BAB</span>
                        <span className="mcv-combat-val">
                            {babAttacks.map(a => fmtSigned(a)).join('/')}
                        </span>
                    </div>
                    <div className={`mcv-combat-stat ${statModified(char, 'initiative') ? 'mcv-mod-glow' : ''}`}>
                        <FaBolt size={11} style={{ color: '#fdcb6e' }} />
                        <span className="mcv-combat-label">Iniziativa</span>
                        <span className="mcv-combat-val">{fmtSigned(initiative)}</span>
                    </div>
                    <div className={`mcv-combat-stat ${statModified(char, 'speed') ? 'mcv-mod-glow' : ''}`}>
                        <FaWind size={11} style={{ color: 'var(--accent-success)' }} />
                        <span className="mcv-combat-label">Velocità</span>
                        <span className="mcv-combat-val">{speed}m</span>
                    </div>
                </div>
            </section>

            {/* Saving throws */}
            <section className="mcv-section">
                <h4 className="mcv-section-title">Tiri Salvezza</h4>
                <div className="mcv-combat-row">
                    <div className={`mcv-combat-stat ${statModified(char, 'fortitude') ? 'mcv-mod-glow' : ''}`}>
                        <span className="mcv-combat-label">Tempra</span>
                        <span className="mcv-combat-val">{fmtSigned(fortSave.total)}</span>
                    </div>
                    <div className={`mcv-combat-stat ${statModified(char, 'reflex') ? 'mcv-mod-glow' : ''}`}>
                        <span className="mcv-combat-label">Riflessi</span>
                        <span className="mcv-combat-val">{fmtSigned(refSave.total)}</span>
                    </div>
                    <div className={`mcv-combat-stat ${statModified(char, 'will') ? 'mcv-mod-glow' : ''}`}>
                        <span className="mcv-combat-label">Volontà</span>
                        <span className="mcv-combat-val">{fmtSigned(willSave.total)}</span>
                    </div>
                </div>
            </section>

            {/* Active modifiers */}
            {(char.activeModifiers ?? []).filter(m => !m.paused).length > 0 && (
                <section className="mcv-section">
                    <h4 className="mcv-section-title">Modificatori Attivi</h4>
                    <div className="mcv-tags">
                        {(char.activeModifiers ?? []).filter(m => !m.paused).map(m => (
                            <span key={m.id} className="mcv-tag" style={{ color: m.value >= 0 ? 'var(--accent-success)' : 'var(--accent-crimson)' }}>
                                {m.name} {m.value >= 0 ? `+${m.value}` : m.value}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* Languages */}
            {(char.languages ?? []).length > 0 && (
                <section className="mcv-section">
                    <h4 className="mcv-section-title">Linguaggi</h4>
                    <div className="mcv-tags">
                        {char.languages!.map(l => (
                            <span key={l.id} className="mcv-tag">{l.name}</span>
                        ))}
                    </div>
                </section>
            )}

            {/* Notes preview */}
            {(char.notes ?? []).length > 0 && (
                <section className="mcv-section">
                    <h4 className="mcv-section-title"><FaBook size={10} /> Diario ({char.notes.length} voci)</h4>
                    <div className="mcv-notes-list">
                        {char.notes.slice(0, 3).map(n => (
                            <div key={n.id} className="mcv-note-row">
                                <span className="mcv-note-title">{n.title || '(senza titolo)'}</span>
                                {n.date && <span className="text-xs text-muted">{n.date}</span>}
                            </div>
                        ))}
                        {char.notes.length > 3 && (
                            <span className="text-xs text-muted">… e altri {char.notes.length - 3}</span>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

// ─── Skills Tab ──────────────────────────────────────────────────────────────

export function SkillsTab({ char }: { char: CharacterBase }) {
    const skills = Object.values(char.skills ?? {});

    if (skills.length === 0) {
        return <p className="mcv-empty">Nessuna competenza registrata.</p>;
    }

    const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name, 'it'));

    return (
        <div className="mcv-skills-list">
            <div className="mcv-skills-header">
                <span>Competenza</span>
                <span>Car.</span>
                <span>Gradi</span>
                <span>Totale</span>
            </div>
            {sorted.map(sk => {
                const total = computeSkillTotal(char, sk.id);
                const statMod = computeStatMod(char, sk.stat);
                const glow = skillModified(char, sk.id, sk.name);
                return (
                    <div key={sk.id} className={`mcv-skill-row ${glow ? 'mcv-mod-glow' : ''}`}>
                        <span className="mcv-skill-name">
                            {sk.name}
                            {sk.classSkill && <span className="mcv-skill-class-dot" title="Competenza di classe">●</span>}
                        </span>
                        <span className="text-xs text-muted">{sk.stat.toUpperCase()}</span>
                        <span className="text-xs">{sk.ranks}</span>
                        <span className={`mcv-skill-total ${total >= 0 ? '' : 'neg'}`}>
                            {total >= 0 ? `+${total}` : total}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Inventory Tab ───────────────────────────────────────────────────────────

const ITEM_TYPE_LABELS: Record<string, string> = {
    weapon: 'Armi', armor: 'Armature', shield: 'Scudi', ammo: 'Munizioni',
    protectiveItem: 'Oggetti Protettivi', gear: 'Equipaggiamento',
    consumable: 'Consumabili', component: 'Componenti', misc: 'Vari',
};

export function InventoryTab({ char }: { char: CharacterBase }) {
    const allItems = char.inventory ?? [];

    if (allItems.length === 0) {
        return <p className="mcv-empty">Inventario vuoto.</p>;
    }

    const grouped: Record<string, typeof allItems> = {};
    for (const item of allItems) {
        if (!grouped[item.type]) grouped[item.type] = [];
        grouped[item.type].push(item);
    }

    return (
        <div className="mcv-inv-list">
            {Object.entries(grouped).map(([type, its]) => (
                <div key={type} className="mcv-inv-group">
                    <h5 className="mcv-inv-group-title">{ITEM_TYPE_LABELS[type] ?? type}</h5>
                    {its.map(item => (
                        <div key={item.id} className="mcv-inv-row">
                            <div className="mcv-inv-name">
                                {item.equipped && <span className="mcv-equipped-dot" title="Indossato">◆</span>}
                                {item.name}
                                {item.quantity != null && item.quantity > 1 && (
                                    <span className="text-xs text-muted"> ×{item.quantity}</span>
                                )}
                            </div>
                            <div className="mcv-inv-meta">
                                {item.type === 'weapon' && item.weaponDetails && (
                                    <span className="mcv-tag">{item.weaponDetails.damage}</span>
                                )}
                                {(item.type === 'armor' || item.type === 'shield') && item.armorDetails && (
                                    <span className="mcv-tag">+{item.armorDetails.armorBonus} CA</span>
                                )}
                                {item.weight > 0 && (
                                    <span className="text-xs text-muted">{item.weight} kg</span>
                                )}
                            </div>
                            {item.description && (
                                <div className="mcv-inv-desc text-xs text-muted">{item.description}</div>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ─── Spells Tab ──────────────────────────────────────────────────────────────

export function SpellsTab({ char }: { char: CharacterBase }) {
    const spells = char.spells ?? [];

    if (spells.length === 0) {
        return <p className="mcv-empty">Nessun incantesimo nel grimorio.</p>;
    }

    const byLevel: Record<number, Spell[]> = {};
    for (const sp of spells) {
        if (!byLevel[sp.level]) byLevel[sp.level] = [];
        byLevel[sp.level].push(sp);
    }

    const slots = char.spellSlots ?? {};

    return (
        <div className="mcv-spell-list">
            {Object.entries(byLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([lvl, spellsAtLevel]) => {
                const slotInfo = slots[lvl];
                return (
                    <div key={lvl} className="mcv-spell-group">
                        <h5 className="mcv-spell-level-title">
                            {lvl === '0' ? 'Trucchetti' : `Livello ${lvl}`}
                            {slotInfo && (
                                <span className="mcv-spell-slots">
                                    {slotInfo.used}/{slotInfo.total} usati
                                </span>
                            )}
                        </h5>
                        {spellsAtLevel.map(sp => (
                            <div key={sp.id} className="mcv-spell-row">
                                <div className="mcv-spell-name">
                                    {sp.name}
                                    {sp.school && (
                                        <span
                                            className="mcv-spell-school"
                                            style={{ color: SCHOOL_COLOR[sp.school] ?? 'var(--text-muted)' }}
                                        >
                                            {sp.school}
                                        </span>
                                    )}
                                </div>
                                <div className="mcv-spell-meta">
                                    {sp.castingTime && <span className="mcv-tag">{sp.castingTime}</span>}
                                    {sp.range && <span className="text-xs text-muted">{sp.range}</span>}
                                    {sp.duration && <span className="text-xs text-muted">{sp.duration}</span>}
                                </div>
                                {sp.description && (
                                    <div className="mcv-spell-desc text-xs text-muted">{sp.description}</div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Feats Tab ───────────────────────────────────────────────────────────────

export function FeatsTab({ char }: { char: CharacterBase }) {
    const feats = char.feats ?? [];
    const classFeatures = char.classFeatures ?? [];

    if (feats.length === 0 && classFeatures.length === 0) {
        return <p className="mcv-empty">Nessun talento o capacità registrata.</p>;
    }

    return (
        <div className="mcv-feats-list">
            {classFeatures.length > 0 && (
                <section className="mcv-section">
                    <h4 className="mcv-section-title">Capacità di Classe</h4>
                    {classFeatures.map(cf => (
                        <div key={cf.id} className="mcv-feat-row">
                            <div className="mcv-feat-name">
                                {cf.name}
                                <span className={`mcv-feat-badge ${cf.subcategory}`}>
                                    {cf.subcategory === 'active' ? 'Attiva' : 'Passiva'}
                                </span>
                                {cf.resourceName && cf.resourceMax != null && (
                                    <span className="mcv-feat-resource">
                                        {cf.resourceName}: {(cf.resourceMax - (cf.resourceUsed ?? 0))}/{cf.resourceMax}
                                    </span>
                                )}
                            </div>
                            {cf.description && (
                                <div className="mcv-feat-desc text-xs text-muted">{cf.description}</div>
                            )}
                        </div>
                    ))}
                </section>
            )}

            {feats.length > 0 && (
                <section className="mcv-section">
                    <h4 className="mcv-section-title">Talenti</h4>
                    {feats.map(f => (
                        <div key={f.id} className="mcv-feat-row">
                            <div className="mcv-feat-name">{f.name}</div>
                            {f.description && (
                                <div className="mcv-feat-desc text-xs text-muted">{f.description}</div>
                            )}
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
