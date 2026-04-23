import type React from 'react';

export interface WidgetInstance {
    uid: string;
    type: string;
    /** column index (0-based) */
    x: number;
    /** row index (0-based) */
    y: number;
    /** column span */
    w: number;
    /** row span */
    h: number;
}

/** Size class describing how much room a widget has on screen. */
export type SizeClass = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface WidgetSize {
    /** column span (logical) */
    w: number;
    /** row span (logical) */
    h: number;
    /** measured pixel width of the tile body */
    pixelW: number;
    /** measured pixel height of the tile body */
    pixelH: number;
    /** convenience class derived from pixel width */
    size: SizeClass;
}

export interface WidgetRenderProps {
    goTo?: (tab: string) => void;
    size: WidgetSize;
}

export interface WidgetDefinition {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    defaultW: number;
    defaultH: number;
    minW: number;
    minH: number;
    render: React.FC<WidgetRenderProps>;
    accent?: string;
}

/** Map a pixel width to a size class. */
export const sizeClassFromWidth = (px: number): SizeClass =>
    px < 200 ? 'xs' : px < 320 ? 'sm' : px < 480 ? 'md' : px < 720 ? 'lg' : 'xl';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export const BREAKPOINTS: { id: Breakpoint; label: string; minWidth: number }[] = [
    { id: 'mobile', label: 'Mobile', minWidth: 0 },
    { id: 'tablet', label: 'Tablet', minWidth: 700 },
    { id: 'desktop', label: 'Desktop', minWidth: 1100 },
];

export interface BreakpointLayout {
    cols: number;
    rowHeight: number;
    widgets: WidgetInstance[];
}

export interface DashboardLayout {
    version: number;
    /** layout per breakpoint */
    layouts: Record<Breakpoint, BreakpointLayout>;
}

export const LAYOUT_VERSION = 4;

export const COL_PRESETS: Record<Breakpoint, readonly number[]> = {
    desktop: [8, 12, 16, 20, 24],
    tablet: [4, 6, 8, 10, 12],
    mobile: [2, 3, 4, 6],
};

export const ROW_HEIGHT_PRESETS = [40, 50, 60, 70, 80] as const;

/* ─── Geometry utils ─── */

export const rectsOverlap = (
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
): boolean =>
    !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

export const collides = (
    rect: { x: number; y: number; w: number; h: number },
    exceptUid: string | null,
    widgets: WidgetInstance[],
): boolean => widgets.some(w => w.uid !== exceptUid && rectsOverlap(rect, w));

export const findFreeSpot = (
    w: number,
    h: number,
    cols: number,
    widgets: WidgetInstance[],
): { x: number; y: number } => {
    for (let y = 0; y < 500; y++) {
        for (let x = 0; x <= cols - w; x++) {
            if (!collides({ x, y, w, h }, null, widgets)) return { x, y };
        }
    }
    return { x: 0, y: 0 };
};

export const clampRect = (
    rect: { x: number; y: number; w: number; h: number },
    cols: number,
    minW = 2,
    minH = 2,
) => {
    const w = Math.max(Math.min(minW, cols), Math.min(rect.w, cols));
    const h = Math.max(minH, rect.h);
    const x = Math.max(0, Math.min(rect.x, cols - w));
    const y = Math.max(0, rect.y);
    return { x, y, w, h };
};
