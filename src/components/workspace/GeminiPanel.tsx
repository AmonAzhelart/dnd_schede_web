import React, { useState, useRef, useEffect } from 'react';
import { FaPaperPlane, FaTrash, FaRobot, FaUser } from 'react-icons/fa';
import { useCharacterStore } from '../../store/characterStore';
import { sendChatMessage, isGeminiConfigured, type ChatMessage } from '../../services/gemini';

export const GeminiPanel: React.FC = () => {
    const { character } = useCharacterStore();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;
        setInput('');
        setError(null);
        const next: ChatMessage[] = [...messages, { role: 'user', text }];
        setMessages(next);
        setLoading(true);
        try {
            const reply = await sendChatMessage(messages, text, character ?? null);
            setMessages(m => [...m, { role: 'model', text: reply }]);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally { setLoading(false); }
    };

    if (!isGeminiConfigured()) {
        return (
            <div className="ws-empty">
                <FaRobot size={48} color="var(--text-muted)" />
                <h3>Gemini non configurato</h3>
                <p className="text-muted text-sm">
                    Imposta <code>VITE_GEMINI_API_KEY</code> nel file <code>.env</code>.
                    Genera la chiave gratuita su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com</a>.
                </p>
            </div>
        );
    }

    return (
        <div className="ws-chat">
            <div className="ws-chat-header">
                <div className="flex items-center gap-2">
                    <FaRobot color="var(--accent-arcane)" />
                    <span className="font-heading text-sm">Gemini · DM Assistant</span>
                </div>
                {messages.length > 0 && (
                    <button className="btn-ghost text-xs" onClick={() => setMessages([])}>
                        <FaTrash /> Pulisci
                    </button>
                )}
            </div>

            <div className="ws-chat-body">
                {messages.length === 0 && (
                    <div className="ws-empty-small text-muted text-sm">
                        Chiedimi qualsiasi cosa su regole, build, lore o tattiche.
                        {character && <><br />Conosco già il tuo personaggio: <b>{character.name}</b>.</>}
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`ws-msg ws-msg-${m.role}`}>
                        <span className="ws-msg-icon">{m.role === 'user' ? <FaUser /> : <FaRobot />}</span>
                        <div className="ws-msg-text">{m.text}</div>
                    </div>
                ))}
                {loading && (
                    <div className="ws-msg ws-msg-model">
                        <span className="ws-msg-icon"><FaRobot /></span>
                        <div className="ws-msg-text text-muted">Sto pensando...</div>
                    </div>
                )}
                {error && <div className="ws-error">{error}</div>}
                <div ref={endRef} />
            </div>

            <div className="ws-chat-input">
                <textarea
                    className="input"
                    rows={2}
                    placeholder="Scrivi una domanda... (Invio per inviare, Shift+Invio per nuova riga)"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    disabled={loading}
                />
                <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}>
                    <FaPaperPlane />
                </button>
            </div>
        </div>
    );
};
