/**
 * Always-mounted component (renders null). Subscribes to the player's
 * campaign chat and fires in-app toast notifications when the master
 * sends a new message and the Campagna tab is not active.
 */
import { useEffect, useRef } from 'react';
import { subscribeToPlayerChat, subscribeToCampaign } from '../../services/campaign';
import { useCharacterStore } from '../../store/characterStore';
import { useChatToast } from '../../contexts/chatToastContext';

interface Props {
    /** True when the Campagna tab is currently active — suppress toasts. */
    isCampaignTabActive: boolean;
    /** Called when the user clicks a toast. */
    onNavigateToCampaign: () => void;
}

export function PlayerChatNotifier({ isCampaignTabActive, onNavigateToCampaign }: Props) {
    const { character } = useCharacterStore();
    const toast = useChatToast();

    const campaignId = character?.campaignId;
    const userId = character?.userId;

    // Master display name from campaign doc
    const masterDisplayNameRef = useRef<string | undefined>(undefined);

    // Track message count to detect new arrivals
    const prevCountRef = useRef(0);
    const initialLoadDoneRef = useRef(false);

    // Reset tracking whenever the character / campaign changes
    useEffect(() => {
        prevCountRef.current = 0;
        initialLoadDoneRef.current = false;
    }, [campaignId, userId]);

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
            const curr = msgs.length;

            if (!initialLoadDoneRef.current) {
                // Swallow initial snapshot — don't notify for historical messages
                prevCountRef.current = curr;
                initialLoadDoneRef.current = true;
                return;
            }

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

    // When tab becomes active, reset count to avoid spurious toasts after re-focus
    useEffect(() => {
        if (isCampaignTabActive) {
            // Will be refreshed on next snapshot, no action needed
        }
    }, [isCampaignTabActive]);

    return null;
}
