/* ============================================================================
 * widgetJumpBridge ─ tiny pub/sub used to wire the widget-jump rail to an
 * arbitrary external trigger element (typically the mobile "Panoramica"
 * sheet tab). OverviewDashboard publishes the current widget list; the
 * sheet header registers the trigger DOM node; the singleton rail listens.
 * ========================================================================== */
import { useSyncExternalStore } from 'react';
import type { WidgetInstance } from './widgetTypes';

interface State {
    triggerEl: HTMLElement | null;
    widgets: WidgetInstance[];
    editMode: boolean;
}

let state: State = { triggerEl: null, widgets: [], editMode: false };
const listeners = new Set<() => void>();

const emit = (): void => {
    for (const l of listeners) l();
};

export function setWidgetJumpTrigger(el: HTMLElement | null): void {
    if (state.triggerEl === el) return;
    state = { ...state, triggerEl: el };
    emit();
}

export function setWidgetJumpData(widgets: WidgetInstance[], editMode: boolean): void {
    if (state.widgets === widgets && state.editMode === editMode) return;
    state = { ...state, widgets, editMode };
    emit();
}

export function clearWidgetJumpData(): void {
    if (state.widgets.length === 0 && !state.editMode) return;
    state = { ...state, widgets: [], editMode: false };
    emit();
}

const subscribe = (l: () => void): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
};

const getSnapshot = (): State => state;

export function useWidgetJumpState(): State {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
