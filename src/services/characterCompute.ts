/**
 * Pure computation helpers for CharacterBase.
 * Mirrors the logic in `characterStore.ts` but without Zustand — accepts
 * a CharacterBase object and returns computed values.  Used by read-only
 * views such as MasterCharacterViewer.
 */
import type { CharacterBase, ModifierType, StatType } from '../types/dnd';
import { computeClassBab, computeClassSaveBase, getExpectedHpForClassLevel } from '../types/dnd';
import { computeSynergyBonuses, computeCustomSynergyBonuses } from '../data/skillSynergies';
import { resolveStatOverride } from './modifiers';

type SaveKey = 'fortitude' | 'reflex' | 'will';
const SAVE_TO_STAT: Record<SaveKey, StatType> = { fortitude: 'con', reflex: 'dex', will: 'wis' };
const SAVE_TO_PROG_FIELD: Record<SaveKey, 'fortSave' | 'refSave' | 'willSave'> = {
    fortitude: 'fortSave', reflex: 'refSave', will: 'willSave',
};

// ─── Stacking helpers ────────────────────────────────────────────────────────

function doesModifierStack(type: ModifierType): boolean {
    return ['dodge', 'circumstance', 'untyped', 'synergy'].includes(type);
}

function aggregateMods(mods: { type: ModifierType; value: number }[]): number {
    const byType: Record<string, number[]> = {};
    mods.forEach(m => { (byType[m.type] ||= []).push(m.value); });
    let total = 0;
    Object.entries(byType).forEach(([type, values]) => {
        if (doesModifierStack(type as ModifierType)) {
            total += values.reduce((s, v) => s + v, 0);
        } else {
            const pos = values.filter(v => v > 0);
            const neg = values.filter(v => v < 0);
            if (pos.length) total += Math.max(...pos);
            if (neg.length) total += Math.min(...neg);
        }
    });
    return total;
}

// ─── Core stat computations ──────────────────────────────────────────────────

export function calcStatMod(score: number): number {
    return Math.floor((score - 10) / 2);
}

/** Returns the active-modifier delta for a target on a character. */
function activeModDelta(char: CharacterBase, target: string): number {
    const list = (char.activeModifiers ?? []).filter(m => !m.paused && m.target === target);
    if (list.length === 0) return 0;
    return aggregateMods(list.map(m => ({ type: m.type, value: m.value })));
}

/**
 * Compute the effective (post-modifier) value of a stat — same logic as
 * `useCharacterStore.getEffectiveStat`.
 */
export function computeEffectiveStat(char: CharacterBase, target: StatType | string): number {
    // Saving throws
    if (target === 'fortitude' || target === 'reflex' || target === 'will') {
        return computeSaveTotal(char, target as SaveKey) + activeModDelta(char, target);
    }

    // Initiative = DEX mod + active modifiers
    if (target === 'initiative') {
        return computeStatMod(char, 'dex') + activeModDelta(char, 'initiative');
    }

    let baseValue = 0;
    if (target in char.baseStats) {
        baseValue = (char.baseStats as Record<string, number>)[target] || 0;
    } else if (target === 'ac') {
        baseValue = 10;
    }

    const mods: { type: ModifierType; value: number; source?: string }[] = [];

    // Equipped items
    char.inventory.forEach(item => {
        if (!item.equipped) return;
        item.modifiers.filter(m => m.target === target).forEach(m => mods.push(m));
        // Auto-promote armorDetails bonus to AC
        if (target === 'ac' && item.armorDetails && typeof item.armorDetails.armorBonus === 'number' && item.armorDetails.armorBonus !== 0) {
            const modType: ModifierType =
                item.type === 'shield' ? 'shield' :
                    item.type === 'protectiveItem' ? 'deflection' :
                        'enhancement';
            mods.push({ target: 'ac', value: item.armorDetails.armorBonus, type: modType, source: item.name });
        }
    });

    // Active feats
    char.feats.forEach(feat => {
        if (feat.active) feat.modifiers.filter(m => m.target === target).forEach(m => mods.push(m));
    });

    // Active class features
    (char.classFeatures ?? []).forEach(cf => {
        if (cf.active) (cf.modifiers ?? []).filter(m => m.target === target).forEach(m => mods.push(m));
    });

    // AC: add DEX mod (capped by max dex from armors)
    if (target === 'ac') {
        const dexScore = computeEffectiveStat(char, 'dex');
        let dexMod = calcStatMod(dexScore);
        let maxDexCap: number | undefined;
        char.inventory.forEach(item => {
            if (item.equipped && item.armorDetails && typeof item.armorDetails.maxDex === 'number') {
                maxDexCap = maxDexCap === undefined
                    ? item.armorDetails.maxDex
                    : Math.min(maxDexCap, item.armorDetails.maxDex);
            }
        });
        if (maxDexCap !== undefined) dexMod = Math.min(dexMod, maxDexCap);
        mods.push({ target: 'ac', value: dexMod, type: 'untyped', source: 'dex' });
    }

    let bonus = aggregateMods(mods);
    bonus += activeModDelta(char, target);

    return baseValue + bonus;
}

/** Compute the ability modifier for a stat. */
export function computeStatMod(char: CharacterBase, stat: StatType): number {
    return calcStatMod(computeEffectiveStat(char, stat));
}

