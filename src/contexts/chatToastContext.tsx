import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { FaComments, FaTimes } from 'react-icons/fa';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToastItem {
    id: string;
    title: string;
    text: string;
    onClick?: () => void;
}

interface ChatToastCtx {
    push: (title: string, text: string, onClick?: () => void) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const Ctx = createContext<ChatToastCtx>({ push: () => {} });

// ─── Provider ────────────────────────────────────────────────────────────────

export function ChatToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const dismiss = useCallback((id: string) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const push = useCallback((title: string, text: string, onClick?: () => void) => {
        const id = crypto.randomUUID();
        // Keep at most 4 toasts visible
        setToasts(prev => [...prev.slice(-3), { id, title, text, onClick }]);
        timers.current[id] = setTimeout(() => dismiss(id), 6000);
    }, [dismiss]);

    return (
        <Ctx.Provider value={{ push }}>
            {children}
            <div className="chat-toast-container" aria-live="polite">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className="chat-toast"
                        onClick={() => { t.onClick?.(); dismiss(t.id); }}
                        role="alert"
                    >
                        <div className="chat-toast-icon">
                            <FaComments size={15} />
                        </div>
                        <div className="chat-toast-body">
                            <div className="chat-toast-title">{t.title}</div>
                            <div className="chat-toast-text">{t.text}</div>
                        </div>
                        <button
                            className="chat-toast-close"
                            onClick={e => { e.stopPropagation(); dismiss(t.id); }}
                            aria-label="Chiudi"
                        >
                            <FaTimes size={11} />
                        </button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useChatToast = () => useContext(Ctx);
