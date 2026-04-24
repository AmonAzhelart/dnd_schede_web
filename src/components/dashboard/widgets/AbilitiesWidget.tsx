import React, { useMemo, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { GiSpinningSword, GiShield, GiAbstract024, GiCogLock } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps, WidgetSize } from '../widgetTypes';
import type { ClassFeature, Feat } from '../../../types/dnd';

type SubTab = 'active' | 'passive' | 'feats' | 'option';

const TABS: {
    key: SubTab;
    label: string;
    short: string;
    icon: React.ReactNode;
    color: string;
}[] = [
        { key: 'active', label: 'Attive', short: 'Att.', icon: <GiSpinningSword />, color: 'var(--accent-warning, #f39c12)' },
        { key: 'passive', label: 'Passive', short: 'Pas.', icon: <GiShield />, color: 'var(--accent-success, #27ae60)' },
        { key: 'feats', label: 'Talenti', short: 'Tal.', icon: <GiAbstract024 />, color: 'var(--accent-arcane, #9b59b6)' },
        { key: 'option', label: 'Opzioni', short: 'Opz.', icon: <GiCogLock />, color: 'var(--accent-gold, #c9a84c)' },
    ];

const colsFor = (size: WidgetSize, widthPerCol = 220, max = 3) =>
    Math.max(1, Math.min(max, Math.floor(size.pixelW / widthPerCol)));

const isDefect = (f: Feat) => f.name.startsWith('[D] ');
const featDisplayName = (f: Feat) => isDefect(f) ? f.name.slice(4) : f.name;

export const AbilitiesWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, spendClassFeatureResource, recoverClassFeatureResource, toggleFeat } = useCharacterStore();
    const [tab, setTab] = useState<SubTab>('active');
    const [q, setQ] = useState('');

    if (!character) return null;
    const feats = character.feats ?? [];
    const cf = character.classFeatures ?? [];
    const cols = colsFor(size);
    const veryNarrow = size.pixelW < 220;
    const narrow = size.pixelW < 320;

    const counts: Record<SubTab, number> = {
        active: cf.filter(f => f.subcategory === 'active').length,
        passive: cf.filter(f => f.subcategory === 'passive').length,
        option: cf.filter(f => f.subcategory === 'option').length,
        feats: feats.length,
    };

    const activeMeta = TABS.find(t => t.key === tab)!;

    const filteredCf = useMemo(() => {
        const ql = q.trim().toLowerCase();
        const list = cf.filter(f => f.subcategory === tab);
        return ql ? list.filter(f => f.name.toLowerCase().includes(ql)) : list;
    }, [cf, q, tab]);

    const filteredFeats = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return ql ? feats.filter(f => f.name.toLowerCase().includes(ql)) : feats;
    }, [feats, q]);

    const renderCfRow = (item: ClassFeature) => {
        const hasResource = item.subcategory === 'active' && item.resourceMax != null && item.resourceMax > 0;
        const used = item.resourceUsed ?? 0;
        const max = item.resourceMax ?? 0;
        const exhausted = hasResource && used >= max;
        return (
            <div key={item.id} className={`w-abil2-card ${item.active ? '' : 'dim'} ${exhausted ? 'exhausted' : ''}`}
                style={{ ['--accent' as string]: activeMeta.color }}>
                <div className="w-abil2-card-name" title={item.name}>{item.name}</div>
                {hasResource ? (
                    <div className="w-abil2-card-foot">
                        {max <= 8 ? (
                            <div className="w-abil2-pips">
                                {Array.from({ length: max }).map((_, i) => (
                                    <div key={i} className={`w-abil2-pip ${i < (max - used) ? 'full' : 'empty'}`} />
                                ))}
                            </div>
                        ) : (
                            <span className="w-abil2-resource-num">{max - used}/{max}</span>
                        )}
                        <button
                            className="w-abil2-mini-btn"
                            disabled={exhausted}
                            title="Usa una carica"
                            onClick={(e) => { e.stopPropagation(); spendClassFeatureResource(item.id); }}
                        >−</button>
                        <button
                            className="w-abil2-mini-btn"
                            disabled={used === 0}
                            title="Recupera una carica"
                            onClick={(e) => { e.stopPropagation(); recoverClassFeatureResource(item.id); }}
                        >+</button>
                    </div>
                ) : (
                    item.active && <span className="w-abil2-dot" title="Attiva" />
                )}
            </div>
        );
    };

    const renderFeatRow = (feat: Feat) => {
        const def = isDefect(feat);
        const name = featDisplayName(feat);
        return (
            <div key={feat.id} className={`w-abil2-card ${def ? 'defect' : ''} ${feat.active || def ? '' : 'dim'}`}
                style={{ ['--accent' as string]: def ? 'var(--accent-crimson)' : activeMeta.color }}
                onClick={() => !def && toggleFeat(feat.id)}
                role="button"
                title={def ? `Difetto: ${name}` : (feat.active ? 'Attivo (clic per disattivare)' : 'Inattivo (clic per attivare)')}
            >
                <div className="w-abil2-card-name">
                    {def && <span className="w-abil2-tag def">D</span>}
                    {name}
                </div>
                {!def && feat.active && <span className="w-abil2-dot" />}
            </div>
        );
    };

    const list = tab === 'feats' ? filteredFeats : filteredCf;
    const isEmpty = list.length === 0;

    return (
        <div className="w-abil2-root">
            {/* Tabs */}
            <div className="w-abil2-tabs" role="tablist">
                {TABS.map(t => {
                    const isActive = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={isActive}
                            className={`w-abil2-tab ${isActive ? 'active' : ''}`}
                            style={{ ['--accent' as string]: t.color }}
                            onClick={() => setTab(t.key)}
                            title={t.label}
                        >
                            <span className="w-abil2-tab-ico">{t.icon}</span>
                            {!veryNarrow && <span className="w-abil2-tab-lbl">{narrow ? t.short : t.label}</span>}
                            <span className="w-abil2-tab-cnt">{counts[t.key]}</span>
                        </button>
                    );
                })}
            </div>

            {/* Search + Apri */}
            <div className="w-abil2-toolbar">
                <div className="w-search-wrap" style={{ flex: 1 }}>
                    <FaSearch size={10} />
                    <input
                        className="input w-search"
                        placeholder="Cerca…"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                    />
                </div>
                {goTo && (
                    <button
                        className="w-link"
                        onClick={() => goTo(`abilities:${tab}`)}
                        title="Apri pagina completa"
                    >
                        Apri →
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="w-abil2-body w-scroll">
                {isEmpty ? (
                    <div className="w-empty">
                        {q
                            ? 'Nessun risultato.'
                            : tab === 'active' ? 'Nessuna capacità attiva.'
                                : tab === 'passive' ? 'Nessuna capacità passiva.'
                                    : tab === 'feats' ? 'Nessun talento.'
                                        : 'Nessuna opzione di personalizzazione.'}
                    </div>
                ) : (
                    <div className="w-abil2-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                        {tab === 'feats'
                            ? filteredFeats.map(renderFeatRow)
                            : filteredCf.map(renderCfRow)}
                    </div>
                )}
            </div>
        </div>
    );
};
