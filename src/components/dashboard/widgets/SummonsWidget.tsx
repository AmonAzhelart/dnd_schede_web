import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaDragon, FaTimes, FaPlus, FaMinus, FaTrash, FaSkull } from 'react-icons/fa';
import { GiScrollUnfurled } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import { CreaturePortrait, StatBlock, signMod, mod } from '../../CreatureStatBlock';
import { DndIcon } from '../../DndIcon';
import type { ActiveSummon, ActivePet, CreatureStatOverride } from '../../../types/dnd';
import type { WidgetRenderProps } from '../widgetTypes';

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

/* ─── mini card ────────────────────────────────────────────────── */
interface CardProps {
    creature: ActiveSummon['creature'];
    label: string;
    sublabel?: string;
    currentHp: number;
    maxHp: number;
    roundsRemaining?: number | null;
    overrides: CreatureStatOverride[];
    onOpen: () => void;
    onHpDelta: (d: number) => void;
    onRemove: () => void;
    onRoundDecrement?: () => void;
    accentColor: string;
}
const MiniCard: React.FC<CardProps> = ({
    creature, label, sublabel, currentHp, maxHp, roundsRemaining,
    overrides, onOpen, onHpDelta, onRemove, onRoundDecrement, accentColor,
}) => {
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const dead = currentHp <= 0;
    const hc = hpColor(pct);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 8,
                border: `1px solid rgba(255,255,255,0.06)`,
                borderLeft: `3px solid ${dead ? 'rgba(99,110,114,0.45)' : accentColor}`,
                opacity: dead ? 0.62 : 1,
                overflow: 'hidden',
                cursor: 'pointer',
                height: 44,
                gap: 0,
                transition: 'opacity 0.15s',
            }}
            onClick={onOpen}
            title="Apri scheda completa"
        >
            {/* Portrait */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 7, paddingRight: 6 }}>
                <CreaturePortrait creature={creature} size={30} />
            </div>

            {/* Name + HP bar */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, paddingRight: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
                    <span style={{
                        fontFamily: 'var(--font-heading)', fontSize: '0.82rem',
                        color: dead ? 'var(--text-muted)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1,
                    }}>{label}</span>
                    {sublabel && (
                        <span style={{ fontSize: '0.58rem', color: accentColor, opacity: 0.85, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sublabel}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: hc, borderRadius: 3, transition: 'width 0.3s, background 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-heading)', flexShrink: 0, color: dead ? 'var(--text-muted)' : hc, lineHeight: 1 }}>
                        {dead ? <FaSkull style={{ verticalAlign: 'middle' }} /> : `${currentHp}/${maxHp}`}
                    </span>
                </div>
            </div>

            {/* CA */}
            <div style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '0 9px', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%', justifyContent: 'center',
            }}>
                <span style={{ fontSize: '0.44rem', color: 'var(--text-muted)', textTransform: 'uppercase', lineHeight: 1 }}>CA</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.92rem', color: 'var(--accent-gold)', lineHeight: 1.3 }}>{creature.ac}</span>
            </div>

            {/* Round timer (if any) */}
            {roundsRemaining != null && (
                <div style={{
                    flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '0 7px', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%', justifyContent: 'center',
                }} onClick={ev => ev.stopPropagation()}>
                    <button
                        className="btn-ghost"
                        style={{ fontSize: '0.58rem', color: 'var(--accent-gold)', padding: '2px 4px', lineHeight: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                        onClick={onRoundDecrement}
                        title="Decrementa round"
                    >
                        <span style={{ fontSize: '0.44rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>⏱</span>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.82rem', lineHeight: 1 }}>{roundsRemaining}</span>
                    </button>
                </div>
            )}

            {/* HP buttons + remove */}
            <div style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column',
                borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%',
            }} onClick={ev => ev.stopPropagation()}>
                <button
                    className="btn-ghost"
                    style={{ flex: 1, padding: '0 9px', fontSize: '0.68rem', color: 'var(--accent-success)', borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: 0, lineHeight: 1 }}
                    onClick={() => onHpDelta(1)}
                    title="+1 PF"
                >+1</button>
                <button
                    className="btn-ghost"
                    style={{ flex: 1, padding: '0 9px', fontSize: '0.68rem', color: 'var(--accent-crimson)', borderRadius: 0, lineHeight: 1 }}
                    onClick={() => onHpDelta(-1)}
                    title="-1 PF"
                >−1</button>
            </div>

            {/* Remove */}
            <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center',
                padding: '0 7px', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%',
            }} onClick={ev => ev.stopPropagation()}>
                <button
                    className="btn-ghost"
                    style={{ padding: '4px 3px', color: 'var(--text-muted)', lineHeight: 1 }}
                    onClick={onRemove}
                    title="Rimuovi"
                ><FaTimes size={9} /></button>
            </div>
        </div>
    );
};

