import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaInfinity, FaSyncAlt, FaClock, FaSearch, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { GiMagicGate } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import type { CharacterPower, PowerCategory, StatType, UsageType } from '../../../types/dnd';
import { RollPickerModal, type RollSegment } from '../../RollPickerModal';

// ── constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<PowerCategory, string> = {
    INVOCATION: 'Invocazioni',
    MYSTERY: 'Misteri',
    UTTERANCE: 'Detti',
    PSIONIC: 'Psionici',
    SPELL: 'Cap. Magiche',
};

const USAGE_COLOR: Record<UsageType, string> = {
    AT_WILL: 'var(--accent-success)',
    PER_DAY: 'var(--accent-warning)',
    VANCIAN: 'var(--accent-ice)',
    SPONTANEOUS: 'var(--accent-arcane)',
    COOLDOWN: 'var(--accent-crimson)',
};

const USAGE_LABEL: Record<UsageType, string> = {
    AT_WILL: '∞',
    PER_DAY: '/g',
    VANCIAN: 'Prep.',
    SPONTANEOUS: 'Spon.',
    COOLDOWN: 'CD',
};

const STAT_LABELS: Partial<Record<StatType, string>> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function rollCooldown(p: CharacterPower): number {
    const expr = p.cooldownDice ?? '1d4';
    const m = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!m) return 1;
    let total = 0;
    for (let i = 0; i < Number(m[1]); i++) total += Math.floor(Math.random() * Number(m[2])) + 1;
    total += m[3] ? Number(m[3]) : 0;
    return Math.max(1, total);
}

const microBtn = (enabled = true): React.CSSProperties => ({
    background: 'var(--bg-card-alt)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 3,
    padding: '2px 4px',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.35,
    color: 'var(--text-secondary)',
    display: 'flex', alignItems: 'center',
    lineHeight: 1,
    flexShrink: 0,
});

// ── pip row ───────────────────────────────────────────────────────────────────

const PipRow: React.FC<{
    max: number; used: number; onRecover: (e: React.MouseEvent) => void;
}> = ({ max, used, onRecover }) => {
    const avail = max - used;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {max <= 10 ? (
                Array.from({ length: max }, (_, i) => (
                    <div key={i} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: i < used ? 'var(--text-muted)' : USAGE_COLOR.PER_DAY,
                        border: `1px solid ${USAGE_COLOR.PER_DAY}`,
                        flexShrink: 0,
                    }} />
                ))
            ) : (
                <span style={{ fontSize: '0.62rem', color: USAGE_COLOR.PER_DAY, fontWeight: 700 }}>
                    {avail}/{max}
                </span>
            )}
            <button
                onClick={onRecover}
                disabled={used <= 0}
                style={microBtn(used > 0)}
                title="Recupera uso"
            >
                <FaSyncAlt size={7} />
            </button>
        </div>
    );
};

// ── picker state type ─────────────────────────────────────────────────────────

interface PickerState {
    title: string;
    subtitle?: string;
    segments: RollSegment[];
    footer?: React.ReactNode;
    onConfirm?: () => void;
}

// ── footer builder ────────────────────────────────────────────────────────────

function buildFooter(p: CharacterPower, saveDC: number | null): React.ReactNode {
    const chips: { label: string; value: string }[] = [];
    if (p.castingTime) chips.push({ label: 'Tempo', value: p.castingTime });
    if (p.range) chips.push({ label: 'Gittata', value: p.range });
    if (p.duration) chips.push({ label: 'Durata', value: p.duration });
    if (p.components) chips.push({ label: 'Comp.', value: p.components });
    if (p.savingThrow) chips.push({
        label: 'TS',
        value: saveDC !== null ? `${p.savingThrow} CD ${saveDC}` : p.savingThrow,
    });
    if (p.baseDice && p.damageType) chips.push({ label: 'Danno', value: `${p.baseDice} ${p.damageType}` });
    else if (p.damageType) chips.push({ label: 'Tipo danno', value: p.damageType });

    if (!chips.length && !p.description) return undefined;

    return (
        <div style={{
            marginTop: 8, padding: 10, borderRadius: 8,
            background: 'rgba(162,155,254,0.05)',
            border: '1px solid rgba(162,155,254,0.2)',
            display: 'flex', flexDirection: 'column', gap: 8,
        }}>
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: '#a29bfe', fontWeight: 600 }}>
                DESCRIZIONE POTERE
            </div>
            {chips.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                    {chips.map(c => (
                        <div key={c.label} style={{
                            background: 'rgba(0,0,0,0.25)', padding: '5px 7px',
                            borderRadius: 5, border: '1px solid rgba(162,155,254,0.15)',
                        }}>
                            <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                                {c.label}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{c.value}</div>
                        </div>
                    ))}
                </div>
            )}
            {p.description && (
                <p style={{
                    margin: 0, color: 'var(--text-primary)',
                    fontSize: '0.82rem', lineHeight: 1.5,
                    whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto',
                }}>
                    {p.description}
                </p>
            )}
        </div>
    );
}

