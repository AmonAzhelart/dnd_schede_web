import type { StatType } from '../types/dnd';

export interface SkillPreset {
    name: string;
    stat: StatType;
    canUseUntrained: boolean;
    armorCheckPenalty: boolean;
}

/**
 * Standard D&D 3.5 / Pathfinder skill list in Italian.
 * canUseUntrained: true  → pallino ● nella scheda (usabile senza gradi)
 * armorCheckPenalty: true → penalità armatura applicata
 */
export const SKILL_PRESETS: SkillPreset[] = [
    { name: 'Acrobazia', stat: 'dex', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Addestrare Animali', stat: 'cha', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Artigianato 1', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Artigianato 2', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Artigianato 3', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Artigianato 4', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Artigianato 5', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Artigianato 6', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Artista della Fuga', stat: 'dex', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Ascoltare', stat: 'wis', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Camuffare', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Cavalcare', stat: 'dex', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Cercare', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Concentrazione', stat: 'con', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Conoscenze Arcane', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Architettura', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Dungeon', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Geografia', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Locali', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Natura', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Nobiltà e Regalità', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Piani', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Religioni', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Conoscenze Storia', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Decifrare Scritture', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Diplomazia', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Disattivare Congegni', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Equilibrio', stat: 'dex', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Falsificare', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Guarire', stat: 'wis', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intimidire', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intrattenere (Danza)', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intrattenere 2', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intrattenere 3', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intrattenere 4', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intrattenere 5', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Intrattenere 6', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Muoversi Silenziosamente', stat: 'dex', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Nascondersi', stat: 'dex', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Nuotare', stat: 'str', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Osservare', stat: 'wis', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Parlare Linguaggi', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Percepire Intenzioni', stat: 'wis', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Professione 1', stat: 'wis', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Professione 2', stat: 'wis', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Raccogliere Informazioni', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Raggirare', stat: 'cha', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Rapidità di Mano', stat: 'dex', canUseUntrained: false, armorCheckPenalty: true },
    { name: 'Saltare', stat: 'str', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Sapienza Magica', stat: 'int', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Scalare', stat: 'str', canUseUntrained: true, armorCheckPenalty: true },
    { name: 'Scassinare Serrature', stat: 'dex', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Sopravvivenza', stat: 'wis', canUseUntrained: true, armorCheckPenalty: false },
    { name: 'Utilizzare Corde', stat: 'dex', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Utilizzare Oggetti Magici', stat: 'cha', canUseUntrained: false, armorCheckPenalty: false },
    { name: 'Valutare', stat: 'int', canUseUntrained: true, armorCheckPenalty: false },
];
