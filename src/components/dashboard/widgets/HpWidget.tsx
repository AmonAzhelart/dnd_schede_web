import React, { useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { GiDeathSkull } from 'react-icons/gi';
import { useModifierAura } from './ModifierAura';

/* ── State helpers ──────────────────────────────────────────────────────── */
interface HpState { label: string; cls: string; color: string; glow: string }

const getHpState = (pct: number, dying: boolean): HpState => {
    if (dying) return { label: 'MORENTE',   cls: 'dying',    color: '#c0392b', glow: '#ff4040' };
    if (pct > 0.75) return { label: 'IN FORZA',  cls: 'healthy',  color: '#2ecc71', glow: '#7dffaa' };
    if (pct > 0.5)  return { label: 'FERITO',     cls: 'wounded',  color: '#f0c040', glow: '#ffe480' };
    if (pct > 0.25) return { label: 'F. GRAVE',   cls: 'hurt',     color: '#e67e22', glow: '#ffb060' };
    return              { label: 'CRITICO',   cls: 'critical', color: '#e74c3c', glow: '#ff7070' };
};

const signedFmt = (n: number) => (n > 0 ? `+${n}` : String(n));

/* ── Heart SVG path (normalized 0-100 viewBox) ───────────────────────── */
// Classic heart: two arcs for the top bumps, pointed bottom
const HEART_PATH =
    'M50,30 C50,27 45,15 30,15 C10,15 10,37.5 10,37.5 C10,55 30,67 50,90 C70,67 90,55 90,37.5 C90,37.5 90,15 70,15 C55,15 50,27 50,30 Z';

/* ── Liquid wave path — period 50 svg units, fills downward to y=101 ─── */
const createWavePath = (y: number, amp = 2.5) =>
    `M -100 ${y} ` +
    `C -87.5 ${y - amp} -62.5 ${y + amp} -50 ${y} ` +
    `C -37.5 ${y - amp} -12.5 ${y + amp} 0 ${y} ` +
    `C 12.5 ${y - amp} 37.5 ${y + amp} 50 ${y} ` +
    `C 62.5 ${y - amp} 87.5 ${y + amp} 100 ${y} ` +
    `C 112.5 ${y - amp} 137.5 ${y + amp} 150 ${y} ` +
    `C 162.5 ${y - amp} 187.5 ${y + amp} 200 ${y} ` +
    `L 200 101 L -100 101 Z`;

export const HpWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const { character, getEffectiveStat, setCharacter } = useCharacterStore();
    const hpAura = useModifierAura('hp');
    const [flashCls, setFlashCls] = useState('');
    const prevHp = useRef<number | null>(null);
    const uid = React.useId().replace(/:/g, '');

    const currentHp = character?.hpDetails?.current ?? character?.baseStats.hp ?? 0;
    const maxHp = character ? (character.hpDetails?.max ?? getEffectiveStat('hp')) : 0;

    useEffect(() => {
        if (!character) return;
        if (prevHp.current !== null && prevHp.current !== currentHp) {
            const cls = currentHp < prevHp.current ? 'hp-flash-dmg' : 'hp-flash-heal';
            setFlashCls(cls);
            const t = setTimeout(() => setFlashCls(''), 700);
            prevHp.current = currentHp;
            return () => clearTimeout(t);
        }
        prevHp.current = currentHp;
    }, [currentHp, character]);

    if (!character) return null;

    const tempHp = character.hpDetails?.tempHp ?? 0;
    /* Positive HP modifier acts as bonus temporary hit points (spectral). */
    const tmpFromMod = hpAura.delta > 0 ? hpAura.delta : 0;
    /* Negative HP modifier still shows the regular malus aura on the value. */
    const malusOnHp = hpAura.delta < 0;
    const totalTempHp = tempHp + tmpFromMod;
    const nonLethal = character.hpDetails?.nonLethal ?? 0;
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const isDying = currentHp <= 0;
    const st = getHpState(pct, isDying);

    const adjust = (delta: number) => {
        const max = character.hpDetails?.max ?? getEffectiveStat('hp');
        const hpDetails = character.hpDetails ?? {};

        /* Healing: simply raise current HP, capped at max. */
        if (delta >= 0) {
            const newHp = Math.min(max, currentHp + delta);
            setCharacter({ ...character, hpDetails: { ...hpDetails, current: newHp, max } });
            return;
        }

        /* Damage: absorb into temp HP first, then into modifier-granted temp,
           then into current HP. Drain positive 'hp' active modifiers in
           insertion order; remove them as soon as they hit zero. All updates
           are applied in a single atomic setCharacter so they don't overwrite
           each other. */
        let damage = -delta;
        let nextTempHp = tempHp;
        if (nextTempHp > 0) {
            const absorbed = Math.min(nextTempHp, damage);
            nextTempHp -= absorbed;
            damage -= absorbed;
        }

        let nextActiveMods = character.activeModifiers ?? [];
        if (damage > 0 && nextActiveMods.length > 0) {
            const updated: typeof nextActiveMods = [];
            for (const m of nextActiveMods) {
                if (damage <= 0 || m.target !== 'hp' || m.value <= 0 || m.paused) {
                    updated.push(m);
                    continue;
                }
                const absorbed = Math.min(m.value, damage);
                damage -= absorbed;
                const newValue = m.value - absorbed;
                if (newValue > 0) updated.push({ ...m, value: newValue });
                /* else: drop the modifier entirely */
            }
            nextActiveMods = updated;
        }

        const newHp = Math.max(-10, currentHp - damage);
        setCharacter({
            ...character,
            hpDetails: { ...hpDetails, current: newHp, max, tempHp: nextTempHp },
            activeModifiers: nextActiveMods,
        });
    };

    const compact = size.pixelH < 180 || size.pixelW < 190;

    /* ── Compact bar layout ─────────────────────────────────────────── */
    if (compact) {
        return (
            <div className={`w-hp3 compact ${st.cls} ${flashCls} ${tmpFromMod > 0 ? 'is-spectral' : ''}`}
                style={{ '--hpc': st.color, '--hpg': st.glow } as React.CSSProperties}>
                <div className="w-hp3-bar-row">
                    <div className="w-hp3-nums-c">
                        <span className={`w-hp3-cur-c ${malusOnHp ? 'w-mod-aura-malus' : ''}`}>{currentHp}</span>
                        <span className="w-hp3-sep-c">/{maxHp}</span>
                        {totalTempHp > 0 && <span className="w-hp3-tag temp inline">+{totalTempHp}</span>}
                    </div>
                    <div className="w-hp3-track">
                        <div className="w-hp3-fill" style={{ width: `${pct * 100}%` }} />
                    </div>
                </div>
                <div className="w-hp3-btns">
                    {[-1, +1].map(d => (
                        <button key={d} className={`w-hp3-btn ${d < 0 ? 'neg' : 'pos'}`} onClick={() => adjust(d)}>
                            {signedFmt(d)}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    /* ── Heart gauge layout ─────────────────────────────────────────── */
    const big = size.size === 'lg' || size.size === 'xl';
    const hSize = big ? 180 : 148;   // heart SVG square size
    const buttons = big ? [-10, -5, -1, +1, +5, +10] : [-5, -1, +1, +5];

    // The heart fill: a rect from the bottom up; fill percentage mapped to
    // the heart's vertical extent (roughly 10–90 in our 100-unit space).
    // fillY goes from 90 (empty) to 10 (full). fillHeight covers the rest.
    const fillTopPct = 1 - pct;  // 0 = full, 1 = empty
    const heartTop = 15;          // top extent of heart (path top is ~15)
    const heartBot = 91;          // bottom extent (pointed tip at ~90)
    const heartH = heartBot - heartTop;
    const fillY = heartTop + heartH * fillTopPct;

    const clipId   = `${uid}clip`;
    const gradFillId = `${uid}gf`;
    const gradGlowId = `${uid}gg`;
    const filterId = `${uid}fl`;
    /* When the spectral shield is active, expand the SVG viewBox around the
       heart so the shield silhouette has room to surround it without clipping.
       Render size stays close to the original — we just give the artwork more
       canvas. */
    const shieldOn = tmpFromMod > 0;
    const stageSize = shieldOn ? Math.round(hSize * 1.08) : hSize;
    const viewBox = shieldOn ? '-9 -6 118 113' : '0 0 100 100';

    return (
        <div className={`w-hp3 ring ${st.cls} ${flashCls} ${tmpFromMod > 0 ? 'is-spectral' : ''}`}
            style={{ '--hpc': st.color, '--hpg': st.glow } as React.CSSProperties}>

            {/* ── Status label — above the heart ───────────────── */}
            <div className="w-hp3-status-row">
                {isDying
                    ? <GiDeathSkull className="w-hp3-status-icon skull" />
                    : null
                }
                <span className={`w-hp3-stlabel-top ${st.cls}`}>{st.label}</span>
            </div>

            {/* ── Heart stage ──────────────────────────────────────── */}
            <div className="w-hp3-stage">
                <div className={`w-hp3-gauge ${flashCls}`} style={{ width: stageSize, height: stageSize }}>
                    <svg
                        className="w-hp3-svg"
                        width={stageSize} height={stageSize}
                        viewBox={viewBox}
                    >
                        <defs>
                            <clipPath id={clipId}>
                                <path d={HEART_PATH} />
                            </clipPath>
                            <linearGradient id={gradFillId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={st.glow} />
                                <stop offset="100%" stopColor={st.color} />
                            </linearGradient>
                            <linearGradient id={gradGlowId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={st.glow} stopOpacity="0.35" />
                                <stop offset="100%" stopColor={st.color} stopOpacity="0.12" />
                            </linearGradient>
                            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            {tmpFromMod > 0 && (
                                <linearGradient id="sheenGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#bfefff" stopOpacity="0" />
                                    <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
                                    <stop offset="100%" stopColor="#bfefff" stopOpacity="0" />
                                </linearGradient>
                            )}
                        </defs>

                        {/* Outer glow heart (no clip) */}
                        <path d={HEART_PATH}
                            fill="none"
                            stroke={st.color}
                            strokeWidth="1.5"
                            opacity="0.25"
                            style={{ filter: `drop-shadow(0 0 6px ${st.glow})` }}
                        />

                        {/* Heart interior — dark bg + liquid fill */}
                        <g clipPath={`url(#${clipId})`}>
                            <path d={HEART_PATH} fill="rgba(0,0,0,0.55)" />

                            {pct > 0 && (
                                <>
                                    {/* Rect fill body — transitions smoothly on HP change */}
                                    <rect
                                        x="-5" y={fillY + 2.5} width="110"
                                        height={Math.max(0, 102 - fillY)}
                                        fill={`url(#${gradFillId})`}
                                        opacity="0.38"
                                        style={{ transition: 'y 0.6s cubic-bezier(0.65,0,0.35,1), height 0.6s cubic-bezier(0.65,0,0.35,1)' }}
                                    />

                                    {/* Wave 1 — primary liquid surface */}
                                    <g opacity="0.55">
                                        {/* @ts-ignore – SMIL animateTransform */}
                                        <animateTransform attributeName="transform" type="translate" from="0 0" to="-50 0" dur="2.8s" repeatCount="indefinite" />
                                        <path d={createWavePath(fillY, 2.5)} fill={`url(#${gradFillId})`} />
                                    </g>

                                    {/* Wave 2 — glow shimmer, offset phase */}
                                    <g opacity="0.22">
                                        {/* @ts-ignore – SMIL animateTransform */}
                                        <animateTransform attributeName="transform" type="translate" from="-25 0" to="-75 0" dur="4.2s" repeatCount="indefinite" />
                                        <path d={createWavePath(fillY, 4)} fill={st.glow} />
                                    </g>
                                </>
                            )}
                        </g>

                        {/* Outline heart */}
                        <path d={HEART_PATH}
                            fill="none"
                            stroke={st.color}
                            strokeWidth="2"
                            filter={`url(#${filterId})`}
                        />

                        {/* Temp HP thin outline (suppressed when the spectral
                            shield is active to keep the heart silhouette clean). */}
                        {totalTempHp > 0 && tmpFromMod === 0 && (
                            <path d={HEART_PATH}
                                fill="none"
                                stroke="#5bc0de"
                                strokeWidth="3"
                                strokeDasharray="4 3"
                                opacity="0.65"
                            />
                        )}

                        {/* Spectral shield wrapping the heart when an active
                            modifier is granting bonus (temporary) hit points.
                            Drawn in the expanded viewBox coordinate space so it
                            sits OUTSIDE the heart's 0..100 bounds. */}
                        {shieldOn && (
                            <>
                                {/* Outer shield silhouette — translucent */}
                                <path
                                    d="M50 0 C30 4, 14 9, -2 13 C-2 38, 6 66, 50 106 C94 66, 102 38, 102 13 C86 9, 70 4, 50 0 Z"
                                    fill="rgba(126, 224, 255, 0.10)"
                                    stroke="#7ee0ff"
                                    strokeWidth="1.4"
                                    strokeLinejoin="round"
                                    opacity="0.9"
                                    style={{ filter: 'drop-shadow(0 0 4px #7ee0ff) drop-shadow(0 0 10px #5bc0de)' }}
                                >
                                    <animate attributeName="opacity" values="0.6;1;0.6" dur="2.8s" repeatCount="indefinite" />
                                </path>
                                {/* Inner rim */}
                                <path
                                    d="M50 5 C32 8, 17 13, 3 16 C3 38, 11 62, 50 100 C89 62, 97 38, 97 16 C83 13, 68 8, 50 5 Z"
                                    fill="none"
                                    stroke="#bfefff"
                                    strokeWidth="0.5"
                                    opacity="0.55"
                                />
                                {/* Vertical heraldic seam */}
                                <line x1="50" y1="1" x2="50" y2="104"
                                    stroke="#bfefff" strokeWidth="0.4"
                                    strokeDasharray="1.5 2" opacity="0.45" />
                                {/* Light sheen sweeping across the shield */}
                                <path
                                    d="M50 0 C30 4, 14 9, -2 13 C-2 38, 6 66, 50 106 C94 66, 102 38, 102 13 C86 9, 70 4, 50 0 Z"
                                    fill="url(#sheenGrad)"
                                    opacity="0"
                                >
                                    <animate attributeName="opacity" values="0;0.45;0" dur="3.2s" repeatCount="indefinite" />
                                </path>
                            </>
                        )}
                    </svg>

                    {/* Center text — absolutely positioned over the SVG */}
                    <div className="w-hp3-center">
                        <span className={`w-hp3-cur-r ${big ? 'big' : ''} ${malusOnHp ? 'w-mod-aura-malus' : ''}`}>{currentHp}</span>
                        <div className="w-hp3-divline" />
                        <span className="w-hp3-maxval">{maxHp}</span>
                        {(totalTempHp > 0 || nonLethal > 0) && (
                            <div className="w-hp3-minitags">
                                {totalTempHp > 0 && (
                                    <span className={`w-hp3-tag temp ${tmpFromMod > 0 ? 'spectral' : ''}`}>
                                        +{totalTempHp} tmp
                                    </span>
                                )}
                                {nonLethal > 0 && <span className="w-hp3-tag nl">{nonLethal} NL</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Controls ─────────────────────────────────────────── */}
            <div className="w-hp3-btns">
                {buttons.map(d => (
                    <button key={d} className={`w-hp3-btn ${d < 0 ? 'neg' : 'pos'}`} onClick={() => adjust(d)}>
                        {signedFmt(d)}
                    </button>
                ))}
            </div>

            {isDying && <div className="w-hp3-dying-banner">☠ MORENTE — Stabilizza!</div>}
        </div>
    );
};
