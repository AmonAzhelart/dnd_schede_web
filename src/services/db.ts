import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { CharacterBase } from '../types/dnd';
import type { DashboardLayout } from '../components/dashboard/widgetTypes';

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
