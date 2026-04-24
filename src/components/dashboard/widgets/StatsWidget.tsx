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

    const gap = 6;
    const pad = 8;
    const cols = size.pixelW < 180 ? 2 : size.pixelW < 360 ? 3 : 6;
    const rows = Math.ceil(6 / cols);
    const cellW = Math.max(30, (size.pixelW - pad * 2 - gap * (cols - 1)) / cols);
    const cellH = Math.max(50, (size.pixelH - pad * 2 - gap * (rows - 1)) / rows);
    const iconSize = Math.max(14, Math.min(Math.floor(cellW * 0.36), Math.floor(cellH * 0.30), 34));
    const iconWrap = iconSize + 10;
    const modPx = Math.max(13, Math.min(Math.floor(cellH * 0.30), Math.floor(cellW * 0.44), 38));
    const scorePx = Math.max(9, Math.floor(modPx * 0.50));
    const cardPad = Math.max(4, Math.min(Math.floor(cellH * 0.07), 10));

    return (
        <div className="w-stat-root" style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}>
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(stat => {
                const base = character.baseStats[stat];
                const effective = getEffectiveStat(stat);
                const mod = getStatModifier(stat);
                const isEditing = editing === stat;
                const tier = mod >= 4 ? 'is-elite' : mod >= 1 ? 'is-good' : mod === 0 ? '' : 'is-poor';
                const buffed = effective > base;
                const debuffed = effective < base;

                return (
                    <div
                        key={stat}
                        className={`w-stat-card ${tier} ${rolling === stat ? 'is-rolling' : ''}`}
                        style={{ padding: `${cardPad}px 6px` }}
                    >
                        {/* Floating dice button */}
                        <button
                            type="button"
                            className="w-stat-card-die"
                            onClick={e => { e.stopPropagation(); roll(stat, mod); }}
                            title={`Tira 1d20 ${mod >= 0 ? '+' : ''}${mod}`}
                        >
                            <DndIcon category="dice" name="d20" size={12} />
                        </button>

                        {/* Ability icon */}
                        <div className="w-stat-icon-wrap" style={{ width: iconWrap, height: iconWrap }}>
                            <DndIcon category="ability" name={STAT_ICONS[stat]} size={iconSize} />
                        </div>

                        {/* Abbreviated label */}
                        <span className="w-stat-card-label">{STAT_ABBR[stat]}</span>

                        {/* Big modifier */}
                        <div
                            className="w-stat-card-mod"
                            style={{ fontSize: modPx }}
                            onClick={() => !isEditing && setEditing(stat)}
                            title="Click per modificare il valore base"
                        >
                            <span className="w-stat-card-mod-sign">{mod >= 0 ? '+' : '−'}</span>
                            <span className="w-stat-card-mod-num">{Math.abs(mod)}</span>
                        </div>

                        {/* Base score */}
                        <div className="w-stat-card-foot">
                            {isEditing ? (
                                <input
                                    type="number"
                                    className="input w-stat-card-input"
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
                                    className={`w-stat-card-score ${buffed ? 'is-buffed' : ''} ${debuffed ? 'is-debuffed' : ''}`}
                                    style={{ fontSize: scorePx, padding: `1px ${Math.max(5, scorePx * 0.7)}px` }}
                                    onClick={() => setEditing(stat)}
                                    title={effective !== base ? `Base ${base} → effettivo ${effective}` : 'Click per modificare'}
                                >
                                    {effective}
                                    {buffed && <span className="w-stat-card-score-arrow">▲</span>}
                                    {debuffed && <span className="w-stat-card-score-arrow down">▼</span>}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
