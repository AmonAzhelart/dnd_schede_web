/**
 * One-shot seeding helpers for the Firestore catalog collections.
 *
 * Usage from BackOffice:
 *   import { seedAll } from '../services/seedCatalogs';
 *   await seedAll({ overwrite: false });
 *
 * The seed converts the in-memory wizard data (RACES / CLASSES /
 * ALL_LANGUAGES_POOL) into the multilingual `Catalog*` shape used by
 * Firestore, so populated documents are immediately editable from the
 * BackOffice panels.
 */

import {
    raceCatalog, classCatalog, languageCatalog, skillCatalog, featCatalog,
    type CatalogRace, type CatalogClass, type CatalogLanguage, type CatalogSkill, type CatalogFeat,
    type RaceAbilityMod,
} from './admin';
import { RACES, CLASSES, ALL_LANGUAGES_POOL } from '../components/wizard/CharacterWizard';
import { SKILL_PRESETS } from '../data/skillPresets';

// ─── slug helpers ────────────────────────────────────────────────────────────

function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// ─── builders ────────────────────────────────────────────────────────────────

function buildLanguageDocs(): CatalogLanguage[] {
    return ALL_LANGUAGES_POOL.map(name => ({
        id: slugify(name),
        name,
    }));
}

function languageIdsFromNames(names: string[]): string[] {
    return names.map(slugify);
}

function buildRaceDocs(): CatalogRace[] {
    return RACES.map(r => {
        const abilityMods: RaceAbilityMod[] = (Object.entries(r.bonuses) as Array<[
            'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha',
            number,
        ]>).map(([stat, value]) => ({ stat, value }));

        const size: 'Piccola' | 'Media' = r.small ? 'Piccola' : 'Media';

        const racialFeats = r.extraFeat
            ? [{ id: 'bonus_feat', name: 'Talento bonus al 1° livello' }]
            : [];

        return {
            id: slugify(r.name),
            name: r.name,
            description: r.desc,
            size,
            speed: r.speed,
            abilityMods,
            automaticLanguages: languageIdsFromNames(r.racialLanguages),
            bonusLanguages: [], // wizard does not track these explicitly
            racialFeats,
            notes: r.category === 'phb'
                ? 'PHB Core'
                : r.category === 'fr'
                    ? 'Forgotten Realms'
                    : r.category === 'exotic'
                        ? 'Esotica'
                        : '',
        };
    });
}

function buildClassDocs(): CatalogClass[] {
    return CLASSES.map(c => {
        const hitDie = (c.hitDie as 4 | 6 | 8 | 10 | 12);
        return {
            id: slugify(c.eng || c.name),
            name: { it: c.name, en: c.eng },
            description: c.desc,
            hitDie,
            babProgression: c.bab,
            fortitude: c.fort,
            reflex: c.ref,
            will: c.will,
            skillPointsPerLevel: c.sp,
            classSkillIds: c.classSkills,
            featuresByLevel: [],   // populated incrementally from BackOffice
            startingEquipment: [],
            bonusFeats: [],
        };
    });
}

// ─── public API ──────────────────────────────────────────────────────────────

export interface SeedReport {
    languages: { written: number; skipped: number };
    races:     { written: number; skipped: number };
    classes:   { written: number; skipped: number };
    skills:    { written: number; skipped: number };
    feats:     { written: number; skipped: number };
}

function buildSkillDocs(): CatalogSkill[] {
    return SKILL_PRESETS.map(sp => ({
        id: slugify(sp.name),
        name: sp.name,
        stat: sp.stat,
        canUseUntrained: sp.canUseUntrained,
        armorCheckPenalty: sp.armorCheckPenalty,
    }));
}

/* ── A small starter set of generic D&D 3.5 feats. The user is expected to
 *   expand this from the BackOffice; it just bootstraps the wizard so the
 *   "talenti iniziali" picker is not empty on a fresh install.
 *
 *   Modifiers follow the real `Modifier` shape: { target, value, type, source }.
 *   They are wired so that the dashboard widgets (HpWidget / DefensesWidget /
 *   ModifiersWidget) pick them up automatically when the feat is `active`. */
