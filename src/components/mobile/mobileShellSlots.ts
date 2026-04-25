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

/* ──────────────────────────────────────────────────────────────────────
 * Avatar-tap override: while the character header edit drawer is open,
 * the producer (CharacterSheet) registers a callback here. The MobileShell
 * avatar then short-circuits its "open nav popup" behaviour and instead
 * invokes this callback (e.g. to open the file picker so the user can
 * change the photo). Pass `null` to restore the default behaviour.
 * ────────────────────────────────────────────────────────────────────── */
let avatarOverride: (() => void) | null = null;
const overrideListeners = new Set<() => void>();

export const setMobileAvatarTapOverride = (cb: (() => void) | null): void => {
    avatarOverride = cb;
    overrideListeners.forEach(l => l());
};

export const useMobileAvatarTapOverride = (): (() => void) | null => {
    const [, force] = useState(0);
    useEffect(() => {
        const l = () => force(x => x + 1);
        overrideListeners.add(l);
        return () => { overrideListeners.delete(l); };
    }, []);
    return avatarOverride;
};

/* ──────────────────────────────────────────────────────────────────────
 * Edit-mode exit: while the avatar is hijacked for "change photo", the
 * default tap-to-open-nav-popup is unreachable. The producer registers an
 * exit callback here so the MobileShell can show a small floating chip
 * ("Termina modifica") that lets the user leave edit mode.
 * ────────────────────────────────────────────────────────────────────── */
let editExit: (() => void) | null = null;
const editExitListeners = new Set<() => void>();

export const setMobileEditExit = (cb: (() => void) | null): void => {
    editExit = cb;
    editExitListeners.forEach(l => l());
};

export const useMobileEditExit = (): (() => void) | null => {
    const [, force] = useState(0);
    useEffect(() => {
        const l = () => force(x => x + 1);
        editExitListeners.add(l);
        return () => { editExitListeners.delete(l); };
    }, []);
    return editExit;
};
