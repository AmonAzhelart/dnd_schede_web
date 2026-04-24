import React from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';
import { useModifierAura, ModifierArrows } from './ModifierAura';

const MODES = [
    { key: 'base', label: 'Terra', iconName: 'walking' },
    { key: 'fly', label: 'Volo', iconName: 'flying' },
    { key: 'swim', label: 'Nuoto', iconName: 'swimming' },
    { key: 'climb', label: 'Scalata', iconName: 'climbing' },
    { key: 'burrow', label: 'Scavare', iconName: 'burrowing' },
] as const;

const MAX_FOR_BAR = 30;

export const MovementWidget: React.FC<WidgetRenderProps> = () => {
    const { character, setMovement } = useCharacterStore();
    const speedAura = useModifierAura('speed');
    if (!character) return null;
    const movement = (character.movement ?? { base: 0 }) as Record<string, number | undefined>;
    const max = Math.max(MAX_FOR_BAR, ...MODES.map(m => movement[m.key] ?? 0));

    return (
        <div className="w-move-root">
            {MODES.map(({ key, label, iconName }) => {
                const val = movement[key] ?? 0;
                const pct = Math.min(100, (val / max) * 100);
                const isBaseAura = key === 'base' && !!speedAura.auraClass;
                return (
                    <div
                        key={key}
                        className={`w-move-row ${isBaseAura ? speedAura.auraClass : ''}`}
                        style={isBaseAura ? { position: 'relative', overflow: 'hidden' } : undefined}
                    >
                        {isBaseAura && <ModifierArrows delta={speedAura.delta} count={3} />}
                        <span className="w-move-icon">
                            <DndIcon category="movement" name={iconName} size={18} />
                        </span>
                        <span className="w-move-label">{label}</span>
                        <div className="w-move-bar">
                            <div className="w-move-bar-fill" style={{ width: `${pct}%`, opacity: val > 0 ? 1 : 0.2 }} />
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
                            <input
                                type="number"
                                min={0}
                                className="input w-move-input"
                                value={val}
                                onChange={e => {
                                    const num = Math.max(0, parseInt(e.target.value) || 0);
                                    setMovement({ ...movement, [key]: num });
                                }}
                            />
                            <span className="unit">m</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
