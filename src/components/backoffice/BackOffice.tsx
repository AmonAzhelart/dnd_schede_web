import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    FaUserPlus, FaTrash, FaPlus, FaSave, FaTimes, FaSearch,
    FaScroll, FaStar, FaImage, FaEnvelope, FaCheck, FaBolt,
    FaFolder, FaFolderPlus, FaArrowLeft, FaUpload, FaDragon, FaEdit,
    FaUsers, FaShieldAlt, FaLanguage, FaSeedling, FaChevronLeft,
    FaLock, FaUnlock, FaCommentDots,
} from 'react-icons/fa';
import {
    SUPERADMIN_EMAIL, isSuperAdmin,
    listInvites, addInvite, removeInvite, updateInviteSections, type Invite,
    spellCatalog, skillCatalog, featCatalog, iconCatalog, creatureCatalog,
    type CatalogSpell, type CatalogSkill, type CatalogFeat, type CatalogIcon, type CatalogCreature,
} from '../../services/admin';
import { seedAll, type SeedReport } from '../../services/seedCatalogs';
import { refreshIconCache, ICON_SLOT_GROUPS } from '../../services/iconCache';
import type { StatType, CreatureSize, CreatureTypeCategory, CreatureAlignment, CreatureAction, CreatureSpecialAbility, Modifier, CreatureModifier } from '../../types/dnd';
import { v4 as uuid } from 'uuid';
import { ModifierEditor } from '../ModifierEditor';
import { CreatureModifierEditor } from '../CreatureModifierEditor';
import { RacesPanel } from './RacesPanel';
import { ClassesPanel } from './ClassesPanel';
import { LanguagesPanel } from './LanguagesPanel';
import { getSrdSynergiesInvolvingSkill } from '../../data/skillSynergies';
import { LocalizedFieldEditor } from './LocalizedFieldEditor';
import { pickLocalized } from '../../i18n';
import type { LocalizedField } from '../../services/admin';
import { FeedbackPanel } from './FeedbackPanel';
import { DndIcon, getDndIconSvg } from '../DndIcon';
import './BackOffice.css';

export type Section = 'invites' | 'spells' | 'skills' | 'feats' | 'icons' | 'bestiary' | 'races' | 'classes' | 'languages' | 'feedback';

/** All sections that can be assigned to an invited user. SuperAdmin sees invites too. */
export const ALL_SECTIONS: { id: Section; labelKey: string; icon: React.ReactNode; superAdminOnly?: boolean }[] = [
    { id: 'invites', labelKey: 'backoffice.tabs.invites', icon: <FaEnvelope />, superAdminOnly: true },
    { id: 'races', labelKey: 'backoffice.tabs.races', icon: <FaUsers /> },
    { id: 'classes', labelKey: 'backoffice.tabs.classes', icon: <FaShieldAlt /> },
    { id: 'languages', labelKey: 'backoffice.tabs.languages', icon: <FaLanguage /> },
    { id: 'spells', labelKey: 'backoffice.tabs.spells', icon: <FaScroll /> },
    { id: 'skills', labelKey: 'backoffice.tabs.skills', icon: <FaStar /> },
    { id: 'feats', labelKey: 'backoffice.tabs.feats', icon: <FaBolt /> },
    { id: 'icons', labelKey: 'backoffice.tabs.icons', icon: <FaImage /> },
    { id: 'bestiary', labelKey: 'backoffice.tabs.bestiary', icon: <FaDragon /> },
    { id: 'feedback', labelKey: 'backoffice.tabs.feedback', icon: <FaCommentDots />, superAdminOnly: true },
];

interface Props {
    currentUserEmail: string;
    /** Sections this user is allowed to see. Undefined = all (SuperAdmin). */
    allowedSections?: Section[];
    onBack?: () => void;
}

