import type { ModifierType } from '../types/dnd';

export interface ConditionModifier {
    target: string;
    value: number;
    type: ModifierType;
}

export interface ConditionDef {
    id: string;
    label: string;
    hint: string;
    severity: 'minor' | 'moderate' | 'severe';
    modifiers: ConditionModifier[];
}

export const CONDITIONS: ConditionDef[] = [
    {
        id: 'blinded', label: 'Accecato', severity: 'moderate',
        hint: '-4 attacco, -2 CA (schivata)',
        modifiers: [
            { target: 'attack', value: -4, type: 'untyped' },
            { target: 'ac',     value: -2, type: 'dodge'   },
        ],
    },
    {
        id: 'charmed', label: 'Affascinato', severity: 'minor',
        hint: 'Non può attaccare la fonte',
        modifiers: [],
    },
    {
        id: 'deafened', label: 'Assordato', severity: 'minor',
        hint: '-4 iniziativa',
        modifiers: [
            { target: 'initiative', value: -4, type: 'untyped' },
        ],
    },
    {
        id: 'exhaustion', label: 'Affaticato', severity: 'moderate',
        hint: '-6 FOR e DES',
        modifiers: [
            { target: 'str', value: -6, type: 'untyped' },
            { target: 'dex', value: -6, type: 'untyped' },
        ],
    },
    {
        id: 'frightened', label: 'Spaventato', severity: 'moderate',
        hint: '-2 attacchi e TS (morale)',
        modifiers: [
            { target: 'attack',    value: -2, type: 'morale' },
            { target: 'fortitude', value: -2, type: 'morale' },
            { target: 'reflex',    value: -2, type: 'morale' },
            { target: 'will',      value: -2, type: 'morale' },
        ],
    },
    {
        id: 'grappled', label: 'Alle Prese', severity: 'moderate',
        hint: '-4 DES, velocità 0',
        modifiers: [
            { target: 'dex', value: -4, type: 'untyped' },
        ],
    },
    {
        id: 'incapacitated', label: 'Incapacitato', severity: 'severe',
        hint: 'Nessuna azione possibile',
        modifiers: [],
    },
    {
        id: 'invisible', label: 'Invisibile', severity: 'minor',
        hint: '+2 attacchi (circostanza)',
        modifiers: [
            { target: 'attack', value: 2, type: 'circumstance' },
        ],
    },
    {
        id: 'paralyzed', label: 'Paralizzato', severity: 'severe',
        hint: 'FOR/DES -10, CA -4',
        modifiers: [
            { target: 'str', value: -10, type: 'untyped' },
            { target: 'dex', value: -10, type: 'untyped' },
            { target: 'ac',  value: -4,  type: 'dodge'   },
        ],
    },
    {
        id: 'petrified', label: 'Pietrificato', severity: 'severe',
        hint: 'Trasformato in pietra, CA -4',
        modifiers: [
            { target: 'ac', value: -4, type: 'dodge' },
        ],
    },
    {
        id: 'poisoned', label: 'Avvelenato', severity: 'moderate',
        hint: '-2 TS Tempra',
        modifiers: [
            { target: 'fortitude', value: -2, type: 'untyped' },
        ],
    },
    {
        id: 'prone', label: 'Prono', severity: 'minor',
        hint: '-4 attacco in mischia',
        modifiers: [
            { target: 'attack', value: -4, type: 'untyped' },
        ],
    },
    {
        id: 'restrained', label: 'Trattenuto', severity: 'moderate',
        hint: '-2 attacco e CA, velocità 0',
        modifiers: [
            { target: 'attack', value: -2, type: 'untyped' },
            { target: 'ac',     value: -2, type: 'dodge'   },
        ],
    },
    {
        id: 'silenced', label: 'Silenziato', severity: 'moderate',
        hint: 'Nessuna componente verbale',
        modifiers: [],
    },
    {
        id: 'sleep', label: 'Addormentato', severity: 'severe',
        hint: 'Incosciente, CA -4',
        modifiers: [
            { target: 'ac', value: -4, type: 'dodge' },
        ],
    },
    {
        id: 'stunned', label: 'Stordito', severity: 'severe',
        hint: 'Perde azioni, CA -2',
        modifiers: [
            { target: 'ac', value: -2, type: 'dodge' },
        ],
    },
    {
        id: 'unconscious', label: 'Privo di Sensi', severity: 'severe',
        hint: 'Come paralizzato, CA -4',
        modifiers: [
            { target: 'ac', value: -4, type: 'dodge' },
        ],
    },
];

export const SEVERITY_ORDER: Record<string, number> = { minor: 0, moderate: 1, severe: 2 };

/** Pre-built map for fast lookup by condition id — derived from CONDITIONS. */
export const CONDITION_MODIFIERS: Record<string, { target: string; value: number; type: ModifierType; label: string }[]> =
    Object.fromEntries(
        CONDITIONS
            .filter(c => c.modifiers.length > 0)
            .map(c => [c.id, c.modifiers.map(m => ({ ...m, label: c.label }))])
    );
