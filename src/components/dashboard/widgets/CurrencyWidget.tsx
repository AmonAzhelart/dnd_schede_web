import React from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

const COINS = [
    { key: 'platinum', short: 'mp', name: 'Platino' },
    { key: 'gold', short: 'mo', name: 'Oro' },
    { key: 'silver', short: 'ma', name: 'Argento' },
    { key: 'copper', short: 'mr', name: 'Rame' },
] as const;

export const CurrencyWidget: React.FC<WidgetRenderProps> = ({ size, goTo }) => {
    const { character, setCurrency } = useCharacterStore();
    if (!character) return null;
    const cur = character.currency ?? { platinum: 0, gold: 0, silver: 0, copper: 0 };
    const totalGp =
        (cur.platinum ?? 0) * 10 +
        (cur.gold ?? 0) +
        (cur.silver ?? 0) / 10 +
        (cur.copper ?? 0) / 100;
    const showTotal = size.h >= 4;
    const compact = size.h <= 2;

    const navigateToCurrency = () => {
        // Tell Inventory to show the currency tab on mount/now.
        (window as unknown as { __pendingInventoryTab?: string }).__pendingInventoryTab = 'currency';
        window.dispatchEvent(new CustomEvent('inventory:setTab', { detail: 'currency' }));
        goTo?.('inventory');
    };

    if (compact) {
        return (
            <button
                type="button"
                className="w-coin-root w-coin-compact"
                data-rows={size.h}
                onClick={navigateToCurrency}
                title={`Apri inventario monete \u2014 Totale: ${totalGp.toFixed(2)} mo`}
            >
                {COINS.map(({ key, short, name }) => (
                    <div key={key} className="w-coin-compact-chip" data-coin={key} title={`${name}: ${cur[key] ?? 0}`}>
                        <span className="w-coin-compact-short">{short}</span>
                        <span className="w-coin-compact-val">{cur[key] ?? 0}</span>
                    </div>
                ))}
            </button>
        );
    }

    return (
        <div className="w-coin-root">
            <div className="w-coin-stack">
                {COINS.map(({ key, short, name }) => (
                    <div key={key} className="w-coin-line" data-coin={key}>
                        <span className="w-coin-disc" aria-hidden>
                            <span className="w-coin-disc-glyph">{short}</span>
                        </span>
                        <div className="w-coin-line-info">
                            <span className="w-coin-line-name">{name}</span>
                        </div>
                        <input
                            type="number" min={0}
                            className="input w-coin-line-input"
                            value={cur[key] ?? 0}
                            onChange={e => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setCurrency({ ...cur, [key]: val });
                            }}
                        />
                    </div>
                ))}
            </div>
            {showTotal && (
                <button
                    type="button"
                    className="w-coin-summary w-coin-summary-btn"
                    onClick={navigateToCurrency}
                    title="Apri inventario monete"
                >
                    <span className="w-coin-summary-lbl">Totale</span>
                    <span className="w-coin-summary-val">{totalGp.toFixed(2)}</span>
                    <span className="w-coin-summary-unit">mo</span>
                </button>
            )}
        </div>
    );
};
