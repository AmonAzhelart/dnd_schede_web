import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaSearch, FaTimes, FaCheck, FaFolder, FaArrowLeft } from 'react-icons/fa';

export interface CatalogPickerItem {
    id: string;
    name: string;
    /** Free-text shown under the name (e.g. "Liv. 3 — Evocazione"). */
    subtitle?: string;
    /** Long description (truncated). */
    description?: string;
    /** Tags used by the search filter. */
    tags?: string[];
    /** Optional inline SVG markup to show as a thumbnail on the left. */
    previewSvg?: string;
    /** Original payload returned by `onPick`. */
    raw: any;
}

interface Props<T> {
    title: string;
    items: T[];
    loading?: boolean;
    onPick: (item: T) => void;
    onClose: () => void;
    /** Map a domain object to a uniform shape for rendering. */
    map: (item: T) => CatalogPickerItem;
    /** Extra filter chips (label, predicate). */
    filters?: { label: string; predicate: (item: T) => boolean }[];
    /** When provided, the picker shows a folder grid grouped by this key
     *  (return undefined for items without a category). */
    groupBy?: (item: T) => string | undefined;
    /** Label for items returned with no group (default "Senza categoria"). */
    uncategorisedLabel?: string;
}

const UNCATEGORISED = '__uncategorised__';

export function CatalogPicker<T>({ title, items, loading, onPick, onClose, map, filters, groupBy, uncategorisedLabel = 'Senza categoria' }: Props<T>) {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<number | null>(null);
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (currentFolder) setCurrentFolder(null);
                else onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, currentFolder]);

    /** Items filtered by search + chip (folder filter applied separately below). */
    const searched = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(item => {
            if (activeFilter !== null && filters && !filters[activeFilter].predicate(item)) return false;
            if (!q) return true;
            const m = map(item);
            return (
                m.name.toLowerCase().includes(q) ||
                (m.subtitle ?? '').toLowerCase().includes(q) ||
                (m.description ?? '').toLowerCase().includes(q) ||
                (m.tags ?? []).some(t => t.toLowerCase().includes(q))
            );
        });
    }, [items, search, activeFilter, filters, map]);

    /** Group buckets when `groupBy` is provided. */
    const folders = useMemo(() => {
        if (!groupBy) return null;
        const buckets = new Map<string, T[]>();
        for (const it of searched) {
            const key = groupBy(it) ?? UNCATEGORISED;
            const arr = buckets.get(key) ?? [];
            arr.push(it);
            buckets.set(key, arr);
        }
        return Array.from(buckets.entries())
            .sort(([a], [b]) => {
                if (a === UNCATEGORISED) return 1;
                if (b === UNCATEGORISED) return -1;
                return a.localeCompare(b);
            })
            .map(([key, list]) => ({
                key,
                label: key === UNCATEGORISED ? uncategorisedLabel : key,
                items: list,
            }));
    }, [searched, groupBy, uncategorisedLabel]);

    /** Final items list shown in the result area. */
    const visible = useMemo(() => {
        if (!groupBy) return searched;
        // Search active → flat list across folders.
        if (search.trim()) return searched;
        if (currentFolder) {
            return searched.filter(it => (groupBy(it) ?? UNCATEGORISED) === currentFolder);
        }
        return [];
    }, [searched, groupBy, currentFolder, search]);

    const showFolderGrid = !!groupBy && !currentFolder && !search.trim();
    const currentFolderLabel = currentFolder === UNCATEGORISED ? uncategorisedLabel : currentFolder;

    return createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="glass-panel"
                style={{
                    width: 'min(720px, 100%)', maxHeight: '85vh',
                    display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
                }}
            >
                <div className="section-header" style={{ marginBottom: 0 }}>
                    <span className="section-title">{title}</span>
                    <button className="btn-ghost text-sm" onClick={onClose}><FaTimes /></button>
                </div>

                <div className="flex items-center gap-2" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" />
                    <input
                        autoFocus
                        className="w-full"
                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                        placeholder={currentFolder ? `Cerca in ${currentFolderLabel}…` : 'Cerca…'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {filters && filters.length > 0 && (
                    <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                        <button
                            className="btn-secondary text-xs"
                            style={activeFilter === null ? { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' } : undefined}
                            onClick={() => setActiveFilter(null)}
                        >
                            Tutti
                        </button>
                        {filters.map((f, i) => (
                            <button
                                key={f.label}
                                className="btn-secondary text-xs"
                                style={activeFilter === i ? { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' } : undefined}
                                onClick={() => setActiveFilter(i)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Breadcrumb when inside a folder */}
                {groupBy && currentFolder && !search.trim() && (
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            className="btn-ghost text-xs flex items-center gap-1"
                            onClick={() => setCurrentFolder(null)}
                        >
                            <FaArrowLeft /> Cartelle
                        </button>
                        <span className="text-muted">/</span>
                        <span style={{ color: 'var(--accent-gold)' }}>
                            <FaFolder style={{ marginRight: 4 }} />
                            {currentFolderLabel}
                        </span>
                        <span className="text-xs text-muted">({visible.length})</span>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
                    {loading && <div className="text-muted text-sm">Caricamento…</div>}

                    {/* Folder grid */}
                    {!loading && showFolderGrid && folders && folders.length === 0 && (
                        <div className="text-muted text-sm" style={{ padding: '2rem', textAlign: 'center' }}>
                            Nessun elemento nel catalogo.
                        </div>
                    )}
                    {!loading && showFolderGrid && folders && folders.length > 0 && (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: 10,
                            }}
                        >
                            {folders.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setCurrentFolder(f.key)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        gap: 6, padding: '14px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        color: 'inherit', cursor: 'pointer', minHeight: 100,
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(201,168,76,0.10)';
                                        e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                    }}
                                >
                                    <FaFolder size={28} style={{ color: 'var(--accent-gold)' }} />
                                    <div style={{ fontFamily: 'var(--font-heading)', textAlign: 'center', fontSize: '0.85rem' }}>
                                        {f.label}
                                    </div>
                                    <div className="text-xs text-muted">{f.items.length}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Items list */}
                    {!loading && !showFolderGrid && visible.length === 0 && (
                        <div className="text-muted text-sm" style={{ padding: '2rem', textAlign: 'center' }}>
                            Nessun risultato. Il catalogo condiviso è gestito dal Back-Office.
                        </div>
                    )}
                    {!loading && !showFolderGrid && visible.length > 0 && (
                        <div className="flex-col gap-1">
                            {visible.map(item => {
                                const m = map(item);
                                return (
                                    <button
                                        key={m.id}
                                        className="flex items-center gap-2"
                                        style={{
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            textAlign: 'left',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.08)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                        onClick={() => onPick(item)}
                                    >
                                        {m.previewSvg && (
                                            <span
                                                style={{ width: 36, height: 36, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: 4 }}
                                                dangerouslySetInnerHTML={{
                                                    __html: m.previewSvg
                                                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                                                        .replace(/\son\w+="[^"]*"/gi, '')
                                                        .replace(/\son\w+='[^']*'/gi, '')
                                                        .replace(/javascript:/gi, ''),
                                                }}
                                            />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontFamily: 'var(--font-heading)' }}>
                                                {m.name}
                                                {m.subtitle && <span className="text-xs text-muted"> — {m.subtitle}</span>}
                                            </div>
                                            {m.description && (
                                                <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {m.description}
                                                </div>
                                            )}
                                        </div>
                                        <FaCheck className="text-muted" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
