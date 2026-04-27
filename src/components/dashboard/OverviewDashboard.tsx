import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaPalette, FaPlus, FaTimes, FaUndo, FaGripVertical, FaThLarge, FaArrowsAlt, FaDesktop, FaTabletAlt, FaMobileAlt, FaCopy, FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight, FaExpandArrowsAlt, FaCompressArrowsAlt, FaTrash, FaBan } from 'react-icons/fa';
import { useCharacterStore } from '../../store/characterStore';
import { WIDGET_CATALOG, getWidgetDef } from './widgets';
import { setWidgetJumpData, clearWidgetJumpData } from './widgetJumpBridge';
import { auth } from '../../firebase';
import { loadDashboardLayout, saveDashboardLayout } from '../../services/db';
import {
    BREAKPOINTS, COL_PRESETS, ROW_HEIGHT_PRESETS, LAYOUT_VERSION,
    clampRect, collides, findFreeSpot, resolveLayout, compactLayout, sizeClassFromWidth,
    type Breakpoint, type BreakpointLayout, type DashboardLayout, type WidgetInstance, type WidgetSize,
} from './widgetTypes';

interface Props {
    goTo?: (tab: string) => void;
    editMode?: boolean;
    setEditMode?: (v: boolean) => void;
}

const BP_ICONS: Record<Breakpoint, React.ReactNode> = {
    desktop: <FaDesktop size={10} />,
    tablet: <FaTabletAlt size={10} />,
    mobile: <FaMobileAlt size={10} />,
};

/* ─── Defaults per breakpoint ─── */
const DEFAULT_DESKTOP: BreakpointLayout = {
    cols: 12, rowHeight: 60,
    widgets: [
        { uid: 'w-hp', type: 'hp', x: 0, y: 0, w: 3, h: 4 },
        { uid: 'w-stats', type: 'stats', x: 3, y: 0, w: 6, h: 4 },
        { uid: 'w-defenses', type: 'defenses', x: 9, y: 0, w: 3, h: 5 },
        { uid: 'w-cond', type: 'conditions', x: 0, y: 4, w: 3, h: 4 },
        { uid: 'w-movement', type: 'movement', x: 3, y: 4, w: 3, h: 4 },
        { uid: 'w-currency', type: 'currency', x: 6, y: 4, w: 3, h: 4 },
        { uid: 'w-attacks', type: 'attacks', x: 0, y: 8, w: 6, h: 6 },
        { uid: 'w-spells', type: 'spellSlots', x: 6, y: 5, w: 3, h: 6 },
        { uid: 'w-class', type: 'classFeatures', x: 9, y: 5, w: 3, h: 6 },
        { uid: 'w-skills', type: 'skills', x: 0, y: 14, w: 6, h: 8 },
        { uid: 'w-inv', type: 'inventory', x: 6, y: 11, w: 3, h: 7 },
        { uid: 'w-feats', type: 'feats', x: 9, y: 11, w: 3, h: 7 },
        { uid: 'w-langs', type: 'languages', x: 6, y: 18, w: 6, h: 4 },
    ],
};

const DEFAULT_TABLET: BreakpointLayout = {
    cols: 8, rowHeight: 60,
    widgets: [
        { uid: 'w-hp', type: 'hp', x: 0, y: 0, w: 4, h: 4 },
        { uid: 'w-defenses', type: 'defenses', x: 4, y: 0, w: 4, h: 5 },
        { uid: 'w-stats', type: 'stats', x: 0, y: 4, w: 4, h: 4 },
        { uid: 'w-cond', type: 'conditions', x: 4, y: 5, w: 4, h: 3 },
        { uid: 'w-attacks', type: 'attacks', x: 0, y: 8, w: 8, h: 6 },
        { uid: 'w-spells', type: 'spellSlots', x: 0, y: 14, w: 4, h: 6 },
        { uid: 'w-class', type: 'classFeatures', x: 4, y: 14, w: 4, h: 6 },
        { uid: 'w-skills', type: 'skills', x: 0, y: 20, w: 8, h: 8 },
        { uid: 'w-inv', type: 'inventory', x: 0, y: 28, w: 4, h: 6 },
        { uid: 'w-feats', type: 'feats', x: 4, y: 28, w: 4, h: 6 },
        { uid: 'w-currency', type: 'currency', x: 0, y: 34, w: 3, h: 4 },
        { uid: 'w-movement', type: 'movement', x: 3, y: 34, w: 2, h: 4 },
        { uid: 'w-langs', type: 'languages', x: 5, y: 34, w: 3, h: 4 },
    ],
};

const DEFAULT_MOBILE: BreakpointLayout = {
    cols: 4, rowHeight: 55,
    widgets: [
        { uid: 'w-hp', type: 'hp', x: 0, y: 0, w: 4, h: 4 },
        { uid: 'w-defenses', type: 'defenses', x: 0, y: 4, w: 4, h: 5 },
        { uid: 'w-stats', type: 'stats', x: 0, y: 9, w: 4, h: 7 },
        { uid: 'w-cond', type: 'conditions', x: 0, y: 16, w: 4, h: 4 },
        { uid: 'w-attacks', type: 'attacks', x: 0, y: 20, w: 4, h: 6 },
        { uid: 'w-spells', type: 'spellSlots', x: 0, y: 26, w: 4, h: 6 },
        { uid: 'w-class', type: 'classFeatures', x: 0, y: 32, w: 4, h: 6 },
        { uid: 'w-skills', type: 'skills', x: 0, y: 38, w: 4, h: 8 },
        { uid: 'w-inv', type: 'inventory', x: 0, y: 46, w: 4, h: 7 },
        { uid: 'w-feats', type: 'feats', x: 0, y: 53, w: 4, h: 6 },
        { uid: 'w-currency', type: 'currency', x: 0, y: 59, w: 4, h: 4 },
        { uid: 'w-movement', type: 'movement', x: 0, y: 63, w: 4, h: 4 },
        { uid: 'w-langs', type: 'languages', x: 0, y: 67, w: 4, h: 4 },
    ],
};