/* ─── popup ────────────────────────────────────────────────────── */
interface PopupProps {
    kind: 'summon' | 'pet';
    entry: ActiveSummon | ActivePet;
    liveOverrides: CreatureStatOverride[];
    onClose: () => void;
    onHpDelta: (d: number) => void;
    onRemove: () => void;
    onRoundDecrement?: () => void;
}
const CreaturePopup: React.FC<PopupProps> = ({
    kind, entry, liveOverrides, onClose, onHpDelta, onRemove, onRoundDecrement,
}) => {
    const [dmg, setDmg] = useState('');
    const [heal, setHeal] = useState('');

    const cr = entry.creature;
    const maxHp = cr.hp + liveOverrides.filter(o => o.stat === 'hp').reduce((s, o) => s + o.value, 0);
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, entry.currentHp / maxHp)) : 0;
    const dead = entry.currentHp <= 0;
    const hc = hpColor(pct);

    const effStat = (key: 'str'|'dex'|'con'|'int'|'wis'|'cha'|'ac') => {
        const base = cr[key] as number;
        return base + liveOverrides.filter(o => o.stat === key).reduce((s, o) => s + o.value, 0);
    };

    const applyDmg = () => { const v = parseInt(dmg, 10); if (!isNaN(v) && v > 0) { onHpDelta(-v); setDmg(''); } };
    const applyHeal = () => { const v = parseInt(heal, 10); if (!isNaN(v) && v > 0) { onHpDelta(v); setHeal(''); } };

    const subtitle = kind === 'summon' && (entry as ActiveSummon).summonSpellName
        ? (entry as ActiveSummon).summonSpellName : undefined;
    const rounds = kind === 'summon' ? (entry as ActiveSummon).roundsRemaining : null;

    const hasRight = (cr.actions?.length ?? 0) > 0
        || (cr.specialAbilities?.length ?? 0) > 0
        || !!cr.description
        || (cr.spellsKnown?.length ?? 0) > 0
        || (cr.spellLikeAbilities?.length ?? 0) > 0;

    /* ── Compact section divider ── */
    const Divider = ({ icon, category, label }: { icon: string; category: string; label: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 }}>
            <DndIcon category={category} name={icon} size={11} tinted style={{ color: 'var(--accent-gold)', opacity: 0.75, flexShrink: 0 }} />
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,0.15)' }} />
        </div>
    );

    return createPortal(
        <div
            className="modal-overlay"
            style={{ zIndex: 2000, padding: '12px' }}
            onPointerDown={ev => { if (ev.target === ev.currentTarget) onClose(); }}
        >
            <div className="modal-box" style={{
                width: '100%', maxWidth: 820, maxHeight: '94dvh',
                display: 'flex', flexDirection: 'column',
                padding: 0, overflow: 'hidden',
            }}>

                {/* ══ HEADER ══ */}
                <div style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '14px 16px 12px',
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, transparent 55%)',
                    borderBottom: '1px solid rgba(201,168,76,0.14)',
                    flexShrink: 0,
                }}>
                    <div style={{ borderRadius: 9, overflow: 'hidden', border: '2px solid rgba(201,168,76,0.32)', flexShrink: 0, boxShadow: '0 3px 12px rgba(0,0,0,0.5)' }}>
                        <CreaturePortrait creature={cr} size={62} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.28rem', lineHeight: 1.1, letterSpacing: '0.02em' }}>{cr.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                            <DndIcon category="monster" name={(cr.type ?? 'beast').toLowerCase()} size={12} tinted
                                style={{ color: 'var(--text-muted)', opacity: 0.7 }}
                                fallback={<FaDragon style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }} />}
                            />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {cr.size} {cr.type}{cr.subtype ? ` (${cr.subtype})` : ''} · {cr.alignment ?? 'N'}
                            </span>
                            {subtitle && <>
                                <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', opacity: 0.5 }}>|</span>
                                <DndIcon category="spell" name="evocation" size={10} tinted style={{ color: 'var(--accent-arcane)' }}
                                    fallback={<span style={{ fontSize: 9, color: 'var(--accent-arcane)' }}>✦</span>} />
                                <span style={{ fontSize: '0.65rem', color: 'var(--accent-arcane)' }}>{subtitle}</span>
                            </>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                            {cr.challengeRating && <span className="badge-cr">CR {cr.challengeRating}</span>}
                            {(cr.tags ?? []).map(t => <span key={t} className="badge-type" style={{ opacity: 0.75 }}>{t}</span>)}
                            {rounds != null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 20, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}>
                                    <DndIcon category="combat" name="round" size={10} tinted style={{ color: 'var(--accent-gold)' }} />
                                    <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>{rounds} round</span>
                                    {onRoundDecrement && <button className="btn-ghost" style={{ fontSize: '0.58rem', color: 'var(--accent-gold)', padding: '0 3px', lineHeight: 1 }} onClick={onRoundDecrement}>−1</button>}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-ghost" style={{ flexShrink: 0, fontSize: '0.95rem', padding: '4px 6px' }}><FaTimes /></button>
                </div>

                {/* ══ BODY (2-col on wide) ══ */}
                <div style={{
                    overflowY: 'auto', flex: 1,
                    display: 'grid',
                    gridTemplateColumns: hasRight ? 'minmax(260px, 1fr) minmax(240px, 1.1fr)' : '1fr',
                    gap: 0,
                }}>

                    {/* ── LEFT: stats + tracker ── */}
                    <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 0, borderRight: hasRight ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>

                        {/* Override chips */}
                        {liveOverrides.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', borderRadius: 7, background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.16)', marginBottom: 10 }}>
                                <DndIcon category="attribute" name="bonus" size={11} tinted style={{ color: 'var(--accent-success)', alignSelf: 'center' }} />
                                {liveOverrides.map((o, i) => (
                                    <span key={i} style={{ fontSize: '0.65rem', padding: '1px 7px', borderRadius: 4, background: o.value >= 0 ? 'rgba(46,204,113,0.14)' : 'rgba(231,76,60,0.14)', border: `1px solid ${o.value >= 0 ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}`, color: o.value >= 0 ? 'var(--accent-success)' : 'var(--accent-crimson)' }}>
                                        {o.source} · {statLabel[o.stat] ?? o.stat} {o.value >= 0 ? '+' : ''}{o.value}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* HP */}
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <DndIcon category="hp" name={dead ? 'empty' : pct > 0.5 ? 'full' : 'blood'} size={13} tinted style={{ color: hc }} />
                                <span style={{ flex: 1, fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Punti Ferita</span>
                                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.88rem', color: dead ? 'var(--text-muted)' : hc }}>
                                    {dead ? <><FaSkull style={{ verticalAlign: 'middle', marginRight: 3 }} />Morto</> : `${entry.currentHp} / ${maxHp}`}
                                </span>
                            </div>
                            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct * 100}%`, background: hc, borderRadius: 4, transition: 'width 0.3s, background 0.3s' }} />
                            </div>
                        </div>

                        {/* Combat stats: CA / BAB / VEL / VOLO */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${2 + (cr.fly ? 1 : 0) + (cr.swim ? 1 : 0)}, 1fr)`, gap: 5, marginBottom: 0 }}>
                            {[
                                { icon: 'ac', cat: 'attribute', label: 'CA', val: String(effStat('ac')), gold: true },
                                { icon: 'melee', cat: 'combat', label: 'BAB', val: `+${cr.bab}`, gold: false },
                                { icon: 'walking', cat: 'movement', label: 'Vel.', val: `${cr.speed}m`, gold: false },
                                ...(cr.fly ? [{ icon: 'flying', cat: 'movement', label: 'Volo', val: `${cr.fly}m`, gold: false }] : []),
                                ...(cr.swim ? [{ icon: 'swimming', cat: 'movement', label: 'Nuoto', val: `${cr.swim}m`, gold: false }] : []),
                            ].map(s => (
                                <div key={s.label} style={{ background: s.gold ? 'rgba(201,168,76,0.07)' : 'var(--bg-surface)', borderRadius: 7, padding: '7px 4px', textAlign: 'center', border: `1px solid ${s.gold ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                                    <DndIcon category={s.cat} name={s.icon} size={16} tinted style={{ color: s.gold ? 'var(--accent-gold)' : 'var(--text-muted)', marginBottom: 2 }} />
                                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: s.gold ? 'var(--accent-gold)' : 'var(--text-primary)', lineHeight: 1 }}>{s.val}</div>
                                    <div style={{ fontSize: '0.48rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Ability scores */}
                        <Divider icon="strength" category="ability" label="Caratteristiche" />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                            {ABIL_KEYS.map(s => {
                                const base = cr[s] as number;
                                const eff = effStat(s);
                                const m = mod(eff);
                                const boosted = eff > base;
                                return (
                                    <div key={s} style={{ background: boosted ? 'rgba(46,204,113,0.07)' : 'var(--bg-surface)', borderRadius: 7, padding: '7px 2px', textAlign: 'center', border: `1px solid ${boosted ? 'rgba(46,204,113,0.22)' : 'rgba(255,255,255,0.05)'}` }}>
                                        <DndIcon category="ability" name={ABIL_ICON[s]} size={18} tinted style={{ color: boosted ? 'var(--accent-success)' : 'var(--text-muted)', marginBottom: 3 }} />
                                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.98rem', lineHeight: 1, color: boosted ? 'var(--accent-success)' : 'var(--text-primary)' }}>{eff}</div>
                                        <div style={{ fontSize: '0.62rem', color: m < 0 ? 'var(--accent-crimson)' : m >= 2 ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.4 }}>{signMod(eff)}</div>
                                        <div style={{ fontSize: '0.44rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{ABIL_ABBR[s]}</div>
                                        {boosted && <div style={{ fontSize: '0.44rem', color: 'var(--accent-success)', marginTop: 1 }}>base {base}</div>}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Saves */}
                        <Divider icon="saving-throw" category="attribute" label="Tiri Salvezza" />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                            {[
                                { l: 'Tempra', v: cr.fortitude, icon: 'constitution' },
                                { l: 'Riflessi', v: cr.reflex, icon: 'dexterity' },
                                { l: 'Volontà', v: cr.will, icon: 'wisdom' },
                            ].map(s => (
                                <div key={s.l} style={{ background: 'var(--bg-surface)', borderRadius: 7, padding: '7px 4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <DndIcon category="ability" name={s.icon} size={14} tinted style={{ color: 'var(--text-muted)', opacity: 0.65, marginBottom: 3 }} />
                                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{s.v >= 0 ? '+' : ''}{s.v}</div>
                                    <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.l}</div>
                                </div>
                            ))}
                        </div>

                        {/* Tracker */}
                        <Divider icon="target" category="combat" label="Tracker" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <input type="number" min={0} value={dmg} onChange={e => setDmg(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') applyDmg(); }} placeholder="Danno"
                                        style={{ flex: 1, background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 5, padding: '5px 7px', color: 'var(--text-primary)', fontSize: '0.8rem', minWidth: 0 }} />
                                    <button onClick={applyDmg} style={{ padding: '5px 8px', background: 'rgba(231,76,60,0.14)', border: '1px solid rgba(231,76,60,0.32)', borderRadius: 5, color: 'var(--accent-crimson)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                                        <FaMinus size={7} /> Danno
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <input type="number" min={0} value={heal} onChange={e => setHeal(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') applyHeal(); }} placeholder="Cura"
                                        style={{ flex: 1, background: 'rgba(46,204,113,0.07)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: 5, padding: '5px 7px', color: 'var(--text-primary)', fontSize: '0.8rem', minWidth: 0 }} />
                                    <button onClick={applyHeal} style={{ padding: '5px 8px', background: 'rgba(46,204,113,0.11)', border: '1px solid rgba(46,204,113,0.27)', borderRadius: 5, color: 'var(--accent-success)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                                        <FaPlus size={7} /> Cura
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button onClick={() => onHpDelta(-1)} className="btn-ghost" style={{ fontSize: '0.72rem', padding: '3px 9px', border: '1px solid rgba(231,76,60,0.22)', borderRadius: 5, color: 'var(--accent-crimson)' }}>−1 PF</button>
                                <button onClick={() => onHpDelta(1)} className="btn-ghost" style={{ fontSize: '0.72rem', padding: '3px 9px', border: '1px solid rgba(46,204,113,0.22)', borderRadius: 5, color: 'var(--accent-success)' }}>+1 PF</button>
                                <button onClick={() => { onRemove(); onClose(); }} style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '3px 9px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.28)', borderRadius: 5, color: 'var(--accent-crimson)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <FaTrash size={8} /> Rimuovi
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: actions / abilities / description ── */}
                    {hasRight && (
                        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>

                            {/* Description */}
                            {cr.description && (
                                <>
                                    <Divider icon="vision" category="attribute" label="Descrizione" />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{cr.description}</p>
                                </>
                            )}

                            {/* Defenses */}
                            {(cr.damageReduction || cr.spellResistance || cr.resistances || cr.immunities || cr.weaknesses) && (
                                <>
                                    <Divider icon="ac" category="attribute" label="Difese" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {cr.damageReduction && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RD </span>{cr.damageReduction}</div>}
                                        {cr.spellResistance && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>RM </span>{cr.spellResistance}</div>}
                                        {cr.resistances && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resistenze </span>{cr.resistances}</div>}
                                        {cr.immunities && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Immunità </span>{cr.immunities}</div>}
                                        {cr.weaknesses && <div style={{ fontSize: '0.72rem', color: 'var(--accent-crimson)' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debolezze </span>{cr.weaknesses}</div>}
                                    </div>
                                </>
                            )}

                            {/* Actions */}
                            {(cr.actions?.length ?? 0) > 0 && (
                                <>
                                    <Divider icon="action" category="combat" label="Azioni" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {cr.actions.map(a => (
                                            <div key={a.id} style={{ background: 'var(--bg-surface)', borderRadius: 7, padding: '7px 9px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: a.notes ? 3 : 0 }}>
                                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--text-primary)' }}>{a.name}</span>
                                                    {a.attackBonus !== undefined && (
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)', borderRadius: 4, padding: '1px 5px' }}>
                                                            {a.attackBonus >= 0 ? '+' : ''}{a.attackBonus} att.
                                                        </span>
                                                    )}
                                                    {a.damage && (
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-crimson)', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 4, padding: '1px 5px' }}>
                                                            {a.damage}{a.damageType ? ` ${a.damageType}` : ''}
                                                        </span>
                                                    )}
                                                    {a.criticalRange && a.criticalRange !== '20' && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>×{a.criticalMultiplier ?? '2'} ({a.criticalRange})</span>
                                                    )}
                                                    {a.range && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{a.range}</span>
                                                    )}
                                                </div>
                                                {a.notes && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.notes}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Special abilities */}
                            {(cr.specialAbilities?.length ?? 0) > 0 && (
                                <>
                                    <Divider icon="skillcheck" category="attribute" label="Abilità Speciali" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {cr.specialAbilities.map(a => (
                                            <div key={a.id} style={{ background: 'var(--bg-surface)', borderRadius: 7, padding: '7px 9px', border: '1px solid rgba(155,89,182,0.14)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: a.description ? 3 : 0 }}>
                                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--text-primary)' }}>{a.name}</span>
                                                    <span style={{ fontSize: '0.58rem', color: 'var(--accent-arcane)', background: 'rgba(155,89,182,0.12)', border: '1px solid rgba(155,89,182,0.25)', borderRadius: 3, padding: '1px 5px' }}>{a.abilityType}</span>
                                                </div>
                                                {a.description && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{a.description}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Spell-like abilities */}
                            {(cr.spellLikeAbilities?.length ?? 0) > 0 && (
                                <>
                                    <Divider icon="evocation" category="spell" label="Capacità Magiche" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {cr.spellLikeAbilities!.map(s => (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 7, padding: '5px 8px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid rgba(155,89,182,0.1)' }}>
                                                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.76rem' }}>{s.name}</span>
                                                {s.usesPerDay && <span style={{ fontSize: '0.6rem', color: 'var(--accent-gold)' }}>{s.usesPerDay}/giorno</span>}
                                                {s.description && <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.description}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Spells known */}
                            {(cr.spellsKnown?.length ?? 0) > 0 && (
                                <>
                                    <Divider icon="evocation" category="spell" label="Incantesimi" />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {cr.spellsKnown!.map(s => (
                                            <span key={s.id} style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.22)', color: 'var(--accent-arcane)' }}>
                                                {s.name}{s.level > 0 ? ` (Liv.${s.level})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};

/* =================================================================
   SummonsWidget
================================================================= */
export const SummonsWidget: React.FC<WidgetRenderProps> = ({ goTo }) => {
    const {
        character,
        removeSummon, updateSummonHp, updateSummon,
        updatePetHp, removePet,
        computeSummonOverrides, computePetOverrides,
    } = useCharacterStore();

    const summons = character?.activeSummons ?? [];
    const pets = character?.activePets ?? [];

    type PopupState =
        | { kind: 'summon'; id: string }
        | { kind: 'pet'; id: string }
        | null;

    const [popup, setPopup] = useState<PopupState>(null);

    if (summons.length === 0 && pets.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)' }}>
                <FaDragon style={{ fontSize: 28, opacity: 0.35 }} />
                <span style={{ fontSize: '0.78rem' }}>Nessuna evocazione attiva</span>
                {goTo && (
                    <button className="btn-secondary text-xs" onClick={() => goTo('bestiary')}>Apri Bestiario</button>
                )}
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflowY: 'auto', padding: '8px 10px' }}>
                {summons.length > 0 && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                            <div style={{ flex: 1, height: 1, background: 'rgba(155,89,182,0.22)' }} />
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-arcane)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Evocazioni</span>
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-arcane)', background: 'rgba(155,89,182,0.14)', border: '1px solid rgba(155,89,182,0.28)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>{summons.length}</span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(155,89,182,0.22)' }} />
                        </div>
                        {summons.map(s => {
                            const liveOv = computeSummonOverrides(s.creature);
                            const maxHp = s.creature.hp + liveOv.filter(o => o.stat === 'hp').reduce((a, o) => a + o.value, 0);
                            return (
                                <MiniCard
                                    key={s.id}
                                    creature={s.creature}
                                    label={s.creature.name}
                                    sublabel={s.summonSpellName}
                                    currentHp={s.currentHp}
                                    maxHp={maxHp}
                                    roundsRemaining={s.roundsRemaining}
                                    overrides={liveOv}
                                    accentColor="var(--accent-arcane)"
                                    onOpen={() => setPopup({ kind: 'summon', id: s.id })}
                                    onHpDelta={d => updateSummonHp(s.id, d)}
                                    onRemove={() => removeSummon(s.id)}
                                    onRoundDecrement={() => updateSummon({ ...s, roundsRemaining: Math.max(0, (s.roundsRemaining ?? 0) - 1) })}
                                />
                            );
                        })}
                    </>
                )}

                {pets.length > 0 && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: summons.length > 0 ? 4 : 0, marginBottom: 1 }}>
                            <div style={{ flex: 1, height: 1, background: 'rgba(39,174,96,0.22)' }} />
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Compagni</span>
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-success)', background: 'rgba(39,174,96,0.14)', border: '1px solid rgba(39,174,96,0.28)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>{pets.length}</span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(39,174,96,0.22)' }} />
                        </div>
                        {pets.map(p => {
                            const liveOv = computePetOverrides(p.creature);
                            const maxHp = p.creature.hp + liveOv.filter(o => o.stat === 'hp').reduce((a, o) => a + o.value, 0);
                            return (
                                <MiniCard
                                    key={p.id}
                                    creature={p.creature}
                                    label={p.nickname ?? p.creature.name}
                                    currentHp={p.currentHp}
                                    maxHp={maxHp}
                                    overrides={liveOv}
                                    accentColor="var(--accent-success)"
                                    onOpen={() => setPopup({ kind: 'pet', id: p.id })}
                                    onHpDelta={d => updatePetHp(p.id, d)}
                                    onRemove={() => removePet(p.id)}
                                />
                            );
                        })}
                    </>
                )}

                {goTo && (
                    <button className="btn-secondary text-xs" style={{ marginTop: 4 }} onClick={() => goTo('bestiary')}>
                        <GiScrollUnfurled /> Bestiario completo
                    </button>
                )}
            </div>

            {/* Popup */}
            {popup && (() => {
                const closePopup = () => setPopup(null);
                if (popup.kind === 'summon') {
                    const s = summons.find(x => x.id === popup.id);
                    if (!s) { closePopup(); return null; }
                    const liveOv = computeSummonOverrides(s.creature);
                    return (
                        <CreaturePopup
                            kind="summon"
                            entry={s}
                            liveOverrides={liveOv}
                            onClose={closePopup}
                            onHpDelta={d => updateSummonHp(s.id, d)}
                            onRemove={() => removeSummon(s.id)}
                            onRoundDecrement={() => updateSummon({ ...s, roundsRemaining: Math.max(0, (s.roundsRemaining ?? 0) - 1) })}
                        />
                    );
                } else {
                    const p = pets.find(x => x.id === popup.id);
                    if (!p) { closePopup(); return null; }
                    const liveOv = computePetOverrides(p.creature);
                    return (
                        <CreaturePopup
                            kind="pet"
                            entry={p}
                            liveOverrides={liveOv}
                            onClose={closePopup}
                            onHpDelta={d => updatePetHp(p.id, d)}
                            onRemove={() => removePet(p.id)}
                        />
                    );
                }
            })()}
        </>
    );
};