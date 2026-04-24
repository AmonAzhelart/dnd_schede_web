import React, { useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';
import { useIconCatalog, sanitizeSvg } from '../../../services/iconCache';
import { GiCrossedSwords } from 'react-icons/gi';

const fmtSigned = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

export const AttacksWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, getStatModifier, getTotalBab, getMultipleAttacks } = useCharacterStore();
    const { resolveItemSvg } = useIconCatalog();
    const [diceRolling, setDiceRolling] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    if (!character) return null;
    const bab = getTotalBab();
    const strMod = getStatModifier('str');
    const dexMod = getStatModifier('dex');
    const equippedWeapons = character.inventory.filter(i => i.equipped && i.type === 'weapon');
    const customAttacks = character.customAttacks ?? [];
    const hasAny = equippedWeapons.length > 0 || customAttacks.length > 0;
    const narrow = size.pixelW < 320;

    const fmtList = (arr: number[]) => arr.map(fmtSigned).join(' / ');

    /** Roll d20 and notify the user with the result. */
    const rollAttack = (id: string, label: string, bonus: number, damage: string | undefined, primaryAttacks: number[]) => {
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + bonus;
        setDiceRolling(id);
        setTimeout(() => setDiceRolling(null), 600);
        const progStr = primaryAttacks.length > 1
            ? `\nProgressione: ${fmtList(primaryAttacks)}`
            : '';
        alert(`⚔️ ${label}\nDado: ${roll}  Bonus: ${fmtSigned(bonus)}  =  ${total}${progStr}${damage ? `\nDanno: ${damage}` : ''}`);
    };

    return (
        <div className="w-atk2-root">
            {/* Compact header: BAB + FOR + DES chips */}
            <div className="w-atk2-header">
                <div className="w-atk2-chips">
                    <div className="w-atk2-chip" title="Bonus Attacco Base">
                        <span className="w-atk2-chip-lbl">BAB</span>
                        <span className="w-atk2-chip-val">{fmtSigned(bab)}</span>
                    </div>
                    <div className="w-atk2-chip" title="Modificatore Forza (mischia)">
                        <span className="w-atk2-chip-lbl">FOR</span>
                        <span className="w-atk2-chip-val">{fmtSigned(strMod)}</span>
                    </div>
                    <div className="w-atk2-chip" title="Modificatore Destrezza (distanza)">
                        <span className="w-atk2-chip-lbl">DES</span>
                        <span className="w-atk2-chip-val">{fmtSigned(dexMod)}</span>
                    </div>
                </div>
                {goTo && <button className="w-link" onClick={() => goTo('combat')}>Apri →</button>}
            </div>

            {!hasAny ? (
                <div className="w-empty"><GiCrossedSwords style={{ marginRight: 6 }} />Nessuna arma equipaggiata.</div>
            ) : (
                <div className="w-atk2-list w-scroll">
                    {equippedWeapons.map(w => {
                        const isRanged = !!(w.weaponDetails?.rangeIncrement);
                        const abilityMod = isRanged ? dexMod : strMod;
                        const weaponBonus = w.weaponDetails?.attackBonus ?? 0;
                        const attacks = getMultipleAttacks(abilityMod + weaponBonus);
                        const primary = attacks[0];
                        const wSvg = resolveItemSvg(w);
                        const isExpanded = expanded === w.id;
                        const meta = `${isRanged ? 'Distanza' : 'Mischia'}${w.weaponDetails?.damageType ? ` · ${w.weaponDetails.damageType}` : ''}${isRanged && w.weaponDetails?.rangeIncrement ? ` · ${w.weaponDetails.rangeIncrement}` : ''}`;

                        return (
                            <div key={w.id} className={`w-atk2-row ${isRanged ? 'ranged' : 'melee'}`}>
                                <div className="w-atk2-row-top">
                                    <span className="w-atk2-row-icon">
                                        {wSvg ? (
                                            <span className="inv-svg-tinted" dangerouslySetInnerHTML={{ __html: sanitizeSvg(wSvg) }} />
                                        ) : (
                                            <DndIcon category="combat" name={isRanged ? 'ranged' : 'melee'} size={18} />
                                        )}
                                    </span>
                                    <div className="w-atk2-row-name" title={w.name}>{w.name}</div>
                                </div>
                                <div className="w-atk2-row-bot">
                                    {!narrow && <div className="w-atk2-row-meta">{meta}</div>}
                                    <div className="w-atk2-row-spacer" />
                                    <button
                                        className="w-atk2-row-stat atk"
                                        onClick={() => attacks.length > 1 ? setExpanded(isExpanded ? null : w.id) : rollAttack(w.id, w.name, primary, w.weaponDetails?.damage, attacks)}
                                        title={attacks.length > 1 ? 'Mostra progressione' : 'Tira d20'}
                                    >
                                        <span className="v">{fmtSigned(primary)}</span>
                                        <span className="l">colpire</span>
                                    </button>
                                    {w.weaponDetails?.damage && (
                                        <div className="w-atk2-row-stat dmg">
                                            <span className="v">{w.weaponDetails.damage}</span>
                                            <span className="l">danno</span>
                                        </div>
                                    )}
                                    <button
                                        className={`w-atk2-roll ${diceRolling === w.id ? 'rolling' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); rollAttack(w.id, w.name, primary, w.weaponDetails?.damage, attacks); }}
                                        title="Tira d20"
                                        aria-label="Tira d20"
                                    >
                                        <DndIcon category="dice" name="d20" size={20} className={diceRolling === w.id ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                                {isExpanded && attacks.length > 1 && (
                                    <div className="w-atk2-row-detail">
                                        <span className="w-atk2-detail-lbl">Progressione full-attack:</span>
                                        <span className="w-atk2-detail-val">{fmtList(attacks)}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {customAttacks.map(atk => {
                        const bonus = (atk.useBab ? bab : 0)
                            + (atk.attackStat ? getStatModifier(atk.attackStat) : 0)
                            + (atk.attackBonusExtra ?? 0);
                        const dmgExtra = (atk.damageStat ? getStatModifier(atk.damageStat) : 0) + (atk.damageBonusExtra ?? 0);
                        const dmgDisplay = dmgExtra !== 0
                            ? `${atk.damageDice} ${fmtSigned(dmgExtra)}`
                            : atk.damageDice;
                        const meta = `${atk.range ? atk.range : 'Mischia'}${atk.damageType ? ` · ${atk.damageType}` : ''}`;
                        return (
                            <div key={atk.id} className="w-atk2-row custom">
                                <div className="w-atk2-row-top">
                                    <span className="w-atk2-row-icon arcane">
                                        <DndIcon category="dice" name="d20" size={18} />
                                    </span>
                                    <div className="w-atk2-row-name" title={atk.name}>{atk.name}</div>
                                </div>
                                <div className="w-atk2-row-bot">
                                    {!narrow && <div className="w-atk2-row-meta arcane">{meta}</div>}
                                    <div className="w-atk2-row-spacer" />
                                    <div className="w-atk2-row-stat atk">
                                        <span className="v">{fmtSigned(bonus)}</span>
                                        <span className="l">colpire</span>
                                    </div>
                                    <div className="w-atk2-row-stat dmg">
                                        <span className="v">{dmgDisplay}</span>
                                        <span className="l">danno</span>
                                    </div>
                                    <button
                                        className={`w-atk2-roll ${diceRolling === atk.id ? 'rolling' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); rollAttack(atk.id, atk.name, bonus, dmgDisplay, [bonus]); }}
                                        title="Tira d20"
                                        aria-label="Tira d20"
                                    >
                                        <DndIcon category="dice" name="d20" size={20} className={diceRolling === atk.id ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
