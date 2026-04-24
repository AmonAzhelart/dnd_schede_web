import React, { useState } from 'react';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';

interface ConditionDef {
    id: string;       // icon slug
    label: string;    // Italian label
    hint: string;     // brief mechanical hint
    severity: 'minor' | 'moderate' | 'severe';
}

const CONDITIONS: ConditionDef[] = [
    { id: 'blinded', label: 'Accecato', hint: '-2 CA, manca attacchi', severity: 'moderate' },
    { id: 'charmed', label: 'Affascinato', hint: 'Non può attaccare la fonte', severity: 'minor' },
    { id: 'deafened', label: 'Assordato', hint: '-4 iniziativa, perde suoni', severity: 'minor' },
    { id: 'exhaustion', label: 'Affaticato', hint: 'Penalità a TS Tempra', severity: 'moderate' },
    { id: 'frightened', label: 'Spaventato', hint: 'Fugge o -2 attacco/TS', severity: 'moderate' },
    { id: 'grappled', label: 'Alle Prese', hint: '-4 DES, velocità 0', severity: 'moderate' },
    { id: 'incapacitated', label: 'Incapacitato', hint: 'Nessuna azione possibile', severity: 'severe' },
    { id: 'invisible', label: 'Invisibile', hint: '+2 attacco, -2 CA vs nemici', severity: 'minor' },
    { id: 'paralyzed', label: 'Paralizzato', hint: 'STR/DES 0, CA -4, no azioni', severity: 'severe' },
    { id: 'petrified', label: 'Pietrificato', hint: 'Trasformato in pietra', severity: 'severe' },
    { id: 'poisoned', label: 'Avvelenato', hint: 'Penalità variabile al veleno', severity: 'moderate' },
    { id: 'prone', label: 'Prono', hint: '-4 attacco in mischia', severity: 'minor' },
    { id: 'restrained', label: 'Trattenuto', hint: 'Velocità 0, -2 attacco/CA', severity: 'moderate' },
    { id: 'silenced', label: 'Silenziato', hint: 'Nessuna componente verbale', severity: 'moderate' },
    { id: 'sleep', label: 'Addormentato', hint: 'Incosciente, può svegliarsi', severity: 'severe' },
    { id: 'stunned', label: 'Stordito', hint: 'Perde azioni, CA -2', severity: 'severe' },
    { id: 'unconscious', label: 'Privo di Sensi', hint: 'Come paralizzato + morente', severity: 'severe' },
];

const SEVERITY_ORDER: Record<string, number> = { minor: 0, moderate: 1, severe: 2 };

export const ConditionsWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const [active, setActive] = useState<string[]>([]);

    const compact = size.pixelW < 300 || size.pixelH < 200;
    const wide = size.size === 'lg' || size.size === 'xl';

    const add = (id: string) => setActive(p => [...p, id]);
    const remove = (id: string) => setActive(p => p.filter(x => x !== id));

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
