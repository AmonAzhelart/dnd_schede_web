import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTrash, FaSave, FaTimes, FaEdit } from 'react-icons/fa';
import { languageCatalog, type CatalogLanguage } from '../../services/admin';
import { pickLocalized } from '../../i18n';
import { LocalizedFieldEditor } from './LocalizedFieldEditor';

interface Props { currentUserEmail: string; }

const EMPTY = (): CatalogLanguage => ({ id: uuid(), name: '', exotic: false });

export function LanguagesPanel({ currentUserEmail }: Props) {
    const { t, i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';
    const [items, setItems] = useState<CatalogLanguage[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CatalogLanguage | null>(null);

    const refresh = async () => {
        setLoading(true);
        setItems(await languageCatalog.list());
        setLoading(false);
    };
    useEffect(() => { refresh(); }, []);

    const save = async () => {
        if (!editing) return;
        const display = pickLocalized(editing.name, 'it');
        if (!display.trim()) return;
        await languageCatalog.upsert({ ...editing, createdBy: editing.createdBy ?? currentUserEmail });
        setEditing(null);
        await refresh();
    };
    const remove = async (id: string) => {
        if (!confirm('Eliminare questa lingua?')) return;
        await languageCatalog.remove(id);
        await refresh();
    };

    if (editing) {
        return (
            <div className="glass-panel flex-col gap-3">
                <div className="section-header">
                    <span className="section-title">
                        {items.find(i => i.id === editing.id) ? t('common.edit') : t('common.add')}
                    </span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={() => setEditing(null)}><FaTimes /> {t('common.cancel')}</button>
                        <button className="btn-primary text-sm" onClick={save}><FaSave /> {t('common.save')}</button>
                    </div>
                </div>
                <LocalizedFieldEditor label={t('common.name')} value={editing.name} onChange={v => setEditing({ ...editing, name: v })} />
                <LocalizedFieldEditor label={t('common.description')} multiline value={editing.notes} onChange={v => setEditing({ ...editing, notes: v })} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editing.exotic} onChange={e => setEditing({ ...editing, exotic: e.target.checked })} />
                    Esotica (solo come bonus)
                </label>
            </div>
        );
    }

    return (
        <div className="flex-col gap-3">
            <div className="flex" style={{ justifyContent: 'flex-end' }}>
                <button className="btn-primary text-sm" onClick={() => setEditing(EMPTY())}><FaPlus /> {t('common.add')}</button>
            </div>
            <div className="glass-panel">
                {loading && <div className="text-muted text-sm">{t('common.loading')}</div>}
                {!loading && items.length === 0 && <div className="text-muted text-sm">—</div>}
                <div className="flex-col gap-1">
                    {items.map(l => (
                        <div key={l.id} className="flex items-center gap-2" style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontFamily: 'var(--font-heading)' }}>{pickLocalized(l.name, lang)}</span>
                                {l.exotic && <span className="text-xs" style={{ color: 'var(--accent-arcane)', marginLeft: 6 }}>(esotica)</span>}
                            </div>
                            <button className="btn-ghost text-xs" onClick={() => setEditing(l)}><FaEdit /></button>
                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => remove(l.id)}><FaTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
