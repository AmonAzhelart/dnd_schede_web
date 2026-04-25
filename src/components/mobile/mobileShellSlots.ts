/* ============================================================================
 * Tiny pub/sub bridge between CharacterSheet (the producer of context-aware
 * actions like "Modifica" / "Personalizza") and the MobileShell avatar popup
 * (the place where, on small screens, those actions should live).
 *
 * Lives in its own file so neither component has to import the other.
 * ========================================================================== */
import { useEffect, useState } from 'react';

export type MobileContextAction = {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
};

let actions: MobileContextAction[] = [];
const listeners = new Set<() => void>();

/** Producer: replace the current set of context actions. Pass `[]` to clear. */
export const setMobileContextActions = (next: MobileContextAction[]): void => {
    actions = next;
    listeners.forEach(l => l());
};

/** Consumer: subscribe to the live list of context actions. */
export const useMobileContextActions = (): MobileContextAction[] => {
    const [, force] = useState(0);
    useEffect(() => {
        const l = () => force(x => x + 1);
        listeners.add(l);
        return () => { listeners.delete(l); };
    }, []);
    return actions;
};
