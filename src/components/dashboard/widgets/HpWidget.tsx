import React from 'react';
import { FaHeart } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

export const HpWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const { character, getEffectiveStat, setCharacter } = useCharacterStore();
    if (!character) return null;
    const currentHp = character.hpDetails?.current ?? character.baseStats.hp ?? 0;
    const maxHp = character.hpDetails?.max ?? getEffectiveStat('hp');
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const color = currentHp <= 0 ? '#8b0000' : pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#e6ac39' : '#c0392b';
    const isDying = currentHp <= 0;
    const isCritical = pct <= 0.3 && currentHp > 0;
    const big = size.size === 'lg' || size.size === 'xl';

    // SVG ring
    const r = big ? 58 : 46;
    const stroke = 8;
    const cx = r + stroke;
    const C = 2 * Math.PI * r;
    const dashOff = C * (1 - pct);
    const dim = (r + stroke) * 2;

    const adjust = (delta: number) => {
        // Snapshot the *current* max BEFORE writing, so it can never drift.
        const currentMax = character.hpDetails?.max ?? getEffectiveStat('hp');
        const newHp = Math.max(-10, Math.min(currentMax, currentHp + delta));
        // Always persist via hpDetails so baseStats.hp (the max input) is never mutated.
        const details = {
            ...(character.hpDetails ?? {}),
            current: newHp,
            max: currentMax,
        };
        setCharacter({
            ...character,
            hpDetails: details,
        });
    };
    const buttons = big ? [-10, -5, -1, +1, +5, +10] : [-5, -1, +1, +5];

    return (
        <div className="w-hp-root" style={{ ['--w-hp-color' as never]: color }}>
            <div className="w-hp-stage">
                <div className={`w-hp-gauge ${isCritical ? 'w-hp-pulse' : ''}`} style={{ width: dim, height: dim }}>
                    <svg width={dim} height={dim}>
                        <circle className="w-hp-track" cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke} />
                        <circle className="w-hp-arc-bg" cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke} />
                        <circle
                            className="w-hp-arc"
                            cx={cx} cy={cx} r={r}
                            fill="none"
                            strokeWidth={stroke}
                            strokeDasharray={C}
                            strokeDashoffset={dashOff}
                        />
                    </svg>
                    <div className="w-hp-center">
                        <FaHeart size={big ? 14 : 11} style={{ color, opacity: 0.6, marginBottom: 2 }} />
                        <span className={`w-hp-current ${big ? 'is-big' : ''}`}>{currentHp}</span>
                        <span className="w-hp-max">/ {maxHp}</span>
                    </div>
                </div>
                {(character.hpDetails?.tempHp || character.hpDetails?.nonLethal) && (
                    <div className="w-hp-side">
                        {character.hpDetails?.tempHp ? <span className="w-hp-tag temp">+{character.hpDetails.tempHp} temp</span> : null}
                        {character.hpDetails?.nonLethal ? <span className="w-hp-tag nl">{character.hpDetails.nonLethal} NL</span> : null}
                    </div>
                )}
            </div>

            <div className="w-hp-controls">
                {buttons.map(d => (
                    <button key={d} className="w-hp-btn" data-d={d < 0 ? 'neg' : 'pos'} onClick={() => adjust(d)}>
                        {d > 0 ? `+${d}` : d}
                    </button>
                ))}
            </div>

            {isDying && <div className="w-hp-banner dying">⚠ Morente — Stabilizzazione!</div>}
            {isCritical && <div className="w-hp-banner crit">Ferito gravemente</div>}
        </div>
    );
};
