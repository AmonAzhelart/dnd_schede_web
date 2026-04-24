import { useEffect, useState } from 'react';
import { iconCatalog, type CatalogIcon } from './admin';
import type { Item } from '../types/dnd';

/** Slots that can have a "default icon" assigned in the back-office. */
export const ITEM_ICON_SLOTS: { id: string; label: string }[] = [
    { id: 'weapon.melee', label: 'Arma da mischia' },
    { id: 'weapon.ranged', label: 'Arma a distanza' },
    { id: 'armor', label: 'Armatura' },
    { id: 'shield', label: 'Scudo' },
    { id: 'protectiveItem', label: 'Oggetto protettivo' },
    { id: 'gear', label: 'Equipaggiamento' },
    { id: 'consumable', label: 'Consumabile' },
    { id: 'component', label: 'Componente magico' },
    { id: 'misc', label: 'Miscellanea' },
];

/** Schools of magic that can have a default icon. */
export const SPELL_SCHOOLS = [
    'Abiurazione', 'Ammaliamento', 'Divinazione', 'Evocazione',
    'Illusione', 'Invocazione', 'Necromanzia', 'Trasmutazione',
] as const;

/** Slots for spell schools (id format: `spell.school.<Name>`). */
export const SPELL_SCHOOL_SLOTS: { id: string; label: string }[] = SPELL_SCHOOLS.map(s => ({
    id: `spell.school.${s}`,
    label: `Scuola: ${s}`,
}));

/** All assignable slots, grouped for dropdowns. */
export const ICON_SLOT_GROUPS: { label: string; slots: { id: string; label: string }[] }[] = [
    { label: 'Inventario', slots: ITEM_ICON_SLOTS },
    { label: 'Scuole di Magia', slots: SPELL_SCHOOL_SLOTS },
];

/** Map a character item to the slot id used by the icon catalog. */
export function slotForItem(item: Pick<Item, 'type' | 'weaponDetails'>): string {
    if (item.type === 'weapon') {
        const r = item.weaponDetails?.rangeIncrement?.trim();
        return r && r !== '' && r !== '0' ? 'weapon.ranged' : 'weapon.melee';
    }
    return item.type;
}

/** Process-wide cache so all consumers share a single fetch. */
let cache: CatalogIcon[] | null = null;
let inflight: Promise<CatalogIcon[]> | null = null;
const subscribers = new Set<(icons: CatalogIcon[]) => void>();

const sanitizeSvg = (svg: string): string =>
    svg
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');

async function load(): Promise<CatalogIcon[]> {
    if (cache) return cache;
    if (!inflight) {
        inflight = iconCatalog.list().then(list => {
            cache = list;
            inflight = null;
            subscribers.forEach(fn => fn(list));
            return list;
        });
    }
    return inflight;
}

/** Force a reload (e.g. after BackOffice edits). */
export async function refreshIconCache(): Promise<void> {
    cache = null;
    await load();
}

/** React hook returning `{icons, byId, getSvg, loading}`. */
export function useIconCatalog() {
    const [icons, setIcons] = useState<CatalogIcon[]>(cache ?? []);
    const [loading, setLoading] = useState(cache === null);

    useEffect(() => {
        const onUpdate = (list: CatalogIcon[]) => setIcons(list);
        subscribers.add(onUpdate);
        if (cache === null) {
            load().then(list => {
                setIcons(list);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
        return () => {
            subscribers.delete(onUpdate);
        };
    }, []);

    const byId = new Map(icons.map(i => [i.id, i]));
    const defaults = new Map<string, CatalogIcon>();
    for (const ic of icons) {
        if (ic.defaultFor) defaults.set(ic.defaultFor, ic);
    }

    /** Returns the raw SVG markup for an icon id (no fallback). */
    const getSvg = (id: string | undefined): string | undefined =>
        id ? byId.get(id)?.svg : undefined;

    /** Resolve the SVG to render for an item: explicit `iconId` wins,
     *  otherwise falls back to the default icon for the item's slot. */
    const resolveItemSvg = (item: Pick<Item, 'type' | 'iconId' | 'weaponDetails'>): string | undefined => {
        if (item.iconId) {
            const ic = byId.get(item.iconId);
            if (ic) return ic.svg;
        }
        return defaults.get(slotForItem(item))?.svg;
    };

    /** Resolve the default SVG for a spell school name. */
    const resolveSchoolSvg = (school: string | undefined): string | undefined => {
        if (!school) return undefined;
        return defaults.get(`spell.school.${school}`)?.svg;
    };

    return { icons, byId, defaults, getSvg, resolveItemSvg, resolveSchoolSvg, loading, sanitizeSvg };
}

export { sanitizeSvg };
