import React, { useState } from 'react';
import { FaGoogleDrive, FaRobot, FaBookOpen } from 'react-icons/fa';
import { DrivePanel } from './DrivePanel';
import { GeminiPanel } from './GeminiPanel';
import { NotebookPanel } from './NotebookPanel';

type WsTab = 'drive' | 'gemini' | 'notebook';

interface Props { uid: string; }

const tabs: { id: WsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'drive', label: 'Drive', icon: <FaGoogleDrive /> },
    { id: 'gemini', label: 'Gemini', icon: <FaRobot /> },
    { id: 'notebook', label: 'Notebook AI', icon: <FaBookOpen /> },
];

export const WorkspaceView: React.FC<Props> = ({ uid }) => {
    const [tab, setTab] = useState<WsTab>('drive');

    return (
        <div className="ws-root animate-fade-in">
            <div className="section-header" style={{ flexShrink: 0 }}>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Workspace Google</h2>
                <div className="flex gap-1">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`btn-secondary text-xs ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="ws-content">
                {tab === 'drive' && <DrivePanel uid={uid} />}
                {tab === 'gemini' && <GeminiPanel />}
                {tab === 'notebook' && <NotebookPanel uid={uid} />}
            </div>
        </div>
    );
};
