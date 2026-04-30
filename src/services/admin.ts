import {
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    collection,
    getDocs,
    serverTimestamp,
    query,
    orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Spell, StatType, Modifier, Creature, CreatureModifier } from '../types/dnd';/** SuperAdmin: can manage invites and the shared back-office catalogs. */
export const SUPERADMIN_EMAIL = 'fonti.alessandro98@gmail.com';

export const isSuperAdmin = (email?: string | null): boolean =>
    !!email && email.trim().toLowerCase() === SUPERADMIN_EMAIL;

const normEmail = (email: string) => email.trim().toLowerCase();

/* ─────────────────────────── INVITES / ALLOWLIST ─────────────────────────── */

export interface Invite {
    /** Lowercased email — also the document id. */
    email: string;
    invitedBy: string;
    invitedAt?: any;
    note?: string;
    /**
     * Which BackOffice sections this user can access.
     * Empty array or undefined = full catalog access (everything except 'invites').
     * SuperAdmin ignores this field — always sees everything.
     */
    sections?: string[];
}

/**
 * Returns true if the email is allowed in the app:
 * SuperAdmin OR present in the `invites` collection.
 */
export const isEmailAllowed = async (email?: string | null): Promise<boolean> => {
    if (!email) return false;
    if (isSuperAdmin(email)) return true;
    try {
        const snap = await getDoc(doc(db, 'invites', normEmail(email)));
        return snap.exists();
    } catch (e) {
        console.error('isEmailAllowed', e);
        return false;
    }
};

export const listInvites = async (): Promise<Invite[]> => {
    try {
        const snap = await getDocs(collection(db, 'invites'));
        const out: Invite[] = [];
        snap.forEach(d => out.push(d.data() as Invite));
        return out.sort((a, b) => a.email.localeCompare(b.email));
    } catch (e) {
        console.error('listInvites', e);
        return [];
    }
};

export const addInvite = async (email: string, invitedBy: string, note?: string, sections?: string[]): Promise<Invite> => {
    const e = normEmail(email);
    const invite: Invite = { email: e, invitedBy, invitedAt: serverTimestamp(), note, sections: sections ?? [] };
    await setDoc(doc(db, 'invites', e), invite);
    return invite;
};

export const updateInviteSections = async (email: string, sections: string[]): Promise<void> => {
    await setDoc(doc(db, 'invites', normEmail(email)), { sections }, { merge: true });
};

export const getInvite = async (email?: string | null): Promise<Invite | null> => {
    if (!email) return null;
    try {
        const snap = await getDoc(doc(db, 'invites', normEmail(email)));
        return snap.exists() ? (snap.data() as Invite) : null;
    } catch { return null; }
};

export const removeInvite = async (email: string): Promise<void> => {
    await deleteDoc(doc(db, 'invites', normEmail(email)));
};

/* ─────────────────────────── SHARED CATALOGS ─────────────────────────── */

/** Shared spell entry — extends the per-character `Spell` shape with bookkeeping. */
export interface CatalogSpell extends Spell {
    createdBy?: string;
    createdAt?: any;
    updatedAt?: any;
    tags?: string[];
}

/** Shared skill preset — mirrors `SkillPreset` with optional metadata. */
export interface CatalogSkill {
    id: string;
    name: string;
    stat: StatType;
    canUseUntrained: boolean;
    armorCheckPenalty: boolean;
    description?: string;
    createdBy?: string;
    updatedAt?: any;
}

/** Shared feat / class feature catalog entry. */
export interface CatalogFeat {
    id: string;
    name: string;
    description: string;
    modifiers: Modifier[];
    /** Modifiers applied to summoned/pet creatures when the feat is active. */
    creatureModifiers?: CreatureModifier[];
    /** Active = consumes resources or requires activation; Passive = always-on. */
    subcategory?: 'active' | 'passive';
    /** For active features: name of the resource pool (e.g. "Incanalare Divinità"). */
    resourceName?: string;
    /** For active features: max uses per rest. */
    resourceMax?: number;
    /** @deprecated Legacy flag, kept for backward compatibility. */
    isDefect?: boolean;
    tags?: string[];
    createdBy?: string;
    updatedAt?: any;
}

/** A creature entry in the shared bestiary catalog. */
export interface CatalogCreature extends Creature {
    createdBy?: string;
    updatedAt?: any;
}

/** Shared feat / talent with optional creature modifier support. */
export interface CatalogFeatWithCreatureModifiers extends CatalogFeat {
    creatureModifiers?: CreatureModifier[];
}

// forward-compat alias (same shape, different semantic intent)
export type { CatalogFeat };

