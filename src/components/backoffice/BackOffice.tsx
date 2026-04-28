import { useEffect, useMemo, useRef, useState } from 'react';
import {
    FaUserPlus, FaTrash, FaPlus, FaSave, FaTimes, FaSearch,
    FaScroll, FaStar, FaImage, FaEnvelope, FaCheck, FaBolt,
    FaFolder, FaFolderPlus, FaArrowLeft, FaUpload, FaDragon, FaEdit,
} from 'react-icons/fa';
import {
    SUPERADMIN_EMAIL,
    listInvites, addInvite, removeInvite, type Invite,
    spellCatalog, skillCatalog, featCatalog, iconCatalog, creatureCatalog,
    type CatalogSpell, type CatalogSkill, type CatalogFeat, type CatalogIcon, type CatalogCreature,
} from '../../services/admin';
import { refreshIconCache, ICON_SLOT_GROUPS } from '../../services/iconCache';
import type { StatType, CreatureSize, CreatureTypeCategory, CreatureAlignment, CreatureAction, CreatureSpecialAbility } from '../../types/dnd';
import { v4 as uuid } from 'uuid';

type Section = 'invites' | 'spells' | 'skills' | 'feats' | 'icons' | 'bestiary';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'invites', label: 'Inviti', icon: <FaEnvelope /> },
    { id: 'spells', label: 'Magie', icon: <FaScroll /> },
    { id: 'skills', label: 'Abilità', icon: <FaStar /> },
    { id: 'feats', label: 'Talenti', icon: <FaBolt /> },
    { id: 'icons', label: 'Icone SVG', icon: <FaImage /> },
    { id: 'bestiary', label: 'Bestiario', icon: <FaDragon /> },
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
                {section === 'bestiary' && <BestiaryPanel currentUserEmail={currentUserEmail} />}
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
    attackMode: 'none', baseDice: '', damageType: '', saveStat: 'int',
    upcastDice: '', upcastEveryLevels: 1, upcastMaxSteps: undefined,
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

                {/* ── Danno & Combattimento ── */}
                <div className="section-header" style={{ marginTop: 'var(--space-2)' }}>
                    <span className="section-title text-sm">Danno &amp; Combattimento (opzionale)</span>
                </div>
                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Tipo TxC">
                        <select className="input w-full" value={editing.attackMode ?? 'none'}
                            onChange={e => setEditing({ ...editing, attackMode: e.target.value as CatalogSpell['attackMode'] })}>
                            <option value="none">Nessuno</option>
                            <option value="rangedTouch">Tocco a distanza</option>
                            <option value="meleeTouch">Tocco in mischia</option>
                            <option value="ray">Raggio</option>
                            <option value="normal">Attacco normale</option>
                        </select>
                    </Field>
                    <Field label="Dadi base (es. 2d6)">
                        <input className="input w-full" value={editing.baseDice ?? ''}
                            onChange={e => setEditing({ ...editing, baseDice: e.target.value })} placeholder="vuoto = nessun danno" />
                    </Field>
                    <Field label="Tipo danno">
                        <input className="input w-full" value={editing.damageType ?? ''}
                            onChange={e => setEditing({ ...editing, damageType: e.target.value })} placeholder="fuoco, freddo…" />
                    </Field>
                    <Field label="CD da">
                        <select className="input w-full" value={editing.saveStat ?? 'int'}
                            onChange={e => setEditing({ ...editing, saveStat: e.target.value as StatType })}>
                            {(['int', 'wis', 'cha', 'str', 'dex', 'con'] as const).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                    </Field>
                </div>

                {/* ── Upcast ── */}
                <div className="section-header" style={{ marginTop: 'var(--space-2)' }}>
                    <span className="section-title text-sm">Upcast — extra dadi se preparato in slot superiore</span>
                </div>
                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Dadi extra/step (es. 1d6)">
                        <input className="input w-full" value={editing.upcastDice ?? ''}
                            onChange={e => setEditing({ ...editing, upcastDice: e.target.value })} placeholder="vuoto = nessun upcast" />
                    </Field>
                    <Field label="Liv. slot/step">
                        <input className="input w-full" type="number" min={1} value={editing.upcastEveryLevels ?? 1}
                            onChange={e => setEditing({ ...editing, upcastEveryLevels: Math.max(1, Number(e.target.value) || 1) })}
                            title="Livelli di slot sopra il livello base per +1 step (es. 2 → +1 dado ogni 2 livelli sopra)" />
                    </Field>
                    <Field label="Max step">
                        <input className="input w-full" type="number" min={1} value={editing.upcastMaxSteps ?? ''}
                            onChange={e => setEditing({ ...editing, upcastMaxSteps: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })}
                            placeholder="—" />
                    </Field>
                </div>

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

/* ────────────────────────────── BESTIARY ────────────────────────────── */

const CREATURE_SIZES: CreatureSize[] = ['Minuscola', 'Piccola', 'Media', 'Grande', 'Enorme', 'Mastodontica', 'Colossale'];
const CREATURE_TYPES: CreatureTypeCategory[] = [
    'Aberrazione', 'Animale', 'Costrutto', 'Drago', 'Elementale', 'Fatato', 'Gigante',
    'Umanoide', 'Bestia Magica', 'Umanoide Mostruoso', 'Melma', 'Esterno', 'Vegetale', 'Non Morto', 'Verme',
];
const CREATURE_ALIGNMENTS: CreatureAlignment[] = [
    'Legale Buono', 'Neutrale Buono', 'Caotico Buono',
    'Legale Neutrale', 'Neutrale', 'Caotico Neutrale',
    'Legale Malvagio', 'Neutrale Malvagio', 'Caotico Malvagio',
];

const EMPTY_CREATURE = (): CatalogCreature => ({
    id: uuid(), name: '', size: 'Media', type: 'Bestia Magica', alignment: 'Neutrale',
    str: 10, dex: 10, con: 10, int: 2, wis: 10, cha: 4,
    hp: 10, ac: 12, speed: 9, bab: 0,
    fortitude: 0, reflex: 0, will: 0,
    actions: [], specialAbilities: [],
    description: '', challengeRating: '1', tags: [],
});

/** Compress an image file (for creature portraits) to a small base64 data URL. */
async function compressCreatureImage(file: File): Promise<{ data: string; type: 'svg' | 'webp' | 'png' }> {
    if (file.type === 'image/svg+xml') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read-failed'));
            reader.onload = () => resolve({ data: String(reader.result), type: 'svg' });
            reader.readAsText(file);
        });
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read-failed'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('decode-failed'));
            img.onload = () => {
                const MAX = 256;
                const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * ratio));
                const h = Math.max(1, Math.round(img.height * ratio));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('canvas')); return; }
                ctx.drawImage(img, 0, 0, w, h);
                resolve({ data: canvas.toDataURL('image/webp', 0.75), type: 'webp' });
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

function BestiaryPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogCreature[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogCreature | null>(null);
    const [search, setSearch] = useState('');
    const [imgUploading, setImgUploading] = useState(false);
    const imgInputRef = useRef<HTMLInputElement>(null);

    const refresh = async () => { setLoading(true); setItems(await creatureCatalog.list()); setLoading(false); };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(i => i.name.toLowerCase().includes(q) || (i.type || '').toLowerCase().includes(q) || (i.challengeRating || '').includes(q));
    }, [items, search]);

    const save = async () => {
        if (!editing || !editing.name.trim()) return;
        await creatureCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };

    const remove = async (id: string) => {
        if (!confirm('Eliminare questa creatura dal catalogo condiviso?')) return;
        await creatureCatalog.remove(id);
        await refresh();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editing || !e.target.files?.length) return;
        setImgUploading(true);
        try {
            const { data, type } = await compressCreatureImage(e.target.files[0]);
            setEditing({ ...editing, imageData: data, imageType: type });
        } catch { /* ignore */ }
        finally { setImgUploading(false); if (imgInputRef.current) imgInputRef.current.value = ''; }
    };

    const addAction = () => {
        if (!editing) return;
        const a: CreatureAction = { id: uuid(), name: '', damage: '', damageType: '', range: 'Mischia' };
        setEditing({ ...editing, actions: [...(editing.actions ?? []), a] });
    };
    const updateAction = (a: CreatureAction) => {
        if (!editing) return;
        setEditing({ ...editing, actions: (editing.actions ?? []).map(x => x.id === a.id ? a : x) });
    };
    const removeAction = (id: string) => {
        if (!editing) return;
        setEditing({ ...editing, actions: (editing.actions ?? []).filter(x => x.id !== id) });
    };

    const addAbility = () => {
        if (!editing) return;
        const a: CreatureSpecialAbility = { id: uuid(), name: '', description: '', abilityType: 'EX' };
        setEditing({ ...editing, specialAbilities: [...(editing.specialAbilities ?? []), a] });
    };
    const updateAbility = (a: CreatureSpecialAbility) => {
        if (!editing) return;
        setEditing({ ...editing, specialAbilities: (editing.specialAbilities ?? []).map(x => x.id === a.id ? a : x) });
    };
    const removeAbility = (id: string) => {
        if (!editing) return;
        setEditing({ ...editing, specialAbilities: (editing.specialAbilities ?? []).filter(x => x.id !== id) });
    };

    if (editing) {
        const e = editing;
        const set = (patch: Partial<CatalogCreature>) => setEditing({ ...e, ...patch });
        const n = (v: string) => Number(v) || 0;

        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">{items.find(i => i.id === e.id) ? 'Modifica' : 'Nuova'} Creatura</span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> Annulla</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> Salva</button>
                    </div>
                </div>

                {/* ── Image ── */}
                <div className="flex gap-3 items-start" style={{ flexWrap: 'wrap' }}>
                    {e.imageData ? (
                        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                            {e.imageType === 'svg'
                                ? <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-surface)' }} dangerouslySetInnerHTML={{ __html: e.imageData }} />
                                : <img src={e.imageData} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                            }
                            <button className="btn-ghost text-xs" style={{ position: 'absolute', top: 0, right: 0, color: 'var(--accent-crimson)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%' }}
                                onClick={() => set({ imageData: undefined, imageType: undefined })}>✕</button>
                        </div>
                    ) : (
                        <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 28, flexShrink: 0, cursor: 'pointer' }}
                            onClick={() => imgInputRef.current?.click()}>
                            <FaDragon />
                        </div>
                    )}
                    <div className="flex-col gap-1">
                        <input ref={imgInputRef} type="file" accept="image/svg+xml,image/webp,image/png" style={{ display: 'none' }} onChange={handleImageUpload} />
                        <button className="btn-secondary text-sm" onClick={() => imgInputRef.current?.click()} disabled={imgUploading}>
                            <FaUpload /> {imgUploading ? 'Caricamento…' : 'Carica immagine (SVG/WebP)'}
                        </button>
                        <span className="text-xs text-muted">max 256×256 px, SVG o WebP consigliato</span>
                    </div>
                </div>

                {/* ── Identity ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Nome *"><input className="input w-full" value={e.name} onChange={ev => set({ name: ev.target.value })} /></Field>
                    <Field label="Taglia">
                        <select className="input w-full" value={e.size} onChange={ev => set({ size: ev.target.value as CreatureSize })}>
                            {CREATURE_SIZES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </Field>
                    <Field label="Tipo">
                        <select className="input w-full" value={e.type} onChange={ev => set({ type: ev.target.value as CreatureTypeCategory })}>
                            {CREATURE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label="Sottotipo"><input className="input w-full" value={e.subtype ?? ''} onChange={ev => set({ subtype: ev.target.value })} /></Field>
                    <Field label="Allineamento">
                        <select className="input w-full" value={e.alignment ?? 'Neutrale'} onChange={ev => set({ alignment: ev.target.value as CreatureAlignment })}>
                            {CREATURE_ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </Field>
                    <Field label="CR"><input className="input w-full" value={e.challengeRating ?? ''} onChange={ev => set({ challengeRating: ev.target.value })} placeholder="es. 5, 1/2" /></Field>
                    <Field label="Fonte"><input className="input w-full" value={e.source ?? ''} onChange={ev => set({ source: ev.target.value })} placeholder="es. Monster Manual" /></Field>
                </div>

                {/* ── Ability scores ── */}
                <div className="section-header" style={{ marginTop: 8 }}><span className="section-title text-sm">Caratteristiche</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-2)' }}>
                    {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(s => (
                        <Field key={s} label={s.toUpperCase()}>
                            <input className="input w-full" type="number" min={1} value={(e as any)[s]} onChange={ev => set({ [s]: n(ev.target.value) })} />
                        </Field>
                    ))}
                </div>

                {/* ── Combat ── */}
                <div className="section-header" style={{ marginTop: 8 }}><span className="section-title text-sm">Combattimento</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="PF max"><input className="input w-full" type="number" min={1} value={e.hp} onChange={ev => set({ hp: n(ev.target.value) })} /></Field>
                    <Field label="Dadi PF (es. 4d8+8)"><input className="input w-full" value={e.hpDice ?? ''} onChange={ev => set({ hpDice: ev.target.value })} /></Field>
                    <Field label="CA"><input className="input w-full" type="number" value={e.ac} onChange={ev => set({ ac: n(ev.target.value) })} /></Field>
                    <Field label="CA Naturale"><input className="input w-full" type="number" value={e.acNatural ?? 0} onChange={ev => set({ acNatural: n(ev.target.value) })} /></Field>
                    <Field label="BAB"><input className="input w-full" type="number" value={e.bab} onChange={ev => set({ bab: n(ev.target.value) })} /></Field>
                    <Field label="Presa"><input className="input w-full" type="number" value={e.grapple ?? 0} onChange={ev => set({ grapple: n(ev.target.value) })} /></Field>
                    <Field label="Velocità (m)"><input className="input w-full" type="number" value={e.speed} onChange={ev => set({ speed: n(ev.target.value) })} /></Field>
                    <Field label="Volo (m)"><input className="input w-full" type="number" value={e.fly ?? 0} onChange={ev => set({ fly: n(ev.target.value) || undefined })} /></Field>
                    <Field label="Nuoto (m)"><input className="input w-full" type="number" value={e.swim ?? 0} onChange={ev => set({ swim: n(ev.target.value) || undefined })} /></Field>
                    <Field label="Scalata (m)"><input className="input w-full" type="number" value={e.climb ?? 0} onChange={ev => set({ climb: n(ev.target.value) || undefined })} /></Field>
                </div>

                {/* ── Saves ── */}
                <div className="section-header" style={{ marginTop: 8 }}><span className="section-title text-sm">Tiri Salvezza</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                    <Field label="Tempra"><input className="input w-full" type="number" value={e.fortitude} onChange={ev => set({ fortitude: n(ev.target.value) })} /></Field>
                    <Field label="Riflessi"><input className="input w-full" type="number" value={e.reflex} onChange={ev => set({ reflex: n(ev.target.value) })} /></Field>
                    <Field label="Volontà"><input className="input w-full" type="number" value={e.will} onChange={ev => set({ will: n(ev.target.value) })} /></Field>
                </div>

                {/* ── Defense ── */}
                <div className="section-header" style={{ marginTop: 8 }}><span className="section-title text-sm">Difese & Sensi</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Riduzione Danni"><input className="input w-full" value={e.damageReduction ?? ''} onChange={ev => set({ damageReduction: ev.target.value })} placeholder="es. 5/magico" /></Field>
                    <Field label="Res. Incantesimi"><input className="input w-full" type="number" value={e.spellResistance ?? 0} onChange={ev => set({ spellResistance: n(ev.target.value) || undefined })} /></Field>
                    <Field label="Resistenze"><input className="input w-full" value={e.resistances ?? ''} onChange={ev => set({ resistances: ev.target.value })} placeholder="es. fuoco 10" /></Field>
                    <Field label="Immunità"><input className="input w-full" value={e.immunities ?? ''} onChange={ev => set({ immunities: ev.target.value })} /></Field>
                    <Field label="Vulnerabilità"><input className="input w-full" value={e.weaknesses ?? ''} onChange={ev => set({ weaknesses: ev.target.value })} /></Field>
                    <Field label="Visione nel buio (m)"><input className="input w-full" type="number" value={e.darkvision ?? 0} onChange={ev => set({ darkvision: n(ev.target.value) || undefined })} /></Field>
                    <Field label="Olfatto"><input className="input w-full" type="checkbox" checked={e.scent ?? false} onChange={ev => set({ scent: ev.target.checked })} style={{ width: 'auto' }} /></Field>
                </div>

                {/* ── Actions ── */}
                <div className="section-header" style={{ marginTop: 8 }}>
                    <span className="section-title text-sm">Attacchi</span>
                    <button className="btn-secondary text-xs" onClick={addAction}><FaPlus /> Aggiungi attacco</button>
                </div>
                {(e.actions ?? []).map(a => (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 'var(--space-1)', background: 'var(--bg-surface)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                        <Field label="Nome attacco"><input className="input w-full" value={a.name} onChange={ev => updateAction({ ...a, name: ev.target.value })} /></Field>
                        <Field label="Bonus attacco"><input className="input w-full" type="number" value={a.attackBonus ?? 0} onChange={ev => updateAction({ ...a, attackBonus: Number(ev.target.value) })} /></Field>
                        <Field label="Danno (es. 1d8+3)"><input className="input w-full" value={a.damage ?? ''} onChange={ev => updateAction({ ...a, damage: ev.target.value })} /></Field>
                        <Field label="Tipo danno"><input className="input w-full" value={a.damageType ?? ''} onChange={ev => updateAction({ ...a, damageType: ev.target.value })} placeholder="taglio, fuoco…" /></Field>
                        <Field label="Critico"><input className="input w-full" value={a.criticalRange ?? '20'} onChange={ev => updateAction({ ...a, criticalRange: ev.target.value })} /></Field>
                        <Field label="Mult. critico"><input className="input w-full" value={a.criticalMultiplier ?? '×2'} onChange={ev => updateAction({ ...a, criticalMultiplier: ev.target.value })} /></Field>
                        <Field label="Gittata"><input className="input w-full" value={a.range ?? 'Mischia'} onChange={ev => updateAction({ ...a, range: ev.target.value })} /></Field>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeAction(a.id)}><FaTrash /> Rimuovi</button>
                        </div>
                    </div>
                ))}

                {/* ── Special Abilities ── */}
                <div className="section-header" style={{ marginTop: 8 }}>
                    <span className="section-title text-sm">Capacità Speciali</span>
                    <button className="btn-secondary text-xs" onClick={addAbility}><FaPlus /> Aggiungi capacità</button>
                </div>
                {(e.specialAbilities ?? []).map(a => (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr auto', gap: 'var(--space-1)', background: 'var(--bg-surface)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', alignItems: 'start' }}>
                        <Field label="Nome"><input className="input w-full" value={a.name} onChange={ev => updateAbility({ ...a, name: ev.target.value })} /></Field>
                        <Field label="Tipo">
                            <select className="input w-full" value={a.abilityType} onChange={ev => updateAbility({ ...a, abilityType: ev.target.value as 'EX' | 'SP' | 'SU' })}>
                                <option value="EX">EX</option>
                                <option value="SP">SP</option>
                                <option value="SU">SU</option>
                            </select>
                        </Field>
                        <Field label="Descrizione"><textarea className="input w-full" rows={2} value={a.description} onChange={ev => updateAbility({ ...a, description: ev.target.value })} /></Field>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeAbility(a.id)}><FaTrash /></button>
                        </div>
                    </div>
                ))}

                {/* ── Flavor ── */}
                <div className="section-header" style={{ marginTop: 8 }}><span className="section-title text-sm">Ambientazione & Note</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Habitat"><input className="input w-full" value={e.habitat ?? ''} onChange={ev => set({ habitat: ev.target.value })} /></Field>
                    <Field label="Organizzazione"><input className="input w-full" value={e.organization ?? ''} onChange={ev => set({ organization: ev.target.value })} /></Field>
                    <Field label="Tesoro"><input className="input w-full" value={e.treasureValue ?? ''} onChange={ev => set({ treasureValue: ev.target.value })} /></Field>
                    <Field label="Tag (separati da virgola)">
                        <input className="input w-full" value={(e.tags ?? []).join(', ')} onChange={ev => set({ tags: ev.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                    </Field>
                </div>
                <Field label="Descrizione">
                    <textarea className="input w-full" rows={5} value={e.description ?? ''} onChange={ev => set({ description: ev.target.value })} />
                </Field>
            </div>
        );
    }

    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                <div className="flex items-center gap-2" style={{ flex: '1 1 240px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" />
                    <input className="w-full" style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }} placeholder="Cerca creatura…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY_CREATURE())}><FaPlus /> Nuova Creatura</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">Caricamento…</div>}
                {!loading && filtered.length === 0 && <div className="text-muted text-sm">Nessuna creatura nel catalogo.</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-2)' }}>
                    {filtered.map(c => (
                        <div key={c.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12 }}>
                            {/* Thumbnail */}
                            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)', fontSize: 22 }}>
                                {c.imageData && c.imageType === 'svg'
                                    ? <span dangerouslySetInnerHTML={{ __html: c.imageData }} style={{ display: 'flex', width: '100%', height: '100%' }} />
                                    : c.imageData
                                        ? <img src={c.imageData} alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} />
                                        : <FaDragon />
                                }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                <div className="text-xs text-muted">{c.size} {c.type}{c.subtype ? ` (${c.subtype})` : ''}</div>
                                <div className="text-xs text-muted">CR {c.challengeRating ?? '?'} · CA {c.ac} · PF {c.hp}</div>
                                <div className="text-xs text-muted">BAB +{c.bab} · For {c.fortitude}/{c.reflex}/{c.will}</div>
                            </div>
                            <div className="flex gap-1">
                                <button className="btn-ghost text-xs" onClick={() => setEditing({ ...c })} title="Modifica"><FaEdit /></button>
                                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(c.id)} title="Elimina"><FaTrash /></button>
                            </div>
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
