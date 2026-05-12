import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { CharacterBase, ClassLevel, HpLevelLogEntry, Item, Feat, Spell, SpellSlotLevel, Modifier, ModifierType, StatType, Currency, CurrencyTransaction, Movement, HpDetails, Language, SavingThrowBreakdown, ClassFeature, PreparedSpell, ActiveModifier, DurationUnit, BestiaryEntry, ActiveSummon, ActivePet, Creature, CreatureStatOverride, CreatureRuntimeModifier, CustomSkillSynergy, NoteTab, NoteContextEntry, XpLogEntry, CompanionFeature, CompanionEquipment, TransformationEntry, ActiveTransformation, CharacterPower } from '../types/dnd';
import { computeClassBab, computeClassSaveBase, getExpectedHpForClassLevel, computeEcl, getXpForLevel, SIZE_ATTACK_MODIFIER } from '../types/dnd';
import { collectModifierCandidates, resolveStatOverride, type ModifierCandidate, type RollContext } from '../services/modifiers';
import { computeSynergyBonuses, computeCustomSynergyBonuses, type ActiveSynergy } from '../data/skillSynergies';

type SaveKey = 'fortitude' | 'reflex' | 'will';
const SAVE_TO_STAT: Record<SaveKey, StatType> = { fortitude: 'con', reflex: 'dex', will: 'wis' };
const SAVE_TO_PROG_FIELD: Record<SaveKey, 'fortSave' | 'refSave' | 'willSave'> = {
  fortitude: 'fortSave', reflex: 'refSave', will: 'willSave',
};

import { CONDITION_MODIFIERS } from '../data/conditions';

interface CharacterState {
  character: CharacterBase | null;
  setCharacter: (char: CharacterBase) => void;
  updateBaseStat: (stat: StatType, value: number) => void;
  toggleEquipItem: (itemId: string) => void;
  deleteItem: (itemId: string) => void;
  updateItem: (item: Item) => void;
  toggleFeat: (featId: string) => void;
  getEffectiveStat: (stat: StatType | string) => number;
  getStatModifier: (stat: StatType) => number;
  getEffectiveSkill: (skillId: string) => number;
  getSkillBreakdown: (skillId: string) => {
    statMod: number;
    statName: StatType;
    ranks: number;
    classBonus: number;
    sources: { source: string; value: number; type: ModifierType; kind: 'item' | 'feat' | 'feature' }[];
    /** Active D&D 3.5 synergy bonuses (each +2 from a skill with ≥5 ranks). */
    synergies: ActiveSynergy[];
    /** Sum of all active synergy bonuses. */
    synergyTotal: number;
    total: number;
    usable: boolean;
  };
  // Spell system
  addSpell: (spell: Spell) => void;
  updateSpell: (spell: Spell) => void;
  deleteSpell: (spellId: string) => void;
  togglePrepareSpell: (spellId: string) => void;
  castSpell: (spellLevel: number) => void;
  setSpellSlotTotal: (level: number, total: number) => void;
  resetDay: () => void;
  // Legacy compat
  resetSpells: () => void;
  // Skill management
  updateSkill: (skill: import('../types/dnd').Skill) => void;
  deleteSkill: (skillId: string) => void;
  // Custom synergy management
  addCustomSynergy: (syn: CustomSkillSynergy) => void;
  updateCustomSynergy: (syn: CustomSkillSynergy) => void;
  deleteCustomSynergy: (synId: string) => void;
  /** Replace all synergies for a skill and mark it as user-managed (suppresses SRD fallback). */
  replaceSkillSynergies: (skillId: string, synergies: CustomSkillSynergy[]) => void;
  // Feat management
  addFeat: (feat: Feat) => void;
  updateFeat: (feat: Feat) => void;
  deleteFeat: (featId: string) => void;
  // ClassFeature management
  addClassFeature: (feature: ClassFeature) => void;
  updateClassFeature: (feature: ClassFeature) => void;
  deleteClassFeature: (featureId: string) => void;
  spendClassFeatureResource: (featureId: string) => void;
  recoverClassFeatureResource: (featureId: string) => void;
  resetClassFeatureResources: () => void;
  /** Replace the full classFeatures array (used for catalog sync). */
  setClassFeatures: (features: ClassFeature[]) => void;
  // Extended data
  setCurrency: (currency: Currency) => void;
  addCurrencyTransaction: (tx: CurrencyTransaction) => void;
  setMovement: (movement: Movement) => void;
  setHpDetails: (details: HpDetails) => void;
  addLanguage: (lang: Language) => void;
  removeLanguage: (langId: string) => void;
  setQuickNotes: (text: string) => void;
  setNoteTabs: (tabs: NoteTab[]) => void;
  addNoteContextEntry: (entry: NoteContextEntry) => void;
  updateNoteContextEntry: (entry: NoteContextEntry) => void;
  removeNoteContextEntry: (id: string) => void;
  setPlayerGlossaryNote: (campaignId: string, entryId: string, note: string) => void;
  getPlayerGlossaryNote: (campaignId: string, entryId: string) => string;
  // XP & Level Adjustment
  setCurrentXp: (xp: number) => void;
  setLevelAdjustment: (la: number) => void;
  setRaceHitDice: (hd: number) => void;
  setXpConfig: (useCustom: boolean, thresholds?: number[]) => void;
  /** Computed ECL = class levels total + levelAdjustment + raceHitDice. */
  getEcl: () => number;
  /** XP threshold to reach the next level (based on ECL). */
  getXpForNextLevel: () => number;
  /** Add a log entry for XP earnings and auto-update currentXp. */
  addXpLogEntry: (amount: number, description: string) => void;
  /** Remove an entry from the XP log. */
  removeXpLogEntry: (id: string) => void;
  /** Get total XP from log entries. */
  getTotalXpFromLog: () => number;
  setSavingThrow: (save: 'fortitude' | 'reflex' | 'will', breakdown: SavingThrowBreakdown) => void;
  // Wizard-style spell preparation (one entry per cast)
  prepareWizardSpell: (level: number, spellId: string) => void;
  unprepareWizardSpell: (level: number, prepId: string) => void;
  castPreparedSpell: (level: number, prepId: string) => void;
  restorePreparedSpell: (level: number, prepId: string) => void;
  restWizardSpells: () => void;
  // BAB
  /** Returns the computed total BAB (from classLevels if present, else baseStats.bab) */
  getTotalBab: () => number;
  /** Returns the list of attack bonuses including multiple attacks, e.g. [+8, +3] */
  getMultipleAttacks: (extraBonus?: number) => number[];
  /** D&D 3.5 size modifier to attack/CA: uses creature size when transformed, character size otherwise. */
  getSizeAttackModifier: () => number;
  /** Computed base saving throw bonus from classLevels (sum across classes). */
  getClassBaseSave: (save: SaveKey) => number;
  /** Returns the breakdown for a saving throw, auto-filling base+ability when classLevels exist. */
  getSaveBreakdown: (save: SaveKey) => { base: number; ability: number; magic: number; misc: number; total: number; auto: boolean };
  // ClassLevel management
  addClassLevel: (entry: ClassLevel) => void;
  updateClassLevel: (entry: ClassLevel) => void;
  deleteClassLevel: (id: string) => void;
  /** Computed total max HP from classLevels hit dice + Con modifier. */
  getTotalMaxHp: () => number;
  /** Append an entry to the HP acquisition log. */
  addHpLevelEntry: (entry: HpLevelLogEntry) => void;
  /** Remove the last log entry that belongs to the given classId. */
  removeLastHpLevelEntry: (classId: string) => void;
  /** Replace the entire HP acquisition log (for reordering). */
  reorderHpLevelLog: (log: HpLevelLogEntry[]) => void;
  // Active (user-managed) modifiers
  addActiveModifier: (mod: ActiveModifier) => void;
  updateActiveModifier: (mod: ActiveModifier) => void;
  removeActiveModifier: (id: string) => void;
  /** Move a modifier to modifiersHistory and remove from active list. */
  archiveActiveModifier: (id: string) => void;
  toggleActiveModifierPause: (id: string) => void;
  /** Decrement `remaining` of all non-paused modifiers whose unit matches `unit` by `by` (default 1). Auto-removes those reaching 0. */
  tickActiveModifiers: (unit: DurationUnit, by?: number) => void;
  /** Remove every non-permanent active modifier (used on long rest, etc.). */
  clearTemporaryActiveModifiers: () => void;
  /** Reactivate a modifier from history (new id, fresh remaining). */
  reactivateModifier: (id: string) => void;
  /** Wipe the modifiers history list. */
  clearModifiersHistory: () => void;
  /** Sum of bonuses (with 3.5 stacking rules) coming from active modifiers for a target. */
  getActiveModifierDelta: (target: StatType | string) => number;
  /** All non-paused active modifiers targeting `target`. */
  getActiveModifiersFor: (target: StatType | string) => ActiveModifier[];
  /** Set the full list of active condition ids (e.g. ['blinded', 'prone']). */
  setActiveConditions: (ids: string[]) => void;
  /** New: collect every applicable modifier (item / feat / class feature /
   *  active buff) for a roll context. Returns auto + optional candidates. */
  getApplicableModifiers: (ctx: RollContext) => ModifierCandidate[];