const STARTER_FEATS: Omit<CatalogFeat, 'id'>[] = [
    {
        name: 'Iniziativa Migliorata',
        description: 'Bonus +4 ai tiri di iniziativa.',
        modifiers: [{ target: 'initiative', value: 4, type: 'untyped', source: 'Iniziativa Migliorata' }],
    },
    {
        name: 'Volontà di Ferro',
        description: 'Bonus +2 ai tiri salvezza sulla Volontà.',
        modifiers: [{ target: 'will', value: 2, type: 'untyped', source: 'Volontà di Ferro' }],
    },
    {
        name: 'Riflessi Fulminei',
        description: 'Bonus +2 ai tiri salvezza sui Riflessi.',
        modifiers: [{ target: 'reflex', value: 2, type: 'untyped', source: 'Riflessi Fulminei' }],
    },
    {
        name: 'Tempra Possente',
        description: 'Bonus +2 ai tiri salvezza sulla Tempra.',
        modifiers: [{ target: 'fortitude', value: 2, type: 'untyped', source: 'Tempra Possente' }],
    },
    {
        name: 'Robustezza',
        description: '+3 punti ferita permanenti.',
        modifiers: [{ target: 'hp', value: 3, type: 'untyped', source: 'Robustezza' }],
    },
    {
        name: 'Schivare',
        description: '+1 schivata alla CA contro un avversario designato. Prerequisito: Des 13.',
        modifiers: [{ target: 'ac', value: 1, type: 'dodge', source: 'Schivare' }],
    },
    {
        name: 'Mobilità',
        description: '+4 schivata alla CA contro attacchi di opportunità provocati spostandosi. Prerequisito: Schivare.',
        modifiers: [{ target: 'ac', value: 4, type: 'dodge', source: 'Mobilità' }],
    },
    {
        name: 'Riflessi in Combattimento',
        description: 'Puoi effettuare un numero di attacchi di opportunità per round pari al tuo modificatore di Destrezza. Bonus +1 all\'iniziativa.',
        modifiers: [{ target: 'initiative', value: 1, type: 'untyped', source: 'Riflessi in Combattimento' }],
    },
    {
        name: 'Maestria in Combattimento',
        description: 'Puoi sottrarre fino a 5 dai tuoi attacchi e aggiungerli alla CA come bonus di schivata fino al tuo prossimo turno (+1 dodge in postura difensiva).',
        modifiers: [{ target: 'ac', value: 1, type: 'dodge', source: 'Maestria in Combattimento' }],
    },
    {
        name: 'Attacco Poderoso',
        description: 'Sottrai fino al BAB dal tiro per colpire e aggiungilo al danno con armi a due mani (raddoppiato per armi a due mani usate con due mani). Bonus +1 al danno in mischia.',
        modifiers: [{ target: 'damage', value: 1, type: 'untyped', source: 'Attacco Poderoso' }],
    },
    {
        name: 'Attacco Furtivo',
        description: 'Quando colpisci un nemico colto alla sprovvista o fiancheggiato, infliggi danno extra (+1d6 furtivo).',
        modifiers: [{ target: 'sneakAttack', value: 1, type: 'untyped', source: 'Attacco Furtivo' }],
    },
    {
        name: 'Multiattacco',
        description: 'Riduce a -2 la penalità degli attacchi naturali secondari (effetto: +3 al tiro per colpire degli attacchi secondari).',
        modifiers: [{ target: 'attack', value: 3, type: 'untyped', source: 'Multiattacco' }],
    },
    {
        name: 'Arma Focalizzata',
        description: '+1 al tiro per colpire con un\'arma scelta. Prerequisito: BAB +1.',
        modifiers: [{ target: 'attack', value: 1, type: 'untyped', source: 'Arma Focalizzata' }],
    },
    {
        name: 'Specializzazione in Arma',
        description: '+2 al danno con un\'arma scelta. Prerequisito: Arma Focalizzata, livello 4° in classe da combattimento.',
        modifiers: [{ target: 'damage', value: 2, type: 'untyped', source: 'Specializzazione in Arma' }],
    },
    {
        name: 'Tiro Rapido',
        description: 'Quando esegui un\'azione di attacco completa con armi a distanza, ottieni un attacco extra a -2 a tutti gli attacchi.',
        modifiers: [{ target: 'rangedAttack', value: -2, type: 'untyped', source: 'Tiro Rapido' }],
    },
    {
        name: 'Tiro Mirato',
        description: 'Annulla la copertura parziale (+4 CA → +0) ai bersagli a distanza. Effetto: +4 al tiro per colpire contro bersagli in copertura.',
        modifiers: [{ target: 'rangedAttack', value: 4, type: 'circumstance', source: 'Tiro Mirato' }],
    },
    {
        name: 'Tiro Ravvicinato',
        description: 'Niente penalità di -4 per tiri a distanza ravvicinata; +1 al tiro entro 9 metri.',
        modifiers: [{ target: 'rangedAttack', value: 1, type: 'untyped', source: 'Tiro Ravvicinato' }],
    },
    {
        name: 'Combattere con Due Armi',
        description: 'Riduce le penalità per combattere con due armi (-2/-2 invece di -6/-10). Effetto netto: +4 ai tiri per colpire mentre duelli con due armi.',
        modifiers: [{ target: 'attack', value: 4, type: 'untyped', source: 'Combattere con Due Armi' }],
    },
    {
        name: 'Critico Migliorato',
        description: 'Raddoppia l\'intervallo di critico di un\'arma scelta. Non si cumula con armi vorpali. Bonus +1 al danno medio.',
        modifiers: [{ target: 'damage', value: 1, type: 'untyped', source: 'Critico Migliorato' }],
    },
    {
        name: 'Incantesimo Focalizzato',
        description: 'Bonus +1 alla CD dei tiri salvezza degli incantesimi di una scuola scelta.',
        modifiers: [{ target: 'spellDC', value: 1, type: 'untyped', source: 'Incantesimo Focalizzato' }],
    },
    {
        name: 'Incantesimo Più Potente',
        description: 'Aumenta il livello dell\'incantesimo di +2 per scopi di lancio (slot più alto richiesto), il danno è massimizzato. Bonus +2 al danno degli incantesimi.',
        modifiers: [{ target: 'spellDamage', value: 2, type: 'untyped', source: 'Incantesimo Più Potente' }],
    },
    {
        name: 'Incantesimo Esteso',
        description: 'Raddoppia la durata dell\'incantesimo (slot di +1 livello). Bonus +1 a Concentrazione.',
        modifiers: [{ target: 'concentration', value: 1, type: 'untyped', source: 'Incantesimo Esteso' }],
    },
    {
        name: 'Lanciare Incantesimi sulla Difensiva',
        description: 'Concentrazione CD 15+livello incantesimo per lanciare in mischia senza provocare AdO. Bonus +4 a Concentrazione.',
        modifiers: [{ target: 'concentration', value: 4, type: 'untyped', source: 'Lanciare Incantesimi sulla Difensiva' }],
    },
    {
        name: 'Maestria Scudo',
        description: '+1 a CA quando impugni uno scudo (cumulativo con il bonus normale dello scudo).',
        modifiers: [{ target: 'ac', value: 1, type: 'shield', source: 'Maestria Scudo' }],
    },
    {
        name: 'Negromante',
        description: 'Bonus +2 alla CD degli incantesimi di Negromanzia.',
        modifiers: [{ target: 'spellDC', value: 2, type: 'untyped', source: 'Negromante' }],
    },
    {
        name: 'Combattere alla Cieca',
        description: 'Tiro di percentuale dimezzato in mischia in condizioni di scarsa visibilità (effetto: +2 attacco vs occultamento).',
        modifiers: [{ target: 'attack', value: 2, type: 'circumstance', source: 'Combattere alla Cieca' }],
    },
];

