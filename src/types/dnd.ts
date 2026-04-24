/** BAB progression rate for a class */
export type BabProgression = 'high' | 'medium' | 'low';

/** Saving throw progression rate per class */
export type SaveProgression = 'good' | 'poor';

/** A single class entry for a multiclass character */
export interface ClassLevel {
  id: string;
  className: string;
  level: number;
  babProgression: BabProgression;
  /** Saving throw progressions (default 'poor' if missing for back-compat) */
  fortSave?: SaveProgression;
  refSave?: SaveProgression;
  willSave?: SaveProgression;
}

/** Preset class → BAB progression mappings for D&D 3.5 */
export const CLASS_BAB_PRESETS: Record<string, BabProgression> = {
  // High
  'Guerriero': 'high', 'Fighter': 'high',
  'Paladino': 'high', 'Paladin': 'high',
  'Ranger': 'high',
  'Barbaro': 'high', 'Barbarian': 'high',
  // Medium
  'Chierico': 'medium', 'Cleric': 'medium',
  'Ladro': 'medium', 'Rogue': 'medium',
  'Monaco': 'medium', 'Monk': 'medium',
  'Druido': 'medium', 'Druid': 'medium',
  'Bardo': 'medium', 'Bard': 'medium',
  // Low
  'Mago': 'low', 'Wizard': 'low',
  'Stregone': 'low', 'Sorcerer': 'low',
  'Negromante': 'low', 'Warlock': 'low',
  'Fattucchiere': 'low',
};

/** Preset class → saving throw progressions for D&D 3.5 */
export const CLASS_SAVE_PRESETS: Record<string, { fort: SaveProgression; ref: SaveProgression; will: SaveProgression }> = {
  'Barbaro': { fort: 'good', ref: 'poor', will: 'poor' }, 'Barbarian': { fort: 'good', ref: 'poor', will: 'poor' },
  'Bardo': { fort: 'poor', ref: 'good', will: 'good' }, 'Bard': { fort: 'poor', ref: 'good', will: 'good' },
  'Chierico': { fort: 'good', ref: 'poor', will: 'good' }, 'Cleric': { fort: 'good', ref: 'poor', will: 'good' },
  'Druido': { fort: 'good', ref: 'poor', will: 'good' }, 'Druid': { fort: 'good', ref: 'poor', will: 'good' },
  'Guerriero': { fort: 'good', ref: 'poor', will: 'poor' }, 'Fighter': { fort: 'good', ref: 'poor', will: 'poor' },
  'Monaco': { fort: 'good', ref: 'good', will: 'good' }, 'Monk': { fort: 'good', ref: 'good', will: 'good' },
  'Paladino': { fort: 'good', ref: 'poor', will: 'poor' }, 'Paladin': { fort: 'good', ref: 'poor', will: 'poor' },
  'Ranger': { fort: 'good', ref: 'good', will: 'poor' },
  'Ladro': { fort: 'poor', ref: 'good', will: 'poor' }, 'Rogue': { fort: 'poor', ref: 'good', will: 'poor' },
  'Stregone': { fort: 'poor', ref: 'poor', will: 'good' }, 'Sorcerer': { fort: 'poor', ref: 'poor', will: 'good' },
  'Mago': { fort: 'poor', ref: 'poor', will: 'good' }, 'Wizard': { fort: 'poor', ref: 'poor', will: 'good' },
  'Negromante': { fort: 'poor', ref: 'poor', will: 'good' }, 'Warlock': { fort: 'poor', ref: 'poor', will: 'good' },
  'Fattucchiere': { fort: 'poor', ref: 'poor', will: 'good' },
};

/** Compute base saving throw bonus from a single class entry.
 *  Good: 2 + floor(level/2)   Poor: floor(level/3) */
export const computeClassSaveBase = (level: number, prog: SaveProgression): number =>
  prog === 'good' ? 2 + Math.floor(level / 2) : Math.floor(level / 3);