  // ── Bestiary ────────────────────────────────────────────────────────
  addBestiaryEntry: (entry: BestiaryEntry) => void;
  updateBestiaryEntry: (entry: BestiaryEntry) => void;
  removeBestiaryEntry: (id: string) => void;

  // ── Active Summons ───────────────────────────────────────────────────
  addSummon: (summon: ActiveSummon) => void;
  updateSummon: (summon: ActiveSummon) => void;
  removeSummon: (id: string) => void;
  updateSummonHp: (id: string, delta: number) => void;
  /** Compute stat overrides from active feats/features/items for a creature being summoned */
  computeSummonOverrides: (creature: Creature) => CreatureStatOverride[];

  // ── Active Pets ──────────────────────────────────────────────────────
  addPet: (pet: ActivePet) => void;
  updatePet: (pet: ActivePet) => void;
  removePet: (id: string) => void;
  updatePetHp: (id: string, delta: number) => void;
  /** Compute stat overrides from active feats/features/items for a pet */
  computePetOverrides: (creature: Creature) => CreatureStatOverride[];
  /** Add or update a companion feature */
  updatePetFeature: (petId: string, feature: CompanionFeature) => void;
  /** Remove a companion feature */
  removePetFeature: (petId: string, featureId: string) => void;
  /** Toggle active state of a companion feature */
  togglePetFeature: (petId: string, featureId: string) => void;
  /** Use one resource charge of a companion feature */
  usePetFeatureResource: (petId: string, featureId: string) => void;
  /** Reset resource of a companion feature */
  resetPetFeatureResource: (petId: string, featureId: string) => void;
  /** Add or update a companion equipment item */
  updatePetEquipment: (petId: string, item: CompanionEquipment) => void;
  /** Remove a companion equipment item */
  removePetEquipment: (petId: string, itemId: string) => void;
  /** Toggle equipped state of a companion equipment item */
  togglePetEquipment: (petId: string, itemId: string) => void;

  // ── Creature runtime modifiers (summons & pets) ──────────────────────
  addCreatureRuntimeModifier: (kind: 'summon' | 'pet', id: string, mod: CreatureRuntimeModifier) => void;
  removeCreatureRuntimeModifier: (kind: 'summon' | 'pet', id: string, modId: string) => void;
  tickCreatureRuntimeModifiers: (kind: 'summon' | 'pet', id: string, by?: number) => void;

  // ── Transformations ──────────────────────────────────────────────────
  addTransformation: (entry: TransformationEntry) => void;
  updateTransformation: (entry: TransformationEntry) => void;
  removeTransformation: (id: string) => void;
  /** Activate a saved transformation (snaps creature, sets currentHp to creature.hp) */
  activateTransformation: (id: string) => void;
  /** Deactivate the current transformation */
  deactivateTransformation: () => void;
  /** Change HP in the active transformation form */
  updateTransformationHp: (delta: number) => void;
  /** Directly set HP in the active transformation form */
  setTransformationHp: (hp: number) => void;

  // ── Powers (invocations, mysteries, utterances, psionics) ────────────
  addPower: (power: CharacterPower) => void;
  updatePower: (power: CharacterPower) => void;
  deletePower: (powerId: string) => void;
  /** Spend one use (PER_DAY) or start cooldown (COOLDOWN). AT_WILL: no-op. */
  usePower: (powerId: string, cooldownRolled?: number) => void;
  /** Undo one spent use (PER_DAY). */
  recoverPower: (powerId: string) => void;
  /** Reset all PER_DAY uses and clear all cooldowns. Called by resetDay(). */
  resetPowerResources: () => void;
  /** Decrement cooldownRemaining for every COOLDOWN power by `by` rounds (default 1). */
  tickPowerCooldowns: (by?: number) => void;
}

// Helper to determine if a modifier type stacks
const doesModifierStack = (type: ModifierType): boolean => {
  return ['dodge', 'circumstance', 'untyped', 'synergy'].includes(type);
};

/**
 * Apply D&D 3.5 RAW stacking rules.
 * Stacking types (dodge/circumstance/untyped/synergy): sum all values.
 * All other typed bonuses: best bonus + worst single penalty (SRD: "only the
 * best bonus and worst penalty applies").
 */
const aggregateModifiers = (mods: { type: ModifierType; value: number }[]): number => {
  const byType: Record<string, number[]> = {};
  mods.forEach(m => { (byType[m.type] ||= []).push(m.value); });
  let total = 0;
  Object.entries(byType).forEach(([type, values]) => {
    const t = type as ModifierType;
    if (doesModifierStack(t)) {
      total += values.reduce((s, v) => s + v, 0);
    } else {
      const positives = values.filter(v => v > 0);
      const negatives = values.filter(v => v < 0);
      if (positives.length) total += Math.max(...positives);
      if (negatives.length) total += Math.min(...negatives);
    }
  });
  return total;
};

// Calculate stat modifier (e.g., 14 Str -> +2)
export const calculateStatMod = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

