import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaPlus, FaMinus, FaTrash, FaSkull, FaDragon } from 'react-icons/fa';
import { CreaturePortrait, mod, computeEffectiveCreatureStats, RuntimeModifierPanel } from './CreatureStatBlock';
import { DndIcon } from './DndIcon';
import type { ActiveSummon, ActivePet, CreatureStatOverride, CreatureRuntimeModifier, Creature } from '../types/dnd';

/* ─── helpers ──────────────────────────────────────────────────── */
const hpColor = (pct: number) =>
    pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f0c040' : pct > 0 ? '#e67e22' : '#636e72';

const statLabel: Record<string, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR', ac: 'CA', hp: 'PF',
};

const ABIL_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type AbilKey = typeof ABIL_KEYS[number];
const ABIL_ABBR: Record<AbilKey, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};
const ABIL_ICON: Record<AbilKey, string> = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

/* ─── section label ────────────────────────────────────────────── */
export const PopupSection: React.FC<{ label: string; accent: string }> = ({ label, accent }) => (
    <div className="cpop-sec">
        <div className="cpop-sec-bar" style={{ background: accent }} />
        <span style={{ color: accent }}>{label}</span>
        <div className="cpop-sec-line" />
    </div>
);

/* ─── preview entry (non-spawned creature from catalog / personal) ── */
export interface CreaturePreviewEntry {
    id: string;
    creature: Creature;
    /** currentHp is irrelevant for preview – HP area is hidden */
    currentHp: number;
    appliedOverrides?: CreatureStatOverride[];
    runtimeModifiers?: CreatureRuntimeModifier[];
}

/* ─── popup props ──────────────────────────────────────────────── */
export interface CreaturePopupProps {
    /**
     * 'summon' / 'pet'  → active creature with HP tracking
     * 'preview'         → catalog / personal creature, no HP bar, no Tracker tab
     */
    kind: 'summon' | 'pet' | 'preview';
    entry: ActiveSummon | ActivePet | CreaturePreviewEntry;
    liveOverrides: CreatureStatOverride[];
    runtimeModifiers?: CreatureRuntimeModifier[];
    onAddRuntimeModifier?: (m: CreatureRuntimeModifier) => void;
    onRemoveRuntimeModifier?: (id: string) => void;
    onClose: () => void;
    /** If absent the Tracker tab is hidden */
    onHpDelta?: (d: number) => void;
    /** If absent the Rimuovi button in the tracker is hidden */
    onRemove?: () => void;
    onRoundDecrement?: () => void;
    /** Extra action buttons rendered above the tab bar (e.g. Evoca / Compagno) */
    extraActions?: React.ReactNode;
}

