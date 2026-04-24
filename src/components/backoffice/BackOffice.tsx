import { useEffect, useMemo, useState } from 'react';
import {
    FaUserPlus, FaTrash, FaPlus, FaSave, FaTimes, FaSearch,
    FaScroll, FaStar, FaImage, FaEnvelope, FaCheck, FaBolt,
    FaFolder, FaFolderPlus, FaArrowLeft, FaUpload,
} from 'react-icons/fa';
import {
    SUPERADMIN_EMAIL,
    listInvites, addInvite, removeInvite, type Invite,
    spellCatalog, skillCatalog, featCatalog, iconCatalog,
    type CatalogSpell, type CatalogSkill, type CatalogFeat, type CatalogIcon,
} from '../../services/admin';
import { refreshIconCache, ICON_SLOT_GROUPS } from '../../services/iconCache';
import type { StatType } from '../../types/dnd';
import { v4 as uuid } from 'uuid';

type Section = 'invites' | 'spells' | 'skills' | 'feats' | 'icons';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'invites', label: 'Inviti', icon: <FaEnvelope /> },
    { id: 'spells', label: 'Magie', icon: <FaScroll /> },
    { id: 'skills', label: 'Abilità', icon: <FaStar /> },
    { id: 'feats', label: 'Talenti', icon: <FaBolt /> },
    { id: 'icons', label: 'Icone SVG', icon: <FaImage /> },
];

interface Props {
    currentUserEmail: string;
}

