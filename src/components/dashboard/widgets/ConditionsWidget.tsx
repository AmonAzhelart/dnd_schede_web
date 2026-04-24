import React, { useState } from 'react';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon, getDndIconSvg } from '../../DndIcon';

const CONDITION_LIST = [
    'Affaticato', 'Esausto', 'Prono', 'Accecato', 'Confuso', 'Stordito',
    'Paralizzato', 'Malato', 'Avvelenato', 'Impaurito', 'Nauseato',
];

/** Map Italian condition names to the english slug used by the bundled SVG set. */
const CONDITION_ICON: Record<string, string> = {
    'Affaticato': 'exhaustion',
    'Esausto': 'exhaustion',
    'Prono': 'prone',
    'Accecato': 'blinded',
    'Confuso': 'charmed',
    'Stordito': 'stunned',
    'Paralizzato': 'paralyzed',
    'Malato': 'poisoned',
    'Avvelenato': 'poisoned',
    'Impaurito': 'frightened',
    'Nauseato': 'incapacitated',
};

const iconFor = (cond: string): string | undefined => {
    const slug = CONDITION_ICON[cond];
    return slug && getDndIconSvg('condition', slug) ? slug : undefined;
};

export const ConditionsWidget: React.FC<WidgetRenderProps> = () => {
    const [conditions, setConditions] = useState<string[]>([]);
    return (
        <div className="w-cond-root">
            <div className="w-cond-active">
                {conditions.length === 0 && (
                    <div className="w-cond-empty">Nessuna condizione attiva</div>
                )}
                {conditions.map(c => {
                    const ic = iconFor(c);
                    return (
                        <span key={c} className="w-cond-chip">
                            {ic && <DndIcon category="condition" name={ic} size={14} style={{ marginRight: 4 }} />}
                            {c}
                            <button
                                className="w-cond-chip-x"
                                onClick={() => setConditions(conds => conds.filter(x => x !== c))}
                                aria-label={`Rimuovi ${c}`}
                            >×</button>
                        </span>
                    );
                })}
            </div>
            <div className="w-cond-pool">
                {CONDITION_LIST.filter(c => !conditions.includes(c)).map(c => {
                    const ic = iconFor(c);
                    return (
                        <button key={c} className="w-cond-add" onClick={() => setConditions(conds => [...conds, c])}>
                            {ic ? <DndIcon category="condition" name={ic} size={12} style={{ marginRight: 3 }} /> : '+ '}
                            {c}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
