import React, { useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';
import { useIconCatalog, sanitizeSvg } from '../../../services/iconCache';
import { GiCrossedSwords } from 'react-icons/gi';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { useModifierAura, ModifierArrows } from './ModifierAura';
import type { Item, StatType } from '../../../types/dnd';
import { RollPickerModal, type RollSegment } from '../../RollPickerModal';
import { resolveStatOverride } from '../../../services/modifiers';

const STAT_LABELS: Record<StatType, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};

const fmtSigned = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

const StatChip: React.FC<{ label: string; value: number; target: StatType | string; title: string }> = ({ label, value, target, title }) => {
    const aura = useModifierAura(target);
    return (
        <div
            className={`w-atk2-chip ${aura.auraClass}`.trim()}
            style={aura.auraClass ? { position: 'relative', overflow: 'hidden' } : undefined}
            title={title}
        >
            <span className="w-atk2-chip-lbl">{label}</span>
            <span className="w-atk2-chip-val">{fmtSigned(value)}</span>
            {aura.auraClass && <ModifierArrows delta={aura.delta} count={2} />}
        </div>
    );
};

export const AttacksWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, setCharacter, getStatModifier, getTotalBab, getMultipleAttacks } = useCharacterStore();
    const { resolveItemSvg } = useIconCatalog();
    const babAura = useModifierAura('bab');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [picker, setPicker] = useState<{
        title: string;
        subtitle?: string;
        segments: RollSegment[];
    } | null>(null);

    if (!character) return null;

    const baseFontSize = Math.max(10, Math.min(17, size.pixelW * 0.052));
    const icoSm = Math.max(10, Math.round(1.29 * baseFontSize));  // weapon / arcane icon
    const icoMd = Math.max(12, Math.round(1.43 * baseFontSize));  // d20 roll button
    const icoXs = Math.max(5, Math.round(0.57 * baseFontSize));  // ammo ± buttons

    const adjustAmmoQty = (ammoId: string, delta: number) => {
        const inv = character.inventory.map(i => {
            if (i.id !== ammoId) return i;
            const qty = Math.max(0, (i.quantity ?? 1) + delta);
            return { ...i, quantity: qty };
        });
        setCharacter({ ...character, inventory: inv });
    };
    const bab = getTotalBab() + babAura.delta;
    const strMod = getStatModifier('str');
    const dexMod = getStatModifier('dex');
    const equippedWeapons = character.inventory.filter(i => i.equipped && i.type === 'weapon');
    const customAttacks = character.customAttacks ?? [];
    const hasAny = equippedWeapons.length > 0 || customAttacks.length > 0;

    const fmtList = (arr: number[]) => arr.map(fmtSigned).join(' / ');

    /** Open the combined attack+damage picker. The widget computes both base
     *  breakdowns; the modal lists feat/item/class-feature bonuses for each
     *  channel and tells you the d20 modifier and damage modifier+dice. */
    const openAttackPicker = (
        weapon: Item | undefined,
        label: string,
        attackBreakdown: RollBreakdownLine[],
        damageBreakdown: RollBreakdownLine[],
        opts: { isRanged: boolean; customAttackName?: string; subtitle?: string; baseDice?: string },
    ) => {
        const segments: RollSegment[] = [
            {
                ctx: { channel: 'attack', weapon, customAttackName: opts.customAttackName, isRanged: opts.isRanged },
                label: 'Tiro per colpire',
                baseBreakdown: attackBreakdown,
            },
            {
                ctx: { channel: 'damage', weapon, customAttackName: opts.customAttackName, isRanged: opts.isRanged },
                label: 'Danno',
                baseBreakdown: damageBreakdown,
                baseDice: opts.baseDice,
            },
        ];
        setPicker({ title: `Attacco · ${label}`, subtitle: opts.subtitle, segments });
    };

    /** Damage-only picker (kept for the explicit "danno" button). */
    const openDamagePicker = (
        weapon: Item | undefined,
        label: string,
        breakdown: RollBreakdownLine[],
        opts: { isRanged: boolean; customAttackName?: string; subtitle?: string; baseDice?: string },
    ) => {
        setPicker({
            title: `Danno · ${label}`,
            subtitle: opts.subtitle,
            segments: [{
                ctx: { channel: 'damage', weapon, customAttackName: opts.customAttackName, isRanged: opts.isRanged },
                label: 'Danno',
                baseBreakdown: breakdown,
                baseDice: opts.baseDice,
            }],
        });
    };

    return (
        <div className="w-atk2-root" style={{ fontSize: `${baseFontSize}px` }}>
            {/* Compact header: BAB + FOR + DES chips */}
            <div className="w-atk2-header">
                <div className="w-atk2-chips">
                    <div
                        className={`w-atk2-chip ${babAura.auraClass}`.trim()}
                        style={babAura.auraClass ? { position: 'relative', overflow: 'hidden' } : undefined}
                        title="Bonus Attacco Base"
                    >
                        <span className="w-atk2-chip-lbl">BAB</span>
                        <span className="w-atk2-chip-val">{fmtSigned(bab)}</span>
                        {babAura.auraClass && <ModifierArrows delta={babAura.delta} count={2} />}
                    </div>
                    <StatChip label="FOR" value={strMod} target="str" title="Modificatore Forza (mischia)" />
                    <StatChip label="DES" value={dexMod} target="dex" title="Modificatore Destrezza (distanza)" />
                </div>
                {goTo && <button className="w-link" onClick={() => goTo('combat')}>Apri →</button>}
            </div>

            {!hasAny ? (
                <div className="w-empty"><GiCrossedSwords style={{ marginRight: 6 }} />Nessuna arma equipaggiata.</div>
            ) : (
                <div className="w-atk2-list w-scroll">
                    {equippedWeapons.map(w => {
                        const isRanged = !!(w.weaponDetails?.rangeIncrement);
                        const loadedAmmo = isRanged && w.equippedAmmoId
                            ? character.inventory.find(i => i.id === w.equippedAmmoId)
                            : undefined;
                        const ammoAtkBonus = loadedAmmo?.ammoDetails?.attackBonus ?? 0;
                        // Resolve stat overrides from feats / items / class features
                        const atkStatOverride = resolveStatOverride(
                            character,
                            { channel: 'attack', weapon: w, isRanged },
                            getStatModifier,
                        );
                        const dmgStatOverride = resolveStatOverride(
                            character,
                            { channel: 'damage', weapon: w, isRanged },
                            getStatModifier,
                        );
                        const atkStat: StatType = atkStatOverride ?? (isRanged ? 'dex' : 'str');
                        const dmgStat: StatType | null = dmgStatOverride ?? (isRanged ? null : 'str');
                        const abilityMod = getStatModifier(atkStat);
                        const dmgStatMod = dmgStat ? getStatModifier(dmgStat) : 0;
                        // Build labels with substitution hint when override is active
                        const defaultAtkStat: StatType = isRanged ? 'dex' : 'str';
                        const defaultDmgStat: StatType | null = isRanged ? null : 'str';
                        const atkStatLabel = atkStatOverride
                            ? `Mod. ${STAT_LABELS[atkStat]} (↑ da ${STAT_LABELS[defaultAtkStat]})`
                            : `Mod. ${STAT_LABELS[atkStat]}`;
                        const dmgStatLabel = dmgStat
                            ? (dmgStatOverride && dmgStatOverride !== defaultDmgStat
                                ? `Mod. ${STAT_LABELS[dmgStat]} (↑ da ${defaultDmgStat ? STAT_LABELS[defaultDmgStat] : '—'})`
                                : `Mod. ${STAT_LABELS[dmgStat]}`)
                            : null;
                        const weaponBonus = (w.weaponDetails?.attackBonus ?? 0) + ammoAtkBonus;
                        const attacks = getMultipleAttacks(abilityMod + weaponBonus + babAura.delta);
                        const primary = attacks[0];
                        const wSvg = resolveItemSvg(w);
                        const isExpanded = expanded === w.id;
                        const ammoDmgExtra = loadedAmmo?.ammoDetails?.extraDamage;
                        const ammoDmgType = loadedAmmo?.ammoDetails?.extraDamageType;
                        const baseDamage = w.weaponDetails?.damage ?? '';
                        const fullDamage = baseDamage && ammoDmgExtra
                            ? `${baseDamage} + ${ammoDmgExtra}${ammoDmgType ? ` (${ammoDmgType})` : ''}`
                            : baseDamage || undefined;
                        const meta = `${isRanged ? 'Distanza' : 'Mischia'}${w.weaponDetails?.damageType ? ` · ${w.weaponDetails.damageType}` : ''}${isRanged && w.weaponDetails?.rangeIncrement ? ` · ${w.weaponDetails.rangeIncrement}` : ''}${loadedAmmo ? ` · 🏹 ${loadedAmmo.name}` : ''}`;

                        return (
                            <div key={w.id} className={`w-atk2-row ${isRanged ? 'ranged' : 'melee'}`}>
                                <div className="w-atk2-row-main">
                                    <div className="w-atk2-row-left">
                                        <div className="w-atk2-row-nameline">
                                            <span className="w-atk2-row-icon">
                                                {wSvg ? (
                                                    <span className="inv-svg-tinted" dangerouslySetInnerHTML={{ __html: sanitizeSvg(wSvg) }} />
                                                ) : (
                                                    <DndIcon category="combat" name={isRanged ? 'ranged' : 'melee'} size={icoSm} />
                                                )}
                                            </span>
                                            <div className="w-atk2-row-name" title={w.name}>{w.name}</div>
                                        </div>
                                        <div className="w-atk2-row-meta">{meta}</div>
                                    </div>
                                    <div className="w-atk2-row-right">
                                        <button
                                            className="w-atk2-row-stat atk"
                                            onClick={() => {
                                                if (attacks.length > 1) {
                                                    setExpanded(isExpanded ? null : w.id);
                                                    return;
                                                }
                                                openAttackPicker(w, w.name,
                                                    [
                                                        { label: 'BAB', value: getTotalBab() },
                                                        { label: atkStatLabel, value: abilityMod },
                                                        ...(weaponBonus ? [{ label: 'Bonus arma', value: weaponBonus }] : []),
                                                    ],
                                                    [
                                                        ...(dmgStatLabel ? [{ label: dmgStatLabel, value: dmgStatMod }] : []),
                                                    ],
                                                    { isRanged, subtitle: meta, baseDice: baseDamage });
                                            }}
                                            title="Apri tiro per colpire e danno"
                                        >
                                            <span className="v">{fmtSigned(primary)}</span>
                                            <span className="l">colpire</span>
                                        </button>
                                        {fullDamage && (
                                            <button
                                                className="w-atk2-row-stat dmg"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDamagePicker(w, w.name, [
                                                        ...(dmgStatLabel ? [{ label: dmgStatLabel, value: dmgStatMod }] : []),
                                                    ], { isRanged, subtitle: `Danno base: ${fullDamage}`, baseDice: baseDamage });
                                                }}
                                                title="Apri tiro per il danno"
                                            >
                                                <span className="v">{fullDamage}</span>
                                                <span className="l">danno</span>
                                            </button>
                                        )}
                                        <button
                                            className="w-atk2-roll"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openAttackPicker(w, w.name,
                                                    [
                                                        { label: 'BAB', value: getTotalBab() },
                                                        { label: atkStatLabel, value: abilityMod },
                                                        ...(weaponBonus ? [{ label: 'Bonus arma', value: weaponBonus }] : []),
                                                    ],
                                                    [
                                                        ...(dmgStatLabel ? [{ label: dmgStatLabel, value: dmgStatMod }] : []),
                                                    ],
                                                    { isRanged, subtitle: meta, baseDice: baseDamage });
                                            }}
                                            title="Apri tiro per colpire e danno"
                                            aria-label="Apri tiro"
                                        >
                                            <DndIcon category="dice" name="d20" size={icoMd} />
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && attacks.length > 1 && (
                                    <div className="w-atk2-row-detail">
                                        <span className="w-atk2-detail-lbl">Progressione full-attack:</span>
                                        <span className="w-atk2-detail-val">{fmtList(attacks)}</span>
                                    </div>
                                )}
                                {/* Ammo strip for ranged weapons */}
                                {isRanged && (
                                    <div className="w-atk2-ammo-strip">
                                        <span className="w-atk2-ammo-label">🏹</span>
                                        {loadedAmmo ? (
                                            <>
                                                <span className="w-atk2-ammo-name" title={loadedAmmo.name}>{loadedAmmo.name}</span>
                                                {/* Bonus tags */}
                                                {!!loadedAmmo.ammoDetails?.attackBonus && (
                                                    <span className="w-atk2-ammo-tag atk" title="Bonus attacco munizione">
                                                        {loadedAmmo.ammoDetails.attackBonus > 0 ? '+' : ''}{loadedAmmo.ammoDetails.attackBonus} att.
                                                    </span>
                                                )}
                                                {loadedAmmo.ammoDetails?.extraDamage && (
                                                    <span className="w-atk2-ammo-tag dmg" title="Danno extra munizione">
                                                        +{loadedAmmo.ammoDetails.extraDamage}{loadedAmmo.ammoDetails.extraDamageType ? ` ${loadedAmmo.ammoDetails.extraDamageType}` : ''}
                                                    </span>
                                                )}
                                                <span className="w-atk2-ammo-spacer" />
                                                {/* Qty controls */}
                                                <button
                                                    className="w-atk2-ammo-btn"
                                                    title="Spara (–1)"
                                                    onClick={e => { e.stopPropagation(); adjustAmmoQty(loadedAmmo.id, -1); }}
                                                    disabled={(loadedAmmo.quantity ?? 1) <= 0}
                                                >
                                                    <FaMinus size={icoXs} />
                                                </button>
                                                <span className={`w-atk2-ammo-qty${(loadedAmmo.quantity ?? 1) === 0 ? ' empty' : ''}`}>
                                                    {loadedAmmo.quantity ?? 1}
                                                </span>
                                                <button
                                                    className="w-atk2-ammo-btn"
                                                    title="Aggiungi (+1)"
                                                    onClick={e => { e.stopPropagation(); adjustAmmoQty(loadedAmmo.id, +1); }}
                                                >
                                                    <FaPlus size={icoXs} />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="w-atk2-ammo-none">Nessuna munizione</span>
                                        )}
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
                                <div className="w-atk2-row-main">
                                    <div className="w-atk2-row-left">
                                        <div className="w-atk2-row-nameline">
                                            <span className="w-atk2-row-icon arcane">
                                                <DndIcon category="dice" name="d20" size={icoSm} />
                                            </span>
                                            <div className="w-atk2-row-name" title={atk.name}>{atk.name}</div>
                                        </div>
                                        <div className="w-atk2-row-meta arcane">{meta}</div>
                                    </div>
                                    <div className="w-atk2-row-right">
                                        <button
                                            className="w-atk2-row-stat atk"
                                            onClick={() => openAttackPicker(undefined, atk.name,
                                                [
                                                    ...(atk.useBab ? [{ label: 'BAB', value: getTotalBab() }] : []),
                                                    ...(atk.attackStat ? [{ label: `Mod. ${atk.attackStat.toUpperCase()}`, value: getStatModifier(atk.attackStat) }] : []),
                                                    ...(atk.attackBonusExtra ? [{ label: 'Bonus extra', value: atk.attackBonusExtra }] : []),
                                                ],
                                                [
                                                    ...(atk.damageStat ? [{ label: `Mod. ${atk.damageStat.toUpperCase()}`, value: getStatModifier(atk.damageStat) }] : []),
                                                    ...(atk.damageBonusExtra ? [{ label: 'Bonus extra', value: atk.damageBonusExtra }] : []),
                                                ],
                                                { isRanged: !!atk.range, customAttackName: atk.name, subtitle: meta, baseDice: atk.damageDice })}
                                            title="Apri tiro per colpire e danno"
                                        >
                                            <span className="v">{fmtSigned(bonus)}</span>
                                            <span className="l">colpire</span>
                                        </button>
                                        <button
                                            className="w-atk2-row-stat dmg"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDamagePicker(undefined, atk.name, [
                                                    ...(atk.damageStat ? [{ label: `Mod. ${atk.damageStat.toUpperCase()}`, value: getStatModifier(atk.damageStat) }] : []),
                                                    ...(atk.damageBonusExtra ? [{ label: 'Bonus extra', value: atk.damageBonusExtra }] : []),
                                                ], { isRanged: !!atk.range, customAttackName: atk.name, subtitle: `Danno base: ${atk.damageDice}`, baseDice: atk.damageDice });
                                            }}
                                            title="Apri tiro per il danno"
                                        >
                                            <span className="v">{dmgDisplay}</span>
                                            <span className="l">danno</span>
                                        </button>
                                        <button
                                            className="w-atk2-roll"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openAttackPicker(undefined, atk.name,
                                                    [
                                                        ...(atk.useBab ? [{ label: 'BAB', value: getTotalBab() }] : []),
                                                        ...(atk.attackStat ? [{ label: `Mod. ${atk.attackStat.toUpperCase()}`, value: getStatModifier(atk.attackStat) }] : []),
                                                        ...(atk.attackBonusExtra ? [{ label: 'Bonus extra', value: atk.attackBonusExtra }] : []),
                                                    ],
                                                    [
                                                        ...(atk.damageStat ? [{ label: `Mod. ${atk.damageStat.toUpperCase()}`, value: getStatModifier(atk.damageStat) }] : []),
                                                        ...(atk.damageBonusExtra ? [{ label: 'Bonus extra', value: atk.damageBonusExtra }] : []),
                                                    ],
                                                    { isRanged: !!atk.range, customAttackName: atk.name, subtitle: meta, baseDice: atk.damageDice });
                                            }}
                                            title="Apri tiro"
                                            aria-label="Apri tiro"
                                        >
                                            <DndIcon category="dice" name="d20" size={icoMd} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {picker && (
                <RollPickerModal
                    title={picker.title}
                    subtitle={picker.subtitle}
                    segments={picker.segments}
                    onClose={() => setPicker(null)}
                />
            )}
        </div>
    );
};
