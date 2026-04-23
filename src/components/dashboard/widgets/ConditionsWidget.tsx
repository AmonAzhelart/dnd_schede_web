import React, { useState } from 'react';
import type { WidgetRenderProps } from '../widgetTypes';

const CONDITION_LIST = [
    'Affaticato', 'Esausto', 'Prono', 'Accecato', 'Confuso', 'Stordito',
    'Paralizzato', 'Malato', 'Avvelenato', 'Impaurito', 'Nauseato',
];

export const ConditionsWidget: React.FC<WidgetRenderProps> = () => {
    const [conditions, setConditions] = useState<string[]>([]);
    return (
        <div className="w-cond-root">
            <div className="w-cond-active">
                {conditions.length === 0 && (
                    <div className="w-cond-empty">Nessuna condizione attiva</div>
                )}
                {conditions.map(c => (
                    <span key={c} className="w-cond-chip">
                        {c}
                        <button
                            className="w-cond-chip-x"
                            onClick={() => setConditions(conds => conds.filter(x => x !== c))}
                            aria-label={`Rimuovi ${c}`}
                        >×</button>
                    </span>
                ))}
            </div>
            <div className="w-cond-pool">
                {CONDITION_LIST.filter(c => !conditions.includes(c)).map(c => (
                    <button key={c} className="w-cond-add" onClick={() => setConditions(conds => [...conds, c])}>
                        + {c}
                    </button>
                ))}
            </div>
        </div>
    );
};