export function BackOffice({ currentUserEmail, allowedSections, onBack }: Props) {
    const { t } = useTranslation();
    const sa = isSuperAdmin(currentUserEmail);

    const visibleSections = ALL_SECTIONS.filter(s => {
        if (sa) return true;
        if (s.superAdminOnly) return false;
        if (!allowedSections || allowedSections.length === 0) return true;
        return allowedSections.includes(s.id);
    });

    const [section, setSection] = useState<Section>(visibleSections[0]?.id ?? 'races');
    const [seeding, setSeeding] = useState(false);
    const [seedMsg, setSeedMsg] = useState<string | null>(null);

    // keep current section valid when visibleSections changes
    useEffect(() => {
        if (!visibleSections.find(s => s.id === section)) {
            setSection(visibleSections[0]?.id ?? 'races');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowedSections]);

    async function runSeed(overwrite: boolean) {
        const label = overwrite
            ? 'Sovrascrivere TUTTE le razze, classi e lingue del catalogo con i preset di default? Le modifiche fatte a mano andranno perse.'
            : 'Popolare il catalogo Firestore con i preset di default (razze, classi, lingue)? Le voci esistenti non verranno toccate.';
        if (!confirm(label)) return;
        setSeeding(true);
        setSeedMsg(null);
        try {
            const report: SeedReport = await seedAll({ overwrite });
            setSeedMsg(
                `Seed completato: razze ${report.races.written}/${report.races.skipped} • ` +
                `classi ${report.classes.written}/${report.classes.skipped} • ` +
                `lingue ${report.languages.written}/${report.languages.skipped} • ` +
                `abilità ${report.skills.written}/${report.skills.skipped} • ` +
                `privilegi di classe ${report.feats.written}/${report.feats.skipped}.`,
            );
        } catch (e) {
            console.error('[backoffice] seed failed', e);
            setSeedMsg('Errore durante il seeding — vedi console per dettagli.');
        } finally {
            setSeeding(false);
        }
    }

    const sectionLabel = t(visibleSections.find(s => s.id === section)?.labelKey ?? '');

    return (
        <div className="bo-root">
            {/* ── Top bar ── */}
            <div className="bo-topbar">
                {onBack && (
                    <button className="btn-ghost text-sm" onClick={onBack} style={{ marginRight: 4, flexShrink: 0 }}>
                        <FaChevronLeft />
                    </button>
                )}
                <div className="bo-topbar-title">
                    <span className="text-gradient bo-brand">D&amp;D Nexus</span>
                    <span className="bo-sep">|</span>
                    <span className="bo-label">Back-Office</span>
                </div>
                <div className="bo-topbar-spacer" />
                <div className="bo-topbar-actions">
                    {sa && (
                        <>
                            <button className="btn-secondary text-xs bo-seed-btn" disabled={seeding} onClick={() => runSeed(false)} title="Aggiunge i preset mancanti">
                                <FaSeedling /> {seeding ? 'Seeding…' : 'Popola catalogo'}
                            </button>
                            <button className="btn-secondary text-xs bo-seed-btn" disabled={seeding} onClick={() => runSeed(true)} style={{ borderColor: 'var(--accent-crimson)' }} title="Sovrascrive preset (distruttivo)">
                                <FaSeedling /> Reseed
                            </button>
                        </>
                    )}
                    <span className="bo-topbar-email">{currentUserEmail}</span>
                </div>
            </div>

            {seedMsg && (
                <div className="bo-seed-msg">{seedMsg}</div>
            )}

            {/* ── Mobile horizontal tab rail ── */}
            <nav className="bo-tab-rail" aria-label="Sezioni back-office">
                {visibleSections.map(s => (
                    <button
                        key={s.id}
                        className={'bo-tab-rail-btn' + (section === s.id ? ' is-active' : '')}
                        onClick={() => setSection(s.id)}
                    >
                        {s.icon}
                        <span>{t(s.labelKey)}</span>
                    </button>
                ))}
            </nav>

            {/* ── Master-detail body ── */}
            <div className="bo-body">
                {/* ── Sidebar (desktop only) ── */}
                <nav className="bo-sidebar" aria-label="Sezioni back-office">
                    {visibleSections.map(s => (
                        <button
                            key={s.id}
                            className={'bo-sidebar-btn' + (section === s.id ? ' is-active' : '')}
                            onClick={() => setSection(s.id)}
                        >
                            <span className="bo-sidebar-ico">{s.icon}</span>
                            {t(s.labelKey)}
                        </button>
                    ))}
                </nav>

                {/* ── Content ── */}
                <div className="bo-content">
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>{sectionLabel}</h2>
                    {section === 'invites' && <InvitesPanel currentUserEmail={currentUserEmail} />}
                    {section === 'races' && <RacesPanel currentUserEmail={currentUserEmail} />}
                    {section === 'classes' && <ClassesPanel currentUserEmail={currentUserEmail} />}
                    {section === 'languages' && <LanguagesPanel currentUserEmail={currentUserEmail} />}
                    {section === 'spells' && <SpellsPanel currentUserEmail={currentUserEmail} />}
                    {section === 'skills' && <SkillsPanel currentUserEmail={currentUserEmail} />}
                    {section === 'feats' && <FeatsPanel currentUserEmail={currentUserEmail} />}
                    {section === 'icons' && <IconsPanel currentUserEmail={currentUserEmail} />}
                    {section === 'bestiary' && <BestiaryPanel currentUserEmail={currentUserEmail} />}
                    {section === 'feedback' && <FeedbackPanel />}
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────── INVITES ────────────────────────────── */

/** Sections that can be granted to invited users (excludes superAdminOnly). */
const GRANTABLE_SECTIONS = ALL_SECTIONS.filter(s => !s.superAdminOnly);

function InvitesPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const { t } = useTranslation();
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');
    const [newSections, setNewSections] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    /** invite being edited for section changes */
    const [editingSections, setEditingSections] = useState<string | null>(null);
    const [editSectionDraft, setEditSectionDraft] = useState<string[]>([]);

    const refresh = async () => {
        setLoading(true);
        setInvites(await listInvites());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const toggleNewSection = (id: string) =>
        setNewSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Email non valida.'); return; }
        setBusy(true);
        try {
            await addInvite(trimmed, currentUserEmail, note.trim() || undefined, newSections);
            setEmail(''); setNote(''); setNewSections([]);
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

    const startEditSections = (inv: Invite) => {
        setEditingSections(inv.email);
        setEditSectionDraft(inv.sections ?? []);
    };

    const saveSections = async () => {
        if (!editingSections) return;
        await updateInviteSections(editingSections, editSectionDraft);
        setEditingSections(null);
        await refresh();
    };

    return (
        <div className="flex-col gap-4">
            {/* ── New invite form ── */}
            <div className="glass-panel">
                <div className="section-header"><span className="section-title">Nuovo Invito</span></div>
                <form onSubmit={submit} className="flex-col gap-3">
                    <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
                    </div>

                    {/* Section permissions */}
                    <div>
                        <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 6 }}>
                            Accesso sezioni BackOffice&nbsp;
                            <span style={{ color: 'var(--text-secondary)' }}>(nessuna selezione = accesso completo al catalogo)</span>
                        </label>
                        <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {GRANTABLE_SECTIONS.map(s => {
                                const on = newSections.includes(s.id);
                                return (
                                    <button key={s.id} type="button" onClick={() => toggleNewSection(s.id)} style={{
                                        display: 'flex', alignItems: 'center', gap: 5,
                                        padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                                        border: `1px solid ${on ? 'var(--accent-gold)' : 'rgba(255,255,255,0.12)'}`,
                                        background: on ? 'rgba(201,168,76,0.15)' : 'transparent',
                                        color: on ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                    }}>
                                        {s.icon} {t(s.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </form>
                {error && <div className="text-xs" style={{ color: 'var(--accent-crimson)', marginTop: 8 }}>{error}</div>}
            </div>

            {/* ── User list ── */}
            <div className="glass-panel">
                <div className="section-header">
                    <span className="section-title">Utenti Autorizzati ({invites.length + 1})</span>
                </div>
                <div className="flex-col gap-2">
                    {/* SuperAdmin row */}
                    <div className="flex items-center gap-2" style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
                        <FaCheck style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>{SUPERADMIN_EMAIL}</div>
                            <div className="text-xs text-muted">SuperAdmin — accesso totale</div>
                        </div>
                        <FaUnlock style={{ color: 'var(--accent-gold)', opacity: 0.6, flexShrink: 0 }} />
                    </div>

                    {loading && <div className="text-muted text-sm">Caricamento…</div>}
                    {!loading && invites.length === 0 && <div className="text-muted text-sm">Nessun invito al momento.</div>}

                    {invites.map(inv => (
                        <div key={inv.email} className="flex-col gap-2" style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {editingSections === inv.email ? (
                                <div className="flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <FaEnvelope className="text-muted" style={{ flexShrink: 0 }} />
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
                                        <button className="btn-primary text-xs" onClick={saveSections}><FaSave /> Salva</button>
                                        <button className="btn-ghost text-xs" onClick={() => setEditingSections(null)}><FaTimes /></button>
                                    </div>
                                    <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>
                                        {GRANTABLE_SECTIONS.map(s => {
                                            const on = editSectionDraft.includes(s.id);
                                            return (
                                                <button key={s.id} type="button"
                                                    onClick={() => setEditSectionDraft(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                        padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                                                        border: `1px solid ${on ? 'var(--accent-gold)' : 'rgba(255,255,255,0.12)'}`,
                                                        background: on ? 'rgba(201,168,76,0.15)' : 'transparent',
                                                        color: on ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                    }}>
                                                    {s.icon} {t(s.labelKey)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="text-xs text-muted">Nessuna selezione = accesso completo al catalogo</div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <FaEnvelope className="text-muted" style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                                        <div className="flex" style={{ flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {(!inv.sections || inv.sections.length === 0) ? (
                                                <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <FaUnlock style={{ opacity: 0.5 }} /> Catalogo completo
                                                </span>
                                            ) : inv.sections.map(sid => {
                                                const sec = GRANTABLE_SECTIONS.find(s => s.id === sid);
                                                if (!sec) return null;
                                                return (
                                                    <span key={sid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', padding: '2px 7px', borderRadius: 10, background: 'rgba(201,168,76,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(201,168,76,0.2)' }}>
                                                        {sec.icon} {t(sec.labelKey)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        {inv.note && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{inv.note}</div>}
                                    </div>
                                    <button className="btn-ghost text-xs" onClick={() => startEditSections(inv)} title="Modifica accessi">
                                        <FaLock />
                                    </button>
                                    <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => handleRemove(inv.email)} title="Revoca">
                                        <FaTrash />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ────────────────────────────── SPELLS ────────────────────────────── */

const SPELL_SCHOOLS = [
    'Abiurazione', 'Ammaliamento', 'Divinazione', 'Evocazione',
    'Illusione', 'Invocazione', 'Necromanzia', 'Trasmutazione',
] as const;

const SP_SCHOOL_COLOR: Record<string, string> = {
    'Evocazione':    'var(--accent-crimson)',
    'Invocazione':   'var(--accent-gold)',
    'Abiurazione':   'var(--accent-ice)',
    'Ammaliamento':  'var(--accent-arcane)',
    'Divinazione':   'var(--accent-success)',
    'Illusione':     '#a29bfe',
    'Necromanzia':   '#636e72',
    'Trasmutazione': '#fdcb6e',
};

const SP_SCHOOL_SLUG: Record<string, string> = {
    'Abiurazione':   'abjuration',
    'Ammaliamento':  'enchantment',
    'Divinazione':   'divination',
    'Evocazione':    'conjuration',
    'Illusione':     'illusion',
    'Invocazione':   'evocation',
    'Necromanzia':   'necromancy',
    'Trasmutazione': 'transmutation',
};

function SpellSchoolIcon({ school, color, size = 14 }: { school: string; color: string; size?: number }) {
    const slug = SP_SCHOOL_SLUG[school];
    if (slug && getDndIconSvg('spell', slug)) {
        return <DndIcon category="spell" name={slug} size={size} style={{ color, flexShrink: 0 }} />;
    }
    return null;
}

const EMPTY_SPELL = (): CatalogSpell => ({
    id: uuid(), name: '', level: 0, school: 'Invocazione', spellType: '', description: '',
    castingTime: '', range: '', duration: '', savingThrow: '', components: '',
    attackMode: 'none', baseDice: '', damageType: '', saveStat: 'int',
    upcastDice: '', upcastEveryLevels: 1, upcastMaxSteps: undefined,
    upcastDuration: '', upcastDurationEveryLevels: 1,
});

function SpellsPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogSpell[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogSpell | null>(null);
    const [search, setSearch] = useState('');
    const [activeSchool, setActiveSchool] = useState<string>('all');
    const [activeLevel, setActiveLevel] = useState<number | 'all'>('all');

    const refresh = async () => {
        setLoading(true);
        setItems(await spellCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    // Schools present in the catalog, in canonical order
    const presentSchools = useMemo(() =>
        SPELL_SCHOOLS.filter(s => items.some(i => i.school === s)),
    [items]);

    // Levels present in the active school
    const levelsInSchool = useMemo(() => {
        const source = activeSchool === 'all' ? items : items.filter(i => i.school === activeSchool);
        return [...new Set(source.map(i => i.level))].sort((a, b) => a - b);
    }, [items, activeSchool]);

    // Switch school → reset level tab
    const handleSchoolTab = (school: string) => {
        setActiveSchool(school);
        setActiveLevel('all');
        setSearch('');
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(i => {
            const matchSchool = activeSchool === 'all' || i.school === activeSchool;
            const matchLevel = activeLevel === 'all' || i.level === activeLevel;
            const matchSearch = !q || i.name.toLowerCase().includes(q);
            return matchSchool && matchLevel && matchSearch;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [items, activeSchool, activeLevel, search]);

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

    /* ── EDIT VIEW ── */
    if (editing) {
        const schoolColor = SP_SCHOOL_COLOR[editing.school] ?? 'var(--accent-gold)';
        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <div className="flex items-center gap-2">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: schoolColor, display: 'inline-block', flexShrink: 0 }} />
                        <span className="section-title">{items.find(i => i.id === editing.id) ? 'Modifica' : 'Nuova'} Magia</span>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> Annulla</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> Salva</button>
                    </div>
                </div>

                {/* Identity */}
                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 'var(--space-2)' }}>
                    <Field label="Nome">
                        <input className="input w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                    </Field>
                    <Field label="Scuola">
                        <select className="input w-full" value={editing.school}
                            style={{ borderColor: SP_SCHOOL_COLOR[editing.school] ?? undefined }}
                            onChange={e => setEditing({ ...editing, school: e.target.value })}>
                            {SPELL_SCHOOLS.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Tipo / Descrittore">
                        <input className="input w-full" value={editing.spellType ?? ''}
                            onChange={e => setEditing({ ...editing, spellType: e.target.value })}
                            placeholder="Es. Guarigione, Offensivo, Controllo…" />
                    </Field>
                    <Field label="Livello">
                        <select className="input w-full" value={editing.level}
                            onChange={e => setEditing({ ...editing, level: Number(e.target.value) })}>
                            <option value={0}>0 — Trucchetto</option>
                            {[1,2,3,4,5,6,7,8,9].map(l => (
                                <option key={l} value={l}>{l}° livello</option>
                            ))}
                        </select>
                    </Field>
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
                    <Field label="Liv. slot/step (danno)">
                        <input className="input w-full" type="number" min={1} value={editing.upcastEveryLevels ?? 1}
                            onChange={e => setEditing({ ...editing, upcastEveryLevels: Math.max(1, Number(e.target.value) || 1) })}
                            title="Livelli di slot sopra il livello base per +1 step" />
                    </Field>
                    <Field label="Max step">
                        <input className="input w-full" type="number" min={1} value={editing.upcastMaxSteps ?? ''}
                            onChange={e => setEditing({ ...editing, upcastMaxSteps: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })}
                            placeholder="—" />
                    </Field>
                    <Field label="Durata extra/step (es. 1 minuto)">
                        <input className="input w-full" value={editing.upcastDuration ?? ''}
                            onChange={e => setEditing({ ...editing, upcastDuration: e.target.value })} placeholder="vuoto = nessuna" />
                    </Field>
                    <Field label="Liv. slot/step (durata)">
                        <input className="input w-full" type="number" min={1} value={editing.upcastDurationEveryLevels ?? 1}
                            onChange={e => setEditing({ ...editing, upcastDurationEveryLevels: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                </div>

                <Field label="Tag (separati da virgola)">
                    <input className="input w-full" value={(editing.tags ?? []).join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </Field>
            </div>
        );
    }

    /* ── LIST VIEW ── */
    const activeColor = activeSchool === 'all' ? 'var(--accent-gold)' : (SP_SCHOOL_COLOR[activeSchool] ?? 'var(--accent-gold)');

    return (
        <div className="flex-col gap-0" style={{ height: '100%' }}>

            {/* ── School tab rail ── */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 4,
                padding: '0 0 12px 0',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
                {/* "Tutti" tab */}
                <button
                    onClick={() => handleSchoolTab('all')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${activeSchool === 'all' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)'}`,
                        background: activeSchool === 'all' ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                        color: activeSchool === 'all' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        fontWeight: activeSchool === 'all' ? 700 : 400,
                        fontSize: '0.8rem', transition: 'all 0.15s',
                    }}>
                    ✦
                    <span>Tutti</span>
                    <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        background: activeSchool === 'all' ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.08)',
                        padding: '1px 6px', borderRadius: 20,
                    }}>{items.length}</span>
                </button>

                {/* One tab per school */}
                {presentSchools.map(school => {
                    const color = SP_SCHOOL_COLOR[school] ?? 'var(--accent-gold)';
                    const isActive = activeSchool === school;
                    const count = items.filter(i => i.school === school).length;
                    return (
                        <button key={school}
                            onClick={() => handleSchoolTab(school)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
                                border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                                background: isActive ? `${color}20` : 'rgba(255,255,255,0.03)',
                                color: isActive ? color : 'var(--text-secondary)',
                                fontWeight: isActive ? 700 : 400,
                                fontSize: '0.8rem', transition: 'all 0.15s',
                            }}>
                            <SpellSchoolIcon school={school} color={isActive ? color : 'var(--text-secondary)'} size={13} />
                            <span>{school}</span>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 700,
                                background: isActive ? `${color}28` : 'rgba(255,255,255,0.08)',
                                padding: '1px 6px', borderRadius: 20,
                            }}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Level sub-tabs (only when a school is selected) ── */}
            {activeSchool !== 'all' && levelsInSchool.length > 0 && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 4,
                    padding: '10px 0 10px 0',
                    borderBottom: `1px solid ${activeColor}20`,
                }}>
                    <button
                        onClick={() => setActiveLevel('all')}
                        style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                            border: `1px solid ${activeLevel === 'all' ? activeColor : 'rgba(255,255,255,0.1)'}`,
                            background: activeLevel === 'all' ? `${activeColor}20` : 'transparent',
                            color: activeLevel === 'all' ? activeColor : 'var(--text-secondary)',
                            fontWeight: activeLevel === 'all' ? 700 : 400,
                            transition: 'all 0.15s',
                        }}>
                        Tutti i livelli
                    </button>
                    {levelsInSchool.map(level => {
                        const isActive = activeLevel === level;
                        const count = items.filter(i => i.school === activeSchool && i.level === level).length;
                        return (
                            <button key={level}
                                onClick={() => setActiveLevel(isActive ? 'all' : level)}
                                style={{
                                    padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                                    border: `1px solid ${isActive ? activeColor : 'rgba(255,255,255,0.1)'}`,
                                    background: isActive ? `${activeColor}20` : 'transparent',
                                    color: isActive ? activeColor : 'var(--text-secondary)',
                                    fontWeight: isActive ? 700 : 400,
                                    transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                {level === 0 ? 'Trucchetto' : `Lv ${level}`}
                                <span style={{
                                    fontSize: '0.65rem',
                                    background: isActive ? `${activeColor}28` : 'rgba(255,255,255,0.08)',
                                    padding: '0 5px', borderRadius: 20, fontWeight: 700,
                                }}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Toolbar ── */}
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap', padding: '12px 0 8px 0' }}>
                <div className="flex items-center gap-2" style={{ flex: '1 1 200px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" style={{ flexShrink: 0 }} />
                    <input className="w-full" style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }}
                        placeholder="Cerca magia…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {filtered.length} / {items.length}
                </span>
                <button className="btn-primary text-sm" style={{ marginLeft: 'auto' }} onClick={() => setEditing(EMPTY_SPELL())}><FaPlus /> Nuova Magia</button>
            </div>

            {/* ── Spell list ── */}
            {loading && <div className="text-muted text-sm">Caricamento…</div>}
            {!loading && filtered.length === 0 && <div className="text-muted text-sm">Nessuna magia trovata.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
                {filtered.map(s => {
                    const color = SP_SCHOOL_COLOR[s.school] ?? 'var(--accent-gold)';
                    return (
                        <div key={s.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${color}20`,
                            transition: 'background 0.12s',
                        }}>
                            <SpellSchoolIcon school={s.school} color={color} size={15} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                    {s.name}
                                    <span style={{
                                        fontSize: '0.65rem', color, background: `${color}18`,
                                        border: `1px solid ${color}30`,
                                        padding: '1px 7px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap',
                                    }}>
                                        {s.level === 0 ? 'Trucchetto' : `Lv ${s.level}`}
                                    </span>
                                    {s.spellType?.trim() && (
                                        <span style={{
                                            fontSize: '0.63rem', color: '#c9aa5f', background: 'rgba(180,140,60,0.13)',
                                            border: '1px solid rgba(180,140,60,0.3)',
                                            padding: '1px 6px', borderRadius: 20, whiteSpace: 'nowrap',
                                        }}>
                                            {s.spellType}
                                        </span>
                                    )}
                                    {activeSchool === 'all' && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {s.school}
                                        </span>
                                    )}
                                </div>
                                {s.description && (
                                    <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                                        {s.description}
                                    </div>
                                )}
                            </div>
                            {s.castingTime && (
                                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    ⏱ {s.castingTime}
                                </span>
                            )}
                            <button className="btn-ghost text-xs" style={{ flexShrink: 0 }} onClick={() => setEditing(s)}>
                                <FaEdit />
                            </button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)', flexShrink: 0 }} onClick={() => remove(s.id)}>
                                <FaTrash />
                            </button>
                        </div>
                    );
                })}
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
    const { t, i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';
    const [items, setItems] = useState<CatalogSkill[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogSkill | null>(null);
    const [search, setSearch] = useState('');

    // ── Custom synergy sub-editor state ───────────────────────────────────────
    const [showAddSyn, setShowAddSyn] = useState(false);
    const [addSynForm, setAddSynForm] = useState({ sourceSkillName: '', targetSkillName: '', ranksRequired: 5, bonus: 2, note: '' });
    const [editingSynId, setEditingSynId] = useState<string | null>(null);
    const [editSynForm, setEditSynForm] = useState({ sourceSkillName: '', targetSkillName: '', ranksRequired: 5, bonus: 2, note: '' });

    const refresh = async () => {
        setLoading(true);
        setItems(await skillCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(i => {
            const displayName = pickLocalized(i.localizedName, lang) || i.name;
            const displayDesc = pickLocalized(i.localizedDescription, lang) || i.description || '';
            return displayName.toLowerCase().includes(q) || displayDesc.toLowerCase().includes(q);
        });
    }, [items, search, lang]);

    // When switching to a different skill to edit, reset synergy sub-editor.
    // If the skill has no synergies stored yet, pre-populate from SRD.
    const openEdit = (s: CatalogSkill) => {
        setShowAddSyn(false);
        setEditingSynId(null);
        setAddSynForm({ sourceSkillName: '', targetSkillName: '', ranksRequired: 5, bonus: 2, note: '' });
        // Only keep synergies where this skill is the source.
        const synergies: CatalogSkill['synergies'] = s.synergies
            ? s.synergies.filter(syn => syn.sourceSkillName === s.name)
            : getSrdSynergiesInvolvingSkill(s.name)
                .filter(r => r.sourceSkillName === s.name)
                .map(r => ({ id: uuid(), sourceSkillName: r.sourceSkillName, targetSkillName: r.targetSkillName, ranksRequired: r.ranksRequired, bonus: r.bonus, note: r.note }));
        setEditing({ ...s, synergies });
    };

    const save = async () => {
        if (!editing || !editing.name.trim()) return;
        await skillCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm(t('backoffice.skills.confirmDelete'))) return;
        await skillCatalog.remove(id);
        await refresh();
    };

    // ── Synergy helpers (operate on `editing` draft) ──────────────────────────
    const addSynergy = () => {
        if (!editing || !addSynForm.targetSkillName) return;
        if (addSynForm.targetSkillName === editing.name) return;
        const newSyn = { id: uuid(), sourceSkillName: editing.name, targetSkillName: addSynForm.targetSkillName, ranksRequired: addSynForm.ranksRequired, bonus: addSynForm.bonus, note: addSynForm.note.trim() || undefined };
        setEditing({ ...editing, synergies: [...(editing.synergies ?? []), newSyn] });
        setShowAddSyn(false);
        setAddSynForm({ sourceSkillName: '', targetSkillName: '', ranksRequired: 5, bonus: 2, note: '' });
    };

    const startEditSyn = (syn: import('../../services/admin').CatalogSkillSynergy) => {
        setEditingSynId(syn.id);
        setEditSynForm({ sourceSkillName: syn.sourceSkillName, targetSkillName: syn.targetSkillName, ranksRequired: syn.ranksRequired, bonus: syn.bonus, note: syn.note ?? '' });
    };

    const saveEditSyn = () => {
        if (!editing || !editingSynId || !editSynForm.targetSkillName || editSynForm.targetSkillName === editing.name) return;
        const updated = (editing.synergies ?? []).map(s =>
            s.id === editingSynId
                ? { ...s, sourceSkillName: editing.name, targetSkillName: editSynForm.targetSkillName, ranksRequired: editSynForm.ranksRequired, bonus: editSynForm.bonus, note: editSynForm.note.trim() || undefined }
                : s,
        );
        setEditing({ ...editing, synergies: updated });
        setEditingSynId(null);
    };

    const deleteSyn = (synId: string) => {
        if (!editing) return;
        setEditing({ ...editing, synergies: (editing.synergies ?? []).filter(s => s.id !== synId) });
        if (editingSynId === synId) setEditingSynId(null);
    };

    // All catalog skill names sorted (for select options)
    const skillNameOptions = [...items].sort((a, b) => a.name.localeCompare(b.name)).map(s => s.name);
    // Also include the current skill being edited if it's new (has a name but not yet in items)
    const allSkillNames = editing?.name && !skillNameOptions.includes(editing.name)
        ? [...skillNameOptions, editing.name].sort((a, b) => a.localeCompare(b))
        : skillNameOptions;

    if (editing) {
        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">
                        {items.find(i => i.id === editing.id) ? t('backoffice.skills.editSkill') : t('backoffice.skills.newSkill')}
                    </span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> {t('common.cancel')}</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> {t('common.save')}</button>
                    </div>
                </div>

                {/* ── Core fields ── */}
                <Field label={t('common.name') + ' (canonico / chiave sinergie)'}>
                    <input className="input w-full" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Es. Diplomazia (usato come chiave interna)" />
                </Field>
                <LocalizedFieldEditor
                    label={t('common.name') + ' (traduzioni)'}
                    value={editing.localizedName}
                    onChange={v => setEditing({ ...editing, localizedName: v as LocalizedField })}
                    placeholder="Nome visivo per ogni lingua"
                />
                <Field label={t('backoffice.skills.ability')}>
                    <select className="input w-full" value={editing.stat} onChange={e => setEditing({ ...editing, stat: e.target.value as StatType })}>
                        {STAT_OPTIONS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.canUseUntrained} onChange={e => setEditing({ ...editing, canUseUntrained: e.target.checked })} />
                    {t('backoffice.skills.canUseUntrained')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.armorCheckPenalty} onChange={e => setEditing({ ...editing, armorCheckPenalty: e.target.checked })} />
                    {t('backoffice.skills.armorCheckPenalty')}
                </label>
                <LocalizedFieldEditor
                    label={t('common.description') + ' (' + t('backoffice.skills.optional') + ')'}
                    value={editing.localizedDescription}
                    onChange={v => setEditing({ ...editing, localizedDescription: v as LocalizedField })}
                    multiline
                    placeholder={t('backoffice.skills.descriptionHint')}
                />

                {/* ── Synergies (unified editable list) ── */}
                <div className="flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="text-xs text-muted" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {t('backoffice.skills.synergies')}
                        </div>
                        {!showAddSyn && (
                            <button className="btn-ghost text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setShowAddSyn(true)}>
                                <FaPlus size={9} /> {t('backoffice.skills.newSynergy', { defaultValue: 'Nuova' })}
                            </button>
                        )}
                    </div>

                    {/* Existing custom synergies */}
                    {(editing.synergies ?? []).length === 0 && !showAddSyn && (
                        <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                            {t('backoffice.skills.noCustomSynergies', { defaultValue: 'Nessuna sinergia.' })}
                        </div>
                    )}
                    <div className="flex-col gap-1">
                        {(editing.synergies ?? []).map(syn => {
                            if (editingSynId === syn.id) {
                                return (
                                    <div key={syn.id} className="flex-col gap-2" style={{ padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                            <div className="flex-col gap-1" style={{ gridColumn: '1 / -1' }}>
                                                <span className="text-xs text-muted">{t('backoffice.skills.synTarget', { defaultValue: 'Destinatario (riceve il bonus)' })}</span>
                                                <select className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} value={editSynForm.targetSkillName} onChange={e => setEditSynForm({ ...editSynForm, targetSkillName: e.target.value })}>
                                                    <option value="">— seleziona —</option>
                                                    {allSkillNames.filter(n => n !== editing.name).map(n => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-col gap-1">
                                                <span className="text-xs text-muted">{t('backoffice.skills.synRanks', { defaultValue: 'Gradi richiesti' })}</span>
                                                <input type="number" className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} min={1} max={20} value={editSynForm.ranksRequired} onChange={e => setEditSynForm({ ...editSynForm, ranksRequired: Math.max(1, +e.target.value) })} />
                                            </div>
                                            <div className="flex-col gap-1">
                                                <span className="text-xs text-muted">{t('backoffice.skills.synBonus', { defaultValue: 'Bonus' })}</span>
                                                <input type="number" className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} min={1} max={10} value={editSynForm.bonus} onChange={e => setEditSynForm({ ...editSynForm, bonus: Math.max(1, +e.target.value) })} />
                                            </div>
                                            <div className="flex-col gap-1" style={{ gridColumn: '1 / -1' }}>
                                                <span className="text-xs text-muted">{t('backoffice.skills.synNote', { defaultValue: 'Nota (opzionale)' })}</span>
                                                <input type="text" className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} value={editSynForm.note} onChange={e => setEditSynForm({ ...editSynForm, note: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="btn-primary text-xs" onClick={saveEditSyn} disabled={!editSynForm.targetSkillName || editSynForm.targetSkillName === editing.name}>
                                                <FaCheck size={9} /> {t('common.save')}
                                            </button>
                                            <button className="btn-secondary text-xs" onClick={() => setEditingSynId(null)}>
                                                <FaTimes size={9} /> {t('common.cancel')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={syn.id} className="flex items-center gap-2 text-xs" style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
                                    <span className="text-muted">→</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{syn.targetSkillName}</span>
                                    <span className="text-muted" style={{ marginLeft: 4 }}>≥{syn.ranksRequired} gr.</span>
                                    <span style={{ color: '#4ecdc4', fontWeight: 700 }}>+{syn.bonus}</span>
                                    {syn.note && <span className="text-muted" title={syn.note}>ℹ</span>}
                                    <div className="flex gap-1" style={{ marginLeft: 'auto' }}>
                                        <button className="btn-ghost text-xs" onClick={() => startEditSyn(syn)} title={t('common.edit')}><FaEdit size={9} /></button>
                                        <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => deleteSyn(syn.id)} title={t('common.delete', { defaultValue: 'Elimina' })}><FaTrash size={9} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add synergy form */}
                    {showAddSyn && (
                        <div className="flex-col gap-2" style={{ padding: 8, borderRadius: 6, border: '1px dashed rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.04)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <div className="flex-col gap-1" style={{ gridColumn: '1 / -1' }}>
                                    <span className="text-xs text-muted">{t('backoffice.skills.synTarget', { defaultValue: 'Destinatario (riceve il bonus)' })}</span>
                                    <select className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} value={addSynForm.targetSkillName} onChange={e => setAddSynForm({ ...addSynForm, targetSkillName: e.target.value })}>
                                        <option value="">— seleziona —</option>
                                        {allSkillNames.filter(n => n !== editing.name).map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div className="flex-col gap-1">
                                    <span className="text-xs text-muted">{t('backoffice.skills.synRanks', { defaultValue: 'Gradi richiesti' })}</span>
                                    <input type="number" className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} min={1} max={20} value={addSynForm.ranksRequired} onChange={e => setAddSynForm({ ...addSynForm, ranksRequired: Math.max(1, +e.target.value) })} />
                                </div>
                                <div className="flex-col gap-1">
                                    <span className="text-xs text-muted">{t('backoffice.skills.synBonus', { defaultValue: 'Bonus' })}</span>
                                    <input type="number" className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} min={1} max={10} value={addSynForm.bonus} onChange={e => setAddSynForm({ ...addSynForm, bonus: Math.max(1, +e.target.value) })} />
                                </div>
                                <div className="flex-col gap-1" style={{ gridColumn: '1 / -1' }}>
                                    <span className="text-xs text-muted">{t('backoffice.skills.synNote', { defaultValue: 'Nota (opzionale)' })}</span>
                                    <input type="text" className="input" style={{ fontSize: '0.75rem', padding: '3px 6px' }} placeholder="es. Solo con creature acquatiche" value={addSynForm.note} onChange={e => setAddSynForm({ ...addSynForm, note: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn-primary text-xs" onClick={addSynergy} disabled={!addSynForm.targetSkillName || addSynForm.targetSkillName === editing.name}>
                                    <FaCheck size={9} /> {t('backoffice.skills.newSynergy', { defaultValue: 'Aggiungi' })}
                                </button>
                                <button className="btn-secondary text-xs" onClick={() => { setShowAddSyn(false); setAddSynForm({ sourceSkillName: '', targetSkillName: '', ranksRequired: 5, bonus: 2, note: '' }); }}>
                                    <FaTimes size={9} /> {t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center">
                <div style={{ position: 'relative', flex: 1 }}>
                    <FaSearch style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} size={11} />
                    <input
                        className="input w-full"
                        style={{ paddingLeft: '1.75rem' }}
                        placeholder={t('common.search')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="btn-primary text-sm" onClick={() => openEdit(EMPTY_SKILL())}>
                    <FaPlus /> {t('backoffice.skills.newSkill')}
                </button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">{t('common.loading')}</div>}
                {!loading && filtered.length === 0 && <div className="text-muted text-sm">{t('backoffice.skills.empty')}</div>}
                <div className="flex-col gap-1">
                    {filtered.map(s => {
                        const hasSyn = (s.synergies ?? []).length > 0;
                        const displayName = pickLocalized(s.localizedName, lang) || s.name;
                        const displayDesc = pickLocalized(s.localizedDescription, lang) || s.description;
                        return (
                            <div key={s.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontFamily: 'var(--font-heading)' }}>{displayName}</span>
                                    <span className="text-xs text-muted"> — {s.stat.toUpperCase()}</span>
                                    {s.armorCheckPenalty && <span className="text-xs text-muted"> · ACP</span>}
                                    {s.canUseUntrained && <span className="text-xs text-muted"> · ∅</span>}
                                    {hasSyn && (
                                        <span className="text-xs" style={{ marginLeft: 6, color: '#4ecdc4', opacity: 0.9 }} title={(s.synergies ?? []).map(sy => `${sy.sourceSkillName} → ${sy.targetSkillName} (+${sy.bonus})`).join('; ')}>
                                            ⇗ {(s.synergies ?? []).length}
                                        </span>
                                    )}
                                    {displayDesc && (
                                        <div className="text-xs text-muted" style={{ marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40ch' }}>
                                            {displayDesc}
                                        </div>
                                    )}
                                </div>
                                <button className="btn-ghost text-xs" onClick={() => openEdit(s)}>{t('common.edit')}</button>
                                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(s.id)}><FaTrash /></button>
                            </div>
                        );
                    })}
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
    id: uuid(), name: '', description: '', modifiers: [], creatureModifiers: [],
    subcategory: 'passive', resourceName: '', resourceMax: undefined,
});

function FeatsPanel({ currentUserEmail }: { currentUserEmail: string }) {
    const [items, setItems] = useState<CatalogFeat[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogFeat | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'active' | 'passive'>('active');

    const refresh = async () => {
        setLoading(true);
        setItems(await featCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items
            .filter(i => (i.subcategory ?? 'passive') === activeTab)
            .filter(i => !q ||
                i.name.toLowerCase().includes(q) ||
                (i.description ?? '').toLowerCase().includes(q) ||
                (i.tags ?? []).some(t => t.toLowerCase().includes(q)),
            );
    }, [items, search, activeTab]);

    const save = async () => {
        if (!editing || !editing.name.trim()) return;
        await featCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm('Eliminare questo privilegio di classe?')) return;
        await featCatalog.remove(id);
        await refresh();
    };

    /* ── EDIT FORM ── */
    if (editing) {
        const isActive = (editing.subcategory ?? 'passive') === 'active';
        const accent = isActive ? 'var(--accent-warning)' : 'var(--accent-success)';
        const isNew = !items.find(i => i.id === editing.id);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* ── Sticky header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: `linear-gradient(90deg, ${accent}18 0%, transparent 100%)`,
                    border: `1px solid ${accent}30`,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 16,
                    gap: 10,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: `${accent}20`, border: `1px solid ${accent}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: accent,
                        }}>
                            {isActive ? <FaBolt size={14} /> : <FaStar size={14} />}
                        </div>
                        <div>
                            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: accent }}>
                                {isNew ? 'Nuovo Privilegio di Classe' : editing.name || 'Modifica Privilegio'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {isActive ? 'Capacità Attiva' : 'Capacità Passiva'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>
                            <FaTimes /> Annulla
                        </button>
                        <button
                            className="btn-primary text-sm"
                            onClick={save}
                            disabled={!editing.name.trim()}
                            style={{ opacity: editing.name.trim() ? 1 : 0.5 }}
                        >
                            <FaSave /> Salva
                        </button>
                    </div>
                </div>

                {/* ── Identity section ── */}
                <div className="glass-panel" style={{ marginBottom: 12 }}>
                    <div style={{
                        fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.1em',
                        textTransform: 'uppercase', marginBottom: 12,
                        paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontFamily: 'var(--font-heading)',
                    }}>
                        Identità
                    </div>

                    {/* Name */}
                    <Field label="Nome *">
                        <input
                            className="input w-full"
                            value={editing.name}
                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                            placeholder="Es. Cura Bonus, Furia, Attacco Furtivo…"
                            style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)' }}
                            autoFocus
                        />
                    </Field>

                    {/* Type toggle */}
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                            Tipo
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['passive', 'active'] as const).map(s => {
                                const on = (editing.subcategory ?? 'passive') === s;
                                const color = s === 'active' ? 'var(--accent-warning)' : 'var(--accent-success)';
                                const Icon = s === 'active' ? FaBolt : FaStar;
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setEditing({ ...editing, subcategory: s })}
                                        style={{
                                            flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                            border: `1px solid ${on ? color + '66' : 'rgba(255,255,255,0.1)'}`,
                                            background: on ? `linear-gradient(135deg,${color}22,${color}10)` : 'rgba(255,255,255,0.03)',
                                            color: on ? color : 'var(--text-muted)',
                                            fontFamily: 'var(--font-heading)', fontSize: '0.82rem',
                                            transition: 'all 150ms',
                                        }}
                                    >
                                        <Icon size={11} />
                                        {s === 'active' ? 'Capacità Attiva' : 'Capacità Passiva'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginTop: 12 }}>
                        <Field label="Descrizione">
                            <textarea
                                className="input w-full"
                                rows={4}
                                value={editing.description}
                                onChange={e => setEditing({ ...editing, description: e.target.value })}
                                placeholder="Descrivi l'effetto narrativo e meccanico di questo privilegio…"
                                style={{ resize: 'vertical', lineHeight: 1.6 }}
                            />
                        </Field>
                    </div>

                    {/* Active resource (only for active feats) */}
                    {isActive && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                                Risorsa (opzionale)
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    className="input"
                                    style={{ flex: 1 }}
                                    placeholder="Nome risorsa (es. Incanalare Divinità, Furia)"
                                    value={editing.resourceName ?? ''}
                                    onChange={e => setEditing({ ...editing, resourceName: e.target.value })}
                                />
                                <input
                                    type="number"
                                    className="input"
                                    style={{ width: 100 }}
                                    placeholder="Usi max"
                                    min={1}
                                    value={editing.resourceMax ?? ''}
                                    onChange={e => setEditing({ ...editing, resourceMax: e.target.value ? Number(e.target.value) : undefined })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    <div style={{ marginTop: 12 }}>
                        <Field label="Tag (separati da virgola)">
                            <input
                                className="input w-full"
                                value={(editing.tags ?? []).join(', ')}
                                onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                placeholder="es. combattimento, magia, guarigione…"
                            />
                        </Field>
                        {(editing.tags ?? []).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                {(editing.tags ?? []).map(tag => (
                                    <span key={tag} style={{
                                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                                        background: `${accent}18`, border: `1px solid ${accent}33`,
                                        color: accent,
                                    }}>{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Modifiers section ── */}
                <div className="glass-panel" style={{ marginBottom: 12 }}>
                    <ModifierEditor
                        modifiers={editing.modifiers ?? []}
                        onChange={mods => setEditing({ ...editing, modifiers: mods as Modifier[] })}
                        accentColor={accent}
                        title="Modificatori al Personaggio"
                    />
                </div>

                {/* ── Creature modifiers section ── */}
                <div className="glass-panel">
                    <CreatureModifierEditor
                        modifiers={(editing.creatureModifiers ?? []) as CreatureModifier[]}
                        onChange={cms => setEditing({ ...editing, creatureModifiers: cms })}
                        accentColor="var(--accent-gold)"
                    />
                </div>
            </div>
        );
    }

    /* ── LIST VIEW ── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', gap: 6 }}>
                {(['active', 'passive'] as const).map(s => {
                    const on = activeTab === s;
                    const color = s === 'active' ? 'var(--accent-warning)' : 'var(--accent-success)';
                    const label = s === 'active' ? 'Capacità Attive' : 'Capacità Passive';
                    const Icon = s === 'active' ? FaBolt : FaStar;
                    const cnt = items.filter(i => (i.subcategory ?? 'passive') === s).length;
                    return (
                        <button
                            key={s}
                            onClick={() => setActiveTab(s)}
                            style={{
                                flex: 1, padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                                fontFamily: 'var(--font-heading)', fontSize: '0.82rem',
                                border: `1px solid ${on ? color + '55' : 'rgba(255,255,255,0.07)'}`,
                                background: on
                                    ? `linear-gradient(135deg,${color}22 0%,${color}0e 100%)`
                                    : 'rgba(255,255,255,0.02)',
                                color: on ? color : 'var(--text-secondary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                transition: 'all 150ms',
                            }}
                        >
                            <Icon size={11} />
                            {label}
                            <span style={{
                                fontSize: '0.65rem', padding: '1px 7px', borderRadius: 10,
                                background: on ? `${color}33` : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${on ? color + '44' : 'rgba(255,255,255,0.09)'}`,
                                color: on ? color : 'var(--text-muted)',
                            }}>{cnt}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                    flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                    padding: '0.4rem 0.75rem', border: '1px solid rgba(255,255,255,0.07)',
                }}>
                    <FaSearch style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        className="w-full"
                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', fontSize: '0.88rem' }}
                        placeholder={`Cerca ${activeTab === 'active' ? 'capacità attive' : 'capacità passive'}…`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }} onClick={() => setSearch('')}>
                            <FaTimes size={11} />
                        </button>
                    )}
                </div>
                <button
                    className="btn-primary text-sm"
                    onClick={() => setEditing({ ...EMPTY_FEAT_CAT(), subcategory: activeTab })}
                    style={{ flexShrink: 0 }}
                >
                    <FaPlus /> Nuovo Privilegio
                </button>
            </div>

            {/* ── Card grid ── */}
            {loading && <div className="text-muted text-sm">Caricamento…</div>}
            {!loading && filtered.length === 0 && (
                <div style={{
                    textAlign: 'center', padding: '3rem 1rem',
                    border: '2px dashed rgba(255,255,255,0.07)', borderRadius: 10,
                    color: 'var(--text-muted)',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.3 }}>
                        {activeTab === 'active' ? '⚡' : '✦'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', marginBottom: 6 }}>
                        {search ? `Nessun risultato per "${search}"` : `Nessuna ${activeTab === 'active' ? 'capacità attiva' : 'capacità passiva'}`}
                    </div>
                    {!search && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Crea il primo privilegio con il pulsante qui sopra.
                        </div>
                    )}
                </div>
            )}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 10,
            }}>
                {filtered.map(f => {
                    const sub = f.subcategory ?? 'passive';
                    const color = sub === 'active' ? 'var(--accent-warning)' : 'var(--accent-success)';
                    const Icon = sub === 'active' ? FaBolt : FaStar;
                    const modCount = (f.modifiers ?? []).length;
                    const creatureModCount = (f.creatureModifiers ?? []).length;
                    const hasResource = sub === 'active' && f.resourceName;
                    return (
                        <div
                            key={f.id}
                            style={{
                                borderRadius: 10, overflow: 'hidden',
                                border: `1px solid ${color}22`,
                                background: 'var(--bg-surface-elevated)',
                                display: 'flex', flexDirection: 'column',
                                transition: 'border-color 120ms, box-shadow 120ms',
                                cursor: 'default',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}55`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${color}18`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}22`; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                        >
                            {/* Card color strip */}
                            <div style={{
                                height: 4,
                                background: `linear-gradient(90deg, ${color}, transparent)`,
                            }} />

                            {/* Card content */}
                            <div style={{ padding: '12px 14px', flex: 1 }}>
                                {/* Name + type badge */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                                        background: `${color}18`, border: `1px solid ${color}33`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
                                    }}>
                                        <Icon size={12} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontFamily: 'var(--font-heading)', fontSize: '0.92rem',
                                            color: 'var(--text-primary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {f.name}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color, fontFamily: 'var(--font-heading)', marginTop: 1 }}>
                                            {sub === 'active' ? 'Capacità Attiva' : 'Capacità Passiva'}
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                {f.description && (
                                    <div style={{
                                        fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden', marginBottom: 8,
                                    }}>
                                        {f.description}
                                    </div>
                                )}

                                {/* Meta badges */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {modCount > 0 && (
                                        <span style={{
                                            fontSize: '0.66rem', padding: '2px 7px', borderRadius: 8,
                                            background: `${color}15`, border: `1px solid ${color}30`, color,
                                        }}>
                                            {modCount} mod.
                                        </span>
                                    )}
                                    {creatureModCount > 0 && (
                                        <span style={{
                                            fontSize: '0.66rem', padding: '2px 7px', borderRadius: 8,
                                            background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)',
                                            color: 'var(--accent-gold)',
                                        }}>
                                            {creatureModCount} evoc.
                                        </span>
                                    )}
                                    {hasResource && (
                                        <span style={{
                                            fontSize: '0.66rem', padding: '2px 7px', borderRadius: 8,
                                            background: 'rgba(91,173,226,0.12)', border: '1px solid rgba(91,173,226,0.25)',
                                            color: 'var(--accent-ice)',
                                        }}>
                                            {f.resourceMax ? `${f.resourceName} ×${f.resourceMax}` : f.resourceName}
                                        </span>
                                    )}
                                    {(f.tags ?? []).map(tag => (
                                        <span key={tag} style={{
                                            fontSize: '0.64rem', padding: '1px 6px', borderRadius: 8,
                                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--text-muted)',
                                        }}>{tag}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Card actions */}
                            <div style={{
                                display: 'flex', gap: 6, padding: '8px 14px',
                                borderTop: `1px solid ${color}15`,
                                background: `${color}06`,
                            }}>
                                <button
                                    className="btn-ghost text-xs"
                                    onClick={() => setEditing(f)}
                                    style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5 }}
                                >
                                    <FaEdit size={10} /> Modifica
                                </button>
                                <button
                                    className="btn-ghost text-xs"
                                    style={{ color: 'var(--accent-crimson)', display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => remove(f.id)}
                                >
                                    <FaTrash size={10} />
                                </button>
                            </div>
                        </div>
                    );
                })}
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
                        <Field label="Scala su">
                            <select className="input w-full" value={a.attackStat ?? 'str'} onChange={ev => updateAction({ ...a, attackStat: ev.target.value as 'str' | 'dex' | 'none' })}>
                                <option value="str">Forza</option>
                                <option value="dex">Destrezza</option>
                                <option value="none">Nessuna</option>
                            </select>
                        </Field>
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
