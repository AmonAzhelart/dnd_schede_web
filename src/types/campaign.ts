import type { Timestamp } from 'firebase/firestore';

export interface MasterNote {
    id: string;
    title: string;
    content: string;
    updatedAt: string;
}

/**
 * A single shareable section inside a glossary entry.
 * The master controls visibility per-section independently.
 */
export interface GlossarySection {
    /** Unique ID within the entry (generated client-side, e.g. `s${Date.now()}`) */
    id: string;
    /** Label shown to the player, e.g. "Aspetto", "Personalità", "Segreto" */
    label: string;
    /** The actual content the player sees when revealed */
    content: string;
    /** true = visible to every player in the campaign */
    isPublic: boolean;
    /** specific player userIds that can see this section (when isPublic is false) */
    visibleToPlayerIds: string[];
}

/** A glossary entry created by the master and optionally shared with players. */
export interface CampaignGlossaryEntry {
    id: string;
    term: string;
    /** Master-only private notes — never shown to players */
    info: string;
    category: 'person' | 'place' | 'item' | 'lore' | 'other';
    createdAt: Timestamp | null;
    sharedByMasterId: string;
    /**
     * Individually shareable sections. Each section has its own visibility.
     * An entry is visible to a player if at least one section is.
     */
    sections: GlossarySection[];
    /** @deprecated legacy — use sections[*].isPublic instead */
    isPublic: boolean;
    /** @deprecated legacy — use sections[*].visibleToPlayerIds instead */
    visibleToPlayerIds: string[];
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
    /** Active combat state (initiative tracker) — persisted so fights can be resumed */
    initiativeCombat?: InitiativeCombatState;
}

export interface InitiativeCombatant {
    id: string;
    name: string;
    initiative: number;
    currentHp: number;
    maxHp: number;
    ac?: number;
    isPlayer: boolean;
    playerId?: string;
    conditions: string[];
}

export interface InitiativeCombatState {
    combatants: InitiativeCombatant[];
    round: number;
    currentIdx: number;
    savedAt?: number;
}

export interface CampaignMessage {
    id: string;
    text: string;
    from: 'player' | 'master';
    fromName: string;
    timestamp: Timestamp | null;
}
