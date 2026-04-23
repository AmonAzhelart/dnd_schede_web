import React, { useState } from 'react';
import { GiShield, GiBiceps, GiRunningNinja, GiBrain } from 'react-icons/gi';
import { FaEdit } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

const SAVES = [
    { key: 'fortitude', name: 'Tempra', short: 'TEM', icon: <GiBiceps /> },
    { key: 'reflex', name: 'Riflessi', short: 'RIF', icon: <GiRunningNinja /> },
    { key: 'will', name: 'Volontà', short: 'VOL', icon: <GiBrain /> },
] as const;

export const DefensesWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character, getEffectiveStat, setSavingThrow } = useCharacterStore();
    const [editSave, setEditSave] = useState<string | null>(null);
    if (!character) return null;
    const equippedArmor = character.inventory.filter(i =>
        i.equipped && (i.type === 'armor' || i.type === 'shield' || i.type === 'protectiveItem'),
    );
    const wide = size.size === 'lg' || size.size === 'xl';

    return (
        <div className="w-def-root">
            <div className="w-def-shield" onClick={() => goTo?.('combat')}>
                <GiShield className="w-def-shield-icon" />
                <div className="w-def-shield-info">
                    <div className="w-def-shield-label">Classe Armatura</div>
                    <div className="w-def-shield-value">{getEffectiveStat('ac')}</div>
                </div>
            </div>

            <div className="w-def-saves">
                {SAVES.map(({ key, name, short, icon }) => {
                    const total = getEffectiveStat(key);
                    const breakdown = character.savingThrows?.[key];
                    return (
                        <div key={key}>
                            <div className={`w-def-save ${key}`}>
                                <button
                                    className="w-def-save-edit"
                                    onClick={e => { e.stopPropagation(); setEditSave(editSave === key ? null : key); }}
                                    aria-label="Modifica"
                                ><FaEdit size={8} /></button>
                                <div className="w-def-save-icon">{icon}</div>
                                <div className="w-def-save-val">{total >= 0 ? '+' : ''}{total}</div>
                                <div className="w-def-save-name">{wide ? name : short}</div>
                            </div>
                            {editSave === key && (
                                <div className="w-def-edit-panel">
                                    {(['base', 'ability', 'magic', 'misc'] as const).map(field => (
                                        <div key={field} className="w-def-edit-field">
                                            <label>{field === 'base' ? 'B' : field === 'ability' ? 'Car' : field === 'magic' ? 'Mag' : 'Alt'}</label>
                                            <input
                                                type="number"
                                                className="input"
                                                defaultValue={breakdown?.[field] ?? 0}
                                                onBlur={e => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    const cur = character.savingThrows?.[key] ?? { base: 0, ability: 0, magic: 0, misc: 0 };
                                                    setSavingThrow(key, { ...cur, [field]: val });
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {equippedArmor.length > 0 && size.h > 4 && (
                <div className="w-def-armors">
                    {equippedArmor.map(a => (
                        <div key={a.id} className="w-def-armor-row">
                            <span className="name">{a.name}</span>
                            {a.armorDetails && <span className="bonus">+{a.armorDetails.armorBonus}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
