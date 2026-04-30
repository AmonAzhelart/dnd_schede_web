import { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { iconCatalog, type CatalogIcon } from '../../services/admin';

interface Props {
    /** Currently selected icon id (or undefined). */
    value?: string;
    /** Called with the new icon id, or `''` to clear. */
    onChange: (iconId: string) => void;
    /** Optional hint label shown above the picker. */
    label?: string;
    /** Optional CSS size for the preview tile (default 48). */
    size?: number;
}

/**
 * Lightweight inline picker that shows a preview of the currently selected
 * icon plus a button that opens a searchable grid of all `catalog_icons`.
 *
 * The icons are loaded once per component instance — the catalog is small.
 */
export function IconPicker({ value, onChange, label, size = 48 }: Props) {
    const [icons, setIcons] = useState<CatalogIcon[]>([]);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await iconCatalog.list();
                if (!cancelled) setIcons(list);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const selected = useMemo(() => icons.find(i => i.id === value), [icons, value]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return icons;
        return icons.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.category?.toLowerCase().includes(q) ||
            i.tags?.some(t => t.toLowerCase().includes(q))
        );
    }, [icons, search]);

    return (
        <div className="flex-col gap-1">
            {label && <label className="text-xs text-muted">{label}</label>}
            <div className="flex items-center gap-2">
                <div
                    style={{
                        width: size,
                        height: size,
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                    title={selected?.name ?? 'Nessun\'icona'}
                >
                    {selected
                        ? <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'brightness(0) invert(1)' }} dangerouslySetInnerHTML={{ __html: selected.svg }} />
                        : <span className="text-xs text-muted">—</span>
                    }
                </div>
                <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(o => !o)}>
                    {open ? 'Chiudi' : selected ? 'Cambia' : 'Scegli icona'}
                </button>
                {selected && (
                    <button type="button" className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => onChange('')}>
                        <FaTimes /> Rimuovi
                    </button>
                )}
            </div>

            {open && (
                <div className="glass-panel flex-col gap-2" style={{ marginTop: 4, maxHeight: 360, padding: 8 }}>
                    <div className="flex items-center gap-2" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.6rem' }}>
                        <FaSearch className="text-muted" />
                        <input
                            className="w-full"
                            style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                            placeholder="Cerca per nome / tag / categoria…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    {loading && <span className="text-xs text-muted">Caricamento icone…</span>}
                    {!loading && filtered.length === 0 && <span className="text-xs text-muted">Nessuna icona corrispondente. Aggiungile dalla scheda <b>Icone</b>.</span>}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                            gap: 6,
                            overflowY: 'auto',
                            maxHeight: 280,
                            padding: 4,
                        }}
                    >
                        {filtered.map(icon => {
                            const isSelected = icon.id === value;
                            return (
                                <button
                                    type="button"
                                    key={icon.id}
                                    className="btn-ghost"
                                    title={`${icon.name}${icon.category ? ` (${icon.category})` : ''}`}
                                    onClick={() => { onChange(icon.id); setOpen(false); }}
                                    style={{
                                        padding: 4,
                                        height: 64,
                                        border: isSelected ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 6,
                                        background: isSelected ? 'rgba(255,210,120,0.12)' : 'rgba(0,0,0,0.2)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                    }}
                                >
                                    <span
                                        style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', filter: 'brightness(0) invert(1)' }}
                                        dangerouslySetInnerHTML={{ __html: icon.svg }}
                                    />
                                    <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                        {icon.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
