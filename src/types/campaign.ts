import type { Timestamp } from 'firebase/firestore';

export interface MasterNote {
    id: string;
    title: string;
    content: string;
    updatedAt: string;
}

export interface Campaign {
    id: string;
    name: string;
    description: string;
    masterId: string;
    masterEmail: string;
    masterDisplayName: string;
    /** 6-char uppercase alphanumeric code shared with players */
    inviteCode: string;
    createdAt: Timestamp | null;
    /** userIds of linked players */
    playerIds: string[];
    /** userId → linked character info */
    playerCharacters: Record<string, {
        characterId: string;
        characterName: string;
        playerName: string;
    }>;
    /** DM-only notes (stored per-campaign) */
    masterNotes?: MasterNote[];
}

export interface CampaignMessage {
    id: string;
    text: string;
    from: 'player' | 'master';
    fromName: string;
    timestamp: Timestamp | null;
}
