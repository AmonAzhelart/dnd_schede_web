export type ModifierType =
  | 'enhancement'
  | 'morale'
  | 'luck'
  | 'competence'
  | 'dodge'
  | 'deflection'
  | 'armor'
  | 'shield'
  | 'naturalArmor'
  | 'size'
  | 'untyped'
  | 'circumstance'
  | 'racial'
  | 'insight'
  | 'resistance'
  | 'synergy'
  | 'profane'
  | 'sacred'
  | 'alchemical';

export type StatType =
  | 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  | 'hp' | 'ac' | 'speed' | 'reflex' | 'fortitude' | 'will'
  | 'bab' | 'initiative';

export interface MapToken {
  id: string;
  x: number;
  y: number;
  type: string;
  name: string;
  description: string;
  color: string;
}

export interface MapTile {
  x: number;
  y: number;
  isFloor: boolean;
}

/** A single floor/level inside a dungeon map */
export interface MapLevel {
  id: string;
  /** 0 = ground floor, positive = above ground, negative = underground */
  floor: number;
  /** Display name, e.g. "Piano Terra", "Interrato 1" */
  label: string;
  tiles: Record<string, MapTile>;
  tokens: MapToken[];
}

/** A named dungeon map with multiple vertical levels */
export interface DungeonMap {
  id: string;
  name: string;
  createdAt: string;
  levels: MapLevel[];
  activeLevelId: string;
}

/** @deprecated use maps/activeMapId instead */
export interface MapState {
  tiles: Record<string, MapTile>;
  tokens: MapToken[];
}

export interface Modifier {
  target: StatType | string; // e.g., 'str', 'ac', 'skill.hide'
  value: number;
  type: ModifierType;
  source: string; // The id or name of the item/feat providing the modifier
}

export interface WeaponDetails {
  damage: string;          // e.g. "1d6", "2d4+3"
  damageType: string;      // e.g. "p" (piercing), "t" (taglio), "c" (contundente)
  criticalMultiplier: string; // e.g. "x2", "x3"
  criticalRange?: string;  // e.g. "19-20"
  rangeIncrement?: string; // e.g. "18m", "" for melee
  attackBonus?: number;    // per-weapon attack bonus override
  notes?: string;
}

export interface ArmorDetails {
  armorBonus: number;
  maxDex?: number;        // null = unlimited
  checkPenalty?: number;  // negative number e.g. -3
  spellFailure?: number;  // percentage e.g. 15
  speed?: number;         // e.g. 20 (feet)
  armorType?: string;     // 'leggera' | 'media' | 'pesante'
  specialProperties?: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'shield' | 'protectiveItem' | 'gear' | 'consumable' | 'component';
  weight: number;
  modifiers: Modifier[];
  equipped: boolean;
  quantity?: number;
  /** For weapons */
  weaponDetails?: WeaponDetails;
  /** For armor / shield / protectiveItem */
  armorDetails?: ArmorDetails;
  /** For spell components: which spell they belong to */
  associatedSpell?: string;
  /** Which container: 'indossato' | 'zaino' | 'tasca' */
  location?: string;
}

export interface Feat {
  id: string;
  name: string;
  description: string;
  modifiers: Modifier[];
  active: boolean; // Some feats are toggleable (like Power Attack)
}

export type ClassFeatureSubcategory = 'active' | 'passive' | 'option';

export interface ClassFeature {
  id: string;
  name: string;
  description: string;
  subcategory: ClassFeatureSubcategory;
  modifiers: Modifier[];
  active: boolean;
  /** For 'active' subcategory: name of the resource (e.g., "Incanalare Divinità") */
  resourceName?: string;
  /** Max uses per day/rest */
  resourceMax?: number;
  /** Currently spent uses */
  resourceUsed?: number;
}

export interface Skill {
  id: string;
  name: string;
  stat: StatType;
  ranks: number;
  classSkill: boolean;
  armorCheckPenalty: boolean;
  canUseUntrained: boolean;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  description: string;
  castingTime?: string;
  range?: string;
  duration?: string;
  savingThrow?: string;
  components?: string;
  // Legacy compat only
  prepared?: number;
  cast?: number;
}

export interface SpellSlotLevel {
  total: number;
  used: number;
}

/** A single prepared instance of a spell (wizard-style preparation).
 *  Multiple preparations of the same spell are allowed; each can be cast once. */
export interface PreparedSpell {
  id: string;        // unique instance id
  spellId: string;   // reference to Spell.id in `spells`
  cast: boolean;     // whether this preparation has been spent
}

export interface SavingThrowBreakdown {
  base: number;
  ability: number;   // from ability score modifier
  magic: number;     // magic item bonus
  misc: number;      // other
}

export interface Currency {
  platinum: number;
  gold: number;
  silver: number;
  copper: number;
}

export interface Movement {
  base: number;      // feet
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
  other?: string;
}

export interface HpDetails {
  current: number;
  max: number;
  nonLethal?: number;
  tempHp?: number;
  negLevels?: number;
  damageReduction?: string;   // e.g. "5/magic"
  elementalResistances?: string;
}

export interface Language {
  id: string;
  name: string;
}

export interface CurrencyTransaction {
  id: string;
  date: string;       // ISO string
  description: string;
  platinum: number;   // positive = received, negative = spent
  gold: number;
  silver: number;
  copper: number;
}

export interface AdventureNote {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  relationship: string;
  description: string;
}

export interface CharacterBase {
  id: string;
  userId: string;
  name: string;
  race: string;
  characterClass: string;
  level: number;
  alignment: string;
  baseStats: Record<StatType, number>;
  /** Per-save breakdown: base + ability mod + magic + misc */
  savingThrows?: {
    fortitude: SavingThrowBreakdown;
    reflex: SavingThrowBreakdown;
    will: SavingThrowBreakdown;
  };
  skills: Record<string, Skill>;
  inventory: Item[];
  feats: Feat[];
  spells: Spell[];
  notes: AdventureNote[];
  npcs: Npc[];
  // Extended character data
  currency?: Currency;
  currencyLog?: CurrencyTransaction[];
  movement?: Movement;
  hpDetails?: HpDetails;
  languages?: Language[];
  preparedSpellIds?: string[];
  spellSlots?: Record<string, SpellSlotLevel>;
  /** Wizard-style per-instance prep: keyed by spell level (string) */
  preparedSpellsByLevel?: Record<string, PreparedSpell[]>;
  maps?: DungeonMap[];
  activeMapId?: string | null;
  /** @deprecated */
  mapState?: MapState;
  classFeatures?: ClassFeature[];
}