export const CreaturePopup: React.FC<CreaturePopupProps> = ({
    kind, entry, liveOverrides, runtimeModifiers = [], onAddRuntimeModifier, onRemoveRuntimeModifier,
    onClose, onHpDelta, onRemove, onRoundDecrement, extraActions,
}) => {
    const hasTracker = !!onHpDelta;
    const [dmg, setDmg] = useState('');
    const [heal, setHeal] = useState('');
    const [closing, setClosing] = useState(false);
    const [mobileTab, setMobileTab] = useState<'tracker' | 'stats' | 'mods' | 'abilities'>(
        hasTracker ? 'tracker' : 'stats',
    );

    const requestClose = () => {
        setClosing(true);
        setTimeout(() => onClose(), 210);
    };

    const cr = entry.creature;
    const eff = computeEffectiveCreatureStats(cr, liveOverrides, runtimeModifiers);
    const maxHp = eff.hp;
    const currentHp = entry.currentHp;
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const dead = currentHp <= 0 && hasTracker;
    const hc = hpColor(pct);

    const accentRgb = kind === 'pet' ? '39,174,96' : kind === 'summon' ? '155,89,182' : '201,168,76';
    const accentVar = kind === 'pet' ? 'var(--accent-success)' : kind === 'summon' ? 'var(--accent-arcane)' : 'var(--accent-gold)';

    const applyDmg = () => { const v = parseInt(dmg, 10); if (!isNaN(v) && v > 0) { onHpDelta?.(-v); setDmg(''); } };
    const applyHeal = () => { const v = parseInt(heal, 10); if (!isNaN(v) && v > 0) { onHpDelta?.(v); setHeal(''); } };

    const subtitle = kind === 'summon' && (entry as ActiveSummon).summonSpellName
        ? (entry as ActiveSummon).summonSpellName : undefined;
    const rounds = kind === 'summon' ? (entry as ActiveSummon).roundsRemaining : null;

    const hpGradient = dead
        ? '#636e72'
        : pct > 0.6 ? 'linear-gradient(90deg,#1abc6a,#2ecc71)'
            : pct > 0.3 ? 'linear-gradient(90deg,#c9a83c,#f0c040)'
                : 'linear-gradient(90deg,#a93226,#e74c3c)';

    const modColor = (val: number) => {
        const m = mod(val);
        if (m >= 4) return 'var(--accent-gold)';
        if (m >= 2) return 'var(--text-primary)';
        if (m < 0) return 'var(--accent-crimson)';
        return 'var(--text-muted)';
    };

    const statItems = [
        { cat: 'hp', icon: 'full', label: 'PF', val: String(maxHp), hi: true },
        { cat: 'attribute', icon: 'ac', label: 'CA', val: String(eff.ac), hi: true },
        { cat: 'combat', icon: 'melee', label: 'BAB', val: `+${cr.bab}`, hi: false },
        { cat: 'movement', icon: 'walking', label: 'Vel.', val: `${cr.speed}m`, hi: false },
        ...(cr.fly ? [{ cat: 'movement', icon: 'flying', label: 'Volo', val: `${cr.fly}m`, hi: false }] : []),
        ...(cr.swim ? [{ cat: 'movement', icon: 'swimming', label: 'Nuoto', val: `${cr.swim}m`, hi: false }] : []),
    ];

    const S = ({ children }: { children: string }) => (
        <PopupSection label={children} accent={accentVar} />
    );

    return createPortal(
        <div
            className={`cpop-overlay${closing ? ' closing' : ''}`}
            onClick={ev => { if (ev.target === ev.currentTarget) requestClose(); }}
        >
            <div
                className={`cpop${closing ? ' closing' : ''}`}
                style={{
                    borderColor: `rgba(${accentRgb},0.22)`,
                    boxShadow: `0 24px 72px rgba(0,0,0,0.82), 0 0 48px rgba(${accentRgb},0.08)`,
                }}
            >
                {/* ══ HEADER ══ */}
                <div
                    className="cpop-header"
                    style={{
                        background: `linear-gradient(135deg, rgba(${accentRgb},0.13) 0%, rgba(${accentRgb},0.04) 50%, transparent 100%)`,
                        borderBottom: `1px solid rgba(${accentRgb},0.15)`,
                    }}
                >
                    <div className="cpop-header-inner">
                        <div
                            className="cpop-portrait-wrap"
                            style={{
                                border: `2px solid rgba(${accentRgb},0.5)`,
                                boxShadow: `0 0 16px rgba(${accentRgb},0.28), 0 4px 14px rgba(0,0,0,0.6)`,
                            }}
                        >
                            <CreaturePortrait creature={cr} size={58} />
                        </div>
                        <div className="cpop-identity">
                            <div className="cpop-name">{cr.name}</div>
                            <div className="cpop-meta">
                                <DndIcon category="monster" name={(cr.type ?? 'beast').toLowerCase()} size={11} tinted
                                    style={{ color: 'var(--text-muted)', opacity: 0.6, flexShrink: 0 }}
                                    fallback={<FaDragon style={{ fontSize: 10, opacity: 0.5 }} />}
                                />
                                <span>{cr.size} {cr.type}{cr.subtype ? ` (${cr.subtype})` : ''} · {cr.alignment ?? 'N'}</span>
                                {subtitle && (
                                    <>
                                        <span style={{ width: 1, height: 9, background: 'rgba(255,255,255,0.15)', flexShrink: 0, display: 'inline-block' }} />
                                        <span style={{ color: accentVar }}>{subtitle}</span>
                                    </>
                                )}
                            </div>
                            <div className="cpop-badges">
                                {cr.challengeRating && (
                                    <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.32)', fontSize: '0.64rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>
                                        CR {cr.challengeRating}
                                    </span>
                                )}
                                {(cr.tags ?? []).map(t => (
                                    <span key={t} style={{ padding: '2px 7px', borderRadius: 20, background: `rgba(${accentRgb},0.1)`, border: `1px solid rgba(${accentRgb},0.26)`, fontSize: '0.62rem', color: accentVar }}>
                                        {t}
                                    </span>
                                ))}
                                {rounds != null && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.28)' }}>
                                        <span style={{ fontSize: '0.63rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>⏱ {rounds} rd</span>
                                        {onRoundDecrement && (
                                            <button className="btn-ghost" style={{ fontSize: '0.6rem', color: 'var(--accent-gold)', padding: '0 2px', lineHeight: 1 }} onClick={onRoundDecrement}>−1</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="cpop-close" onClick={requestClose}><FaTimes /></button>

                    {/* HP bar — only for active (non-preview) creatures */}
                    {hasTracker && (
                        <div className="cpop-hp-area">
                            <div className="cpop-hp-row">
                                <div className="cpop-hp-label">
                                    <DndIcon category="hp" name={dead ? 'empty' : pct > 0.5 ? 'full' : 'blood'} size={13} tinted style={{ color: hc }} />
                                    Punti Ferita
                                </div>
                                <div className="cpop-hp-val" style={{ color: dead ? 'var(--text-muted)' : hc }}>
                                    {dead
                                        ? <><FaSkull style={{ fontSize: '0.8rem' }} /> Morto</>
                                        : <>{currentHp}<span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 300, fontSize: '0.78rem', margin: '0 1px' }}>/</span>{maxHp}</>
                                    }
                                </div>
                            </div>
                            <div className="cpop-hp-track">
                                <div className="cpop-hp-fill" style={{ width: `${pct * 100}%`, background: hpGradient }} />
                            </div>
                        </div>
                    )}

                    {/* Extra actions bar (e.g. Evoca / Compagno / + Personale) */}
                    {extraActions && (
                        <div className="cpop-extra-actions">
                            {extraActions}
                        </div>
                    )}
                </div>

                {/* ══ BODY ══ */}
                <div className="cpop-body">

                    {/* Mobile tab bar */}
                    <div className="cpop-tabs">
                        {hasTracker && (
                            <button className={`cpop-tab${mobileTab === 'tracker' ? ' active' : ''}`} onClick={() => setMobileTab('tracker')}>Tracker</button>
                        )}
                        <button className={`cpop-tab${mobileTab === 'stats' ? ' active' : ''}`} onClick={() => setMobileTab('stats')}>Stats</button>
                        <button className={`cpop-tab${mobileTab === 'mods' ? ' active' : ''}`} onClick={() => setMobileTab('mods')}>
                            Modificatori
                            {(liveOverrides.length + runtimeModifiers.length) > 0 && (
                                <span className="cpop-tab-badge">{liveOverrides.length + runtimeModifiers.length}</span>
                            )}
                        </button>
                        <button className={`cpop-tab${mobileTab === 'abilities' ? ' active' : ''}`} onClick={() => setMobileTab('abilities')}>Abilità</button>
                    </div>

                    <div className="cpop-layout">

                        {/* ── LEFT COLUMN (desktop) / tab panels (mobile) ── */}
                        <div className="cpop-left">

                            {/* ① TRACKER — shown only when onHpDelta is provided */}
                            {hasTracker && (
                                <div className={`cpop-group${mobileTab === 'tracker' ? ' cpop-ms' : ''}`}>
                                    <S>Tracker</S>
                                    <div className="cpop-tracker">
                                        <div className="cpop-track-row">
                                            <div className="cpop-track-grp" style={{ borderColor: 'rgba(192,57,43,0.32)' }}>
                                                <input type="number" min={0} value={dmg} placeholder="Danno"
                                                    onChange={e => setDmg(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') applyDmg(); }}
                                                    style={{ background: 'rgba(192,57,43,0.06)' }}
                                                />
                                                <button onClick={applyDmg} style={{ background: 'rgba(192,57,43,0.15)', borderLeft: '1px solid rgba(192,57,43,0.32)', color: 'var(--accent-crimson)' }}>
                                                    <FaMinus size={8} /> Danno
                                                </button>
                                            </div>
                                            <div className="cpop-track-grp" style={{ borderColor: 'rgba(39,174,96,0.32)' }}>
                                                <input type="number" min={0} value={heal} placeholder="Cura"
                                                    onChange={e => setHeal(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') applyHeal(); }}
                                                    style={{ background: 'rgba(39,174,96,0.06)' }}
                                                />
                                                <button onClick={applyHeal} style={{ background: 'rgba(39,174,96,0.13)', borderLeft: '1px solid rgba(39,174,96,0.32)', color: 'var(--accent-success)' }}>
                                                    <FaPlus size={8} /> Cura
                                                </button>
                                            </div>
                                        </div>
                                        <div className="cpop-quick-row">
                                            <button className="cpop-quick" style={{ borderColor: 'rgba(192,57,43,0.28)', color: 'var(--accent-crimson)', background: 'rgba(192,57,43,0.08)' }} onClick={() => onHpDelta?.(-1)}>−1 PF</button>
                                            <button className="cpop-quick" style={{ borderColor: 'rgba(39,174,96,0.28)', color: 'var(--accent-success)', background: 'rgba(39,174,96,0.08)' }} onClick={() => onHpDelta?.(1)}>+1 PF</button>
                                            {onRemove && (
                                                <button
                                                    onClick={() => { onRemove(); requestClose(); }}
                                                    style={{ marginLeft: 'auto', padding: '6px 13px', borderRadius: 7, fontSize: '0.72rem', cursor: 'pointer', background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', color: 'var(--accent-crimson)', display: 'flex', alignItems: 'center', gap: 5 }}
                                                >
                                                    <FaTrash size={9} /> Rimuovi
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ② STATS — combat row + ability scores + saves + defenses */}
                            <div className={`cpop-group${mobileTab === 'stats' ? ' cpop-ms' : ''}`}>
                                <S>Statistiche</S>
                                <div className="cpop-combat">
                                    {statItems.map(s => (
                                        <div key={s.label} className={`cpop-cs${s.hi ? ' hi' : ''}`}>
                                            <DndIcon category={s.cat} name={s.icon} size={18} tinted
                                                style={{ color: s.hi ? 'var(--accent-gold)' : 'var(--text-muted)', opacity: s.hi ? 1 : 0.55, flexShrink: 0 }}
                                            />
                                            <div>
                                                <div className="cpop-cs-val" style={{ color: s.hi ? 'var(--accent-gold)' : 'var(--text-primary)' }}>{s.val}</div>
                                                <div className="cpop-cs-lbl">{s.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <S>Caratteristiche</S>
                                <div className="cpop-abilities">
                                    {ABIL_KEYS.map(s => {
                                        const base = cr[s] as number;
                                        const effVal = eff[s];
                                        const boosted = effVal !== base;
                                        return (
                                            <div key={s} className={`cpop-ab${boosted ? ' boosted' : ''}`}>
                                                <DndIcon category="ability" name={ABIL_ICON[s]} size={18} tinted
                                                    style={{ color: boosted ? (effVal > base ? 'var(--accent-success)' : 'var(--accent-crimson)') : 'var(--text-muted)', opacity: boosted ? 0.9 : 0.5, display: 'block', margin: '0 auto' }}
                                                />
                                                <div className="cpop-ab-score" style={{ color: boosted ? (effVal > base ? 'var(--accent-success)' : 'var(--accent-crimson)') : 'var(--text-primary)' }}>{effVal}</div>
                                                <div className="cpop-ab-mod" style={{ color: modColor(effVal) }}>{mod(effVal) >= 0 ? '+' : ''}{mod(effVal)}</div>
                                                <div className="cpop-ab-abbr">{ABIL_ABBR[s]}</div>
                                                {boosted && <div style={{ fontSize: '0.42rem', color: effVal > base ? 'rgba(46,204,113,0.65)' : 'rgba(192,57,43,0.65)', marginTop: 1 }}>base {base}</div>}
                                            </div>
                                        );
                                    })}
                                </div>

                                <S>Tiri Salvezza</S>
                                <div className="cpop-saves-row">
                                    {[
                                        { l: 'Tempra', v: eff.fort },
                                        { l: 'Riflessi', v: eff.reflex },
                                        { l: 'Volontà', v: eff.will },
                                    ].map(s => (
                                        <div key={s.l} className="cpop-save-pill">
                                            <div className="cpop-save-val" style={{ color: s.v >= 0 ? 'var(--text-primary)' : 'var(--accent-crimson)' }}>
                                                {s.v >= 0 ? '+' : ''}{s.v}
                                            </div>
                                            <div className="cpop-save-lbl">{s.l}</div>
                                        </div>
                                    ))}
                                </div>

                                {(cr.damageReduction || cr.spellResistance || cr.resistances || cr.immunities || cr.weaknesses) && (
                                    <>
                                        <S>Difese</S>
                                        {[
                                            cr.damageReduction && { l: 'RD', v: cr.damageReduction, c: 'var(--text-secondary)' },
                                            cr.spellResistance && { l: 'RM', v: String(cr.spellResistance), c: 'var(--text-secondary)' },
                                            cr.resistances && { l: 'Resistenze', v: cr.resistances, c: 'var(--text-secondary)' },
                                            cr.immunities && { l: 'Immunità', v: cr.immunities, c: 'var(--text-secondary)' },
                                            cr.weaknesses && { l: 'Debolezze', v: cr.weaknesses, c: 'var(--accent-crimson)' },
                                        ].filter(Boolean).map((d: any) => (
                                            <div key={d.l} className="cpop-def-item">
                                                <span style={{ fontSize: '0.57rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>{d.l}</span>
                                                <span style={{ fontSize: '0.73rem', color: d.c }}>{d.v}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {/* ③ ABILITIES — actions, special, spells, description */}
                            <div className={`cpop-group${mobileTab === 'abilities' ? ' cpop-ms' : ''}`}>
                                {(cr.actions?.length ?? 0) > 0 && (
                                    <>
                                        <S>Azioni</S>
                                        {cr.actions.map(a => (
                                            <div key={a.id} className="cpop-card">
                                                <div className="cpop-card-head">
                                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem' }}>{a.name}</span>
                                                    {a.attackBonus !== undefined && (
                                                        <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.26)', fontSize: '0.66rem', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>
                                                            {a.attackBonus >= 0 ? '+' : ''}{a.attackBonus} att.
                                                        </span>
                                                    )}
                                                    {a.damage && (
                                                        <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.26)', fontSize: '0.66rem', color: '#e74c3c', fontFamily: 'var(--font-heading)' }}>
                                                            {a.damage}{a.damageType ? ` ${a.damageType}` : ''}
                                                        </span>
                                                    )}
                                                    {a.criticalRange && a.criticalRange !== '20' && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>×{a.criticalMultiplier ?? '2'} ({a.criticalRange})</span>
                                                    )}
                                                    {a.range && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0 }}>{a.range}</span>}
                                                </div>
                                                {a.notes && <div className="cpop-card-body">{a.notes}</div>}
                                            </div>
                                        ))}
                                    </>
                                )}

                                {(cr.specialAbilities?.length ?? 0) > 0 && (
                                    <>
                                        <S>Abilità Speciali</S>
                                        {cr.specialAbilities.map(a => (
                                            <div key={a.id} className="cpop-card ability">
                                                <div className="cpop-card-head">
                                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem' }}>{a.name}</span>
                                                    <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(155,89,182,0.14)', border: '1px solid rgba(155,89,182,0.3)', fontSize: '0.58rem', color: 'var(--accent-arcane)' }}>{a.abilityType}</span>
                                                </div>
                                                {a.description && <div className="cpop-card-body">{a.description}</div>}
                                            </div>
                                        ))}
                                    </>
                                )}

                                {(cr.spellLikeAbilities?.length ?? 0) > 0 && (
                                    <>
                                        <S>Capacità Magiche</S>
                                        {cr.spellLikeAbilities!.map(s => (
                                            <div key={s.id} className="cpop-card ability">
                                                <div className="cpop-card-head">
                                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.79rem' }}>{s.name}</span>
                                                    {s.usesPerDay && <span style={{ padding: '1px 6px', borderRadius: 20, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)', fontSize: '0.62rem', color: 'var(--accent-gold)' }}>{s.usesPerDay}/giorno</span>}
                                                </div>
                                                {s.description && <div className="cpop-card-body">{s.description}</div>}
                                            </div>
                                        ))}
                                    </>
                                )}

                                {(cr.spellsKnown?.length ?? 0) > 0 && (
                                    <>
                                        <S>Incantesimi</S>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                            {cr.spellsKnown!.map(s => (
                                                <span key={s.id} style={{ padding: '3px 9px', borderRadius: 20, background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.25)', fontSize: '0.7rem', color: 'var(--accent-arcane)' }}>
                                                    {s.name}{s.level > 0 ? ` (Liv.${s.level})` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {cr.description && (
                                    <>
                                        <S>Descrizione</S>
                                        <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{cr.description}</p>
                                    </>
                                )}

                                {(cr.actions?.length ?? 0) === 0 && (cr.specialAbilities?.length ?? 0) === 0 &&
                                    (cr.spellLikeAbilities?.length ?? 0) === 0 && (cr.spellsKnown?.length ?? 0) === 0 && !cr.description && (
                                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        Nessuna abilità registrata
                                    </div>
                                )}
                            </div>

                        </div>{/* end .cpop-left */}

                        {/* ── RIGHT ASIDE (desktop) / Modificatori tab (mobile) ── */}
                        <div className={`cpop-right${mobileTab === 'mods' ? ' cpop-ms' : ''}`}>
                            {liveOverrides.length > 0 && (
                                <>
                                    <PopupSection label="Bonus Attivi" accent={accentVar} />
                                    <div className="cpop-overrides">
                                        <DndIcon category="attribute" name="bonus" size={11} tinted style={{ color: 'var(--accent-success)', alignSelf: 'center', flexShrink: 0 }} />
                                        {liveOverrides.map((o, i) => (
                                            <span key={i} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 20, background: o.value >= 0 ? 'rgba(46,204,113,0.12)' : 'rgba(192,57,43,0.12)', border: `1px solid ${o.value >= 0 ? 'rgba(46,204,113,0.3)' : 'rgba(192,57,43,0.3)'}`, color: o.value >= 0 ? 'var(--accent-success)' : 'var(--accent-crimson)' }}>
                                                {o.source} · {statLabel[o.stat] ?? o.stat} {o.value >= 0 ? '+' : ''}{o.value}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}

                            {onAddRuntimeModifier && onRemoveRuntimeModifier ? (
                                <>
                                    <PopupSection label="Modificatori Attivi" accent={accentVar} />
                                    <RuntimeModifierPanel
                                        modifiers={runtimeModifiers}
                                        onAdd={onAddRuntimeModifier}
                                        onRemove={onRemoveRuntimeModifier}
                                    />
                                </>
                            ) : liveOverrides.length === 0 && (
                                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    Nessun modificatore attivo
                                </div>
                            )}
                        </div>

                    </div>{/* end .cpop-layout */}
                </div>{/* end .cpop-body */}
            </div>
        </div>,
        document.body,
    );
};