export const useCharacterStore = create<CharacterState>((set, get) => ({
  character: null,

  setCharacter: (char) => set({ character: char }),

  updateBaseStat: (stat, value) => set((state) => {
    if (!state.character) return state;
    return {
      character: {
        ...state.character,
        baseStats: {
          ...state.character.baseStats,
          [stat]: value,
        }
      }
    };
  }),

  toggleEquipItem: (itemId) => set((state) => {
    if (!state.character) return state;
    const inventory = state.character.inventory.map(item =>
      item.id === itemId ? { ...item, equipped: !item.equipped } : item
    );
    return { character: { ...state.character, inventory } };
  }),

  deleteItem: (itemId) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, inventory: state.character.inventory.filter(i => i.id !== itemId) } };
  }),

  updateItem: (item) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, inventory: state.character.inventory.map(i => i.id === item.id ? item : i) } };
  }),

  toggleFeat: (featId) => set((state) => {
    if (!state.character) return state;
    const feats = state.character.feats.map(feat =>
      feat.id === featId ? { ...feat, active: !feat.active } : feat
    );
    return { character: { ...state.character, feats } };
  }),

  castSpell: (spellLevel: number) => set((state) => {
    if (!state.character) return state;
    const slots = state.character.spellSlots ?? {};
    const key = String(spellLevel);
    const slot = slots[key] ?? { total: 0, used: 0 };
    if (slot.used >= slot.total) return state;
    return { character: { ...state.character, spellSlots: { ...slots, [key]: { ...slot, used: slot.used + 1 } } } };
  }),

  resetDay: () => set((state) => {
    if (!state.character) return state;
    const slots = state.character.spellSlots ?? {};
    const reset = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { ...v, used: 0 }]));
    const classFeatures = (state.character.classFeatures ?? []).map(f => ({ ...f, resourceUsed: 0 }));
    const powers = (state.character.powers ?? []).map(p => ({
      ...p,
      usesUsed: p.usageType === 'PER_DAY' ? 0 : p.usesUsed,
      cooldownRemaining: p.usageType === 'COOLDOWN' ? 0 : p.cooldownRemaining,
    }));
    return { character: { ...state.character, spellSlots: reset, preparedSpellIds: [], classFeatures, powers } };
  }),

  resetSpells: () => set((state) => {
    if (!state.character) return state;
    const slots = state.character.spellSlots ?? {};
    const reset = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { ...v, used: 0 }]));
    return { character: { ...state.character, spellSlots: reset, preparedSpellIds: [] } };
  }),

  addSpell: (spell) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, spells: [...state.character.spells, spell] } };
  }),

  updateSpell: (spell) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, spells: state.character.spells.map(s => s.id === spell.id ? spell : s) } };
  }),

  deleteSpell: (spellId) => set((state) => {
    if (!state.character) return state;
    return {
      character: {
        ...state.character,
        spells: state.character.spells.filter(s => s.id !== spellId),
        preparedSpellIds: (state.character.preparedSpellIds ?? []).filter(id => id !== spellId),
      }
    };
  }),

  togglePrepareSpell: (spellId) => set((state) => {
    if (!state.character) return state;
    const current = state.character.preparedSpellIds ?? [];
    const next = current.includes(spellId) ? current.filter(id => id !== spellId) : [...current, spellId];
    return { character: { ...state.character, preparedSpellIds: next } };
  }),

  setSpellSlotTotal: (level, total) => set((state) => {
    if (!state.character) return state;
    const slots = state.character.spellSlots ?? {};
    const key = String(level);
    const existing = slots[key] ?? { total: 0, used: 0 };
    const newUsed = Math.min(existing.used, total);
    const next = total > 0 ? { ...slots, [key]: { total, used: newUsed } } : Object.fromEntries(Object.entries(slots).filter(([k]) => k !== key));
    return { character: { ...state.character, spellSlots: next } };
  }),

  addFeat: (feat) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, feats: [...state.character.feats, feat] } };
  }),

  updateFeat: (feat) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, feats: state.character.feats.map(f => f.id === feat.id ? feat : f) } };
  }),

  deleteFeat: (featId) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, feats: state.character.feats.filter(f => f.id !== featId) } };
  }),

  addClassFeature: (feature) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, classFeatures: [...(state.character.classFeatures ?? []), feature] } };
  }),

  updateClassFeature: (feature) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, classFeatures: (state.character.classFeatures ?? []).map(f => f.id === feature.id ? feature : f) } };
  }),

  deleteClassFeature: (featureId) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, classFeatures: (state.character.classFeatures ?? []).filter(f => f.id !== featureId) } };
  }),

  spendClassFeatureResource: (featureId) => set((state) => {
    if (!state.character) return state;
    const classFeatures = (state.character.classFeatures ?? []).map(f => {
      if (f.id !== featureId) return f;
      const used = f.resourceUsed ?? 0;
      const max = f.resourceMax ?? 0;
      if (used >= max) return f;
      return { ...f, resourceUsed: used + 1 };
    });
    return { character: { ...state.character, classFeatures } };
  }),

  recoverClassFeatureResource: (featureId) => set((state) => {
    if (!state.character) return state;
    const classFeatures = (state.character.classFeatures ?? []).map(f => {
      if (f.id !== featureId) return f;
      const used = f.resourceUsed ?? 0;
      if (used <= 0) return f;
      return { ...f, resourceUsed: used - 1 };
    });
    return { character: { ...state.character, classFeatures } };
  }),

  resetClassFeatureResources: () => set((state) => {
    if (!state.character) return state;
    const classFeatures = (state.character.classFeatures ?? []).map(f => ({ ...f, resourceUsed: 0 }));
    return { character: { ...state.character, classFeatures } };
  }),

  setClassFeatures: (features) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, classFeatures: features } };
  }),

  setCurrency: (currency) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, currency } };
  }),

  addCurrencyTransaction: (tx) => set((state) => {
    if (!state.character) return state;
    const cur = state.character.currency ?? { platinum: 0, gold: 0, silver: 0, copper: 0 };
    const newCurrency = {
      platinum: (cur.platinum ?? 0) + tx.platinum,
      gold: (cur.gold ?? 0) + tx.gold,
      silver: (cur.silver ?? 0) + tx.silver,
      copper: (cur.copper ?? 0) + tx.copper,
    };
    const log = [tx, ...(state.character.currencyLog ?? [])];
    return { character: { ...state.character, currency: newCurrency, currencyLog: log } };
  }),

  setMovement: (movement) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, movement } };
  }),

  setHpDetails: (details) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, hpDetails: details } };
  }),

  addLanguage: (lang) => set((state) => {
    if (!state.character) return state;
    const existing = state.character.languages ?? [];
    if (existing.find(l => l.id === lang.id)) return state;
    return { character: { ...state.character, languages: [...existing, lang] } };
  }),

  removeLanguage: (langId) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, languages: (state.character.languages ?? []).filter(l => l.id !== langId) } };
  }),

  setQuickNotes: (text) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, quickNotes: text } };
  }),

  setNoteTabs: (tabs) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, noteTabs: tabs } };
  }),

  addNoteContextEntry: (entry) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, noteContext: [...(state.character.noteContext ?? []), entry] } };
  }),

  updateNoteContextEntry: (entry) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, noteContext: (state.character.noteContext ?? []).map(e => e.id === entry.id ? entry : e) } };
  }),

  removeNoteContextEntry: (id) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, noteContext: (state.character.noteContext ?? []).filter(e => e.id !== id) } };
  }),

  setPlayerGlossaryNote: (campaignId, entryId, note) => set((state) => {
    if (!state.character) return state;
    const key = `${campaignId}::${entryId}`;
    const notes = { ...(state.character.playerGlossaryNotes ?? {}) };
    if (note.trim()) {
      notes[key] = note;
    } else {
      delete notes[key];
    }
    return { character: { ...state.character, playerGlossaryNotes: notes } };
  }),

  getPlayerGlossaryNote: (campaignId, entryId) => {
    const key = `${campaignId}::${entryId}`;
    const state = useCharacterStore.getState();
    return (state.character?.playerGlossaryNotes?.[key]) ?? '';
  },

  setCurrentXp: (xp) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, currentXp: Math.max(0, xp) } };
  }),

  setLevelAdjustment: (la) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, levelAdjustment: Math.max(0, la) } };
  }),

  setRaceHitDice: (hd) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, raceHitDice: Math.max(0, hd) } };
  }),

  setXpConfig: (useCustom, thresholds) => set((state) => {
    if (!state.character) return state;
    return {
      character: {
        ...state.character,
        useCustomXpTable: useCustom,
        ...(thresholds !== undefined ? { customXpThresholds: thresholds } : {}),
      },
    };
  }),

  getEcl: () => {
    const { character } = get();
    if (!character) return 1;
    const classTotal = (character.classLevels ?? []).reduce((s, cl) => s + cl.level, 0);
    return computeEcl(classTotal, character.levelAdjustment ?? 0, character.raceHitDice ?? 0);
  },

  getXpForNextLevel: () => {
    const { character, getEcl } = get();
    if (!character) return 0;
    const ecl = getEcl();
    return getXpForLevel(ecl + 1, character.useCustomXpTable ? character.customXpThresholds : undefined);
  },

  addXpLogEntry: (amount, description) => set((state) => {
    if (!state.character) return state;
    const log = [...(state.character.xpLog ?? [])];
    log.push({
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      amount: Math.max(0, amount),
      description,
    });
    return {
      character: {
        ...state.character,
        xpLog: log,
        currentXp: (state.character.currentXp ?? 0) + Math.max(0, amount),
      },
    };
  }),

  removeXpLogEntry: (id) => set((state) => {
    if (!state.character) return state;
    const removed = state.character.xpLog?.find(e => e.id === id);
    const nextLog = (state.character.xpLog ?? []).filter(e => e.id !== id);
    return {
      character: {
        ...state.character,
        xpLog: nextLog,
        currentXp: Math.max(0, (state.character.currentXp ?? 0) - (removed?.amount ?? 0)),
      },
    };
  }),

  getTotalXpFromLog: () => {
    const { character } = get();
    if (!character?.xpLog) return 0;
    return character.xpLog.reduce((sum, e) => sum + e.amount, 0);
  },

  updateSkill: (skill) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, skills: { ...state.character.skills, [skill.id]: skill } } };
  }),

  deleteSkill: (skillId) => set((state) => {
    if (!state.character) return state;
    const { [skillId]: _, ...rest } = state.character.skills;
    // Also remove any custom synergies referencing this skill.
    const customSynergies = (state.character.customSynergies ?? []).filter(
      s => s.sourceSkillId !== skillId && s.targetSkillId !== skillId,
    );
    return { character: { ...state.character, skills: rest, customSynergies } };
  }),

  addCustomSynergy: (syn) => set((state) => {
    if (!state.character) return state;
    const list = [...(state.character.customSynergies ?? []), syn];
    return { character: { ...state.character, customSynergies: list } };
  }),

  updateCustomSynergy: (syn) => set((state) => {
    if (!state.character) return state;
    const list = (state.character.customSynergies ?? []).map(s => s.id === syn.id ? syn : s);
    return { character: { ...state.character, customSynergies: list } };
  }),

  deleteCustomSynergy: (synId) => set((state) => {
    if (!state.character) return state;
    const list = (state.character.customSynergies ?? []).filter(s => s.id !== synId);
    return { character: { ...state.character, customSynergies: list } };
  }),

  replaceSkillSynergies: (skillId, synergies) => set((state) => {
    if (!state.character) return state;
    // Remove old synergies for this skill, then add new list.
    const filtered = (state.character.customSynergies ?? []).filter(
      s => s.sourceSkillId !== skillId && s.targetSkillId !== skillId,
    );
    const managed = [...new Set([...(state.character.managedSynergySkillIds ?? []), skillId])];
    return { character: { ...state.character, customSynergies: [...filtered, ...synergies], managedSynergySkillIds: managed } };
  }),

  setSavingThrow: (save, breakdown) => set((state) => {
    if (!state.character) return state;
    const current = state.character.savingThrows ?? {
      fortitude: { base: 0, ability: 0, magic: 0, misc: 0 },
      reflex: { base: 0, ability: 0, magic: 0, misc: 0 },
      will: { base: 0, ability: 0, magic: 0, misc: 0 },
    };
    return { character: { ...state.character, savingThrows: { ...current, [save]: breakdown } } };
  }),

  prepareWizardSpell: (level, spellId) => set((state) => {
    if (!state.character) return state;
    const key = String(level);
    const map = state.character.preparedSpellsByLevel ?? {};
    const list = map[key] ?? [];
    const entry: PreparedSpell = {
      id: `${spellId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      spellId,
      cast: false,
    };
    return { character: { ...state.character, preparedSpellsByLevel: { ...map, [key]: [...list, entry] } } };
  }),

  unprepareWizardSpell: (level, prepId) => set((state) => {
    if (!state.character) return state;
    const key = String(level);
    const map = state.character.preparedSpellsByLevel ?? {};
    const list = map[key] ?? [];
    const removed = list.find(p => p.id === prepId);
    const next = list.filter(p => p.id !== prepId);
    // If removed entry was already cast, return its slot use
    let spellSlots = state.character.spellSlots;
    if (removed?.cast && spellSlots?.[key]) {
      spellSlots = { ...spellSlots, [key]: { ...spellSlots[key], used: Math.max(0, spellSlots[key].used - 1) } };
    }
    return { character: { ...state.character, preparedSpellsByLevel: { ...map, [key]: next }, ...(spellSlots ? { spellSlots } : {}) } };
  }),

  castPreparedSpell: (level, prepId) => set((state) => {
    if (!state.character) return state;
    const key = String(level);
    const map = state.character.preparedSpellsByLevel ?? {};
    const list = map[key] ?? [];
    const target = list.find(p => p.id === prepId);
    if (!target || target.cast) return state;
    const newList = list.map(p => p.id === prepId ? { ...p, cast: true } : p);
    const slots = state.character.spellSlots ?? {};
    const slot = slots[key] ?? { total: 0, used: 0 };
    const newSlots = { ...slots, [key]: { ...slot, used: Math.min(slot.total, slot.used + 1) } };
    return { character: { ...state.character, preparedSpellsByLevel: { ...map, [key]: newList }, spellSlots: newSlots } };
  }),

  restorePreparedSpell: (level, prepId) => set((state) => {
    if (!state.character) return state;
    const key = String(level);
    const map = state.character.preparedSpellsByLevel ?? {};
    const list = map[key] ?? [];
    const target = list.find(p => p.id === prepId);
    if (!target || !target.cast) return state;
    const newList = list.map(p => p.id === prepId ? { ...p, cast: false } : p);
    const slots = state.character.spellSlots ?? {};
    const slot = slots[key] ?? { total: 0, used: 0 };
    const newSlots = { ...slots, [key]: { ...slot, used: Math.max(0, slot.used - 1) } };
    return { character: { ...state.character, preparedSpellsByLevel: { ...map, [key]: newList }, spellSlots: newSlots } };
  }),

  restWizardSpells: () => set((state) => {
    if (!state.character) return state;
    const map = state.character.preparedSpellsByLevel ?? {};
    const reset: Record<string, PreparedSpell[]> = Object.fromEntries(
      Object.entries(map).map(([k, list]) => [k, list.map(p => ({ ...p, cast: false }))])
    );
    const slots = state.character.spellSlots ?? {};
    const resetSlots = Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { ...v, used: 0 }]));
    return { character: { ...state.character, preparedSpellsByLevel: reset, spellSlots: resetSlots } };
  }),

  // ── BAB ──────────────────────────────────────────────────────────
  getTotalBab: (): number => {
    const { character } = get();
    if (!character) return 0;
    // Per le regole di Metamorfosi D&D 3.5 il personaggio usa il proprio BAB
    // (da livelli di classe) anche in forma trasformata.
    const levels = character.classLevels;
    if (levels && levels.length > 0) {
      return levels.reduce((sum, cl) => sum + computeClassBab(cl.level, cl.babProgression), 0);
    }
    return character.baseStats.bab || 0;
  },

  getMultipleAttacks: (extraBonus = 0): number[] => {
    const bab = get().getTotalBab() + extraBonus;
    const attacks: number[] = [bab];
    let next = bab - 5;
    while (next > 0 && attacks.length < 4) {
      attacks.push(next);
      next -= 5;
    }
    return attacks;
  },

  getSizeAttackModifier: (): number => {
    const { character } = get();
    if (!character) return 0;
    // When transformed, the creature's size applies (Metamorfosi D&D 3.5).
    const size = character.activeTransformation
      ? character.activeTransformation.creature.size
      : character.size;
    return size ? (SIZE_ATTACK_MODIFIER[size] ?? 0) : 0;
  },

  // ── Saving throws ────────────────────────────────────────────────
  getClassBaseSave: (save: SaveKey): number => {
    const { character } = get();
    if (!character) return 0;
    const levels = character.classLevels ?? [];
    const field = SAVE_TO_PROG_FIELD[save];
    return levels.reduce((sum, cl) => sum + computeClassSaveBase(cl.level, cl[field] ?? 'poor'), 0);
  },

  getSaveBreakdown: (save: SaveKey) => {
    const { character, getStatModifier, getClassBaseSave } = get();
    // Note: NO transformation override here.
    // When transformed, STR/DEX/CON come from creature (via getEffectiveStat) and
    // INT/WIS/CHA come from character, so saves auto-compute correctly:
    //   FORT = class_base_fort + creature_CON_mod  (CON overridden)
    //   RIF  = class_base_ref  + creature_DEX_mod  (DEX overridden)
    //   VOL  = class_base_will + character_WIS_mod (WIS NOT overridden)

    const stored = character?.savingThrows?.[save] ?? { base: 0, ability: 0, magic: 0, misc: 0 };
    const hasClasses = (character?.classLevels?.length ?? 0) > 0;
    const base = hasClasses ? getClassBaseSave(save) : stored.base;
    const ability = hasClasses ? getStatModifier(SAVE_TO_STAT[save]) : stored.ability;
    const magic = stored.magic;
    const misc = stored.misc;
    return { base, ability, magic, misc, total: base + ability + magic + misc, auto: hasClasses };
  },

  // ── ClassLevel management ────────────────────────────────────────
  addClassLevel: (entry: ClassLevel) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, classLevels: [...(state.character.classLevels ?? []), entry] } };
  }),

  updateClassLevel: (entry: ClassLevel) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, classLevels: (state.character.classLevels ?? []).map(cl => cl.id === entry.id ? entry : cl) } };
  }),

  deleteClassLevel: (id: string) => set((state) => {
    if (!state.character) return state;
    return {
      character: {
        ...state.character,
        classLevels: (state.character.classLevels ?? []).filter(cl => cl.id !== id),
        hpLevelLog: (state.character.hpLevelLog ?? []).filter(e => e.classId !== id),
      },
    };
  }),

  getTotalMaxHp: (): number => {
    const { character, getStatModifier } = get();
    if (!character) return 0;
    const levels = character.classLevels ?? [];
    const log = character.hpLevelLog ?? [];
    const totalLevel = levels.reduce((s, cl) => s + cl.level, 0);
    const conMod = getStatModifier('con');
    const classMap = new Map(levels.map(cl => [cl.id, cl]));
    // Sum HP using log order: position in log = total character level
    const hpFromDice = log.reduce((sum, entry, idx) => {
      const cl = classMap.get(entry.classId);
      const die = cl?.hitDie ?? 0;
      if (!die) return sum;
      return sum + getExpectedHpForClassLevel(die, idx + 1);
    }, 0);
    return hpFromDice + conMod * log.length;
  },

  addHpLevelEntry: (entry: HpLevelLogEntry) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, hpLevelLog: [...(state.character.hpLevelLog ?? []), entry] } };
  }),

  removeLastHpLevelEntry: (classId: string) => set((state) => {
    if (!state.character) return state;
    const log = state.character.hpLevelLog ?? [];
    const lastIdx = log.map((e, i) => e.classId === classId ? i : -1).filter(i => i !== -1).at(-1);
    if (lastIdx === undefined) return state;
    const newLog = [...log.slice(0, lastIdx), ...log.slice(lastIdx + 1)];
    return { character: { ...state.character, hpLevelLog: newLog } };
  }),

  reorderHpLevelLog: (log: HpLevelLogEntry[]) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, hpLevelLog: log } };
  }),

  // ── Active (user-managed) modifiers ──────────────────────────────
  addActiveModifier: (mod) => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    return { character: { ...state.character, activeModifiers: [...list, mod] } };
  }),

  updateActiveModifier: (mod) => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    return { character: { ...state.character, activeModifiers: list.map(m => m.id === mod.id ? mod : m) } };
  }),

  removeActiveModifier: (id) => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    return { character: { ...state.character, activeModifiers: list.filter(m => m.id !== id) } };
  }),

  archiveActiveModifier: (id) => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    const mod = list.find(m => m.id === id);
    if (!mod) return state;
    const history = state.character.modifiersHistory ?? [];
    return {
      character: {
        ...state.character,
        activeModifiers: list.filter(m => m.id !== id),
        modifiersHistory: [mod, ...history].slice(0, 30),
      },
    };
  }),

  toggleActiveModifierPause: (id) => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    return {
      character: {
        ...state.character,
        activeModifiers: list.map(m => m.id === id ? { ...m, paused: !m.paused } : m),
      }
    };
  }),

  tickActiveModifiers: (unit, by = 1) => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    const expired: ActiveModifier[] = [];
    const next = list.flatMap<ActiveModifier>(m => {
      if (m.unit !== unit || m.unit === 'permanent' || m.paused || m.remaining == null) return [m];
      const r = m.remaining - by;
      if (r <= 0) { expired.push(m); return []; } // expired → archive
      return [{ ...m, remaining: r }];
    });
    if (expired.length === 0) return { character: { ...state.character, activeModifiers: next } };
    const history = state.character.modifiersHistory ?? [];
    return { character: { ...state.character, activeModifiers: next, modifiersHistory: [...expired, ...history].slice(0, 30) } };
  }),

  clearTemporaryActiveModifiers: () => set((state) => {
    if (!state.character) return state;
    const list = state.character.activeModifiers ?? [];
    const toArchive = list.filter(m => m.unit !== 'permanent');
    const history = state.character.modifiersHistory ?? [];
    return {
      character: {
        ...state.character,
        activeModifiers: list.filter(m => m.unit === 'permanent'),
        modifiersHistory: [...toArchive, ...history].slice(0, 30),
      },
    };
  }),

  reactivateModifier: (id) => set((state) => {
    if (!state.character) return state;
    const history = state.character.modifiersHistory ?? [];
    const template = history.find(m => m.id === id);
    if (!template) return state;
    const newMod: ActiveModifier = {
      ...template,
      id: `mod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      remaining: template.initial,
      createdAt: new Date().toISOString(),
      paused: false,
    };
    const list = state.character.activeModifiers ?? [];
    return { character: { ...state.character, activeModifiers: [...list, newMod] } };
  }),

  clearModifiersHistory: () => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, modifiersHistory: [] } };
  }),

  setActiveConditions: (ids) => set((state) => {
    if (!state.character) return state;
    const prev = state.character.activeConditions ?? [];
    // Remove modifiers from conditions that were removed
    const removed = prev.filter(id => !ids.includes(id));
    // Add modifiers for conditions that were added
    const added = ids.filter(id => !prev.includes(id));
    let mods = (state.character.activeModifiers ?? []).filter(
      m => !m.source?.startsWith('condition:') || !removed.some(id => m.source === `condition:${id}`)
    );
    const now = new Date().toISOString();
    for (const condId of added) {
      const defs = CONDITION_MODIFIERS[condId];
      if (!defs) continue;
      for (const def of defs) {
        mods = [...mods, {
          id: `cond_${condId}_${def.target}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          name: def.label,
          target: def.target,
          value: def.value,
          type: def.type,
          unit: 'permanent' as DurationUnit,
          remaining: null,
          initial: null,
          createdAt: now,
          source: `condition:${condId}`,
        } satisfies ActiveModifier];
      }
    }
    return { character: { ...state.character, activeConditions: ids, activeModifiers: mods } };
  }),

  getActiveModifiersFor: (target) => {
    const list = get().character?.activeModifiers ?? [];
    return list.filter(m => !m.paused && m.target === target);
  },

  getActiveModifierDelta: (target) => {
    const list = get().getActiveModifiersFor(target);
    if (list.length === 0) return 0;
    return aggregateModifiers(list.map(m => ({ type: m.type, value: m.value })));
  },

  getEffectiveStat: (target: StatType | string): number => {
    const { character } = get();
    if (!character) return 0;

    // ── Transformation stat override (Metamorfosi D&D 3.5) ──────────────
    // Solo FOR/DES/COS vengono sostituite dalla creatura.
    // INT/SAG/CAR rimangono quelle del personaggio.
    const activeTrans = character.activeTransformation;
    if (activeTrans) {
      const transEntry = (character.transformations ?? []).find(t => t.id === activeTrans.transformationId);
      if (transEntry?.overrideStats !== false) {
        const c = activeTrans.creature;
        // Base value from creature; active modifiers (spells, conditions, etc.) still apply.
        const modDelta = () => get().getActiveModifierDelta(target);
        if (target === 'str') return c.str + modDelta();
        if (target === 'dex') return c.dex + modDelta();
        if (target === 'con') return c.con + modDelta();
        // INT/WIS/CHA intentionally NOT overridden — character keeps own mental stats.
        if (target === 'ac') return c.ac + modDelta();
        if (target === 'speed') return c.speed + modDelta();
      }
    }

    // Saving throws: auto-compute from classLevels + ability mod when present,
    // else fall back to the stored manual breakdown.
    if (target === 'fortitude' || target === 'reflex' || target === 'will') {
      return get().getSaveBreakdown(target).total + get().getActiveModifierDelta(target);
    }

    // Initiative = DEX modifier + any active initiative modifiers.
    if (target === 'initiative') {
      return get().getStatModifier('dex') + get().getActiveModifierDelta('initiative');
    }

    // Base value calculation
    let baseValue = 0;

    // Check if it's a base stat
    if (target in character.baseStats) {
      baseValue = character.baseStats[target as StatType] || 0;
    } else if (target === 'ac') {
      baseValue = 10; // Base AC is 10
    }

    // Collect all active modifiers for this target
    const activeModifiers: Modifier[] = [];

    character.inventory.forEach(item => {
      if (item.equipped) {
        activeModifiers.push(...item.modifiers.filter(m => m.target === target));
        // Auto-promote armor/shield/protectiveItem armorDetails.armorBonus to AC modifier
        // so equipping armor without an explicit modifier still grants its AC bonus.
        if (target === 'ac' && item.armorDetails && typeof item.armorDetails.armorBonus === 'number' && item.armorDetails.armorBonus !== 0) {
          const modType: ModifierType =
            item.type === 'shield' ? 'shield' :
              item.type === 'protectiveItem' ? 'deflection' :
                'enhancement';
          activeModifiers.push({
            target: 'ac', value: item.armorDetails.armorBonus, type: modType, source: item.name,
          });
        }
      }
    });

    character.feats.forEach(feat => {
      if (feat.active) {
        activeModifiers.push(...feat.modifiers.filter(m => m.target === target));
      }
    });

    // Include user-managed active modifiers in the same stacking pool
    (character.activeModifiers ?? [])
      .filter(m => !m.paused && m.target === target)
      .forEach(m => activeModifiers.push({ target: m.target, value: m.value, type: m.type, source: m.source ?? '' }));

    // If target is 'ac', also add Dex modifier (capped by tightest Max Dex from equipped armor)
    if (target === 'ac') {
      const dexScore = get().getEffectiveStat('dex');
      let dexMod = calculateStatMod(dexScore);
      let maxDexCap: number | undefined;
      character.inventory.forEach(item => {
        if (item.equipped && item.armorDetails && typeof item.armorDetails.maxDex === 'number') {
          maxDexCap = maxDexCap === undefined
            ? item.armorDetails.maxDex
            : Math.min(maxDexCap, item.armorDetails.maxDex);
        }
      });
      if (maxDexCap !== undefined) dexMod = Math.min(dexMod, maxDexCap);
      activeModifiers.push({ target: 'ac', value: dexMod, type: 'untyped', source: 'dex' });
    }

    // Group by type
    const modifiersByType: Record<string, number[]> = {};
    activeModifiers.forEach(mod => {
      if (!modifiersByType[mod.type]) {
        modifiersByType[mod.type] = [];
      }
      modifiersByType[mod.type].push(mod.value);
    });

    let totalBonus = 0;

    // Apply D&D 3.5 stacking rules.
    Object.entries(modifiersByType).forEach(([type, values]) => {
      const modType = type as ModifierType;
      if (doesModifierStack(modType)) {
        totalBonus += values.reduce((sum, val) => sum + val, 0);
      } else {
        // Non-stacking: best bonus + worst single penalty.
        const positives = values.filter(v => v > 0);
        const negatives = values.filter(v => v < 0);
        if (positives.length) totalBonus += Math.max(...positives);
        if (negatives.length) totalBonus += Math.min(...negatives);
      }
    });

    return baseValue + totalBonus;
  },

  getStatModifier: (stat: StatType): number => {
    const effectiveStat = get().getEffectiveStat(stat);
    return calculateStatMod(effectiveStat);
  },

  getEffectiveSkill: (skillId: string): number => {
    const { character, getStatModifier } = get();
    if (!character) return 0;

    const skill = character.skills[skillId];
    if (!skill) return 0;

    // Check if any feat/item overrides the stat for this skill
    const skillCtx: RollContext = { channel: `skill.${skillId}`, skillId, skillName: skill.name };
    const statOverride = resolveStatOverride(character, skillCtx, getStatModifier);
    const statMod = getStatModifier(statOverride ?? skill.stat);
    let total = skill.ranks + statMod;

    // Note: D&D 3.5 — "abilità di classe" influisce solo sul costo dei gradi
    // (1 grado = +1 invece di 2 gradi = +1) e sul massimo, non aggiunge +3.

    // Collect modifiers from equipped items and active feats.
    // A modifier targets this skill if its target is:
    //   - 'skill.<skillId>'  (UUID-based)
    //   - 'skill.<skillName>' or 'skill.<skillName lowercase>' (name-based, for portability)
    const nameLower = skill.name.toLowerCase();
    const isSkillTarget = (t: string) => {
      const tl = t.toLowerCase();
      return tl === `skill.${skillId}` || tl === `skill.${nameLower}`;
    };

    // Collect all skill modifiers from all sources.
    const allSkillMods: { type: ModifierType; value: number }[] = [];
    character.inventory.forEach(item => {
      if (item.equipped) item.modifiers.filter(m => isSkillTarget(m.target)).forEach(m => allSkillMods.push(m));
    });
    character.feats.forEach(feat => {
      if (feat.active) feat.modifiers.filter(m => isSkillTarget(m.target)).forEach(m => allSkillMods.push(m));
    });
    (character.classFeatures ?? []).forEach(cf => {
      if (cf.active) (cf.modifiers ?? []).filter((m: import('../types/dnd').Modifier) => isSkillTarget(m.target)).forEach((m: import('../types/dnd').Modifier) => allSkillMods.push(m));
    });

    // D&D 3.5 stacking rules: type-based, regardless of source.
    const byType: Record<string, number[]> = {};
    allSkillMods.forEach(mod => { (byType[mod.type] ||= []).push(mod.value); });
    Object.entries(byType).forEach(([type, values]) => {
      if (doesModifierStack(type as ModifierType)) {
        total += values.reduce((s, v) => s + v, 0);
      } else {
        const positives = values.filter(v => v > 0);
        const negatives = values.filter(v => v < 0);
        if (positives.length) total += Math.max(...positives);
        if (negatives.length) total += Math.min(...negatives);
      }
    });

    // Free-standing active modifiers (skill.<id> or skill.<name>)
    total += get().getActiveModifierDelta(`skill.${skillId}`);
    total += get().getActiveModifierDelta(`skill.${nameLower}`);

    // D&D 3.5 skill synergies (+2 per qualifying source skill with ≥5 ranks).
    const synergies = computeSynergyBonuses(skillId, skill.name, character.skills, character.managedSynergySkillIds ?? []);
    total += synergies.reduce((s, syn) => s + syn.bonus, 0);

    // User-defined custom synergies.
    const customSynergies = computeCustomSynergyBonuses(skillId, character.skills, character.customSynergies ?? []);
    total += customSynergies.reduce((s, syn) => s + syn.bonus, 0);

    return total;
  },

  getSkillBreakdown: (skillId: string) => {
    const { character, getStatModifier } = get();
    const empty = { statMod: 0, statName: 'str' as StatType, ranks: 0, classBonus: 0, sources: [], total: 0, usable: false };
    if (!character) return empty;
    const skill = character.skills[skillId];
    if (!skill) return empty;

    // Check for stat override from feats/items/class features
    const skillCtx: RollContext = { channel: `skill.${skillId}`, skillId, skillName: skill.name };
    const statOverride = resolveStatOverride(character, skillCtx, getStatModifier);
    const effectiveStatName: StatType = statOverride ?? skill.stat;
    const statMod = getStatModifier(effectiveStatName);
    const ranks = skill.ranks;
    // D&D 3.5: nessun bonus +3, "di classe" influisce solo sul costo dei gradi.
    const classBonus = 0;

    const nameLower = skill.name.toLowerCase();
    const isSkillTarget = (t: string) => {
      const tl = t.toLowerCase();
      return tl === `skill.${skillId}` || tl === `skill.${nameLower}`;
    };

    type Src = { source: string; value: number; type: ModifierType; kind: 'item' | 'feat' | 'feature' };
    const sources: Src[] = [];
    character.inventory.forEach(item => {
      if (item.equipped) {
        item.modifiers.filter(m => isSkillTarget(m.target)).forEach(m =>
          sources.push({ source: item.name, value: m.value, type: m.type, kind: 'item' })
        );
      }
    });
    character.feats.forEach(feat => {
      if (feat.active) {
        feat.modifiers.filter(m => isSkillTarget(m.target)).forEach(m =>
          sources.push({ source: feat.name, value: m.value, type: m.type, kind: 'feat' })
        );
      }
    });
    // Class features (if any apply skill modifiers)
    (character.classFeatures ?? []).forEach(cf => {
      if (!cf.active) return;
      (cf.modifiers ?? []).filter((m: Modifier) => isSkillTarget(m.target)).forEach((m: Modifier) =>
        sources.push({ source: cf.name, value: m.value, type: m.type, kind: 'feature' })
      );
    });

    // Apply D&D 3.5 stacking rules: type-based, regardless of source.
    const byType: Record<string, number[]> = {};
    sources.forEach(s => { (byType[s.type] ||= []).push(s.value); });
    let bonus = 0;
    Object.entries(byType).forEach(([type, values]) => {
      if (doesModifierStack(type as ModifierType)) bonus += values.reduce((a, b) => a + b, 0);
      else {
        const positives = values.filter(v => v > 0);
        const negatives = values.filter(v => v < 0);
        if (positives.length) bonus += Math.max(...positives);
        if (negatives.length) bonus += Math.min(...negatives);
      }
    });

    const total = ranks + statMod + classBonus + bonus;
    // Usable iff: ranks≥1 OR canUseUntrained OR has external modifier source (feat/item/class feature).
    // Being a class skill alone does NOT grant usability — it only reduces cost per rank.
    const usable = ranks >= 1 || skill.canUseUntrained === true || sources.length > 0;

    // D&D 3.5 skill synergies: +2 per qualifying source skill with ≥5 ranks.
    const synergies = computeSynergyBonuses(skillId, skill.name, character.skills, character.managedSynergySkillIds ?? []);
    const customSynergyBonuses = computeCustomSynergyBonuses(skillId, character.skills, character.customSynergies ?? []);
    const allSynergies = [...synergies, ...customSynergyBonuses];
    const synergyTotal = allSynergies.reduce((s, syn) => s + syn.bonus, 0);

    return { statMod, statName: effectiveStatName, ranks, classBonus, sources, synergies: allSynergies, synergyTotal, total: total + synergyTotal, usable };
  },

  getApplicableModifiers: (ctx: RollContext): ModifierCandidate[] => {
    const { character } = get();
    if (!character) return [];
    return collectModifierCandidates(character, ctx);
  },

  // ── Bestiary ──────────────────────────────────────────────────────────────
  addBestiaryEntry: (entry) => set((state) => {
    if (!state.character) return state;
    const bestiary = [...(state.character.bestiary ?? []), entry];
    return { character: { ...state.character, bestiary } };
  }),

  updateBestiaryEntry: (entry) => set((state) => {
    if (!state.character) return state;
    const bestiary = (state.character.bestiary ?? []).map(e => e.id === entry.id ? entry : e);
    return { character: { ...state.character, bestiary } };
  }),

  removeBestiaryEntry: (id) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, bestiary: (state.character.bestiary ?? []).filter(e => e.id !== id) } };
  }),

  // ── Active Summons ────────────────────────────────────────────────────────
  computeSummonOverrides: (creature): CreatureStatOverride[] => {
    const { character } = get();
    if (!character) return [];
    const overrides: CreatureStatOverride[] = [];
    for (const feat of (character.feats ?? [])) {
      if (!feat.active) continue;
      for (const cm of (feat.creatureModifiers ?? [])) {
        if (cm.appliesTo === 'allSummons' || cm.appliesTo === 'all') {
          overrides.push({ source: feat.name, stat: cm.stat, value: cm.value, type: cm.type });
        }
      }
    }
    for (const feat of (character.classFeatures ?? [])) {
      if (!feat.active) continue;
      for (const cm of (feat.creatureModifiers ?? [])) {
        if (cm.appliesTo === 'allSummons' || cm.appliesTo === 'all') {
          overrides.push({ source: feat.name, stat: cm.stat, value: cm.value, type: cm.type });
        }
      }
    }
    for (const item of (character.inventory ?? [])) {
      if (!item.equipped) continue;
      for (const m of (item.modifiers ?? [])) {
        if (m.target === 'summon.str' || m.target === 'summon.con' || m.target === 'summon.all') {
          const stat = m.target.replace('summon.', '') as CreatureStatOverride['stat'];
          overrides.push({ source: item.name, stat, value: m.value, type: m.type });
        }
      }
    }
    return overrides;
  },

  addSummon: (summon) => set((state) => {
    if (!state.character) return state;
    const activeSummons = [...(state.character.activeSummons ?? []), summon];
    return { character: { ...state.character, activeSummons } };
  }),

  updateSummon: (summon) => set((state) => {
    if (!state.character) return state;
    const activeSummons = (state.character.activeSummons ?? []).map(s => s.id === summon.id ? summon : s);
    return { character: { ...state.character, activeSummons } };
  }),

  removeSummon: (id) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, activeSummons: (state.character.activeSummons ?? []).filter(s => s.id !== id) } };
  }),

  updateSummonHp: (id, delta) => set((state) => {
    if (!state.character) return state;
    const activeSummons = (state.character.activeSummons ?? []).map(s => {
      if (s.id !== id) return s;
      const hpFromRuntime = aggregateModifiers((s.runtimeModifiers ?? []).filter(m => m.stat === 'hp').map(m => ({ type: m.type, value: m.value })));
      const hpFromStatic = s.appliedOverrides.filter(o => o.stat === 'hp').reduce((acc, o) => acc + o.value, 0);
      const conBonus = aggregateModifiers([
        ...s.appliedOverrides.filter(o => o.stat === 'con').map(o => ({ type: o.type, value: o.value })),
        ...(s.runtimeModifiers ?? []).filter(m => m.stat === 'con').map(m => ({ type: m.type, value: m.value })),
      ]);
      const currentConMod = Math.floor((s.creature.con + conBonus - 10) / 2);
      const hdMatch = s.creature.hpDice?.match(/^(\d+)d\d+/);
      const hdCount = hdMatch ? parseInt(hdMatch[1], 10) : 0;
      const effective = s.creature.hp + hpFromStatic + hpFromRuntime + currentConMod * hdCount;
      return { ...s, currentHp: Math.max(0, Math.min(effective, s.currentHp + delta)) };
    });
    return { character: { ...state.character, activeSummons } };
  }),

  // ── Active Pets ───────────────────────────────────────────────────────────
  computePetOverrides: (creature): CreatureStatOverride[] => {
    const { character } = get();
    if (!character) return [];
    const overrides: CreatureStatOverride[] = [];
    for (const feat of (character.feats ?? [])) {
      if (!feat.active) continue;
      for (const cm of (feat.creatureModifiers ?? [])) {
        if (cm.appliesTo === 'allPets' || cm.appliesTo === 'all') {
          overrides.push({ source: feat.name, stat: cm.stat, value: cm.value, type: cm.type });
        }
      }
    }
    for (const feat of (character.classFeatures ?? [])) {
      if (!feat.active) continue;
      for (const cm of (feat.creatureModifiers ?? [])) {
        if (cm.appliesTo === 'allPets' || cm.appliesTo === 'all') {
          overrides.push({ source: feat.name, stat: cm.stat, value: cm.value, type: cm.type });
        }
      }
    }
    return overrides;
  },

  addPet: (pet) => set((state) => {
    if (!state.character) return state;
    const activePets = [...(state.character.activePets ?? []), pet];
    return { character: { ...state.character, activePets } };
  }),

  updatePet: (pet) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p => p.id === pet.id ? pet : p);
    return { character: { ...state.character, activePets } };
  }),

  removePet: (id) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, activePets: (state.character.activePets ?? []).filter(p => p.id !== id) } };
  }),

  updatePetHp: (id, delta) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p => {
      if (p.id !== id) return p;
      const hpFromRuntime = aggregateModifiers((p.runtimeModifiers ?? []).filter(m => m.stat === 'hp').map(m => ({ type: m.type, value: m.value })));
      const hpFromStatic = p.appliedOverrides.filter(o => o.stat === 'hp').reduce((acc, o) => acc + o.value, 0);
      const conBonus = aggregateModifiers([
        ...p.appliedOverrides.filter(o => o.stat === 'con').map(o => ({ type: o.type, value: o.value })),
        ...(p.runtimeModifiers ?? []).filter(m => m.stat === 'con').map(m => ({ type: m.type, value: m.value })),
      ]);
      const currentConMod = Math.floor((p.creature.con + conBonus - 10) / 2);
      const hdMatch = p.creature.hpDice?.match(/^(\d+)d\d+/);
      const hdCount = hdMatch ? parseInt(hdMatch[1], 10) : 0;
      const effective = p.creature.hp + hpFromStatic + hpFromRuntime + currentConMod * hdCount;
      return { ...p, currentHp: Math.max(0, Math.min(effective, p.currentHp + delta)) };
    });
    return { character: { ...state.character, activePets } };
  }),

  addCreatureRuntimeModifier: (kind, id, mod) => set((state) => {
    if (!state.character) return state;
    if (kind === 'summon') {
      const activeSummons = (state.character.activeSummons ?? []).map(s =>
        s.id !== id ? s : { ...s, runtimeModifiers: [...(s.runtimeModifiers ?? []), mod] }
      );
      return { character: { ...state.character, activeSummons } };
    } else {
      const activePets = (state.character.activePets ?? []).map(p =>
        p.id !== id ? p : { ...p, runtimeModifiers: [...(p.runtimeModifiers ?? []), mod] }
      );
      return { character: { ...state.character, activePets } };
    }
  }),

  removeCreatureRuntimeModifier: (kind, id, modId) => set((state) => {
    if (!state.character) return state;
    if (kind === 'summon') {
      const activeSummons = (state.character.activeSummons ?? []).map(s =>
        s.id !== id ? s : { ...s, runtimeModifiers: (s.runtimeModifiers ?? []).filter(m => m.id !== modId) }
      );
      return { character: { ...state.character, activeSummons } };
    } else {
      const activePets = (state.character.activePets ?? []).map(p =>
        p.id !== id ? p : { ...p, runtimeModifiers: (p.runtimeModifiers ?? []).filter(m => m.id !== modId) }
      );
      return { character: { ...state.character, activePets } };
    }
  }),

  tickCreatureRuntimeModifiers: (kind, id, by = 1) => set((state) => {
    if (!state.character) return state;
    const tick = (mods: CreatureRuntimeModifier[]): CreatureRuntimeModifier[] =>
      mods
        .map(m => m.roundsRemaining == null ? m : { ...m, roundsRemaining: Math.max(0, m.roundsRemaining - by) })
        .filter(m => m.roundsRemaining == null || m.roundsRemaining > 0);
    if (kind === 'summon') {
      const activeSummons = (state.character.activeSummons ?? []).map(s =>
        s.id !== id ? s : { ...s, runtimeModifiers: tick(s.runtimeModifiers ?? []) }
      );
      return { character: { ...state.character, activeSummons } };
    } else {
      const activePets = (state.character.activePets ?? []).map(p =>
        p.id !== id ? p : { ...p, runtimeModifiers: tick(p.runtimeModifiers ?? []) }
      );
      return { character: { ...state.character, activePets } };
    }
  }),

  updatePetFeature: (petId, feature) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p => {
      if (p.id !== petId) return p;
      const existing = (p.features ?? []).find(f => f.id === feature.id);
      const features = existing
        ? (p.features ?? []).map(f => f.id === feature.id ? feature : f)
        : [...(p.features ?? []), feature];
      return { ...p, features };
    });
    return { character: { ...state.character, activePets } };
  }),

  removePetFeature: (petId, featureId) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p =>
      p.id !== petId ? p : { ...p, features: (p.features ?? []).filter(f => f.id !== featureId) }
    );
    return { character: { ...state.character, activePets } };
  }),

  togglePetFeature: (petId, featureId) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p =>
      p.id !== petId ? p : {
        ...p,
        features: (p.features ?? []).map(f => f.id === featureId ? { ...f, active: !f.active } : f),
      }
    );
    return { character: { ...state.character, activePets } };
  }),

  usePetFeatureResource: (petId, featureId) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p =>
      p.id !== petId ? p : {
        ...p,
        features: (p.features ?? []).map(f => {
          if (f.id !== featureId || f.resourceMax == null) return f;
          return { ...f, resourceUsed: Math.min((f.resourceUsed ?? 0) + 1, f.resourceMax) };
        }),
      }
    );
    return { character: { ...state.character, activePets } };
  }),

  resetPetFeatureResource: (petId, featureId) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p =>
      p.id !== petId ? p : {
        ...p,
        features: (p.features ?? []).map(f => f.id === featureId ? { ...f, resourceUsed: 0 } : f),
      }
    );
    return { character: { ...state.character, activePets } };
  }),

  updatePetEquipment: (petId, item) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p => {
      if (p.id !== petId) return p;
      const existing = (p.equipment ?? []).find(e => e.id === item.id);
      const equipment = existing
        ? (p.equipment ?? []).map(e => e.id === item.id ? item : e)
        : [...(p.equipment ?? []), item];
      return { ...p, equipment };
    });
    return { character: { ...state.character, activePets } };
  }),

  removePetEquipment: (petId, itemId) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p =>
      p.id !== petId ? p : { ...p, equipment: (p.equipment ?? []).filter(e => e.id !== itemId) }
    );
    return { character: { ...state.character, activePets } };
  }),

  togglePetEquipment: (petId, itemId) => set((state) => {
    if (!state.character) return state;
    const activePets = (state.character.activePets ?? []).map(p =>
      p.id !== petId ? p : {
        ...p,
        equipment: (p.equipment ?? []).map(e => e.id === itemId ? { ...e, equipped: !e.equipped } : e),
      }
    );
    return { character: { ...state.character, activePets } };
  }),

  // ── Transformations ──────────────────────────────────────────────────
  addTransformation: (entry) => set((state) => {
    if (!state.character) return state;
    const transformations = [...(state.character.transformations ?? []), entry];
    return { character: { ...state.character, transformations } };
  }),

  updateTransformation: (entry) => set((state) => {
    if (!state.character) return state;
    const transformations = (state.character.transformations ?? []).map(t => t.id === entry.id ? entry : t);
    return { character: { ...state.character, transformations } };
  }),

  removeTransformation: (id) => set((state) => {
    if (!state.character) return state;
    const transformations = (state.character.transformations ?? []).filter(t => t.id !== id);
    const activeTransformation = state.character.activeTransformation?.transformationId === id
      ? undefined
      : state.character.activeTransformation;
    return { character: { ...state.character, transformations, activeTransformation } };
  }),

  activateTransformation: (id) => {
    const { character } = get();
    if (!character) return;
    const entry = (character.transformations ?? []).find(t => t.id === id);
    if (!entry) return;
    const activeTransformation: ActiveTransformation = {
      transformationId: id,
      creature: entry.creature,
      currentHp: entry.creature.hp, // placeholder; updated below
      activatedAt: new Date().toISOString(),
    };
    // Step 1: activate so getTotalMaxHp() can read creature CON via getEffectiveStat
    set({ character: { ...character, activeTransformation } });
    // Step 2: compute proper max HP (class levels × hit die + creature CON modifier per level)
    const maxHp = get().getTotalMaxHp();
    if (maxHp > 0) {
      set(state => ({
        character: state.character?.activeTransformation
          ? { ...state.character, activeTransformation: { ...state.character.activeTransformation, currentHp: maxHp } }
          : state.character,
      }));
    }
  },

  deactivateTransformation: () => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, activeTransformation: undefined } };
  }),

  updateTransformationHp: (delta) => {
    const maxHp = get().getTotalMaxHp();
    set((state) => {
      if (!state.character?.activeTransformation) return state;
      const active = state.character.activeTransformation;
      const effectiveMax = maxHp > 0 ? maxHp : active.creature.hp;
      const currentHp = Math.max(0, Math.min(effectiveMax, active.currentHp + delta));
      return { character: { ...state.character, activeTransformation: { ...active, currentHp } } };
    });
  },

  setTransformationHp: (hp) => {
    const maxHp = get().getTotalMaxHp();
    set((state) => {
      if (!state.character?.activeTransformation) return state;
      const active = state.character.activeTransformation;
      const effectiveMax = maxHp > 0 ? maxHp : active.creature.hp;
      const currentHp = Math.max(0, Math.min(effectiveMax, hp));
      return { character: { ...state.character, activeTransformation: { ...active, currentHp } } };
    });
  },

  // ── Powers ────────────────────────────────────────────────────────────────
  addPower: (power) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, powers: [...(state.character.powers ?? []), power] } };
  }),

  updatePower: (power) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, powers: (state.character.powers ?? []).map(p => p.id === power.id ? power : p) } };
  }),

  deletePower: (powerId) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, powers: (state.character.powers ?? []).filter(p => p.id !== powerId) } };
  }),

  usePower: (powerId, cooldownRolled) => set((state) => {
    if (!state.character) return state;
    const powers = (state.character.powers ?? []).map(p => {
      if (p.id !== powerId) return p;
      if (p.usageType === 'AT_WILL') return p;
      if (p.usageType === 'PER_DAY') {
        const used = p.usesUsed ?? 0;
        const max = p.usesMax ?? 0;
        if (used >= max) return p;
        return { ...p, usesUsed: used + 1 };
      }
      if (p.usageType === 'COOLDOWN') {
        const rounds = cooldownRolled ?? 1;
        return { ...p, cooldownRemaining: rounds };
      }
      return p;
    });
    return { character: { ...state.character, powers } };
  }),

  recoverPower: (powerId) => set((state) => {
    if (!state.character) return state;
    const powers = (state.character.powers ?? []).map(p => {
      if (p.id !== powerId) return p;
      if (p.usageType === 'PER_DAY') {
        const used = p.usesUsed ?? 0;
        if (used <= 0) return p;
        return { ...p, usesUsed: used - 1 };
      }
      return p;
    });
    return { character: { ...state.character, powers } };
  }),

  resetPowerResources: () => set((state) => {
    if (!state.character) return state;
    const powers = (state.character.powers ?? []).map(p => ({
      ...p,
      usesUsed: p.usageType === 'PER_DAY' ? 0 : p.usesUsed,
      cooldownRemaining: p.usageType === 'COOLDOWN' ? 0 : p.cooldownRemaining,
    }));
    return { character: { ...state.character, powers } };
  }),

  tickPowerCooldowns: (by = 1) => set((state) => {
    if (!state.character) return state;
    const powers = (state.character.powers ?? []).map(p => {
      if (p.usageType !== 'COOLDOWN' || !p.cooldownRemaining) return p;
      return { ...p, cooldownRemaining: Math.max(0, p.cooldownRemaining - by) };
    });
    return { character: { ...state.character, powers } };
  }),
}));