/** Compute BAB contribution for a single class entry. */
export const computeClassBab = (level: number, prog: BabProgression): number =>
  prog === 'high' ? level
    : prog === 'medium' ? Math.floor(level * 3 / 4)
      : Math.floor(level / 2);

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

// ────────────────────────────── VECTOR MAP MODEL ──────────────────────────────
// Dungeon-Scrawl-style vector model. Coordinates are in "world units" (1 unit
// ≈ 1 cell of the conceptual grid, but shapes are NOT snapped unless the user
// asks for it). Coexists with the legacy `tiles`/`tokens` for back-compat.

export interface MapPoint { x: number; y: number; }

export type MapShapeKind = 'rect' | 'polygon' | 'ellipse' | 'line' | 'stamp' | 'text' | 'door' | 'stair';

export type MapLayerKind = 'floor' | 'walls' | 'objects' | 'notes';

export interface MapLayer {
  id: string;
  name: string;
  kind: MapLayerKind;
  visible: boolean;
  locked: boolean;
}

interface MapShapeBase {
  id: string;
  layerId: string;
  name?: string;
  description?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  locked?: boolean;
}

export interface MapRectShape extends MapShapeBase { kind: 'rect'; x: number; y: number; w: number; h: number; }
export interface MapEllipseShape extends MapShapeBase { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; }
export interface MapPolygonShape extends MapShapeBase { kind: 'polygon'; points: MapPoint[]; closed?: boolean; }
export interface MapLineShape extends MapShapeBase { kind: 'line'; points: MapPoint[]; }
export interface MapStampShape extends MapShapeBase {
  kind: 'stamp';
  x: number; y: number; size: number;
  /** Bundled icon (DndIcon catalog): `iconCategory`+`iconName`. */
  iconCategory?: string;
  iconName?: string;
  /** Or back-office uploaded icon id (CatalogIcon). */
  iconId?: string;
  /** Optional CSS color tint applied via currentColor. */
  tint?: string;
}
export interface MapTextShape extends MapShapeBase { kind: 'text'; x: number; y: number; text: string; fontSize: number; }

/** Door / opening that "cuts" the wall produced by the union of floor shapes.
 *  Rendered as: a rect filled with the floor color (masking the wall stroke)
 *  plus a small swing/door line on top. Can be rotated to align with diagonal walls. */
export interface MapDoorShape extends MapShapeBase {
  kind: 'door';
  x: number; y: number;          // top-left in world coords
  w: number; h: number;          // bounding box (h ≈ wall thickness, w ≈ door span)
  /** Color of the floor that masks the wall under the door. */
  maskFill?: string;
}

/** Stair / ladder / portal that links two map levels.
 *  Click while in select tool teleports to `linkLevelId` (and selects `linkShapeId` if set).
 *  Two stairs on different floors with mutual links form a "round-trip" connection. */
export interface MapStairShape extends MapShapeBase {
  kind: 'stair';
  x: number; y: number;          // top-left in world coords
  w: number; h: number;          // footprint (typically 1×2 cells)
  /** Visual sub-type. */
  stairKind?: 'stairs' | 'ladder' | 'portal' | 'trapdoor';
  /** up = goes to floor above, down = below, both = either. */
  direction?: 'up' | 'down' | 'both';
  /** Linked level (other end of the stair). */
  linkLevelId?: string;
  /** Optional linked stair on that level — selected & centered on teleport. */
  linkShapeId?: string;
}

export type MapShape =
  | MapRectShape
  | MapEllipseShape
  | MapPolygonShape
  | MapLineShape
  | MapStampShape
  | MapTextShape
  | MapDoorShape
  | MapStairShape;

