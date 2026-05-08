import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import { DndIcon } from '../../DndIcon';
import { useModifierAura, ModifierArrows } from './ModifierAura';
import { saveCharacterToDb } from '../../../services/db';
import type { Movement } from '../../../types/dnd';
import { FaPencilAlt, FaCheck } from 'react-icons/fa';

const MODES = [
    { key: 'base', label: 'Terra', iconName: 'walking' },
    { key: 'fly', label: 'Volo', iconName: 'flying' },
    { key: 'swim', label: 'Nuoto', iconName: 'swimming' },
    { key: 'climb', label: 'Scalata', iconName: 'climbing' },
    { key: 'burrow', label: 'Scava', iconName: 'burrowing' },
] as const;

type MoveKey = (typeof MODES)[number]['key'];
const MAX_FOR_BAR = 30;

export const MovementWidget: React.FC<WidgetRenderProps> = ({ size }) => {
    const { character, setMovement } = useCharacterStore();
    const speedAura = useModifierAura('speed');

    const movement = (character?.movement ?? { base: 0 }) as Record<string, number | undefined>;

    const [draft, setDraft] = useState<Record<MoveKey, string>>({
        base: '0', fly: '0', swim: '0', climb: '0', burrow: '0',
    });
    const [editMode, setEditMode] = useState(false);
    const [flash, setFlash] = useState(false);

    // Sync draft when a different character is loaded
    useEffect(() => {
        if (!character) return;
        const mv = (character.movement ?? { base: 0 }) as Record<string, number | undefined>;
        setDraft({
            base: String(mv.base ?? 0),
            fly: String(mv.fly ?? 0),
            swim: String(mv.swim ?? 0),
            climb: String(mv.climb ?? 0),
            burrow: String(mv.burrow ?? 0),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [character?.id]);

    if (!character) return null;

    const commit = (key: MoveKey, rawVal: string) => {
        const val = Math.max(0, parseInt(rawVal) || 0);
        setDraft(d => ({ ...d, [key]: String(val) }));
        const newMovement: Movement = { ...(character.movement ?? { base: 0 }), [key]: val } as Movement;
        setMovement(newMovement);
        const updated = useCharacterStore.getState().character;
        if (updated) {
            saveCharacterToDb(updated);
            setFlash(true);
            setTimeout(() => setFlash(false), 900);
        }
    };

    const step = (key: MoveKey, delta: number) => {
        commit(key, String(Math.max(0, (movement[key] ?? 0) + delta)));
    };

    const effectiveBase = (movement.base ?? 0) + speedAura.delta;
    const max = Math.max(MAX_FOR_BAR, ...MODES.map(m => movement[m.key] ?? 0));
    const compact = size.pixelW < 230;

    const visibleModes = editMode
        ? MODES
        : MODES.filter(m => m.key === 'base' || (movement[m.key] ?? 0) > 0);

    return (
        <div className={`w-move-root${compact ? ' compact' : ''}${editMode ? ' is-editing' : ''}`}>
            <div className="w-move-toolbar">
                <span className={`w-move-flash${flash ? ' visible' : ''}`}>✓ salvato</span>
                <button
                    className={`w-move-edit-btn${editMode ? ' active' : ''}`}
                    onClick={() => setEditMode(e => !e)}
                    title={editMode ? 'Conferma' : 'Modifica velocità'}
                >
                    {editMode ? <FaCheck size={9} /> : <FaPencilAlt size={9} />}
                </button>
            </div>

            <div className="w-move-rows">
                {visibleModes.map(({ key, label, iconName }) => {
                    const val = movement[key] ?? 0;
                    const isBase = key === 'base';
                    const effectiveVal = isBase ? effectiveBase : val;
                    const pct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
                    const isBaseAura = isBase && !!speedAura.auraClass;
                    const inactive = val === 0;

                    return (
                        <div
                            key={key}
                            className={`w-move-row${isBaseAura ? ` ${speedAura.auraClass}` : ''}${inactive ? ' inactive' : ''}`}
                            style={isBaseAura ? { position: 'relative', overflow: 'hidden' } : undefined}
                        >
                            {isBaseAura && <ModifierArrows delta={speedAura.delta} count={3} />}

                            <span className="w-move-icon">
                                <DndIcon category="movement" name={iconName} size={16} />
                            </span>

                            <span className="w-move-label">{label}</span>

                            <div className="w-move-bar">
                                <div
                                    className="w-move-bar-fill"
                                    style={{ width: `${pct}%`, opacity: inactive ? 0.15 : 1 }}
                                />
                            </div>

                            {!editMode ? (
                                <span className="w-move-val">
                                    <span className={
                                        'w-move-num' +
                                        (isBaseAura && speedAura.delta > 0 ? ' aura-buff' : '') +
                                        (isBaseAura && speedAura.delta < 0 ? ' aura-debuff' : '')
                                    }>
                                        {effectiveVal}
                                    </span>
                                    <span className="unit">m</span>
                                </span>
                            ) : (
                                <div className="w-move-stepper">
                                    <button
                                        className="w-move-step"
                                        onClick={() => step(key, -5)}
                                        disabled={val === 0}
                                        tabIndex={-1}
                                    >−</button>
                                    <input
                                        type="number"
                                        min={0}
                                        step={5}
                                        className="input w-move-input"
                                        value={draft[key]}
                                        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                                        onBlur={e => commit(key, e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') commit(key, (e.target as HTMLInputElement).value);
                                        }}
                                    />
                                    <button
                                        className="w-move-step"
                                        onClick={() => step(key, 5)}
                                        tabIndex={-1}
                                    >+</button>
                                    <span className="unit">m</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {!editMode && visibleModes.length < MODES.length && (
                <button className="w-move-more" onClick={() => setEditMode(true)}>
                    + aggiungi velocità
                </button>
            )}
        </div>
    );
};
