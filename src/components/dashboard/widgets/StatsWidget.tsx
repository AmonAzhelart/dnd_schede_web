import React, { useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';

const STAT_NAMES: Record<string, string> = {
    str: 'Forza', dex: 'Destrezza', con: 'Costituzione',
    int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma',
};

const STAT_ABBR: Record<string, string> = {
    str: 'FOR', dex: 'DES', con: 'COS',
    int: 'INT', wis: 'SAG', cha: 'CAR',
};

const STAT_ICONS: Record<string, string> = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

// The cell content is a two-column split (icon+name | mod+score), so it
// looks best with cells wider than tall. This is the aspect we score toward.
const TARGET_ASPECT = 1.6;

// Absolute-minimum readable cell used only as the ultimate fallback so the
// widget can scroll when the container is tiny. Nothing in the layout is
// hard-coded: all type scales with the cell.
const MIN_FALLBACK_W = 90;
const MIN_FALLBACK_H = 54;

export const StatsWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const { character, setCharacter, getEffectiveStat, getStatModifier } = useCharacterStore();
    const [editing, setEditing] = useState<string | null>(null);
    const [rolling, setRolling] = useState<string | null>(null);
    if (!character) return null;

    const roll = (stat: string, mod: number) => {
        setRolling(stat);
        setTimeout(() => setRolling(null), 600);
        const r = Math.floor(Math.random() * 20) + 1;
        alert(`🎲 ${STAT_NAMES[stat] || stat} — Dado: ${r} + Mod: ${mod >= 0 ? '+' : ''}${mod} = ${r + mod}`);
    };
    const update = (stat: string, val: string) => {
        const num = parseInt(val);
        if (isNaN(num)) return;
        setCharacter({ ...character, baseStats: { ...character.baseStats, [stat]: num } });
    };

    // Pick the rows × cols split for 6 cells that best matches the cell's
    // natural aspect (wider than tall). Score each candidate by area scaled
    // by how close its aspect is to TARGET_ASPECT. No hard sizes: the
    // chosen split is simply the most area-efficient shape for the
    // container. A scroll fallback kicks in only if the container is so
    // small every candidate would collapse below MIN_FALLBACK.
    const W = Math.max(60, size.pixelW);
    const H = Math.max(60, size.pixelH);
    const gap = 6;
    const pad = 8;

    const candidates: Array<{ rows: number; cols: number }> = [
        { rows: 1, cols: 6 }, { rows: 2, cols: 3 },
        { rows: 3, cols: 2 }, { rows: 6, cols: 1 },
    ];

    type Pick = { rows: number; cols: number; cellW: number; cellH: number; score: number };
    let best: Pick | null = null;
    for (const c of candidates) {
        const cw = (W - pad * 2 - gap * (c.cols - 1)) / c.cols;
        const ch = (H - pad * 2 - gap * (c.rows - 1)) / c.rows;
        if (cw <= 0 || ch <= 0) continue;
        const aspect = cw / ch;
        // How close the aspect is to the target, in [0,1].
        const aspectFit = aspect >= TARGET_ASPECT
            ? TARGET_ASPECT / aspect
            : aspect / TARGET_ASPECT;
        const score = cw * ch * (0.3 + 0.7 * aspectFit);
        if (!best || score > best.score) {
            best = { rows: c.rows, cols: c.cols, cellW: cw, cellH: ch, score };
        }
    }
    if (!best) best = { rows: 3, cols: 2, cellW: MIN_FALLBACK_W, cellH: MIN_FALLBACK_H, score: 0 };

    const { rows, cols } = best;
    const needsScroll = best.cellW < MIN_FALLBACK_W || best.cellH < MIN_FALLBACK_H;
    const effectiveH = needsScroll ? MIN_FALLBACK_H : best.cellH;
    const effectiveW = needsScroll ? MIN_FALLBACK_W : best.cellW;

    // Typography scales with the actual cell dimensions — purely fluid.
    const dim = Math.min(effectiveH, effectiveW * 0.7);
    const modPx = Math.round(Math.min(effectiveH * 0.52, effectiveW * 0.28, 56));
    const scorePx = Math.round(Math.min(effectiveH * 0.28, effectiveW * 0.18, 26));
    const labelPx = Math.round(Math.min(effectiveH * 0.18, effectiveW * 0.14, 15));
    const iconSize = Math.round(Math.min(dim * 0.42, 32));

    return (
        <div
            className={`w-stat-root ${needsScroll ? 'is-scroll' : ''}`}
            style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: needsScroll
                    ? `repeat(${rows}, ${MIN_FALLBACK_H}px)`
                    : `repeat(${rows}, 1fr)`,
                gap: `${gap}px`,
                padding: `${pad}px`,
            }}
        >
            {STATS.map(stat => {
                const base = character.baseStats[stat];
                const effective = getEffectiveStat(stat);
                const mod = getStatModifier(stat);
                const isEditing = editing === stat;
                const tier =
                    mod >= 4 ? 'is-elite'
                        : mod >= 1 ? 'is-good'
                            : mod === 0 ? ''
                                : 'is-poor';
                const buffed = effective > base;
                const debuffed = effective < base;
                const modSign = mod >= 0 ? '+' : '−';
                const modAbs = Math.abs(mod);
                const tooltip = `${STAT_NAMES[stat]}: ${effective} (${modSign}${modAbs}) — click per tirare d20`;

                return (
                    <div
                        key={stat}
                        className={`w-stat-cell ${tier} ${rolling === stat ? 'is-rolling' : ''}`}
                        title={tooltip}
                        onClick={() => roll(stat, mod)}
                    >
                        {/* LEFT: icon on top, abbreviation below */}
                        <div className="w-stat-cell-left">
                            <div className="w-stat-cell-icon">
                                <DndIcon
                                    category="ability"
                                    name={STAT_ICONS[stat]}
                                    size={iconSize}
                                />
                            </div>
                            <span
                                className="w-stat-cell-label"
                                style={{ fontSize: labelPx }}
                            >
                                {STAT_ABBR[stat]}
                            </span>
                        </div>

                        {/* RIGHT: modifier (hero) above, score below */}
                        <div className="w-stat-cell-right">
                            <div
                                className="w-stat-cell-mod"
                                style={{ fontSize: modPx }}
                            >
                                <span className="w-stat-cell-mod-sign">{modSign}</span>
                                <span className="w-stat-cell-mod-num">{modAbs}</span>
                            </div>
                            {isEditing ? (
                                <input
                                    type="number"
                                    className="input w-stat-cell-input"
                                    style={{ fontSize: scorePx, width: scorePx * 3.4 }}
                                    defaultValue={base}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => { update(stat, e.target.value); setEditing(null); }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { update(stat, (e.target as HTMLInputElement).value); setEditing(null); }
                                        if (e.key === 'Escape') setEditing(null);
                                    }}
                                />
                            ) : (
                                <button
                                    type="button"
                                    className={`w-stat-cell-score ${buffed ? 'is-buffed' : ''} ${debuffed ? 'is-debuffed' : ''}`}
                                    style={{ fontSize: scorePx }}
                                    onClick={e => { e.stopPropagation(); setEditing(stat); }}
                                    title={effective !== base ? `Base ${base} → effettivo ${effective} · click per modificare` : 'Click per modificare il valore base'}
                                >
                                    {effective}
                                    {buffed && <span className="w-stat-cell-score-arrow">▲</span>}
                                    {debuffed && <span className="w-stat-cell-score-arrow down">▼</span>}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
