import React, { useMemo, useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { GiSpinningSword, GiShield } from 'react-icons/gi';
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
        { key: 'passive', label: 'Passive', short: 'Pas.', icon: <GiShield />, color: 'var(--accent-success, #27ae60)' }
    ];

const colsFor = (size: WidgetSize, widthPerCol = 220, max = 3) =>
    Math.max(1, Math.min(max, Math.floor(size.pixelW / widthPerCol)));

const isDefect = (f: Feat) => f.name.startsWith('[D] ');
const featDisplayName = (f: Feat) => isDefect(f) ? f.name.slice(4) : f.name;

export const AbilitiesWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, spendClassFeatureResource, recoverClassFeatureResource, toggleFeat } = useCharacterStore();
    const [tab, setTab] = useState<SubTab>('active');
    const [q, setQ] = useState('');
    const [selectedCfId, setSelectedCfId] = useState<string | null>(null);

    const feats = useMemo(() => character?.feats ?? [], [character]);
    const cf = useMemo(() => character?.classFeatures ?? [], [character]);

    const filteredCf = useMemo(() => {
        const ql = q.trim().toLowerCase();
        const list = cf.filter(f => f.subcategory === tab);
        return ql ? list.filter(f => f.name.toLowerCase().includes(ql)) : list;
    }, [cf, q, tab]);

    const filteredFeats = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return ql ? feats.filter(f => f.name.toLowerCase().includes(ql)) : feats;
    }, [feats, q]);

    if (!character) return null;

    const cols = colsFor(size);
    const veryNarrow = size.pixelW < 220;
    const narrow = size.pixelW < 320;

    const counts: Record<SubTab, number> = {
        active: cf.filter(f => f.subcategory === 'active').length,
        passive: cf.filter(f => f.subcategory === 'passive').length,
        feats: feats.length,
        option: 0,
    };

    const activeMeta = TABS.find(t => t.key === tab)!;

    const renderCfRow = (item: ClassFeature) => {
        const hasResource = item.subcategory === 'active' && item.resourceMax != null && item.resourceMax > 0;
        const used = item.resourceUsed ?? 0;
        const max = item.resourceMax ?? 0;
        const exhausted = hasResource && used >= max;
        return (
            <div key={item.id}
                className={`w-abil2-card ${item.active ? '' : 'dim'} ${exhausted ? 'exhausted' : ''}`}
                style={{ ['--accent' as string]: activeMeta.color }}
                role="button"
                title={item.name}
                onClick={() => setSelectedCfId(item.id)}>
                <div className="w-abil2-card-name">{item.name}</div>
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
            {/* Feature detail modal */}
            {(() => {
                const item = selectedCfId ? cf.find(f => f.id === selectedCfId) ?? null : null;
                if (!item) return null;
                const modalAccent = TABS.find(t => t.key === item.subcategory)?.color ?? 'var(--accent-arcane)';
                const hasRes = item.subcategory === 'active' && (item.resourceMax ?? 0) > 0;
                const used = item.resourceUsed ?? 0;
                const max = item.resourceMax ?? 0;
                const available = max - used;
                const Icon = item.subcategory === 'active' ? GiSpinningSword : GiShield;
                return (
                    <div className="w-cfmodal-overlay" onClick={() => setSelectedCfId(null)}>
                        <div className="w-cfmodal" style={{ ['--accent' as string]: modalAccent }}
                            onClick={e => e.stopPropagation()}>
                            <div className="w-cfmodal-hdr">
                                <span className="w-cfmodal-icon"><Icon size={18} /></span>
                                <div className="w-cfmodal-title-wrap">
                                    <h3 className="w-cfmodal-title">{item.name}</h3>
                                    <span className="w-cfmodal-badge">
                                        {item.subcategory === 'active' ? 'Attiva' : 'Passiva'}
                                    </span>
                                </div>
                                <button className="w-cfmodal-close" onClick={() => setSelectedCfId(null)}
                                    title="Chiudi"><FaTimes size={13} /></button>
                            </div>
                            {hasRes && (
                                <div className="w-cfmodal-resource">
                                    <span className="w-cfmodal-res-label">{item.resourceName ?? 'Cariche'}</span>
                                    <div className="w-cfmodal-res-track">
                                        {max <= 10 ? (
                                            <div className="w-cfmodal-pips">
                                                {Array.from({ length: max }).map((_, i) => (
                                                    <div key={i} className={`w-cfmodal-pip ${i < available ? 'full' : 'empty'}`} />
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="w-cfmodal-res-num">{available}/{max}</span>
                                        )}
                                        <button className="w-abil2-mini-btn" disabled={available <= 0}
                                            title="Usa una carica"
                                            onClick={() => spendClassFeatureResource(item.id)}>−</button>
                                        <button className="w-abil2-mini-btn" disabled={used <= 0}
                                            title="Recupera una carica"
                                            onClick={() => recoverClassFeatureResource(item.id)}>+</button>
                                    </div>
                                </div>
                            )}
                            {item.description && (
                                <p className="w-cfmodal-desc">{item.description}</p>
                            )}
                            {item.modifiers && item.modifiers.length > 0 && (
                                <div className="w-cfmodal-mods">
                                    <div className="w-cfmodal-mods-title">Modificatori</div>
                                    {item.modifiers.map((m, i) => (
                                        <div key={i} className="w-cfmodal-mod-row">
                                            <span className="w-cfmodal-mod-target">{m.target}</span>
                                            <span className="w-cfmodal-mod-val"
                                                style={{ color: m.value >= 0 ? 'var(--accent-success, #27ae60)' : 'var(--accent-crimson)' }}>
                                                {m.value > 0 ? '+' : ''}{m.value}
                                            </span>
                                            <span className="w-cfmodal-mod-type">{m.type}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
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
