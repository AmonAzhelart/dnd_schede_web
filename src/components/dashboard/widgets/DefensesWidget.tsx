import React from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';
import { useModifierAura, ModifierArrows } from './ModifierAura';

const SAVES = [
    { key: 'fortitude', name: 'Tempra',   short: 'TEM', stat: 'COS', iconCat: 'attribute', iconName: 'saving-throw', rune: 'ᚠ' },
    { key: 'reflex',    name: 'Riflessi', short: 'RIF', stat: 'DES', iconCat: 'movement',  iconName: 'walking',       rune: 'ᚱ' },
    { key: 'will',      name: 'Volontà',  short: 'VOL', stat: 'SAG', iconCat: 'game',      iconName: 'concentration', rune: 'ᚹ' },
] as const;

export const DefensesWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, getEffectiveStat, getSaveBreakdown } = useCharacterStore();
    if (!character) return null;

    const equippedArmor = character.inventory.filter(i =>
        i.equipped && (i.type === 'armor' || i.type === 'shield' || i.type === 'protectiveItem'),
    );

    /* ── responsive tiers driven by measured pixel size ──────────────── */
    const pxW = size.pixelW || 0;
    const pxH = size.pixelH || 0;
    const tier: 'micro' | 'tight' | 'compact' | 'cozy' | 'roomy' =
        pxW < 200 || pxH < 140 ? 'micro' :
        pxW < 260 ? 'tight' :
        pxW < 340 ? 'compact' :
        pxH < 280 ? 'cozy' :
        'roomy';

    const inlineLayout   = tier === 'micro';
    const showArmorTags  = (tier === 'cozy' || tier === 'roomy') && equippedArmor.length > 0;
    const showBreakdown  = tier === 'roomy';
    const showRune       = tier !== 'micro';
    const acIconSize     = tier === 'micro' ? 22 : tier === 'tight' ? 28 : tier === 'compact' ? 34 : 42;
    const saveIconSize   = tier === 'micro' ? 12 : tier === 'tight' ? 14 : tier === 'compact' ? 16 : 18;

    const ac = getEffectiveStat('ac');
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    const acAura = useModifierAura('ac');

    return (
        <div className={`w-def-root tier-${tier} ${inlineLayout ? 'inline' : ''}`}>

            {/* ───────────── AC ─ heraldic crest ───────────── */}
            <button
                type="button"
                className={`w-def-ac ${acAura.auraClass}`}
                onClick={() => goTo?.('combat')}
                aria-label={`Classe Armatura ${ac}`}
            >
                {acAura.auraClass && <ModifierArrows delta={acAura.delta} count={4} />}
                <span className="w-def-ac-sheen" aria-hidden />
                <span className="w-def-ac-corner tl" aria-hidden />
                <span className="w-def-ac-corner tr" aria-hidden />
                <span className="w-def-ac-corner bl" aria-hidden />
                <span className="w-def-ac-corner br" aria-hidden />

                <span className="w-def-ac-crest" aria-hidden>
                    <span className="w-def-ac-crest-glow" />
                    <DndIcon category="attribute" name="ac" size={acIconSize} />
                </span>

                <span className="w-def-ac-info">
                    <span className="w-def-ac-label">Classe Armatura</span>
                    <span className="w-def-ac-value">
                        <span className="w-def-ac-digits">{ac}</span>
                        {!inlineLayout && <span className="w-def-ac-pulse" aria-hidden />}
                    </span>
                </span>

                {showArmorTags && (
                    <span className="w-def-ac-tags">
                        {equippedArmor.slice(0, 3).map(a => (
                            <span key={a.id} className="w-def-ac-tag" title={a.name}>
                                <span className="w-def-ac-tag-dot" />
                                <span className="w-def-ac-tag-name">{a.name}</span>
                                {a.armorDetails && (
                                    <span className="w-def-ac-tag-bonus">+{a.armorDetails.armorBonus}</span>
                                )}
                            </span>
                        ))}
                        {equippedArmor.length > 3 && (
                            <span className="w-def-ac-tag muted">+{equippedArmor.length - 3}</span>
                        )}
                    </span>
                )}
            </button>

            {/* ───────────── Saving throws ─ crystal trio ───────────── */}
            <div className="w-def-saves">
                {SAVES.map(save => (
                    <SaveCell
                        key={save.key}
                        save={save}
                        breakdown={getSaveBreakdown(save.key)}
                        fmt={fmt}
                        tier={tier}
                        showRune={showRune}
                        showBreakdown={showBreakdown}
                        saveIconSize={saveIconSize}
                    />
                ))}
            </div>
        </div>
    );
};

/* ────────────────────────────────────────────────────────────────────── */
/* Single saving-throw cell. Kept as its own component so the modifier   */
/* aura hook can be called once per row without breaking the rules of    */
/* hooks.                                                                 */
/* ────────────────────────────────────────────────────────────────────── */
type SaveDef = typeof SAVES[number];
type SaveBreakdown = { base: number; ability: number; magic: number; misc: number; total: number; auto: boolean };

const SaveCell: React.FC<{
    save: SaveDef;
    breakdown: SaveBreakdown;
    fmt: (n: number) => string;
    tier: 'micro' | 'tight' | 'compact' | 'cozy' | 'roomy';
    showRune: boolean;
    showBreakdown: boolean;
    saveIconSize: number;
}> = ({ save, breakdown: b, fmt, tier, showRune, showBreakdown, saveIconSize }) => {
    const { key, name, short, stat, iconCat, iconName, rune } = save;
    const aura = useModifierAura(key);
    const total = b.total + aura.delta;
    const positive = total >= 0;
    const chips: { label: string; value: string }[] = [
        { label: 'base', value: `${b.base}` },
        { label: stat,   value: fmt(b.ability) },
        ...(b.magic !== 0 ? [{ label: 'mag', value: fmt(b.magic) }] : []),
        ...(b.misc  !== 0 ? [{ label: 'alt', value: fmt(b.misc)  }] : []),
        ...(aura.delta !== 0 ? [{ label: 'mod', value: fmt(aura.delta) }] : []),
    ];
    return (
        <div
            className={`w-def-save ${key} ${positive ? 'pos' : 'neg'} ${aura.auraClass}`}
            role="group"
            aria-label={`${name} ${fmt(total)}`}
            title={chips.map(c => `${c.value} ${c.label}`).join(' · ')}
        >
            {aura.auraClass && <ModifierArrows delta={aura.delta} count={3} />}
            <span className="w-def-save-aura" aria-hidden />
            <span className="w-def-save-facet" aria-hidden />
            {showRune && <span className="w-def-save-rune" aria-hidden>{rune}</span>}

            <span className="w-def-save-head">
                <span className="w-def-save-icon">
                    <DndIcon category={iconCat} name={iconName} size={saveIconSize} />
                </span>
                <span className="w-def-save-name">
                    {tier === 'cozy' || tier === 'roomy' ? name : short}
                </span>
            </span>

            <span className="w-def-save-val">{fmt(total)}</span>

            {showBreakdown && (
                <span className="w-def-save-breakdown">
                    {chips.map((c, i) => (
                        <span key={i} className="w-def-chip">
                            <span className="w-def-chip-v">{c.value}</span>
                            <span className="w-def-chip-l">{c.label}</span>
                        </span>
                    ))}
                </span>
            )}

            <span className="w-def-save-bar" aria-hidden />
        </div>
    );
};
