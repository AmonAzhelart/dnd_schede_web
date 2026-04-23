import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps, WidgetSize } from '../widgetTypes';

const colsFor = (size: WidgetSize) =>
    size.pixelW < 280 ? 1 : size.pixelW < 460 ? 2 : size.pixelW < 720 ? 3 : 4;

const tier = (n: number): string =>
    n >= 10 ? 'tier-elite'
        : n >= 6 ? 'tier-good'
            : n >= 2 ? 'tier-mid'
                : n >= 0 ? 'tier-low'
                    : 'tier-bad';

export const SkillsWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, getEffectiveSkill, getSkillBreakdown } = useCharacterStore();
    const [q, setQ] = useState('');
    const [trainedOnly, setTrainedOnly] = useState(false);
    if (!character) return null;
    const usable = Object.values(character.skills)
        .filter(s => getSkillBreakdown(s.id).usable)
        .sort((a, b) => getEffectiveSkill(b.id) - getEffectiveSkill(a.id));
    let filtered = q ? usable.filter(s => s.name.toLowerCase().includes(q.toLowerCase())) : usable;
    if (trainedOnly) filtered = filtered.filter(s => (s.ranks ?? 0) > 0);
    const cols = colsFor(size);
    const trainedCount = usable.filter(s => (s.ranks ?? 0) > 0).length;

    return (
        <div className="w-skill-root">
            <div className="w-skill-toolbar">
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>{usable.length}</strong> utilizzabili
                    <span style={{ margin: '0 5px', opacity: 0.4 }}>·</span>
                    <strong style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>{trainedCount}</strong> addestrate
                </span>
                <button
                    className={`w-skill-pill ${trainedOnly ? 'active' : ''}`}
                    onClick={() => setTrainedOnly(t => !t)}
                >Solo addestrate</button>
                {goTo && <button className="w-link" onClick={() => goTo('skills')}>Apri</button>}
            </div>
            <div className="w-search-wrap">
                <FaSearch size={10} />
                <input className="input w-search" placeholder="Cerca abilità…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="w-skill-grid w-scroll" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {filtered.map(skill => {
                    const total = getEffectiveSkill(skill.id);
                    const ranks = skill.ranks ?? 0;
                    return (
                        <div key={skill.id} className="w-skill-row">
                            <span className={`w-skill-rank ${ranks > 0 ? 'trained' : ''}`}>{ranks > 0 ? ranks : '·'}</span>
                            <span className="w-skill-name">{skill.name}</span>
                            <span className={`w-skill-mod ${tier(total)}`}>{total >= 0 ? '+' : ''}{total}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