export function BackOffice({ currentUserEmail }: Props) {
    const [section, setSection] = useState<Section>('invites');

    return (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 'var(--space-5)', gap: 'var(--space-3)' }} className="animate-fade-in">
            <div className="section-header" style={{ flexShrink: 0 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Back-Office</h2>
                    <span className="text-muted text-sm">Pannello di amministrazione globale</span>
                </div>
                <span className="text-xs text-muted">SuperAdmin: {SUPERADMIN_EMAIL}</span>
            </div>

            <div className="flex gap-2" style={{ flexWrap: 'wrap', flexShrink: 0 }}>
                {SECTIONS.map(s => (
                    <button
                        key={s.id}
                        className={`btn-secondary text-sm ${section === s.id ? 'active' : ''}`}
                        style={section === s.id
                            ? { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }
                            : undefined}
                        onClick={() => setSection(s.id)}
                    >
                        {s.icon} {s.label}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {section === 'invites' && <InvitesPanel currentUserEmail={currentUserEmail} />}
                {section === 'spells' && <SpellsPanel currentUserEmail={currentUserEmail} />}
                {section === 'skills' && <SkillsPanel currentUserEmail={currentUserEmail} />}
                {section === 'feats' && <FeatsPanel currentUserEmail={currentUserEmail} />}
                {section === 'icons' && <IconsPanel currentUserEmail={currentUserEmail} />}
            </div>
        </div>
    );
}

/* ────────────────────────────── INVITES ────────────────────────────── */

function InvitesPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        setInvites(await listInvites());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Email non valida.');
            return;
        }
        setBusy(true);
        try {
            await addInvite(trimmed, currentUserEmail, note.trim() || undefined);
            setEmail(''); setNote('');
            await refresh();
        } catch (err: any) {
            setError(err?.message ?? 'Errore.');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (e: string) => {
        if (!confirm(`Revocare l'invito a ${e}?`)) return;
        await removeInvite(e);
        await refresh();
    };

    return (
        <div className="flex-col gap-4">
            <div className="glass-panel">
                <div className="section-header"><span className="section-title">Nuovo Invito</span></div>
                <form onSubmit={submit} className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 240px' }}>
                        <label className="text-xs text-muted">Email</label>
                        <input className="input w-full" type="email" placeholder="utente@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div style={{ flex: '1 1 240px' }}>
                        <label className="text-xs text-muted">Nota (opzionale)</label>
                        <input className="input w-full" type="text" placeholder="Es. Master Marco" value={note} onChange={e => setNote(e.target.value)} />
                    </div>
                    <button className="btn-primary" type="submit" disabled={busy}>
                        <FaUserPlus /> {busy ? 'Invio…' : 'Invita'}
                    </button>
                </form>
                {error && <div className="text-xs" style={{ color: 'var(--accent-crimson)', marginTop: 8 }}>{error}</div>}
            </div>

            <div className="glass-panel">
                <div className="section-header">
                    <span className="section-title">Utenti Autorizzati ({invites.length + 1})</span>
                </div>
                <div className="flex-col gap-1">
                    <div className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                        <FaCheck style={{ color: 'var(--accent-gold)' }} />
                        <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>{SUPERADMIN_EMAIL}</span>
                        <span className="text-xs text-muted">SuperAdmin</span>
                    </div>
                    {loading && <div className="text-muted text-sm">Caricamento…</div>}
                    {!loading && invites.length === 0 && <div className="text-muted text-sm">Nessun invito al momento.</div>}
                    {invites.map(inv => (
                        <div key={inv.email} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            <FaEnvelope className="text-muted" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                                {inv.note && <div className="text-xs text-muted">{inv.note}</div>}
                            </div>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => handleRemove(inv.email)} title="Revoca">
                                <FaTrash />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────── SPELLS ────────────────────────────── */

const EMPTY_SPELL = (): CatalogSpell => ({
    id: uuid(), name: '', level: 0, school: '', description: '',
    castingTime: '', range: '', duration: '', savingThrow: '', components: '',
});

function SpellsPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogSpell[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogSpell | null>(null);
    const [search, setSearch] = useState('');

    const refresh = async () => {
        setLoading(true);
        setItems(await spellCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(i => i.name.toLowerCase().includes(q) || (i.school || '').toLowerCase().includes(q));
    }, [items, search]);

    const save = async () => {
        if (!editing || !editing.name.trim()) return;
        await spellCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };

    const remove = async (id: string) => {
        if (!confirm('Eliminare questa magia dal catalogo condiviso?')) return;
        await spellCatalog.remove(id);
        await refresh();
    };

    if (editing) {
        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">{items.find(i => i.id === editing.id) ? 'Modifica' : 'Nuova'} Magia</span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> Annulla</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> Salva</button>
                    </div>
                </div>
                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Nome"><input className="input w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
                    <Field label="Scuola"><input className="input w-full" value={editing.school} onChange={e => setEditing({ ...editing, school: e.target.value })} /></Field>
                    <Field label="Livello"><input className="input w-full" type="number" min={0} max={9} value={editing.level} onChange={e => setEditing({ ...editing, level: Number(e.target.value) })} /></Field>
                    <Field label="Tempo Lancio"><input className="input w-full" value={editing.castingTime ?? ''} onChange={e => setEditing({ ...editing, castingTime: e.target.value })} /></Field>
                    <Field label="Gittata"><input className="input w-full" value={editing.range ?? ''} onChange={e => setEditing({ ...editing, range: e.target.value })} /></Field>
                    <Field label="Durata"><input className="input w-full" value={editing.duration ?? ''} onChange={e => setEditing({ ...editing, duration: e.target.value })} /></Field>
                    <Field label="TS"><input className="input w-full" value={editing.savingThrow ?? ''} onChange={e => setEditing({ ...editing, savingThrow: e.target.value })} /></Field>
                    <Field label="Componenti"><input className="input w-full" value={editing.components ?? ''} onChange={e => setEditing({ ...editing, components: e.target.value })} /></Field>
                </div>
                <Field label="Descrizione">
                    <textarea className="input w-full" rows={6} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
                </Field>
                <Field label="Tag (separati da virgola)">
                    <input className="input w-full" value={(editing.tags ?? []).join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </Field>
            </div>
        );
    }

    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                <div className="flex items-center gap-2" style={{ flex: '1 1 240px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" />
                    <input className="w-full" style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }} placeholder="Cerca magia…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY_SPELL())}><FaPlus /> Nuova Magia</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">Caricamento…</div>}
                {!loading && filtered.length === 0 && <div className="text-muted text-sm">Nessuna magia nel catalogo.</div>}
                <div className="flex-col gap-1">
                    {filtered.map(s => (
                        <div key={s.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-heading)' }}>{s.name} <span className="text-xs text-muted">— Liv. {s.level} {s.school}</span></div>
                                {s.description && <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>}
                            </div>
                            <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>Modifica</button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(s.id)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────── SKILLS ────────────────────────────── */

const STAT_OPTIONS: StatType[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const EMPTY_SKILL = (): CatalogSkill => ({
    id: uuid(), name: '', stat: 'int', canUseUntrained: true, armorCheckPenalty: false,
});

function SkillsPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogSkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogSkill | null>(null);

    const refresh = async () => {
        setLoading(true);
        setItems(await skillCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const save = async () => {
        if (!editing || !editing.name.trim()) return;
        await skillCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm('Eliminare questa abilità?')) return;
        await skillCatalog.remove(id);
        await refresh();
    };

    if (editing) {
        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">{items.find(i => i.id === editing.id) ? 'Modifica' : 'Nuova'} Abilità</span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> Annulla</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> Salva</button>
                    </div>
                </div>
                <Field label="Nome"><input className="input w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
                <Field label="Caratteristica">
                    <select className="input w-full" value={editing.stat} onChange={e => setEditing({ ...editing, stat: e.target.value as StatType })}>
                        {STAT_OPTIONS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.canUseUntrained} onChange={e => setEditing({ ...editing, canUseUntrained: e.target.checked })} />
                    Usabile senza addestramento
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.armorCheckPenalty} onChange={e => setEditing({ ...editing, armorCheckPenalty: e.target.checked })} />
                    Soggetto a penalità d'armatura
                </label>
                <Field label="Descrizione (opzionale)">
                    <textarea className="input w-full" rows={4} value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
                </Field>
            </div>
        );
    }

    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end' }}>
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY_SKILL())}><FaPlus /> Nuova Abilità</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">Caricamento…</div>}
                {!loading && items.length === 0 && <div className="text-muted text-sm">Nessuna abilità nel catalogo.</div>}
                <div className="flex-col gap-1">
                    {items.map(s => (
                        <div key={s.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ flex: 1 }}>
                                <span style={{ fontFamily: 'var(--font-heading)' }}>{s.name}</span>
                                <span className="text-xs text-muted"> — {s.stat.toUpperCase()}{s.armorCheckPenalty ? ' • ACP' : ''}{s.canUseUntrained ? ' • untrained' : ''}</span>
                            </div>
                            <button className="btn-ghost text-xs" onClick={() => setEditing(s)}>Modifica</button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(s.id)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────── ICONS (SVG) ────────────────────────────── */


const UNCATEGORISED = '__uncategorised__';

function IconsPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogIcon[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    /** Empty categories that exist only in memory until a first icon is dropped. */
    const [draftCategories, setDraftCategories] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [busy, setBusy] = useState(false);

    const refresh = async () => {
        setLoading(true);
        setItems(await iconCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    /* ─── Folder list (categories) ─── */
    const folders = useMemo(() => {
        const counts = new Map<string, number>();
        for (const ic of items) {
            const k = (ic.category ?? '').trim() || UNCATEGORISED;
            counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        for (const c of draftCategories) {
            if (!counts.has(c)) counts.set(c, 0);
        }
        return Array.from(counts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => {
                if (a.name === UNCATEGORISED) return 1;
                if (b.name === UNCATEGORISED) return -1;
                return a.name.localeCompare(b.name);
            });
    }, [items, draftCategories]);

    const inFolder = useMemo(() => {
        if (!activeCategory) return [];
        const list = items.filter(ic => ((ic.category ?? '').trim() || UNCATEGORISED) === activeCategory);
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter(ic =>
            ic.name.toLowerCase().includes(q) ||
            (ic.tags ?? []).some(t => t.toLowerCase().includes(q)),
        );
    }, [items, activeCategory, search]);

    /* ─── Drop / upload ─── */
    const handleFiles = async (files: FileList | File[]) => {
        if (!activeCategory) return;
        setBusy(true);
        try {
            const arr = Array.from(files);
            const cat = activeCategory === UNCATEGORISED ? '' : activeCategory;
            for (const f of arr) {
                if (!/\.svg$/i.test(f.name) && f.type !== 'image/svg+xml') continue;
                if (f.size > 200_000) { console.warn('skipped (too large):', f.name); continue; }
                const text = await f.text();
                if (!/<svg[\s>]/i.test(text)) continue;
                await iconCatalog.upsert({
                    id: uuid(),
                    name: f.name.replace(/\.svg$/i, ''),
                    category: cat,
                    svg: text,
                    createdBy: currentUserEmail,
                });
            }
            // If the active category was a draft, persist its existence as soon as it has icons.
            setDraftCategories(prev => prev.filter(c => c !== activeCategory));
            await refresh();
            await refreshIconCache();
        } finally {
            setBusy(false);
        }
    };

    /* ─── Mutations ─── */
    const renameIcon = async (ic: CatalogIcon, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === ic.name) { setRenaming(null); return; }
        await iconCatalog.upsert({ ...ic, name: trimmed });
        setRenaming(null);
        await refresh();
        await refreshIconCache();
    };
    const deleteIcon = async (ic: CatalogIcon) => {
        if (!confirm(`Eliminare l'icona "${ic.name}"?`)) return;
        await iconCatalog.remove(ic.id);
        await refresh();
        await refreshIconCache();
    };
    const setDefaultFor = async (ic: CatalogIcon, slot: string | '') => {
        // Clear any existing default holder for this slot, then set on this icon.
        if (slot) {
            const previous = items.filter(i => i.defaultFor === slot && i.id !== ic.id);
            for (const p of previous) {
                await iconCatalog.upsert({ ...p, defaultFor: '' });
            }
        }
        await iconCatalog.upsert({ ...ic, defaultFor: slot || '' });
        await refresh();
        await refreshIconCache();
    };
    const moveToCategory = async (ic: CatalogIcon, newCat: string) => {
        const cat = newCat === UNCATEGORISED ? '' : newCat;
        await iconCatalog.upsert({ ...ic, category: cat });
        await refresh();
        await refreshIconCache();
    };
    const renameFolder = async (oldName: string) => {
        const next = prompt('Nuovo nome categoria:', oldName === UNCATEGORISED ? '' : oldName)?.trim();
        if (next === undefined) return;
        if (oldName === UNCATEGORISED) return; // cannot rename system bucket
        const updates = items.filter(i => (i.category ?? '') === oldName);
        for (const ic of updates) {
            await iconCatalog.upsert({ ...ic, category: next });
        }
        setDraftCategories(prev => prev.filter(c => c !== oldName));
        if (activeCategory === oldName) setActiveCategory(next || UNCATEGORISED);
        await refresh();
        await refreshIconCache();
    };
    const deleteFolder = async (name: string) => {
        if (name === UNCATEGORISED) return;
        const inside = items.filter(i => (i.category ?? '') === name);
        if (inside.length > 0 && !confirm(`Eliminare la cartella "${name}" e le sue ${inside.length} icone?`)) return;
        for (const ic of inside) {
            await iconCatalog.remove(ic.id);
        }
        setDraftCategories(prev => prev.filter(c => c !== name));
        await refresh();
        await refreshIconCache();
    };
    const newFolder = () => {
        const n = prompt('Nome nuova categoria:')?.trim();
        if (!n) return;
        if (folders.some(f => f.name === n)) { setActiveCategory(n); return; }
        setDraftCategories(prev => [...prev, n]);
        setActiveCategory(n);
    };

    /* ─── Folder grid view ─── */
    if (!activeCategory) {
        return (
            <div className="flex-col gap-3">
                <div className="flex gap-2 items-center" style={{ justifyContent: 'space-between' }}>
                    <div className="text-xs text-muted">
                        Organizza le icone in cartelle. Apri una cartella per caricare SVG con drag &amp; drop.
                    </div>
                    <button className="btn-primary text-sm" onClick={newFolder}><FaFolderPlus /> Nuova Categoria</button>
                </div>
                <div className="glass-panel">
                    {loading && <div className="text-muted text-sm">Caricamento…</div>}
                    {!loading && folders.length === 0 && (
                        <div className="text-muted text-sm">Nessuna cartella. Creane una per iniziare.</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-2)' }}>
                        {folders.map(f => (
                            <div key={f.name} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                onClick={() => setActiveCategory(f.name)}>
                                <FaFolder style={{ fontSize: 36, color: 'var(--accent-gold)' }} />
                                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', textAlign: 'center' }}>
                                    {f.name === UNCATEGORISED ? '(Senza categoria)' : f.name}
                                </div>
                                <div className="text-xs text-muted">{f.count} icone</div>
                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    {f.name !== UNCATEGORISED && (
                                        <button className="btn-ghost text-xs" onClick={() => renameFolder(f.name)}>Rinomina</button>
                                    )}
                                    {f.name !== UNCATEGORISED && (
                                        <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => deleteFolder(f.name)}><FaTrash /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /* ─── Inside-folder view ─── */
    const onDropFiles = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                <button className="btn-secondary text-sm" onClick={() => { setActiveCategory(null); setSearch(''); }}>
                    <FaArrowLeft /> Cartelle
                </button>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-gold)' }}>
                    {activeCategory === UNCATEGORISED ? '(Senza categoria)' : activeCategory}
                </div>
                <span className="text-xs text-muted">— {inFolder.length} icone</span>
                <div className="flex items-center gap-2" style={{ flex: '1 1 200px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" />
                    <input className="w-full" style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }} placeholder="Cerca…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <label className="btn-primary text-sm" style={{ cursor: 'pointer' }}>
                    <FaUpload /> Carica SVG
                    <input type="file" accept=".svg,image/svg+xml" multiple style={{ display: 'none' }}
                        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
                </label>
            </div>

            <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDropFiles}
                className="glass-panel"
                style={{
                    minHeight: 220,
                    border: isDragging ? '2px dashed var(--accent-gold)' : '2px dashed transparent',
                    background: isDragging ? 'rgba(201,168,76,0.08)' : undefined,
                    transition: 'background 120ms, border-color 120ms',
                }}
            >
                {busy && <div className="text-muted text-sm">Caricamento file…</div>}
                {!busy && inFolder.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                        <FaUpload style={{ fontSize: 36, opacity: 0.5, marginBottom: 8 }} />
                        <div className="text-sm">Trascina qui i file SVG o usa "Carica SVG".</div>
                        <div className="text-xs">Massimo 200 KB per file.</div>
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-2)' }}>
                    {inFolder.map(ic => (
                        <div key={ic.id} className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div className="inv-svg-tinted" style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                dangerouslySetInnerHTML={{ __html: sanitizeSvg(ic.svg) }} />
                            {renaming?.id === ic.id ? (
                                <input className="input w-full text-xs" autoFocus value={renaming.value}
                                    onChange={e => setRenaming({ id: ic.id, value: e.target.value })}
                                    onBlur={() => renameIcon(ic, renaming.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') renameIcon(ic, renaming.value);
                                        if (e.key === 'Escape') setRenaming(null);
                                    }} />
                            ) : (
                                <div className="text-xs" style={{ textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', cursor: 'pointer' }}
                                    onClick={() => setRenaming({ id: ic.id, value: ic.name })}
                                    title="Clicca per rinominare">{ic.name}</div>
                            )}
                            {ic.defaultFor && (
                                <div className="text-xs" style={{ color: 'var(--accent-gold)' }}>
                                    ★ {
                                        ICON_SLOT_GROUPS
                                            .flatMap(g => g.slots)
                                            .find(s => s.id === ic.defaultFor)?.label ?? ic.defaultFor
                                    }
                                </div>
                            )}
                            <select
                                className="input w-full text-xs"
                                value={ic.defaultFor ?? ''}
                                onChange={e => setDefaultFor(ic, e.target.value)}
                                title="Imposta come icona di default"
                                style={{ fontSize: 11 }}
                            >
                                <option value="">— Default per… —</option>
                                {ICON_SLOT_GROUPS.map(g => (
                                    <optgroup key={g.label} label={g.label}>
                                        {g.slots.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                            <select
                                className="input w-full text-xs"
                                value={(ic.category ?? '').trim() || UNCATEGORISED}
                                onChange={e => moveToCategory(ic, e.target.value)}
                                style={{ fontSize: 11 }}
                                title="Sposta in cartella"
                            >
                                {folders.map(f => (
                                    <option key={f.name} value={f.name}>
                                        {f.name === UNCATEGORISED ? '(Senza categoria)' : f.name}
                                    </option>
                                ))}
                            </select>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => deleteIcon(ic)}>
                                <FaTrash /> Elimina
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Strip <script> tags and inline event handlers from user-supplied SVG. */
function sanitizeSvg(svg: string): string {
    return svg
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');
}

/* ────────────────────────────── FEATS ────────────────────────────── */

const EMPTY_FEAT_CAT = (): CatalogFeat => ({
    id: uuid(), name: '', description: '', modifiers: [], isDefect: false,
});

function FeatsPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogFeat[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogFeat | null>(null);
    const [search, setSearch] = useState('');

    const refresh = async () => {
        setLoading(true);
        setItems(await featCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q) ||
            (i.tags ?? []).some(t => t.toLowerCase().includes(q)),
        );
    }, [items, search]);

    const save = async () => {
        if (!editing || !editing.name.trim()) return;
        await featCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm('Eliminare questo talento?')) return;
        await featCatalog.remove(id);
        await refresh();
    };

    if (editing) {
        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">{items.find(i => i.id === editing.id) ? 'Modifica' : 'Nuovo'} Talento</span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> Annulla</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> Salva</button>
                    </div>
                </div>
                <Field label="Nome"><input className="input w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editing.isDefect} onChange={e => setEditing({ ...editing, isDefect: e.target.checked })} />
                    È un Difetto
                </label>
                <Field label="Descrizione">
                    <textarea className="input w-full" rows={6} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
                </Field>
                <Field label="Tag (separati da virgola)">
                    <input className="input w-full" value={(editing.tags ?? []).join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </Field>
                <div className="text-xs text-muted">
                    I modificatori dettagliati possono essere aggiunti manualmente sulla scheda dopo l'import.
                </div>
            </div>
        );
    }

    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                <div className="flex items-center gap-2" style={{ flex: '1 1 240px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" />
                    <input className="w-full" style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }} placeholder="Cerca…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY_FEAT_CAT())}><FaPlus /> Nuovo Talento</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">Caricamento…</div>}
                {!loading && filtered.length === 0 && <div className="text-muted text-sm">Nessun talento nel catalogo.</div>}
                <div className="flex-col gap-1">
                    {filtered.map(f => (
                        <div key={f.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-heading)' }}>
                                    {f.name}
                                    {f.isDefect && <span className="text-xs" style={{ color: 'var(--accent-crimson)', marginLeft: 6 }}>[Difetto]</span>}
                                </div>
                                {f.description && <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.description}</div>}
                            </div>
                            <button className="btn-ghost text-xs" onClick={() => setEditing(f)}>Modifica</button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(f.id)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────── SHARED UI ────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    );
}
