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

/* ─── popup section label ───────────────────────────────────────── */
const PopupSection: React.FC<{ label: string; accent: string }> = ({ label, accent }) => (
    <div className="cpop-sec">
        <div className="cpop-sec-bar" style={{ background: accent }} />
        <span style={{ color: accent }}>{label}</span>
        <div className="cpop-sec-line" />
    </div>
);

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

    const accentRgb = kind === 'summon' ? '155,89,182' : '39,174,96';
    const accentVar = kind === 'summon' ? 'var(--accent-arcane)' : 'var(--accent-success)';

    const effStat = (key: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'ac') =>
        (cr[key] as number) + liveOverrides.filter(o => o.stat === key).reduce((s, o) => s + o.value, 0);

    const applyDmg = () => { const v = parseInt(dmg, 10); if (!isNaN(v) && v > 0) { onHpDelta(-v); setDmg(''); } };
    const applyHeal = () => { const v = parseInt(heal, 10); if (!isNaN(v) && v > 0) { onHpDelta(v); setHeal(''); } };

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
        { cat: 'attribute', icon: 'ac',      label: 'CA',   val: String(effStat('ac')), hi: true },
        { cat: 'combat',    icon: 'melee',   label: 'BAB',  val: `+${cr.bab}`,          hi: false },
        { cat: 'movement',  icon: 'walking', label: 'Vel.', val: `${cr.speed}m`,        hi: false },
        ...(cr.fly  ? [{ cat: 'movement', icon: 'flying',    label: 'Volo',  val: `${cr.fly}m`,  hi: false }] : []),
        ...(cr.swim ? [{ cat: 'movement', icon: 'swimming',  label: 'Nuoto', val: `${cr.swim}m`, hi: false }] : []),
    ];

    const S = ({ children }: { children: string }) => (
        <PopupSection label={children} accent={accentVar} />
    );

    return createPortal(
        <div
            className="cpop-overlay"
            onPointerDown={ev => { if (ev.target === ev.currentTarget) onClose(); }}
        >
            <div
                className="cpop"
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
                    <button className="cpop-close" onClick={onClose}><FaTimes /></button>
                    <div className="cpop-hp-area">
                        <div className="cpop-hp-row">
                            <div className="cpop-hp-label">
                                <DndIcon category="hp" name={dead ? 'empty' : pct > 0.5 ? 'full' : 'blood'} size={13} tinted style={{ color: hc }} />
                                Punti Ferita
                            </div>
                            <div className="cpop-hp-val" style={{ color: dead ? 'var(--text-muted)' : hc }}>
                                {dead
                                    ? <><FaSkull style={{ fontSize: '0.8rem' }} /> Morto</>
                                    : <>{entry.currentHp}<span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 300, fontSize: '0.78rem', margin: '0 1px' }}>/</span>{maxHp}</>
                                }
                            </div>
                        </div>
                        <div className="cpop-hp-track">
                            <div className="cpop-hp-fill" style={{ width: `${pct * 100}%`, background: hpGradient }} />
                        </div>
                    </div>
                </div>

                {/* ══ BODY (single scrollable column) ══ */}
                <div className="cpop-body">

                    {/* ① TRACKER — most-used in combat, first */}
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
                            <button className="cpop-quick" style={{ borderColor: 'rgba(192,57,43,0.28)', color: 'var(--accent-crimson)', background: 'rgba(192,57,43,0.08)' }} onClick={() => onHpDelta(-1)}>−1 PF</button>
                            <button className="cpop-quick" style={{ borderColor: 'rgba(39,174,96,0.28)', color: 'var(--accent-success)', background: 'rgba(39,174,96,0.08)' }} onClick={() => onHpDelta(1)}>+1 PF</button>
                            <button
                                onClick={() => { onRemove(); onClose(); }}
                                style={{ marginLeft: 'auto', padding: '6px 13px', borderRadius: 7, fontSize: '0.72rem', cursor: 'pointer', background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', color: 'var(--accent-crimson)', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                                <FaTrash size={9} /> Rimuovi
                            </button>
                        </div>
                    </div>

                    {/* Override chips */}
                    {liveOverrides.length > 0 && (
                        <>
                            <S>Bonus Attivi</S>
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

                    {/* ② COMBAT STATS — compact inline row */}
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

                    {/* ③ ABILITY SCORES — full width */}
                    <S>Caratteristiche</S>
                    <div className="cpop-abilities">
                        {ABIL_KEYS.map(s => {
                            const base = cr[s] as number;
                            const eff = effStat(s);
                            const boosted = eff > base;
                            return (
                                <div key={s} className={`cpop-ab${boosted ? ' boosted' : ''}`}>
                                    <DndIcon category="ability" name={ABIL_ICON[s]} size={18} tinted
                                        style={{ color: boosted ? 'var(--accent-success)' : 'var(--text-muted)', opacity: boosted ? 0.9 : 0.5, display: 'block', margin: '0 auto' }}
                                    />
                                    <div className="cpop-ab-score" style={{ color: boosted ? 'var(--accent-success)' : 'var(--text-primary)' }}>{eff}</div>
                                    <div className="cpop-ab-mod" style={{ color: modColor(eff) }}>{mod(eff) >= 0 ? '+' : ''}{mod(eff)}</div>
                                    <div className="cpop-ab-abbr">{ABIL_ABBR[s]}</div>
                                    {boosted && <div style={{ fontSize: '0.42rem', color: 'rgba(46,204,113,0.65)', marginTop: 1 }}>base {base}</div>}
                                </div>
                            );
                        })}
                    </div>

                    {/* ④ SAVING THROWS — single inline row */}
                    <S>Tiri Salvezza</S>
                    <div className="cpop-saves-row">
                        {[
                            { l: 'Tempra',   v: cr.fortitude },
                            { l: 'Riflessi', v: cr.reflex },
                            { l: 'Volontà',  v: cr.will },
                        ].map(s => (
                            <div key={s.l} className="cpop-save-pill">
                                <div className="cpop-save-val" style={{ color: s.v >= 0 ? 'var(--text-primary)' : 'var(--accent-crimson)' }}>
                                    {s.v >= 0 ? '+' : ''}{s.v}
                                </div>
                                <div className="cpop-save-lbl">{s.l}</div>
                            </div>
                        ))}
                    </div>

                    {/* ⑤ DEFENSES */}
                    {(cr.damageReduction || cr.spellResistance || cr.resistances || cr.immunities || cr.weaknesses) && (
                        <>
                            <S>Difese</S>
                            {[
                                cr.damageReduction && { l: 'RD',         v: cr.damageReduction,         c: 'var(--text-secondary)' },
                                cr.spellResistance && { l: 'RM',         v: String(cr.spellResistance), c: 'var(--text-secondary)' },
                                cr.resistances     && { l: 'Resistenze', v: cr.resistances,             c: 'var(--text-secondary)' },
                                cr.immunities      && { l: 'Immunità',   v: cr.immunities,              c: 'var(--text-secondary)' },
                                cr.weaknesses      && { l: 'Debolezze',  v: cr.weaknesses,              c: 'var(--accent-crimson)' },
                            ].filter(Boolean).map((d: any) => (
                                <div key={d.l} className="cpop-def-item">
                                    <span style={{ fontSize: '0.57rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>{d.l}</span>
                                    <span style={{ fontSize: '0.73rem', color: d.c }}>{d.v}</span>
                                </div>
                            ))}
                        </>
                    )}

                    {/* ⑥ ACTIONS */}
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

                    {/* ⑦ SPECIAL ABILITIES */}
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

                    {/* ⑧ SPELL-LIKE ABILITIES */}
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

                    {/* ⑨ SPELLS KNOWN */}
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

                    {/* ⑩ DESCRIPTION — least urgent, last */}
                    {cr.description && (
                        <>
                            <S>Descrizione</S>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{cr.description}</p>
                        </>
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