/** A reusable SVG asset (e.g. inventory icons). */
export interface CatalogIcon {
    id: string;
    name: string;
    category?: string;
    /** Inline SVG markup. Keep it small (≪ 1MB). */
    svg: string;
    tags?: string[];
    /** If set, this icon is the default for the given slot id (see ITEM_ICON_SLOTS). */
    defaultFor?: string;
    createdBy?: string;
    updatedAt?: any;
}

/**
 * Custom widget definition created via the back-office.
 * It overrides metadata of an existing base widget (`baseType`).
 */
export interface CatalogWidget {
    id: string;
    title: string;
    description: string;
    /** Id of an existing widget in WIDGET_CATALOG (e.g. 'hp', 'inventory'). */
    baseType: string;
    defaultW: number;
    defaultH: number;
    minW: number;
    minH: number;
    accent?: string;
    /** Optional emoji or icon identifier (string only — components are not serialisable). */
    icon?: string;
    enabled?: boolean;
    updatedAt?: any;
}

type AnyCatalog = CatalogSpell | CatalogSkill | CatalogFeat | CatalogIcon | CatalogWidget;

const sanitize = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const makeCatalog = <T extends { id: string }>(collectionName: string) => ({
    list: async (): Promise<T[]> => {
        try {
            const q = query(collection(db, collectionName), orderBy('name'));
            const snap = await getDocs(q).catch(() => getDocs(collection(db, collectionName)));
            const out: T[] = [];
            snap.forEach(d => out.push({ ...(d.data() as T), id: d.id }));
            return out;
        } catch (e) {
            console.error(`list ${collectionName}`, e);
            return [];
        }
    },
    get: async (id: string): Promise<T | null> => {
        try {
            const snap = await getDoc(doc(db, collectionName, id));
            return snap.exists() ? ({ ...(snap.data() as T), id: snap.id }) : null;
        } catch (e) {
            console.error(`get ${collectionName}`, e);
            return null;
        }
    },
    upsert: async (entity: T): Promise<void> => {
        const payload: any = { ...sanitize(entity), updatedAt: serverTimestamp() };
        await setDoc(doc(db, collectionName, entity.id), payload, { merge: true });
    },
    remove: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, collectionName, id));
    },
});

export const spellCatalog = makeCatalog<CatalogSpell>('catalog_spells');
export const skillCatalog = makeCatalog<CatalogSkill>('catalog_skills');
export const featCatalog = makeCatalog<CatalogFeat>('catalog_feats');
export const iconCatalog = makeCatalog<CatalogIcon>('catalog_icons');
export const widgetCatalog = makeCatalog<CatalogWidget>('catalog_widgets');
export const creatureCatalog = makeCatalog<CatalogCreature>('catalog_creatures');

/* ─────────────────────── MULTILINGUAL CATALOGS ─────────────────────── */

/**
 * Localized string used inside catalog entries.
 * Either a plain string (legacy / single-language) or a partial map keyed by
 * the i18n language code: `{ it: 'Guerriero', en: 'Fighter' }`.
 */
export type LocalizedField = string | Partial<Record<'it' | 'en' | 'es' | 'de' | 'fr', string>>;

/** Ability score modifier applied by a race (e.g. +2 STR / -2 CHA). */
export interface RaceAbilityMod {
    stat: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
    value: number;
}

/** A racial trait / feat granted automatically by a race. */
export interface RaceFeat {
    id: string;
    name: LocalizedField;
    description?: LocalizedField;
    /** Optional mechanical modifiers (mirrors `Modifier[]` on Feat). */
    modifiers?: Modifier[];
}

/** Shared race entry. Stored in `catalog_races`. */
export interface CatalogRace {
    id: string;
    /** Localised display name. */
    name: LocalizedField;
    description?: LocalizedField;
    size: 'Minuscola' | 'Piccola' | 'Media' | 'Grande' | 'Enorme';
    /** Base land speed in metres (D&D 3.5 default = 9 m / 30 ft). */
    speed: number;
    /** Ability score adjustments. */
    abilityMods: RaceAbilityMod[];
    /** Languages automatically known by every member of the race (catalog ids). */
    automaticLanguages: string[];
    /** Languages that can be picked as bonus, gated by INT (catalog ids). */
    bonusLanguages: string[];
    /** Racial feats, traits and special abilities. */
    racialFeats: RaceFeat[];
    /** Optional id of the favored class (catalog_classes id) — empty string for "any". */
    favoredClassId?: string;
    /** Free-form notes shown to players in the wizard. */
    notes?: LocalizedField;
    /** Optional id of a `catalog_icons` document used as the race avatar. */
    iconId?: string;
    createdBy?: string;
    updatedAt?: any;
}

/** A single class feature/privilege granted at a specific level. */
export interface ClassLevelFeature {
    id: string;
    /** D&D character level at which the feature is granted. */
    level: number;
    name: LocalizedField;
    description?: LocalizedField;
    /** Whether this is a passive trait, an active ability, a feat (talento) or a build option. */
    subcategory: 'active' | 'passive';
    /** Optional mechanical modifiers. */
    modifiers?: Modifier[];
    /** For active abilities: name of the daily/encounter resource. */
    resourceName?: string;
    /** For active abilities: max uses. */
    resourceMax?: number;
}

