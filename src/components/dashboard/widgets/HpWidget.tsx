import React from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { GiHeartMinus, GiHeartPlus } from 'react-icons/gi';

/* ---------- Helpers ---------- */
const colorFor = (pct: number, dying: boolean) =>
    dying ? '#8b0000' : pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#e6ac39' : '#c0392b';

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export const HpWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const { character, getEffectiveStat, setCharacter } = useCharacterStore();
    if (!character) return null;
    const currentHp = character.hpDetails?.current ?? character.baseStats.hp ?? 0;
    const maxHp = character.hpDetails?.max ?? getEffectiveStat('hp');
    const tempHp = character.hpDetails?.tempHp ?? 0;
    const nonLethal = character.hpDetails?.nonLethal ?? 0;
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const isDying = currentHp <= 0;
    const isCritical = pct <= 0.3 && currentHp > 0;
    const color = colorFor(pct, isDying);

    // Layout class: compact = ribbon (very small), normal = ring
    const compact = size.pixelH < 170 || size.pixelW < 170;
    const big = !compact && (size.size === 'lg' || size.size === 'xl');

    const adjust = (delta: number) => {
        const currentMax = character.hpDetails?.max ?? getEffectiveStat('hp');
        const newHp = Math.max(-10, Math.min(currentMax, currentHp + delta));
        setCharacter({
            ...character,
            hpDetails: {
                ...(character.hpDetails ?? {}),
                current: newHp,
                max: currentMax,
            },
        });
    };

    const buttons = big ? [-10, -5, -1, +1, +5, +10] : compact ? [-1, +1] : [-5, -1, +1, +5];

    /* ----- Compact horizontal layout ----- */
    if (compact) {
        return (
            <div className={`w-hp2-root compact ${isCritical ? 'is-crit' : ''} ${isDying ? 'is-dying' : ''}`}
                style={{ ['--w-hp-color' as never]: color }}>
                <div className="w-hp2-bar-row">
                    <div className="w-hp2-readout">
                        <span className="w-hp2-cur">{currentHp}</span>
                        <span className="w-hp2-max">/{maxHp}</span>
                    </div>
                    <div className="w-hp2-bar-wrap">
                        <div className="w-hp2-bar-track">
                            <div className="w-hp2-bar-fill" style={{ width: `${pct * 100}%` }} />
                            {tempHp > 0 && maxHp > 0 && (
                                <div className="w-hp2-bar-temp"
                                    style={{ width: `${Math.min(1, tempHp / maxHp) * 100}%` }} />
                            )}
                        </div>
                        {(tempHp > 0 || nonLethal > 0) && (
                            <div className="w-hp2-tags">
                                {tempHp > 0 && <span className="w-hp2-tag temp">+{tempHp} temp</span>}
                                {nonLethal > 0 && <span className="w-hp2-tag nl">{nonLethal} NL</span>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="w-hp2-controls">
                    {buttons.map(d => (
                        <button key={d} className="w-hp2-btn" data-d={d < 0 ? 'neg' : 'pos'} onClick={() => adjust(d)}>
                            {d < 0 ? <GiHeartMinus size={11} /> : <GiHeartPlus size={11} />}
                            {fmtSigned(d)}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    /* ----- Ring layout (default & large) ----- */
    const r = big ? 64 : 50;
    const stroke = big ? 9 : 7;
    const cx = r + stroke;
    const C = 2 * Math.PI * r;
    const dashOff = C * (1 - pct);
    const dim = (r + stroke) * 2;
    // Temp HP outer arc (separate ring offset outwards by stroke+2)
    const tempPct = tempHp > 0 && maxHp > 0 ? Math.min(1, tempHp / maxHp) : 0;
    const tempR = r + stroke + 3;
    const tempC = 2 * Math.PI * tempR;
    const tempDim = (tempR + 2) * 2;

    return (
        <div className={`w-hp2-root ring ${isCritical ? 'is-crit' : ''} ${isDying ? 'is-dying' : ''}`}
            style={{ ['--w-hp-color' as never]: color }}>
            <div className="w-hp2-stage">
                <div className={`w-hp2-gauge ${isCritical ? 'pulse' : ''}`} style={{ width: tempDim, height: tempDim }}>
                    {/* Main HP ring */}
                    <svg className="w-hp2-svg main" width={dim} height={dim}
                        style={{ position: 'absolute', top: tempR + 2 - cx, left: tempR + 2 - cx }}>
                        <defs>
                            <linearGradient id="wHpGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity="1" />
                                <stop offset="100%" stopColor={color} stopOpacity="0.5" />
                            </linearGradient>
                        </defs>
                        <circle className="w-hp2-track" cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke} />
                        <circle className="w-hp2-arc" cx={cx} cy={cx} r={r}
                            fill="none" stroke="url(#wHpGrad)" strokeWidth={stroke}
                            strokeDasharray={C} strokeDashoffset={dashOff} strokeLinecap="round" />
                    </svg>
                    {/* Temp HP outer arc */}
                    {tempPct > 0 && (
                        <svg className="w-hp2-svg temp" width={tempDim} height={tempDim}>
                            <circle cx={tempR + 2} cy={tempR + 2} r={tempR}
                                fill="none" stroke="rgba(91,192,222,0.18)" strokeWidth={2} />
                            <circle cx={tempR + 2} cy={tempR + 2} r={tempR}
                                fill="none" stroke="var(--accent-ice, #5bc0de)" strokeWidth={2}
                                strokeDasharray={tempC} strokeDashoffset={tempC * (1 - tempPct)}
                                strokeLinecap="round" />
                        </svg>
                    )}
                    <div className="w-hp2-center">
                        <span className={`w-hp2-cur ${big ? 'big' : ''}`}>{currentHp}</span>
                        <span className="w-hp2-divider" />
                        <span className="w-hp2-max">{maxHp}</span>
                        {(tempHp > 0 || nonLethal > 0) && (
                            <div className="w-hp2-mini-tags">
                                {tempHp > 0 && <span className="w-hp2-tag temp">+{tempHp}</span>}
                                {nonLethal > 0 && <span className="w-hp2-tag nl">{nonLethal} NL</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="w-hp2-controls">
                {buttons.map(d => (
                    <button key={d} className="w-hp2-btn" data-d={d < 0 ? 'neg' : 'pos'} onClick={() => adjust(d)}>
                        {fmtSigned(d)}
                    </button>
                ))}
            </div>
            {isDying && <div className="w-hp2-banner dying">⚠ Morente — Stabilizza!</div>}
            {isCritical && !big && <div className="w-hp2-banner crit">Ferito gravemente</div>}
        </div>
    );
};
