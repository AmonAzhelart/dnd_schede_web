import React, { useState, useEffect, useCallback } from 'react';
import {
    FaBookOpen, FaFolderOpen, FaPlus, FaTrash, FaPaperPlane, FaSpinner, FaCheck,
} from 'react-icons/fa';
import {
    isGoogleConfigured, requestDriveAccess, getAccessToken, onTokenChange,
    listFolder, getFileText, isTextExtractable, type DriveFile,
} from '../../services/google';
import { getUserSettings } from '../../services/db';
import { askAboutDocuments, isGeminiConfigured, type NotebookSource } from '../../services/gemini';
import { useCharacterStore } from '../../store/characterStore';

interface Props { uid: string; }

interface SourceState {
    file: DriveFile;
    loading: boolean;
    loaded: boolean;
    content?: string;
    error?: string;
}

interface QA { q: string; a: string; }

export const NotebookPanel: React.FC<Props> = ({ uid }) => {
    const { character } = useCharacterStore();
    const [token, setToken] = useState<string | null>(getAccessToken());
    const [rootFolder, setRootFolder] = useState<{ id: string; name: string } | null>(null);
    const [available, setAvailable] = useState<DriveFile[]>([]);
    const [sources, setSources] = useState<SourceState[]>([]);
    const [browserOpen, setBrowserOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [history, setHistory] = useState<QA[]>([]);
    const [asking, setAsking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const off = onTokenChange(setToken);
        return () => { off(); };
    }, []);

    useEffect(() => {
        getUserSettings(uid).then(s => {
            if (s.driveFolderId && s.driveFolderName) {
                setRootFolder({ id: s.driveFolderId, name: s.driveFolderName });
            }
        });
    }, [uid]);

    const loadAvailable = useCallback(async () => {
        if (!rootFolder || !token) return;
        setError(null);
        try {
            const list = await listFolder(rootFolder.id);
            setAvailable(list.filter(f => isTextExtractable(f.mimeType)));
        } catch (e: any) { setError(e.message); }
    }, [rootFolder, token]);

    useEffect(() => { if (browserOpen) loadAvailable(); }, [browserOpen, loadAvailable]);

    const addSource = async (file: DriveFile) => {
        if (sources.find(s => s.file.id === file.id)) return;
        const entry: SourceState = { file, loading: true, loaded: false };
        setSources(s => [...s, entry]);
        try {
            const content = await getFileText(file);
            setSources(s => s.map(x => x.file.id === file.id ? { ...x, loading: false, loaded: true, content } : x));
        } catch (e: any) {
            setSources(s => s.map(x => x.file.id === file.id ? { ...x, loading: false, error: e.message } : x));
        }
    };

    const removeSource = (id: string) =>
        setSources(s => s.filter(x => x.file.id !== id));

    const ask = async () => {
        const q = question.trim();
        if (!q || asking) return;
        const ready: NotebookSource[] = sources
            .filter(s => s.loaded && s.content)
            .map(s => ({ name: s.file.name, content: s.content! }));
        if (ready.length === 0) {
            setError('Aggiungi almeno un documento sorgente.');
            return;
        }
        setAsking(true); setError(null); setQuestion('');
        try {
            const answer = await askAboutDocuments(ready, q, character ?? null);
            setHistory(h => [...h, { q, a: answer }]);
        } catch (e: any) { setError(e.message); }
        finally { setAsking(false); }
    };

    if (!isGoogleConfigured() || !isGeminiConfigured()) {
        return (
            <div className="ws-empty">
                <FaBookOpen size={48} color="var(--text-muted)" />
                <h3>Notebook AI non configurato</h3>
                <p className="text-muted text-sm">
                    Servono sia le credenziali Google (Drive) che la chiave Gemini.
                </p>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="ws-empty">
                <FaBookOpen size={48} color="var(--accent-gold)" />
                <h3>Collega Drive per iniziare</h3>
                <p className="text-muted text-sm">
                    Il Notebook AI legge i tuoi documenti da Drive e risponde basandosi su di essi.
                </p>
                <button className="btn-primary" onClick={() => requestDriveAccess().catch(e => setError(e.message))}>
                    Autorizza Drive
                </button>
                {error && <div className="ws-error">{error}</div>}
            </div>
        );
    }

    if (!rootFolder) {
        return (
            <div className="ws-empty">
                <FaFolderOpen size={48} color="var(--accent-gold)" />
                <h3>Nessuna cartella scelta</h3>
                <p className="text-muted text-sm">
                    Vai prima nel tab <b>Drive</b> e seleziona la cartella della campagna.
                </p>
            </div>
        );
    }

    return (
        <div className="ws-notebook">
            <aside className="ws-notebook-sources">
                <div className="ws-notebook-sources-header">
                    <span className="font-heading text-sm">Sorgenti ({sources.length})</span>
                    <button className="btn-ghost text-xs" onClick={() => setBrowserOpen(o => !o)}>
                        <FaPlus /> Aggiungi
                    </button>
                </div>

                {sources.length === 0 && !browserOpen && (
                    <div className="text-muted text-xs" style={{ padding: '0.5rem' }}>
                        Aggiungi documenti da Drive per fare domande basate sul loro contenuto.
                        Supportati: Google Docs, Sheets, Slides, file di testo.
                    </div>
                )}

                {sources.map(s => (
                    <div key={s.file.id} className="ws-source-row">
                        <span className="ws-source-status">
                            {s.loading ? <FaSpinner className="animate-spin" /> :
                                s.error ? '⚠' : s.loaded ? <FaCheck color="var(--accent-success)" /> : ''}
                        </span>
                        <span className="ws-source-name" title={s.error || s.file.name}>{s.file.name}</span>
                        <button className="btn-ghost text-xs" onClick={() => removeSource(s.file.id)}><FaTrash /></button>
                    </div>
                ))}

                {browserOpen && (
                    <div className="ws-source-browser">
                        <div className="text-xs text-muted" style={{ padding: '0.4rem' }}>
                            Da: <b>{rootFolder.name}</b>
                        </div>
                        {available.length === 0 && (
                            <div className="text-muted text-xs" style={{ padding: '0.5rem' }}>
                                Nessun documento testuale in questa cartella.
                            </div>
                        )}
                        {available.map(f => {
                            const already = !!sources.find(s => s.file.id === f.id);
                            return (
                                <button
                                    key={f.id}
                                    className="ws-source-pick"
                                    disabled={already}
                                    onClick={() => addSource(f)}
                                >
                                    {already ? <FaCheck /> : <FaPlus />} {f.name}
                                </button>
                            );
                        })}
                    </div>
                )}
            </aside>

            <section className="ws-notebook-chat">
                <div className="ws-chat-body">
                    {history.length === 0 && (
                        <div className="ws-empty-small text-muted text-sm">
                            <FaBookOpen size={32} style={{ marginBottom: '0.5rem' }} />
                            <div>Aggiungi documenti a sinistra, poi fai una domanda.</div>
                            <div className="text-xs" style={{ marginTop: '0.5rem' }}>
                                Le risposte si baseranno solo sui contenuti dei documenti selezionati.
                            </div>
                        </div>
                    )}
                    {history.map((h, i) => (
                        <React.Fragment key={i}>
                            <div className="ws-msg ws-msg-user">
                                <div className="ws-msg-text">{h.q}</div>
                            </div>
                            <div className="ws-msg ws-msg-model">
                                <div className="ws-msg-text">{h.a}</div>
                            </div>
                        </React.Fragment>
                    ))}
                    {asking && (
                        <div className="ws-msg ws-msg-model">
                            <div className="ws-msg-text text-muted">Cerco nei documenti...</div>
                        </div>
                    )}
                    {error && <div className="ws-error">{error}</div>}
                </div>

                <div className="ws-chat-input">
                    <textarea
                        className="input"
                        rows={2}
                        placeholder="Cosa vuoi sapere dai tuoi documenti?"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                ask();
                            }
                        }}
                        disabled={asking}
                    />
                    <button className="btn-primary" onClick={ask} disabled={asking || !question.trim()}>
                        <FaPaperPlane />
                    </button>
                </div>
            </section>
        </div>
    );
};
