import React from 'react';
import { GiWalk, GiFeather, GiWaveSurfer, GiMountainClimbing, GiMineralPearls } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

const MODES = [
    { key: 'base', label: 'Terra', icon: <GiWalk /> },
    { key: 'fly', label: 'Volo', icon: <GiFeather /> },
    { key: 'swim', label: 'Nuoto', icon: <GiWaveSurfer /> },
    { key: 'climb', label: 'Scalata', icon: <GiMountainClimbing /> },
    { key: 'burrow', label: 'Scavare', icon: <GiMineralPearls /> },
] as const;

const MAX_FOR_BAR = 30;

export const MovementWidget: React.FC<WidgetRenderProps> = () => {
    const { character, setMovement } = useCharacterStore();
    if (!character) return null;
    const movement = (character.movement ?? { base: 0 }) as Record<string, number | undefined>;
    const max = Math.max(MAX_FOR_BAR, ...MODES.map(m => movement[m.key] ?? 0));

    return (
        <div className="w-move-root">
            {MODES.map(({ key, label, icon }) => {
                const val = movement[key] ?? 0;
                const pct = Math.min(100, (val / max) * 100);
                return (
                    <div key={key} className="w-move-row">
                        <span className="w-move-icon">{icon}</span>
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
