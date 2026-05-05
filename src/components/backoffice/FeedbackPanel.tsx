import { useEffect, useRef, useState } from 'react';
import { FaPaperPlane, FaInbox, FaUser, FaCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import {
    subscribeToThreads,
    subscribeToMessages,
    sendAdminReply,
    markThreadReadByAdmin,
    type FeedbackThread,
    type FeedbackMessage,
} from '../../services/feedback';

export function FeedbackPanel() {
    const { t } = useTranslation();
    const [threads, setThreads] = useState<FeedbackThread[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<FeedbackMessage[]>([]);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Real-time thread list
    useEffect(() => {
        const unsub = subscribeToThreads(setThreads);
        return unsub;
    }, []);

    // Real-time messages for selected thread
    useEffect(() => {
        if (!selectedId) return;
        const unsub = subscribeToMessages(selectedId, setMessages);
        markThreadReadByAdmin(selectedId);
        return unsub;
    }, [selectedId]);

    // Mark as read when switching to a thread
    useEffect(() => {
        if (!selectedId) return;
        markThreadReadByAdmin(selectedId);
    }, [messages, selectedId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleReply() {
        if (!selectedId || !reply.trim() || sending) return;
        setSending(true);
        const text = reply;
        setReply('');
        try {
            await sendAdminReply(selectedId, text);
        } finally {
            setSending(false);
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleReply();
        }
    }

    const selectedThread = threads.find(t => t.userId === selectedId);

    return (
        <div className="fb-admin-root">
            {/* Thread list */}
            <div className="fb-admin-list">
                {threads.length === 0 && (
                    <p className="fb-admin-empty">
                        <FaInbox style={{ fontSize: '1.6rem', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                        {t('feedback.noThreads')}
                    </p>
                )}
                {threads.map(thread => (
                    <button
                        key={thread.userId}
                        className={'fb-admin-thread-btn' + (thread.userId === selectedId ? ' is-active' : '')}
                        onClick={() => setSelectedId(thread.userId)}
                    >
                        <div className="fb-admin-thread-avatar">
                            <FaUser />
                        </div>
                        <div className="fb-admin-thread-info">
                            <div className="fb-admin-thread-name">
                                {thread.userDisplayName || thread.userEmail}
                                {thread.unreadByAdmin > 0 && (
                                    <span className="fb-admin-badge">{thread.unreadByAdmin}</span>
                                )}
                            </div>
                            <div className="fb-admin-thread-email">{thread.userEmail}</div>
                            <div className="fb-admin-thread-last">{thread.lastMessage}</div>
                        </div>
                        {thread.unreadByAdmin > 0 && (
                            <FaCircle className="fb-admin-unread-dot" />
                        )}
                    </button>
                ))}
            </div>

            {/* Chat area */}
            <div className="fb-admin-chat">
                {!selectedThread ? (
                    <div className="fb-admin-chat-placeholder">
                        <FaInbox style={{ fontSize: '2rem', marginBottom: 12 }} />
                        <p>{t('feedback.selectThread')}</p>
                    </div>
                ) : (
                    <>
                        {/* Chat header */}
                        <div className="fb-admin-chat-header">
                            <FaUser />
                            <div>
                                <div className="fb-admin-chat-name">
                                    {selectedThread.userDisplayName || selectedThread.userEmail}
                                </div>
                                <div className="fb-admin-chat-email">{selectedThread.userEmail}</div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="fb-admin-messages">
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={'fb-admin-bubble' + (msg.from === 'admin' ? ' is-admin' : ' is-user')}
                                >
                                    {msg.from === 'user' && (
                                        <span className="fb-admin-from-label">
                                            {selectedThread.userDisplayName || selectedThread.userEmail}
                                        </span>
                                    )}
                                    {msg.from === 'admin' && (
                                        <span className="fb-admin-from-label admin">{t('feedback.adminLabel')}</span>
                                    )}
                                    <span className="fb-admin-bubble-text">{msg.text}</span>
                                    {msg.timestamp && (
                                        <span className="fb-admin-ts">
                                            {msg.timestamp.toDate().toLocaleString([], {
                                                dateStyle: 'short',
                                                timeStyle: 'short',
                                            })}
                                        </span>
                                    )}
                                </div>
                            ))}
                            <div ref={bottomRef} />
                        </div>

                        {/* Reply input */}
                        <div className="fb-admin-input-row">
                            <textarea
                                className="fb-admin-textarea"
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder={t('feedback.replyPlaceholder')}
                                rows={2}
                                disabled={sending}
                            />
                            <button
                                className="fb-admin-send-btn"
                                onClick={handleReply}
                                disabled={!reply.trim() || sending}
                                aria-label={t('feedback.send')}
                            >
                                <FaPaperPlane />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
