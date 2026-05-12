import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { CharacterBase } from '../types/dnd';
import type { DashboardLayout } from '../components/dashboard/widgetTypes';
import { classCatalog } from './admin';

export const saveCharacterToDb = async (character: CharacterBase) => {
  if (!character.id) return;
  try {
    // Firestore rejects `undefined` values — strip them via JSON round-trip
    const sanitized = JSON.parse(JSON.stringify(character));
    await setDoc(doc(db, 'characters', character.id), sanitized);
  } catch (error) {
    console.error('Error saving character:', error);
  }
};

export const loadCharacterFromDb = async (characterId: string): Promise<CharacterBase | null> => {
  try {
    const docRef = doc(db, 'characters', characterId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as CharacterBase;
    }
  } catch (error) {
    console.error('Error loading character:', error);
  }
  return null;
};

export const getUserCharacters = async (userId: string): Promise<CharacterBase[]> => {
  try {
    const q = query(collection(db, 'characters'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const characters: CharacterBase[] = [];
    querySnapshot.forEach((doc) => {
      characters.push(doc.data() as CharacterBase);
    });
    return characters;
  } catch (error) {
    console.error('Error fetching characters:', error);
    return [];
  }
};

/**
 * One-time migration: for every `classLevel` that lacks a `catalogClassId`,
 * try to match by class name (case-insensitive) against the catalog and backfill it.
 * Only touches characters that actually need updating, and writes minimally to Firestore.
 * Safe to call on every login — it is a no-op when everything is already linked.
 */
export const backfillCatalogClassIds = async (characters: CharacterBase[]): Promise<CharacterBase[]> => {
  // Filter characters that have at least one classLevel without catalogClassId
  const needsMigration = characters.filter(c =>
    (c.classLevels ?? []).some(cl => !cl.catalogClassId),
  );
  if (needsMigration.length === 0) return characters;

  // Load catalog classes once
  let catalogClasses: Awaited<ReturnType<typeof classCatalog.list>>;
  try {
    catalogClasses = await classCatalog.list();
  } catch (e) {
    console.warn('[backfill] Could not load catalog classes, skipping migration', e);
    return characters;
  }
  if (catalogClasses.length === 0) return characters;

  // Build a name → id lookup (italian name preferred, then english)
  const nameToId = new Map<string, string>();
  for (const cc of catalogClasses) {
    const itName = typeof cc.name === 'string' ? cc.name : (cc.name.it ?? cc.name.en ?? '');
    const enName = typeof cc.name === 'string' ? cc.name : (cc.name.en ?? '');
    if (itName) nameToId.set(itName.trim().toLowerCase(), cc.id);
    if (enName && enName !== itName) nameToId.set(enName.trim().toLowerCase(), cc.id);
  }

  const updated: CharacterBase[] = [...characters];

  for (const char of needsMigration) {
    if (!(char.classLevels ?? []).some(cl => !cl.catalogClassId)) continue;

    const newLevels = (char.classLevels ?? []).map(cl => {
      if (cl.catalogClassId) return cl;
      const matched = nameToId.get(cl.className.trim().toLowerCase());
      return matched ? { ...cl, catalogClassId: matched } : cl;
    });

    const anyChanged = newLevels.some(
      (nl, i) => nl.catalogClassId !== (char.classLevels ?? [])[i]?.catalogClassId,
    );
    if (!anyChanged) continue;

    try {
      await updateDoc(doc(db, 'characters', char.id), { classLevels: newLevels });
      const idx = updated.findIndex(c => c.id === char.id);
      if (idx !== -1) updated[idx] = { ...char, classLevels: newLevels };
      console.info(`[backfill] Linked catalogClassId for ${char.name} (${newLevels.filter(nl => nl.catalogClassId).length} classi)`);
    } catch (e) {
      console.warn(`[backfill] Failed to update character ${char.id}`, e);
    }
  }

  return updated;
};

export const createNewCharacterDb = async (userId: string, name: string): Promise<CharacterBase> => {
  // Create a default structure
  const newChar: Partial<CharacterBase> = {
    userId,
    name,
    race: 'Human',
    characterClass: 'Fighter',
    level: 1,
    alignment: 'True Neutral',
    baseStats: {
      str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
      hp: 10, ac: 10, speed: 30, reflex: 0, fortitude: 0, will: 0, bab: 1, initiative: 0
    },
    skills: {},
    inventory: [],
    feats: [],
    spells: [],
    notes: [],
    npcs: []
  };

  const docRef = await addDoc(collection(db, 'characters'), newChar);
  newChar.id = docRef.id;

  // Update the doc with its own ID
  await setDoc(docRef, newChar);

  return newChar as CharacterBase;
};

/** Real-time subscription to a single character document. */
export function subscribeToCharacter(
  characterId: string,
  cb: (char: CharacterBase | null) => void,
): () => void {
  return onSnapshot(doc(db, 'characters', characterId), snap =>
    cb(snap.exists() ? (snap.data() as CharacterBase) : null),
  );
}

/** Permanently deletes a character document from Firestore. */
export const deleteCharacterDb = async (characterId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'characters', characterId));
  } catch (error) {
    console.error('Error deleting character:', error);
  }
};

/** Creates a new character document pre-populated with full wizard data. */
export const createCharacterWithDataDb = async (data: Omit<CharacterBase, 'id'>): Promise<CharacterBase> => {
  const sanitized = JSON.parse(JSON.stringify(data));
  const docRef = await addDoc(collection(db, 'characters'), sanitized);
  const char = { ...data, id: docRef.id } as CharacterBase;
  await setDoc(docRef, { ...sanitized, id: docRef.id });
  return char;
};

// === User settings (Drive folder, dashboard layouts ...) ===
export interface UserSettings {
  driveFolderId?: string;
  driveFolderName?: string;
  dashboardLayouts?: Record<string, DashboardLayout>;
}

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  try {
    const snap = await getDoc(doc(db, 'userSettings', uid));
    return snap.exists() ? (snap.data() as UserSettings) : {};
  } catch (e) {
    console.error('getUserSettings', e);
    return {};
  }
};

export const saveUserSettings = async (uid: string, patch: Partial<UserSettings>) => {
  try {
    const current = await getUserSettings(uid);
    await setDoc(doc(db, 'userSettings', uid), { ...current, ...patch }, { merge: true });
  } catch (e) {
    console.error('saveUserSettings', e);
  }
};

// === Dashboard layout per-character, stored in user preferences ===
export const loadDashboardLayout = async (uid: string, charId: string): Promise<DashboardLayout | null> => {
  try {
    const snap = await getDoc(doc(db, 'userSettings', uid));
    if (!snap.exists()) return null;
    const settings = snap.data() as UserSettings;
    return settings.dashboardLayouts?.[charId] ?? null;
  } catch (e) {
    console.error('loadDashboardLayout', e);
    return null;
  }
};

export const saveDashboardLayout = async (uid: string, charId: string, layout: DashboardLayout) => {
  try {
    const sanitized = JSON.parse(JSON.stringify(layout));
    await setDoc(
      doc(db, 'userSettings', uid),
      { dashboardLayouts: { [charId]: sanitized } },
      { merge: true },
    );
  } catch (e) {
    console.error('saveDashboardLayout', e);
  }
};
