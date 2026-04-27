/**
 * Engine for resolving conditional modifiers from items / feats / class features
 * against a roll context (attack, save, skill, ability check, AC, …).
 *
 * Backward-compatible with legacy `Modifier.target` strings: when a modifier
 * has no `appliesTo`, the legacy `target` is mapped onto the new `RollChannel`
 * scheme on the fly.
 */
import type {
    CharacterBase, Item, Feat, ClassFeature, Modifier, ModifierType,
    RollChannel, ModifierCondition, StatType, ActiveModifier,
} from '../types/dnd';

// ──────────────────────────────────────────────────────────────────────────────
// Roll context
// ──────────────────────────────────────────────────────────────────────────────

export type RollContext =
    | { channel: 'attack' | 'damage'; weapon?: Item; customAttackName?: string; isRanged?: boolean; isThrown?: boolean }
    | { channel: 'ac' }
    | { channel: 'initiative' }
    | { channel: 'save.fort' | 'save.ref' | 'save.will' }
    | { channel: `check.${StatType}` }
    | { channel: `skill.${string}`; skillId: string; skillName: string }
    | { channel: 'cmb' | 'cmd' }
    | {
        channel: 'spell.attack' | 'spell.damage' | 'spell.dc';
        spellId: string;
        spellName: string;
        spellLevel: number;
        spellSchool?: string;
        spellDamageType?: string;
        attackMode?: 'none' | 'rangedTouch' | 'meleeTouch' | 'ray' | 'normal';
    };

