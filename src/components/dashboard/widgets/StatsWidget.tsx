import React, { useState } from 'react';
import { FaDiceD20 } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

const STAT_NAMES: Record<string, string> = {
    str: 'Forza', dex: 'Destrezza', con: 'Costituzione',
    int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma',
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

    // Adaptive grid: 3 cols when narrow, 6 when wide, 2 when very narrow
    const cols = size.pixelW < 180 ? 2 : size.pixelW < 360 ? 3 : 6;

    return (
        <div className="w-stat-root" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
                    >
                        <div className="w-stat-card-head">
                            <span className="w-stat-card-label">{STAT_NAMES[stat].slice(0, 3)}</span>
                            <button
                                type="button"
                                className="w-stat-card-die"
                                onClick={e => { e.stopPropagation(); roll(stat, mod); }}
                                title={`Tira 1d20 ${mod >= 0 ? '+' : ''}${mod}`}
                            >
                                <FaDiceD20 />
                            </button>
                        </div>

                        <div
                            className="w-stat-card-mod"
                            onClick={() => !isEditing && setEditing(stat)}
                            title="Click per modificare il valore base"
                        >
                            <span className="w-stat-card-mod-sign">{mod >= 0 ? '+' : '−'}</span>
                            <span className="w-stat-card-mod-num">{Math.abs(mod)}</span>
                        </div>

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
