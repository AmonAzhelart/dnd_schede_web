import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { FaTimes, FaCheck, FaPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { DndIcon } from '../DndIcon';
import { SKILL_PRESETS } from '../../data/skillPresets';
import type { CharacterBase, Feat, Language, ClassLevel, ClassFeature } from '../../types/dnd';
import { computeClassBab, computeClassSaveBase } from '../../types/dnd';
import {
  raceCatalog, classCatalog, languageCatalog, skillCatalog, featCatalog, iconCatalog,
  type CatalogRace, type CatalogClass, type CatalogFeat
} from '../../services/admin';
import { pickLocalized } from '../../i18n';
import './CharacterWizard.css';

// ─────────────────────────── Constants ──────────────────────────────────────
const CUSTOM_RACE = '__custom__';
const CUSTOM_CLASS = '__custom__';

// ─────────────────────────── Types ──────────────────────────────────────────
type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
type AbilityMode = 'pointbuy' | 'manual';

export interface RaceInfo {
  name: string;
  category: 'phb' | 'fr' | 'exotic' | 'custom';
  bonuses: Partial<Record<AbilityKey, number>>;
  extraFeat: boolean;
  extraSkills: number;
  speed: number;
  small: boolean;
  desc: string;
  racialLanguages: string[];
}

export interface ClassInfoFull {
  name: string;
  eng: string;
  iconName: string | null;
  desc: string;
  hitDie: number;
  sp: number;
  bab: 'high' | 'medium' | 'low';
  fort: 'good' | 'poor';
  ref: 'good' | 'poor';
  will: 'good' | 'poor';
  classSkills: string[];
}

interface CustomRaceConfig {
  displayName: string;
  bonuses: Partial<Record<AbilityKey, number>>;
  extraFeat: boolean;
  extraSkillPoints: number;
  speed: number;
  small: boolean;
  racialLanguages: string[];
  description: string;
}

interface CustomClassConfig {
  displayName: string;
  hitDie: number;
  sp: number;
  bab: 'high' | 'medium' | 'low';
  fort: 'good' | 'poor';
  ref: 'good' | 'poor';
  will: 'good' | 'poor';
  classSkills: string[];
}

interface WizardData {
  name: string;
  race: string;
  gender: string;
  age: string;
  alignment: string;
  background: string;
  className: string;
  avatarUrl: string;
  abilities: Record<AbilityKey, number>;
  abilityMode: AbilityMode;
  skills: Record<string, {
    id: string; name: string; stat: string;
    ranks: number; classSkill: boolean;
    armorCheckPenalty: boolean; canUseUntrained: boolean;
  }>;
  classSkillOverrides: Record<string, boolean>;
  feats: Feat[];
  languages: Language[];
  fixedLangNames: Set<string>;
  customRaceConfig: CustomRaceConfig;
  customClassConfig: CustomClassConfig;
}

// ─────────────────────────── Race data ──────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const RACES: RaceInfo[] = [
  // ── PHB Core ──────────────────────────────────────────────────────────────
  {
    name: 'Umano', category: 'phb', bonuses: {}, extraFeat: true, extraSkills: 4, speed: 9, small: false,
    desc: 'Versatili e ambiziosi. Guadagnano un talento bonus e 4 punti abilità aggiuntivi al 1° livello.',
    racialLanguages: [],
  },
  {
    name: 'Nano delle Colline', category: 'phb', bonuses: { con: 2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 6, small: false,
    desc: '+2 Cos, −2 Car. Visione nel buio 18m, resistenza ai veleni, bonus vs maghi e negromanti.',
    racialLanguages: ['Nanico'],
  },
  {
    name: 'Elfo', category: 'phb', bonuses: { dex: 2, con: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Des, −2 Cos. Immunità al sonno magico, bonus ai tiri salvezza contro incantesimi, bonus Cercare/Ascoltare/Osservare.',
    racialLanguages: ['Elfico'],
  },
  {
    name: 'Gnomo della Roccia', category: 'phb', bonuses: { con: 2, str: -2 }, extraFeat: false, extraSkills: 0, speed: 6, small: true,
    desc: '+2 Cos, −2 For. Visione nel buio 18m, illusioni minori innate, bonus vs illusioni e goblinoidi.',
    racialLanguages: ['Gnomesco'],
  },
  {
    name: 'Halfling Piede Leggero', category: 'phb', bonuses: { dex: 2, str: -2 }, extraFeat: false, extraSkills: 0, speed: 6, small: true,
    desc: '+2 Des, −2 For. +1 ai tiri salvezza, +2 ad Ascoltare, bonus al tiro con le armi.',
    racialLanguages: ['Halfling'],
  },
  {
    name: 'Mezzelfo', category: 'phb', bonuses: {}, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: 'Nessun bonus caratteristica. Immunità al sonno, bonus +2 a Diplomazia e Raccogliere Info.',
    racialLanguages: ['Elfico'],
  },
  {
    name: 'Mezzorco', category: 'phb', bonuses: { str: 2, int: -2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 For, −2 Int, −2 Car. Visione nel buio 18m. Accettato tra orchi e umani, non benvoluto da entrambi.',
    racialLanguages: ['Orco'],
  },
  // ── Forgotten Realms ──────────────────────────────────────────────────────
  {
    name: 'Elfo del Sole', category: 'fr', bonuses: { int: 2, dex: 2, str: -2, con: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Int, +2 Des, −2 For, −2 Cos. La subspecie elfica più arrogante e magicamente dotata dei Reami.',
    racialLanguages: ['Elfico'],
  },
  {
    name: 'Elfo della Luna', category: 'fr', bonuses: { dex: 2, con: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Des, −2 Cos. La subspecie elfica più comune nei Reami. Socievoli e avventurosi.',
    racialLanguages: ['Elfico'],
  },
  {
    name: 'Elfo dei Boschi', category: 'fr', bonuses: { str: 2, dex: 2, con: -2, int: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 For, +2 Des, −2 Cos, −2 Int. Reclusi nei boschi profondi; eccellenti esploratori.',
    racialLanguages: ['Elfico'],
  },
  {
    name: 'Elfo Grigio', category: 'fr', bonuses: { int: 2, dex: 2, str: -2, con: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Int, +2 Des, −2 For, −2 Cos. La più antica e isolata subspecie elfica, maestri delle arti arcane.',
    racialLanguages: ['Elfico'],
  },
  {
    name: 'Elfo Oscuro (Drow)', category: 'fr', bonuses: { dex: 2, int: 2, cha: 2, con: -2, str: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Des, +2 Int, +2 Car, −2 Cos, −2 For. Elfi delle profondità. Resistenza alla magia, abilità innate, sensibilità alla luce.',
    racialLanguages: ['Elfico', 'Sottocomune'],
  },
  {
    name: 'Nano delle Montagne', category: 'fr', bonuses: { str: 2, con: 2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 6, small: false,
    desc: '+2 For, +2 Cos, −2 Car. Nani robusti e temprati dall\'alta quota. Eccellenti guerrieri.',
    racialLanguages: ['Nanico'],
  },
  {
    name: 'Gnomo dei Boschi', category: 'fr', bonuses: { dex: 2, int: 2, str: -2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 6, small: true,
    desc: '+2 Des, +2 Int, −2 For, −2 Car. Gnomi selvatici e schivi. Comunicano con gli animali forestali.',
    racialLanguages: ['Gnomesco', 'Silvano'],
  },
  {
    name: 'Halfling Strongheart', category: 'fr', bonuses: { dex: 2, str: -2 }, extraFeat: true, extraSkills: 0, speed: 6, small: true,
    desc: '+2 Des, −2 For, +1 talento bonus. Halfling coraggiosi del Chondath, ottimi avventurieri.',
    racialLanguages: ['Halfling'],
  },
  // ── Esotiche ──────────────────────────────────────────────────────────────
  {
    name: 'Tiefling', category: 'exotic', bonuses: { dex: 2, int: 2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Des, +2 Int, −2 Car. Discendenza diabolica. Resistenza al fuoco, capacità innate, visione nel buio.',
    racialLanguages: ['Infernale'],
  },
  {
    name: 'Aasimar', category: 'exotic', bonuses: { wis: 2, cha: 2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Sag, +2 Car. Discendenza celeste. Resistenza acido/elettricità/freddo, luce innata, visione nel buio.',
    racialLanguages: ['Celestiale'],
  },
  {
    name: 'Genasi della Terra', category: 'exotic', bonuses: { str: 2, con: 2, int: -2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 For, +2 Cos, −2 Int, −2 Car. Sangue elementale terrestre. Resistenza acido, capacità innate.',
    racialLanguages: ['Terran'],
  },
  {
    name: 'Genasi del Fuoco', category: 'exotic', bonuses: { int: 2, cha: 2, wis: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Int, +2 Car, −2 Sag. Sangue elementale igneo. Immunità al fuoco, fire bolt innato.',
    racialLanguages: ['Ignan'],
  },
  {
    name: 'Githzerai', category: 'exotic', bonuses: { wis: 2, dex: 2, str: -2, cha: -2 }, extraFeat: false, extraSkills: 0, speed: 9, small: false,
    desc: '+2 Sag, +2 Des, −2 For, −2 Car. Guerrieri psionici dei piani astrali. Resistenza alla magia.',
    racialLanguages: ['Githzerai'],
  },
];

// ─────────────────────────── Class data ─────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const CLASSES: ClassInfoFull[] = [
  {
    name: 'Guerriero', eng: 'Fighter', iconName: 'fighter',
    desc: 'Maestro assoluto delle armi. Talento bonus ogni 2 livelli pari, grande varietà di stili di combattimento.',
    hitDie: 10, sp: 2, bab: 'high', fort: 'good', ref: 'poor', will: 'poor',
    classSkills: ['arrampicare', 'equitazione', 'gestire_animali', 'intimidire', 'nuotare', 'saltare', 'cavalcare'],
  },
  {
    name: 'Paladino', eng: 'Paladin', iconName: 'paladin',
    desc: 'Campione sacro. Imposizione delle mani, rilevare il male, destriero sacro al 5° livello.',
    hitDie: 10, sp: 2, bab: 'high', fort: 'good', ref: 'poor', will: 'poor',
    classSkills: ['concentrazione', 'con_religione', 'diplomazia', 'guarire', 'equitazione', 'sapienza_magica'],
  },
  {
    name: 'Ranger', eng: 'Ranger', iconName: 'ranger',
    desc: 'Esploratore e cacciatore. Nemico prescelto, tracce, compagno animale al 4°, incantesimi al 4°.',
    hitDie: 8, sp: 6, bab: 'high', fort: 'good', ref: 'good', will: 'poor',
    classSkills: ['arrampicare', 'ascoltare', 'cercare', 'equitazione', 'furtivita', 'muoversi_silenziosamente', 'sopravvivenza', 'osservare', 'nuotare', 'gestire_animali'],
  },
  {
    name: 'Barbaro', eng: 'Barbarian', iconName: 'barbarian',
    desc: 'Furia primitiva incontenibile. Barbarie, velocità aumentata, senso del pericolo, riduzione danno ai livelli alti.',
    hitDie: 12, sp: 4, bab: 'high', fort: 'good', ref: 'poor', will: 'poor',
    classSkills: ['arrampicare', 'equitazione', 'intimidire', 'ascoltare', 'sopravvivenza', 'nuotare'],
  },
  {
    name: 'Chierico', eng: 'Cleric', iconName: 'cleric',
    desc: 'Sacerdote guerriero. Magia divina completa, scacciare o dominare i non morti, domini divini.',
    hitDie: 8, sp: 2, bab: 'medium', fort: 'good', ref: 'poor', will: 'good',
    classSkills: ['concentrazione', 'diplomazia', 'guarire', 'con_religione', 'sapienza_magica', 'senso_pericoli'],
  },
  {
    name: 'Druido', eng: 'Druid', iconName: 'druid',
    desc: 'Guardiano della natura. Magia naturale, mutaforma al 5°, affinità con gli animali, lingue della natura.',
    hitDie: 8, sp: 4, bab: 'medium', fort: 'good', ref: 'poor', will: 'good',
    classSkills: ['concentrazione', 'con_natura', 'osservare', 'sopravvivenza', 'guarire', 'gestire_animali'],
  },
  {
    name: 'Monaco', eng: 'Monk', iconName: 'monk',
    desc: 'Combattente mistico senz\'armatura. Attacchi furtivi, schivata straordinaria, resistenza agli incantesimi.',
    hitDie: 8, sp: 4, bab: 'medium', fort: 'good', ref: 'good', will: 'good',
    classSkills: ['arrampicare', 'concentrazione', 'equitazione', 'furtivita', 'saltare', 'senso_pericoli', 'sapienza_magica'],
  },
  {
    name: 'Bardo', eng: 'Bard', iconName: 'bard',
    desc: 'Artista e arcanista. Ispirazione bardica, incantesimi, conoscenza universale, abilità fuori classe a scelta.',
    hitDie: 6, sp: 6, bab: 'medium', fort: 'poor', ref: 'good', will: 'good',
    classSkills: ['ascoltare', 'bluff', 'concentrazione', 'diplomazia', 'furtivita', 'osservare', 'raccogliere_info', 'sapienza_magica', 'senso_pericoli', 'valutare'],
  },
  {
    name: 'Ladro', eng: 'Rogue', iconName: 'rogue',
    desc: 'Maestro dell\'astuzia. Attacco furtivo, trovare e disattivare trappole, schivata straordinaria.',
    hitDie: 6, sp: 8, bab: 'medium', fort: 'poor', ref: 'good', will: 'poor',
    classSkills: ['aprire_serrature', 'arrampicare', 'ascoltare', 'bluff', 'cercare', 'diplomazia', 'disattivare_dispositivi', 'furtivita', 'muoversi_silenziosamente', 'osservare', 'raccogliere_info', 'senso_pericoli', 'usare_oggetti_magici', 'valutare'],
  },
  {
    name: 'Mago', eng: 'Wizard', iconName: 'wizard',
    desc: 'Arcanista studioso. Libro degli incantesimi, bonus ai talenti magici, vastissimo repertorio.',
    hitDie: 4, sp: 2, bab: 'low', fort: 'poor', ref: 'poor', will: 'good',
    classSkills: ['concentrazione', 'con_arcane', 'con_dungeoneering', 'con_natura', 'con_religione', 'sapienza_magica'],
  },
  {
    name: 'Stregone', eng: 'Sorcerer', iconName: 'sorcerer',
    desc: 'Magia innata nel sangue. Nessun libro, lancia istintivamente; limitato ma potente.',
    hitDie: 4, sp: 2, bab: 'low', fort: 'poor', ref: 'poor', will: 'good',
    classSkills: ['bluff', 'concentrazione', 'sapienza_magica'],
  },
  {
    name: 'Warlock', eng: 'Warlock', iconName: 'warlock',
    desc: 'Patto oscuro con entità extraplanari. Evocazione delle Tenebre, invocazioni innate, nessuno slot incantesimo.',
    hitDie: 6, sp: 2, bab: 'medium', fort: 'poor', ref: 'poor', will: 'good',
    classSkills: ['bluff', 'concentrazione', 'con_arcane', 'intimidire', 'sapienza_magica', 'senso_pericoli'],
  },
];

// ─────────────────────────── Skills ─────────────────────────────────────────

// Maps Italian skill names → DndIcon skill/ category names
const SKILL_ICON_MAP: Record<string, string | null> = {
  'Acrobazia': 'acrobatics', 'Addestrare Animali': 'animal-handling',
  'Artista della Fuga': null, 'Ascoltare': 'perception',
  'Camuffare': 'deception', 'Cavalcare': 'animal-handling',
  'Cercare': 'investigation', 'Concentrazione': null,
  'Conoscenze Arcane': 'arcana', 'Conoscenze Architettura': 'history',
  'Conoscenze Dungeon': 'history', 'Conoscenze Geografia': 'history',
  'Conoscenze Locali': 'history', 'Conoscenze Natura': 'nature',
  'Conoscenze Nobiltà e Regalità': 'history', 'Conoscenze Piani': 'arcana',
  'Conoscenze Religioni': 'religion', 'Conoscenze Storia': 'history',
  'Decifrare Scritture': null, 'Diplomazia': 'persuasion',
  'Disattivare Congegni': 'sleight-of-hand', 'Equilibrio': 'acrobatics',
  'Falsificare': 'deception', 'Guarire': 'medicine',
  'Intimidire': 'intimidation', 'Muoversi Silenziosamente': 'stealth',
  'Nascondersi': 'stealth', 'Nuotare': 'athletics',
  'Osservare': 'perception', 'Parlare Linguaggi': null,
  'Percepire Intenzioni': 'insight', 'Raccogliere Informazioni': 'insight',
  'Raggirare': 'deception', 'Rapidità di Mano': 'sleight-of-hand',
  'Saltare': 'athletics', 'Sapienza Magica': 'arcana',
  'Scalare': 'athletics', 'Scassinare Serrature': 'sleight-of-hand',
  'Sopravvivenza': 'survival', 'Valutare': 'history',
};

// Build full skill list from presets (used in wizard step 5).
// `let` (not `const`) because `useEffect` in CharacterWizard merges entries
// loaded from `catalog_skills` (Firestore) into this list at runtime.
// eslint-disable-next-line react-refresh/only-export-components
export const ALL_SKILLS = SKILL_PRESETS.map(sp => ({
  id: sp.name,
  name: sp.name,
  localizedName: undefined as Partial<Record<string, string>> | undefined,
  stat: sp.stat as string,
  armorCheck: sp.armorCheckPenalty,
  untrained: sp.canUseUntrained,
  icon: SKILL_ICON_MAP[sp.name] ?? null,
}));

// Catalog feats merged at runtime; kept here so the wizard step can read it.
// eslint-disable-next-line react-refresh/only-export-components
export const WIZARD_FEATS: CatalogFeat[] = [];

// Reverse lookup of the original Firestore catalog entries, keyed by the
// localized name shown in the wizard. Used by `handleCreate` to copy
// `racialFeats` / `featuresByLevel` / `automaticLanguages` straight into the
// new character without going through the lossy `RaceInfo`/`ClassInfoFull`
// adapters.
// eslint-disable-next-line react-refresh/only-export-components
export const CATALOG_RACE_BY_NAME: Record<string, CatalogRace> = {};
// eslint-disable-next-line react-refresh/only-export-components
export const CATALOG_CLASS_BY_NAME: Record<string, CatalogClass> = {};
// eslint-disable-next-line react-refresh/only-export-components
export const CATALOG_LANG_BY_NAME: Record<string, string> = {}; // name → id
// eslint-disable-next-line react-refresh/only-export-components
export const CATALOG_LANG_NAME_BY_ID: Record<string, string> = {}; // id → name
// eslint-disable-next-line react-refresh/only-export-components
export const CATALOG_ICON_SVG_BY_ID: Record<string, string> = {}; // catalog_icons id → inline svg

// Maps old class-skill IDs (in CLASSES[].classSkills) → SKILL_PRESETS names
const OLD_TO_PRESET: Record<string, string> = {
  'aprire_serrature': 'Scassinare Serrature', 'arrampicare': 'Scalare',
  'ascoltare': 'Ascoltare', 'bluff': 'Raggirare',
  'cercare': 'Cercare', 'concentrazione': 'Concentrazione',
  'con_arcane': 'Conoscenze Arcane', 'con_dungeoneering': 'Conoscenze Dungeon',
  'con_natura': 'Conoscenze Natura', 'con_religione': 'Conoscenze Religioni',
  'diplomazia': 'Diplomazia', 'disattivare_dispositivi': 'Disattivare Congegni',
  'equitazione': 'Cavalcare', 'falsificare': 'Falsificare',
  'furtivita': 'Nascondersi', 'gestire_animali': 'Addestrare Animali',
  'guarire': 'Guarire', 'intimidire': 'Intimidire',
  'muoversi_silenziosamente': 'Muoversi Silenziosamente', 'nuotare': 'Nuotare',
  'osservare': 'Osservare', 'raccogliere_info': 'Raccogliere Informazioni',
  'saltare': 'Saltare', 'sapienza_magica': 'Sapienza Magica',
  'senso_pericoli': 'Percepire Intenzioni', 'sopravvivenza': 'Sopravvivenza',
  'usare_oggetti_magici': 'Utilizzare Oggetti Magici', 'valutare': 'Valutare',
  'cavalcare': 'Cavalcare',
};

function isDefaultClassSkill(skillName: string, classSkillIds: string[]): boolean {
  return classSkillIds.some(id => (OLD_TO_PRESET[id] ?? id) === skillName);
}

// ─────────────────────────── Other static data ──────────────────────────────

const ALIGNMENTS = [
  'Legale Buono', 'Neutrale Buono', 'Caotico Buono',
  'Legale Neutrale', 'Neutrale', 'Caotico Neutrale',
  'Legale Malvagio', 'Neutrale Malvagio', 'Caotico Malvagio',
];

// eslint-disable-next-line react-refresh/only-export-components
export const ALL_LANGUAGES_POOL = [
  'Elfico', 'Nanico', 'Halfling', 'Gnomesco', 'Orco', 'Goblin', 'Draconico',
  'Celestiale', 'Infernale', 'Abissale', 'Silvano', 'Terran', 'Aquan', 'Auran', 'Ignan',
  'Gigante', 'Gnoll', 'Troglodita', 'Sottocomune', 'Githzerai', 'Githyanki',
  'Slaad', 'Druidico', 'Linguaggio dei Segni', 'Linguaggio dei Ladri',
];

const ABILITY_ICON: Record<AbilityKey, string> = {
  str: 'strength', dex: 'dexterity', con: 'constitution',
  int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

const STAT_NAMES: Record<AbilityKey, string> = {
  str: 'Forza', dex: 'Destrezza', con: 'Costituzione',
  int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma',
};

const STAT_ABBR: Record<string, string> = {
  str: 'For', dex: 'Des', con: 'Cos', int: 'Int', wis: 'Sag', cha: 'Car',
};

const PB_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 13, 18: 16,
};
const PB_TOTAL = 28;

// ─────────────────────────── Helpers ────────────────────────────────────────

const abilityMod = (v: number) => Math.floor((v - 10) / 2);
const signedMod = (v: number) => { const m = abilityMod(v); return m >= 0 ? `+${m}` : `${m}`; };
const signNum = (n: number) => n >= 0 ? `+${n}` : `${n}`;

function totalPBCost(abilities: Record<AbilityKey, number>): number {
  return (Object.keys(abilities) as AbilityKey[]).reduce((s, k) => s + (PB_COST[abilities[k]] ?? 0), 0);
}

function buildRaceInfo(race: string, custom: CustomRaceConfig): RaceInfo {
  if (race !== CUSTOM_RACE) return RACES.find(r => r.name === race) ?? RACES[0];
  return {
    name: custom.displayName || 'Razza Custom',
    category: 'custom',
    bonuses: custom.bonuses,
    extraFeat: custom.extraFeat,
    extraSkills: custom.extraSkillPoints,
    speed: custom.speed,
    small: custom.small,
    desc: custom.description,
    racialLanguages: custom.racialLanguages,
  };
}

function buildClassInfo(cls: string, custom: CustomClassConfig): ClassInfoFull {
  if (cls !== CUSTOM_CLASS) return CLASSES.find(c => c.name === cls) ?? CLASSES[0];
  return {
    name: custom.displayName || 'Classe Custom',
    eng: custom.displayName || 'Custom',
    iconName: null,
    desc: 'Classe personalizzata.',
    hitDie: custom.hitDie,
    sp: custom.sp,
    bab: custom.bab,
    fort: custom.fort,
    ref: custom.ref,
    will: custom.will,
    classSkills: custom.classSkills,
  };
}

function finalAbility(base: number, key: AbilityKey, raceInfo: RaceInfo): number {
  return base + (raceInfo.bonuses[key] ?? 0);
}

function skillPointPool(classInfo: ClassInfoFull, intScore: number, raceInfo: RaceInfo): number {
  const intMod = abilityMod(intScore);
  const perLevel = Math.max(1, classInfo.sp + intMod);
  return perLevel * 4 + raceInfo.extraSkills;
}

function usedSkillPoints(skills: WizardData['skills']): number {
  return Object.values(skills).reduce((s, sk) => s + sk.ranks * (sk.classSkill ? 1 : 2), 0);
}

/**
 * Materialise the full skill list for the character, including skills with
 * 0 ranks. Each skill carries the correct `classSkill` flag (taken from the
 * wizard override or the class default) so the player can later modify ranks
 * directly from the sheet without re-running the wizard.
 */
function buildFullSkillRecord(
  wizSkills: WizardData['skills'],
  overrides: WizardData['classSkillOverrides'],
  classSkillIds: string[],
): Record<string, import('../../types/dnd').Skill> {
  const out: Record<string, import('../../types/dnd').Skill> = {};
  for (const s of ALL_SKILLS) {
    const isClass = overrides[s.name] !== undefined
      ? overrides[s.name]
      : isDefaultClassSkill(s.name, classSkillIds);
    const existing = wizSkills[s.name];
    out[s.name] = {
      id: s.name,
      name: s.name,
      ...(s.localizedName ? { localizedName: s.localizedName } : {}),
      stat: s.stat as any,
      ranks: existing?.ranks ?? 0,
      classSkill: isClass,
      armorCheckPenalty: s.armorCheck,
      canUseUntrained: s.untrained,
    };
  }
  return out;
}

function buildFixedLangs(raceInfo: RaceInfo): string[] {
  return ['Comune', ...raceInfo.racialLanguages];
}

// ─────────────────────────── Catalog → wizard adapters ──────────────────────

/** Convert a `CatalogRace` (Firestore) into the wizard's `RaceInfo` shape. */
function catalogRaceToRaceInfo(r: CatalogRace, lang: string): RaceInfo {
  const bonuses: Partial<Record<AbilityKey, number>> = {};
  for (const m of r.abilityMods) bonuses[m.stat as AbilityKey] = (bonuses[m.stat as AbilityKey] ?? 0) + m.value;
  // Resolve language ids → labels by best-effort (cached pool name match).
  const racialLangs = r.automaticLanguages
    .map(id => id) // names are pushed into ALL_LANGUAGES_POOL by the loader; ids are kept for now
    .filter(Boolean);
  const small = r.size === 'Piccola' || r.size === 'Minuscola';
  return {
    name: pickLocalized(r.name, lang) || 'Razza',
    category: 'custom',
    bonuses,
    extraFeat: r.racialFeats.some(f => /talento bonus/i.test(pickLocalized(f.name, lang))),
    extraSkills: 0,
    speed: r.speed,
    small,
    desc: pickLocalized(r.description, lang) || '',
    racialLanguages: racialLangs,
  };
}

/** Convert a `CatalogClass` (Firestore) into the wizard's `ClassInfoFull` shape. */
function catalogClassToClassInfo(c: CatalogClass, lang: string): ClassInfoFull {
  return {
    name: pickLocalized(c.name, lang) || 'Classe',
    eng: pickLocalized(c.name, 'en') || pickLocalized(c.name, lang) || 'Class',
    iconName: null,
    desc: pickLocalized(c.description, lang) || '',
    hitDie: c.hitDie,
    sp: c.skillPointsPerLevel,
    bab: c.babProgression,
    fort: c.fortitude,
    ref: c.reflex,
    will: c.will,
    classSkills: c.classSkillIds,
  };
}

// ─────────────────────────── Race category badge ────────────────────────────

const RACE_CAT_LABEL: Record<string, string> = { phb: 'PHB', fr: 'Reami', exotic: 'Esotica', custom: 'Custom' };

function RaceCategoryBadge({ cat }: { cat: string }) {
  const bg: Record<string, string> = {
    phb: 'rgba(201,168,76,0.2)', fr: 'rgba(93,173,226,0.2)',
    exotic: 'rgba(155,89,182,0.2)', custom: 'rgba(39,174,96,0.2)',
  };
  const fg: Record<string, string> = {
    phb: 'var(--accent-gold)', fr: '#5dade2',
    exotic: 'var(--accent-arcane)', custom: '#27ae60',
  };
  return (
    <span style={{
      display: 'inline-block', fontSize: '0.55rem', padding: '0.1rem 0.38rem',
      borderRadius: 2, fontFamily: 'var(--font-heading)', letterSpacing: '0.07em',
      textTransform: 'uppercase', background: bg[cat] ?? 'transparent', color: fg[cat] ?? 'var(--text-muted)',
    }}>
      {RACE_CAT_LABEL[cat] ?? cat}
    </span>
  );
}

// ─────────────────────────── Custom Race Form ───────────────────────────────

function CustomRaceForm({ config, onChange }: { config: CustomRaceConfig; onChange: (c: CustomRaceConfig) => void }) {
  const set = <K extends keyof CustomRaceConfig>(k: K, v: CustomRaceConfig[K]) => onChange({ ...config, [k]: v });

  const setBonusStat = (key: AbilityKey, val: string) => {
    const n = parseInt(val, 10);
    const bonuses = { ...config.bonuses };
    if (n === 0 || isNaN(n)) { delete bonuses[key]; } else { bonuses[key] = n; }
    onChange({ ...config, bonuses });
  };

  const [customLang, setCustomLang] = useState('');
  const addRacialLang = () => {
    const l = customLang.trim();
    if (!l || config.racialLanguages.includes(l)) return;
    set('racialLanguages', [...config.racialLanguages, l]);
    setCustomLang('');
  };

  return (
    <div className="custom-config-form">
      <div className="custom-config-title">
        <DndIcon category="game" name="character" size={16} style={{ color: '#27ae60' }} />
        Configura Razza Personalizzata
      </div>

      <div className="form-group" style={{ marginBottom: '0.7rem' }}>
        <label className="form-label">Nome Razza *</label>
        <input className="input" placeholder="Es: Dragonide, Kenku…" value={config.displayName}
          onChange={e => set('displayName', e.target.value)} />
      </div>

      <div className="form-group" style={{ marginBottom: '0.8rem' }}>
        <label className="form-label">Descrizione</label>
        <textarea className="input" rows={2} style={{ resize: 'vertical', minHeight: 52 }}
          placeholder="Tratti, origini, aspetto…"
          value={config.description} onChange={e => set('description', e.target.value)} />
      </div>

      <div style={{ marginBottom: '0.8rem' }}>
        <div className="form-label" style={{ marginBottom: '0.4rem' }}>Bonus Caratteristiche</div>
        <div className="custom-ability-bonus-grid">
          {(Object.keys(STAT_ABBR) as AbilityKey[]).map(k => (
            <div key={k} className="custom-ability-bonus-cell">
              <DndIcon category="ability" name={ABILITY_ICON[k]} size={14}
                style={{ color: 'var(--accent-gold)', opacity: 0.7, marginBottom: 2 }} />
              <span className="custom-ability-bonus-label">{STAT_ABBR[k]}</span>
              <select className="input" style={{ padding: '0.22rem 0.3rem', fontSize: '0.8rem', textAlign: 'center' }}
                value={config.bonuses[k] ?? 0} onChange={e => setBonusStat(k, e.target.value)}>
                {[-6, -4, -2, 0, 2, 4, 6].map(v => (
                  <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.55rem', marginBottom: '0.8rem' }}>
        <div className="form-group">
          <label className="form-label">Velocità (m)</label>
          <input className="input" type="number" min={3} max={18} step={3}
            value={config.speed} onChange={e => set('speed', +e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Punti AB extra</label>
          <input className="input" type="number" min={0} max={8}
            value={config.extraSkillPoints} onChange={e => set('extraSkillPoints', +e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Talento bonus</label>
          <button className={`btn-secondary w-full${config.extraFeat ? ' active' : ''}`}
            style={{ justifyContent: 'center', height: 34 }} onClick={() => set('extraFeat', !config.extraFeat)}>
            {config.extraFeat ? <><FaCheck size={9} style={{ marginRight: 3 }} />Sì</> : 'No'}
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">Taglia piccola</label>
          <button className={`btn-secondary w-full${config.small ? ' active' : ''}`}
            style={{ justifyContent: 'center', height: 34 }} onClick={() => set('small', !config.small)}>
            {config.small ? <><FaCheck size={9} style={{ marginRight: 3 }} />Piccola</> : 'Media'}
          </button>
        </div>
      </div>

      <div>
        <div className="form-label" style={{ marginBottom: '0.3rem' }}>Lingue Razziali</div>
        <div className="languages-list" style={{ marginBottom: '0.4rem' }}>
          <span className="language-tag fixed">Comune</span>
          {config.racialLanguages.map(l => (
            <span key={l} className="language-tag">
              {l}
              <button className="language-tag-remove"
                onClick={() => set('racialLanguages', config.racialLanguages.filter(x => x !== l))}>×</button>
            </span>
          ))}
        </div>
        <div className="language-add">
          <input className="input" placeholder="Aggiungi lingua razziale…" value={customLang}
            onChange={e => setCustomLang(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addRacialLang(); }}
            style={{ maxWidth: 200, fontSize: '0.8rem' }} />
          <button className="btn-secondary" onClick={addRacialLang} disabled={!customLang.trim()}>
            <FaPlus size={10} /> Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Custom Class Form ──────────────────────────────

function CustomClassForm({ config, onChange }: { config: CustomClassConfig; onChange: (c: CustomClassConfig) => void }) {
  const set = <K extends keyof CustomClassConfig>(k: K, v: CustomClassConfig[K]) => onChange({ ...config, [k]: v });
  const [showAllSkills, setShowAllSkills] = useState(false);

  const toggleSkill = (skillId: string) => {
    const next = config.classSkills.includes(skillId)
      ? config.classSkills.filter(s => s !== skillId)
      : [...config.classSkills, skillId];
    set('classSkills', next);
  };

  return (
    <div className="custom-config-form">
      <div className="custom-config-title">
        <DndIcon category="game" name="character" size={16} style={{ color: '#27ae60' }} />
        Configura Classe Personalizzata
      </div>

      <div className="form-group" style={{ marginBottom: '0.7rem' }}>
        <label className="form-label">Nome Classe *</label>
        <input className="input" placeholder="Es: Spadaccino, Sciamano…" value={config.displayName}
          onChange={e => set('displayName', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
        <div>
          <div className="form-label" style={{ marginBottom: '0.4rem' }}>Dado Vita</div>
          <div className="custom-die-row">
            {[4, 6, 8, 10, 12].map(d => (
              <button key={d} className={`custom-die-btn${config.hitDie === d ? ' selected' : ''}`}
                onClick={() => set('hitDie', d)}>
                <DndIcon category="dice" name={`d${d}`} size={20}
                  style={{ color: config.hitDie === d ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
                <span>d{d}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div>
            <div className="form-label" style={{ marginBottom: '0.3rem' }}>BAB</div>
            <div className="custom-radio-row">
              {(['high', 'medium', 'low'] as const).map(v => (
                <button key={v} className={`custom-radio-btn${config.bab === v ? ' selected' : ''}`}
                  onClick={() => set('bab', v)}>
                  {v === 'high' ? 'Alto' : v === 'medium' ? 'Medio' : 'Basso'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: '0.3rem' }}>Punti AB/livello</div>
            <div className="custom-radio-row">
              {[2, 4, 6, 8].map(v => (
                <button key={v} className={`custom-radio-btn${config.sp === v ? ' selected' : ''}`}
                  onClick={() => set('sp', v)}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem' }}>
        {(['fort', 'ref', 'will'] as const).map(save => {
          const label = save === 'fort' ? 'Tempra' : save === 'ref' ? 'Riflessi' : 'Volontà';
          return (
            <div key={save}>
              <div className="form-label" style={{ marginBottom: '0.3rem' }}>
                <DndIcon category="attribute" name="saving-throw" size={11}
                  style={{ color: 'var(--accent-gold)', marginRight: 3 }} />
                {label}
              </div>
              <div className="custom-radio-row">
                <button className={`custom-radio-btn${config[save] === 'good' ? ' selected' : ''}`}
                  onClick={() => set(save, 'good')}>Alto</button>
                <button className={`custom-radio-btn${config[save] === 'poor' ? ' selected' : ''}`}
                  onClick={() => set(save, 'poor')}>Basso</button>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <button className="form-label"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: '0.4rem', color: 'inherit' }}
          onClick={() => setShowAllSkills(s => !s)}>
          <DndIcon category="attribute" name="skillcheck" size={12} style={{ color: 'var(--accent-gold)' }} />
          Abilità di classe ({config.classSkills.length})
          {showAllSkills ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
        </button>
        {showAllSkills && (
          <div className="custom-skills-grid">
            {ALL_SKILLS.map(s => (
              <label key={s.id} className="custom-skill-check">
                <input type="checkbox" checked={config.classSkills.includes(s.id)}
                  onChange={() => toggleSkill(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        )}
        {!showAllSkills && config.classSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {config.classSkills.map(id => {
              const sk = ALL_SKILLS.find(s => s.id === id);
              return sk ? <span key={id} className="summary-tag" style={{ fontSize: '0.67rem' }}>{sk.name}</span> : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── STEP 1 — Edition ───────────────────────────────

function Step1Edition() {
  return (
    <div>
      <div className="wizard-step-header-row">
        <DndIcon category="game" name="adventure-book" size={24} style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="wizard-step-title">Scegli l'Edizione</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            D&amp;D 3.5 è l'unica edizione attualmente supportata. La 5e sarà disponibile prossimamente.
          </p>
        </div>
      </div>
      <div className="edition-cards">
        <div className="edition-card selected">
          <div className="edition-badge active-ed">Attiva</div>
          <div className="edition-card-icon">
            <DndIcon category="entity" name="scroll" size={52} style={{ color: 'var(--accent-gold)' }} />
          </div>
          <div className="edition-card-name">3.5</div>
          <div className="edition-card-desc">
            Sistema classico a classi e livelli con BAB, tiri salvezza separati e point buy da 28 punti.
          </div>
        </div>
        <div className="edition-card disabled">
          <div className="edition-badge coming-soon">Prossimamente</div>
          <div className="edition-card-icon">
            <DndIcon category="dice" name="d20" size={52} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          </div>
          <div className="edition-card-name">5e</div>
          <div className="edition-card-desc">
            Sistema moderno semplificato con vantaggio/svantaggio e bonus di competenza unificato.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── STEP 2 — Identity ──────────────────────────────

interface StepProps {
  data: WizardData;
  setData: React.Dispatch<React.SetStateAction<WizardData>>;
}

function Step2Identity({ data, setData }: StepProps) {
  const [raceFilter, setRaceFilter] = useState<'all' | 'phb' | 'fr' | 'exotic'>('all');

  const selectRace = (raceName: string) => {
    const ri = buildRaceInfo(raceName, data.customRaceConfig);
    const fixed = buildFixedLangs(ri);
    setData(prev => ({
      ...prev,
      race: raceName,
      languages: fixed.map((n, i) => ({ id: i === 0 ? 'comune' : uuidv4(), name: n })),
      fixedLangNames: new Set(fixed),
    }));
  };

  const raceInfo = buildRaceInfo(data.race, data.customRaceConfig);
  const intFinal = finalAbility(data.abilities.int, 'int', raceInfo);
  const langBudget = Math.max(0, abilityMod(intFinal));
  const usedExtra = data.languages.filter(l => !data.fixedLangNames.has(l.name)).length;
  const canAddLang = usedExtra < langBudget;

  const [customLangText, setCustomLangText] = useState('');
  const addLanguage = (name: string) => {
    if (!canAddLang || data.languages.some(l => l.name === name)) return;
    setData(prev => ({ ...prev, languages: [...prev.languages, { id: uuidv4(), name }] }));
  };
  const addCustomLang = () => {
    const n = customLangText.trim();
    if (n) { addLanguage(n); setCustomLangText(''); }
  };
  const removeLang = (id: string) => {
    const lang = data.languages.find(l => l.id === id);
    if (!lang || data.fixedLangNames.has(lang.name)) return;
    setData(prev => ({ ...prev, languages: prev.languages.filter(l => l.id !== id) }));
  };

  const filteredRaces = raceFilter === 'all' ? RACES : RACES.filter(r => r.category === raceFilter);

  return (
    <div>
      <div className="wizard-step-header-row">
        <DndIcon category="game" name="character" size={24} style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="wizard-step-title">Identità del Personaggio</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            Nome, razza, allineamento e tratti fondamentali del tuo eroe.
          </p>
        </div>
      </div>

      <div className="form-grid" style={{ marginBottom: '0.9rem', marginTop: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Nome *</label>
          <input className="input" placeholder="Es: Kaelen Vaelen, Thornir Ironmantle…"
            value={data.name} onChange={e => setData(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">URL Immagine Personaggio</label>
          <input className="input" type="url" placeholder="https://…"
            value={data.avatarUrl} onChange={e => setData(p => ({ ...p, avatarUrl: e.target.value }))} />
          {data.avatarUrl && (
            <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <img src={data.avatarUrl} alt="Anteprima" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Anteprima</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label">Razza *</label>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {(['all', 'phb', 'fr', 'exotic'] as const).map(f => (
            <button key={f}
              className={`ability-mode-tab${raceFilter === f ? ' active' : ''}`}
              style={{ fontSize: '0.62rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setRaceFilter(f)}>
              {f === 'all' ? 'Tutte' : RACE_CAT_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="race-grid" style={{ marginBottom: data.race === CUSTOM_RACE ? '0.5rem' : '1rem' }}>
        {filteredRaces.map(r => {
          const bonusStr = Object.entries(r.bonuses)
            .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${STAT_ABBR[k]}`)
            .join(', ');
          const catalogRaceForCard = CATALOG_RACE_BY_NAME[r.name];
          const raceIconSvg = catalogRaceForCard?.iconId
            ? CATALOG_ICON_SVG_BY_ID[catalogRaceForCard.iconId]
            : undefined;
          return (
            <div key={r.name} className={`race-card${data.race === r.name ? ' selected' : ''}`}
              onClick={() => selectRace(r.name)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.15rem', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {raceIconSvg && (
                    <span
                      style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, filter: 'brightness(0) invert(1)' }}
                      dangerouslySetInnerHTML={{ __html: raceIconSvg }}
                    />
                  )}
                  <div className="race-card-name">{r.name}</div>
                </div>
                <RaceCategoryBadge cat={r.category} />
              </div>
              {bonusStr && <div className="race-card-bonus">{bonusStr}</div>}
              <div className="race-card-desc">{r.desc}</div>
              {r.racialLanguages.length > 0 && (
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-arcane)', marginTop: '0.2rem' }}>
                  +Lingua: {r.racialLanguages.join(', ')}
                </div>
              )}
            </div>
          );
        })}
        {raceFilter === 'all' && (
          <div className={`race-card${data.race === CUSTOM_RACE ? ' selected' : ''}`}
            onClick={() => selectRace(CUSTOM_RACE)} style={{ borderStyle: 'dashed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.15rem' }}>
              <div className="race-card-name">Razza Custom</div>
              <RaceCategoryBadge cat="custom" />
            </div>
            <div className="race-card-desc">Crea la tua razza con bonus a scelta, lingue e tratti.</div>
          </div>
        )}
      </div>

      {data.race === CUSTOM_RACE && (
        <CustomRaceForm config={data.customRaceConfig} onChange={cfg => {
          const fixed = ['Comune', ...cfg.racialLanguages];
          setData(prev => ({
            ...prev,
            customRaceConfig: cfg,
            languages: fixed.map((n, i) => ({ id: i === 0 ? 'comune' : uuidv4(), name: n })),
            fixedLangNames: new Set(fixed),
          }));
        }} />
      )}

      <div className="form-grid form-grid-3" style={{ margin: '1rem 0 0.9rem' }}>
        <div className="form-group">
          <label className="form-label">Allineamento *</label>
          <select className="input" value={data.alignment}
            onChange={e => setData(p => ({ ...p, alignment: e.target.value }))}>
            {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Genere</label>
          <input className="input" placeholder="Es: Maschile" value={data.gender}
            onChange={e => setData(p => ({ ...p, gender: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Età</label>
          <input className="input" type="number" min={1} max={999} placeholder="Es: 22"
            value={data.age} onChange={e => setData(p => ({ ...p, age: e.target.value }))} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label className="form-label">Descrizione / Background</label>
        <textarea className="input" rows={3} style={{ resize: 'vertical', minHeight: 70 }}
          placeholder="Storia, aspetto, motivazioni…"
          value={data.background} onChange={e => setData(p => ({ ...p, background: e.target.value }))} />
      </div>

      <div className="languages-section">
        <div className="languages-title">
          <DndIcon category="entity" name="book" size={13} style={{ color: 'var(--accent-arcane)', marginRight: 4 }} />
          Lingue ({usedExtra}/{langBudget} bonus — Int {signedMod(intFinal)})
        </div>
        <div className="languages-list">
          {data.languages.map(l => (
            <span key={l.id} className={`language-tag${data.fixedLangNames.has(l.name) ? ' fixed' : ''}`}>
              {l.name}
              {!data.fixedLangNames.has(l.name) && (
                <button className="language-tag-remove" onClick={() => removeLang(l.id)}>×</button>
              )}
            </span>
          ))}
        </div>
        {langBudget > 0 && (
          <div className="language-add">
            <select className="input" style={{ maxWidth: 180, fontSize: '0.78rem' }}
              defaultValue="" disabled={!canAddLang}
              onChange={e => { if (e.target.value) { addLanguage(e.target.value); e.target.value = ''; } }}>
              <option value="" disabled>Da elenco…</option>
              {ALL_LANGUAGES_POOL.filter(l => !data.languages.some(dl => dl.name === l)).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <input className="input" placeholder="Lingua custom…" value={customLangText}
              onChange={e => setCustomLangText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomLang(); }}
              style={{ maxWidth: 150, fontSize: '0.78rem' }} />
            <button className="btn-secondary" onClick={addCustomLang}
              disabled={!customLangText.trim() || !canAddLang}>
              <FaPlus size={10} />
            </button>
            {!canAddLang && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Slot esauriti</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── STEP 3 — Class ─────────────────────────────────

function Step3Class({ data, setData }: StepProps) {
  const selectClass = (name: string) =>
    setData(prev => ({ ...prev, className: name, skills: {}, classSkillOverrides: {} }));

  const selected = data.className ? buildClassInfo(data.className, data.customClassConfig) : null;

  const dieColorClass = (d: number) => {
    if (d >= 12) return 'die-12';
    if (d >= 10) return 'die-10';
    if (d >= 8) return 'die-8';
    if (d >= 6) return 'die-6';
    return 'die-4';
  };

  return (
    <div>
      <div className="wizard-step-header-row">
        {selected?.iconName
          ? <DndIcon category="class" name={selected.iconName} size={24} style={{ color: 'var(--accent-gold)' }} />
          : <DndIcon category="game" name="combat" size={24} style={{ color: 'var(--accent-gold)' }} />
        }
        <div>
          <h3 className="wizard-step-title">Scelta della Classe</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            La classe determina il tuo stile di combattimento, le abilità e la progressione.
          </p>
        </div>
      </div>

      {selected && (
        <div className="wizard-info-box" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '0.9rem' }}>
          {selected.iconName && (
            <DndIcon category="class" name={selected.iconName} size={32}
              style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
          )}
          <div>
            <strong>{selected.name}</strong> — {' '}
            <DndIcon category="dice" name={`d${selected.hitDie}`} size={13}
              style={{ color: 'var(--accent-gold)', marginRight: 2, verticalAlign: 'middle' }} />
            d{selected.hitDie} PF &nbsp;·&nbsp;
            BAB {selected.bab === 'high' ? 'Alto' : selected.bab === 'medium' ? 'Medio' : 'Basso'} &nbsp;·&nbsp;
            <DndIcon category="attribute" name="saving-throw" size={12}
              style={{ color: 'var(--accent-gold)', marginRight: 2, verticalAlign: 'middle' }} />
            Tempra {selected.fort === 'good' ? '✓' : '—'} &nbsp;
            Ref {selected.ref === 'good' ? '✓' : '—'} &nbsp;
            Volontà {selected.will === 'good' ? '✓' : '—'} &nbsp;·&nbsp;
            {selected.sp}+Int punti AB/livello
          </div>
        </div>
      )}

      <div className="class-grid" style={{ marginTop: '0.9rem' }}>
        {CLASSES.map(c => {
          const catalogClassForCard = CATALOG_CLASS_BY_NAME[c.name];
          const classIconSvg = catalogClassForCard?.iconId
            ? CATALOG_ICON_SVG_BY_ID[catalogClassForCard.iconId]
            : undefined;
          return (
            <div key={c.name} className={`class-card${data.className === c.name ? ' selected' : ''}`}
              onClick={() => selectClass(c.name)}>
              <div className="class-card-header">
                {classIconSvg ? (
                  <span
                    style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', filter: 'brightness(0) invert(1)' }}
                    dangerouslySetInnerHTML={{ __html: classIconSvg }}
                  />
                ) : c.iconName && (
                  <DndIcon category="class" name={c.iconName} size={26}
                    style={{ color: data.className === c.name ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
                )}
                <span className="class-card-name">{c.name}</span>
              </div>
              <div className="class-card-desc">{c.desc}</div>
              <div className="class-card-stats">
                <span className={`class-stat-chip ${dieColorClass(c.hitDie)}`}>
                  <DndIcon category="dice" name={`d${c.hitDie}`} size={11}
                    style={{ marginRight: 2, verticalAlign: 'middle' }} />
                  d{c.hitDie}
                </span>
                <span className="class-stat-chip">
                  BAB {c.bab === 'high' ? 'Alto' : c.bab === 'medium' ? 'Med' : 'Basso'}
                </span>
                <span className="class-stat-chip">{c.sp}+Int AB</span>
              </div>
            </div>
          );
        })}
        <div className={`class-card${data.className === CUSTOM_CLASS ? ' selected' : ''}`}
          onClick={() => selectClass(CUSTOM_CLASS)} style={{ borderStyle: 'dashed' }}>
          <div className="class-card-header">
            <DndIcon category="game" name="character" size={26}
              style={{ color: data.className === CUSTOM_CLASS ? '#27ae60' : 'var(--text-muted)' }} />
            <span className="class-card-name">Classe Custom</span>
          </div>
          <div className="class-card-desc">Crea la tua classe con dado vita, BAB, tiri salvezza e abilità a scelta.</div>
          <div className="class-card-stats">
            <span className="class-stat-chip" style={{ color: '#27ae60' }}>Personalizzata</span>
          </div>
        </div>
      </div>

      {data.className === CUSTOM_CLASS && (
        <div style={{ marginTop: '0.8rem' }}>
          <CustomClassForm config={data.customClassConfig}
            onChange={cfg => setData(prev => ({ ...prev, customClassConfig: cfg, skills: {} }))} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── STEP 4 — Abilities ─────────────────────────────

function Step4Abilities({ data, setData }: StepProps) {
  const { abilities, abilityMode } = data;
  const raceInfo = buildRaceInfo(data.race, data.customRaceConfig);
  const cost = totalPBCost(abilities);
  const remaining = PB_TOTAL - cost;

  const adjustStat = (key: AbilityKey, delta: number) => {
    setData(prev => {
      const cur = prev.abilities[key];
      const next = cur + delta;
      if (next < 8 || next > 18) return prev;
      if (delta > 0) {
        const costDiff = (PB_COST[next] ?? 0) - (PB_COST[cur] ?? 0);
        if (totalPBCost(prev.abilities) + costDiff > PB_TOTAL) return prev;
      }
      return { ...prev, abilities: { ...prev.abilities, [key]: next } };
    });
  };

  const manualChange = (key: AbilityKey, val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    setData(prev => ({ ...prev, abilities: { ...prev.abilities, [key]: n } }));
  };

  const manualBlur = (key: AbilityKey) => {
    setData(prev => {
      const clamped = Math.max(3, Math.min(25, prev.abilities[key]));
      return { ...prev, abilities: { ...prev.abilities, [key]: clamped } };
    });
  };

  return (
    <div>
      <div className="wizard-step-header-row">
        <DndIcon category="ability" name="strength" size={24} style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="wizard-step-title">Caratteristiche</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            Assegna i punteggi base. I bonus razziali vengono applicati automaticamente.
          </p>
        </div>
      </div>

      <div className="abilities-mode-tabs" style={{ marginTop: '0.9rem' }}>
        <button className={`ability-mode-tab${abilityMode === 'pointbuy' ? ' active' : ''}`}
          onClick={() => setData(p => ({ ...p, abilityMode: 'pointbuy' }))}>
          <DndIcon category="dice" name="roll" size={12} style={{ marginRight: 4 }} />
          Point Buy (28 pt)
        </button>
        <button className={`ability-mode-tab${abilityMode === 'manual' ? ' active' : ''}`}
          onClick={() => setData(p => ({ ...p, abilityMode: 'manual' }))}>
          Manuale / Lancio
        </button>
      </div>

      {abilityMode === 'pointbuy' && (
        <div className="point-buy-info">
          <span className="point-buy-label">Punti rimanenti</span>
          <span className={`point-buy-count${remaining < 0 ? ' over' : remaining === 0 ? ' exact' : ''}`}>
            {remaining} / {PB_TOTAL}
          </span>
        </div>
      )}

      <div className="ability-grid">
        {(Object.keys(STAT_NAMES) as AbilityKey[]).map(key => {
          const base = abilities[key];
          const racialBonus = raceInfo.bonuses[key] ?? 0;
          const final = base + racialBonus;

          return (
            <div key={key} className="ability-cell">
              <div className="ability-cell-top">
                <DndIcon category="ability" name={ABILITY_ICON[key]} size={20}
                  style={{ color: 'var(--accent-gold)', opacity: 0.8 }} />
                <span className="ability-name">{STAT_NAMES[key]}</span>
              </div>
              {abilityMode === 'pointbuy' ? (
                <div className="ability-controls">
                  <button className="ability-btn" onClick={() => adjustStat(key, -1)} disabled={base <= 8}>−</button>
                  <span className="ability-value">{base}</span>
                  <button className="ability-btn" onClick={() => adjustStat(key, 1)}
                    disabled={base >= 18 || remaining - ((PB_COST[base + 1] ?? 99) - (PB_COST[base] ?? 0)) < 0}>+</button>
                </div>
              ) : (
                <input className="ability-input" type="number" min={3} max={25}
                  value={base} onChange={e => manualChange(key, e.target.value)}
                  onBlur={() => manualBlur(key)} />
              )}
              {racialBonus !== 0 && (
                <div className="ability-racial-bonus">{racialBonus > 0 ? `+${racialBonus}` : racialBonus} razza</div>
              )}
              <div className="ability-final-line">Totale: <strong>{final}</strong></div>
              <div className="ability-mod-display">Mod {signedMod(final)}</div>
            </div>
          );
        })}
      </div>

      {abilityMode === 'pointbuy' && remaining < 0 && (
        <div style={{ color: 'var(--accent-crimson)', fontSize: '0.78rem', textAlign: 'center', marginTop: '0.5rem' }}>
          ⚠ Hai speso {-remaining} punti in più del consentito.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── STEP 5 — Skills ────────────────────────────────

function Step5Skills({ data, setData }: StepProps) {
  const classInfo = buildClassInfo(data.className, data.customClassConfig);
  const raceInfo = buildRaceInfo(data.race, data.customRaceConfig);
  const intFinal = finalAbility(data.abilities.int, 'int', raceInfo);
  const pool = skillPointPool(classInfo, intFinal, raceInfo);

  const getIsClass = (skillName: string): boolean => {
    const override = data.classSkillOverrides[skillName];
    return override !== undefined ? override : isDefaultClassSkill(skillName, classInfo.classSkills);
  };

  const getRanks = (skillName: string) => data.skills[skillName]?.ranks ?? 0;
  const usedSP = usedSkillPoints(data.skills);
  const remaining = pool - usedSP;

  const toggleClassSkill = (skillName: string) => {
    const newIsClass = !getIsClass(skillName);
    setData(prev => {
      const newOverrides = { ...prev.classSkillOverrides, [skillName]: newIsClass };
      const existingRanks = prev.skills[skillName]?.ranks ?? 0;
      const clampedRanks = Math.min(existingRanks, newIsClass ? 4 : 2);
      const newSkills = { ...prev.skills };
      if (existingRanks > 0) {
        if (clampedRanks === 0) { delete newSkills[skillName]; }
        else { newSkills[skillName] = { ...prev.skills[skillName], classSkill: newIsClass, ranks: clampedRanks }; }
      }
      return { ...prev, classSkillOverrides: newOverrides, skills: newSkills };
    });
  };

  const changeRanks = (skill: typeof ALL_SKILLS[number], delta: number) => {
    setData(prev => {
      const isClass = prev.classSkillOverrides[skill.name] !== undefined
        ? prev.classSkillOverrides[skill.name]
        : isDefaultClassSkill(skill.name, classInfo.classSkills);
      const maxR = isClass ? 4 : 2;
      const cur = prev.skills[skill.name]?.ranks ?? 0;
      const next = cur + delta;
      if (next < 0 || next > maxR) return prev;
      // Note: we deliberately allow exceeding the pool; the wizard shows a
      // negative "rimanenti" counter so the user is aware of the overflow.
      const updated = { ...prev.skills };
      if (next === 0) {
        delete updated[skill.name];
      } else {
        updated[skill.name] = {
          id: skill.name, name: skill.name, stat: skill.stat as any,
          ranks: next, classSkill: isClass,
          armorCheckPenalty: skill.armorCheck, canUseUntrained: skill.untrained,
        };
      }
      return { ...prev, skills: updated };
    });
  };

  return (
    <div>
      <div className="wizard-step-header-row">
        <DndIcon category="attribute" name="skillcheck" size={24} style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="wizard-step-title">Abilità</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            Clicca il pallino per cambiare classe/fuori classe. ● classe (max 4 gradi, costo 1), ○ fuori classe (max 2, costo 2).
            Pool = ({classInfo.sp}+Int mod)×4{raceInfo.extraSkills > 0 ? `+${raceInfo.extraSkills}` : ''}.
          </p>
        </div>
      </div>

      <div className="skills-info-bar" style={{ marginTop: '0.9rem' }}>
        <span className="skills-info-label">Pool totale: <strong>{pool}</strong></span>
        <span className="skills-info-label" style={{ marginLeft: 8 }}>Spesi: <strong style={{ color: 'var(--accent-gold)' }}>{usedSP}</strong></span>
        <span className="skills-info-count" style={remaining < 0 ? { color: 'var(--accent-crimson)', fontWeight: 600 } : {}}>
          {remaining < 0 ? `⚠ ${Math.abs(remaining)} OLTRE LA POOL` : `${remaining} rimanenti`}
        </span>
      </div>

      <table className="skills-table">
        <thead>
          <tr>
            <th style={{ width: 20 }} title="Abilità di classe / fuori classe — clicca per cambiare"></th>
            <th>Abilità</th>
            <th>Car.</th>
            <th>Gradi</th>
            <th title="Costo in punti abilità per grado (classe=1, fuori classe=2)">Costo</th>
            <th>Mod</th>
            <th>Tot.</th>
          </tr>
        </thead>
        <tbody>
          {ALL_SKILLS.map(skill => {
            const isClass = getIsClass(skill.name);
            const ranks = getRanks(skill.name);
            const statVal = finalAbility(data.abilities[skill.stat as AbilityKey] ?? 10, skill.stat as AbilityKey, raceInfo);
            const mod = abilityMod(statVal);
            const total = ranks + mod;
            return (
              <tr key={skill.name}>
                <td>
                  <button
                    title={isClass ? 'Classe (clic → fuori classe)' : 'Fuori classe (clic → classe)'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    onClick={() => toggleClassSkill(skill.name)}>
                    {isClass
                      ? <span className="skill-class-dot" />
                      : <span className="skill-cross-dot" />
                    }
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {skill.icon && (
                      <DndIcon category="skill" name={skill.icon} size={12}
                        style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    {skill.name}
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{STAT_ABBR[skill.stat]}</td>
                <td>
                  <div className="skill-rank-controls">
                    <button className="skill-rank-btn" onClick={() => changeRanks(skill, -1)} disabled={ranks === 0}>−</button>
                    <span className="skill-rank-value">{ranks}</span>
                    <button className="skill-rank-btn" onClick={() => changeRanks(skill, 1)}
                      disabled={ranks >= (isClass ? 4 : 2)}>+</button>
                  </div>
                </td>
                <td style={{ fontSize: '0.65rem', textAlign: 'center' }}>
                  {isClass
                    ? <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>1</span>
                    : <span style={{ color: '#e67e22', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>2</span>
                  }
                </td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{signedMod(statVal)}</td>
                <td>
                  {ranks > 0
                    ? <span className="skill-total-val">{total >= 0 ? `+${total}` : total}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <FeatPicker data={data} setData={setData} />
    </div>
  );
}

/* Selector for the starting feats. Every PC starts with 1 feat (Humans &
 * Halfling Strongheart get an extra one via `extraFeat`). The list is loaded
 * from `catalog_feats` in the BackOffice; if the catalog is empty the user
 * can still type a custom feat name. */
function FeatPicker({ data, setData }: StepProps) {
  const raceInfo = buildRaceInfo(data.race, data.customRaceConfig);
  const baseFeatSlots = 1 + (raceInfo.extraFeat ? 1 : 0);
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const lowerSearch = search.trim().toLowerCase();
  const filtered = WIZARD_FEATS
    .filter(f => !lowerSearch || f.name.toLowerCase().includes(lowerSearch))
    .slice(0, 30);
  const isPicked = (id: string) => data.feats.some(f => f.id === id);

  const togglePick = (cf: CatalogFeat) => {
    setData(prev => {
      if (prev.feats.some(f => f.id === cf.id)) {
        return { ...prev, feats: prev.feats.filter(f => f.id !== cf.id) };
      }
      const next: Feat = {
        id: cf.id,
        name: cf.name,
        description: cf.description ?? '',
        modifiers: cf.modifiers ?? [],
        creatureModifiers: cf.creatureModifiers ?? [],
        active: true,
      };
      return { ...prev, feats: [...prev.feats, next] };
    });
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    setData(prev => ({
      ...prev,
      feats: [...prev.feats, { id: uuidv4(), name, description: '', modifiers: [], creatureModifiers: [], active: true }],
    }));
    setCustomName('');
  };

  const removePicked = (id: string) =>
    setData(prev => ({ ...prev, feats: prev.feats.filter(f => f.id !== id) }));

  return (
    <div style={{ marginTop: '1.4rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.9rem' }}>
      <div className="wizard-step-header-row" style={{ marginBottom: '0.5rem' }}>
        <DndIcon category="game" name="combat" size={20} style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="wizard-step-title" style={{ fontSize: '1rem' }}>Talenti iniziali</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            Slot disponibili: <strong>{baseFeatSlots}</strong> · Selezionati: <strong>{data.feats.length}</strong>
            {raceInfo.extraFeat && ' (+1 dalla razza)'}
          </p>
        </div>
      </div>

      {data.feats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '0.6rem' }}>
          {data.feats.map(f => (
            <button key={f.id}
              onClick={() => removePicked(f.id)}
              className="summary-tag"
              title="Rimuovi"
              style={{ cursor: 'pointer', border: '1px solid var(--accent-gold)' }}>
              {f.name} <FaTimes size={9} style={{ marginLeft: 4, opacity: 0.7 }} />
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        className="form-input"
        placeholder={WIZARD_FEATS.length > 0 ? `Cerca tra ${WIZARD_FEATS.length} talenti…` : 'Catalogo vuoto — usa l\'aggiunta manuale qui sotto'}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: '0.4rem' }}
      />

      {WIZARD_FEATS.length > 0 && (
        <div style={{
          maxHeight: 180, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6,
          padding: '0.4rem', background: 'var(--bg-elevated)', borderRadius: 6,
        }}>
          {filtered.map(cf => {
            const picked = isPicked(cf.id);
            return (
              <button key={cf.id}
                onClick={() => togglePick(cf)}
                title={cf.description}
                className={picked ? 'summary-tag' : 'summary-tag'}
                style={{
                  cursor: 'pointer',
                  borderColor: picked ? 'var(--accent-gold)' : (cf.isDefect ? 'var(--accent-crimson)' : 'transparent'),
                  background: picked ? 'rgba(201,168,76,0.15)' : undefined,
                }}>
                {cf.name}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nessun risultato.</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Aggiungi talento personalizzato…"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
        />
        <button className="btn-secondary text-sm" onClick={addCustom} disabled={!customName.trim()}>
          <FaPlus size={11} /> Aggiungi
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── STEP 6 — Summary ───────────────────────────────

function Step6Summary({ data }: StepProps) {
  const classInfo = buildClassInfo(data.className, data.customClassConfig);
  const raceInfo = buildRaceInfo(data.race, data.customRaceConfig);

  const KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const ABBR: Record<AbilityKey, string> = { str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR' };

  const finals = KEYS.reduce((acc, k) => {
    acc[k] = finalAbility(data.abilities[k], k, raceInfo);
    return acc;
  }, {} as Record<AbilityKey, number>);

  const conMod = abilityMod(finals.con);
  const dexMod = abilityMod(finals.dex);
  const wisMod = abilityMod(finals.wis);
  const maxHp = Math.max(1, classInfo.hitDie + conMod);
  // Base values (BEFORE ability modifiers). The engine adds the ability
  // modifier at runtime, so we save these raw values to avoid double-counting.
  const acBase = 10;
  const initBase = 0;
  const bab1 = computeClassBab(1, classInfo.bab);
  const fort1 = computeClassSaveBase(1, classInfo.fort);
  const ref1 = computeClassSaveBase(1, classInfo.ref);
  const will1 = computeClassSaveBase(1, classInfo.will);
  // Final values shown in parentheses (after all standard modifiers applied).
  const acFinal = acBase + dexMod;
  const initFinal = initBase + dexMod;
  const fortFinal = fort1 + conMod;
  const refFinal = ref1 + dexMod;
  const willFinal = will1 + wisMod;

  const usedSP = usedSkillPoints(data.skills);
  const pool = skillPointPool(classInfo, finals.int, raceInfo);

  const warnings: string[] = [];
  if (!data.name.trim()) warnings.push('Nome mancante.');
  if (!data.race) warnings.push('Razza non selezionata.');
  if (!data.className) warnings.push('Classe non selezionata.');
  if (data.race === CUSTOM_RACE && !data.customRaceConfig.displayName.trim())
    warnings.push('Specifica il nome della razza personalizzata.');
  if (data.className === CUSTOM_CLASS && !data.customClassConfig.displayName.trim())
    warnings.push('Specifica il nome della classe personalizzata.');
  if (data.abilityMode === 'pointbuy' && totalPBCost(data.abilities) > PB_TOTAL)
    warnings.push('Hai speso troppi punti caratteristica.');

  return (
    <div>
      <div className="wizard-step-header-row">
        <DndIcon category="game" name="explore" size={24} style={{ color: 'var(--accent-gold)' }} />
        <div>
          <h3 className="wizard-step-title">Riepilogo Personaggio</h3>
          <p className="wizard-step-subtitle" style={{ margin: 0 }}>
            Controlla tutto prima di creare. Potrai sempre modificare il personaggio in seguito.
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div style={{ marginTop: '0.9rem' }}>
          {warnings.map(w => <div key={w} className="summary-warning">⚠ {w}</div>)}
        </div>
      )}

      <div className="summary-grid" style={{ marginTop: '0.5rem' }}>
        <div className="summary-section">
          <div className="summary-section-title">
            <DndIcon category="game" name="character" size={11} style={{ marginRight: 4 }} />
            Identità
          </div>
          <div className="summary-row"><span className="summary-label">Nome</span><span className="summary-value">{data.name || '—'}</span></div>
          <div className="summary-row">
            <span className="summary-label">Razza</span>
            <span className="summary-value">{data.race === CUSTOM_RACE ? (data.customRaceConfig.displayName || 'Custom') : data.race || '—'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Classe</span>
            <span className="summary-value">{data.className === CUSTOM_CLASS ? (data.customClassConfig.displayName || 'Custom') : data.className || '—'}</span>
          </div>
          <div className="summary-row"><span className="summary-label">Livello</span><span className="summary-value">1</span></div>
          <div className="summary-row"><span className="summary-label">Allineamento</span><span className="summary-value">{data.alignment}</span></div>
          {data.gender && <div className="summary-row"><span className="summary-label">Genere</span><span className="summary-value">{data.gender}</span></div>}
          {data.age && <div className="summary-row"><span className="summary-label">Età</span><span className="summary-value">{data.age}</span></div>}
        </div>

        <div className="summary-section">
          <div className="summary-section-title">
            <DndIcon category="combat" name="melee" size={11} style={{ marginRight: 4 }} />
            Statistiche
          </div>
          {[
            { icon: ['hp', 'full'], label: 'PF Max', val: String(maxHp) },
            { icon: ['attribute', 'ac'], label: 'CA', val: `${acBase} (${acFinal})` },
            { icon: ['combat', 'initiative'], label: 'Iniziativa', val: `${signNum(initBase)} (${signNum(initFinal)})` },
            { icon: ['combat', 'melee'], label: 'BAB', val: signNum(bab1) },
            { icon: ['attribute', 'saving-throw'], label: 'Tempra', val: `${signNum(fort1)} (${signNum(fortFinal)})` },
            { icon: ['attribute', 'saving-throw'], label: 'Riflessi', val: `${signNum(ref1)} (${signNum(refFinal)})` },
            { icon: ['attribute', 'saving-throw'], label: 'Volontà', val: `${signNum(will1)} (${signNum(willFinal)})` },
          ].map(row => (
            <div key={row.label} className="summary-row">
              <span className="summary-label">
                <DndIcon category={row.icon[0]} name={row.icon[1]} size={10} style={{ marginRight: 3 }} />
                {row.label}
              </span>
              <span className="summary-value">{row.val}</span>
            </div>
          ))}
        </div>

        <div className="summary-section">
          <div className="summary-section-title">
            <DndIcon category="ability" name="strength" size={11} style={{ marginRight: 4 }} />
            Caratteristiche
          </div>
          <div className="summary-abilities-grid">
            {KEYS.map(k => (
              <div key={k} className="summary-ability">
                <DndIcon category="ability" name={ABILITY_ICON[k]} size={16}
                  style={{ color: 'var(--accent-gold)', opacity: 0.7, marginBottom: 2 }} />
                <div className="summary-ability-name">{ABBR[k]}</div>
                <div className="summary-ability-value">{finals[k]}</div>
                <div className="summary-ability-mod">{signedMod(finals[k])}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-section-title">
            <DndIcon category="attribute" name="skillcheck" size={11} style={{ marginRight: 4 }} />
            Abilità &amp; Talenti
          </div>
          <div className="summary-row">
            <span className="summary-label">Punti AB usati</span>
            <span className="summary-value">{usedSP}/{pool}</span>
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            {Object.values(data.skills).filter(s => s.ranks > 0).map(s => (
              <span key={s.id} className="summary-tag">{s.name} {s.ranks}</span>
            ))}
            {Object.values(data.skills).filter(s => s.ranks > 0).length === 0 &&
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nessuna abilità.</span>}
          </div>
          {data.feats.length > 0 && (
            <>
              <div style={{ margin: '0.5rem 0 0.2rem', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Talenti</div>
              {data.feats.map(f => <span key={f.id} className="summary-tag">{f.name}</span>)}
            </>
          )}
          {data.languages.length > 0 && (
            <>
              <div style={{ margin: '0.5rem 0 0.2rem', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Lingue</div>
              {data.languages.map(l => <span key={l.id} className="summary-tag">{l.name}</span>)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Main Wizard ────────────────────────────────────

interface CharacterWizardProps {
  userId: string;
  onComplete: (charData: Omit<CharacterBase, 'id'>) => void;
  onCancel: () => void;
}

const STEP_LABEL_KEYS = ['wizard.edition', 'wizard.identity', 'wizard.class', 'wizard.stats', 'wizard.skills', 'wizard.summary'];
const STEP_ICONS = [
  { category: 'game', name: 'adventure-book' },
  { category: 'game', name: 'character' },
  { category: 'game', name: 'combat' },
  { category: 'ability', name: 'strength' },
  { category: 'attribute', name: 'skillcheck' },
  { category: 'game', name: 'explore' },
];
const TOTAL_STEPS = STEP_LABEL_KEYS.length;

const DEFAULT_DATA: WizardData = {
  name: '', race: '', gender: '', age: '', alignment: 'Neutrale', background: '',
  className: '', avatarUrl: '',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  abilityMode: 'pointbuy',
  skills: {}, feats: [], classSkillOverrides: {},
  languages: [{ id: 'comune', name: 'Comune' }],
  fixedLangNames: new Set(['Comune']),
  customRaceConfig: {
    displayName: '', bonuses: {}, extraFeat: false, extraSkillPoints: 0,
    speed: 9, small: false, racialLanguages: [], description: '',
  },
  customClassConfig: {
    displayName: '', hitDie: 8, sp: 4, bab: 'medium',
    fort: 'poor', ref: 'poor', will: 'good', classSkills: [],
  },
};

function canProceed(step: number, data: WizardData): boolean {
  switch (step) {
    case 0: return true;
    case 1: {
      if (!data.name.trim() || !data.race) return false;
      return data.race !== CUSTOM_RACE || !!data.customRaceConfig.displayName.trim();
    }
    case 2: {
      if (!data.className) return false;
      return data.className !== CUSTOM_CLASS || !!data.customClassConfig.displayName.trim();
    }
    case 3: return data.abilityMode === 'manual' || totalPBCost(data.abilities) <= PB_TOTAL;
    case 4: return true;
    case 5: {
      const ri = buildRaceInfo(data.race, data.customRaceConfig);
      const ci = buildClassInfo(data.className, data.customClassConfig);
      return (
        !!data.name.trim() && !!ri.name && !!ci.name &&
        (data.abilityMode === 'manual' || totalPBCost(data.abilities) <= PB_TOTAL)
      );
    }
    default: return true;
  }
}

export function CharacterWizard({ userId, onComplete, onCancel }: CharacterWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);
  // Bumped after async catalogs are merged into RACES/CLASSES/languages — forces re-render.
  const [, setCatalogVersion] = useState(0);

  // ── Load shared catalogs (races / classes / languages) and merge them
  //    into the in-memory lists. Hardcoded entries remain as a safe fallback
  //    in case the user has not populated the catalogs yet.
  useEffect(() => {
    const lang = (typeof navigator !== 'undefined' && navigator.language?.slice(0, 2)) || 'it';
    let cancelled = false;
    (async () => {
      try {
        const [cRaces, cClasses, cLangs, cSkills, cFeats, cIcons] = await Promise.all([
          raceCatalog.list(),
          classCatalog.list(),
          languageCatalog.list(),
          skillCatalog.list(),
          featCatalog.list(),
          iconCatalog.list(),
        ]);
        if (cancelled) return;

        for (const ic of cIcons) {
          if (ic.svg) CATALOG_ICON_SVG_BY_ID[ic.id] = ic.svg;
        }

        // Catalog-first: when a collection is non-empty, REPLACE the
        // hardcoded fallback with catalog data so the user sees only
        // what they have curated in the BackOffice. Empty collections
        // keep the in-memory defaults (zero-friction first run).
        if (cRaces.length > 0) {
          RACES.length = 0;
          for (const r of cRaces) {
            const ri = catalogRaceToRaceInfo(r, lang);
            CATALOG_RACE_BY_NAME[ri.name] = r;
            RACES.push(ri);
          }
        } else {
          for (const r of cRaces) {
            const ri = catalogRaceToRaceInfo(r, lang);
            CATALOG_RACE_BY_NAME[ri.name] = r;
            if (!RACES.find(x => x.name === ri.name)) RACES.push(ri);
          }
        }
        if (cClasses.length > 0) {
          CLASSES.length = 0;
          for (const c of cClasses) {
            const ci = catalogClassToClassInfo(c, lang);
            CATALOG_CLASS_BY_NAME[ci.name] = c;
            CLASSES.push(ci);
          }
        }
        if (cLangs.length > 0) {
          ALL_LANGUAGES_POOL.length = 0;
        }
        for (const l of cLangs) {
          const name = pickLocalized(l.name, lang);
          if (name) {
            CATALOG_LANG_BY_NAME[name] = l.id;
            CATALOG_LANG_NAME_BY_ID[l.id] = name;
            if (!ALL_LANGUAGES_POOL.includes(name)) ALL_LANGUAGES_POOL.push(name);
          }
        }
        // Re-resolve racial language names after the language map is filled.
        for (const r of cRaces) {
          const ri = RACES.find(x => x.name === pickLocalized(r.name, lang));
          if (ri) {
            ri.racialLanguages = r.automaticLanguages
              .map(id => CATALOG_LANG_NAME_BY_ID[id])
              .filter(Boolean);
          }
        }
        if (cSkills.length > 0) {
          ALL_SKILLS.length = 0;
        }
        for (const s of cSkills) {
          if (!ALL_SKILLS.find(x => x.name === s.name)) {
            ALL_SKILLS.push({
              id: s.name,
              name: s.name,
              localizedName: s.localizedName as Partial<Record<string, string>> | undefined,
              stat: s.stat,
              armorCheck: s.armorCheckPenalty,
              untrained: s.canUseUntrained,
              icon: SKILL_ICON_MAP[s.name] ?? null,
            });
          } else {
            // Update localizedName on existing entry from catalog
            const existing = ALL_SKILLS.find(x => x.name === s.name);
            if (existing && s.localizedName) existing.localizedName = s.localizedName as Partial<Record<string, string>>;
          }
        }
        // Replace WIZARD_FEATS contents (don't reassign, it's `const`).
        WIZARD_FEATS.length = 0;
        WIZARD_FEATS.push(...cFeats);
        setCatalogVersion(v => v + 1);
      } catch (e) {
        console.error('[wizard] failed to load catalogs', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const steps = [
    <Step1Edition key={0} />,
    <Step2Identity key={1} data={data} setData={setData} />,
    <Step3Class key={2} data={data} setData={setData} />,
    <Step4Abilities key={3} data={data} setData={setData} />,
    <Step5Skills key={4} data={data} setData={setData} />,
    <Step6Summary key={5} data={data} setData={setData} />,
  ];

  const handleCreate = () => {
    const classInfo = buildClassInfo(data.className, data.customClassConfig);
    const raceInfo = buildRaceInfo(data.race, data.customRaceConfig);
    const KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    const finals = KEYS.reduce((acc, k) => {
      acc[k] = finalAbility(data.abilities[k], k, raceInfo);
      return acc;
    }, {} as Record<AbilityKey, number>);

    const conMod = abilityMod(finals.con);
    const dexMod = abilityMod(finals.dex);
    const wisMod = abilityMod(finals.wis);
    const hitDie = classInfo.hitDie;

    const bab1 = computeClassBab(1, classInfo.bab);
    const fort1 = computeClassSaveBase(1, classInfo.fort);
    const ref1 = computeClassSaveBase(1, classInfo.ref);
    const will1 = computeClassSaveBase(1, classInfo.will);

    const classLevelEntry: ClassLevel = {
      id: uuidv4(),
      className: classInfo.name,
      level: 1,
      babProgression: classInfo.bab,
      fortSave: classInfo.fort,
      refSave: classInfo.ref,
      willSave: classInfo.will,
      hitDie,
    };

    // ── Auto-attach catalog-driven extras ────────────────────────────
    // 1) Racial feats from `CatalogRace.racialFeats` are attached to the
    //    character as regular `Feat[]` (active by default), so their
    //    modifiers feed into the live dashboard.
    const lang = (typeof navigator !== 'undefined' && navigator.language?.slice(0, 2)) || 'it';
    const catalogRace = CATALOG_RACE_BY_NAME[raceInfo.name];
    const racialAutoFeats: Feat[] = (catalogRace?.racialFeats ?? []).map(rf => ({
      id: uuidv4(),
      name: pickLocalized(rf.name, lang),
      description: pickLocalized(rf.description ?? '', lang) || '',
      modifiers: rf.modifiers ?? [],
      active: true,
    }));

    // 2) Class features for level 1 (`featuresByLevel.filter(f => f.level === 1)`)
    //    are attached as `ClassFeature[]`, again active by default.
    const catalogClass = CATALOG_CLASS_BY_NAME[classInfo.name];
    const lvl1Features: ClassFeature[] = (catalogClass?.featuresByLevel ?? [])
      .filter(f => f.level === 1)
      .map(f => ({
        id: uuidv4(),
        name: pickLocalized(f.name, lang),
        description: pickLocalized(f.description ?? '', lang) || '',
        subcategory: f.subcategory === 'active' ? 'active' : 'passive',
        modifiers: f.modifiers ?? [],
        active: true,
        ...(f.resourceName ? { resourceName: f.resourceName, resourceMax: f.resourceMax ?? 0, resourceUsed: 0 } : {}),
      }));

    // 3) Automatic languages from the race are added to the language list
    //    if missing (Common is already there).
    const autoLangNames = catalogRace?.automaticLanguages
      .map(id => CATALOG_LANG_NAME_BY_ID[id])
      .filter(Boolean) ?? [];
    const mergedLangs: Language[] = [...data.languages];
    for (const ln of autoLangNames) {
      if (!mergedLangs.find(l => l.name === ln)) {
        mergedLangs.push({ id: CATALOG_LANG_BY_NAME[ln] ?? ln.toLowerCase(), name: ln });
      }
    }

    const charData: Omit<CharacterBase, 'id'> = {
      userId,
      name: data.name.trim(),
      race: raceInfo.name,
      characterClass: classInfo.name,
      level: 1,
      alignment: data.alignment,
      baseStats: {
        str: finals.str, dex: finals.dex, con: finals.con,
        int: finals.int, wis: finals.wis, cha: finals.cha,
        // Raw base values: the engine adds ability modifiers automatically.
        // - AC: getEffectiveStat('ac') adds Dex (capped by armor)
        // - reflex/fortitude/will: getSaveBreakdown adds the related ability mod
        // - initiative: derived from getStatModifier('dex')
        // - hp: max HP is recomputed by getTotalMaxHp(); baseStats.hp is only a fallback
        hp: Math.max(1, hitDie + conMod),
        ac: 10,
        speed: raceInfo.speed,
        reflex: ref1,
        fortitude: fort1,
        will: will1,
        bab: bab1,
        initiative: 0,
      },
      savingThrows: {
        fortitude: { base: fort1, ability: conMod, magic: 0, misc: 0 },
        reflex: { base: ref1, ability: dexMod, magic: 0, misc: 0 },
        will: { base: will1, ability: wisMod, magic: 0, misc: 0 },
      },
      hpDetails: {
        current: Math.max(1, hitDie + conMod),
        max: Math.max(1, hitDie + conMod),
        nonLethal: 0, tempHp: 0, negLevels: 0,
        damageReduction: '', elementalResistances: '',
      },
      movement: { base: raceInfo.speed },
      currency: { platinum: 0, gold: 0, silver: 0, copper: 0 },
      languages: mergedLangs,
      skills: buildFullSkillRecord(data.skills, data.classSkillOverrides, classInfo.classSkills),
      feats: [...data.feats, ...racialAutoFeats],
      inventory: [],
      spells: [],
      notes: data.background.trim()
        ? [{ id: uuidv4(), title: 'Background', content: data.background.trim(), date: new Date().toLocaleDateString('it-IT') }]
        : [],
      npcs: [],
      classFeatures: lvl1Features,
      customAttacks: [],
      classLevels: [classLevelEntry],
      hpLevelLog: [{ id: uuidv4(), classId: classLevelEntry.id, classLevelNumber: 1 }],
      ...(data.avatarUrl.trim() ? { avatarUrl: data.avatarUrl.trim() } : {}),
    };

    onComplete(charData);
  };

  return (
    <div className="wizard-backdrop">
      <div className="wizard-container">
        <div className="wizard-header">
          <div className="wizard-title">
            <DndIcon category="dice" name="d20" size={22} style={{ color: 'var(--accent-gold)' }} />
            <h2>{t('wizard.title')} — D&amp;D 3.5</h2>
          </div>
          <button className="wizard-close btn-ghost" onClick={onCancel} title={t('common.cancel')}>
            <FaTimes size={13} />
          </button>
        </div>

        <div className="wizard-progress-bar">
          <div className="wizard-progress-fill" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>

        <div className="wizard-steps">
          {STEP_LABEL_KEYS.map((key, i) => (
            <div key={i} className={`wizard-step-dot${i < step ? ' done' : i === step ? ' active' : ''}`}>
              <div className="wizard-step-circle">
                {i < step
                  ? <FaCheck size={7} />
                  : <DndIcon category={STEP_ICONS[i].category} name={STEP_ICONS[i].name} size={11} />
                }
              </div>
              <span className="wizard-step-label">{t(key)}</span>
            </div>
          ))}
        </div>

        <div className="wizard-body">
          {steps[step]}
        </div>

        <div className="wizard-footer">
          <button className="btn-secondary"
            onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}>
            {step === 0 ? `✕ ${t('common.cancel')}` : `← ${t('common.back')}`}
          </button>
          <span className="wizard-step-counter">{step + 1} / {TOTAL_STEPS}</span>
          <button className="btn-primary"
            onClick={step === TOTAL_STEPS - 1 ? handleCreate : () => setStep(s => s + 1)}
            disabled={!canProceed(step, data)}>
            {step === TOTAL_STEPS - 1
              ? <><DndIcon category="dice" name="d20" size={13} style={{ marginRight: 5 }} />{t('wizard.create')}</>
              : `${t('common.next')} →`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
