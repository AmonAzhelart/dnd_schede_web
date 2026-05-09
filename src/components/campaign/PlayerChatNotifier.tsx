/**
 * Always-mounted component (renders null). Subscribes to the player's
 * campaign chat and fires in-app toast notifications when the master
 * sends a new message and the Campagna tab is not active.
 * Also exposes the number of unread master messages via onUnreadCountChange,
 * persisted across sessions via localStorage.
 */
import { useEffect, useRef } from 'react';
import { subscribeToPlayerChat, subscribeToCampaign } from '../../services/campaign';
import { useCharacterStore } from '../../store/characterStore';
import { useChatToast } from '../../contexts/chatToastContext';
import type { CampaignMessage } from '../../types/campaign';

const readAtKey = (campaignId: string, userId: string) =>
    `dnd_playerChatReadAt_${campaignId}_${userId}`;

function getStoredReadAt(campaignId: string, userId: string): number {
    try {
        return parseInt(localStorage.getItem(readAtKey(campaignId, userId)) ?? '0', 10) || 0;
    } catch { return 0; }
}

function saveReadAt(campaignId: string, userId: string, ts: number) {
    try { localStorage.setItem(readAtKey(campaignId, userId), String(ts)); } catch { }
}

function countUnread(msgs: CampaignMessage[], readAt: number): number {
    return msgs.filter(
        m => m.from === 'master' && m.timestamp != null && m.timestamp.toDate().getTime() > readAt,
    ).length;
}

interface Props {
    /** True when the Campagna tab is currently active — suppress toasts and mark read. */
    isCampaignTabActive: boolean;
    /** Called when the user clicks a toast. */
    onNavigateToCampaign: () => void;
    /** Called whenever the unread count changes (0 = all read). */
    onUnreadCountChange?: (count: number) => void;
}

export function PlayerChatNotifier({ isCampaignTabActive, onNavigateToCampaign, onUnreadCountChange }: Props) {
    const { character } = useCharacterStore();
    const toast = useChatToast();

    const campaignId = character?.campaignId;
    const userId = character?.userId;

    // Master display name from campaign doc
    const masterDisplayNameRef = useRef<string | undefined>(undefined);

    // Track message count to detect new arrivals (for toasts)
    const prevCountRef = useRef(0);
    const initialLoadDoneRef = useRef(false);

    // Latest messages snapshot — used when marking read
    const latestMsgsRef = useRef<CampaignMessage[]>([]);

    // Reset tracking whenever the character / campaign changes
    useEffect(() => {
        prevCountRef.current = 0;
        initialLoadDoneRef.current = false;
        latestMsgsRef.current = [];
        onUnreadCountChange?.(0);
    }, [campaignId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Subscribe to campaign doc to get master's display name
    useEffect(() => {
        if (!campaignId) return;
        return subscribeToCampaign(campaignId, c => {
            masterDisplayNameRef.current = c?.masterDisplayName;
        });
    }, [campaignId]);

    // Subscribe to chat — always active, regardless of active tab
    useEffect(() => {
        if (!campaignId || !userId) return;

        return subscribeToPlayerChat(campaignId, userId, msgs => {
            latestMsgsRef.current = msgs;
            const curr = msgs.length;

            // ── Unread badge (timestamp-based, persisted) ──
            const readAt = getStoredReadAt(campaignId, userId);
            const unread = countUnread(msgs, readAt);
            onUnreadCountChange?.(unread);

            if (!initialLoadDoneRef.current) {
                // Swallow initial snapshot — don't fire toasts for historical messages
                prevCountRef.current = curr;
                initialLoadDoneRef.current = true;
                return;
            }

            // ── Toast notifications ──
            const prev = prevCountRef.current;
            if (curr > prev) {
                const newMsgs = msgs.slice(prev);
                const fromMaster = newMsgs.filter(m => m.from === 'master');
                if (fromMaster.length > 0 && !isCampaignTabActive) {
                    const last = fromMaster[fromMaster.length - 1];
                    const title = masterDisplayNameRef.current
                        ? `Master – ${masterDisplayNameRef.current}`
                        : 'Master';
                    const preview = last.text.length > 70 ? last.text.slice(0, 70) + '…' : last.text;
                    toast.push(title, preview, onNavigateToCampaign);
                }
            }
            prevCountRef.current = curr;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId, userId]);

    // When campaign tab becomes active: mark all master messages as read
    useEffect(() => {
        if (!isCampaignTabActive || !campaignId || !userId) return;
        const now = Date.now();
        saveReadAt(campaignId, userId, now);
        onUnreadCountChange?.(0);
    }, [isCampaignTabActive]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
