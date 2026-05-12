import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTrash, FaSave, FaTimes, FaEdit, FaSearch, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import {
    raceCatalog, languageCatalog, classCatalog, iconCatalog,
    type CatalogRace, type CatalogLanguage, type CatalogClass, type CatalogIcon,
    type RaceAbilityMod, type RaceFeat,
} from '../../services/admin';
import { pickLocalized } from '../../i18n';
import { LocalizedFieldEditor } from './LocalizedFieldEditor';
import { IconPicker } from './IconPicker';
import { ModifierEditor } from '../ModifierEditor';
import { CreatureModifierEditor } from '../CreatureModifierEditor';
import type { Modifier, CreatureModifier } from '../../types/dnd';

interface Props { currentUserEmail: string; }

const SIZES: CatalogRace['size'][] = ['Minuscola', 'Piccola', 'Media', 'Grande', 'Enorme'];
const STATS: RaceAbilityMod['stat'][] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const EMPTY = (): CatalogRace => ({
    id: uuid(),
    name: '',
    description: '',
    size: 'Media',
    speed: 9,
    abilityMods: [],
    automaticLanguages: [],
    bonusLanguages: [],
    racialFeats: [],
    favoredClassId: '',
    notes: '',
    iconId: '',
});

export function RacesPanel({ currentUserEmail }: Props) {
    const { t, i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';
    const [items, setItems] = useState<CatalogRace[]>([]);
    const [languages, setLanguages] = useState<CatalogLanguage[]>([]);
    const [classes, setClasses] = useState<CatalogClass[]>([]);
    const [icons, setIcons] = useState<CatalogIcon[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogRace | null>(null);
    const [search, setSearch] = useState('');
    const [openSection, setOpenSection] = useState<string | null>('traits');
    const [expandedTraits, setExpandedTraits] = useState<Set<string>>(new Set());
    const toggleTrait = (id: string) => setExpandedTraits(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const iconSvgById = useMemo(() => Object.fromEntries(icons.map(i => [i.id, i.svg])), [icons]);

    const refresh = async () => {
        setLoading(true);
        const [r, l, c, ic] = await Promise.all([raceCatalog.list(), languageCatalog.list(), classCatalog.list(), iconCatalog.list()]);
        setItems(r); setLanguages(l); setClasses(c); setIcons(ic);
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(r => pickLocalized(r.name, lang).toLowerCase().includes(q));
    }, [items, search, lang]);

    const save = async () => {
        if (!editing) return;
        if (!pickLocalized(editing.name, 'it').trim()) return;
        await raceCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm('Eliminare questa razza?')) return;
        await raceCatalog.remove(id);
        await refresh();
    };

    /* ───── Editor ───── */
    if (editing) {
        const setField = <K extends keyof CatalogRace>(k: K, v: CatalogRace[K]) =>
            setEditing({ ...editing, [k]: v });

        const addAbilityMod = () =>
            setField('abilityMods', [...editing.abilityMods, { stat: 'str', value: 0 }]);
        const updateAbilityMod = (i: number, patch: Partial<RaceAbilityMod>) =>
            setField('abilityMods', editing.abilityMods.map((m, idx) => idx === i ? { ...m, ...patch } : m));
        const removeAbilityMod = (i: number) =>
            setField('abilityMods', editing.abilityMods.filter((_, idx) => idx !== i));

        const addRacialFeat = () => {
            const newId = uuid();
            setField('racialFeats', [...editing.racialFeats, { id: newId, name: '', description: '', subcategory: 'passive' as const }]);
            setExpandedTraits(prev => new Set(prev).add(newId));
        };
        const updateRacialFeat = (i: number, patch: Partial<RaceFeat>) =>
            setField('racialFeats', editing.racialFeats.map((f, idx) => idx === i ? { ...f, ...patch } : f));
        const removeRacialFeat = (i: number) =>
            setField('racialFeats', editing.racialFeats.filter((_, idx) => idx !== i));

        const toggleLang = (which: 'automaticLanguages' | 'bonusLanguages', id: string) => {
            const arr = editing[which];
            setField(which, arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
        };

        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">
                        {items.find(i => i.id === editing.id) ? t('common.edit') : t('backoffice.races.newRace')}
                    </span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> {t('common.cancel')}</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> {t('common.save')}</button>
                    </div>
                </div>

                <LocalizedFieldEditor label={t('common.name')} value={editing.name} onChange={v => setField('name', v)} />
                <LocalizedFieldEditor label={t('common.description')} multiline value={editing.description} onChange={v => setField('description', v)} />

                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px' }}>
                        <label className="text-xs text-muted">{t('backoffice.races.size')}</label>
                        <select className="input w-full" value={editing.size} onChange={e => setField('size', e.target.value as CatalogRace['size'])}>
                            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                        <label className="text-xs text-muted">{t('backoffice.races.speed')}</label>
                        <input type="number" className="input w-full" value={editing.speed} onChange={e => setField('speed', Number(e.target.value) || 0)} />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="text-xs text-muted">{t('backoffice.races.favoredClass')}</label>
                        <select className="input w-full" value={editing.favoredClassId ?? ''} onChange={e => setField('favoredClassId', e.target.value)}>
                            <option value="">— {t('common.none')} —</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{pickLocalized(c.name, lang)}</option>)}
                        </select>
                    </div>
                </div>

                {/* Ability mods */}
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="section-header">
                        <span className="section-title text-sm">{t('backoffice.races.abilityMods')}</span>
                        <button className="btn-ghost text-xs" onClick={addAbilityMod}><FaPlus /></button>
                    </div>
                    <div className="flex-col gap-1">
                        {editing.abilityMods.length === 0 && <span className="text-xs text-muted">—</span>}
                        {editing.abilityMods.map((m, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <select className="input" value={m.stat} onChange={e => updateAbilityMod(i, { stat: e.target.value as RaceAbilityMod['stat'] })}>
                                    {STATS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                </select>
                                <input type="number" className="input" style={{ width: 80 }} value={m.value} onChange={e => updateAbilityMod(i, { value: Number(e.target.value) || 0 })} />
                                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeAbilityMod(i)}><FaTrash /></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Languages */}
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <LangPicker
                        title={t('backoffice.races.automaticLanguages')}
                        languages={languages}
                        selected={editing.automaticLanguages}
                        onToggle={id => toggleLang('automaticLanguages', id)}
                        lang={lang}
                    />
                    <LangPicker
                        title={t('backoffice.races.bonusLanguages')}
                        languages={languages}
                        selected={editing.bonusLanguages}
                        onToggle={id => toggleLang('bonusLanguages', id)}
                        lang={lang}
                    />
                </div>

                {/* Racial feats / privileges */}
                <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'traits' ? null : 'traits')}
                    className="section-header"
                    style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none', padding: '6px 8px' }}
                >
                    <span className="section-title text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {openSection === 'traits' ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                        {t('backoffice.races.racialFeats')}
                        <span className="text-xs text-muted">({editing.racialFeats.length})</span>
                    </span>
                </button>
                {openSection === 'traits' && (
                    <div className="glass-panel flex-col gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn-ghost text-xs" onClick={addRacialFeat}><FaPlus /> Aggiungi privilegio</button>
                        </div>
                        {editing.racialFeats.length === 0 && <span className="text-xs text-muted">—</span>}
                        {editing.racialFeats.map((f, i) => {
                            const isOpen = expandedTraits.has(f.id);
                            const subcat = f.subcategory ?? 'passive';
                            const nameStr = pickLocalized(f.name, lang) || <em style={{ opacity: 0.4 }}>senza nome</em>;
                            return (
                                <div key={f.id} style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                    {/* ── collapsed row ── */}
                                    <div
                                        className="flex items-center gap-2"
                                        style={{ padding: '6px 8px', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => toggleTrait(f.id)}
                                    >
                                        {isOpen ? <FaChevronDown size={9} style={{ flexShrink: 0, opacity: 0.5 }} /> : <FaChevronRight size={9} style={{ flexShrink: 0, opacity: 0.5 }} />}
                                        <span style={{
                                            fontSize: '0.62rem', padding: '0.1rem 0.38rem', borderRadius: 3, flexShrink: 0,
                                            background: subcat === 'active' ? 'rgba(200,50,50,0.2)' : 'rgba(100,100,200,0.2)',
                                            color: subcat === 'active' ? 'var(--accent-crimson)' : 'var(--accent-arcane)',
                                        }}>
                                            {subcat === 'active' ? 'Attivo' : 'Passivo'}
                                        </span>
                                        <span className="text-sm" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {nameStr}
                                        </span>
                                        {subcat === 'active' && f.resourceName && (
                                            <span className="text-xs text-muted" style={{ flexShrink: 0 }}>
                                                {f.resourceName}{f.resourceMax ? ` ×${f.resourceMax}` : ''}
                                            </span>
                                        )}
                                        {(f.modifiers?.length ?? 0) > 0 && (
                                            <span className="text-xs text-muted" style={{ flexShrink: 0 }}>+{f.modifiers!.length} mod</span>
                                        )}
                                        <button
                                            className="btn-ghost text-xs"
                                            style={{ color: 'var(--accent-crimson)', flexShrink: 0 }}
                                            onClick={e => { e.stopPropagation(); removeRacialFeat(i); }}
                                        ><FaTrash /></button>
                                    </div>
                                    {/* ── expanded form ── */}
                                    {isOpen && (
                                        <div className="flex-col gap-1" style={{ padding: '0 8px 8px' }}>
                                            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                                                <select className="input" value={subcat} onClick={e => e.stopPropagation()} onChange={e => updateRacialFeat(i, { subcategory: e.target.value as RaceFeat['subcategory'] })}>
                                                    <option value="passive">Passivo</option>
                                                    <option value="active">Attivo</option>
                                                </select>
                                            </div>
                                            <LocalizedFieldEditor label={t('common.name')} value={f.name} onChange={v => updateRacialFeat(i, { name: v })} />
                                            <LocalizedFieldEditor label={t('common.description')} multiline value={f.description} onChange={v => updateRacialFeat(i, { description: v })} />
                                            {subcat === 'active' && (
                                                <div className="flex gap-2">
                                                    <input
                                                        className="input"
                                                        placeholder="Risorsa (es. 'Furia Razziale')"
                                                        value={f.resourceName ?? ''}
                                                        onChange={e => updateRacialFeat(i, { resourceName: e.target.value })}
                                                    />
                                                    <input
                                                        type="number"
                                                        className="input"
                                                        style={{ width: 100 }}
                                                        placeholder="Max usi"
                                                        value={f.resourceMax ?? ''}
                                                        onChange={e => updateRacialFeat(i, { resourceMax: e.target.value ? Number(e.target.value) : undefined })}
                                                    />
                                                </div>
                                            )}
                                            <ModifierEditor
                                                modifiers={f.modifiers ?? []}
                                                onChange={mods => updateRacialFeat(i, { modifiers: mods as Modifier[] })}
                                                accentColor={subcat === 'active' ? 'var(--accent-crimson)' : 'var(--accent-arcane)'}
                                                title="MODIFICATORI"
                                                compact
                                            />
                                            <CreatureModifierEditor
                                                modifiers={f.creatureModifiers ?? []}
                                                onChange={cms => updateRacialFeat(i, { creatureModifiers: cms as CreatureModifier[] })}
                                                accentColor={subcat === 'active' ? 'var(--accent-crimson)' : 'var(--accent-gold)'}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <LocalizedFieldEditor label="Note" multiline value={editing.notes} onChange={v => setField('notes', v)} />

                <IconPicker
                    label="Icona razza"
                    value={editing.iconId}
                    onChange={id => setField('iconId', id)}
                />
            </div>
        );
    }

    /* ───── List ───── */
    return (
        <div className="flex-col gap-3">
            <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                <div className="flex items-center gap-2" style={{ flex: '1 1 240px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}>
                    <FaSearch className="text-muted" />
                    <input className="w-full" style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none' }} placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY())}><FaPlus /> {t('backoffice.races.newRace')}</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">{t('common.loading')}</div>}
                {!loading && filtered.length === 0 && <div className="text-muted text-sm">—</div>}
                <div className="flex-col gap-1">
                    {filtered.map(r => (
                        <div key={r.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            {r.iconId && iconSvgById[r.iconId]
                                ? <span style={{ width: 24, height: 24, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', filter: 'brightness(0) invert(1)' }} dangerouslySetInnerHTML={{ __html: iconSvgById[r.iconId] }} />
                                : <span style={{ width: 24, height: 24, flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {pickLocalized(r.name, lang) || t('common.untitled')}
                                    {r.racialFeats.length > 0 && (
                                        <span style={{
                                            fontSize: '0.6rem', padding: '0.1rem 0.42rem', borderRadius: 10,
                                            background: 'rgba(100,100,200,0.18)', color: 'var(--accent-arcane)',
                                            fontFamily: 'var(--font-body)', fontWeight: 600,
                                        }}>
                                            {r.racialFeats.length} privilegio{r.racialFeats.length !== 1 ? 'i' : ''}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-muted">
                                    {r.size} • {r.speed}m
                                    {r.abilityMods.length > 0 && (
                                        <> • {r.abilityMods.map(m => `${m.value >= 0 ? '+' : ''}${m.value} ${m.stat.toUpperCase()}`).join(', ')}</>
                                    )}
                                </div>
                            </div>
                            <button className="btn-ghost text-xs" onClick={() => setEditing(r)}><FaEdit /></button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(r.id)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function LangPicker({ title, languages, selected, onToggle, lang }: {
    title: string;
    languages: CatalogLanguage[];
    selected: string[];
    onToggle: (id: string) => void;
    lang: string;
}) {
    return (
        <div className="glass-panel" style={{ flex: '1 1 240px', background: 'rgba(255,255,255,0.02)' }}>
            <div className="section-header">
                <span className="section-title text-sm">{title}</span>
                <span className="text-xs text-muted">{selected.length}</span>
            </div>
            {languages.length === 0 && <span className="text-xs text-muted">Crea prima delle lingue.</span>}
            <div className="flex" style={{ flexWrap: 'wrap', gap: 4 }}>
                {languages.map(l => {
                    const on = selected.includes(l.id);
                    return (
                        <button
                            key={l.id}
                            onClick={() => onToggle(l.id)}
                            style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: 12,
                                cursor: 'pointer',
                                border: `1px solid ${on ? 'var(--accent-gold)' : 'rgba(255,255,255,0.12)'}`,
                                background: on ? 'rgba(201,168,76,0.15)' : 'transparent',
                                color: on ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            }}
                        >
                            {pickLocalized(l.name, lang)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