/** Spellcasting progression of the class (very compact summary). */
export interface ClassSpellcasting {
    /** 'arcane' | 'divine' | 'none'. */
    type: 'arcane' | 'divine' | 'none';
    /** Stat used for spell DCs (`int`, `wis`, `cha`). */
    stat?: 'int' | 'wis' | 'cha';
    /** Highest spell level reachable at level 20 (0–9). */
    maxSpellLevel?: number;
    /** Free-form notes (e.g. "Spontaneous, known spells only"). */
    notes?: LocalizedField;
}

/** Suggested starting equipment item (free-form text). */
export interface ClassStartingEquipment {
    id: string;
    label: LocalizedField;
}

/** Suggested bonus feat granted by class progression (just a reference label). */
export interface ClassBonusFeatSuggestion {
    id: string;
    /** Free-text or a `catalog_feats` id. */
    featRef: string;
    label: LocalizedField;
    grantedAtLevel?: number;
}

/** Shared class entry. Stored in `catalog_classes`. */
export interface CatalogClass {
    id: string;
    name: LocalizedField;
    description?: LocalizedField;
    /** Hit die size: 4, 6, 8, 10 or 12. */
    hitDie: 4 | 6 | 8 | 10 | 12;
    /** Base attack bonus progression. */
    babProgression: 'high' | 'medium' | 'low';
    /** Saving throw progressions. */
    fortitude: 'good' | 'poor';
    reflex: 'good' | 'poor';
    will: 'good' | 'poor';
    /** Skill points granted per level (before INT modifier). */
    skillPointsPerLevel: number;
    /** Ids (catalog_skills) of the abilities considered "class skills". */
    classSkillIds: string[];
    /** Ordered list of features / privileges by level. */
    featuresByLevel: ClassLevelFeature[];
    spellcasting?: ClassSpellcasting;
    /** Suggested starting equipment (free-form). */
    startingEquipment?: ClassStartingEquipment[];
    /** Suggested bonus feats. */
    bonusFeats?: ClassBonusFeatSuggestion[];
    /** Optional id of a `catalog_icons` document used as the class glyph. */
    iconId?: string;
    createdBy?: string;
    updatedAt?: any;
}

/** A spoken / written language entry (Common, Elven, Draconic, …). */
export interface CatalogLanguage {
    id: string;
    name: LocalizedField;
    /** Optional short note (script, who speaks it, etc.). */
    notes?: LocalizedField;
    /** Whether this is a "bonus only" exotic language (not pickable as automatic). */
    exotic?: boolean;
    createdBy?: string;
    updatedAt?: any;
}

/* makeCatalog uses `orderBy('name')` which can't sort by a LocalizedField. We
 * use a tiny variant that fetches everything, then sorts client-side using
 * the italian display value as a fallback. */
const makeLocalizedCatalog = <T extends { id: string; name: LocalizedField }>(collectionName: string) => {
    const pickIt = (v: LocalizedField): string =>
        typeof v === 'string' ? v : (v.it ?? v.en ?? Object.values(v)[0] ?? '');
    return {
        list: async (): Promise<T[]> => {
            try {
                const snap = await getDocs(collection(db, collectionName));
                const out: T[] = [];
                snap.forEach(d => out.push({ ...(d.data() as T), id: d.id }));
                return out.sort((a, b) => pickIt(a.name).localeCompare(pickIt(b.name)));
            } catch (e) {
                console.error(`list ${collectionName}`, e);
                return [];
            }
        },
        get: async (id: string): Promise<T | null> => {
            try {
                const snap = await getDoc(doc(db, collectionName, id));
                return snap.exists() ? ({ ...(snap.data() as T), id: snap.id }) : null;
            } catch (e) {
                console.error(`get ${collectionName}`, e);
                return null;
            }
        },
        upsert: async (entity: T): Promise<void> => {
            const payload: any = { ...sanitize(entity), updatedAt: serverTimestamp() };
            await setDoc(doc(db, collectionName, entity.id), payload, { merge: true });
        },
        remove: async (id: string): Promise<void> => {
            await deleteDoc(doc(db, collectionName, id));
        },
    };
};

export const raceCatalog = makeLocalizedCatalog<CatalogRace>('catalog_races');
export const classCatalog = makeLocalizedCatalog<CatalogClass>('catalog_classes');
export const languageCatalog = makeLocalizedCatalog<CatalogLanguage>('catalog_languages');

// Suppress unused "AnyCatalog" — reserved for future generic helpers.
export type _AnyCatalog = AnyCatalog;
