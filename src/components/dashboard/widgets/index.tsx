import React from 'react';
import { FaHeart, FaStar, FaCoins, FaLanguage } from 'react-icons/fa';
import {
    GiSwordman, GiAxeSword, GiSpellBook, GiTreasureMap, GiWalk,
    GiHealthPotion, GiShield, GiBrain, GiAbstract024,
} from 'react-icons/gi';
import type { WidgetDefinition } from '../widgetTypes';

import { HpWidget } from './HpWidget';
import { DefensesWidget } from './DefensesWidget';
import { ConditionsWidget } from './ConditionsWidget';
import { AttacksWidget } from './AttacksWidget';
import { SpellSlotsWidget } from './SpellSlotsWidget';
import { AbilitiesWidget } from './AbilitiesWidget';
import { StatsWidget } from './StatsWidget';
import { SkillsWidget } from './SkillsWidget';
import { InventoryWidget } from './InventoryWidget';
import { CurrencyWidget } from './CurrencyWidget';
import { LanguagesWidget } from './LanguagesWidget';
import { MovementWidget } from './MovementWidget';
import { NotesWidget } from './NotesWidget';

import './widgets.css';

export const WIDGET_CATALOG: WidgetDefinition[] = [
    { id: 'hp', title: 'Punti Ferita', description: 'HP correnti, max, temporanei', icon: <FaHeart />, defaultW: 3, defaultH: 4, minW: 2, minH: 2, render: HpWidget, accent: 'var(--accent-crimson)' },
    { id: 'defenses', title: 'Difese', description: 'CA e tiri salvezza', icon: <GiShield />, defaultW: 3, defaultH: 5, minW: 2, minH: 3, render: DefensesWidget, accent: 'var(--accent-gold)' },
    { id: 'conditions', title: 'Condizioni', description: 'Stati attivi sul personaggio', icon: <GiHealthPotion />, defaultW: 3, defaultH: 4, minW: 2, minH: 3, render: ConditionsWidget, accent: 'var(--accent-success)' },
    { id: 'attacks', title: 'Attacchi', description: 'Armi equipaggiate e tiri', icon: <GiAxeSword />, defaultW: 6, defaultH: 6, minW: 3, minH: 3, render: AttacksWidget, accent: 'var(--accent-crimson)' },
    { id: 'spellSlots', title: 'Slot Incantesimo', description: 'Slot per livello e preparati', icon: <GiSpellBook />, defaultW: 3, defaultH: 6, minW: 2, minH: 3, render: SpellSlotsWidget, accent: 'var(--accent-arcane)' },
    { id: 'abilities', title: 'Privilegi di Classe', description: 'Capacità attive, passive, talenti e opzioni di personalizzazione', icon: <GiAbstract024 />, defaultW: 4, defaultH: 7, minW: 2, minH: 3, render: AbilitiesWidget, accent: 'var(--accent-arcane)' },
    { id: 'stats', title: 'Caratteristiche', description: 'For/Des/Cos/Int/Sag/Car', icon: <GiBrain />, defaultW: 3, defaultH: 4, minW: 2, minH: 3, render: StatsWidget, accent: 'var(--accent-gold)' },
    { id: 'skills', title: 'Abilità', description: 'Lista abilità ordinata', icon: <FaStar />, defaultW: 3, defaultH: 8, minW: 2, minH: 4, render: SkillsWidget, accent: 'var(--accent-gold)' },
    { id: 'inventory', title: 'Inventario', description: 'Oggetti equipaggiati e zaino', icon: <GiTreasureMap />, defaultW: 4, defaultH: 7, minW: 2, minH: 4, render: InventoryWidget, accent: 'var(--accent-gold)' },
    { id: 'currency', title: 'Monete', description: 'Monete del personaggio', icon: <FaCoins />, defaultW: 2, defaultH: 4, minW: 2, minH: 1, render: CurrencyWidget, accent: 'var(--accent-gold)' },
    { id: 'languages', title: 'Lingue', description: 'Lingue conosciute', icon: <FaLanguage />, defaultW: 3, defaultH: 4, minW: 2, minH: 3, render: LanguagesWidget, accent: 'var(--accent-arcane)' },
    { id: 'movement', title: 'Movimento', description: 'Velocità e modalità', icon: <GiWalk />, defaultW: 2, defaultH: 4, minW: 2, minH: 3, render: MovementWidget, accent: 'var(--accent-success)' },
    { id: 'notes', title: 'Note', description: 'Bloc-notes della sessione', icon: <GiSwordman />, defaultW: 4, defaultH: 6, minW: 2, minH: 3, render: NotesWidget, accent: 'var(--accent-arcane)' },
];

export const getWidgetDef = (id: string) => {
    // Backward-compat: legacy 'feats' and 'classFeatures' widgets were merged into 'abilities'.
    if (id === 'feats' || id === 'classFeatures') id = 'abilities';
    return WIDGET_CATALOG.find(w => w.id === id);
};
