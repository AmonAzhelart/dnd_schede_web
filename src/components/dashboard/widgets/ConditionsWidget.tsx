import React from 'react';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';
import { useCharacterStore } from '../../../store/characterStore';
import { CONDITIONS, SEVERITY_ORDER } from '../../../data/conditions';
const EMPTY_CONDITIONS: string[] = [];

export const ConditionsWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const active = useCharacterStore(s => s.character?.activeConditions ?? EMPTY_CONDITIONS);
    const setActiveConditions = useCharacterStore(s => s.setActiveConditions);

    const compact = size.pixelW < 300 || size.pixelH < 200;
    const wide = size.size === 'lg' || size.size === 'xl';

    const add = (id: string) => setActiveConditions([...active, id]);
    const remove = (id: string) => setActiveConditions(active.filter(x => x !== id));

    const activeList = CONDITIONS
        .filter(c => active.includes(c.id))
        .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

    const poolList = CONDITIONS.filter(c => !active.includes(c.id));

    return (
        <div className={`w-cond-root ${compact ? 'is-compact' : ''} ${wide ? 'is-wide' : ''}`}>

            {/* ── Active conditions ── */}
            <div className="w-cond-active-section">
                {activeList.length === 0 ? (
                    <div className="w-cond-empty-state">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                            <path d="M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                            <path d="M9 9h.01M15 9h.01" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        </svg>
                        <span>Nessuna condizione attiva</span>
                    </div>
                ) : (
                    <div className="w-cond-chips">
                        {activeList.map(c => (
                            <div key={c.id} className={`w-cond-chip sev-${c.severity}`} title={c.hint}>
                                <DndIcon category="condition" name={c.id} size={compact ? 14 : 18} className="w-cond-chip-icon" />
                                <span className="w-cond-chip-label">{c.label}</span>
                                {!compact && <span className="w-cond-chip-hint">{c.hint}</span>}
                                <button
                                    className="w-cond-chip-remove"
                                    onClick={() => remove(c.id)}
                                    aria-label={`Rimuovi ${c.label}`}
                                >
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                        <path d="M2 2l6 6M8 2l-6 6" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            {poolList.length > 0 && (
                <div className="w-cond-divider">
                    <span>Aggiungi condizione</span>
                </div>
            )}

            {/* ── Condition pool ── */}
            {poolList.length > 0 && (
                <div className="w-cond-pool w-scroll">
                    {poolList.map(c => (
                        <button
                            key={c.id}
                            className={`w-cond-tile sev-${c.severity}`}
                            onClick={() => add(c.id)}
                            title={`${c.label} — ${c.hint}`}
                            aria-label={`Aggiungi ${c.label}`}
                        >
                            <DndIcon category="condition" name={c.id} size={compact ? 18 : 22} className="w-cond-tile-icon" />
                            <span className="w-cond-tile-label">{c.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
