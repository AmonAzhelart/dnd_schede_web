import { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTrash, FaSave, FaTimes, FaEdit, FaSearch, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import {
    classCatalog, skillCatalog, featCatalog, iconCatalog,
    type CatalogClass, type CatalogSkill, type CatalogFeat, type CatalogIcon,
    type ClassLevelFeature, type ClassStartingEquipment, type ClassBonusFeatSuggestion,
} from '../../services/admin';
import { pickLocalized } from '../../i18n';
import { LocalizedFieldEditor } from './LocalizedFieldEditor';
import { IconPicker } from './IconPicker';

interface Props { currentUserEmail: string; }

const HIT_DICE: CatalogClass['hitDie'][] = [4, 6, 8, 10, 12];
const BAB_OPTIONS: CatalogClass['babProgression'][] = ['high', 'medium', 'low'];
const SAVE_OPTIONS = ['good', 'poor'] as const;
const SUBCATEGORIES: ClassLevelFeature['subcategory'][] = ['active', 'passive', 'talent', 'option'];

const EMPTY = (): CatalogClass => ({
    id: uuid(),
    name: '',
    description: '',
    hitDie: 8,
    babProgression: 'medium',
    fortitude: 'good',
    reflex: 'poor',
    will: 'poor',
    skillPointsPerLevel: 4,
    classSkillIds: [],
    featuresByLevel: [],
    spellcasting: { type: 'none' },
    startingEquipment: [],
    bonusFeats: [],
    iconId: '',
});

export function ClassesPanel({ currentUserEmail }: Props) {
    const { t, i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';
    const [items, setItems] = useState<CatalogClass[]>([]);
    const [skills, setSkills] = useState<CatalogSkill[]>([]);
    const [feats, setFeats] = useState<CatalogFeat[]>([]);
    const [icons, setIcons] = useState<CatalogIcon[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogClass | null>(null);
    const [search, setSearch] = useState('');
    const [openSection, setOpenSection] = useState<string | null>('features');

    const iconSvgById = useMemo(() => Object.fromEntries(icons.map(i => [i.id, i.svg])), [icons]);

    const refresh = async () => {
        setLoading(true);
        const [c, s, f, ic] = await Promise.all([classCatalog.list(), skillCatalog.list(), featCatalog.list(), iconCatalog.list()]);
        setItems(c); setSkills(s); setFeats(f); setIcons(ic);
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(c => pickLocalized(c.name, lang).toLowerCase().includes(q));
    }, [items, search, lang]);

    const save = async () => {
        if (!editing) return;
        if (!pickLocalized(editing.name, 'it').trim()) return;
        await classCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm('Eliminare questa classe?')) return;
        await classCatalog.remove(id);
        await refresh();
    };

    /* ───── Editor ───── */
    if (editing) {
        const setField = <K extends keyof CatalogClass>(k: K, v: CatalogClass[K]) =>
            setEditing({ ...editing, [k]: v });

        const toggleClassSkill = (id: string) =>
            setField('classSkillIds',
                editing.classSkillIds.includes(id)
                    ? editing.classSkillIds.filter(x => x !== id)
                    : [...editing.classSkillIds, id]);

        const addFeature = () => {
            const f: ClassLevelFeature = {
                id: uuid(), level: 1, name: '', description: '', subcategory: 'passive',
            };
            setField('featuresByLevel', [...editing.featuresByLevel, f]);
        };
        const updateFeature = (i: number, patch: Partial<ClassLevelFeature>) =>
            setField('featuresByLevel',
                editing.featuresByLevel.map((f, idx) => idx === i ? { ...f, ...patch } : f));
        const removeFeature = (i: number) =>
            setField('featuresByLevel', editing.featuresByLevel.filter((_, idx) => idx !== i));

        const addEquip = () =>
            setField('startingEquipment',
                [...(editing.startingEquipment ?? []), { id: uuid(), label: '' } as ClassStartingEquipment]);
        const updateEquip = (i: number, patch: Partial<ClassStartingEquipment>) =>
            setField('startingEquipment',
                (editing.startingEquipment ?? []).map((e, idx) => idx === i ? { ...e, ...patch } : e));
        const removeEquip = (i: number) =>
            setField('startingEquipment', (editing.startingEquipment ?? []).filter((_, idx) => idx !== i));

        const addBonusFeat = () =>
            setField('bonusFeats',
                [...(editing.bonusFeats ?? []), { id: uuid(), featRef: '', label: '', grantedAtLevel: 1 } as ClassBonusFeatSuggestion]);
        const updateBonusFeat = (i: number, patch: Partial<ClassBonusFeatSuggestion>) =>
            setField('bonusFeats',
                (editing.bonusFeats ?? []).map((b, idx) => idx === i ? { ...b, ...patch } : b));
        const removeBonusFeat = (i: number) =>
            setField('bonusFeats', (editing.bonusFeats ?? []).filter((_, idx) => idx !== i));

        const sortedFeatures = [...editing.featuresByLevel]
            .map((f, originalIndex) => ({ ...f, _i: originalIndex }))
            .sort((a, b) => a.level - b.level);

        const Toggle = ({ id, label, count }: { id: string; label: string; count?: number }) => (
            <button
                type="button"
                onClick={() => setOpenSection(openSection === id ? null : id)}
                className="section-header"
                style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none', padding: '6px 8px' }}
            >
                <span className="section-title text-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {openSection === id ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                    {label} {count !== undefined && <span className="text-xs text-muted">({count})</span>}
                </span>
            </button>
        );

        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">
                        {items.find(i => i.id === editing.id) ? t('common.edit') : t('backoffice.classes.newClass')}
                    </span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> {t('common.cancel')}</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> {t('common.save')}</button>
                    </div>
                </div>

                <LocalizedFieldEditor label={t('common.name')} value={editing.name} onChange={v => setField('name', v)} />
                <LocalizedFieldEditor label={t('common.description')} multiline value={editing.description} onChange={v => setField('description', v)} />

                {/* Mechanics */}
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-muted">{t('backoffice.classes.hitDie')}</label>
                        <select className="input w-full" value={editing.hitDie} onChange={e => setField('hitDie', Number(e.target.value) as CatalogClass['hitDie'])}>
                            {HIT_DICE.map(d => <option key={d} value={d}>d{d}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-muted">{t('backoffice.classes.babProgression')}</label>
                        <select className="input w-full" value={editing.babProgression} onChange={e => setField('babProgression', e.target.value as CatalogClass['babProgression'])}>
                            {BAB_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-muted">{t('backoffice.classes.fortitude')}</label>
                        <select className="input w-full" value={editing.fortitude} onChange={e => setField('fortitude', e.target.value as 'good' | 'poor')}>
                            {SAVE_OPTIONS.map(s => <option key={s} value={s}>{t(`backoffice.classes.${s}`)}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-muted">{t('backoffice.classes.reflex')}</label>
                        <select className="input w-full" value={editing.reflex} onChange={e => setField('reflex', e.target.value as 'good' | 'poor')}>
                            {SAVE_OPTIONS.map(s => <option key={s} value={s}>{t(`backoffice.classes.${s}`)}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-muted">{t('backoffice.classes.will')}</label>
                        <select className="input w-full" value={editing.will} onChange={e => setField('will', e.target.value as 'good' | 'poor')}>
                            {SAVE_OPTIONS.map(s => <option key={s} value={s}>{t(`backoffice.classes.${s}`)}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label className="text-xs text-muted">{t('backoffice.classes.skillPoints')}</label>
                        <input type="number" className="input w-full" value={editing.skillPointsPerLevel} onChange={e => setField('skillPointsPerLevel', Number(e.target.value) || 0)} />
                    </div>
                </div>

                {/* Class skills */}
                <Toggle id="skills" label={t('backoffice.classes.classSkills')} count={editing.classSkillIds.length} />
                {openSection === 'skills' && (
                    <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {skills.length === 0 && <span className="text-xs text-muted">Crea prima delle abilità nel catalogo.</span>}
                        <div className="flex" style={{ flexWrap: 'wrap', gap: 4 }}>
                            {skills.map(s => {
                                const on = editing.classSkillIds.includes(s.id);
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => toggleClassSkill(s.id)}
                                        style={{
                                            fontSize: '0.72rem', padding: '3px 8px', borderRadius: 12, cursor: 'pointer',
                                            border: `1px solid ${on ? 'var(--accent-gold)' : 'rgba(255,255,255,0.12)'}`,
                                            background: on ? 'rgba(201,168,76,0.15)' : 'transparent',
                                            color: on ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {s.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Features by level */}
                <Toggle id="features" label={t('backoffice.classes.featuresByLevel')} count={editing.featuresByLevel.length} />
                {openSection === 'features' && (
                    <div className="glass-panel flex-col gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn-ghost text-xs" onClick={addFeature}><FaPlus /> {t('backoffice.classes.addFeature')}</button>
                        </div>
                        {sortedFeatures.length === 0 && <span className="text-xs text-muted">—</span>}
                        {sortedFeatures.map(f => (
                            <div key={f.id} className="flex-col gap-1" style={{ padding: 8, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted">{t('common.level')}</span>
                                    <input type="number" min={1} max={20} className="input" style={{ width: 64 }} value={f.level} onChange={e => updateFeature(f._i, { level: Math.max(1, Number(e.target.value) || 1) })} />
                                    <select className="input" value={f.subcategory} onChange={e => updateFeature(f._i, { subcategory: e.target.value as ClassLevelFeature['subcategory'] })}>
                                        {SUBCATEGORIES.map(s => <option key={s} value={s}>{t(`common.${s}`)}</option>)}
                                    </select>
                                    <span style={{ flex: 1 }} />
                                    <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeFeature(f._i)}><FaTrash /></button>
                                </div>
                                <LocalizedFieldEditor label={t('common.name')} value={f.name} onChange={v => updateFeature(f._i, { name: v })} />
                                <LocalizedFieldEditor label={t('common.description')} multiline value={f.description} onChange={v => updateFeature(f._i, { description: v })} />
                                {f.subcategory === 'active' && (
                                    <div className="flex gap-2">
                                        <input className="input" placeholder="Risorsa (es. 'Furia')" value={f.resourceName ?? ''} onChange={e => updateFeature(f._i, { resourceName: e.target.value })} />
                                        <input type="number" className="input" style={{ width: 100 }} placeholder="Max usi" value={f.resourceMax ?? ''} onChange={e => updateFeature(f._i, { resourceMax: e.target.value ? Number(e.target.value) : undefined })} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Spellcasting */}
                <Toggle id="spellcasting" label={t('backoffice.classes.spellcasting')} />
                {openSection === 'spellcasting' && (
                    <div className="glass-panel flex-col gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                            <select className="input" value={editing.spellcasting?.type ?? 'none'} onChange={e => setField('spellcasting', { ...editing.spellcasting, type: e.target.value as 'arcane' | 'divine' | 'none' })}>
                                <option value="none">Nessuno</option>
                                <option value="arcane">Arcano</option>
                                <option value="divine">Divino</option>
                            </select>
                            {editing.spellcasting?.type !== 'none' && <>
                                <select className="input" value={editing.spellcasting?.stat ?? 'int'} onChange={e => setField('spellcasting', { ...editing.spellcasting!, stat: e.target.value as 'int' | 'wis' | 'cha' })}>
                                    <option value="int">INT</option>
                                    <option value="wis">WIS</option>
                                    <option value="cha">CHA</option>
                                </select>
                                <input type="number" min={0} max={9} className="input" style={{ width: 100 }} placeholder="Max liv. magia" value={editing.spellcasting?.maxSpellLevel ?? ''} onChange={e => setField('spellcasting', { ...editing.spellcasting!, maxSpellLevel: e.target.value ? Number(e.target.value) : undefined })} />
                            </>}
                        </div>
                        {editing.spellcasting?.type !== 'none' && (
                            <LocalizedFieldEditor label="Note" multiline value={editing.spellcasting?.notes} onChange={v => setField('spellcasting', { ...editing.spellcasting!, notes: v })} />
                        )}
                    </div>
                )}

                {/* Starting equipment */}
                <Toggle id="equip" label={t('backoffice.classes.startingEquipment')} count={(editing.startingEquipment ?? []).length} />
                {openSection === 'equip' && (
                    <div className="glass-panel flex-col gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn-ghost text-xs" onClick={addEquip}><FaPlus /></button>
                        </div>
                        {(editing.startingEquipment ?? []).map((e, i) => (
                            <div key={e.id} className="flex items-center gap-2">
                                <div style={{ flex: 1 }}>
                                    <LocalizedFieldEditor label="" value={e.label} onChange={v => updateEquip(i, { label: v })} />
                                </div>
                                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeEquip(i)}><FaTrash /></button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Bonus feats */}
                <Toggle id="bonusFeats" label={t('backoffice.classes.bonusFeats')} count={(editing.bonusFeats ?? []).length} />
                {openSection === 'bonusFeats' && (
                    <div className="glass-panel flex-col gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn-ghost text-xs" onClick={addBonusFeat}><FaPlus /></button>
                        </div>
                        {(editing.bonusFeats ?? []).map((b, i) => (
                            <div key={b.id} className="flex-col gap-1" style={{ padding: 8, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted">Liv.</span>
                                    <input type="number" min={1} max={20} className="input" style={{ width: 64 }} value={b.grantedAtLevel ?? 1} onChange={e => updateBonusFeat(i, { grantedAtLevel: Number(e.target.value) || 1 })} />
                                    <select className="input" style={{ flex: 1 }} value={b.featRef} onChange={e => updateBonusFeat(i, { featRef: e.target.value })}>
                                        <option value="">— Talento del catalogo —</option>
                                        {feats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                    <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeBonusFeat(i)}><FaTrash /></button>
                                </div>
                                <LocalizedFieldEditor label="Etichetta libera (opzionale)" value={b.label} onChange={v => updateBonusFeat(i, { label: v })} />
                            </div>
                        ))}
                    </div>
                )}

                <IconPicker
                    label="Icona classe"
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
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY())}><FaPlus /> {t('backoffice.classes.newClass')}</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">{t('common.loading')}</div>}
                {!loading && filtered.length === 0 && <div className="text-muted text-sm">—</div>}
                <div className="flex-col gap-1">
                    {filtered.map(c => (
                        <div key={c.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            {c.iconId && iconSvgById[c.iconId]
                                ? <span style={{ width: 24, height: 24, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', filter: 'brightness(0) invert(1)' }} dangerouslySetInnerHTML={{ __html: iconSvgById[c.iconId] }} />
                                : <span style={{ width: 24, height: 24, flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-heading)' }}>{pickLocalized(c.name, lang) || t('common.untitled')}</div>
                                <div className="text-xs text-muted">
                                    d{c.hitDie} • BAB {c.babProgression} • {c.featuresByLevel.length} privilegi
                                </div>
                            </div>
                            <button className="btn-ghost text-xs" onClick={() => setEditing(c)}><FaEdit /></button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(c.id)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
