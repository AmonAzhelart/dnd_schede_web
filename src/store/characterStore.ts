import { create } from 'zustand';
import type { CharacterBase, ClassLevel, Item, Feat, Spell, SpellSlotLevel, Modifier, ModifierType, StatType, Currency, CurrencyTransaction, Movement, HpDetails, Language, SavingThrowBreakdown, ClassFeature, PreparedSpell } from '../types/dnd';
import { computeClassBab, computeClassSaveBase } from '../types/dnd';

type SaveKey = 'fortitude' | 'reflex' | 'will';
const SAVE_TO_STAT: Record<SaveKey, StatType> = { fortitude: 'con', reflex: 'dex', will: 'wis' };
const SAVE_TO_PROG_FIELD: Record<SaveKey, 'fortSave' | 'refSave' | 'willSave'> = {
  fortitude: 'fortSave', reflex: 'refSave', will: 'willSave',
};

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
  // Extended data
  setCurrency: (currency: Currency) => void;
  addCurrencyTransaction: (tx: CurrencyTransaction) => void;
  setMovement: (movement: Movement) => void;
  setHpDetails: (details: HpDetails) => void;
  addLanguage: (lang: Language) => void;
  removeLanguage: (langId: string) => void;
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
  /** Computed base saving throw bonus from classLevels (sum across classes). */
  getClassBaseSave: (save: SaveKey) => number;
  /** Returns the breakdown for a saving throw, auto-filling base+ability when classLevels exist. */
  getSaveBreakdown: (save: SaveKey) => { base: number; ability: number; magic: number; misc: number; total: number; auto: boolean };
  // ClassLevel management
  addClassLevel: (entry: ClassLevel) => void;
  updateClassLevel: (entry: ClassLevel) => void;
  deleteClassLevel: (id: string) => void;
}

// Helper to determine if a modifier type stacks
const doesModifierStack = (type: ModifierType): boolean => {
  return ['dodge', 'circumstance', 'untyped', 'synergy'].includes(type);
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
    return { character: { ...state.character, spellSlots: reset, preparedSpellIds: [], classFeatures } };
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

  updateSkill: (skill) => set((state) => {
    if (!state.character) return state;
    return { character: { ...state.character, skills: { ...state.character.skills, [skill.id]: skill } } };
  }),

  deleteSkill: (skillId) => set((state) => {
    if (!state.character) return state;
    const { [skillId]: _, ...rest } = state.character.skills;
    return { character: { ...state.character, skills: rest } };
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
    return { character: { ...state.character, classLevels: (state.character.classLevels ?? []).filter(cl => cl.id !== id) } };
  }),

  getEffectiveStat: (target: StatType | string): number => {
    const { character } = get();
    if (!character) return 0;

    // Saving throws: auto-compute from classLevels + ability mod when present,
    // else fall back to the stored manual breakdown.
    if (target === 'fortitude' || target === 'reflex' || target === 'will') {
      return get().getSaveBreakdown(target).total;
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
                'armor';
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

    // Apply modifiers
    Object.entries(modifiersByType).forEach(([type, values]) => {
      const modType = type as ModifierType;
      if (doesModifierStack(modType)) {
        // Sum all
        totalBonus += values.reduce((sum, val) => sum + val, 0);
      } else {
        // Take maximum (bonuses don't stack, but penalties do! Assuming positive values are bonuses for now)
        totalBonus += Math.max(...values);
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

    const statMod = getStatModifier(skill.stat);
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

    const activeModifiers: import('../types/dnd').Modifier[] = [];
    character.inventory.forEach(item => {
      if (item.equipped) activeModifiers.push(...item.modifiers.filter(m => isSkillTarget(m.target)));
    });
    character.feats.forEach(feat => {
      if (feat.active) activeModifiers.push(...feat.modifiers.filter(m => isSkillTarget(m.target)));
    });

    // Apply modifiers with same stacking rules as getEffectiveStat
    const byType: Record<string, number[]> = {};
    activeModifiers.forEach(mod => {
      if (!byType[mod.type]) byType[mod.type] = [];
      byType[mod.type].push(mod.value);
    });
    Object.entries(byType).forEach(([type, values]) => {
      if (doesModifierStack(type as ModifierType)) {
        total += values.reduce((s, v) => s + v, 0);
      } else {
        total += Math.max(...values);
      }
    });

    return total;
  },

  getSkillBreakdown: (skillId: string) => {
    const { character, getStatModifier } = get();
    const empty = { statMod: 0, statName: 'str' as StatType, ranks: 0, classBonus: 0, sources: [], total: 0, usable: false };
    if (!character) return empty;
    const skill = character.skills[skillId];
    if (!skill) return empty;

    const statMod = getStatModifier(skill.stat);
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

    // Apply stacking rules to compute total bonus from sources
    const byType: Record<string, number[]> = {};
    sources.forEach(s => { (byType[s.type] ||= []).push(s.value); });
    let bonus = 0;
    Object.entries(byType).forEach(([type, values]) => {
      if (doesModifierStack(type as ModifierType)) bonus += values.reduce((a, b) => a + b, 0);
      else bonus += Math.max(...values);
    });

    const total = ranks + statMod + classBonus + bonus;
    // Usable iff at least one of: classSkill OR ranks≥1 OR canUseUntrained OR has external bonus source
    const usable = skill.classSkill === true || ranks >= 1 || skill.canUseUntrained === true || sources.length > 0;

    return { statMod, statName: skill.stat, ranks, classBonus, sources, total, usable };
  }
}));
