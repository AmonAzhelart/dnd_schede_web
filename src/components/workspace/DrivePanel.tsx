import React, { useEffect, useState, useCallback } from 'react';
import {
    FaGoogleDrive, FaFolder, FaFile, FaFilePdf, FaFileImage,
    FaSignInAlt, FaSignOutAlt, FaFolderOpen, FaExternalLinkAlt, FaSync, FaArrowLeft,
} from 'react-icons/fa';
import {
    isGoogleConfigured, requestDriveAccess, revokeDriveAccess, onTokenChange,
    getAccessToken, listFolder, pickFolder, type DriveFile,
} from '../../services/google';
import { getUserSettings, saveUserSettings } from '../../services/db';

interface Props {
    uid: string;
}

interface Crumb { id: string; name: string; }

const isFolder = (f: DriveFile) => f.mimeType === 'application/vnd.google-apps.folder';

const fileIcon = (f: DriveFile) => {
    if (isFolder(f)) return <FaFolder color="var(--accent-gold)" />;
    if (f.mimeType === 'application/pdf') return <FaFilePdf color="#e74c3c" />;
    if (f.mimeType.startsWith('image/')) return <FaFileImage color="var(--accent-arcane)" />;
    return <FaFile color="var(--text-muted)" />;
};

export const DrivePanel: React.FC<Props> = ({ uid }) => {
    const [token, setToken] = useState<string | null>(getAccessToken());
    const [rootFolder, setRootFolder] = useState<{ id: string; name: string } | null>(null);
    const [stack, setStack] = useState<Crumb[]>([]);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<DriveFile | null>(null);

    useEffect(() => {
        const off = onTokenChange(setToken);
        return () => { off(); };
    }, []);

    // Load saved root folder from Firestore
    useEffect(() => {
        getUserSettings(uid).then(s => {
            if (s.driveFolderId && s.driveFolderName) {
                setRootFolder({ id: s.driveFolderId, name: s.driveFolderName });
            }
        });
    }, [uid]);

    const currentFolder = stack[stack.length - 1] || rootFolder;

    const refresh = useCallback(async () => {
        if (!currentFolder || !token) return;
        setLoading(true); setError(null);
        try {
            const list = await listFolder(currentFolder.id);
            setFiles(list);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally { setLoading(false); }
    }, [currentFolder, token]);

    useEffect(() => { refresh(); }, [refresh]);

    const connect = async () => {
        setError(null);
        try { await requestDriveAccess(); }
        catch (e: any) { setError(e.message || String(e)); }
    };

    const disconnect = async () => { await revokeDriveAccess(); setFiles([]); };

    const chooseFolder = async () => {
        setError(null);
        try {
            const picked = await pickFolder();
            if (picked) {
                setRootFolder(picked);
                setStack([]);
                await saveUserSettings(uid, { driveFolderId: picked.id, driveFolderName: picked.name });
            }
        } catch (e: any) { setError(e.message || String(e)); }
    };

    const open = (f: DriveFile) => {
        if (isFolder(f)) setStack(s => [...s, { id: f.id, name: f.name }]);
        else setPreview(f);
    };

    const goUp = () => setStack(s => s.slice(0, -1));
    const goRoot = () => setStack([]);

    // ── Configuration missing ──
    if (!isGoogleConfigured()) {
        return (
            <div className="ws-empty">
                <FaGoogleDrive size={48} color="var(--text-muted)" />
                <h3>Drive non configurato</h3>
                <p className="text-muted text-sm">
                    Imposta <code>VITE_GOOGLE_CLIENT_ID</code> e <code>VITE_GOOGLE_API_KEY</code> nel file <code>.env</code>.
                    Vedi la guida in fondo al README.
                </p>
            </div>
        );
    }

    // ── Not authorized ──
    if (!token) {
        return (
            <div className="ws-empty">
                <FaGoogleDrive size={48} color="var(--accent-gold)" />
                <h3>Collega Google Drive</h3>
                <p className="text-muted text-sm">
                    Concedi l'accesso in sola lettura per sfogliare i tuoi file di campagna.
                </p>
                <button className="btn-primary" onClick={connect}>
                    <FaSignInAlt /> Autorizza Drive
                </button>
                {error && <div className="ws-error">{error}</div>}
            </div>
        );
    }

    // ── No root folder picked ──
    if (!rootFolder) {
        return (
            <div className="ws-empty">
                <FaFolderOpen size={48} color="var(--accent-gold)" />
                <h3>Scegli una cartella</h3>
                <p className="text-muted text-sm">
                    Seleziona la cartella Drive della tua campagna. Verrà ricordata per le prossime volte.
                </p>
                <div className="flex gap-2">
                    <button className="btn-primary" onClick={chooseFolder}><FaFolderOpen /> Scegli cartella</button>
                    <button className="btn-ghost text-sm" onClick={disconnect}><FaSignOutAlt /> Disconnetti</button>
                </div>
                {error && <div className="ws-error">{error}</div>}
            </div>
        );
    }

    // ── Browser ──
    return (
        <div className="ws-drive">
            <div className="ws-toolbar">
                <div className="ws-breadcrumbs">
                    <button className="ws-crumb" onClick={goRoot}><FaFolder /> {rootFolder.name}</button>
                    {stack.map((c, i) => (
                        <React.Fragment key={c.id}>
                            <span className="ws-crumb-sep">/</span>
                            <button
                                className="ws-crumb"
                                onClick={() => setStack(s => s.slice(0, i + 1))}
                            >{c.name}</button>
                        </React.Fragment>
                    ))}
                </div>
                <div className="flex gap-1">
                    {stack.length > 0 && (
                        <button className="btn-ghost text-xs" onClick={goUp}><FaArrowLeft /> Su</button>
                    )}
                    <button className="btn-ghost text-xs" onClick={refresh} title="Ricarica"><FaSync /></button>
                    <button className="btn-ghost text-xs" onClick={chooseFolder} title="Cambia cartella radice">
                        <FaFolderOpen /> Cambia
                    </button>
                    <button className="btn-ghost text-xs" onClick={disconnect} title="Disconnetti Drive">
                        <FaSignOutAlt />
                    </button>
                </div>
            </div>

            {error && <div className="ws-error">{error}</div>}

            <div className="ws-drive-body">
                <div className="ws-file-list">
                    {loading && <div className="text-muted text-sm" style={{ padding: '0.5rem' }}>Caricamento...</div>}
                    {!loading && files.length === 0 && (
                        <div className="text-muted text-sm" style={{ padding: '0.5rem' }}>Cartella vuota.</div>
                    )}
                    {files.map(f => (
                        <button key={f.id} className="ws-file-row" onClick={() => open(f)}>
                            <span className="ws-file-icon">{fileIcon(f)}</span>
                            <span className="ws-file-name">{f.name}</span>
                            {f.modifiedTime && (
                                <span className="ws-file-meta">
                                    {new Date(f.modifiedTime).toLocaleDateString()}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="ws-preview">
                    {preview ? (
                        <>
                            <div className="ws-preview-header">
                                <span className="ws-file-name" title={preview.name}>{preview.name}</span>
                                <div className="flex gap-1">
                                    {preview.webViewLink && (
                                        <a className="btn-ghost text-xs" href={preview.webViewLink} target="_blank" rel="noreferrer">
                                            <FaExternalLinkAlt /> Drive
                                        </a>
                                    )}
                                    <button className="btn-ghost text-xs" onClick={() => setPreview(null)}>✕</button>
                                </div>
                            </div>
                            <iframe
                                key={preview.id}
                                src={`https://drive.google.com/file/d/${preview.id}/preview`}
                                title={preview.name}
                                className="ws-preview-frame"
                                allow="autoplay"
                            />
                        </>
                    ) : (
                        <div className="ws-empty-small text-muted text-sm">
                            Seleziona un file per vederlo qui.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