/** A single floor/level inside a dungeon map */
export interface MapLevel {
  id: string;
  /** 0 = ground floor, positive = above ground, negative = underground */
  floor: number;
  /** Display name, e.g. "Piano Terra", "Interrato 1" */
  label: string;
  /** @deprecated kept for back-compat with grid-based maps */
  tiles: Record<string, MapTile>;
  /** @deprecated kept for back-compat */
  tokens: MapToken[];
  /** Vector layers (new). */
  layers?: MapLayer[];
  /** Vector shapes (new). */
  shapes?: MapShape[];
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

/** Time unit used by an ActiveModifier's duration counter. */
export type DurationUnit = 'round' | 'minute' | 'hour' | 'turn' | 'permanent';

/** A user-managed temporary buff or malus applied to a single target.
 *  Differently from `Modifier` (which lives inside items/feats and is gated by
 *  their `equipped`/`active` flag), an `ActiveModifier` is a free-standing
 *  effect with its own description, lifecycle and remaining duration. */
export interface ActiveModifier {
  id: string;
  /** Human-readable label (e.g. "Forza del Toro", "Maledizione del Lich"). */
  name: string;
  /** Optional source / origin (caster, item, situation). */
  source?: string;
  /** Free-form notes. */
  notes?: string;
  /** What the effect modifies (StatType key or 'skill.<id|name>'). */
  target: StatType | string;
  /** Signed bonus or penalty. */
  value: number;
  /** Modifier stacking type (D&D 3.5). */
  type: ModifierType;
  /** Unit of the duration counter (`permanent` = never expires). */
  unit: DurationUnit;
  /** Remaining ticks of `unit`. Null = permanent / no countdown. */
  remaining: number | null;
  /** Initial duration value (for display). */
  initial: number | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** When true the effect is paused (not counted in totals). */
  paused?: boolean;
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

export interface AmmoDetails {
  attackBonus?: number;      // e.g. +1 for magic arrows
  extraDamage?: string;      // e.g. "1d6" for flaming arrows
  extraDamageType?: string;  // e.g. "fuoco", "gelo"
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
  type: 'weapon' | 'armor' | 'shield' | 'protectiveItem' | 'gear' | 'consumable' | 'component' | 'misc' | 'ammo';
  weight: number;
  modifiers: Modifier[];
  equipped: boolean;
  quantity?: number;
  /** For weapons */
  weaponDetails?: WeaponDetails;
  /** For armor / shield / protectiveItem */
  armorDetails?: ArmorDetails;
  /** For ammunition items */
  ammoDetails?: AmmoDetails;
  /** For ranged weapons: id of the currently loaded ammo item */
  equippedAmmoId?: string;
  /** For spell components: which spell they belong to */
  associatedSpell?: string;
  /** Which container: 'indossato' | 'zaino' | 'tasca' */
  location?: string;
  /** Optional icon: id of a `CatalogIcon` from the shared catalog. */
  iconId?: string;
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

export interface CustomAttack {
  id: string;
  name: string;
  /** Stat modifier added to the attack roll (e.g. 'cha' for Warlock spell attacks) */
  attackStat?: StatType;
  /** Whether to add BAB to the attack roll */
  useBab?: boolean;
  /** Flat extra bonus to attack (e.g. proficiency bonus) */
  attackBonusExtra?: number;
  /** Base damage dice expression (e.g. "1d10") */
  damageDice: string;
  /** Stat modifier added to damage (e.g. 'cha' via Scoppio Aggraviante) */
  damageStat?: StatType;
  /** Flat extra bonus to damage */
  damageBonusExtra?: number;
  damageType: string;
  criticalRange?: string;       // e.g. "20", "19-20"
  criticalMultiplier?: string;  // e.g. "×2"
  range?: string;               // e.g. "Mischia", "18m"
  /** IDs of ClassFeature / Feat entries that contribute to this attack (display only) */
  linkedFeatureIds?: string[];
  notes?: string;
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
  customAttacks?: CustomAttack[];
  /** Multiclass entries. When present, BAB is computed from these instead of baseStats.bab */
  classLevels?: ClassLevel[];
  /** User-managed temporary buffs / malus applied to any stat. */
  activeModifiers?: ActiveModifier[];
}
