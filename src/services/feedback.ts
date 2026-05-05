import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

/* ─────────────────────── types ─────────────────────── */

export interface FeedbackMessage {
    id: string;
    text: string;
    /** 'user' | 'admin' */
    from: 'user' | 'admin';
    timestamp: Timestamp | null;
}

export interface FeedbackThread {
    /** Document id = userId */
    userId: string;
    userEmail: string;
    userDisplayName: string;
    lastMessage: string;
    lastUpdated: Timestamp | null;
    /** Messages not yet read by admin */
    unreadByAdmin: number;
}

/* ─────────────────────── helpers ─────────────────────── */

const threadRef = (userId: string) => doc(db, 'feedback', userId);
const messagesRef = (userId: string) => collection(db, 'feedback', userId, 'messages');

/* ─────────────────────── user API ─────────────────────── */

/** Ensure the thread document exists for this user. */
export async function ensureFeedbackThread(
    userId: string,
    userEmail: string,
    userDisplayName: string,
): Promise<void> {
    const ref = threadRef(userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        const thread: Omit<FeedbackThread, 'userId'> = {
            userEmail,
            userDisplayName,
            lastMessage: '',
            lastUpdated: null,
            unreadByAdmin: 0,
        };
        await setDoc(ref, thread);
    }
}

/** Send a message from the user. */
export async function sendFeedbackMessage(
    userId: string,
    userEmail: string,
    userDisplayName: string,
    text: string,
): Promise<void> {
    await ensureFeedbackThread(userId, userEmail, userDisplayName);
    const trimmed = text.trim();
    if (!trimmed) return;

    await addDoc(messagesRef(userId), {
        text: trimmed,
        from: 'user',
        timestamp: serverTimestamp(),
    });

    // Update thread summary
    await setDoc(
        threadRef(userId),
        {
            lastMessage: trimmed.slice(0, 120),
            lastUpdated: serverTimestamp(),
            unreadByAdmin: (await getUnreadCount(userId)) + 1,
        },
        { merge: true },
    );
}

async function getUnreadCount(userId: string): Promise<number> {
    try {
        const snap = await getDoc(threadRef(userId));
        return snap.exists() ? (snap.data().unreadByAdmin ?? 0) : 0;
    } catch {
        return 0;
    }
}

/** Subscribe to messages for a specific user thread (real-time). */
export function subscribeToMessages(
    userId: string,
    callback: (messages: FeedbackMessage[]) => void,
): () => void {
    const q = query(messagesRef(userId), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snap: any) => {
        const msgs: FeedbackMessage[] = [];
        snap.forEach((d: any) =>
            msgs.push({ id: d.id, ...(d.data() as Omit<FeedbackMessage, 'id'>) }),
        );
        callback(msgs);
    });
}

/** Delete a single message sent by the user (user-only messages). */
export async function deleteUserMessage(userId: string, messageId: string): Promise<void> {
    await deleteDoc(doc(db, 'feedback', userId, 'messages', messageId));
}

/* ─────────────────────── admin API ─────────────────────── */

/** List all feedback threads (admin). */
export async function listFeedbackThreads(): Promise<FeedbackThread[]> {
    const snap = await getDocs(collection(db, 'feedback'));
    const threads: FeedbackThread[] = [];
    snap.forEach((d: any) =>
        threads.push({ userId: d.id, ...(d.data() as Omit<FeedbackThread, 'userId'>) }),
    );
    return threads.sort((a, b) => {
        const ta = a.lastUpdated?.toMillis() ?? 0;
        const tb = b.lastUpdated?.toMillis() ?? 0;
        return tb - ta;
    });
}

/** Subscribe to all feedback threads (real-time, admin). */
export function subscribeToThreads(
    callback: (threads: FeedbackThread[]) => void,
): () => void {
    return onSnapshot(collection(db, 'feedback'), (snap: any) => {
        const threads: FeedbackThread[] = [];
        snap.forEach((d: any) =>
            threads.push({ userId: d.id, ...(d.data() as Omit<FeedbackThread, 'userId'>) }),
        );
        callback(
            threads.sort((a, b) => {
                const ta = a.lastUpdated?.toMillis() ?? 0;
                const tb = b.lastUpdated?.toMillis() ?? 0;
                return tb - ta;
            }),
        );
    });
}

/** Send a reply from the admin. */
export async function sendAdminReply(userId: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    await addDoc(messagesRef(userId), {
        text: trimmed,
        from: 'admin',
        timestamp: serverTimestamp(),
    });

    await setDoc(
        threadRef(userId),
        {
            lastMessage: `[Admin] ${trimmed.slice(0, 110)}`,
            lastUpdated: serverTimestamp(),
        },
        { merge: true },
    );
}

/** Mark thread as read by admin (reset unread counter). */
export async function markThreadReadByAdmin(userId: string): Promise<void> {
    await setDoc(threadRef(userId), { unreadByAdmin: 0 }, { merge: true });
}
