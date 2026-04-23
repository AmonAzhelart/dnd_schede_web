import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps, WidgetSize } from '../widgetTypes';

const colsFor = (size: WidgetSize, widthPerCol = 240, max = 3) =>
    Math.max(1, Math.min(max, Math.floor(size.pixelW / widthPerCol)));

const RUNES = ['✦', '✧', '☉', '☽', '✶', '✷', '◈', '◊', '⚝'];

export const FeatsWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character } = useCharacterStore();
    const [q, setQ] = useState('');
    if (!character) return null;
    const items = character.feats;
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())) : items;
    const cols = colsFor(size);

    return (
        <div className="w-feat-root">
            <div className="w-meta">
                <span><strong>{items.length}</strong> talenti</span>
                {goTo && <button className="w-link" style={{ marginLeft: 'auto' }} onClick={() => goTo('feats')}>Apri</button>}
            </div>
            <div className="w-search-wrap">
                <FaSearch size={10} />
                <input className="input w-search" placeholder="Cerca talenti…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="w-feat-list w-scroll" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {filtered.map((feat, i) => {
                    const name = feat.name.startsWith('[D] ') ? feat.name.slice(4) : feat.name;
                    return (
                        <div key={feat.id} className={`w-feat-row ${feat.active ? 'active' : ''}`}>
                            <span className="w-feat-rune">{RUNES[i % RUNES.length]}</span>
                            <span className="w-feat-name">{name}</span>
                            {feat.active && <span className="w-feat-active-tag">attivo</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
