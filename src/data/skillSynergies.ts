/**
 * D&D 3.5 SRD Skill Synergies.
 *
 * Rule: if a character has ≥5 ranks in the *source* skill they gain a +2
 * synergy bonus on checks with the *target* skill (possibly context-limited).
 *
 * Reference: d20 SRD 3.5 — "Skill Synergies" table.
 *
 * Names are matched case-insensitively against character.skills[*].name.
 * Both Italian (preset) and English (fallback) name variants are listed for
 * each entry so the matcher is locale-agnostic.
 */

import type { Skill } from '../types/dnd';
import type { CustomSkillSynergy } from '../types/dnd';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillSynergy {
    /** Normalised lowercase names that identify the *source* skill. */
    sourceNames: string[];
    /** Normalised lowercase names that identify the *target* skill. */
    targetNames: string[];
    /** Minimum ranks needed in the source skill (SRD default: 5). */
    ranksRequired: number;
    /** Bonus granted to the target skill (SRD default: +2). */
    bonus: number;
    /**
     * i18n key **suffix** for the optional context description.
     * Full key: `synergy.conditions.<conditionKey>`.
     * Undefined → no context restriction.
     */
    conditionKey?: string;
}

export interface ActiveSynergy {
    /** Name of the source skill providing the bonus. */
    sourceName: string;
    /** Bonus value (always +2 per SRD). */
    bonus: number;
    /** Optional i18n key suffix for the condition label. */
    conditionKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SRD synergy table
// ─────────────────────────────────────────────────────────────────────────────

export const SKILL_SYNERGIES: SkillSynergy[] = [
    // ── Raggirare / Bluff ────────────────────────────────────────────────────
    {
        sourceNames: ['raggirare', 'bluff'],
        targetNames: ['camuffare', 'disguise'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'bluff_disguise',
    },
    {
        sourceNames: ['raggirare', 'bluff'],
        targetNames: ['intimidire', 'intimidate'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'bluff_intimidate',
    },
    {
        sourceNames: ['raggirare', 'bluff'],
        targetNames: ['rapidità di mano', 'sleight of hand'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'bluff_sleight',
    },

    // ── Decifrare Scritture / Decipher Script ────────────────────────────────
    {
        sourceNames: ['decifrare scritture', 'decipher script'],
        targetNames: ['utilizzare oggetti magici', 'use magic device'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'decipherscript_umd',
    },

    // ── Artista della Fuga / Escape Artist ───────────────────────────────────
    {
        sourceNames: ['artista della fuga', 'escape artist'],
        targetNames: ['utilizzare corde', 'use rope'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'escapartist_userope',
    },

    // ── Addestrare Animali / Handle Animal ───────────────────────────────────
    {
        sourceNames: ['addestrare animali', 'handle animal'],
        targetNames: ['cavalcare', 'ride'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'handleanimal_ride',
    },

    // ── Saltare / Jump ───────────────────────────────────────────────────────
    {
        sourceNames: ['saltare', 'jump'],
        targetNames: ['acrobazia', 'capriole', 'tumble'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'jump_tumble',
    },

    // ── Conoscenze Arcane / Knowledge (Arcana) ───────────────────────────────
    {
        sourceNames: ['conoscenze arcane', 'conoscenza arcana', 'knowledge (arcana)', 'knowledge arcana'],
        targetNames: ['sapienza magica', 'spellcraft'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knarcana_spellcraft',
    },

    // ── Conoscenze Architettura / Knowledge (Architecture) ───────────────────
    {
        sourceNames: ['conoscenze architettura', 'conoscenza architettura', 'knowledge (architecture and engineering)', 'knowledge architecture'],
        targetNames: ['cercare', 'search'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knarchitecture_search',
    },

    // ── Conoscenze Dungeon / Knowledge (Dungeoneering) ───────────────────────
    {
        sourceNames: ['conoscenze dungeon', 'conoscenza dungeon', 'knowledge (dungeoneering)', 'knowledge dungeoneering'],
        targetNames: ['sopravvivenza', 'survival'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'kndungeon_survival',
    },

    // ── Conoscenze Geografia / Knowledge (Geography) ─────────────────────────
    {
        sourceNames: ['conoscenze geografia', 'conoscenza geografia', 'knowledge (geography)', 'knowledge geography'],
        targetNames: ['sopravvivenza', 'survival'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'kngeography_survival',
    },

    // ── Conoscenze Locali / Knowledge (Local) ────────────────────────────────
    {
        sourceNames: ['conoscenze locali', 'conoscenza locale', 'knowledge (local)', 'knowledge local'],
        targetNames: ['raccogliere informazioni', 'gather information'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knlocal_gatherinfo',
    },

    // ── Conoscenze Natura / Knowledge (Nature) ───────────────────────────────
    {
        sourceNames: ['conoscenze natura', 'conoscenza natura', 'knowledge (nature)', 'knowledge nature'],
        targetNames: ['sopravvivenza', 'survival'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knnature_survival',
    },
    {
        sourceNames: ['conoscenze natura', 'conoscenza natura', 'knowledge (nature)', 'knowledge nature'],
        targetNames: ['addestrare animali', 'handle animal'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knnature_handleanimal',
    },

    // ── Conoscenze Nobiltà / Knowledge (Nobility) ────────────────────────────
    {
        sourceNames: ['conoscenze nobiltà e regalità', 'conoscenza nobiltà', 'knowledge (nobility and royalty)', 'knowledge nobility'],
        targetNames: ['diplomazia', 'diplomacy'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knnobility_diplomacy',
    },

    // ── Conoscenze Piani / Knowledge (The Planes) ────────────────────────────
    {
        sourceNames: ['conoscenze piani', 'conoscenza piani', 'knowledge (the planes)', 'knowledge planes'],
        targetNames: ['sopravvivenza', 'survival'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'knplanes_survival',
    },

    // ── Cercare / Search ─────────────────────────────────────────────────────
    {
        sourceNames: ['cercare', 'search'],
        targetNames: ['sopravvivenza', 'survival'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'search_survival',
    },

    // ── Percepire Intenzioni / Sense Motive ──────────────────────────────────
    {
        sourceNames: ['percepire intenzioni', 'sense motive'],
        targetNames: ['diplomazia', 'diplomacy'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'sensemotive_diplomacy',
    },

    // ── Sapienza Magica / Spellcraft ──────────────────────────────────────────
    {
        sourceNames: ['sapienza magica', 'spellcraft'],
        targetNames: ['utilizzare oggetti magici', 'use magic device'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'spellcraft_umd',
    },

    // ── Sopravvivenza / Survival ──────────────────────────────────────────────
    {
        sourceNames: ['sopravvivenza', 'survival'],
        targetNames: ['conoscenze natura', 'conoscenza natura', 'knowledge (nature)', 'knowledge nature'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'survival_knnature',
    },

    // ── Acrobazia / Tumble ───────────────────────────────────────────────────
    {
        sourceNames: ['acrobazia', 'capriole', 'tumble'],
        targetNames: ['equilibrio', 'balance'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'tumble_balance',
    },
    {
        sourceNames: ['acrobazia', 'capriole', 'tumble'],
        targetNames: ['saltare', 'jump'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'tumble_jump',
    },

    // ── Utilizzare Oggetti Magici / Use Magic Device ──────────────────────────
    {
        sourceNames: ['utilizzare oggetti magici', 'use magic device'],
        targetNames: ['sapienza magica', 'spellcraft'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'umd_spellcraft',
    },

    // ── Utilizzare Corde / Use Rope ───────────────────────────────────────────
    {
        sourceNames: ['utilizzare corde', 'use rope'],
        targetNames: ['scalare', 'climb'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'userope_climb',
    },
    {
        sourceNames: ['utilizzare corde', 'use rope'],
        targetNames: ['artista della fuga', 'escape artist'],
        ranksRequired: 5, bonus: 2,
        conditionKey: 'userope_escapartist',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Case-insensitive match: exact or prefix (handles "Conoscenze Natura (foresta)" etc.) */
function nameMatches(skillName: string, candidates: string[]): boolean {
    const n = skillName.trim().toLowerCase();
    return candidates.some(c => n === c || n.startsWith(c + ' ') || n.startsWith(c + '('));
}

/**
 * Compute all active SRD synergy bonuses for a *target* skill.
 *
 * @param targetSkillId   - The character skill ID of the target.
 * @param targetSkillName - The character skill name (matched against SRD aliases).
 * @param allSkills       - Full character skill map.
 * @param managedSkillIds - Skill IDs whose synergies are fully user-managed.
 *                          SRD computation is suppressed when the target OR any
 *                          source skill appears in this list (user custom entries
 *                          take over completely, avoiding double-counting).
 */
export function computeSynergyBonuses(
    targetSkillId: string,
    targetSkillName: string,
    allSkills: Record<string, Skill>,
    managedSkillIds: string[] = [],
): ActiveSynergy[] {
    // If this target is user-managed, skip SRD entirely (custom list is authoritative).
    if (managedSkillIds.includes(targetSkillId)) return [];

    const result: ActiveSynergy[] = [];

    for (const syn of SKILL_SYNERGIES) {
        if (!nameMatches(targetSkillName, syn.targetNames)) continue;

        for (const skill of Object.values(allSkills)) {
            if (!nameMatches(skill.name, syn.sourceNames)) continue;
            if ((skill.ranks ?? 0) < syn.ranksRequired) continue;
            // If this source skill is user-managed, its synergies live in customSynergies.
            if (managedSkillIds.includes(skill.id)) continue;
            result.push({
                sourceName: skill.name,
                bonus: syn.bonus,
                conditionKey: syn.conditionKey,
            });
        }
    }

    return result;
}

/**
 * Returns SRD synergies that involve `skillId`/`skillName` (as source OR target),
 * resolved against the character's actual skill map and returned as
 * `CustomSkillSynergy` objects for pre-loading in the edit modal.
 *
 * Uses stable IDs in the form `srd-{sourceId}-{targetId}` so existing
 * pre-loaded entries can be de-duplicated against already-stored custom entries.
 */
export function getSrdSynergiesForCharacterSkill(
    skillId: string,
    skillName: string,
    allSkills: Record<string, Skill>,
): CustomSkillSynergy[] {
    const result: CustomSkillSynergy[] = [];
    const seen = new Set<string>();

    for (const syn of SKILL_SYNERGIES) {
        const isSource = nameMatches(skillName, syn.sourceNames);
        const isTarget = nameMatches(skillName, syn.targetNames);

        if (isSource) {
            for (const tgt of Object.values(allSkills)) {
                if (tgt.id === skillId) continue;
                if (!nameMatches(tgt.name, syn.targetNames)) continue;
                const id = `srd-${skillId}-${tgt.id}`;
                if (seen.has(id)) continue;
                seen.add(id);
                result.push({ id, sourceSkillId: skillId, targetSkillId: tgt.id, ranksRequired: syn.ranksRequired, bonus: syn.bonus, note: syn.conditionKey });
            }
        }
        if (isTarget) {
            for (const src of Object.values(allSkills)) {
                if (src.id === skillId) continue;
                if (!nameMatches(src.name, syn.sourceNames)) continue;
                const id = `srd-${src.id}-${skillId}`;
                if (seen.has(id)) continue;
                seen.add(id);
                result.push({ id, sourceSkillId: src.id, targetSkillId: skillId, ranksRequired: syn.ranksRequired, bonus: syn.bonus, note: syn.conditionKey });
            }
        }
    }

    return result;
}

/**
 * Returns all SRD synergy rules involving `skillName` (as source OR target)
 * as plain objects using canonical SRD name aliases.
 * Used by the BackOffice to pre-populate a catalog skill's synergy list.
 */
export function getSrdSynergiesInvolvingSkill(
    skillName: string,
): Array<{ sourceSkillName: string; targetSkillName: string; ranksRequired: number; bonus: number; note?: string }> {
    const result: Array<{ sourceSkillName: string; targetSkillName: string; ranksRequired: number; bonus: number; note?: string }> = [];
    const seen = new Set<string>();

    for (const syn of SKILL_SYNERGIES) {
        const isSource = nameMatches(skillName, syn.sourceNames);
        const isTarget = nameMatches(skillName, syn.targetNames);

        if (isSource) {
            const key = `${skillName}|${syn.targetNames[0]}`;
            if (!seen.has(key)) { seen.add(key); result.push({ sourceSkillName: skillName, targetSkillName: syn.targetNames[0], ranksRequired: syn.ranksRequired, bonus: syn.bonus, note: syn.conditionKey }); }
        }
        if (isTarget) {
            const key = `${syn.sourceNames[0]}|${skillName}`;
            if (!seen.has(key)) { seen.add(key); result.push({ sourceSkillName: syn.sourceNames[0], targetSkillName: skillName, ranksRequired: syn.ranksRequired, bonus: syn.bonus, note: syn.conditionKey }); }
        }
    }

    return result;
}

/**
 * Returns all SRD synergy rules in which the given skill is the *source*.
 * Used in the BackOffice to display "what bonuses this skill can grant".
 */
export function getSynergyGrantsFor(
    sourceSkillName: string,
): Array<{ targetNames: string[]; conditionKey?: string; bonus: number; ranksRequired: number }> {
    const n = sourceSkillName.trim().toLowerCase();
    return SKILL_SYNERGIES.filter(syn =>
        syn.sourceNames.some(s => n === s || n.startsWith(s + ' ') || n.startsWith(s + '(')),
    ).map(syn => ({
        targetNames: syn.targetNames,
        conditionKey: syn.conditionKey,
        bonus: syn.bonus,
        ranksRequired: syn.ranksRequired,
    }));
}

/**
 * Returns all SRD synergy rules in which the given skill is the *target*.
 * Used in the BackOffice to display "what bonuses this skill can receive".
 */
export function getSynergyReceiversFor(
    targetSkillName: string,
): Array<{ sourceNames: string[]; conditionKey?: string; bonus: number; ranksRequired: number }> {
    const n = targetSkillName.trim().toLowerCase();
    return SKILL_SYNERGIES.filter(syn =>
        syn.targetNames.some(t => n === t || n.startsWith(t + ' ') || n.startsWith(t + '(')),
    ).map(syn => ({
        sourceNames: syn.sourceNames,
        conditionKey: syn.conditionKey,
        bonus: syn.bonus,
        ranksRequired: syn.ranksRequired,
    }));
}

/**
 * Compute active custom (user-defined) synergy bonuses for a *target* skill.
 * A custom synergy is active when the source skill exists AND has ≥ ranksRequired ranks.
 */
export function computeCustomSynergyBonuses(
    targetSkillId: string,
    allSkills: Record<string, Skill>,
    customSynergies: CustomSkillSynergy[],
): ActiveSynergy[] {
    return customSynergies
        .filter(syn => syn.targetSkillId === targetSkillId)
        .flatMap(syn => {
            const source = allSkills[syn.sourceSkillId];
            if (!source || (source.ranks ?? 0) < syn.ranksRequired) return [];
            return [{
                sourceName: source.name,
                bonus: syn.bonus,
                conditionKey: syn.note ? undefined : undefined,
            }];
        });
}
