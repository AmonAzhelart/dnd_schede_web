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
import type { Spell, StatType, Modifier, Creature, CreatureModifier } from '../types/dnd';

/** SuperAdmin: can manage invites and the shared back-office catalogs. */
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

export const addInvite = async (email: string, invitedBy: string, note?: string): Promise<Invite> => {
    const e = normEmail(email);
    const invite: Invite = { email: e, invitedBy, invitedAt: serverTimestamp(), note };
    await setDoc(doc(db, 'invites', e), invite);
    return invite;
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

/** Shared feat / talent. */
export interface CatalogFeat {
    id: string;
    name: string;
    description: string;
    modifiers: Modifier[];
    /** Mark as a defect (renders with crimson accent in pickers). */
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

// Suppress unused "AnyCatalog" — reserved for future generic helpers.
export type _AnyCatalog = AnyCatalog;
