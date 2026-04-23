import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps, WidgetSize } from '../widgetTypes';

const colsFor = (size: WidgetSize, widthPerCol = 260, max = 3) =>
    Math.max(1, Math.min(max, Math.floor(size.pixelW / widthPerCol)));

export const ClassFeaturesWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character } = useCharacterStore();
    const [q, setQ] = useState('');
    if (!character) return null;
    const items = character.classFeatures ?? [];
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())) : items;
    const cols = colsFor(size);

    return (
        <div className="w-cf-root">
            <div className="w-meta">
                <span><strong>{items.length}</strong> privilegi</span>
                {goTo && <button className="w-link" style={{ marginLeft: 'auto' }} onClick={() => goTo('classfeatures')}>Apri</button>}
            </div>
            <div className="w-search-wrap">
                <FaSearch size={10} />
                <input className="input w-search" placeholder="Cerca privilegi…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="w-cf-list w-scroll" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {filtered.map(cf => {
                    const remaining = cf.resourceMax != null ? cf.resourceMax - (cf.resourceUsed ?? 0) : null;
                    return (
                        <div key={cf.id} className={`w-cf-row ${cf.active ? '' : 'dim'}`}>
                            <span className="w-cf-name">{cf.name}</span>
                            {remaining !== null && cf.resourceMax! > 0 ? (
                                <div className="w-cf-resource">
                                    {cf.resourceMax! <= 8
                                        ? Array.from({ length: cf.resourceMax! }).map((_, i) => (
                                            <div key={i} className={`w-cf-pip ${i < remaining ? 'full' : 'empty'}`} />
                                        ))
                                        : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>{remaining}/{cf.resourceMax}</span>
                                    }
                                </div>
                            ) : (
                                cf.active && <span className="w-cf-active-dot" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