/** A modifier source candidate ready to be displayed in the roll picker. */
export interface ModifierCandidate {
    id: string;                 // unique row id (sourceKind:sourceId:index)
    sourceKind: 'item' | 'feat' | 'feature' | 'active';
    sourceId: string;
    sourceName: string;
    value: number;
    type: ModifierType;
    /** Optional extra damage dice (e.g. `"1d6"`). Currently only damage
     *  channel uses it; other channels keep it undefined. */
    extraDice?: string;
    /** When set, the default ability stat for this roll is replaced by this
     *  stat (e.g. Weapon Finesse: `statOverride = 'dex'`). */
    statOverride?: StatType;
    /** Auto-applies (no manual confirmation needed): all auto conditions match,
     *  scope ≠ conditional, no manualPrompt. */
    auto: boolean;
    /** Human-readable explanation (conditions list / manual prompt). */
    label: string;
    /** When false, conditions exist but did NOT all match → not selectable. */
    available: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Legacy `target` → RollChannel translation
// ──────────────────────────────────────────────────────────────────────────────

const SAVE_TARGET_TO_CHANNEL: Record<string, RollChannel> = {
    fortitude: 'save.fort', reflex: 'save.ref', will: 'save.will',
};

/** Returns the channels a modifier feeds into. Honors `appliesTo` first,
 *  falls back to the legacy `target` mapping. */
export function modifierChannels(mod: Modifier): RollChannel[] {
    if (mod.appliesTo && mod.appliesTo.length > 0) return [...mod.appliesTo];
    const t = (mod.target || '').trim();
    if (!t) return [];
    const tl = t.toLowerCase();
    // skill.xxx → keep as-is
    if (tl.startsWith('skill.')) return [tl as RollChannel];
    if (tl.startsWith('spell.')) return [tl as RollChannel];
    // saves
    if (tl in SAVE_TARGET_TO_CHANNEL) return [SAVE_TARGET_TO_CHANNEL[tl]];
    // direct channel match
    if (
        tl === 'attack' || tl === 'damage' || tl === 'ac' || tl === 'initiative'
        || tl === 'cmb' || tl === 'cmd'
        || tl === 'spell.attack' || tl === 'spell.damage' || tl === 'spell.dc'
        || tl.startsWith('check.') || tl.startsWith('save.')
    ) return [tl as RollChannel];
    // raw stat (str, dex, …) → the underlying stat AND its check.<stat>
    // We expose it ONLY on the stat-itself (used by getEffectiveStat) so that
    // ability checks pick it up via the base stat too. We do NOT auto-feed
    // raw stats into `attack` to avoid double-counting (BAB/STR are added
    // separately by the widget).
    return [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Condition matching
// ──────────────────────────────────────────────────────────────────────────────

const ciIncludes = (haystack: string | undefined, needle: string) =>
    !!haystack && haystack.toLowerCase().includes(needle.toLowerCase());

function isThrownWeapon(w?: Item): boolean {
    if (!w?.weaponDetails) return false;
    const cat = (w.weaponDetails.category ?? '').toLowerCase();
    if (cat.includes('lancio') || cat.includes('thrown')) return true;
    // Heuristic: a weapon with rangeIncrement AND melee category is "thrown"
    return false;
}

/** Returns `true` only if EVERY condition in `mod.conditions` matches `ctx`.
 *  An empty / undefined list always matches. */
export function conditionsMatch(mod: Modifier, ctx: RollContext): boolean {
    const conds = mod.conditions ?? [];
    if (conds.length === 0) return true;
    for (const c of conds) {
        if (!singleConditionMatches(c, ctx)) return false;
    }
    return true;
}

function singleConditionMatches(c: ModifierCondition, ctx: RollContext): boolean {
    switch (c.kind) {
        case 'weaponType': {
            if (ctx.channel !== 'attack' && ctx.channel !== 'damage') return false;
            const isRanged = !!ctx.isRanged;
            const isThrown = !!ctx.isThrown || isThrownWeapon(ctx.weapon);
            if (c.value === 'ranged') return isRanged;
            if (c.value === 'thrown') return isThrown;
            return !isRanged; // melee
        }
        case 'weaponCategory': {
            if (ctx.channel !== 'attack' && ctx.channel !== 'damage') return false;
            return ciIncludes(ctx.weapon?.weaponDetails?.category, c.value);
        }
        case 'weaponName': {
            if (ctx.channel !== 'attack' && ctx.channel !== 'damage') return false;
            return ciIncludes(ctx.weapon?.name, c.value)
                || ciIncludes(ctx.customAttackName, c.value);
        }
        case 'damageType': {
            if (ctx.channel !== 'attack' && ctx.channel !== 'damage') return false;
            return ciIncludes(ctx.weapon?.weaponDetails?.damageType, c.value);
        }
        case 'skillId': {
            if (!ctx.channel.startsWith('skill.')) return false;
            const sc = ctx as Extract<RollContext, { channel: `skill.${string}` }>;
            const v = c.value.toLowerCase();
            return sc.skillId.toLowerCase() === v
                || sc.skillName.toLowerCase() === v;
        }
        case 'saveType': {
            return ctx.channel === `save.${c.value}`;
        }
        case 'abilityStat': {
            return ctx.channel === `check.${c.value}`;
        }
        case 'spellSchool': {
            if (!ctx.channel.startsWith('spell.')) return false;
            const sc = ctx as Extract<RollContext, { channel: 'spell.attack' | 'spell.damage' | 'spell.dc' }>;
            return ciIncludes(sc.spellSchool, c.value);
        }
        case 'spellName': {
            if (!ctx.channel.startsWith('spell.')) return false;
            const sc = ctx as Extract<RollContext, { channel: 'spell.attack' | 'spell.damage' | 'spell.dc' }>;
            return ciIncludes(sc.spellName, c.value);
        }
        case 'spellDamageType': {
            if (!ctx.channel.startsWith('spell.')) return false;
            const sc = ctx as Extract<RollContext, { channel: 'spell.attack' | 'spell.damage' | 'spell.dc' }>;
            return ciIncludes(sc.spellDamageType, c.value);
        }
        case 'spellMinLevel': {
            if (!ctx.channel.startsWith('spell.')) return false;
            const sc = ctx as Extract<RollContext, { channel: 'spell.attack' | 'spell.damage' | 'spell.dc' }>;
            return sc.spellLevel >= c.value;
        }
    }
    return false;
}

function describeConditions(mod: Modifier): string {
    const parts: string[] = [];
    for (const c of mod.conditions ?? []) {
        switch (c.kind) {
            case 'weaponType':
                parts.push(c.value === 'melee' ? 'in mischia' : c.value === 'ranged' ? 'a distanza' : 'da lancio');
                break;
            case 'weaponCategory': parts.push(`armi ${c.value}`); break;
            case 'weaponName': parts.push(`con ${c.value}`); break;
            case 'damageType': parts.push(`danno ${c.value}`); break;
            case 'skillId': parts.push(`solo ${c.value}`); break;
            case 'saveType': parts.push(`solo TS ${c.value}`); break;
            case 'abilityStat': parts.push(`solo prove di ${c.value.toUpperCase()}`); break;
            case 'spellSchool': parts.push(`scuola ${c.value}`); break;
            case 'spellName': parts.push(`incantesimo ${c.value}`); break;
            case 'spellDamageType': parts.push(`magia di ${c.value}`); break;
            case 'spellMinLevel': parts.push(`liv. magia ≥ ${c.value}`); break;
        }
    }
    if (mod.manualPrompt) parts.unshift(mod.manualPrompt);
    return parts.join(' · ');
}

// ──────────────────────────────────────────────────────────────────────────────
// Candidate collection
// ──────────────────────────────────────────────────────────────────────────────

function feedsChannel(mod: Modifier, channel: RollChannel, ctx: RollContext): boolean {
    const channels = modifierChannels(mod);
    if (channels.length === 0) return false;
    // Special case: `skill.<id>` and `skill.<name>` are interchangeable.
    if (channel.startsWith('skill.') && ctx.channel.startsWith('skill.')) {
        const sc = ctx as Extract<RollContext, { channel: `skill.${string}` }>;
        const wanted = new Set([
            `skill.${sc.skillId.toLowerCase()}`,
            `skill.${sc.skillName.toLowerCase()}`,
        ]);
        return channels.some(c => wanted.has(c.toLowerCase()));
    }
    return channels.includes(channel);
}

function makeCandidate(
    mod: Modifier,
    parent: { kind: ModifierCandidate['sourceKind']; id: string; name: string },
    ctx: RollContext,
    index: number,
): ModifierCandidate {
    const condsOk = conditionsMatch(mod, ctx);
    const hasConds = (mod.conditions?.length ?? 0) > 0;
    const isManual = !!mod.manualPrompt || mod.scope === 'conditional';
    const auto = condsOk && !isManual;
    const label = describeConditions(mod) || (hasConds ? '(condizione)' : '');
    return {
        id: `${parent.kind}:${parent.id}:${index}`,
        sourceKind: parent.kind,
        sourceId: parent.id,
        sourceName: parent.name,
        value: mod.value,
        type: mod.type,
        extraDice: mod.extraDice,
        statOverride: mod.statOverride,
        auto,
        label,
        available: condsOk,
    };
}

/** Collects every modifier (from inventory items, feats, class features and
 *  user-managed active modifiers) that may apply to `channel` under `ctx`.
 *  Inactive sources (unequipped / disabled) are filtered out. */
export function collectModifierCandidates(
    character: CharacterBase,
    ctx: RollContext,
): ModifierCandidate[] {
    const out: ModifierCandidate[] = [];
    const channel = ctx.channel;

    character.inventory.forEach(item => {
        if (!item.equipped) return;
        item.modifiers.forEach((m, i) => {
            if (!feedsChannel(m, channel, ctx)) return;
            out.push(makeCandidate(m, { kind: 'item', id: item.id, name: item.name }, ctx, i));
        });
    });

    character.feats.forEach(feat => {
        if (!feat.active) return;
        feat.modifiers.forEach((m, i) => {
            if (!feedsChannel(m, channel, ctx)) return;
            out.push(makeCandidate(m, { kind: 'feat', id: feat.id, name: feat.name }, ctx, i));
        });
    });

    (character.classFeatures ?? []).forEach((cf: ClassFeature) => {
        if (!cf.active) return;
        cf.modifiers.forEach((m, i) => {
            if (!feedsChannel(m, channel, ctx)) return;
            out.push(makeCandidate(m, { kind: 'feature', id: cf.id, name: cf.name }, ctx, i));
        });
    });

    // ActiveModifier (user-managed buffs): treat them like a Modifier with
    // `target = channel`. They don't carry conditions in the current model
    // so they always auto-apply unless paused.
    (character.activeModifiers ?? []).forEach((am: ActiveModifier, i) => {
        if (am.paused) return;
        const synthetic: Modifier = {
            target: am.target,
            value: am.value,
            type: am.type,
            source: am.name,
        };
        if (!feedsChannel(synthetic, channel, ctx)) {
            // Also accept legacy buff targets like 'fortitude'/'reflex'/'will' / 'str'…
            const tl = (am.target || '').toLowerCase();
            const matchesLegacy =
                (channel === 'save.fort' && tl === 'fortitude') ||
                (channel === 'save.ref' && tl === 'reflex') ||
                (channel === 'save.will' && tl === 'will') ||
                (channel === 'ac' && tl === 'ac') ||
                (channel === 'initiative' && tl === 'initiative') ||
                (channel.startsWith('check.') && channel.slice('check.'.length) === tl);
            if (!matchesLegacy) return;
        }
        out.push({
            id: `active:${am.id}:${i}`,
            sourceKind: 'active',
            sourceId: am.id,
            sourceName: am.name,
            value: am.value,
            type: am.type,
            auto: true,
            label: am.notes ? am.notes : (am.source ?? ''),
            available: true,
        });
    });

    return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stacking aggregation (3.5)
// ──────────────────────────────────────────────────────────────────────────────

const STACKS = new Set<ModifierType>(['dodge', 'circumstance', 'untyped', 'synergy']);

/** Apply 3.5 stacking rules to a list of (type, value) pairs and return the
 *  net bonus. Stacking types sum; for non-stacking types the largest positive
 *  bonus wins, but penalties of the same type all add up. */
export function aggregateBonuses(mods: { type: ModifierType; value: number }[]): number {
    const byType: Record<string, number[]> = {};
    mods.forEach(m => { (byType[m.type] ||= []).push(m.value); });
    let total = 0;
    Object.entries(byType).forEach(([type, values]) => {
        const t = type as ModifierType;
        if (STACKS.has(t)) {
            total += values.reduce((s, v) => s + v, 0);
        } else {
            const positives = values.filter(v => v > 0);
            const negatives = values.filter(v => v < 0);
            if (positives.length) total += Math.max(...positives);
            if (negatives.length) total += negatives.reduce((s, v) => s + v, 0);
        }
    });
    return total;
}

// ──────────────────────────────────────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────────────────────────────────────

export const ROLL_CHANNEL_LABELS: { value: RollChannel | string; label: string; group: string }[] = [
    { value: 'attack', label: 'Tiro per colpire', group: 'Combattimento' },
    { value: 'damage', label: 'Danno', group: 'Combattimento' },
    { value: 'ac', label: 'Classe Armatura', group: 'Difesa' },
    { value: 'initiative', label: 'Iniziativa', group: 'Combattimento' },
    { value: 'save.fort', label: 'TS Tempra', group: 'Tiri salvezza' },
    { value: 'save.ref', label: 'TS Riflessi', group: 'Tiri salvezza' },
    { value: 'save.will', label: 'TS Volontà', group: 'Tiri salvezza' },
    { value: 'spell.attack', label: 'Tiro per colpire (incantesimo)', group: 'Magie' },
    { value: 'spell.damage', label: 'Danno (incantesimo)', group: 'Magie' },
    { value: 'spell.dc', label: 'CD del tiro salvezza (incantesimo)', group: 'Magie' },
    { value: 'check.str', label: 'Prova di Forza', group: 'Caratteristiche' },
    { value: 'check.dex', label: 'Prova di Destrezza', group: 'Caratteristiche' },
    { value: 'check.con', label: 'Prova di Costituzione', group: 'Caratteristiche' },
    { value: 'check.int', label: 'Prova di Intelligenza', group: 'Caratteristiche' },
    { value: 'check.wis', label: 'Prova di Saggezza', group: 'Caratteristiche' },
    { value: 'check.cha', label: 'Prova di Carisma', group: 'Caratteristiche' },
    { value: 'cmb', label: 'CMB (manovra)', group: 'Combattimento' },
    { value: 'cmd', label: 'CMD (manovra)', group: 'Difesa' },
    // Legacy stat targets — always available
    { value: 'str', label: 'Forza (passivo)', group: 'Caratteristiche (passivo)' },
    { value: 'dex', label: 'Destrezza (passivo)', group: 'Caratteristiche (passivo)' },
    { value: 'con', label: 'Costituzione (passivo)', group: 'Caratteristiche (passivo)' },
    { value: 'int', label: 'Intelligenza (passivo)', group: 'Caratteristiche (passivo)' },
    { value: 'wis', label: 'Saggezza (passivo)', group: 'Caratteristiche (passivo)' },
    { value: 'cha', label: 'Carisma (passivo)', group: 'Caratteristiche (passivo)' },
    { value: 'hp', label: 'Punti Ferita (HP)', group: 'Vita' },
    { value: 'speed', label: 'Velocità', group: 'Vita' },
    { value: 'bab', label: 'BAB (passivo)', group: 'Combattimento' },
];

export function feat(_: unknown) { /* re-export marker */ }
export type { Feat };

// ──────────────────────────────────────────────────────────────────────────────
// Spell scaling (D&D 3.5)
// ──────────────────────────────────────────────────────────────────────────────

/** Parse a base dice expression like "1d6", "2d4+1", "1d8-1". Returns null if
 *  the spell does not scale with damage. The `mod` is preserved per die-step
 *  (e.g. "1d4+1" at CL 5 with 1/level becomes 5d4+5). */
function parseDiceExpr(expr: string): { count: number; faces: number; mod: number } | null {
    const m = expr.trim().match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i);
    if (!m) return null;
    const count = parseInt(m[1], 10);
    const faces = parseInt(m[2], 10);
    const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
    return { count, faces, mod };
}

/** Compute the damage dice expression for a spell at the given caster level
 *  and (optionally) the slot level it was prepared in.
 *
 *  Priority:
 *   1. `baseDice` — fixed base expression, always included as-is
 *   2. Legacy CL-scaling via `damagePerLevelDice` / `dicePerLevels` / `damageMaxDice`
 *      (only used when `baseDice` is absent, for backwards compat)
 *   3. `upcastDice` — extra dice added when the slot level exceeds the spell's base level
 *
 *  Returns undefined when the spell has no damage dice configured at all. */
export function computeSpellDamageDice(
    spell: {
        level?: number;
        baseDice?: string;
        damagePerLevelDice?: string;
        dicePerLevels?: number;
        damageMaxDice?: number;
        upcastDice?: string;
        upcastEveryLevels?: number;
        upcastMaxSteps?: number;
    },
    casterLevel: number,
    slotLevel?: number,
): string | undefined {
    // ── Base expression ──
    // Use the simple `baseDice` field when available; otherwise fall back to the
    // legacy CL-scaling system (kept for existing spells).
    let baseExpr: string | undefined;
    if (spell.baseDice?.trim()) {
        baseExpr = spell.baseDice.trim();
    } else if (spell.damagePerLevelDice) {
        const parsed = parseDiceExpr(spell.damagePerLevelDice);
        if (!parsed) {
            baseExpr = spell.damagePerLevelDice;
        } else {
            const per = Math.max(1, spell.dicePerLevels ?? 1);
            const cap = spell.damageMaxDice ?? Infinity;
            const baseSteps = Math.max(1, Math.floor(casterLevel / per));
            const steps = Math.min(cap, baseSteps);
            const totalCount = steps * parsed.count;
            const totalMod = steps * parsed.mod;
            const sign = totalMod === 0 ? '' : (totalMod > 0 ? `+${totalMod}` : `${totalMod}`);
            baseExpr = `${totalCount}d${parsed.faces}${sign}`;
        }
    }

    // ── Upcast contribution ──
    let upcastExpr: string | undefined;
    if (
        spell.upcastDice &&
        slotLevel !== undefined &&
        spell.level !== undefined &&
        slotLevel > spell.level
    ) {
        const parsedU = parseDiceExpr(spell.upcastDice);
        const per = Math.max(1, spell.upcastEveryLevels ?? 1);
        const stepsRaw = Math.floor((slotLevel - spell.level) / per);
        const cap = spell.upcastMaxSteps ?? Infinity;
        const steps = Math.max(0, Math.min(cap, stepsRaw));
        if (steps > 0) {
            if (!parsedU) {
                upcastExpr = `${steps}× ${spell.upcastDice}`;
            } else {
                const totalCount = steps * parsedU.count;
                const totalMod = steps * parsedU.mod;
                const sign = totalMod === 0 ? '' : (totalMod > 0 ? `+${totalMod}` : `${totalMod}`);
                upcastExpr = `${totalCount}d${parsedU.faces}${sign}`;
            }
        }
    }

    if (!baseExpr && !upcastExpr) return undefined;
    if (baseExpr && !upcastExpr) return baseExpr;
    if (!baseExpr && upcastExpr) return upcastExpr;

    // Both present: try to merge if same dice faces.
    const a = parseDiceExpr(baseExpr!);
    const b = parseDiceExpr(upcastExpr!);
    if (a && b && a.faces === b.faces) {
        const totalCount = a.count + b.count;
        const totalMod = a.mod + b.mod;
        const sign = totalMod === 0 ? '' : (totalMod > 0 ? `+${totalMod}` : `${totalMod}`);
        return `${totalCount}d${a.faces}${sign}`;
    }
    return `${baseExpr} + ${upcastExpr}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stat override resolution
// ──────────────────────────────────────────────────────────────────────────────

/** Returns the stat type that should replace the default ability modifier for
 *  the given roll context, or `null` if no active override applies.
 *  Sources: equipped items, active feats, active class features.
 *  When multiple overrides match, the one giving the highest modifier value wins
 *  (so the player always benefits from the most favourable substitution). */
export function resolveStatOverride(
    character: CharacterBase,
    ctx: RollContext,
    getStatMod: (stat: StatType) => number,
): StatType | null {
    const channel = ctx.channel;
    const overrides: { stat: StatType; modValue: number }[] = [];

    const tryMod = (mod: Modifier) => {
        if (!mod.statOverride) return;
        const channels = modifierChannels(mod);
        // For skill channels, honor both id- and name-based keys (same as feedsChannel)
        let matches = channels.includes(channel as RollChannel);
        if (!matches && channel.startsWith('skill.') && ctx.channel.startsWith('skill.')) {
            const sc = ctx as Extract<RollContext, { channel: `skill.${string}` }>;
            const wanted = new Set([
                `skill.${sc.skillId.toLowerCase()}`,
                `skill.${sc.skillName.toLowerCase()}`,
            ]);
            matches = channels.some(c => wanted.has(c.toLowerCase()));
        }
        if (!matches) return;
        if (!conditionsMatch(mod, ctx)) return;
        overrides.push({ stat: mod.statOverride, modValue: getStatMod(mod.statOverride) });
    };

    character.inventory.forEach(item => {
        if (!item.equipped) return;
        item.modifiers.forEach(tryMod);
    });
    character.feats.forEach(feat => {
        if (!feat.active) return;
        feat.modifiers.forEach(tryMod);
    });
    (character.classFeatures ?? []).forEach((cf: import('../types/dnd').ClassFeature) => {
        if (!cf.active) return;
        (cf.modifiers ?? []).forEach(tryMod);
    });

    if (overrides.length === 0) return null;
    // Pick the override that gives the best (highest) modifier value.
    return overrides.reduce((best, cur) => cur.modValue > best.modValue ? cur : best).stat;
}