function buildFeatDocs(): CatalogFeat[] {
    return STARTER_FEATS.map(f => ({
        id: slugify(f.name),
        ...f,
    }));
}

/**
 * Push all seed entries to Firestore.
 *
 * @param overwrite – when `true` existing docs are overwritten; when `false`
 *                    only missing docs are created (default).
 */
export async function seedAll({ overwrite = false }: { overwrite?: boolean } = {}): Promise<SeedReport> {
    const report: SeedReport = {
        languages: { written: 0, skipped: 0 },
        races:     { written: 0, skipped: 0 },
        classes:   { written: 0, skipped: 0 },
        skills:    { written: 0, skipped: 0 },
        feats:     { written: 0, skipped: 0 },
    };

    // languages first – races reference their ids
    const existingLangs = new Set((await languageCatalog.list()).map(l => l.id));
    for (const l of buildLanguageDocs()) {
        if (!overwrite && existingLangs.has(l.id)) { report.languages.skipped++; continue; }
        await languageCatalog.upsert(l);
        report.languages.written++;
    }

    const existingRaces = new Set((await raceCatalog.list()).map(r => r.id));
    for (const r of buildRaceDocs()) {
        if (!overwrite && existingRaces.has(r.id)) { report.races.skipped++; continue; }
        await raceCatalog.upsert(r);
        report.races.written++;
    }

    const existingClasses = new Set((await classCatalog.list()).map(c => c.id));
    for (const c of buildClassDocs()) {
        if (!overwrite && existingClasses.has(c.id)) { report.classes.skipped++; continue; }
        await classCatalog.upsert(c);
        report.classes.written++;
    }

    const existingSkills = new Set((await skillCatalog.list()).map(s => s.id));
    for (const s of buildSkillDocs()) {
        if (!overwrite && existingSkills.has(s.id)) { report.skills.skipped++; continue; }
        await skillCatalog.upsert(s);
        report.skills.written++;
    }

    const existingFeats = new Set((await featCatalog.list()).map(f => f.id));
    for (const f of buildFeatDocs()) {
        if (!overwrite && existingFeats.has(f.id)) { report.feats.skipped++; continue; }
        await featCatalog.upsert(f);
        report.feats.written++;
    }

    return report;
}