// ── PowerInfoModal ───────────────────────────────────────────────────────────

const CATEGORY_FULL: Record<PowerCategory, string> = {
    INVOCATION: 'Invocazione',
    MYSTERY: 'Mistero',
    UTTERANCE: 'Detto',
    PSIONIC: 'Psionico',
    SPELL: 'Capacità Magica',
};

const USAGE_FULL: Record<UsageType, string> = {
    AT_WILL: 'A volontà',
    PER_DAY: 'Per giorno',
    VANCIAN: 'Preparata',
    SPONTANEOUS: 'Spontanea',
    COOLDOWN: 'Ricarica',
};

const PowerInfoModal: React.FC<{ power: CharacterPower; onClose: () => void }> = ({ power, onClose }) => {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 600);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 600);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const chips: { label: string; value: string }[] = [
        power.castingTime ? { label: 'Tempo', value: power.castingTime } : null,
        power.range ? { label: 'Gittata', value: power.range } : null,
        power.duration ? { label: 'Durata', value: power.duration } : null,
        power.savingThrow ? { label: 'TS', value: power.savingThrow } : null,
        power.components ? { label: 'Comp.', value: power.components } : null,
        (power.baseDice && power.damageType)
            ? { label: 'Danno', value: `${power.baseDice} ${power.damageType}` }
            : power.baseDice
                ? { label: 'Dadi', value: power.baseDice }
                : null,
    ].filter(Boolean) as { label: string; value: string }[];

    const usageColor = USAGE_COLOR[power.usageType];

    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
    };
    const dialogStyle: React.CSSProperties = isMobile
        ? {
            width: '100%', maxHeight: '85vh',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            background: 'linear-gradient(160deg, rgba(20,16,30,0.99), rgba(14,12,22,0.99))',
            borderTop: '2px solid #a29bfe',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column',
        }
        : {
            width: 'min(440px, 100%)', maxHeight: '85vh',
            borderRadius: 12,
            background: 'linear-gradient(160deg, rgba(20,16,30,0.99), rgba(14,12,22,0.99))',
            border: '1px solid rgba(162,155,254,0.35)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.75), 0 0 0 1px rgba(162,155,254,0.12)',
            display: 'flex', flexDirection: 'column',
        };

    return createPortal(
        <div onClick={onClose} role="dialog" aria-modal="true" style={overlayStyle}>
            <div onClick={e => e.stopPropagation()} style={dialogStyle}>
                {isMobile && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
                        <span style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
                    </div>
                )}

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(162,155,254,0.18)',
                    flexShrink: 0,
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', color: '#c8c4f8' }}>
                            {power.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span>{CATEGORY_FULL[power.category]}</span>
                            {power.grade && <span>· {power.grade}</span>}
                            {power.levelEquivalent !== undefined && <span>· Lv {power.levelEquivalent}</span>}
                            <span style={{ color: usageColor }}>· {USAGE_FULL[power.usageType]}</span>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Chiudi" style={{
                        background: 'transparent', border: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        padding: 6, borderRadius: 4,
                    }}>
                        <FaTimes size={14} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Detail chips */}
                    {chips.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))',
                            gap: '6px 12px',
                            padding: '8px 10px',
                            background: 'rgba(162,155,254,0.05)',
                            borderRadius: 6,
                            border: '1px solid rgba(162,155,254,0.1)',
                        }}>
                            {chips.map(c => (
                                <div key={c.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        {c.label}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Uso info */}
                    {power.usageType === 'PER_DAY' && power.usesMax !== undefined && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px',
                            background: 'rgba(230,126,34,0.08)',
                            border: '1px solid rgba(230,126,34,0.2)',
                            borderRadius: 6,
                            fontSize: '0.78rem', color: 'var(--accent-warning)',
                        }}>
                            <span style={{ fontWeight: 700 }}>{(power.usesMax) - (power.usesUsed ?? 0)}/{power.usesMax}</span>
                            <span style={{ color: 'var(--text-muted)' }}>usi rimanenti oggi</span>
                        </div>
                    )}
                    {power.usageType === 'COOLDOWN' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px',
                            background: 'rgba(192,57,43,0.08)',
                            border: '1px solid rgba(192,57,43,0.2)',
                            borderRadius: 6,
                            fontSize: '0.78rem', color: 'var(--accent-crimson)',
                        }}>
                            {(power.cooldownRemaining ?? 0) > 0
                                ? <><span style={{ fontWeight: 700 }}>{power.cooldownRemaining}r</span><span style={{ color: 'var(--text-muted)' }}>ricarica rimanente</span></>
                                : <span>Pronto all&apos;uso</span>
                            }
                        </div>
                    )}

                    {/* Description */}
                    {power.description && (
                        <p style={{
                            margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)',
                            lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        }}>
                            {power.description}
                        </p>
                    )}

                    {!chips.length && !power.description && (
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            Nessun dettaglio disponibile.
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};

// ── main widget ───────────────────────────────────────────────────────────────

export const PowersWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const {
        character,
        usePower, recoverPower, tickPowerCooldowns,
        getStatModifier, getTotalBab, getSizeAttackModifier,
    } = useCharacterStore();
    const [q, setQ] = useState('');
    const [picker, setPicker] = useState<PickerState | null>(null);
    const [infoModal, setInfoModal] = useState<CharacterPower | null>(null);

    const powers = useMemo<CharacterPower[]>(() => character?.powers ?? [], [character]);

    const filtered = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return ql ? powers.filter(p => p.name.toLowerCase().includes(ql)) : powers;
    }, [powers, q]);

    if (!character) return null;

    const narrow = size.pixelW < 280;

    const byCategory = useMemo(() => {
        const map = new Map<PowerCategory, CharacterPower[]>();
        filtered.forEach(p => {
            const arr = map.get(p.category) ?? [];
            arr.push(p);
            map.set(p.category, arr);
        });
        return map;
    }, [filtered]);

    // ── open picker ───────────────────────────────────────────────────────────
    const openPowerPicker = (p: CharacterPower) => {
        const bab = getTotalBab();
        const sizeMod = getSizeAttackModifier();
        const mode = p.attackMode ?? 'none';
        const isRanged = mode === 'rangedTouch' || mode === 'ray';
        const atkStat: StatType = isRanged ? 'dex' : 'str';
        const atkMod = getStatModifier(atkStat);
        const totalLevel = (character.classLevels ?? []).reduce((s, cl) => s + cl.level, 0) || 1;
        const saveStat = (p.saveStat as StatType | undefined) ?? 'cha';
        const saveDC = p.savingThrow ? 10 + Math.floor(totalLevel / 2) + getStatModifier(saveStat) : null;

        const segments: RollSegment[] = [];

        // Attack segment
        if (mode !== 'none' && mode !== 'save') {
            const atkBreakdown = [
                { label: 'BAB', value: bab },
                { label: `Mod. ${STAT_LABELS[atkStat] ?? atkStat.toUpperCase()}`, value: atkMod },
                ...(sizeMod !== 0 ? [{ label: 'Mod. Taglia', value: sizeMod }] : []),
            ];
            segments.push({
                ctx: { channel: 'attack', isRanged },
                label: 'Tiro per colpire',
                baseBreakdown: atkBreakdown,
            });
        }

        // Damage segment
        if (p.baseDice) {
            segments.push({
                ctx: { channel: 'damage', isRanged },
                label: 'Danno',
                baseBreakdown: [],
                baseDice: p.baseDice,
            });
        }

        const footer = buildFooter(p, saveDC);

        const subtitle = [
            CATEGORY_LABEL[p.category],
            p.grade,
            p.levelEquivalent !== undefined ? `Lv ${p.levelEquivalent}` : undefined,
        ].filter(Boolean).join(' · ');

        const onConfirm = p.usageType === 'AT_WILL'
            ? undefined
            : p.usageType === 'COOLDOWN'
                ? () => usePower(p.id, rollCooldown(p))
                : () => usePower(p.id);

        setPicker({ title: p.name, subtitle: subtitle || undefined, segments, footer, onConfirm });
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 10, gap: 8 }}>
                {/* header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GiMagicGate size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{powers.length}</strong> poteri
                    </span>
                    {goTo && (
                        <button className="w-link" style={{ marginLeft: 'auto', fontSize: '0.65rem' }} onClick={() => goTo('powers')}>
                            Apri
                        </button>
                    )}
                </div>

                {/* search */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--bg-input)', borderRadius: 5, padding: '3px 7px',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <FaSearch size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        className="input"
                        placeholder="Cerca poteri…"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '0.72rem', color: 'var(--text-primary)', padding: 0, minWidth: 0 }}
                    />
                </div>

                {/* list */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {byCategory.size === 0 && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                            Nessun potere. Aggiungi invocazioni, misteri o capacità magiche dalla scheda Poteri.
                        </p>
                    )}

                    {Array.from(byCategory.entries()).map(([cat, catPowers]) => (
                        <div key={cat}>
                            <div style={{
                                fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em',
                                color: 'var(--text-muted)', textTransform: 'uppercase',
                                marginBottom: 3, paddingLeft: 2,
                            }}>
                                {CATEGORY_LABEL[cat]}
                            </div>

                            {catPowers.map(p => {
                                const color = USAGE_COLOR[p.usageType];
                                const usageLabel = USAGE_LABEL[p.usageType];
                                const cdRemaining = p.cooldownRemaining ?? 0;
                                const canUse = p.usageType === 'AT_WILL'
                                    || (p.usageType === 'PER_DAY' && (p.usesUsed ?? 0) < (p.usesMax ?? 1))
                                    || (p.usageType === 'COOLDOWN' && cdRemaining === 0)
                                    || p.usageType === 'VANCIAN'
                                    || p.usageType === 'SPONTANEOUS';

                                return (
                                    <div
                                        key={p.id}
                                        role="button"
                                        tabIndex={0}
                                        title={`Usa: ${p.name}`}
                                        onClick={() => openPowerPicker(p)}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openPowerPicker(p); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '5px 6px', borderRadius: 5,
                                            background: 'var(--bg-card)',
                                            border: `1px solid ${canUse ? 'var(--border-subtle)' : 'rgba(255,255,255,0.04)'}`,
                                            marginBottom: 3,
                                            cursor: 'pointer',
                                            opacity: canUse ? 1 : 0.55,
                                            transition: 'border-color 0.15s, background 0.15s',
                                        }}
                                        onMouseEnter={e => {
                                            if (canUse) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-alt)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
                                        }}
                                    >
                                        {/* usage badge */}
                                        <span style={{
                                            flexShrink: 0,
                                            fontSize: '0.58rem', fontWeight: 800,
                                            padding: '2px 5px', borderRadius: 8,
                                            background: `${color}22`, color,
                                            minWidth: 22, textAlign: 'center',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {p.usageType === 'AT_WILL' ? <FaInfinity size={8} /> : usageLabel}
                                        </span>

                                        {/* name + grade */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: '0.74rem', fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {p.name}
                                            </div>
                                            {p.grade && !narrow && (
                                                <div style={{
                                                    fontSize: '0.58rem', color: 'var(--text-muted)',
                                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                                }}>
                                                    {p.grade}
                                                </div>
                                            )}
                                        </div>

                                        {/* info button */}
                                        <button
                                            onClick={e => { e.stopPropagation(); setInfoModal(p); }}
                                            title="Dettagli"
                                            aria-label="Dettagli potere"
                                            style={{
                                                background: 'none', border: 'none',
                                                color: 'var(--text-muted)', cursor: 'pointer',
                                                padding: '3px 4px', borderRadius: 4,
                                                display: 'flex', alignItems: 'center',
                                                flexShrink: 0, opacity: 0.7,
                                                transition: 'opacity 0.15s, color 0.15s',
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#a29bfe'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                                        >
                                            <FaInfoCircle size={11} />
                                        </button>

                                        {/* runtime controls (stopPropagation: these are quick buttons, not "launch") */}
                                        {p.usageType === 'PER_DAY' && (
                                            <div onClick={e => e.stopPropagation()}>
                                                <PipRow
                                                    max={p.usesMax ?? 1}
                                                    used={p.usesUsed ?? 0}
                                                    onRecover={e => { e.stopPropagation(); recoverPower(p.id); }}
                                                />
                                            </div>
                                        )}

                                        {p.usageType === 'COOLDOWN' && cdRemaining > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={e => e.stopPropagation()}>
                                                <span style={{ fontSize: '0.63rem', color, fontWeight: 700 }}>{cdRemaining}r</span>
                                                <button
                                                    onClick={e => { e.stopPropagation(); tickPowerCooldowns(1); }}
                                                    style={microBtn()}
                                                    title="-1 round"
                                                >
                                                    <FaClock size={7} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Roll picker modal ─────────────────────────────────────────── */}
            {picker && (
                <RollPickerModal
                    title={picker.title}
                    subtitle={picker.subtitle}
                    segments={picker.segments.length > 0 ? picker.segments : undefined}
                    footer={picker.footer}
                    onConfirm={picker.onConfirm}
                    onClose={() => setPicker(null)}
                />
            )}

            {/* ── Info modal ────────────────────────────────────────────────── */}
            {infoModal && (
                <PowerInfoModal
                    power={infoModal}
                    onClose={() => setInfoModal(null)}
                />
            )}
        </>
    );
};
