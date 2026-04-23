import React, { useState } from 'react';
import { FaDiceD20 } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps, WidgetSize } from '../widgetTypes';

const colsFor = (size: WidgetSize, widthPerCol = 320, max = 3) =>
    Math.max(1, Math.min(max, Math.floor(size.pixelW / widthPerCol)));

export const AttacksWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, getStatModifier } = useCharacterStore();
    const [diceRolling, setDiceRolling] = useState<string | null>(null);
    if (!character) return null;
    const bab = character.baseStats.bab || 0;
    const strMod = getStatModifier('str');
    const equippedWeapons = character.inventory.filter(i => i.equipped && i.type === 'weapon');
    const cols = colsFor(size);

    return (
        <div className="w-atk-root">
            <div className="w-atk-stats">
                <div className="w-atk-stat"><div className="w-atk-stat-label">BAB</div><span className="w-atk-stat-value">+{bab}</span></div>
                <div className="w-atk-stat"><div className="w-atk-stat-label">Iniziativa</div><span className="w-atk-stat-value">{getStatModifier('dex') >= 0 ? '+' : ''}{getStatModifier('dex')}</span></div>
                {goTo && (
                    <button className="w-link" onClick={() => goTo('combat')}>Vai →</button>
                )}
            </div>

            {equippedWeapons.length === 0 ? (
                <div className="w-empty">Nessuna arma equipaggiata.</div>
            ) : (
                <div className="w-atk-grid w-scroll" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {equippedWeapons.map(w => {
                        const bonus = bab + strMod + (w.weaponDetails?.attackBonus ?? 0);
                        const isRanged = !!(w.weaponDetails?.rangeIncrement);
                        return (
                            <button
                                key={w.id} className="w-atk-card"
                                onClick={() => {
                                    const roll = Math.floor(Math.random() * 20) + 1;
                                    const total = roll + bonus;
                                    setDiceRolling(w.id);
                                    setTimeout(() => setDiceRolling(null), 600);
                                    alert(`⚔️ ${w.name}\nDado: ${roll}  Bonus: ${bonus >= 0 ? '+' : ''}${bonus}  = Totale: ${total}\nDanno: ${w.weaponDetails?.damage ?? '?'}`);
                                }}
                            >
                                <div className="w-atk-card-body">
                                    <div className="w-atk-card-name">{w.name}</div>
                                    <div className="w-atk-card-type">
                                        {w.weaponDetails?.damageType ?? ''}{isRanged ? ` · Gittata ${w.weaponDetails?.rangeIncrement}` : ' · Mischia'}
                                    </div>
                                </div>
                                <div className="w-atk-card-stats">
                                    <div className="w-atk-card-stat"><span className="v">{bonus >= 0 ? '+' : ''}{bonus}</span><span className="l">colpire</span></div>
                                    {w.weaponDetails?.damage && (
                                        <div className="w-atk-card-stat"><span className="v">{w.weaponDetails.damage}</span><span className="l">danno</span></div>
                                    )}
                                </div>
                                <FaDiceD20 className={`w-atk-card-die ${diceRolling === w.id ? 'animate-spin' : ''}`} />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
