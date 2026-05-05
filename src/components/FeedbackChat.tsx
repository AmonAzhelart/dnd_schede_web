import { useEffect, useRef, useState } from 'react';
import { FaPaperPlane, FaCommentDots, FaTrash, FaExclamationTriangle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import {
    subscribeToMessages,
    sendFeedbackMessage,
    deleteUserMessage,
    type FeedbackMessage,
} from '../services/feedback';
import './FeedbackChat.css';

interface Props {
    userId: string;
    userEmail: string;
    userDisplayName: string;
}

export function FeedbackChat({ userId, userEmail, userDisplayName }: Props) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<FeedbackMessage[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = subscribeToMessages(userId, setMessages);
        return unsub;
    }, [userId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend() {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);
        setText('');
        try {
            await sendFeedbackMessage(userId, userEmail, userDisplayName, trimmed);
        } finally {
            setSending(false);
        }
    }

    function handleKey(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await deleteUserMessage(userId, pendingDeleteId);
        setPendingDeleteId(null);
    }

    return (
        <div className="feedback-page">
            <div className="feedback-page-header">
                <FaCommentDots />
                <span>{t('feedback.title')}</span>
            </div>

            <div className="feedback-messages">
                {messages.length === 0 && (
                    <p className="feedback-empty">{t('feedback.empty')}</p>
                )}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={'feedback-bubble' + (msg.from === 'user' ? ' is-user' : ' is-admin')}
                    >
                        {msg.from === 'admin' && (
                            <span className="feedback-from-label">{t('feedback.adminLabel')}</span>
                        )}
                        <span className="feedback-bubble-text">{msg.text}</span>
                        <div className="feedback-bubble-meta">
                            {msg.timestamp && (
                                <span className="feedback-ts">
                                    {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {msg.from === 'user' && (
                                <button
                                    className="feedback-delete-btn"
                                    onClick={() => setPendingDeleteId(msg.id)}
                                    title={t('common.delete')}
                                    aria-label={t('common.delete')}
                                >
                                    <FaTrash />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div className="feedback-input-row">
                <textarea
                    className="feedback-textarea"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={t('feedback.placeholder')}
                    rows={2}
                    disabled={sending}
                />
                <button
                    className="feedback-send-btn"
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    aria-label={t('feedback.send')}
                >
                    <FaPaperPlane />
                </button>
            </div>

            {/* ── Delete confirmation modal ── */}
            {pendingDeleteId && (
                <div className="feedback-modal-overlay" onClick={() => setPendingDeleteId(null)}>
                    <div className="feedback-modal" onClick={e => e.stopPropagation()}>
                        <div className="feedback-modal-icon">
                            <FaExclamationTriangle />
                        </div>
                        <p className="feedback-modal-text">{t('feedback.confirmDelete')}</p>
                        <div className="feedback-modal-actions">
                            <button className="feedback-modal-btn cancel" onClick={() => setPendingDeleteId(null)}>
                                {t('common.cancel')}
                            </button>
                            <button className="feedback-modal-btn confirm" onClick={confirmDelete}>
                                <FaTrash /> {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