const DEFAULT_LAYOUT: DashboardLayout = {
    version: LAYOUT_VERSION,
    layouts: {
        desktop: DEFAULT_DESKTOP,
        tablet: DEFAULT_TABLET,
        mobile: DEFAULT_MOBILE,
    },
};

const layoutKey = (charId: string) => `dash:layout:${charId}`;

const loadLayout = (charId: string): DashboardLayout => {
    try {
        const raw = localStorage.getItem(layoutKey(charId));
        if (!raw) return DEFAULT_LAYOUT;
        const parsed = JSON.parse(raw) as DashboardLayout;
        if (parsed.version !== LAYOUT_VERSION || !parsed.layouts) return DEFAULT_LAYOUT;
        // sanitize: drop unknown widget types
        (Object.keys(parsed.layouts) as Breakpoint[]).forEach(bp => {
            const lay = parsed.layouts[bp];
            if (!lay) return;
            lay.widgets = lay.widgets.filter(w => getWidgetDef(w.type));
        });
        return parsed;
    } catch {
        return DEFAULT_LAYOUT;
    }
};

const saveLayout = (charId: string, layout: DashboardLayout) => {
    try { localStorage.setItem(layoutKey(charId), JSON.stringify(layout)); } catch { /* ignore */ }
};

/** Detect current breakpoint based on viewport width */
const useViewportBreakpoint = (): Breakpoint => {
    const compute = (): Breakpoint => {
        if (typeof window === 'undefined') return 'desktop';
        const w = window.innerWidth;
        // sorted descending
        const sorted = [...BREAKPOINTS].sort((a, b) => b.minWidth - a.minWidth);
        const found = sorted.find(b => w >= b.minWidth);
        return (found?.id ?? 'mobile');
    };
    const [bp, setBp] = useState<Breakpoint>(compute);
    useEffect(() => {
        const handler = () => setBp(compute());
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return bp;
};

interface DragState {
    uid: string;
    mode: 'move' | 'resize';
    start: { x: number; y: number; w: number; h: number };
    startPointer: { x: number; y: number };
    /** Current pointer position (viewport coords) — drives the floating phantom. */
    pointer: { x: number; y: number };
    /** Pointer offset within the tile when the drag started (for natural phantom anchoring). */
    grabOffset: { x: number; y: number };
    /** Pixel size of the dragged tile, captured at drag start (for the phantom). */
    tilePx: { w: number; h: number };
    ghost: { x: number; y: number; w: number; h: number };
    /** Live-preview widgets while dragging (others pushed out of the way). */
    preview: WidgetInstance[];
    valid: boolean;
    pointerType: string;
}

export const OverviewDashboard: React.FC<Props> = ({ goTo, editMode: editModeProp, setEditMode: setEditModeProp }) => {
    const { character } = useCharacterStore();
    const charId = character?.id ?? '_';

    const [layout, setLayout] = useState<DashboardLayout>(() => loadLayout(charId));
    const [editModeInternal, setEditModeInternal] = useState(false);
    const editMode = editModeProp !== undefined ? editModeProp : editModeInternal;
    const setEditMode = (v: boolean) => {
        setEditModeInternal(v);
        setEditModeProp?.(v);
    };
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [drag, setDrag] = useState<DragState | null>(null);
    /** Scale applied to the dashboard frame while dragging — kept for compat
     *  but always 1 in the new fullscreen edit flow. */
    const [dragZoom, setDragZoom] = useState(1);
    /** Currently selected tile in edit mode (tap-to-select flow). */
    const [selectedUid, setSelectedUid] = useState<string | null>(null);
    /** Pending placement for the selected tile — staged via drag/nudge,
     *  committed only when the user presses "Conferma". */
    const [pending, setPending] = useState<{ uid: string; x: number; y: number; w: number; h: number } | null>(null);
    /** Currently focused tile (click-to-activate enables internal scrolling). */
    const [activeUid, setActiveUid] = useState<string | null>(null);
    const dashRef = useRef<HTMLDivElement | null>(null);
    // Track whether the current layout was loaded from remote (skip saving back on initial hydration)
    const remoteLoadedRef = useRef(false);
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            const root = dashRef.current;
            if (!root) return;
            const target = e.target as Node | null;
            if (target && root.contains(target)) {
                // Clicked inside dashboard but outside any tile — clear focus
                const tile = (target as HTMLElement).closest?.('.dash-tile');
                if (!tile) setActiveUid(null);
            } else {
                setActiveUid(null);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const viewportBp = useViewportBreakpoint();
    /** Breakpoint actually shown/edited. In view mode follows viewport, in edit mode user picks. */
    const [editedBp, setEditedBp] = useState<Breakpoint>(viewportBp);
    // When entering edit mode, sync to current viewport breakpoint
    useEffect(() => { if (!editMode) setEditedBp(viewportBp); }, [viewportBp, editMode]);

    // Clear selection / pending when toggling edit mode or switching breakpoint
    useEffect(() => { setSelectedUid(null); setPending(null); }, [editMode, editedBp]);

    // Lock body scroll while in fullscreen edit mode
    useEffect(() => {
        if (!editMode) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [editMode]);

    const activeBp: Breakpoint = editMode ? editedBp : viewportBp;
    const activeLayout: BreakpointLayout = layout.layouts[activeBp] ?? DEFAULT_LAYOUT.layouts[activeBp];

    // On charId change: reload from localStorage immediately, then hydrate from Firestore
    useEffect(() => {
        setLayout(loadLayout(charId));
        remoteLoadedRef.current = false;
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        loadDashboardLayout(uid, charId).then(remote => {
            if (!remote) return;
            remoteLoadedRef.current = true;
            setLayout(remote);
            // also update local cache
            saveLayout(charId, remote);
        });
    }, [charId]);

    // Debounced Firestore save on layout changes; skip the initial hydration update
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        // always persist locally
        saveLayout(charId, layout);
        // skip saving back right after we just loaded from remote
        if (remoteLoadedRef.current) {
            remoteLoadedRef.current = false;
            return;
        }
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveDashboardLayout(uid, charId, layout);
        }, 1500);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [charId, layout]);

    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);
    dragRef.current = drag;

    /* ─── Measure grid pixel width for size-aware widgets ─── */
    const [gridWidth, setGridWidth] = useState(0);
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect.width ?? el.clientWidth;
            setGridWidth(w);
        });
        ro.observe(el);
        setGridWidth(el.clientWidth);
        return () => ro.disconnect();
    }, [activeBp, activeLayout.cols]);
    const cellWidth = activeLayout.cols > 0 ? gridWidth / activeLayout.cols : 0;

    /* ─── Mutate active breakpoint's layout ─── */
    const mutateActive = useCallback((mut: (l: BreakpointLayout) => BreakpointLayout) => {
        setLayout(prev => ({
            ...prev,
            layouts: { ...prev.layouts, [activeBp]: mut(prev.layouts[activeBp]) },
        }));
    }, [activeBp]);

    const updateWidgets = useCallback((mut: (w: WidgetInstance[]) => WidgetInstance[]) => {
        mutateActive(l => ({ ...l, widgets: mut(l.widgets) }));
    }, [mutateActive]);

    const addWidget = (type: string) => {
        const def = getWidgetDef(type);
        if (!def) return;
        const w = Math.min(def.defaultW, activeLayout.cols);
        const spot = findFreeSpot(w, def.defaultH, activeLayout.cols, activeLayout.widgets);
        const uid = `w-${type}-${Date.now().toString(36)}`;
        updateWidgets(ws => [...ws, { uid, type, x: spot.x, y: spot.y, w, h: def.defaultH }]);
        setPaletteOpen(false);
    };

    const removeWidget = (uid: string) => updateWidgets(ws => ws.filter(w => w.uid !== uid));

    const resetActive = () => {
        if (confirm(`Ripristinare il layout di default per ${activeBp}?`)) {
            setLayout(prev => ({ ...prev, layouts: { ...prev.layouts, [activeBp]: DEFAULT_LAYOUT.layouts[activeBp] } }));
        }
    };

    const copyFromOther = (sourceBp: Breakpoint) => {
        if (sourceBp === activeBp) return;
        if (!confirm(`Copiare il layout da ${sourceBp} a ${activeBp}? Le posizioni verranno adattate alle colonne attuali.`)) return;
        setLayout(prev => {
            const src = prev.layouts[sourceBp];
            const targetCols = prev.layouts[activeBp].cols;
            const targetRowH = prev.layouts[activeBp].rowHeight;
            const scale = targetCols / src.cols;
            const widgets = src.widgets.map(w => {
                const def = getWidgetDef(w.type);
                const minW = def?.minW ?? 2;
                const minH = def?.minH ?? 2;
                const newW = Math.max(minW, Math.min(targetCols, Math.round(w.w * scale)));
                const newX = Math.max(0, Math.min(targetCols - newW, Math.round(w.x * scale)));
                return clampRect({ x: newX, y: w.y, w: newW, h: w.h }, targetCols, minW, minH);
            });
            // Resolve overlaps that may arise from rounding by greedy compaction
            const placed: WidgetInstance[] = [];
            widgets.forEach((rect, i) => {
                const ref = src.widgets[i];
                let final = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
                // bump down until no collision
                let safety = 0;
                while (collides(final, null, placed) && safety < 500) {
                    final = { ...final, y: final.y + 1 };
                    safety++;
                }
                placed.push({ uid: ref.uid, type: ref.type, ...final });
            });
            return { ...prev, layouts: { ...prev.layouts, [activeBp]: { cols: targetCols, rowHeight: targetRowH, widgets: placed } } };
        });
    };

    const setCols = (cols: number) => {
        mutateActive(l => {
            const widgets = l.widgets.map(w => {
                const def = getWidgetDef(w.type);
                return clampRect(w, cols, def?.minW ?? 2, def?.minH ?? 2);
            });
            return { ...l, cols, widgets };
        });
    };
    const setRowHeight = (rowHeight: number) => mutateActive(l => ({ ...l, rowHeight }));

    /* ─── Selection / pending placement (touch-friendly flow) ─── */
    const widgetByUid = useCallback(
        (uid: string) => activeLayout.widgets.find(w => w.uid === uid) ?? null,
        [activeLayout.widgets],
    );
    const currentRectFor = useCallback((uid: string) => {
        if (pending && pending.uid === uid) {
            return { uid, x: pending.x, y: pending.y, w: pending.w, h: pending.h };
        }
        const w = widgetByUid(uid);
        return w ? { uid, x: w.x, y: w.y, w: w.w, h: w.h } : null;
    }, [pending, widgetByUid]);
    const stagePending = useCallback((uid: string, rect: { x: number; y: number; w: number; h: number }) => {
        const w = widgetByUid(uid);
        if (!w) return;
        const def = getWidgetDef(w.type);
        const minW = def?.minW ?? 2;
        const minH = def?.minH ?? 2;
        const clamped = clampRect(rect, activeLayout.cols, minW, minH);
        // If pending matches the original rect exactly, drop it (nothing to confirm)
        if (clamped.x === w.x && clamped.y === w.y && clamped.w === w.w && clamped.h === w.h) {
            setPending(null);
            return;
        }
        setPending({ uid, ...clamped });
    }, [widgetByUid, activeLayout.cols]);
    const selectTile = useCallback((uid: string) => {
        if (!editMode) return;
        setSelectedUid(uid);
    }, [editMode]);
    const nudge = (dx: number, dy: number) => {
        if (!selectedUid) return;
        const cur = currentRectFor(selectedUid); if (!cur) return;
        stagePending(selectedUid, { x: cur.x + dx, y: Math.max(0, cur.y + dy), w: cur.w, h: cur.h });
    };
    const resizeBy = (dw: number, dh: number) => {
        if (!selectedUid) return;
        const cur = currentRectFor(selectedUid); if (!cur) return;
        stagePending(selectedUid, { x: cur.x, y: cur.y, w: cur.w + dw, h: cur.h + dh });
    };
    const confirmPending = () => {
        if (pending) {
            const target = { x: pending.x, y: pending.y, w: pending.w, h: pending.h };
            const merged = resolveLayout(activeLayout.widgets, pending.uid, target);
            const final = merged.map(w => w.uid === pending.uid ? { ...w, ...target } : w);
            const compacted = compactLayout(final, pending.uid);
            updateWidgets(() => compacted);
            setPending(null);
        }
        // Always close the action bar when the user presses Conferma so they
        // get clear feedback that the action completed (even if nothing was
        // pending: pressing Conferma after a tap means "OK, done").
        setSelectedUid(null);
    };
    const cancelPending = () => { setPending(null); setSelectedUid(null); };
    const clearSelection = () => { setSelectedUid(null); setPending(null); };
    const removeSelected = () => {
        if (!selectedUid) return;
        removeWidget(selectedUid);
        clearSelection();
    };

    /* ─── Drag (move/resize) ─── */
    const startDrag = (uid: string, mode: 'move' | 'resize') => (e: React.PointerEvent) => {
        if (!editMode) return;
        // Only react to primary button for mouse; always allow touch/pen
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const widget = activeLayout.widgets.find(w => w.uid === uid);
        if (!widget) return;
        const cont = containerRef.current;
        if (!cont) return;

        // Read the actual grid metrics so snap math matches what the user sees.
        // CSS grid distributes columns as: contentW = cols*colW + (cols-1)*gap.
        // The pitch (distance between consecutive cell starts) is colW + gap.
        const cs = window.getComputedStyle(cont);
        const colGap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
        const rowGap = parseFloat(cs.rowGap || cs.gap || '0') || 0;
        const contentW = cont.clientWidth;
        const colW = (contentW - (activeLayout.cols - 1) * colGap) / activeLayout.cols;
        const colPitch = colW + colGap;
        const rowPitch = activeLayout.rowHeight + rowGap;

        const def = getWidgetDef(widget.type);
        const minW = def?.minW ?? 2;
        const minH = def?.minH ?? 2;

        // Fullscreen edit mode handles its own scrolling, so we no longer
        // zoom the dashboard. Keep the dragZoom state at 1 for compatibility
        // with the phantom rendering path.
        const zoom = 1;
        setDragZoom(1);

        // Capture the pointer on the originating element so we keep getting
        // events even if the finger leaves the handle (essential for touch).
        const captureEl = e.currentTarget as Element;
        try { captureEl.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }

        // Locate the actual tile element so we can capture its pixel size and
        // where the pointer grabbed it (for natural phantom anchoring).
        // Sizes are captured in UNSCALED logical space (pre-zoom): the tile's
        // current bounding rect is at scale=1 because we just set zoom but
        // React hasn't re-rendered yet.
        const tileEl = (e.target as HTMLElement | null)?.closest?.('.dash-tile') as HTMLElement | null;
        const tileRect = tileEl?.getBoundingClientRect();
        const tilePx = tileRect
            ? { w: tileRect.width, h: tileRect.height }
            : { w: colW * widget.w + colGap * (widget.w - 1), h: activeLayout.rowHeight * widget.h + rowGap * (widget.h - 1) };
        const grabOffset = tileRect
            ? { x: e.clientX - tileRect.left, y: e.clientY - tileRect.top }
            : { x: tilePx.w / 2, y: 16 };

        const start = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
        const initial: DragState = {
            uid, mode, start,
            startPointer: { x: e.clientX, y: e.clientY },
            pointer: { x: e.clientX, y: e.clientY },
            grabOffset,
            tilePx,
            ghost: { ...start },
            preview: activeLayout.widgets,
            valid: true,
            pointerType: e.pointerType,
        };
        setDrag(initial);
        dragRef.current = initial;

        // Lock body scroll on touch so the page doesn't fight the drag.
        const prevTouchAction = document.body.style.touchAction;
        const prevOverscroll = document.body.style.overscrollBehavior;
        if (e.pointerType !== 'mouse') {
            document.body.style.touchAction = 'none';
            document.body.style.overscrollBehavior = 'contain';
        }

        // ── Edge auto-scroll while dragging ──
        // The fullscreen edit overlay (`.dash-root.is-fs-edit`) is itself
        // the scroll container; in normal mode we fall back to the window.
        // We detect when the pointer is near the top/bottom edge and pan the
        // viewport in that direction, keeping the action bar fixed at the bottom.
        const fsRoot = dashRef.current?.classList.contains('is-fs-edit') ? dashRef.current : null;
        const SCROLL_EDGE = 80;       // px from edge that triggers scroll
        const SCROLL_MAX_SPEED = 18;  // px per frame at the very edge
        // Reserve space at the bottom for the fixed action bar so the pointer
        // doesn't have to ride under it to trigger downward scroll.
        const ACTION_BAR_RESERVE = 180;
        let scrollRafId: number | null = null;
        let scrollPointerY = e.clientY;
        const stepScroll = () => {
            scrollRafId = null;
            const y = scrollPointerY;
            const viewportH = window.innerHeight;
            const topEdge = SCROLL_EDGE;
            const bottomEdge = viewportH - ACTION_BAR_RESERVE;
            let delta = 0;
            if (y < topEdge) {
                const intensity = (topEdge - y) / SCROLL_EDGE;
                delta = -Math.min(SCROLL_MAX_SPEED, Math.max(2, intensity * SCROLL_MAX_SPEED));
            } else if (y > bottomEdge) {
                const intensity = (y - bottomEdge) / SCROLL_EDGE;
                delta = Math.min(SCROLL_MAX_SPEED, Math.max(2, intensity * SCROLL_MAX_SPEED));
            }
            if (delta !== 0) {
                if (fsRoot) {
                    fsRoot.scrollTop += delta;
                } else {
                    window.scrollBy(0, delta);
                }
                // Re-flush the drag math against the new scroll position so the
                // ghost follows the pointer even when the finger is still.
                if (lastEvent == null && rafId == null) {
                    // Synthesize a flush from the last known pointer
                    const synthetic = { ...({} as PointerEvent), clientX: scrollPointerX, clientY: scrollPointerY } as PointerEvent;
                    lastEvent = synthetic;
                    rafId = requestAnimationFrame(flush);
                }
                scrollRafId = requestAnimationFrame(stepScroll);
            }
        };
        let scrollPointerX = e.clientX;
        const maybeStartScroll = (ev: PointerEvent) => {
            scrollPointerX = ev.clientX;
            scrollPointerY = ev.clientY;
            const viewportH = window.innerHeight;
            const near = ev.clientY < SCROLL_EDGE || ev.clientY > viewportH - ACTION_BAR_RESERVE;
            if (near && scrollRafId == null) {
                scrollRafId = requestAnimationFrame(stepScroll);
            }
        };

        // rAF-throttle pointermove: touch devices fire many events per frame
        // and re-running resolveLayout for each is what makes the gesture
        // feel "scattoso". We coalesce to one update per animation frame.
        let rafId: number | null = null;
        let lastEvent: PointerEvent | null = null;
        const flush = () => {
            rafId = null;
            const ev = lastEvent;
            if (!ev) return;
            lastEvent = null;

            // Re-read the container's visual rect each frame: when the zoom
            // transform applies, getBoundingClientRect() returns the *scaled*
            // box. We project the pointer back into UNSCALED grid coordinates
            // so snap math always matches the underlying logical grid.
            const liveRect = cont.getBoundingClientRect();
            const safeZoom = zoom > 0 ? zoom : 1;
            const gridX = (ev.clientX - liveRect.left) / safeZoom;
            const gridY = (ev.clientY - liveRect.top) / safeZoom;

            let next: { x: number; y: number; w: number; h: number };
            if (mode === 'move') {
                const phantomLeft = gridX - grabOffset.x;
                const phantomTop = gridY - grabOffset.y;
                next = {
                    x: Math.round(phantomLeft / colPitch),
                    y: Math.round(phantomTop / rowPitch),
                    w: start.w,
                    h: start.h,
                };
            } else {
                const dx = (ev.clientX - initial.startPointer.x) / safeZoom;
                const dy = (ev.clientY - initial.startPointer.y) / safeZoom;
                next = {
                    x: start.x,
                    y: start.y,
                    w: start.w + Math.round(dx / colPitch),
                    h: start.h + Math.round(dy / rowPitch),
                };
            }
            next = clampRect(next, activeLayout.cols, minW, minH);

            // Skip the recompute if the snapped target hasn't changed: avoids
            // pointless React renders during sub-cell finger movement.
            const prev = dragRef.current?.ghost;
            if (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h) {
                return;
            }

            const preview = resolveLayout(activeLayout.widgets, uid, next);
            const newState: DragState = {
                ...initial,
                ghost: next,
                preview,
                pointer: { x: ev.clientX, y: ev.clientY },
                valid: true,
            };
            dragRef.current = newState;
            setDrag(newState);
        };

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            ev.preventDefault();
            maybeStartScroll(ev);
            lastEvent = ev;
            if (rafId == null) {
                rafId = requestAnimationFrame(flush);
            }
        };

        const cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
            if (scrollRafId != null) { cancelAnimationFrame(scrollRafId); scrollRafId = null; }
            lastEvent = null;
            try { captureEl.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
            document.body.style.touchAction = prevTouchAction;
            document.body.style.overscrollBehavior = prevOverscroll;
            setDragZoom(1);
        };

        const onUp = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            cleanup();
            const finalState = dragRef.current;
            if (finalState) {
                // Stage the new placement as PENDING — do NOT commit yet.
                // The user must press "Conferma" in the action bar to apply.
                // This avoids accidental drops when touch is lost mid-gesture.
                stagePending(uid, {
                    x: finalState.ghost.x,
                    y: finalState.ghost.y,
                    w: finalState.ghost.w,
                    h: finalState.ghost.h,
                });
                setSelectedUid(uid);
            }
            dragRef.current = null;
            setDrag(null);
        };
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    const usedTypes = useMemo(() => new Set(activeLayout.widgets.map(w => w.type)), [activeLayout.widgets]);

    /** Widgets to render: live drag preview > pending preview > raw layout. */
    const displayWidgets: WidgetInstance[] = useMemo(() => {
        if (drag) return drag.preview;
        if (pending) {
            const target = { x: pending.x, y: pending.y, w: pending.w, h: pending.h };
            const merged = resolveLayout(activeLayout.widgets, pending.uid, target);
            return merged.map(w => w.uid === pending.uid ? { ...w, ...target } : w);
        }
        return activeLayout.widgets;
    }, [drag, pending, activeLayout.widgets]);

    const totalRows = useMemo(() => {
        const widgets = displayWidgets;
        const fromWidgets = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
        const fromGhost = drag ? drag.ghost.y + drag.ghost.h : 0;
        const fromPending = pending ? pending.y + pending.h : 0;
        const max = Math.max(fromWidgets, fromGhost, fromPending);
        return Math.max(max, editMode ? max + 4 : max);
    }, [displayWidgets, editMode, drag, pending]);

    // Publish the current widget list to the WidgetJump rail (the trigger
    // is the mobile "Panoramica" tab, registered from CharacterSheet).
    useEffect(() => {
        setWidgetJumpData(displayWidgets, editMode);
        return () => clearWidgetJumpData();
    }, [displayWidgets, editMode]);

    const gridStyle: React.CSSProperties = {
        gridTemplateColumns: `repeat(${activeLayout.cols}, minmax(0, 1fr))`,
        gridAutoRows: `${activeLayout.rowHeight}px`,
        minHeight: `${totalRows * activeLayout.rowHeight}px`,
        ['--dash-cols' as never]: activeLayout.cols,
        ['--dash-row-h' as never]: `${activeLayout.rowHeight}px`,
    };

    // Frame shrink for tablet/mobile preview while editing
    const frameMaxWidth = editMode
        ? (activeBp === 'mobile' ? 420 : activeBp === 'tablet' ? 900 : undefined)
        : undefined;
    const colsForBp = COL_PRESETS[activeBp];

    return (
        <div ref={dashRef} className={`dash-root animate-fade-in${editMode ? ' is-fs-edit' : ''}`}>
            {/* TOOLBAR — shown only in edit mode */}
            {editMode && <div className="dash-toolbar">
                {/* Row 1: title info + Fatto (always visible, always together) */}
                <div className="dash-toolbar-title-group">
                    <FaPalette size={11} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', letterSpacing: '0.08em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        La Tua Dashboard
                    </span>
                    <span className="dash-toolbar-meta" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        {activeLayout.widgets.length} widget · {activeLayout.cols} col · {activeLayout.rowHeight}px
                    </span>
                </div>
                {/* Row 2: breakpoint switcher (full-width on mobile) */}
                <div className="dash-toolbar-bp-row">
                    <div className="dash-bp-switch" role="tablist" aria-label="Breakpoint">
                        {BREAKPOINTS.slice().reverse().map(bp => (
                            <button
                                key={bp.id}
                                role="tab"
                                aria-selected={editedBp === bp.id}
                                className={`dash-bp-btn ${editedBp === bp.id ? 'active' : ''}`}
                                onClick={() => setEditedBp(bp.id)}
                                title={`Layout ${bp.label}${viewportBp === bp.id ? ' (corrente)' : ''}`}
                            >
                                {BP_ICONS[bp.id]}
                                <span className="dash-bp-label">{bp.label}</span>
                                {viewportBp === bp.id && <span className="dash-bp-dot" title="Breakpoint corrente" />}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Row 3: secondary controls (scrollable on mobile) */}
                <div className="dash-toolbar-controls-row">
                    <label className="dash-toolbar-control" title="Numero di colonne della griglia">
                        <FaThLarge size={9} />
                        <select className="dash-size-select" value={activeLayout.cols} onChange={e => setCols(parseInt(e.target.value))}>
                            {colsForBp.map(c => <option key={c} value={c}>{c} col</option>)}
                        </select>
                    </label>
                    <label className="dash-toolbar-control" title="Altezza di una riga della griglia">
                        <FaArrowsAlt size={9} />
                        <select className="dash-size-select" value={activeLayout.rowHeight} onChange={e => setRowHeight(parseInt(e.target.value))}>
                            {ROW_HEIGHT_PRESETS.map(h => <option key={h} value={h}>{h}px</option>)}
                        </select>
                    </label>
                    <div className="dash-copy-menu">
                        <button className="btn btn-secondary btn-sm" title="Copia layout da un altro breakpoint">
                            <FaCopy size={9} /> Copia da
                        </button>
                        <div className="dash-copy-dropdown">
                            {BREAKPOINTS.filter(b => b.id !== activeBp).map(b => (
                                <button key={b.id} onClick={() => copyFromOther(b.id)}>
                                    {BP_ICONS[b.id]} {b.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPaletteOpen(p => !p)}>
                        <FaPlus size={9} /> Aggiungi widget
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={resetActive} title={`Ripristina layout di default per ${activeBp}`}>
                        <FaUndo size={9} /> Reset
                    </button>
                </div>
                {/* Fatto button — always last / top-right on mobile */}
                <button
                    className="btn btn-sm btn-primary dash-toolbar-done"
                    onClick={() => { setEditMode(false); setPaletteOpen(false); }}
                    title="Termina personalizzazione"
                >
                    <FaCheck size={9} /> Fatto
                </button>
            </div>}

            {editMode && (
                <div className="dash-edit-hint">
                    Stai modificando il layout <strong style={{ color: 'var(--accent-gold)' }}>{activeBp}</strong>
                    {viewportBp !== activeBp && <> — viewport corrente: <em>{viewportBp}</em>. La preview ti mostra come apparirà su {activeBp}.</>}
                </div>
            )}

            {/* PALETTE */}
            {editMode && paletteOpen && (
                <div className="dash-palette">
                    <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6 }}>
                        Aggiungi un widget — layout {activeBp}
                    </div>
                    <div className="dash-palette-grid">
                        {WIDGET_CATALOG.map(def => {
                            const used = usedTypes.has(def.id);
                            return (
                                <button key={def.id} className="dash-palette-item" onClick={() => addWidget(def.id)}
                                    style={{ borderColor: def.accent ? `${def.accent}55` : undefined }}>
                                    <span className="dash-palette-icon" style={{ color: def.accent }}>{def.icon}</span>
                                    <span className="dash-palette-title">{def.title}</span>
                                    <span className="dash-palette-desc">{def.description}</span>
                                    {used && <span className="dash-palette-badge">già presente</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* PREVIEW FRAME (only in edit mode for non-desktop) */}
            <div className={`dash-frame dash-frame-${activeBp}${editMode ? ' is-edit' : ''}${drag ? ' is-dragging' : ''}${drag && dragZoom < 1 ? ' is-zoomed' : ''}`}
                style={{
                    maxWidth: frameMaxWidth,
                    marginInline: frameMaxWidth ? 'auto' : undefined,
                    transform: drag && dragZoom < 1 ? `scale(${dragZoom})` : undefined,
                    // Center the zoom so the dashboard stays in the middle of
                    // the available viewport instead of sticking to the left.
                    transformOrigin: 'top center',
                    // Collapse the layout space the scaled-down frame would
                    // otherwise leave behind, so the visible canvas matches
                    // the on-screen footprint.
                    marginBottom: drag && dragZoom < 1
                        ? `-${(1 - dragZoom) * (containerRef.current?.scrollHeight ?? 0)}px`
                        : undefined,
                    transition: 'transform 0.2s ease, margin-bottom 0.2s ease',
                    willChange: drag && drag.mode === 'move' ? 'transform' : undefined,
                }}>
                <div ref={containerRef} className={`dash-grid ${editMode ? 'is-edit' : ''}`} style={gridStyle}>
                    {displayWidgets.map(w => {
                        const def = getWidgetDef(w.type);
                        if (!def) return null;
                        // Hide the dragged widget from the grid entirely:
                        // the phantom clone (below) is the visual feedback,
                        // and the ghost outline shows where it'll land.
                        if (drag && drag.uid === w.uid && drag.mode === 'move') return null;
                        const Body = def.render;
                        const isResizing = drag?.uid === w.uid && drag.mode === 'resize';
                        // For a resize, show the live ghost rect; for everything
                        // else (including widgets being re-flowed), use the
                        // freshly computed preview position.
                        const visualRect = isResizing && drag ? drag.ghost : w;
                        const pixelW = Math.max(0, cellWidth * visualRect.w - 16); /* minus padding */
                        const pixelH = Math.max(0, activeLayout.rowHeight * visualRect.h - 40); /* minus header */
                        const widgetSize: WidgetSize = {
                            w: visualRect.w,
                            h: visualRect.h,
                            pixelW,
                            pixelH,
                            size: sizeClassFromWidth(pixelW),
                        };
                        return (
                            <div
                                key={w.uid}
                                data-widget-uid={w.uid}
                                className={`dash-tile ${isResizing ? 'dragging is-resizing' : ''} ${activeUid === w.uid ? 'is-active' : ''} ${selectedUid === w.uid && editMode ? 'is-selected' : ''} ${pending && pending.uid === w.uid && !drag ? 'is-pending' : ''} ${drag && drag.mode === 'move' ? 'is-minimal' : ''}`}
                                style={{
                                    gridColumn: `${visualRect.x + 1} / span ${visualRect.w}`,
                                    gridRow: `${visualRect.y + 1} / span ${visualRect.h}`,
                                    // Pre-compensate the dashboard zoom so text
                                    // stays readable at any scale.
                                    ['--dash-zoom-comp' as never]: drag && dragZoom < 1 ? `${1 / dragZoom}` : '1',
                                    borderColor: drag ? (def.accent ? `${def.accent}66` : undefined) : undefined,
                                }}
                                onMouseDown={() => { if (!editMode) setActiveUid(w.uid); }}
                                onClick={editMode ? () => selectTile(w.uid) : undefined}
                            >
                                {/* Hide the chrome header during a MOVE — the
                                    minimal body shows a big readable label.
                                    During a RESIZE we keep the header so the
                                    user still sees what they're resizing. */}
                                {!(drag && drag.mode === 'move') && (
                                    <div
                                        className="dash-tile-header"
                                        style={{ borderBottomColor: def.accent ? `${def.accent}33` : undefined, cursor: editMode ? 'pointer' : 'default' }}
                                    >
                                        {editMode && (
                                            <span
                                                className="dash-grip"
                                                title="Trascina per spostare"
                                                onPointerDown={startDrag(w.uid, 'move')}
                                                style={{ touchAction: 'none', cursor: 'grab' }}
                                            ><FaGripVertical size={11} /></span>
                                        )}
                                        <span className="dash-tile-title" style={{ color: def.accent || 'var(--accent-gold)' }}>
                                            <span style={{ fontSize: '0.78rem' }}>{def.icon}</span>
                                            {def.title}
                                        </span>
                                        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
                                            {editMode && (
                                                <button
                                                    className="dash-icon-btn danger"
                                                    title="Rimuovi widget"
                                                    onPointerDown={e => e.stopPropagation()}
                                                    onClick={(e) => { e.stopPropagation(); removeWidget(w.uid); if (selectedUid === w.uid) clearSelection(); }}
                                                    style={{ touchAction: 'manipulation' }}
                                                >
                                                    <FaTimes size={9} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="dash-tile-body">
                                    {drag && drag.mode === 'move' ? (
                                        <div className="dash-tile-minimal" style={{ color: def.accent || 'var(--accent-gold)' }}>
                                            <span className="dash-tile-minimal-icon">{def.icon}</span>
                                            <span className="dash-tile-minimal-name">{def.title}</span>
                                            <span className="dash-tile-minimal-size">{visualRect.w} × {visualRect.h}</span>
                                        </div>
                                    ) : (
                                        <Body goTo={goTo} size={widgetSize} />
                                    )}
                                </div>
                                {editMode && !(drag && drag.mode === 'move') && (
                                    <div
                                        className="dash-resize-handle"
                                        onPointerDown={startDrag(w.uid, 'resize')}
                                        title="Trascina per ridimensionare"
                                        style={{ touchAction: 'none' }}
                                    />
                                )}
                            </div>
                        );
                    })}

                    {editMode && drag && (
                        <div
                            className={`dash-ghost ${drag.valid ? 'valid' : 'invalid'}`}
                            style={{
                                gridColumn: `${drag.ghost.x + 1} / span ${drag.ghost.w}`,
                                gridRow: `${drag.ghost.y + 1} / span ${drag.ghost.h}`,
                            }}
                        >
                            <span>{drag.ghost.w} × {drag.ghost.h}</span>
                        </div>
                    )}

                    {/* Pending placement outline — the user must press Conferma to apply. */}
                    {editMode && pending && !drag && (
                        <div
                            className="dash-ghost dash-ghost-pending"
                            style={{
                                gridColumn: `${pending.x + 1} / span ${pending.w}`,
                                gridRow: `${pending.y + 1} / span ${pending.h}`,
                            }}
                        >
                            <span>{pending.w} × {pending.h} — in attesa di conferma</span>
                        </div>
                    )}

                    {/* Phantom is rendered via portal below to escape the
                        scaled `.dash-frame` ancestor (position:fixed is
                        broken inside CSS transforms). */}

                    {activeLayout.widgets.length === 0 && (
                        <div className="dash-empty">
                            <div style={{ fontSize: '2rem', color: 'var(--accent-gold)', opacity: 0.4 }}><FaPalette /></div>
                            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginTop: 8 }}>Dashboard {activeBp} vuota</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                                Aggiungi un widget o copia il layout da un altro breakpoint.
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => { setEditMode(true); setPaletteOpen(true); }}>
                                <FaPlus size={10} /> Aggiungi widget
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Phantom clone — portaled to <body> so the scaled frame's
                CSS transform doesn't break position:fixed. */}
            {editMode && drag && drag.mode === 'move' && (() => {
                const draggedW = activeLayout.widgets.find(x => x.uid === drag.uid);
                const def = draggedW ? getWidgetDef(draggedW.type) : null;
                if (!draggedW || !def) return null;
                const z = dragZoom;
                return createPortal(
                    <div
                        className="dash-phantom"
                        style={{
                            width: drag.tilePx.w,
                            height: drag.tilePx.h,
                            transformOrigin: 'top left',
                            transform: `translate(${drag.pointer.x - drag.grabOffset.x * z}px, ${drag.pointer.y - drag.grabOffset.y * z}px) scale(${z})`,
                            borderColor: def.accent ? `${def.accent}` : undefined,
                            boxShadow: def.accent ? `0 18px 40px rgba(0,0,0,0.6), 0 0 0 3px ${def.accent}88` : undefined,
                        }}
                    >
                        <div
                            className="dash-tile-minimal dash-phantom-content"
                            style={{ color: def.accent || 'var(--accent-gold)' }}
                        >
                            <span className="dash-tile-minimal-icon">{def.icon}</span>
                            <span className="dash-tile-minimal-name">{def.title}</span>
                            <span className="dash-tile-minimal-size">{drag.ghost.w} × {drag.ghost.h}</span>
                        </div>
                    </div>,
                    document.body,
                );
            })()}

            {/* Bottom action bar — portaled to <body> so it stays glued to the
                viewport regardless of any ancestor stacking context (e.g. the
                fullscreen edit overlay or transformed dash-frame). */}
            {editMode && selectedUid && (() => {
                const sel = widgetByUid(selectedUid);
                const def = sel ? getWidgetDef(sel.type) : null;
                if (!sel || !def) return null;
                const cur = currentRectFor(selectedUid)!;
                const minW = def.minW ?? 2;
                const minH = def.minH ?? 2;
                const canShrinkW = cur.w > minW;
                const canGrowW = cur.w < activeLayout.cols;
                const canShrinkH = cur.h > minH;
                const canGrowH = true;
                const canMoveLeft = cur.x > 0;
                const canMoveRight = cur.x + cur.w < activeLayout.cols;
                const canMoveUp = cur.y > 0;
                const hasPending = !!pending && pending.uid === selectedUid;
                return createPortal(
                    <div className="dash-action-bar" role="dialog" aria-label="Modifica widget">
                        <div className="dash-action-row dash-action-row-top">
                            <div className="dash-action-info">
                                <span className="dash-action-icon" style={{ color: def.accent || 'var(--accent-gold)' }}>{def.icon}</span>
                                <div className="dash-action-meta">
                                    <span className="dash-action-title">{def.title}</span>
                                    <span className="dash-action-sub">
                                        {cur.x},{cur.y} · {cur.w}×{cur.h}
                                        {hasPending && <em className="dash-action-pending"> · da confermare</em>}
                                    </span>
                                </div>
                            </div>
                            <button
                                className="dash-action-close"
                                onClick={clearSelection}
                                title="Chiudi"
                                aria-label="Chiudi"
                            ><FaTimes /></button>
                        </div>
                        <div className="dash-action-row dash-action-row-pads">
                            <div className="dash-move-pad" aria-label="Sposta">
                                <span className="dash-pad-label">Sposta</span>
                                <button className="dash-pad-btn up" onClick={() => nudge(0, -1)} disabled={!canMoveUp} title="Su"><FaArrowUp /></button>
                                <button className="dash-pad-btn left" onClick={() => nudge(-1, 0)} disabled={!canMoveLeft} title="Sinistra"><FaArrowLeft /></button>
                                <button className="dash-pad-btn right" onClick={() => nudge(1, 0)} disabled={!canMoveRight} title="Destra"><FaArrowRight /></button>
                                <button className="dash-pad-btn down" onClick={() => nudge(0, 1)} title="Giù"><FaArrowDown /></button>
                            </div>
                            <div className="dash-resize-pad" aria-label="Ridimensiona">
                                <div className="dash-resize-row">
                                    <span className="dash-pad-label">L</span>
                                    <button className="dash-pad-btn" onClick={() => resizeBy(-1, 0)} disabled={!canShrinkW} title="Restringi"><FaCompressArrowsAlt /></button>
                                    <span className="dash-resize-val">{cur.w}</span>
                                    <button className="dash-pad-btn" onClick={() => resizeBy(1, 0)} disabled={!canGrowW} title="Allarga"><FaExpandArrowsAlt /></button>
                                </div>
                                <div className="dash-resize-row">
                                    <span className="dash-pad-label">A</span>
                                    <button className="dash-pad-btn" onClick={() => resizeBy(0, -1)} disabled={!canShrinkH} title="Riduci"><FaCompressArrowsAlt style={{ transform: 'rotate(90deg)' }} /></button>
                                    <span className="dash-resize-val">{cur.h}</span>
                                    <button className="dash-pad-btn" onClick={() => resizeBy(0, 1)} disabled={!canGrowH} title="Aumenta"><FaExpandArrowsAlt style={{ transform: 'rotate(90deg)' }} /></button>
                                </div>
                            </div>
                        </div>
                        <div className="dash-action-row dash-action-buttons">
                            <button
                                className="btn btn-secondary danger dash-action-remove"
                                onClick={removeSelected}
                                title="Rimuovi questo widget"
                                aria-label="Rimuovi"
                            >
                                <FaTrash />
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={cancelPending}
                                disabled={!hasPending}
                                title="Annulla le modifiche non confermate"
                            >
                                <FaBan /> <span className="dash-action-btn-label">Annulla</span>
                            </button>
                            <button
                                className="btn btn-primary dash-action-confirm"
                                onClick={confirmPending}
                                title={hasPending ? 'Applica la nuova posizione' : 'Chiudi'}
                            >
                                <FaCheck /> {hasPending ? 'Conferma' : 'OK'}
                            </button>
                        </div>
                    </div>,
                    document.body,
                );
            })()}

            {/* Press-and-hold jump pad: portaled next to the active tabs row
                (mobile shell on small screens, sheet tabs on desktop). */}
        </div>
    );
};