/** Compute total BAB from classLevels if present, else fall back to baseStats.bab. */
export function computeTotalBab(char: CharacterBase): number {
    const levels = char.classLevels;
    if (levels && levels.length > 0) {
        return levels.reduce((sum, cl) => sum + computeClassBab(cl.level, cl.babProgression), 0);
    }
    return char.baseStats.bab || 0;
}

/** Compute base saving throw bonus from classLevels. */
function computeClassBaseSave(char: CharacterBase, save: SaveKey): number {
    const levels = char.classLevels ?? [];
    const field = SAVE_TO_PROG_FIELD[save];
    return levels.reduce((sum, cl) => sum + computeClassSaveBase(cl.level, cl[field] ?? 'poor'), 0);
}

/** Compute saving throw total. */
function computeSaveTotal(char: CharacterBase, save: SaveKey): number {
    const stored = char.savingThrows?.[save] ?? { base: 0, ability: 0, magic: 0, misc: 0 };
    const hasClasses = (char.classLevels?.length ?? 0) > 0;
    const base = hasClasses ? computeClassBaseSave(char, save) : (stored.base ?? 0);
    const ability = hasClasses ? computeStatMod(char, SAVE_TO_STAT[save]) : (stored.ability ?? 0);
    const magic = stored.magic ?? 0;
    const misc = stored.misc ?? 0;
    return base + ability + magic + misc;
}

/** Full save breakdown (same as store.getSaveBreakdown). */
export function computeSaveBreakdown(char: CharacterBase, save: SaveKey): { base: number; ability: number; magic: number; misc: number; total: number } {
    const stored = char.savingThrows?.[save] ?? { base: 0, ability: 0, magic: 0, misc: 0 };
    const hasClasses = (char.classLevels?.length ?? 0) > 0;
    const base = hasClasses ? computeClassBaseSave(char, save) : (stored.base ?? 0);
    const ability = hasClasses ? computeStatMod(char, SAVE_TO_STAT[save]) : (stored.ability ?? 0);
    const magic = stored.magic ?? 0;
    const misc = stored.misc ?? 0;
    return { base, ability, magic, misc, total: base + ability + magic + misc };
}

/** Compute total max HP (classLevels log-based or baseStats.hp). */
export function computeTotalMaxHp(char: CharacterBase): number {
    const levels = char.classLevels ?? [];
    const log = char.hpLevelLog ?? [];
    if (levels.length === 0 || log.length === 0) {
        // Fallback: use raw baseStats.hp
        return char.baseStats.hp ?? 0;
    }
    const conMod = computeStatMod(char, 'con');
    const classMap = new Map(levels.map(cl => [cl.id, cl]));
    const hpFromDice = log.reduce((sum, entry, idx) => {
        const cl = classMap.get(entry.classId);
        const die = cl?.hitDie ?? 0;
        if (!die) return sum;
        return sum + getExpectedHpForClassLevel(die, idx + 1);
    }, 0);
    return hpFromDice + conMod * log.length;
}

/** Compute initiative bonus. */
export function computeInitiative(char: CharacterBase): number {
    return computeEffectiveStat(char, 'initiative');
}

/** Compute the effective total for a skill (with modifiers and synergies). */
export function computeSkillTotal(char: CharacterBase, skillId: string): number {
    const skill = char.skills[skillId];
    if (!skill) return 0;

    const skillCtx = { channel: `skill.${skillId}`, skillId, skillName: skill.name };
    const statOverride = resolveStatOverride(char, skillCtx, (s) => computeStatMod(char, s));
    const statMod = computeStatMod(char, statOverride ?? skill.stat);

    let total = skill.ranks + statMod;

    const nameLower = skill.name.toLowerCase();
    const isSkillTarget = (t: string) => {
        const tl = t.toLowerCase();
        return tl === `skill.${skillId}` || tl === `skill.${nameLower}`;
    };

    const allMods: { type: ModifierType; value: number }[] = [];
    char.inventory.forEach(item => {
        if (item.equipped) item.modifiers.filter(m => isSkillTarget(m.target)).forEach(m => allMods.push(m));
    });
    char.feats.forEach(feat => {
        if (feat.active) feat.modifiers.filter(m => isSkillTarget(m.target)).forEach(m => allMods.push(m));
    });
    (char.classFeatures ?? []).forEach(cf => {
        if (cf.active) (cf.modifiers ?? []).filter(m => isSkillTarget(m.target)).forEach(m => allMods.push(m));
    });

    total += aggregateMods(allMods);
    total += activeModDelta(char, `skill.${skillId}`);
    total += activeModDelta(char, `skill.${nameLower}`);

    const synergies = computeSynergyBonuses(skillId, skill.name, char.skills, char.managedSynergySkillIds ?? []);
    total += synergies.reduce((s, syn) => s + syn.bonus, 0);
    const customSyn = computeCustomSynergyBonuses(skillId, char.skills, char.customSynergies ?? []);
    total += customSyn.reduce((s, syn) => s + syn.bonus, 0);

    return total;
}

/** Returns multiple attack bonuses [+8, +3, …]. */
export function computeMultipleAttacks(char: CharacterBase): number[] {
    const bab = computeTotalBab(char);
    const attacks: number[] = [bab];
    let next = bab - 5;
    while (next > 0 && attacks.length < 4) {
        attacks.push(next);
        next -= 5;
    }
    return attacks;
}
