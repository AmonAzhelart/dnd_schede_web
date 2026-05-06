import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Campaign, CampaignMessage, MasterNote } from '../types/campaign';
import { loadCharacterFromDb } from './db';
import type { CharacterBase } from '../types/dnd';

// ─────────────────────── helpers ───────────────────────

function generateInviteCode(): string {
  // Avoid ambiguous chars: I, O, 0, 1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─────────────────────── campaign CRUD ───────────────────────

export async function createCampaign(
  masterId: string,
  masterEmail: string,
  masterDisplayName: string,
  name: string,
  description: string,
): Promise<Campaign> {
  const inviteCode = generateInviteCode();
  const payload = {
    name: name.trim(),
    description: description.trim(),
    masterId,
    masterEmail,
    masterDisplayName,
    inviteCode,
    createdAt: serverTimestamp(),
    playerIds: [],
    playerCharacters: {},
  };
  const ref = await addDoc(collection(db, 'campaigns'), payload);
  await updateDoc(ref, { id: ref.id });
  return { ...payload, id: ref.id, createdAt: null } as unknown as Campaign;
}

export async function getMasterCampaign(masterId: string): Promise<Campaign | null> {
  const snap = await getDocs(
    query(collection(db, 'campaigns'), where('masterId', '==', masterId)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Campaign;
}

export async function getMasterCampaigns(masterId: string): Promise<Campaign[]> {
  const snap = await getDocs(
    query(collection(db, 'campaigns'), where('masterId', '==', masterId)),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
}

export function subscribeMasterCampaigns(
  masterId: string,
  cb: (campaigns: Campaign[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'campaigns'), where('masterId', '==', masterId)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign))),
  );
}

export async function saveMasterNotes(
  campaignId: string,
  notes: MasterNote[],
): Promise<void> {
  await updateDoc(doc(db, 'campaigns', campaignId), { masterNotes: notes });
}

export async function deleteCampaign(
  campaignId: string,
  linkedCharacterIds: string[],
): Promise<void> {
  // Remove campaign link from all characters
  await Promise.all(
    linkedCharacterIds.map(cid =>
      updateDoc(doc(db, 'characters', cid), {
        campaignId: deleteField(),
        masterId: deleteField(),
      }),
    ),
  );
  await deleteDoc(doc(db, 'campaigns', campaignId));
}

// ─────────────────────── real-time subscriptions ───────────────────────

export function subscribeToCampaign(
  campaignId: string,
  cb: (campaign: Campaign | null) => void,
): () => void {
  return onSnapshot(doc(db, 'campaigns', campaignId), snap =>
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Campaign) : null),
  );
}

// ─────────────────────── player actions ───────────────────────

export async function findCampaignByCode(inviteCode: string): Promise<Campaign | null> {
  const snap = await getDocs(
    query(
      collection(db, 'campaigns'),
      where('inviteCode', '==', inviteCode.toUpperCase().trim()),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Campaign;
}

export async function joinCampaign(
  campaignId: string,
  masterId: string,
  userId: string,
  characterId: string,
  characterName: string,
  playerName: string,
): Promise<void> {
  // Link the character to the campaign
  await updateDoc(doc(db, 'characters', characterId), {
    campaignId,
    masterId,
  });
  // Register player in campaign
  await updateDoc(doc(db, 'campaigns', campaignId), {
    playerIds: arrayUnion(userId),
    [`playerCharacters.${userId}`]: { characterId, characterName, playerName },
  });
}

export async function leaveCampaign(
  campaignId: string,
  userId: string,
  characterId: string,
): Promise<void> {
  // Unlink character
  await updateDoc(doc(db, 'characters', characterId), {
    campaignId: deleteField(),
    masterId: deleteField(),
  });
  // Remove from campaign
  await updateDoc(doc(db, 'campaigns', campaignId), {
    playerIds: arrayRemove(userId),
    [`playerCharacters.${userId}`]: deleteField(),
  });
}

// ─────────────────────── chat ───────────────────────

const chatRef = (campaignId: string, playerId: string) =>
  doc(db, 'campaigns', campaignId, 'chats', playerId);
const messagesRef = (campaignId: string, playerId: string) =>
  collection(db, 'campaigns', campaignId, 'chats', playerId, 'messages');

export function subscribeToPlayerChat(
  campaignId: string,
  playerId: string,
  cb: (msgs: CampaignMessage[]) => void,
): () => void {
  // No orderBy: avoids Firestore composite-index requirement.
  // Sort client-side; pending writes (serverTimestamp = null) sort to end.
  const q = query(messagesRef(campaignId, playerId));
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as CampaignMessage);
    msgs.sort((a, b) => {
      const ta = a.timestamp?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const tb = b.timestamp?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
    cb(msgs);
  });
}

export async function sendCampaignMessage(
  campaignId: string,
  playerId: string,
  text: string,
  from: 'player' | 'master',
  fromName: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(messagesRef(campaignId, playerId), {
    text: trimmed,
    from,
    fromName,
    timestamp: serverTimestamp(),
  });
  await setDoc(
    chatRef(campaignId, playerId),
    { lastMessage: trimmed, lastUpdated: serverTimestamp(), playerId },
    { merge: true },
  );
}

// ─────────────────────── master helpers ───────────────────────

/** Load all characters linked in a campaign. Returns a map userId → CharacterBase. */
export async function loadLinkedCharacters(
  playerCharacters: Campaign['playerCharacters'],
): Promise<Record<string, CharacterBase>> {
  const result: Record<string, CharacterBase> = {};
  await Promise.all(
    Object.entries(playerCharacters).map(async ([uid, info]) => {
      const char = await loadCharacterFromDb(info.characterId);
      if (char) result[uid] = char;
    }),
  );
  return result;
}
