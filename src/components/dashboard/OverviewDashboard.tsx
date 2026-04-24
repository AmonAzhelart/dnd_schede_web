import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaPalette, FaPlus, FaTimes, FaUndo, FaGripVertical, FaThLarge, FaArrowsAlt, FaDesktop, FaTabletAlt, FaMobileAlt, FaCopy } from 'react-icons/fa';
import { useCharacterStore } from '../../store/characterStore';
import { WIDGET_CATALOG, getWidgetDef } from './widgets';
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
        { uid: 'w-stats', type: 'stats', x: 0, y: 9, w: 4, h: 4 },
        { uid: 'w-cond', type: 'conditions', x: 0, y: 13, w: 4, h: 4 },
        { uid: 'w-attacks', type: 'attacks', x: 0, y: 17, w: 4, h: 6 },
        { uid: 'w-spells', type: 'spellSlots', x: 0, y: 23, w: 4, h: 6 },
        { uid: 'w-class', type: 'classFeatures', x: 0, y: 29, w: 4, h: 6 },
        { uid: 'w-skills', type: 'skills', x: 0, y: 35, w: 4, h: 8 },
        { uid: 'w-inv', type: 'inventory', x: 0, y: 43, w: 4, h: 7 },
        { uid: 'w-feats', type: 'feats', x: 0, y: 50, w: 4, h: 6 },
        { uid: 'w-currency', type: 'currency', x: 0, y: 56, w: 4, h: 4 },
        { uid: 'w-movement', type: 'movement', x: 0, y: 60, w: 4, h: 4 },
        { uid: 'w-langs', type: 'languages', x: 0, y: 64, w: 4, h: 4 },
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
    /** Scale applied to the dashboard frame while dragging so the user can see
     *  the whole layout. 1 = no zoom; <1 = zoomed out. */
    const [dragZoom, setDragZoom] = useState(1);
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
        const contentH = cont.scrollHeight;
        const colW = (contentW - (activeLayout.cols - 1) * colGap) / activeLayout.cols;
        const colPitch = colW + colGap;
        const rowPitch = activeLayout.rowHeight + rowGap;

        const def = getWidgetDef(widget.type);
        const minW = def?.minW ?? 2;
        const minH = def?.minH ?? 2;

        // Compute a zoom-out factor so the whole dashboard fits in the viewport.
        // Leaves room for the toolbar at the top and a safety margin at the
        // bottom. Only zoom out when actually needed.
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;
        const reservedTop = 120;   // toolbar + edit hint
        const reservedBottom = 40;
        const reservedSides = 20;
        const targetH = Math.max(200, viewportH - reservedTop - reservedBottom);
        const targetW = Math.max(200, viewportW - reservedSides * 2);
        const scaleH = targetH / contentH;
        const scaleW = targetW / contentW;
        const zoom = Math.max(0.4, Math.min(1, scaleH, scaleW));
        setDragZoom(zoom);

        // If we're zooming out, scroll the dashboard frame to the top of the
        // viewport so the entire layout is visible during the drag.
        if (zoom < 1) {
            const frame = cont.closest('.dash-frame') as HTMLElement | null;
            if (frame) {
                const frameTop = frame.getBoundingClientRect().top;
                const desiredTop = reservedTop;
                const scrollDelta = frameTop - desiredTop;
                if (Math.abs(scrollDelta) > 4) {
                    window.scrollBy({ top: scrollDelta, behavior: 'smooth' });
                }
            }
        }

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

        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            ev.preventDefault();

            // Re-read the container's visual rect each frame: when the zoom
            // transform applies, getBoundingClientRect() returns the *scaled*
            // box. We project the pointer back into UNSCALED grid coordinates
            // so snap math always matches the underlying logical grid.
            const liveRect = cont.getBoundingClientRect();
            // Avoid div-by-zero / weird states during the first frame.
            const safeZoom = zoom > 0 ? zoom : 1;
            const gridX = (ev.clientX - liveRect.left) / safeZoom;
            const gridY = (ev.clientY - liveRect.top) / safeZoom;

            let next: { x: number; y: number; w: number; h: number };
            if (mode === 'move') {
                // Position of the phantom's top-left in unscaled grid coords,
                // then snap to the nearest cell using the unscaled pitch.
                const phantomLeft = gridX - grabOffset.x;
                const phantomTop = gridY - grabOffset.y;
                next = {
                    x: Math.round(phantomLeft / colPitch),
                    y: Math.round(phantomTop / rowPitch),
                    w: start.w,
                    h: start.h,
                };
            } else {
                // Resize: convert the pointer delta into unscaled cells.
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

            // Re-flow every other widget around the dragged ghost (gravity up).
            // Re-running from scratch each frame keeps the preview deterministic
            // and matches exactly what compactLayout will commit on drop.
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

        const cleanup = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
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
                // Commit the preview directly: push-down already resolved overlaps.
                const merged = finalState.preview.map(w => w.uid === uid ? { ...w, ...finalState.ghost } : w);
                // Compact upward to avoid leaving gaps from intermediate pushes.
                const compacted = compactLayout(merged, uid);
                updateWidgets(() => compacted);
            }
            dragRef.current = null;
            setDrag(null);
        };
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    const usedTypes = useMemo(() => new Set(activeLayout.widgets.map(w => w.type)), [activeLayout.widgets]);

    const totalRows = useMemo(() => {
        const widgets = drag ? drag.preview : activeLayout.widgets;
        const fromWidgets = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
        const fromGhost = drag ? drag.ghost.y + drag.ghost.h : 0;
        const max = Math.max(fromWidgets, fromGhost);
        return Math.max(max, editMode ? max + 4 : max);
    }, [activeLayout.widgets, editMode, drag]);

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
        <div ref={dashRef} className="dash-root animate-fade-in">
            {/* TOOLBAR — shown only in edit mode */}
            {editMode && <div className="dash-toolbar">
                <div className="flex items-center gap-2">
                    <FaPalette size={11} style={{ color: 'var(--accent-gold)' }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                        La Tua Dashboard
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        {activeLayout.widgets.length} widget · {activeLayout.cols} col · {activeLayout.rowHeight}px
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: 'flex-end' }}>
                    {editMode && (
                        <>
                            {/* Breakpoint selector */}
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
                        </>
                    )}
                    {/* "Fatto" button — inside toolbar; clicking also propagates to parent via setEditMode */}
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={() => { setEditMode(false); setPaletteOpen(false); }}
                        title="Termina personalizzazione"
                    >
                        <FaCheck size={9} /> Fatto
                    </button>
                </div>
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
                    willChange: drag ? 'transform' : undefined,
                }}>
                <div ref={containerRef} className={`dash-grid ${editMode ? 'is-edit' : ''}`} style={gridStyle}>
                    {(drag ? drag.preview : activeLayout.widgets).map(w => {
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
                                className={`dash-tile ${isResizing ? 'dragging' : ''} ${activeUid === w.uid ? 'is-active' : ''} ${drag ? 'is-minimal' : ''}`}
                                style={{
                                    gridColumn: `${visualRect.x + 1} / span ${visualRect.w}`,
                                    gridRow: `${visualRect.y + 1} / span ${visualRect.h}`,
                                    // Pre-compensate the dashboard zoom so text
                                    // stays readable at any scale.
                                    ['--dash-zoom-comp' as never]: drag && dragZoom < 1 ? `${1 / dragZoom}` : '1',
                                    borderColor: drag ? (def.accent ? `${def.accent}66` : undefined) : undefined,
                                }}
                                onMouseDown={() => { if (!editMode) setActiveUid(w.uid); }}
                            >
                                {/* Hide the chrome header during a drag — the
                                    minimal body shows a big readable label. */}
                                {!drag && (
                                    <div
                                        className="dash-tile-header"
                                        style={{ borderBottomColor: def.accent ? `${def.accent}33` : undefined, cursor: editMode ? 'grab' : 'default', touchAction: editMode ? 'none' : undefined }}
                                        onPointerDown={editMode ? startDrag(w.uid, 'move') : undefined}
                                    >
                                        {editMode && (
                                            <span className="dash-grip" title="Trascina per spostare"><FaGripVertical size={9} /></span>
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
                                                    onClick={() => removeWidget(w.uid)}
                                                    style={{ touchAction: 'manipulation' }}
                                                >
                                                    <FaTimes size={9} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="dash-tile-body">
                                    {drag ? (
                                        <div className="dash-tile-minimal" style={{ color: def.accent || 'var(--accent-gold)' }}>
                                            <span className="dash-tile-minimal-icon">{def.icon}</span>
                                            <span className="dash-tile-minimal-name">{def.title}</span>
                                            <span className="dash-tile-minimal-size">{visualRect.w} × {visualRect.h}</span>
                                        </div>
                                    ) : (
                                        <Body goTo={goTo} size={widgetSize} />
                                    )}
                                </div>
                                {editMode && !drag && (
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
        </div>
    );
};
