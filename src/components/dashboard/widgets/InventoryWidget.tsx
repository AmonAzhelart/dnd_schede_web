import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { GiSwordWound, GiChestArmor, GiPotionBall, GiSwapBag, GiScrollQuill, GiRing } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import { useIconCatalog, sanitizeSvg } from '../../../services/iconCache';
import type { WidgetRenderProps, WidgetSize } from '../widgetTypes';

const colsFor = (size: WidgetSize) =>
    size.pixelW < 240 ? 1 : size.pixelW < 480 ? 2 : 3;

const iconFor = (type?: string): React.ReactNode => {
    switch (type) {
        case 'weapon': return <GiSwordWound />;
        case 'armor':
        case 'shield':
        case 'protectiveItem': return <GiChestArmor />;
        case 'potion':
        case 'consumable': return <GiPotionBall />;
        case 'scroll': return <GiScrollQuill />;
        case 'ring':
        case 'wondrous': return <GiRing />;
        default: return <GiSwapBag />;
    }
};

export const InventoryWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character } = useCharacterStore();
    const { resolveItemSvg } = useIconCatalog();
    const [q, setQ] = useState('');
    if (!character) return null;
    const equipped = character.inventory.filter(i => i.equipped);
    const carried = character.inventory.filter(i => !i.equipped);
    const f = (s: string) => s.toLowerCase().includes(q.toLowerCase());
    const fEq = q ? equipped.filter(i => f(i.name)) : equipped;
    const fCa = q ? carried.filter(i => f(i.name)) : carried;
    const totalWeight = character.inventory.reduce((s, i) => s + (i.weight ?? 0) * (i.quantity ?? 1), 0);
    const cols = colsFor(size);

    const renderIcon = (item: { type?: string; iconId?: string; weaponDetails?: any }) => {
        const svg = resolveItemSvg(item as any);
        if (svg) {
            return <span className="w-inv-icon inv-svg-tinted" dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }} />;
        }
        return <span className="w-inv-icon">{iconFor(item.type)}</span>;
    };

    return (
        <div className="w-inv-root">
            <div className="w-meta">
                <span><strong>{character.inventory.length}</strong> oggetti</span>
                <span>·</span>
                <span><strong>{totalWeight.toFixed(1)}</strong> kg</span>
                {goTo && <button className="w-link" style={{ marginLeft: 'auto' }} onClick={() => goTo('inventory')}>Apri</button>}
            </div>
            <div className="w-search-wrap">
                <FaSearch size={10} />
                <input className="input w-search" placeholder="Cerca…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="w-scroll">
                {fEq.length > 0 && (
                    <>
                        <div className="w-inv-section-title">Equipaggiato</div>
                        <div className="w-inv-list" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                            {fEq.map(item => (
                                <div key={item.id} className="w-inv-row equipped">
                                    {renderIcon(item)}
                                    <span className="w-inv-name">{item.name}</span>
                                    {item.weight != null && <span className="w-inv-weight">{item.weight}kg</span>}
                                </div>
                            ))}
                        </div>
                    </>
                )}
                {fCa.length > 0 && (
                    <>
                        <div className="w-inv-section-title">Nello zaino</div>
                        <div className="w-inv-list" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                            {fCa.map(item => (
                                <div key={item.id} className="w-inv-row">
                                    {renderIcon(item)}
                                    <span className="w-inv-name">
                                        {item.quantity && item.quantity > 1 && <span className="qty">{item.quantity}×</span>}
                                        {item.name}
                                    </span>
                                    {item.weight != null && <span className="w-inv-weight">{item.weight}kg</span>}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
