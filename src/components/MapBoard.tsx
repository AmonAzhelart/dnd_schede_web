/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Stage, Layer, Line, Rect, Ellipse, Circle, Text as KonvaText,
    Group, Image as KonvaImage, Shape as KonvaShapeNode, Transformer,
} from 'react-konva';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import {
    FaTimes, FaDownload, FaTrash, FaPlus, FaPencilAlt, FaMap,
    FaUndo, FaRedo, FaEye, FaEyeSlash, FaLock, FaLockOpen, FaLayerGroup,
    FaSearch, FaArrowUp, FaArrowDown, FaCaretDown, FaEllipsisV,
} from 'react-icons/fa';
import polygonClipping from 'polygon-clipping';
import type {
    MapLevel, DungeonMap, MapShape, MapLayer, MapPoint,
    MapRectShape, MapEllipseShape, MapPolygonShape, MapLineShape,
    MapStampShape, MapTextShape, MapDoorShape, MapStairShape, MapShapeKind, MapLayerKind,
} from '../types/dnd';
import { listAllDndIcons, getDndIconSvg } from './DndIcon';
import { useIconCatalog, sanitizeSvg } from '../services/iconCache';

/* ────────────────────── CONSTANTS ────────────────────── */
const CELL = 40;             // logical "1 grid cell" = 40 px
const SNAP_STEP = CELL / 4;  // quarter-cell snapping when enabled (0.25 grid squares)
const HISTORY_MAX = 40;

const LAYER_DEFAULTS: { kind: MapLayerKind; name: string; fill: string; stroke: string }[] = [
    { kind: 'floor', name: 'Pavimenti', fill: '#e8e0cc', stroke: '#18120e' },
    { kind: 'walls', name: 'Muri', fill: '#18120e', stroke: '#18120e' },
    { kind: 'objects', name: 'Oggetti', fill: '#c9a84c', stroke: '#1a1a1a' },
    { kind: 'notes', name: 'Note', fill: '#f1c40f', stroke: '#7d6314' },
];
const FLOOR_FILL = LAYER_DEFAULTS.find(d => d.kind === 'floor')!.fill;
const FLOOR_STROKE = LAYER_DEFAULTS.find(d => d.kind === 'floor')!.stroke;
const WALL_THICKNESS = 8;

/* ─── DungeonScrawl-style theme constants ─── */
/** Cream paper background outside the floor. */
const PAPER_BG = '#ebe4d2';
/** Subtle dot color stippling the paper background. */
const PAPER_DOT = 'rgba(40, 30, 20, 0.22)';
/** Faint grid line color drawn inside the floor area. */
const FLOOR_GRID = 'rgba(40, 30, 20, 0.18)';
/** Outer "rocky" halo color around the walls. */
const WALL_HALO = '#a8a29a';
/** Mid band sitting between halo and crisp inner stroke. */
const WALL_MID = '#5a544c';
/** Crisp inner wall color (near-black). */
const WALL_INNER = '#15110d';
/** How thick the rocky halo extends outward from the wall, in px. */
const WALL_HALO_EXTRA = 18;
/** Mid band extra thickness (between halo and inner stroke). */
const WALL_MID_EXTRA = 6;

const TOOL_LIST = [
    { id: 'select', icon: '↖', label: 'Seleziona / Sposta', layerKind: undefined as MapLayerKind | undefined },
    { id: 'pan', icon: '✋', label: 'Pan', layerKind: undefined },
    { id: 'rect', icon: '▭', label: 'Stanza rettangolare', layerKind: 'floor' as MapLayerKind },
    { id: 'ellipse', icon: '◯', label: 'Stanza ellittica', layerKind: 'floor' },
    { id: 'polygon', icon: '⬠', label: 'Stanza poligonale (Enter / doppio click)', layerKind: 'floor' },
    { id: 'line', icon: '╱', label: 'Linea / muro', layerKind: 'walls' },
    { id: 'freehand', icon: '✎', label: 'Disegno libero', layerKind: 'walls' },
    { id: 'door', icon: '⌥', label: 'Porta / apertura (taglia il muro)', layerKind: 'walls' },
    { id: 'stair', icon: '⇅', label: 'Scala / portale (collega piani)', layerKind: 'objects' as MapLayerKind },
    { id: 'stamp', icon: '★', label: 'Stamp / oggetto SVG', layerKind: 'objects' },
    { id: 'text', icon: 'T', label: 'Etichetta', layerKind: 'notes' },
    { id: 'erase', icon: '✕', label: 'Cancella elemento', layerKind: undefined },
] as const;
type Tool = (typeof TOOL_LIST)[number]['id'];

/* ────────────────────── HELPERS ────────────────────── */
const getLevelShortLabel = (floor: number) => floor === 0 ? 'PT' : floor > 0 ? `P${floor}` : `B${Math.abs(floor)}`;
const getLevelFullLabel = (floor: number) => floor === 0 ? 'Piano Terra' : floor > 0 ? `Piano ${floor}` : `Interrato ${Math.abs(floor)}`;

const makeLayer = (kind: MapLayerKind, idx = 0): MapLayer => {
    const def = LAYER_DEFAULTS.find(l => l.kind === kind)!;
    return { id: uuidv4(), name: idx > 0 ? `${def.name} ${idx + 1}` : def.name, kind, visible: true, locked: false };
};

const createLevel = (floor: number): MapLevel => {
    const layers = LAYER_DEFAULTS.map(d => makeLayer(d.kind));
    return {
        id: uuidv4(), floor, label: getLevelFullLabel(floor),
        tiles: {}, tokens: [], layers, shapes: [],
    };
};
const createMap = (name: string): DungeonMap => {
    const ground = createLevel(0);
    return { id: uuidv4(), name, createdAt: new Date().toISOString(), levels: [ground], activeLevelId: ground.id };
};

/** Ensure a (possibly legacy) level has the new vector fields. Pure: returns a new object only when needed. */
const upgradeLevel = (lvl: MapLevel): MapLevel => {
    if (lvl.layers && lvl.shapes) return lvl;
    const layers = lvl.layers ?? LAYER_DEFAULTS.map(d => makeLayer(d.kind));
    const floorLayerId = layers.find(l => l.kind === 'floor')!.id;
    const objectsLayerId = layers.find(l => l.kind === 'objects')!.id;
    const shapes: MapShape[] = lvl.shapes ?? [];
    if (!lvl.shapes && lvl.tiles) {
        for (const t of Object.values(lvl.tiles)) {
            shapes.push({
                id: uuidv4(), kind: 'rect', layerId: floorLayerId,
                x: t.x * CELL, y: t.y * CELL, w: CELL, h: CELL,
                fill: '#e8e0cc', stroke: '#18120e', strokeWidth: 4, opacity: 1,
            });
        }
    }
    if (!lvl.shapes && lvl.tokens) {
        for (const tok of lvl.tokens) {
            shapes.push({
                id: tok.id, kind: 'stamp', layerId: objectsLayerId,
                x: tok.x, y: tok.y, size: CELL * 0.85,
                name: tok.name, description: tok.description,
                tint: tok.color,
            });
        }
    }
    return { ...lvl, layers, shapes };
};

const snapVal = (v: number, snap: boolean) => snap ? Math.round(v / SNAP_STEP) * SNAP_STEP : v;
const snapPoint = (p: MapPoint, snap: boolean): MapPoint => ({ x: snapVal(p.x, snap), y: snapVal(p.y, snap) });

/* ────────────────────── STAMP IMAGE CACHE ────────────────────── */
/** Convert raw SVG markup to an HTMLImageElement (data-URL). Cached per (svg+tint).
 *  When `tint` is provided we aggressively recolor: `currentColor`, every
 *  `fill="..."` and `stroke="..."` attribute (except `none` / `transparent`),
 *  and inline `style="fill:...;stroke:..."` declarations.
 *  This lets every SVG icon (not just monochrome ones using currentColor) be
 *  tinted from the inspector. */
const stampImageCache = new Map<string, HTMLImageElement>();
const SKIP_COLORS = new Set(['none', 'transparent']);

function recolorSvg(svg: string, tint: string): string {
    let out = svg.replace(/currentColor/g, tint);
    // Replace every fill="..."/stroke="..." attribute, skipping "none"/"transparent".
    out = out.replace(/(fill|stroke)\s*=\s*"([^"]*)"/gi, (m, attr, val) => {
        if (SKIP_COLORS.has(val.trim().toLowerCase())) return m;
        return `${attr}="${tint}"`;
    });
    out = out.replace(/(fill|stroke)\s*=\s*'([^']*)'/gi, (m, attr, val) => {
        if (SKIP_COLORS.has(val.trim().toLowerCase())) return m;
        return `${attr}='${tint}'`;
    });
    // Replace fill:xxx / stroke:xxx inside style="..." attributes.
    out = out.replace(/style\s*=\s*"([^"]*)"/gi, (_m, css) => {
        const next = String(css).replace(/(fill|stroke)\s*:\s*([^;}"']+)/gi, (mm: string, attr: string, val: string) => {
            if (SKIP_COLORS.has(val.trim().toLowerCase())) return mm;
            return `${attr}:${tint}`;
        });
        return `style="${next}"`;
    });
    return out;
}

function loadStampImage(svgRaw: string, tint?: string): HTMLImageElement {
    let svg = sanitizeSvg(svgRaw);
    if (tint) svg = recolorSvg(svg, tint);
    if (!/viewBox=/.test(svg)) {
        svg = svg.replace(/<svg(\s)/i, `<svg viewBox="0 0 24 24"$1`);
    }
    const key = (tint ?? '') + '|' + svg;
    const hit = stampImageCache.get(key);
    if (hit) return hit;
    const img = new Image();
    img.onload = () => {
        // Notify any mounted MapBoard so it can ask Konva to redraw the layer
        // once the SVG actually finishes decoding (data-URL svgs may be async).
        try { window.dispatchEvent(new CustomEvent('dnd-stamp-loaded')); } catch { /* ignore */ }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    stampImageCache.set(key, img);
    return img;
}

/* ────────────────────── GEOMETRY HELPERS ────────────────────── */
type PCRing = [number, number][];
type PCPolygon = PCRing[];
type PCMulti = PCPolygon[];

const ELLIPSE_SEG = 48;
const ellipseRing = (s: MapEllipseShape): PCRing => {
    const out: PCRing = [];
    for (let i = 0; i < ELLIPSE_SEG; i++) {
        const t = (i / ELLIPSE_SEG) * Math.PI * 2;
        out.push([s.x + Math.cos(t) * s.rx, s.y + Math.sin(t) * s.ry]);
    }
    out.push(out[0]);
    return out;
};
const rectRing = (s: MapRectShape | MapDoorShape): PCRing => ([
    [s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h], [s.x, s.y],
]);
const polyRing = (s: MapPolygonShape): PCRing => {
    const r: PCRing = s.points.map(p => [p.x, p.y]);
    if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]);
    return r;
};
const shapeToOuterRing = (s: MapShape): PCRing | null => {
    if (s.kind === 'rect' || s.kind === 'door') return rectRing(s);
    if (s.kind === 'ellipse') return ellipseRing(s);
    if (s.kind === 'polygon' && s.points.length >= 3) return polyRing(s);
    return null;
};

/** Floor union for one floor layer = union of all rect/ellipse/polygon shapes on that layer.
 *  `excludeIds` lets the live drag preview hide a shape from the union so the user can see
 *  it follow the cursor; the excluded shape is drawn separately, in solid form. */
function unionForLayer(shapes: MapShape[], layerId: string, excludeIds?: Set<string>): PCMulti | null {
    const rings = shapes
        .filter(s => s.layerId === layerId
            && (s.kind === 'rect' || s.kind === 'ellipse' || s.kind === 'polygon')
            && !(excludeIds && excludeIds.has(s.id)))
        .map(s => shapeToOuterRing(s))
        .filter((r): r is PCRing => !!r)
        .map<PCPolygon>(r => [r]);
    if (!rings.length) return null;
    try {
        // polygon-clipping union: pass first then rest
        const [first, ...rest] = rings;
        const u = rest.length ? polygonClipping.union(first, ...rest) : polygonClipping.union(first);
        return u as PCMulti;
    } catch {
        return null;
    }
}

/* ────────────────────── INLINE STYLES ────────────────────── */

/* Top bar (single horizontal toolbar, modern dock-style). */
const topBarStyle: React.CSSProperties = {
    height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
    padding: '0 12px', background: 'linear-gradient(180deg, #1a1410 0%, #15110d 100%)',
    borderBottom: '1px solid rgba(201,168,76,0.18)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.35)', position: 'relative', zIndex: 20,
    overflowX: 'auto', flexWrap: 'nowrap',
};
const topPillStyle = (active: boolean): React.CSSProperties => ({
    height: 30, padding: '0 12px', borderRadius: 6,
    background: active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
    color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.78rem',
    display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
    fontFamily: 'var(--font-body)',
});
const topToolBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 5, fontSize: '0.95rem',
    border: '1px solid transparent', cursor: 'pointer', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.12s', flexShrink: 0,
};
const topChip: React.CSSProperties = {
    height: 26, padding: '0 9px', borderRadius: 4, fontSize: '0.66rem',
    fontFamily: 'var(--font-heading)', letterSpacing: '0.1em',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
};
const topChipActive: React.CSSProperties = {
    background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.5)',
    color: 'var(--accent-gold)',
};
const miniIconBtn: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 4, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-muted)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const vDivider: React.CSSProperties = {
    width: 1, height: 24, background: 'rgba(201,168,76,0.15)', flexShrink: 0, margin: '0 4px',
};
const dropdownPanelStyle: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 240,
    background: 'rgba(20, 16, 13, 0.96)', backdropFilter: 'blur(14px)',
    border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8,
    boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 100, overflow: 'hidden',
};
const menuItemStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: 'transparent', border: 'none',
    color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.78rem',
    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
};
const menuKbd: React.CSSProperties = {
    marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 3,
    fontFamily: 'monospace',
};
const iconBtnGhost: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: 3,
};
const zoomBtn: React.CSSProperties = {
    width: 36, height: 30, fontSize: '0.95rem',
    background: 'transparent', color: 'var(--accent-gold)',
    border: 'none', borderLeft: '1px solid rgba(201,168,76,0.15)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};

/* ════════════════════════════════════════════════════════════════════ */
/*                             MAIN COMPONENT                           */
/* ════════════════════════════════════════════════════════════════════ */
export const MapBoard: React.FC = () => {
    const { character, setCharacter } = useCharacterStore();
    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

    const [tool, setTool] = useState<Tool>('select');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [stageScale, setStageScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 200, y: 100 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const lastTouchDistRef = useRef<number | null>(null);
    const lastTouchMidRef = useRef<{ x: number; y: number } | null>(null);

    const [snap, setSnap] = useState(true);
    const [showGrid, setShowGrid] = useState(true);
    /** Id of a floor-layer shape currently being dragged. While set, the union renderer
     *  hides this shape so the user can see it dragged in solid form (no teleporting). */
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [showLayers, setShowLayers] = useState(false);
    const [pickingStamp, setPickingStamp] = useState<{
        category?: string; name?: string; iconId?: string; svg: string;
    } | null>(null);
    const [stampPickerOpen, setStampPickerOpen] = useState(false);
    const [stampSearch, setStampSearch] = useState('');

    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editingNameVal, setEditingNameVal] = useState('');
    const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
    const [editingLevelVal, setEditingLevelVal] = useState('');
    /** Toggles the modern top-bar dropdowns. */
    const [mapsMenuOpen, setMapsMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);

    const [draftRect, setDraftRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
    const [draftPoints, setDraftPoints] = useState<MapPoint[] | null>(null);
    const [hoverPoint, setHoverPoint] = useState<MapPoint | null>(null);

    const historyPast = useRef<MapLevel[][]>([]);
    const historyFuture = useRef<MapLevel[][]>([]);

    const iconCat = useIconCatalog();

    /* ─── responsive canvas ─── */
    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                const r = containerRef.current.getBoundingClientRect();
                setCanvasSize({ w: Math.max(400, r.width), h: Math.max(300, r.height) });
            }
        };
        update();
        const ro = new ResizeObserver(update);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    /* ─── ensure character has at least one map ─── */
    useEffect(() => {
        if (character && (!character.maps || character.maps.length === 0)) {
            const first = createMap('Mappa 1');
            setCharacter({ ...character, maps: [first], activeMapId: first.id });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [character?.id]);

    const maps = character?.maps;
    const activeMapId = character?.activeMapId || maps?.[0]?.id;
    const activeMap = maps?.find(m => m.id === activeMapId) ?? maps?.[0];

    /* ─── auto-upgrade legacy levels ─── */
    useEffect(() => {
        if (!character || !activeMap) return;
        let changed = false;
        const newLevels = activeMap.levels.map(l => {
            const up = upgradeLevel(l);
            if (up !== l) changed = true;
            return up;
        });
        if (changed) {
            const updated = { ...activeMap, levels: newLevels };
            setCharacter({ ...character, maps: maps!.map(m => m.id === activeMapId ? updated : m) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeMapId]);

    /* ─── async SVG decode → ask Konva to redraw ─── */
    useEffect(() => {
        const onLoaded = () => stageRef.current?.batchDraw?.();
        window.addEventListener('dnd-stamp-loaded', onLoaded);
        return () => window.removeEventListener('dnd-stamp-loaded', onLoaded);
    }, []);

    /* ─── close top-bar dropdowns when clicking anywhere outside ─── */
    useEffect(() => {
        if (!mapsMenuOpen && !moreMenuOpen) return;
        const onDown = () => { setMapsMenuOpen(false); setMoreMenuOpen(false); };
        window.addEventListener('click', onDown);
        return () => window.removeEventListener('click', onDown);
    }, [mapsMenuOpen, moreMenuOpen]);

    /* ─── keyboard shortcuts (placed before early returns to keep hook order) ─── */
    const undoRef = useRef<() => void>(() => { });
    const redoRef = useRef<() => void>(() => { });
    const removeShapeRef = useRef<(id: string) => void>(() => { });
    const finishPolygonRef = useRef<() => void>(() => { });
    const duplicateShapeRef = useRef<(id: string) => void>(() => { });
    const bringForwardRef = useRef<(id: string) => void>(() => { });
    const sendBackwardRef = useRef<(id: string) => void>(() => { });
    const bringToFrontRef = useRef<(id: string) => void>(() => { });
    const sendToBackRef = useRef<(id: string) => void>(() => { });
    const zoomResetRef = useRef<() => void>(() => { });
    const zoomFitRef = useRef<() => void>(() => { });
    const switchLevelRelRef = useRef<(dir: -1 | 1) => void>(() => { });
    useEffect(() => {
        const onKey = (ev: KeyboardEvent) => {
            const tag = (ev.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (ev.ctrlKey && (ev.key === 'z' || ev.key === 'Z')) { ev.preventDefault(); undoRef.current(); return; }
            if (ev.ctrlKey && (ev.key === 'y' || ev.key === 'Y')) { ev.preventDefault(); redoRef.current(); return; }
            if (ev.ctrlKey && (ev.key === 'd' || ev.key === 'D')) { ev.preventDefault(); if (selectedId) duplicateShapeRef.current(selectedId); return; }
            if (ev.ctrlKey && ev.key === '0') { ev.preventDefault(); zoomResetRef.current(); return; }
            if (ev.ctrlKey && (ev.key === '1' || ev.key === 'f' || ev.key === 'F')) { ev.preventDefault(); zoomFitRef.current(); return; }
            if (ev.key === 'PageUp') { ev.preventDefault(); switchLevelRelRef.current(1); return; }
            if (ev.key === 'PageDown') { ev.preventDefault(); switchLevelRelRef.current(-1); return; }
            if (ev.key === ']' && selectedId) { ev.preventDefault(); ev.shiftKey ? bringToFrontRef.current(selectedId) : bringForwardRef.current(selectedId); return; }
            if (ev.key === '[' && selectedId) { ev.preventDefault(); ev.shiftKey ? sendToBackRef.current(selectedId) : sendBackwardRef.current(selectedId); return; }
            if (ev.key === 'Escape') { setDraftPoints(null); setDraftRect(null); setHoverPoint(null); setSelectedId(null); }
            if (ev.key === 'Enter') { finishPolygonRef.current(); }
            if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId) { ev.preventDefault(); removeShapeRef.current(selectedId); }
            if (ev.key === 'v' || ev.key === 'V') setTool('select');
            if (ev.key === ' ') { ev.preventDefault(); setTool('pan'); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedId]);

    /* ─── stamp icon list (bundled + back-office) ─── */
    const allStampIcons = useMemo(() => {
        const bundled = listAllDndIcons().map(i => ({
            key: `b:${i.category}:${i.name}`,
            label: `${i.category} / ${i.name}`,
            search: `${i.category} ${i.name}`.toLowerCase(),
            svg: i.svg,
            category: i.category as string | undefined,
            name: i.name as string | undefined,
            iconId: undefined as string | undefined,
        }));
        const uploaded = iconCat.icons.map(i => ({
            key: `u:${i.id}`,
            label: i.name + (i.category ? ` (${i.category})` : ''),
            search: `${i.name} ${i.category ?? ''} ${(i.tags ?? []).join(' ')}`.toLowerCase(),
            svg: i.svg,
            category: undefined as string | undefined,
            name: undefined as string | undefined,
            iconId: i.id as string | undefined,
        }));
        return [...uploaded, ...bundled];
    }, [iconCat.icons]);
    const filteredStampIcons = useMemo(() => {
        const q = stampSearch.trim().toLowerCase();
        if (!q) return allStampIcons.slice(0, 240);
        return allStampIcons.filter(i => i.search.includes(q)).slice(0, 240);
    }, [allStampIcons, stampSearch]);

    if (!character || !maps || maps.length === 0 || !activeMap) return null;

    const activeLevelId = activeMap.activeLevelId;
    const activeLevelRaw = activeMap.levels.find(l => l.id === activeLevelId) ?? activeMap.levels[0];
    const activeLevel = upgradeLevel(activeLevelRaw);
    const sortedLevels = [...activeMap.levels].sort((a, b) => b.floor - a.floor);

    /* ─── persistence helpers ─── */
    const updateMaps = (newMaps: DungeonMap[]) => setCharacter({ ...character, maps: newMaps });
    const updateActiveMap = (m: DungeonMap) => updateMaps(maps.map(x => x.id === activeMapId ? m : x));

    const pushHistory = () => {
        historyPast.current.push(JSON.parse(JSON.stringify(activeMap.levels)));
        if (historyPast.current.length > HISTORY_MAX) historyPast.current.shift();
        historyFuture.current = [];
    };
    const updateActiveLevel = (level: MapLevel, withHistory = true) => {
        if (withHistory) pushHistory();
        updateActiveMap({ ...activeMap, levels: activeMap.levels.map(l => l.id === activeLevelId ? level : l) });
    };
    undoRef.current = () => {
        const prev = historyPast.current.pop();
        if (!prev) return;
        historyFuture.current.push(JSON.parse(JSON.stringify(activeMap.levels)));
        updateActiveMap({ ...activeMap, levels: prev });
        setSelectedId(null);
    };
    redoRef.current = () => {
        const nxt = historyFuture.current.pop();
        if (!nxt) return;
        historyPast.current.push(JSON.parse(JSON.stringify(activeMap.levels)));
        updateActiveMap({ ...activeMap, levels: nxt });
        setSelectedId(null);
    };

    /* ─── shape helpers ─── */
    const setShapes = (shapes: MapShape[], withHistory = true) =>
        updateActiveLevel({ ...activeLevel, shapes }, withHistory);
    const setLayers = (layers: MapLayer[], withHistory = true) =>
        updateActiveLevel({ ...activeLevel, layers }, withHistory);
    const addShape = (shape: MapShape) => setShapes([...(activeLevel.shapes ?? []), shape]);
    const updateShape = (id: string, patch: Partial<MapShape>, withHistory = true) =>
        setShapes((activeLevel.shapes ?? []).map(s => s.id === id ? ({ ...s, ...patch }) as MapShape : s), withHistory);
    const removeShape = (id: string) => {
        setShapes((activeLevel.shapes ?? []).filter(s => s.id !== id));
        if (selectedId === id) setSelectedId(null);
    };
    removeShapeRef.current = removeShape;

    /** Deep-clone a shape with a fresh id and a small offset so it doesn't sit on top. */
    const duplicateShape = (id: string) => {
        const src = (activeLevel.shapes ?? []).find(s => s.id === id);
        if (!src) return;
        const off = CELL / 2;
        const clone = JSON.parse(JSON.stringify(src)) as MapShape;
        clone.id = uuidv4();
        if (clone.name) clone.name = clone.name + ' (copia)';
        if (clone.kind === 'polygon' || clone.kind === 'line') {
            clone.points = clone.points.map(p => ({ x: p.x + off, y: p.y + off }));
        } else {
            (clone as any).x = ((clone as any).x ?? 0) + off;
            (clone as any).y = ((clone as any).y ?? 0) + off;
        }
        addShape(clone);
        setSelectedId(clone.id);
    };
    /** Move shape one step toward the front of the draw order. */
    const bringForward = (id: string) => {
        const arr = [...(activeLevel.shapes ?? [])];
        const i = arr.findIndex(s => s.id === id);
        if (i < 0 || i === arr.length - 1) return;
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        setShapes(arr);
    };
    const sendBackward = (id: string) => {
        const arr = [...(activeLevel.shapes ?? [])];
        const i = arr.findIndex(s => s.id === id);
        if (i <= 0) return;
        [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
        setShapes(arr);
    };
    const bringToFront = (id: string) => {
        const arr = (activeLevel.shapes ?? []).filter(s => s.id !== id);
        const target = (activeLevel.shapes ?? []).find(s => s.id === id);
        if (!target) return;
        setShapes([...arr, target]);
    };
    const sendToBack = (id: string) => {
        const arr = (activeLevel.shapes ?? []).filter(s => s.id !== id);
        const target = (activeLevel.shapes ?? []).find(s => s.id === id);
        if (!target) return;
        setShapes([target, ...arr]);
    };
    duplicateShapeRef.current = duplicateShape;
    bringForwardRef.current = bringForward;
    sendBackwardRef.current = sendBackward;
    bringToFrontRef.current = bringToFront;
    sendToBackRef.current = sendToBack;

    /** Compute the world-space bounding box of all shapes on the active level. */
    const computeShapesBBox = (): { x: number; y: number; w: number; h: number } | null => {
        const shapes = activeLevel.shapes ?? [];
        if (!shapes.length) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of shapes) {
            if (s.kind === 'rect' || s.kind === 'door' || s.kind === 'stair') {
                minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
                maxX = Math.max(maxX, s.x + s.w); maxY = Math.max(maxY, s.y + s.h);
            } else if (s.kind === 'ellipse') {
                minX = Math.min(minX, s.x - s.rx); minY = Math.min(minY, s.y - s.ry);
                maxX = Math.max(maxX, s.x + s.rx); maxY = Math.max(maxY, s.y + s.ry);
            } else if (s.kind === 'polygon' || s.kind === 'line') {
                for (const p of s.points) {
                    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                }
            } else if (s.kind === 'stamp') {
                const half = s.size / 2;
                minX = Math.min(minX, s.x - half); minY = Math.min(minY, s.y - half);
                maxX = Math.max(maxX, s.x + half); maxY = Math.max(maxY, s.y + half);
            } else if (s.kind === 'text') {
                minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
                maxX = Math.max(maxX, s.x + s.fontSize * 6); maxY = Math.max(maxY, s.y + s.fontSize * 1.4);
            }
        }
        if (!isFinite(minX)) return null;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    };
    const zoomReset = () => { setStageScale(1); setStagePos({ x: 200, y: 100 }); };
    const zoomFit = () => {
        const bbox = computeShapesBBox();
        const W = canvasSize.w - 48 - (showLayers ? 220 : 0);
        const H = canvasSize.h - 44;
        if (!bbox || bbox.w === 0 || bbox.h === 0) { zoomReset(); return; }
        const pad = 60;
        const scale = Math.min(6, Math.max(0.1, Math.min((W - pad * 2) / bbox.w, (H - pad * 2) / bbox.h)));
        setStageScale(scale);
        setStagePos({
            x: -bbox.x * scale + (W - bbox.w * scale) / 2,
            y: -bbox.y * scale + (H - bbox.h * scale) / 2,
        });
    };
    const zoomBy = (factor: number) => {
        const old = stageScale;
        const next = Math.min(6, Math.max(0.1, old * factor));
        // Anchor the zoom on the canvas center so it feels predictable.
        const W = canvasSize.w - 48 - (showLayers ? 220 : 0);
        const H = canvasSize.h - 44;
        const cx = W / 2, cy = H / 2;
        const wx = (cx - stagePos.x) / old, wy = (cy - stagePos.y) / old;
        setStagePos({ x: cx - wx * next, y: cy - wy * next });
        setStageScale(next);
    };
    zoomResetRef.current = zoomReset;
    zoomFitRef.current = zoomFit;

    const layerById = (id: string) => (activeLevel.layers ?? []).find(l => l.id === id);
    const defaultLayerForTool = (t: Tool): MapLayer | undefined => {
        const meta = TOOL_LIST.find(x => x.id === t);
        if (!meta?.layerKind) return undefined;
        return (activeLevel.layers ?? []).find(l => l.kind === meta.layerKind);
    };

    /* ─── maps list ops ─── */
    const newMap = () => {
        const name = `Mappa ${maps.length + 1}`;
        const m = createMap(name);
        setCharacter({ ...character, maps: [...maps, m], activeMapId: m.id });
        setEditingMapId(m.id); setEditingNameVal(name);
        historyPast.current = []; historyFuture.current = [];
    };
    const selectMap = (id: string) => {
        setCharacter({ ...character, activeMapId: id });
        setSelectedId(null);
        historyPast.current = []; historyFuture.current = [];
    };
    const commitRenameMap = (id: string) => {
        const v = editingNameVal.trim();
        if (v) updateMaps(maps.map(m => m.id === id ? { ...m, name: v } : m));
        setEditingMapId(null);
    };
    const deleteMap = (id: string) => {
        if (maps.length <= 1) return;
        if (!confirm('Eliminare questa mappa e tutti i suoi livelli?')) return;
        const remaining = maps.filter(m => m.id !== id);
        const nxt = id === activeMapId ? remaining[0].id : activeMapId;
        setCharacter({ ...character, maps: remaining, activeMapId: nxt });
    };

    /* ─── level ops ─── */
    const switchLevel = (id: string) => { updateActiveMap({ ...activeMap, activeLevelId: id }); setSelectedId(null); };
    /** Create a counterpart stair on the linked level and cross-link them.
     *  The new stair is positioned at the same coordinates so it's easy to find. */
    const autoPairStair = (s: MapStairShape) => {
        if (!s.linkLevelId) { alert('Imposta prima il piano di destinazione.'); return; }
        const tgtLevel = activeMap.levels.find(l => l.id === s.linkLevelId);
        if (!tgtLevel) return;
        // Pick an objects layer on the target level (or fall back to the first).
        const tgtLayer = (tgtLevel.layers ?? []).find(l => l.kind === 'objects')
            ?? (tgtLevel.layers ?? [])[0];
        if (!tgtLayer) return;
        // If this stair already has a linked counterpart that exists, do nothing.
        if (s.linkShapeId && (tgtLevel.shapes ?? []).some(x => x.id === s.linkShapeId)) {
            alert('Già collegata. Doppio click sulla scala per teletrasportarti.');
            return;
        }
        const counterpart: MapStairShape = {
            id: uuidv4(), kind: 'stair', layerId: tgtLayer.id,
            x: s.x, y: s.y, w: s.w, h: s.h,
            stairKind: s.stairKind ?? 'stairs',
            // Inverse direction for the counterpart (up ↔ down)
            direction: s.direction === 'up' ? 'down' : s.direction === 'down' ? 'up' : 'both',
            linkLevelId: activeLevelId,
            linkShapeId: s.id,
            name: `${s.name ?? 'Scala'} (collegamento)`,
            description: '',
            rotation: s.rotation,
        };
        // Insert the counterpart on the target level AND patch the source stair's linkShapeId.
        const updatedLevels = activeMap.levels.map(lvl => {
            if (lvl.id === tgtLevel.id) {
                return { ...lvl, shapes: [...(lvl.shapes ?? []), counterpart] };
            }
            if (lvl.id === activeLevelId) {
                return {
                    ...lvl,
                    shapes: (lvl.shapes ?? []).map(x => x.id === s.id ? { ...x, linkShapeId: counterpart.id } : x),
                };
            }
            return lvl;
        });
        updateActiveMap({ ...activeMap, levels: updatedLevels });
    };
    /** Move to the next level above (dir=+1) or below (dir=-1) the current floor index. */
    switchLevelRelRef.current = (dir: -1 | 1) => {
        const sorted = [...activeMap.levels].sort((a, b) => a.floor - b.floor);
        const i = sorted.findIndex(l => l.id === activeLevelId);
        const nxt = sorted[i + dir];
        if (nxt) switchLevel(nxt.id);
    };
    const addLevelAbove = () => {
        const max = Math.max(...activeMap.levels.map(l => l.floor));
        const lvl = createLevel(max + 1);
        updateActiveMap({ ...activeMap, levels: [...activeMap.levels, lvl], activeLevelId: lvl.id });
    };
    const addLevelBelow = () => {
        const min = Math.min(...activeMap.levels.map(l => l.floor));
        const lvl = createLevel(min - 1);
        updateActiveMap({ ...activeMap, levels: [...activeMap.levels, lvl], activeLevelId: lvl.id });
    };
    const deleteLevel = (id: string) => {
        if (activeMap.levels.length <= 1) return;
        if (!confirm('Eliminare questo livello?')) return;
        const remaining = activeMap.levels.filter(l => l.id !== id);
        const nxt = id === activeLevelId ? remaining[0].id : activeLevelId;
        updateActiveMap({ ...activeMap, levels: remaining, activeLevelId: nxt });
        setSelectedId(null);
    };
    const commitRenameLevel = (id: string) => {
        const v = editingLevelVal.trim();
        if (v) updateActiveMap({ ...activeMap, levels: activeMap.levels.map(l => l.id === id ? { ...l, label: v } : l) });
        setEditingLevelId(null);
    };
    const clearLevel = () => {
        if (confirm(`Cancellare TUTTI gli elementi vettoriali di "${activeLevel.label}"?`))
            updateActiveLevel({ ...activeLevel, shapes: [], tiles: {}, tokens: [] });
    };

    /* ─── coordinate helpers ─── */
    const stageToWorld = (px: number, py: number): MapPoint => ({
        x: (px - stagePos.x) / stageScale,
        y: (py - stagePos.y) / stageScale,
    });
    const pointerWorld = (e: any): MapPoint | null => {
        const stage = e.target.getStage();
        if (!stage) return null;
        const pp = stage.getPointerPosition();
        if (!pp) return null;
        return stageToWorld(pp.x, pp.y);
    };
    /** Extracts clientX/Y from either a MouseEvent or a TouchEvent. */
    const getClientXY = (e: any): { x: number; y: number } => {
        if (e.evt?.touches?.length > 0) return { x: e.evt.touches[0].clientX, y: e.evt.touches[0].clientY };
        if (e.evt?.changedTouches?.length > 0) return { x: e.evt.changedTouches[0].clientX, y: e.evt.changedTouches[0].clientY };
        return { x: e.evt?.clientX ?? 0, y: e.evt?.clientY ?? 0 };
    };

    /* ─── drawing handlers ─── */
    const finishPolygon = () => {
        if (!draftPoints || draftPoints.length < 2) { setDraftPoints(null); return; }
        const lyr = defaultLayerForTool(tool);
        if (!lyr) { setDraftPoints(null); return; }
        const def = LAYER_DEFAULTS.find(d => d.kind === lyr.kind)!;
        if (tool === 'polygon') {
            const s: MapPolygonShape = {
                id: uuidv4(), kind: 'polygon', layerId: lyr.id, points: draftPoints, closed: true,
                fill: def.fill, stroke: def.stroke, strokeWidth: 4, opacity: 1, name: 'Stanza',
            };
            addShape(s);
        } else if (tool === 'line' || tool === 'freehand') {
            const s: MapLineShape = {
                id: uuidv4(), kind: 'line', layerId: lyr.id, points: draftPoints,
                stroke: def.stroke, strokeWidth: tool === 'line' ? 6 : 3, opacity: 1, name: tool === 'line' ? 'Muro' : 'Tratto',
            };
            addShape(s);
        }
        setDraftPoints(null); setHoverPoint(null);
    };
    finishPolygonRef.current = finishPolygon;

    const handleMouseDown = (e: any) => {
        const p = pointerWorld(e); if (!p) return;
        if (e.evt.button === 1 || e.evt.button === 2 || tool === 'pan') {
            setIsPanning(true);
            const cp = getClientXY(e);
            panStartRef.current = { x: cp.x - stagePos.x, y: cp.y - stagePos.y };
            return;
        }
        if (tool === 'select') {
            if (e.target === e.target.getStage()) setSelectedId(null);
            return;
        }
        const sp = snapPoint(p, snap);
        if (tool === 'rect' || tool === 'ellipse' || tool === 'door') {
            setDraftRect({ x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y });
        } else if (tool === 'polygon' || tool === 'line') {
            setDraftPoints(prev => [...(prev ?? []), sp]);
        } else if (tool === 'freehand') {
            setDraftPoints([sp]);
        } else if (tool === 'stamp') {
            if (!pickingStamp) { setStampPickerOpen(true); return; }
            const lyr = defaultLayerForTool('stamp');
            if (!lyr) return;
            const s: MapStampShape = {
                id: uuidv4(), kind: 'stamp', layerId: lyr.id,
                x: sp.x, y: sp.y, size: CELL,
                iconCategory: pickingStamp.category, iconName: pickingStamp.name, iconId: pickingStamp.iconId,
                tint: undefined, name: pickingStamp.name ?? pickingStamp.iconId ?? 'Oggetto', description: '',
            };
            addShape(s);
            setSelectedId(s.id);
        } else if (tool === 'text') {
            const lyr = defaultLayerForTool('text');
            if (!lyr) return;
            const s: MapTextShape = {
                id: uuidv4(), kind: 'text', layerId: lyr.id,
                x: sp.x, y: sp.y, text: 'Etichetta', fontSize: 18,
                fill: '#f1c40f', name: 'Etichetta',
            };
            addShape(s);
            setSelectedId(s.id);
            setTool('select');
        } else if (tool === 'stair') {
            const lyr = defaultLayerForTool('stair');
            if (!lyr) return;
            // Default 1×2 cells stair, snapped, centered on the cursor.
            const sw = CELL, sh = CELL * 2;
            const s: MapStairShape = {
                id: uuidv4(), kind: 'stair', layerId: lyr.id,
                x: snapVal(sp.x - sw / 2, snap), y: snapVal(sp.y - sh / 2, snap),
                w: sw, h: sh,
                stairKind: 'stairs', direction: 'up',
                name: 'Scala', description: '',
            };
            addShape(s);
            setSelectedId(s.id);
            setTool('select');
        }
    };
    const handleMouseMove = (e: any) => {
        if (isPanning) {
            const cp = getClientXY(e);
            setStagePos({ x: cp.x - panStartRef.current.x, y: cp.y - panStartRef.current.y });
            return;
        }
        const p = pointerWorld(e); if (!p) return;
        const sp = snapPoint(p, snap);
        // Always track the current snapped pointer so previews (stamp ghost, polygon/line
        // hover segment, etc.) can render at the cursor position.
        setHoverPoint(sp);
        if (draftRect) setDraftRect(d => d ? { ...d, x1: sp.x, y1: sp.y } : null);
        else if (tool === 'freehand' && draftPoints) setDraftPoints(prev => prev ? [...prev, sp] : prev);
    };
    const handleMouseUp = () => {
        if (isPanning) { setIsPanning(false); return; }
        if (draftRect) {
            const { x0, y0, x1, y1 } = draftRect;
            let x = Math.min(x0, x1), y = Math.min(y0, y1);
            let w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
            setDraftRect(null);
            // Door tool: a click (or a tiny drag) places a default 1-cell horizontal door.
            if (tool === 'door' && (w < CELL / 2 || h < CELL / 4)) {
                w = CELL; h = CELL / 4;
                x = snapVal(x0 - w / 2, snap);
                y = snapVal(y0 - h / 2, snap);
            } else if (w < 4 || h < 4) return;
            const lyr = defaultLayerForTool(tool);
            if (!lyr) return;
            const def = LAYER_DEFAULTS.find(d => d.kind === lyr.kind)!;
            if (tool === 'rect') {
                const s: MapRectShape = {
                    id: uuidv4(), kind: 'rect', layerId: lyr.id, x, y, w, h,
                    fill: def.fill, stroke: def.stroke, strokeWidth: 4, opacity: 1, name: 'Stanza',
                };
                addShape(s); setSelectedId(s.id);
            } else if (tool === 'ellipse') {
                const s: MapEllipseShape = {
                    id: uuidv4(), kind: 'ellipse', layerId: lyr.id,
                    x: x + w / 2, y: y + h / 2, rx: w / 2, ry: h / 2,
                    fill: def.fill, stroke: def.stroke, strokeWidth: 4, opacity: 1, name: 'Camera',
                };
                addShape(s); setSelectedId(s.id);
            } else if (tool === 'door') {
                // The drag rect defines door position and span; thickness = max(short side, WALL_THICKNESS+6).
                const thickness = Math.max(Math.min(w, h), WALL_THICKNESS + 6);
                const span = Math.max(w, h);
                const horizontal = w >= h;
                const dw = horizontal ? span : thickness;
                const dh = horizontal ? thickness : span;
                const dx = x + (w - dw) / 2;
                const dy = y + (h - dh) / 2;
                const s: MapDoorShape = {
                    id: uuidv4(), kind: 'door', layerId: lyr.id,
                    x: dx, y: dy, w: dw, h: dh,
                    name: 'Porta', description: '', rotation: 0,
                    maskFill: FLOOR_FILL,
                };
                addShape(s); setSelectedId(s.id);
            }
            return;
        }
        if (tool === 'freehand' && draftPoints) finishPolygon();
    };
    const handleDblClick = () => {
        if (tool === 'polygon' || tool === 'line') finishPolygon();
    };
    /* ─── touch handlers ─── */
    const handleTouchStart = (e: any) => {
        const touches = e.evt.touches;
        if (touches && touches.length === 2) {
            // Two-finger: begin pinch-zoom + pan; cancel any ongoing draw.
            e.evt.preventDefault();
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            lastTouchDistRef.current = Math.hypot(dx, dy);
            lastTouchMidRef.current = {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2,
            };
            setIsPanning(false);
            setDraftRect(null);
            return;
        }
        lastTouchDistRef.current = null;
        lastTouchMidRef.current = null;
        handleMouseDown(e);
    };
    const handleTouchMove = (e: any) => {
        e.evt.preventDefault();
        const touches = e.evt.touches;
        if (touches && touches.length === 2 && lastTouchDistRef.current !== null) {
            // Pinch-zoom + two-finger pan.
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const newDist = Math.hypot(dx, dy);
            const midX = (touches[0].clientX + touches[1].clientX) / 2;
            const midY = (touches[0].clientY + touches[1].clientY) / 2;
            const rect = stageRef.current?.container()?.getBoundingClientRect();
            const stageMidX = midX - (rect?.left ?? 0);
            const stageMidY = midY - (rect?.top ?? 0);
            const zoomFactor = newDist / lastTouchDistRef.current;
            const newScale = Math.min(6, Math.max(0.1, stageScale * zoomFactor));
            const wx = (stageMidX - stagePos.x) / stageScale;
            const wy = (stageMidY - stagePos.y) / stageScale;
            const panDx = lastTouchMidRef.current ? midX - lastTouchMidRef.current.x : 0;
            const panDy = lastTouchMidRef.current ? midY - lastTouchMidRef.current.y : 0;
            setStagePos({ x: stageMidX - wx * newScale + panDx, y: stageMidY - wy * newScale + panDy });
            setStageScale(newScale);
            lastTouchDistRef.current = newDist;
            lastTouchMidRef.current = { x: midX, y: midY };
            return;
        }
        handleMouseMove(e);
    };
    const handleTouchEnd = () => {
        lastTouchDistRef.current = null;
        lastTouchMidRef.current = null;
        handleMouseUp();
    };
    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const by = 1.1;
        const old = stageScale;
        const stage = e.target.getStage();
        const ptr = stage.getPointerPosition();
        if (!ptr) return;
        const next = Math.min(6, Math.max(0.1, e.evt.deltaY < 0 ? old * by : old / by));
        const mpt = { x: (ptr.x - stagePos.x) / old, y: (ptr.y - stagePos.y) / old };
        setStagePos({ x: ptr.x - mpt.x * next, y: ptr.y - mpt.y * next });
        setStageScale(next);
    };

    /* ─── SHAPE RENDERER ─── */
    /** Refs to Konva nodes by shape id, used to attach the Transformer for resize/rotate. */
    const nodeRefs = useRef<Map<string, any>>(new Map());
    const transformerRef = useRef<any>(null);

    // Re-attach transformer whenever selection changes
    useEffect(() => {
        const tr = transformerRef.current;
        if (!tr) return;
        if (!selectedId || tool !== 'select') {
            tr.nodes([]);
            tr.getLayer()?.batchDraw();
            return;
        }
        const node = nodeRefs.current.get(selectedId);
        if (node) {
            tr.nodes([node]);
            tr.getLayer()?.batchDraw();
        } else {
            tr.nodes([]);
        }
    }, [selectedId, tool, activeLevel.shapes]);

    const handleTransformEnd = (s: MapShape) => (e: any) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        const rot = node.rotation();
        node.scaleX(1); node.scaleY(1);
        if (s.kind === 'rect' || s.kind === 'door' || s.kind === 'stair') {
            const newW = Math.max(2, s.w * sx);
            const newH = Math.max(2, s.h * sy);
            updateShape(s.id, { x: snapVal(node.x(), snap), y: snapVal(node.y(), snap), w: newW, h: newH, rotation: rot } as any);
        } else if (s.kind === 'ellipse') {
            updateShape(s.id, { x: snapVal(node.x(), snap), y: snapVal(node.y(), snap), rx: Math.max(2, s.rx * sx), ry: Math.max(2, s.ry * sy), rotation: rot } as any);
        } else if (s.kind === 'stamp') {
            const newSize = Math.max(8, s.size * Math.max(sx, sy));
            updateShape(s.id, { x: snapVal(node.x(), snap), y: snapVal(node.y(), snap), size: newSize, rotation: rot } as any);
        } else if (s.kind === 'text') {
            const newFs = Math.max(8, s.fontSize * Math.max(sx, sy));
            updateShape(s.id, { x: snapVal(node.x(), snap), y: snapVal(node.y(), snap), fontSize: newFs, rotation: rot } as any);
        } else if (s.kind === 'polygon' || s.kind === 'line') {
            // Drag-only: position is moved relative; commit by adding offset to all points
            const dx = node.x(), dy = node.y();
            node.x(0); node.y(0);
            updateShape(s.id, { points: s.points.map(p => ({ x: snapVal(p.x + dx, snap), y: snapVal(p.y + dy, snap) })) } as any);
        }
    };

    const renderShape = (s: MapShape) => {
        const layer = layerById(s.layerId);
        if (!layer || !layer.visible) return null;

        // Floor union renderer takes care of rect/ellipse/polygon ON FLOOR LAYERS — we only
        // render an invisible hit area + selection highlight here so they remain selectable.
        const isFloorPiece = layer.kind === 'floor' && (s.kind === 'rect' || s.kind === 'ellipse' || s.kind === 'polygon');

        const sel = selectedId === s.id;
        // Stamps/text/doors are ALWAYS selectable on click (auto-switches to select tool)
        // so the user can grab them no matter which tool is active.
        const isAlwaysClickable = (s.kind === 'stamp' || s.kind === 'text' || s.kind === 'door' || s.kind === 'stair');
        const selectable = (tool === 'select' || isAlwaysClickable) && !layer.locked && !s.locked;
        const erasable = tool === 'erase' && !layer.locked && !s.locked;
        const draggable = (tool === 'select' || isAlwaysClickable) && !layer.locked && !s.locked;
        const setRef = (n: any) => { if (n) nodeRefs.current.set(s.id, n); else nodeRefs.current.delete(s.id); };
        const onShapeClick = (e: any) => {
            e.cancelBubble = true;
            if (erasable) { removeShape(s.id); return; }
            if (selectable) {
                if (tool !== 'select' && isAlwaysClickable) setTool('select');
                setSelectedId(s.id);
            }
        };
        const onShapeContextMenu = (e: any) => {
            e.evt?.preventDefault?.();
            e.cancelBubble = true;
            if (!layer.locked && !s.locked) removeShape(s.id);
        };
        const onMouseEnter = (e: any) => {
            const st = e.target.getStage();
            if (st && (selectable || erasable)) st.container().style.cursor = erasable ? 'not-allowed' : 'move';
        };
        const onMouseLeave = (e: any) => {
            const st = e.target.getStage();
            if (st) st.container().style.cursor = '';
        };
        const onDragEnd = (e: any) => {
            // Clear drag-preview shadow set in onDragStart.
            const n = e.target;
            n.shadowEnabled?.(false);
            n.opacity?.(s.opacity ?? 1);
            setDraggingId(null);
            handleTransformEnd(s)(e);
        };
        const onDragStart = (e: any) => {
            const n = e.target;
            // Drag-preview affordance: subtle gold glow + slight transparency
            // so the user clearly sees the element following the cursor.
            n.shadowEnabled?.(true);
            n.shadowColor?.('#c9a84c');
            n.shadowBlur?.(18);
            n.shadowOpacity?.(0.85);
            n.opacity?.(0.85);
            // For floor pieces (rect/ellipse/polygon on a floor layer) we hide them from
            // the union renderer so the user sees the actual shape follow the cursor.
            setDraggingId(s.id);
        };
        const onTransformEnd = handleTransformEnd(s);

        // While being dragged a floor piece is rendered as a normal solid shape (not the
        // invisible hit-area variant) so the user sees it move with the cursor.
        const showAsSolidFloorPiece = isFloorPiece && draggingId === s.id;

        const baseSW = s.strokeWidth ?? 2;

        switch (s.kind) {
            case 'rect': {
                const common = {
                    onClick: onShapeClick, onTap: onShapeClick,
                    onContextMenu: onShapeContextMenu,
                    onMouseEnter, onMouseLeave,
                    onDragStart, onDragEnd, onTransformEnd,
                } as const;
                if (isFloorPiece && !showAsSolidFloorPiece) {
                    return (
                        <Rect key={s.id} ref={setRef} x={s.x} y={s.y} width={s.w} height={s.h}
                            fill="rgba(0,0,0,0.001)"
                            stroke={sel ? '#c9a84c' : 'transparent'} strokeWidth={sel ? 2 / stageScale : 0}
                            dash={sel ? [6 / stageScale, 4 / stageScale] : undefined}
                            rotation={s.rotation ?? 0}
                            draggable={draggable} listening={selectable || erasable}
                            {...common} />
                    );
                }
                return (
                    <Rect key={s.id} ref={setRef} x={s.x} y={s.y} width={s.w} height={s.h}
                        fill={isFloorPiece ? FLOOR_FILL : s.fill}
                        stroke={sel ? '#c9a84c' : (isFloorPiece ? FLOOR_STROKE : s.stroke)}
                        strokeWidth={isFloorPiece ? WALL_THICKNESS : baseSW}
                        opacity={s.opacity ?? 1} rotation={s.rotation ?? 0}
                        draggable={draggable}
                        {...common} />
                );
            }
            case 'ellipse': {
                const common = {
                    onClick: onShapeClick, onTap: onShapeClick,
                    onContextMenu: onShapeContextMenu,
                    onMouseEnter, onMouseLeave,
                    onDragStart, onDragEnd, onTransformEnd,
                } as const;
                if (isFloorPiece && !showAsSolidFloorPiece) {
                    return (
                        <Ellipse key={s.id} ref={setRef} x={s.x} y={s.y} radiusX={s.rx} radiusY={s.ry}
                            fill="rgba(0,0,0,0.001)"
                            stroke={sel ? '#c9a84c' : 'transparent'} strokeWidth={sel ? 2 / stageScale : 0}
                            dash={sel ? [6 / stageScale, 4 / stageScale] : undefined}
                            rotation={s.rotation ?? 0}
                            draggable={draggable} listening={selectable || erasable}
                            {...common} />
                    );
                }
                return (
                    <Ellipse key={s.id} ref={setRef} x={s.x} y={s.y} radiusX={s.rx} radiusY={s.ry}
                        fill={isFloorPiece ? FLOOR_FILL : s.fill}
                        stroke={sel ? '#c9a84c' : (isFloorPiece ? FLOOR_STROKE : s.stroke)}
                        strokeWidth={isFloorPiece ? WALL_THICKNESS : baseSW}
                        opacity={s.opacity ?? 1} rotation={s.rotation ?? 0}
                        draggable={draggable}
                        {...common} />
                );
            }
            case 'polygon': {
                const flat = s.points.flatMap(p => [p.x, p.y]);
                const common = {
                    onClick: onShapeClick, onTap: onShapeClick,
                    onContextMenu: onShapeContextMenu,
                    onMouseEnter, onMouseLeave,
                    onDragStart, onDragEnd,
                } as const;
                if (isFloorPiece && !showAsSolidFloorPiece) {
                    return (
                        <Line key={s.id} ref={setRef} points={flat} closed
                            fill="rgba(0,0,0,0.001)"
                            stroke={sel ? '#c9a84c' : 'transparent'} strokeWidth={sel ? 2 / stageScale : 0}
                            dash={sel ? [6 / stageScale, 4 / stageScale] : undefined}
                            draggable={draggable} listening={selectable || erasable}
                            {...common} />
                    );
                }
                return (
                    <Line key={s.id} ref={setRef} points={flat} closed={s.closed !== false}
                        fill={isFloorPiece ? FLOOR_FILL : s.fill}
                        stroke={sel ? '#c9a84c' : (isFloorPiece ? FLOOR_STROKE : s.stroke)}
                        strokeWidth={isFloorPiece ? WALL_THICKNESS : baseSW}
                        opacity={s.opacity ?? 1} lineJoin="round"
                        draggable={draggable}
                        {...common} />
                );
            }
            case 'line': {
                const flat = s.points.flatMap(p => [p.x, p.y]);
                return (
                    <Line key={s.id} ref={setRef} points={flat}
                        stroke={sel ? '#c9a84c' : (s.stroke ?? '#18120e')}
                        strokeWidth={baseSW} opacity={s.opacity ?? 1}
                        lineCap="round" lineJoin="round"
                        hitStrokeWidth={Math.max(12, baseSW + 8)}
                        draggable={draggable}
                        onClick={onShapeClick} onTap={onShapeClick}
                        onContextMenu={onShapeContextMenu}
                        onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
                        onDragStart={onDragStart} onDragEnd={onDragEnd} />
                );
            }
            case 'door': {
                // Doors are rendered separately as masks+swing in renderDoorMasks.
                // Here we expose only an invisible hit area for selection/drag/transform.
                return (
                    <Rect key={s.id} ref={setRef} x={s.x} y={s.y} width={s.w} height={s.h}
                        fill="rgba(0,0,0,0.001)"
                        stroke={sel ? '#c9a84c' : 'transparent'} strokeWidth={sel ? 2 / stageScale : 0}
                        dash={sel ? [6 / stageScale, 4 / stageScale] : undefined}
                        rotation={s.rotation ?? 0}
                        draggable={draggable} listening={selectable || erasable}
                        onClick={onShapeClick} onTap={onShapeClick}
                        onContextMenu={onShapeContextMenu}
                        onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
                        onDragStart={onDragStart} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd} />
                );
            }
            case 'stamp': {
                const svg = s.iconId
                    ? iconCat.getSvg(s.iconId)
                    : (s.iconCategory && s.iconName ? getDndIconSvg(s.iconCategory, s.iconName) : undefined);
                const img = svg ? loadStampImage(svg, s.tint) : null;
                const half = s.size / 2;
                return (
                    <Group key={s.id} ref={setRef} x={s.x} y={s.y} rotation={s.rotation ?? 0} opacity={s.opacity ?? 1}
                        draggable={draggable}
                        onClick={onShapeClick} onTap={onShapeClick}
                        onContextMenu={onShapeContextMenu}
                        onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
                        onDragStart={onDragStart} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}>
                        {/* Invisible but listening hit-rect: covers the full bounding box so the
                            stamp is always clickable, even where the SVG has transparent pixels. */}
                        <Rect x={-half} y={-half} width={s.size} height={s.size}
                            fill="rgba(0,0,0,0.001)"
                            listening={selectable || erasable} />
                        {img
                            ? <KonvaImage image={img} x={-half} y={-half} width={s.size} height={s.size} listening={false} />
                            : <Circle radius={half * 0.7} fill={s.tint ?? '#666'} listening={false} />
                        }
                        {sel && <Rect x={-half - 3} y={-half - 3} width={s.size + 6} height={s.size + 6}
                            stroke="#c9a84c" strokeWidth={1.5 / stageScale} dash={[4, 4]} listening={false} />}
                    </Group>
                );
            }
            case 'text': return (
                <KonvaText key={s.id} ref={setRef} x={s.x} y={s.y} text={s.text} fontSize={s.fontSize}
                    fill={s.fill ?? '#f1c40f'} rotation={s.rotation ?? 0} opacity={s.opacity ?? 1}
                    draggable={draggable}
                    onClick={onShapeClick} onTap={onShapeClick}
                    onContextMenu={onShapeContextMenu}
                    onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
                    onDragStart={onDragStart} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd} />
            );
            case 'stair': {
                const targetLevel = s.linkLevelId
                    ? activeMap.levels.find(l => l.id === s.linkLevelId)
                    : undefined;
                const linked = !!targetLevel;
                const arrow = s.direction === 'down' ? '▼' : s.direction === 'both' ? '⇅' : '▲';
                const short = targetLevel ? getLevelShortLabel(targetLevel.floor) : '?';
                const stairKind = s.stairKind ?? 'stairs';
                // Double-click teleports to the linked level (and selects the linked stair).
                const onDbl = (e: any) => {
                    e.cancelBubble = true;
                    if (!s.linkLevelId) { setSelectedId(s.id); return; }
                    switchLevel(s.linkLevelId);
                    if (s.linkShapeId) setTimeout(() => setSelectedId(s.linkShapeId!), 30);
                };

                // Color theme per stair kind.
                const theme = !linked
                    ? { bg: 'rgba(192,57,43,0.16)', border: '#c0392b', ink: '#7a2018' }
                    : stairKind === 'portal'
                        ? { bg: 'rgba(155,89,182,0.18)', border: '#8e44ad', ink: '#3d1f4a' }
                        : stairKind === 'trapdoor'
                            ? { bg: 'rgba(122,90,50,0.22)', border: '#7a5a32', ink: '#3a2a16' }
                            : stairKind === 'ladder'
                                ? { bg: 'rgba(160,110,60,0.20)', border: '#9c6a3c', ink: '#3a2410' }
                                : { bg: 'rgba(201,168,76,0.20)', border: '#c9a84c', ink: '#5a3a16' };

                const horizontal = s.w >= s.h;
                const length = horizontal ? s.w : s.h;     // along the long axis
                const breadth = horizontal ? s.h : s.w;    // along the short axis

                // Render-helpers per kind ────────────────────────────────────
                const renderInternals = () => {
                    if (stairKind === 'stairs') {
                        // Perpendicular rungs growing from narrow (top of climb) to wide (bottom).
                        const steps = Math.max(4, Math.round(length / 9));
                        const out: React.ReactNode[] = [];
                        for (let i = 1; i <= steps; i++) {
                            const t = (i / (steps + 1)) * length; // position along long axis
                            // Each step gets progressively wider (perspective effect).
                            const wRatio = 0.35 + (i / steps) * 0.55;
                            const stepBreadth = breadth * wRatio;
                            const offset = (breadth - stepBreadth) / 2;
                            if (horizontal) {
                                out.push(<Line key={`stp_${i}`}
                                    points={[t, offset, t, offset + stepBreadth]}
                                    stroke={theme.ink} strokeWidth={1.2} listening={false} />);
                            } else {
                                out.push(<Line key={`stp_${i}`}
                                    points={[offset, t, offset + stepBreadth, t]}
                                    stroke={theme.ink} strokeWidth={1.2} listening={false} />);
                            }
                        }
                        return out;
                    }
                    if (stairKind === 'ladder') {
                        // Two parallel rails + evenly-spaced rungs.
                        const rungs = Math.max(3, Math.round(length / 10));
                        const inset = breadth * 0.18;
                        const out: React.ReactNode[] = [];
                        // Side rails
                        if (horizontal) {
                            out.push(<Line key="rail_a" points={[2, inset, s.w - 2, inset]} stroke={theme.ink} strokeWidth={1.6} listening={false} />);
                            out.push(<Line key="rail_b" points={[2, breadth - inset, s.w - 2, breadth - inset]} stroke={theme.ink} strokeWidth={1.6} listening={false} />);
                        } else {
                            out.push(<Line key="rail_a" points={[inset, 2, inset, s.h - 2]} stroke={theme.ink} strokeWidth={1.6} listening={false} />);
                            out.push(<Line key="rail_b" points={[breadth - inset, 2, breadth - inset, s.h - 2]} stroke={theme.ink} strokeWidth={1.6} listening={false} />);
                        }
                        // Rungs
                        for (let i = 1; i <= rungs; i++) {
                            const t = (i / (rungs + 1)) * length;
                            if (horizontal) {
                                out.push(<Line key={`rg_${i}`} points={[t, inset, t, breadth - inset]} stroke={theme.ink} strokeWidth={1} listening={false} />);
                            } else {
                                out.push(<Line key={`rg_${i}`} points={[inset, t, breadth - inset, t]} stroke={theme.ink} strokeWidth={1} listening={false} />);
                            }
                        }
                        return out;
                    }
                    if (stairKind === 'trapdoor') {
                        // X cross + hinge tick on one side.
                        const pad = Math.min(s.w, s.h) * 0.18;
                        return [
                            <Line key="x1" points={[pad, pad, s.w - pad, s.h - pad]} stroke={theme.ink} strokeWidth={1.4} listening={false} />,
                            <Line key="x2" points={[s.w - pad, pad, pad, s.h - pad]} stroke={theme.ink} strokeWidth={1.4} listening={false} />,
                            // Hinge marks (top edge)
                            <Line key="h1" points={[pad, 2, pad + 4, 2]} stroke={theme.ink} strokeWidth={2.5} lineCap="round" listening={false} />,
                            <Line key="h2" points={[s.w - pad - 4, 2, s.w - pad, 2]} stroke={theme.ink} strokeWidth={2.5} lineCap="round" listening={false} />,
                        ];
                    }
                    // 'portal': arcane circle with cross-rays.
                    const cx = s.w / 2, cy = s.h / 2;
                    const r = Math.min(s.w, s.h) * 0.32;
                    return [
                        <KonvaShapeNode key="po_ring"
                            sceneFunc={(ctx: any) => {
                                const raw = ctx._context as CanvasRenderingContext2D;
                                raw.beginPath(); raw.arc(cx, cy, r, 0, Math.PI * 2);
                                raw.strokeStyle = theme.ink; raw.lineWidth = 1.6; raw.stroke();
                                raw.beginPath(); raw.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
                                raw.strokeStyle = theme.ink; raw.lineWidth = 1; raw.stroke();
                            }}
                            listening={false} />,
                        // 4 magic rays
                        <Line key="ray1" points={[cx, cy - r * 1.2, cx, cy - r * 0.6]} stroke={theme.ink} strokeWidth={1.2} listening={false} />,
                        <Line key="ray2" points={[cx, cy + r * 0.6, cx, cy + r * 1.2]} stroke={theme.ink} strokeWidth={1.2} listening={false} />,
                        <Line key="ray3" points={[cx - r * 1.2, cy, cx - r * 0.6, cy]} stroke={theme.ink} strokeWidth={1.2} listening={false} />,
                        <Line key="ray4" points={[cx + r * 0.6, cy, cx + r * 1.2, cy]} stroke={theme.ink} strokeWidth={1.2} listening={false} />,
                    ];
                };

                // Where to put the small floor-target badge so it doesn't overlap the artwork.
                // Always at the "exit" end (top for "up", bottom for "down", middle for both).
                const badgeY = s.direction === 'down'
                    ? s.h - 14
                    : s.direction === 'both'
                        ? s.h / 2 - 5
                        : 2;

                return (
                    <Group key={s.id} ref={setRef} x={s.x} y={s.y} rotation={s.rotation ?? 0}
                        opacity={s.opacity ?? 1}
                        draggable={draggable}
                        onClick={onShapeClick} onTap={onShapeClick}
                        onDblClick={onDbl} onDblTap={onDbl}
                        onContextMenu={onShapeContextMenu}
                        onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
                        onDragStart={onDragStart} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd}>
                        {/* Footprint background — full hit area */}
                        <Rect x={0} y={0} width={s.w} height={s.h}
                            fill={theme.bg}
                            stroke={theme.border}
                            strokeWidth={1.5}
                            cornerRadius={3}
                            listening={selectable || erasable} />
                        {/* Internal artwork (kind-specific) */}
                        {renderInternals()}
                        {/* Direction arrow — small and out of the way (top-left corner) */}
                        <KonvaText x={2} y={2} text={arrow}
                            fontSize={10} fontStyle="bold" fill={theme.ink}
                            listening={false} />
                        {/* Target floor badge — pill at the "exit" end */}
                        <Rect x={2} y={badgeY} width={s.w - 4} height={11}
                            fill="rgba(255,255,255,0.6)"
                            cornerRadius={2} listening={false} />
                        <KonvaText x={2} y={badgeY + 1} width={s.w - 4} text={short}
                            fontSize={9} fontStyle="bold" fill={theme.ink}
                            align="center" letterSpacing={0.5} listening={false} />
                        {/* Selection ring */}
                        {sel && <Rect x={-2} y={-2} width={s.w + 4} height={s.h + 4}
                            stroke="#c9a84c" strokeWidth={1.5 / stageScale} dash={[4, 3]} cornerRadius={4} listening={false} />}
                    </Group>
                );
            }
        }
    };

    /* ─── FLOOR UNION RENDERER (Dungeon-Scrawl style) ─── */
    const renderFloorUnions = () => {
        const layers = (activeLevel.layers ?? []).filter(l => l.kind === 'floor' && l.visible);
        const els: React.ReactNode[] = [];
        const exclude = draggingId ? new Set([draggingId]) : undefined;
        // Helper: trace the union path on the given canvas context.
        const tracePath = (ctx: CanvasRenderingContext2D, u: any) => {
            ctx.beginPath();
            for (const poly of u) {
                for (const ring of poly) {
                    ring.forEach(([x, y]: [number, number], i: number) =>
                        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
                    ctx.closePath();
                }
            }
        };
        for (const lyr of layers) {
            const u = unionForLayer(activeLevel.shapes ?? [], lyr.id, exclude);
            if (!u || !u.length) continue;

            // 1) Outer rocky halo: very thick soft grey, slight blur. Sits behind everything.
            els.push(
                <KonvaShapeNode key={`floorhalo_${lyr.id}`}
                    sceneFunc={(ctx: any) => {
                        const raw = ctx._context as CanvasRenderingContext2D;
                        tracePath(raw, u);
                        raw.save();
                        raw.strokeStyle = WALL_HALO;
                        raw.lineWidth = WALL_THICKNESS + WALL_HALO_EXTRA * 2;
                        raw.lineJoin = 'round';
                        raw.lineCap = 'round';
                        raw.shadowColor = 'rgba(0,0,0,0.25)';
                        raw.shadowBlur = 6;
                        raw.stroke();
                        raw.restore();
                    }}
                    listening={false} />,
            );
            // 2) Mid darker band, gives a 3-tone chiseled feel.
            els.push(
                <KonvaShapeNode key={`floormid_${lyr.id}`}
                    sceneFunc={(ctx: any) => {
                        const raw = ctx._context as CanvasRenderingContext2D;
                        tracePath(raw, u);
                        raw.strokeStyle = WALL_MID;
                        raw.lineWidth = WALL_THICKNESS + WALL_MID_EXTRA * 2;
                        raw.lineJoin = 'round';
                        raw.lineCap = 'round';
                        raw.stroke();
                    }}
                    listening={false} />,
            );
            // 3) Floor fill (cream).
            els.push(
                <KonvaShapeNode key={`floorfill_${lyr.id}`}
                    sceneFunc={(ctx: any) => {
                        const raw = ctx._context as CanvasRenderingContext2D;
                        tracePath(raw, u);
                        raw.fillStyle = FLOOR_FILL;
                        raw.fill('evenodd');
                    }}
                    listening={false} />,
            );
            // 4) Inside grid lines, clipped to the floor union (so the grid is visible only inside rooms).
            if (showGrid) {
                els.push(
                    <KonvaShapeNode key={`floorgrid_${lyr.id}`}
                        sceneFunc={(ctx: any) => {
                            const raw = ctx._context as CanvasRenderingContext2D;
                            // Compute the bbox of this union to bound grid drawing.
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            for (const poly of u) for (const ring of poly) for (const [x, y] of ring) {
                                if (x < minX) minX = x; if (y < minY) minY = y;
                                if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                            }
                            const startX = Math.ceil(minX / CELL) * CELL;
                            const startY = Math.ceil(minY / CELL) * CELL;
                            raw.save();
                            tracePath(raw, u);
                            raw.clip('evenodd');
                            raw.strokeStyle = FLOOR_GRID;
                            raw.lineWidth = 1 / stageScale;
                            for (let x = startX; x <= maxX; x += CELL) {
                                raw.beginPath();
                                raw.moveTo(x, minY);
                                raw.lineTo(x, maxY);
                                raw.stroke();
                            }
                            for (let y = startY; y <= maxY; y += CELL) {
                                raw.beginPath();
                                raw.moveTo(minX, y);
                                raw.lineTo(maxX, y);
                                raw.stroke();
                            }
                            raw.restore();
                        }}
                        listening={false} />,
                );
            }
            // 5) Crisp inner wall stroke, drawn on top so it stands out against the floor.
            els.push(
                <KonvaShapeNode key={`floorwall_${lyr.id}`}
                    sceneFunc={(ctx: any) => {
                        const raw = ctx._context as CanvasRenderingContext2D;
                        tracePath(raw, u);
                        raw.strokeStyle = WALL_INNER;
                        raw.lineWidth = WALL_THICKNESS;
                        raw.lineJoin = 'round';
                        raw.lineCap = 'round';
                        raw.stroke();
                    }}
                    listening={false} />,
            );
        }
        return els;
    };

    /** Render door masks (cover the wall stroke under the door rect), rendered AFTER walls. */
    const renderDoorMasks = () => {
        const doors = (activeLevel.shapes ?? []).filter((s): s is MapDoorShape => {
            if (s.kind !== 'door') return false;
            const lyr = layerById(s.layerId);
            return !!lyr && lyr.visible;
        });
        return doors.map(d => {
            // Door is rendered along its long axis. We always draw with the long axis horizontal
            // and use a Group rotation to orient it; if the user drew it tall (h>w), we add 90°.
            const horizontal = d.w >= d.h;
            const span = horizontal ? d.w : d.h;        // length along the wall
            const thickness = horizontal ? d.h : d.w;   // wall thickness
            const extraRot = horizontal ? 0 : 90;
            // Slab dimensions (proportional to span, but capped so it always reads as a door)
            const slabLen = Math.max(span - 4, span * 0.92);
            const slabThick = Math.max(thickness * 0.55, 6);
            return (
                <Group key={`dm_${d.id}`} x={d.x + d.w / 2} y={d.y + d.h / 2}
                    rotation={(d.rotation ?? 0) + extraRot} listening={false}>
                    {/* 1. Mask the wall: paint the door footprint with the floor color so the
                        underlying wall stroke disappears in this slot. */}
                    <Rect x={-span / 2 - 1} y={-thickness / 2 - 1}
                        width={span + 2} height={thickness + 2}
                        fill={d.maskFill ?? FLOOR_FILL} listening={false} />
                    {/* 2. Door jambs: small black bumps where the wall meets the door frame. */}
                    <Rect x={-span / 2 - 2} y={-thickness / 2}
                        width={4} height={thickness}
                        fill={FLOOR_STROKE} cornerRadius={1} listening={false} />
                    <Rect x={span / 2 - 2} y={-thickness / 2}
                        width={4} height={thickness}
                        fill={FLOOR_STROKE} cornerRadius={1} listening={false} />
                    {/* 3. Door slab — thick wood plank centered in the opening. */}
                    <Rect x={-slabLen / 2} y={-slabThick / 2}
                        width={slabLen} height={slabThick}
                        fill="#8b6534"
                        stroke="#2a1c0e" strokeWidth={1.2}
                        cornerRadius={1.5} listening={false} />
                    {/* 4. Plank grain — two faint horizontal lines for texture. */}
                    <Line points={[-slabLen / 2 + 2, -slabThick / 4, slabLen / 2 - 2, -slabThick / 4]}
                        stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} listening={false} />
                    <Line points={[-slabLen / 2 + 2, slabThick / 4, slabLen / 2 - 2, slabThick / 4]}
                        stroke="rgba(0,0,0,0.25)" strokeWidth={0.6} listening={false} />
                    {/* 5. Door knob — small dot near one end of the slab. */}
                    <KonvaShapeNode
                        sceneFunc={(ctx: any) => {
                            const raw = ctx._context as CanvasRenderingContext2D;
                            raw.beginPath();
                            raw.arc(slabLen / 2 - 4, 0, 1.6, 0, Math.PI * 2);
                            raw.fillStyle = '#1a1208';
                            raw.fill();
                        }}
                        listening={false}
                    />
                </Group>
            );
        });
    };


    /** Background dot grid (DungeonScrawl-style stippled paper). One small dot per cell intersection. */
    const renderGrid = () => {
        if (!showGrid) return null;
        const w = canvasSize.w / stageScale + 200;
        const h = canvasSize.h / stageScale + 200;
        const ox = -stagePos.x / stageScale - 100;
        const oy = -stagePos.y / stageScale - 100;
        const startX = Math.floor(ox / CELL) * CELL;
        const startY = Math.floor(oy / CELL) * CELL;
        const dotR = 1.4 / stageScale;
        // Render the entire dot field with a single sceneFunc to keep performance high.
        return (
            <KonvaShapeNode
                key="bgDots"
                sceneFunc={(ctx: any) => {
                    const raw = ctx._context as CanvasRenderingContext2D;
                    raw.fillStyle = PAPER_DOT;
                    for (let x = startX; x < ox + w; x += CELL) {
                        for (let y = startY; y < oy + h; y += CELL) {
                            raw.beginPath();
                            raw.arc(x, y, dotR, 0, Math.PI * 2);
                            raw.fill();
                        }
                    }
                }}
                listening={false}
            />
        );
    };

    const renderDraft = () => {
        const els: React.ReactNode[] = [];
        if (draftRect) {
            const { x0, y0, x1, y1 } = draftRect;
            const x = Math.min(x0, x1), y = Math.min(y0, y1);
            const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
            if (tool === 'rect')
                els.push(<Rect key="draftR" x={x} y={y} width={w} height={h} stroke="#c9a84c" dash={[6, 4]} strokeWidth={2 / stageScale} fill="rgba(201,168,76,0.12)" listening={false} />);
            else if (tool === 'ellipse')
                els.push(<Ellipse key="draftE" x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} stroke="#c9a84c" dash={[6, 4]} strokeWidth={2 / stageScale} fill="rgba(201,168,76,0.12)" listening={false} />);
            else if (tool === 'door')
                els.push(<Rect key="draftD" x={x} y={y} width={w} height={h} stroke="#7a5a32" dash={[4, 3]} strokeWidth={2 / stageScale} fill="rgba(122,90,50,0.20)" listening={false} />);
            // Live size readout while drag-drawing rect/ellipse/door — shown in grid squares.
            els.push(
                <KonvaText key="draftSz" x={x + w + 6 / stageScale} y={y - 14 / stageScale}
                    text={`${(w / CELL).toFixed(2)} × ${(h / CELL).toFixed(2)} cas.`}
                    fontSize={11 / stageScale} fill="#c9a84c" listening={false} />,
            );
        }
        if (draftPoints && draftPoints.length > 0) {
            const pts = [...draftPoints];
            if (hoverPoint && (tool === 'polygon' || tool === 'line')) pts.push(hoverPoint);
            const flat = pts.flatMap(p => [p.x, p.y]);
            els.push(<Line key="draftP" points={flat} stroke="#c9a84c" strokeWidth={2 / stageScale} dash={[6, 4]} closed={tool === 'polygon'} fill={tool === 'polygon' ? 'rgba(201,168,76,0.12)' : undefined} listening={false} />);
            for (const p of draftPoints) {
                els.push(<Circle key={`pt_${p.x}_${p.y}`} x={p.x} y={p.y} radius={4 / stageScale} fill="#c9a84c" listening={false} />);
            }
        }
        // ── Ghost preview at the cursor ────────────────────────────
        if (hoverPoint && !draftRect && !draftPoints) {
            if (tool === 'stamp' && pickingStamp) {
                const svg = pickingStamp.iconId
                    ? iconCat.getSvg(pickingStamp.iconId)
                    : (pickingStamp.category && pickingStamp.name ? getDndIconSvg(pickingStamp.category, pickingStamp.name) : undefined);
                const img = svg ? loadStampImage(svg) : null;
                const sz = CELL;
                const half = sz / 2;
                els.push(
                    <Group key="ghostStamp" x={hoverPoint.x} y={hoverPoint.y} opacity={0.55} listening={false}>
                        {img && <KonvaImage image={img} x={-half} y={-half} width={sz} height={sz} listening={false} />}
                        <Rect x={-half} y={-half} width={sz} height={sz}
                            stroke="#c9a84c" strokeWidth={1.5 / stageScale} dash={[4, 4]} listening={false} />
                    </Group>,
                );
            } else if (tool === 'text') {
                els.push(
                    <KonvaText key="ghostText" x={hoverPoint.x} y={hoverPoint.y}
                        text="Etichetta" fontSize={18} fill="#f1c40f" opacity={0.5} listening={false} />,
                );
            } else if (tool === 'rect' || tool === 'ellipse' || tool === 'door' || tool === 'line' || tool === 'polygon' || tool === 'freehand') {
                // Crosshair to make the snapped placement obvious.
                const r = 8 / stageScale;
                els.push(<Line key="chH" points={[hoverPoint.x - r, hoverPoint.y, hoverPoint.x + r, hoverPoint.y]} stroke="#c9a84c" strokeWidth={1 / stageScale} opacity={0.6} listening={false} />);
                els.push(<Line key="chV" points={[hoverPoint.x, hoverPoint.y - r, hoverPoint.x, hoverPoint.y + r]} stroke="#c9a84c" strokeWidth={1 / stageScale} opacity={0.6} listening={false} />);
            }
        }
        return els;
    };

    const selectedShape = (activeLevel.shapes ?? []).find(s => s.id === selectedId) ?? null;

    const exportPNG = () => {
        const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
        if (!uri) return;
        const a = document.createElement('a');
        a.href = uri;
        a.download = `${activeMap.name} - ${activeLevel.label}.png`;
        a.click();
    };

    const orderedShapes = (() => {
        const layers = activeLevel.layers ?? [];
        const layerOrder = new Map(layers.map((l, i) => [l.id, i]));
        return [...(activeLevel.shapes ?? [])].sort((a, b) => {
            const la = layerOrder.get(a.layerId) ?? 0;
            const lb = layerOrder.get(b.layerId) ?? 0;
            return la - lb;
        });
    })();

    /* ════════════════════════════════════════════════════════════ */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'none', overflow: 'hidden', background: 'var(--bg-surface)' }}>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━ TOP BAR ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div style={topBarStyle} onClick={() => { setMapsMenuOpen(false); setMoreMenuOpen(false); }}>
                {/* Maps dropdown */}
                <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setMapsMenuOpen(o => !o); setMoreMenuOpen(false); }}
                        style={topPillStyle(mapsMenuOpen)} title="Cambia mappa">
                        <FaMap size={11} style={{ color: 'var(--accent-gold)' }} />
                        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeMap.name}</span>
                        <FaCaretDown size={10} style={{ opacity: 0.7 }} />
                    </button>
                    {mapsMenuOpen && (
                        <div style={dropdownPanelStyle}>
                            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
                                {maps.map(m => (
                                    <div key={m.id} onClick={() => { selectMap(m.id); setMapsMenuOpen(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer',
                                            background: m.id === activeMapId ? 'rgba(201,168,76,0.1)' : 'transparent',
                                        }}
                                        onMouseEnter={e => { if (m.id !== activeMapId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                                        onMouseLeave={e => { if (m.id !== activeMapId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        {editingMapId === m.id ? (
                                            <form onSubmit={e => { e.preventDefault(); commitRenameMap(m.id); }} style={{ flex: 1, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                                <input autoFocus value={editingNameVal} onChange={e => setEditingNameVal(e.target.value)} onBlur={() => commitRenameMap(m.id)} onKeyDown={e => e.key === 'Escape' && setEditingMapId(null)}
                                                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--accent-gold)', borderRadius: 3, padding: '2px 5px', color: 'var(--text-primary)', fontSize: '0.78rem', outline: 'none' }} />
                                            </form>
                                        ) : (
                                            <>
                                                <FaMap size={10} style={{ color: m.id === activeMapId ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
                                                <span style={{ flex: 1, fontSize: '0.79rem', color: m.id === activeMapId ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{m.name}</span>
                                                <button title="Rinomina" onClick={e => { e.stopPropagation(); setEditingMapId(m.id); setEditingNameVal(m.name); }} style={iconBtnGhost}><FaPencilAlt size={9} /></button>
                                                {maps.length > 1 && (
                                                    <button title="Elimina" onClick={e => { e.stopPropagation(); deleteMap(m.id); }} style={{ ...iconBtnGhost, color: 'var(--accent-crimson)' }}><FaTrash size={9} /></button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => { newMap(); setMapsMenuOpen(false); }}
                                style={{
                                    width: '100%', padding: '8px 10px', borderTop: '1px solid rgba(201,168,76,0.15)',
                                    background: 'transparent', border: 'none', color: 'var(--accent-gold)',
                                    cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6,
                                    fontFamily: 'var(--font-heading)', letterSpacing: '0.04em',
                                }}>
                                <FaPlus size={10} /> NUOVA MAPPA
                            </button>
                        </div>
                    )}
                </div>

                <div style={vDivider} />

                {/* Tools — horizontal palette */}
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    {TOOL_LIST.map(t => (
                        <button key={t.id} title={t.label}
                            onClick={() => { setTool(t.id); if (t.id === 'stamp') setStampPickerOpen(true); }}
                            style={{
                                ...topToolBtn,
                                background: tool === t.id ? 'rgba(201,168,76,0.2)' : 'transparent',
                                border: `1px solid ${tool === t.id ? 'rgba(201,168,76,0.5)' : 'transparent'}`,
                                color: tool === t.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            }}>{t.icon}</button>
                    ))}
                </div>

                <div style={{ flex: 1 }} />

                {/* View toggles */}
                <button title={`Snap alla griglia (aggancio a 1/4 di casella ≈ ${SNAP_STEP}px)`} onClick={() => setSnap(s => !s)}
                    style={{ ...topChip, ...(snap ? topChipActive : {}) }}>SNAP</button>
                <button title="Mostra griglia di sfondo" onClick={() => setShowGrid(v => !v)}
                    style={{ ...topChip, ...(showGrid ? topChipActive : {}) }}>GRID</button>
                <button title="Pannello layer" onClick={() => setShowLayers(v => !v)}
                    style={{ ...topToolBtn, ...(showLayers ? { background: 'rgba(201,168,76,0.2)', color: 'var(--accent-gold)', border: '1px solid rgba(201,168,76,0.5)' } : { color: 'var(--text-secondary)' }) }}>
                    <FaLayerGroup size={12} />
                </button>

                <div style={vDivider} />

                <button title="Annulla (Ctrl+Z)" onClick={() => undoRef.current()} style={{ ...topToolBtn, color: 'var(--text-secondary)' }}><FaUndo size={11} /></button>
                <button title="Rifai (Ctrl+Y)" onClick={() => redoRef.current()} style={{ ...topToolBtn, color: 'var(--text-secondary)' }}><FaRedo size={11} /></button>

                <div style={vDivider} />

                <button title="Esporta PNG" onClick={exportPNG} style={{ ...topToolBtn, color: 'var(--text-secondary)' }}><FaDownload size={11} /></button>

                {/* More menu */}
                <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button title="Altre azioni" onClick={() => { setMoreMenuOpen(o => !o); setMapsMenuOpen(false); }}
                        style={{ ...topToolBtn, color: 'var(--text-secondary)' }}>
                        <FaEllipsisV size={11} />
                    </button>
                    {moreMenuOpen && (
                        <div style={{ ...dropdownPanelStyle, right: 0, left: 'auto', minWidth: 200 }}>
                            <button onClick={() => { zoomFit(); setMoreMenuOpen(false); }} style={menuItemStyle}>
                                ⤢ Adatta a contenuto <span style={menuKbd}>Ctrl+F</span>
                            </button>
                            <button onClick={() => { zoomReset(); setMoreMenuOpen(false); }} style={menuItemStyle}>
                                1:1 Reset zoom <span style={menuKbd}>Ctrl+0</span>
                            </button>
                            <div style={{ height: 1, background: 'rgba(201,168,76,0.15)', margin: '4px 0' }} />
                            <button onClick={() => { clearLevel(); setMoreMenuOpen(false); }}
                                style={{ ...menuItemStyle, color: 'var(--accent-crimson)' }}>
                                <FaTrash size={10} /> Cancella livello
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━ CANVAS ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div ref={containerRef} style={{
                flex: 1, position: 'relative', background: PAPER_BG, overflow: 'hidden', minHeight: 0,
                cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair',
                touchAction: 'none',
            }}>
                <Stage ref={stageRef}
                    width={canvasSize.w}
                    height={canvasSize.h}
                    scaleX={stageScale} scaleY={stageScale}
                    x={stagePos.x} y={stagePos.y}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { setIsPanning(false); setDraftRect(null); setHoverPoint(null); if (tool === 'freehand' && draftPoints) finishPolygon(); }}
                    onDblClick={handleDblClick}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onDblTap={handleDblClick}
                    onWheel={handleWheel}
                    onContextMenu={e => e.evt.preventDefault()}
                >
                    <Layer>
                        {renderGrid()}
                        {renderFloorUnions()}
                        {orderedShapes.map(renderShape)}
                        {renderDoorMasks()}
                        {renderDraft()}
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled
                            keepRatio={false}
                            ignoreStroke
                            anchorSize={8}
                            anchorStroke="#c9a84c"
                            anchorFill="#1b1410"
                            borderStroke="#c9a84c"
                            borderDash={[4, 4]}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6) return oldBox;
                                return newBox;
                            }}
                        />
                    </Layer>
                </Stage>

                {/* Breadcrumb badge top-left */}
                <div style={{
                    position: 'absolute', top: 12, left: 12,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6,
                    padding: '5px 12px', fontSize: '0.72rem', fontFamily: 'var(--font-heading)',
                    color: 'var(--accent-gold)', letterSpacing: '0.08em', pointerEvents: 'none',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                    {getLevelShortLabel(activeLevel.floor)} · {activeLevel.label}
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, letterSpacing: '0.04em', fontFamily: 'var(--font-body)', fontSize: '0.68rem' }}>
                        {(activeLevel.shapes ?? []).length} elem.
                    </span>
                </div>

                {/* ━━━ Floor Stack (elevator) — vertical building visualizer, left edge ━━━ */}
                <FloorStack
                    levels={sortedLevels}
                    activeLevelId={activeLevelId}
                    canDelete={activeMap.levels.length > 1}
                    editingId={editingLevelId}
                    editingVal={editingLevelVal}
                    onSwitch={switchLevel}
                    onAddAbove={addLevelAbove}
                    onAddBelow={addLevelBelow}
                    onDelete={deleteLevel}
                    onStartRename={(id, label) => { setEditingLevelId(id); setEditingLevelVal(label); }}
                    onChangeRename={setEditingLevelVal}
                    onCommitRename={commitRenameLevel}
                    onCancelRename={() => setEditingLevelId(null)}
                />

                {/* Floating zoom strip — horizontal, bottom-right */}
                <div style={{
                    position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden',
                }}>
                    <button title="Zoom out" onClick={() => zoomBy(1 / 1.2)} style={zoomBtn}>−</button>
                    <button title="Reset zoom (Ctrl+0)" onClick={zoomReset}
                        style={{ ...zoomBtn, width: 56, fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(stageScale * 100)}%
                    </button>
                    <button title="Zoom in" onClick={() => zoomBy(1.2)} style={zoomBtn}>+</button>
                    <button title="Adatta (Ctrl+F)" onClick={zoomFit} style={zoomBtn}>⤢</button>
                </div>

                {/* Status pill — bottom-left */}
                <div style={{
                    position: 'absolute', bottom: 12, left: 12,
                    background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6,
                    padding: '5px 10px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)',
                    pointerEvents: 'none', letterSpacing: '0.04em', display: 'flex', gap: 8, alignItems: 'center',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                    <span style={{ color: '#f5d97a', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', fontWeight: 600 }}>{tool.toUpperCase()}</span>
                    {snap && <span>· snap</span>}
                    {selectedId && <span>· 1 sel.</span>}
                    <span style={{ opacity: 0.65 }}>· V/Space · Ctrl+Z/Y/D · [/] · PgUp/Dn=piano</span>
                </div>

                {/* Stamp picker — slide-in left */}
                {tool === 'stamp' && stampPickerOpen && (
                    <div style={{
                        position: 'absolute', top: 56, left: 12, width: 300, maxHeight: 'calc(100% - 80px)',
                        background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8,
                        display: 'flex', flexDirection: 'column', zIndex: 30,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
                    }}>
                        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(201,168,76,0.2)' }}>
                            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--accent-gold)', letterSpacing: '0.06em', flex: 1 }}>STAMP</span>
                            <button onClick={() => setStampPickerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><FaTimes size={11} /></button>
                        </div>
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FaSearch size={10} style={{ color: 'var(--text-muted)' }} />
                            <input value={stampSearch} onChange={e => setStampSearch(e.target.value)} placeholder="Cerca icona…" style={{ flex: 1, background: 'transparent', border: 'none', color: 'inherit', outline: 'none', fontSize: '0.78rem' }} />
                        </div>
                        {pickingStamp && (
                            <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Selezionato: <span style={{ color: 'var(--accent-gold)' }}>{pickingStamp.name ?? pickingStamp.iconId ?? '—'}</span> – clicca per piazzare.
                            </div>
                        )}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                            {filteredStampIcons.map(i => {
                                const active = pickingStamp && (pickingStamp.iconId === i.iconId && pickingStamp.category === i.category && pickingStamp.name === i.name);
                                return (
                                    <button key={i.key} title={i.label}
                                        onClick={() => setPickingStamp({ category: i.category, name: i.name, iconId: i.iconId, svg: i.svg })}
                                        className="inv-svg-tinted"
                                        style={{
                                            width: '100%', aspectRatio: '1', borderRadius: 4, padding: 4, cursor: 'pointer',
                                            background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${active ? 'var(--accent-gold)' : 'transparent'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(i.svg) }} />
                                );
                            })}
                            {filteredStampIcons.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', padding: 12, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>Nessuna icona.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Inspector — slide-in right */}
                {selectedShape && tool === 'select' && (
                    <ShapeInspector
                        key={selectedShape.id}
                        shape={selectedShape}
                        layers={activeLevel.layers ?? []}
                        mapLevels={activeMap.levels}
                        currentLevelId={activeLevelId}
                        onChange={(patch) => updateShape(selectedShape.id, patch)}
                        onDelete={() => removeShape(selectedShape.id)}
                        onClose={() => setSelectedId(null)}
                        onDuplicate={() => duplicateShape(selectedShape.id)}
                        onBringForward={() => bringForward(selectedShape.id)}
                        onSendBackward={() => sendBackward(selectedShape.id)}
                        onBringToFront={() => bringToFront(selectedShape.id)}
                        onSendToBack={() => sendToBack(selectedShape.id)}
                        onAutoPair={(s) => autoPairStair(s)}
                    />
                )}

                {/* Layers panel — floating right */}
                {showLayers && (
                    <LayersPanel
                        layers={activeLevel.layers ?? []}
                        shapes={activeLevel.shapes ?? []}
                        onChange={setLayers}
                        onClose={() => setShowLayers(false)}
                    />
                )}
            </div>
        </div>
    );
};

/* ════════════════════════════════════════════════════════════════════ */
/*                          SUB-COMPONENTS                              */
/* ════════════════════════════════════════════════════════════════════ */

interface InspectorProps {
    shape: MapShape;
    layers: MapLayer[];
    /** All map levels, for stair-link dropdowns. */
    mapLevels: MapLevel[];
    /** ID of the level currently being edited (excluded from "target" choices). */
    currentLevelId: string;
    onChange: (patch: Partial<MapShape>) => void;
    onDelete: () => void;
    onClose: () => void;
    onDuplicate: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    /** Create a counterpart stair on the linked level and cross-link them. */
    onAutoPair: (shape: MapStairShape) => void;
}
const ShapeInspector: React.FC<InspectorProps> = ({ shape, layers, mapLevels, currentLevelId, onChange, onDelete, onClose, onDuplicate, onBringForward, onSendBackward, onBringToFront, onSendToBack, onAutoPair }) => {
    const [draft, setDraft] = useState<MapShape>(shape);
    useEffect(() => setDraft(shape), [shape.id, shape]);
    const commit = useCallback((p: Partial<MapShape>) => {
        setDraft(d => ({ ...d, ...p } as MapShape));
        onChange(p);
    }, [onChange]);

    const KIND_LABEL: Record<MapShapeKind, string> = {
        rect: 'Rettangolo', ellipse: 'Ellisse', polygon: 'Poligono',
        line: 'Linea', stamp: 'Stamp', text: 'Testo', door: 'Porta', stair: 'Scala / Portale',
    };

    return (
        <div style={{
            position: 'absolute', top: 8, right: 8, width: 240, maxHeight: 'calc(100% - 16px)',
            zIndex: 25, background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: '0.75rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflowY: 'auto',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: 'var(--accent-gold)', letterSpacing: '0.05em' }}>
                    {KIND_LABEL[draft.kind]}
                </span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><FaTimes size={11} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Field label="Nome">
                    <input className="input" value={draft.name ?? ''} onChange={e => commit({ name: e.target.value })} style={{ fontSize: '0.8rem' }} />
                </Field>
                <Field label="Descrizione">
                    <textarea className="input" value={draft.description ?? ''} onChange={e => commit({ description: e.target.value })} placeholder="HP, note, dettagli…" style={{ minHeight: 60, fontSize: '0.76rem', resize: 'vertical' }} />
                </Field>
                <Field label="Layer">
                    <select className="input" value={draft.layerId} onChange={e => commit({ layerId: e.target.value })} style={{ fontSize: '0.78rem' }}>
                        {layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {(draft.kind === 'rect' || draft.kind === 'ellipse' || draft.kind === 'stamp' || draft.kind === 'text' || draft.kind === 'door' || draft.kind === 'stair') && (
                        <>
                            <Field label="X (caselle)"><input className="input" type="number" step={0.25} value={(((draft as any).x ?? 0) / CELL).toFixed(2)} onChange={e => commit({ x: Number(e.target.value) * CELL } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                            <Field label="Y (caselle)"><input className="input" type="number" step={0.25} value={(((draft as any).y ?? 0) / CELL).toFixed(2)} onChange={e => commit({ y: Number(e.target.value) * CELL } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                        </>
                    )}
                    {(draft.kind === 'rect' || draft.kind === 'door' || draft.kind === 'stair') && (
                        <>
                            <Field label="Largh. (caselle)"><input className="input" type="number" step={0.25} min={0.25} value={(draft.w / CELL).toFixed(2)} onChange={e => commit({ w: Math.max(CELL * 0.25, Number(e.target.value) * CELL) } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                            <Field label="Alt. (caselle)"><input className="input" type="number" step={0.25} min={0.25} value={(draft.h / CELL).toFixed(2)} onChange={e => commit({ h: Math.max(CELL * 0.25, Number(e.target.value) * CELL) } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                        </>
                    )}
                    {draft.kind === 'ellipse' && (
                        <>
                            <Field label="Raggio X (cas.)"><input className="input" type="number" step={0.25} min={0.25} value={(draft.rx / CELL).toFixed(2)} onChange={e => commit({ rx: Math.max(CELL * 0.25, Number(e.target.value) * CELL) } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                            <Field label="Raggio Y (cas.)"><input className="input" type="number" step={0.25} min={0.25} value={(draft.ry / CELL).toFixed(2)} onChange={e => commit({ ry: Math.max(CELL * 0.25, Number(e.target.value) * CELL) } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                        </>
                    )}
                    {draft.kind === 'stamp' && (
                        <Field label="Dim. (caselle)"><input className="input" type="number" step={0.25} min={0.25} value={(draft.size / CELL).toFixed(2)} onChange={e => commit({ size: Math.max(CELL * 0.25, Number(e.target.value) * CELL) } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                    )}
                    {draft.kind === 'text' && (
                        <Field label="Font"><input className="input" type="number" value={Math.round(draft.fontSize)} onChange={e => commit({ fontSize: Math.max(8, Number(e.target.value)) } as any)} style={{ fontSize: '0.78rem' }} /></Field>
                    )}
                    <Field label="Rot°"><input className="input" type="number" value={Math.round(draft.rotation ?? 0)} onChange={e => commit({ rotation: Number(e.target.value) })} style={{ fontSize: '0.78rem' }} /></Field>
                    <Field label="Opac."><input className="input" type="number" min={0} max={1} step={0.05} value={draft.opacity ?? 1} onChange={e => commit({ opacity: Math.min(1, Math.max(0, Number(e.target.value))) })} style={{ fontSize: '0.78rem' }} /></Field>
                </div>

                {draft.kind === 'text' && (
                    <Field label="Testo">
                        <input className="input" value={draft.text} onChange={e => commit({ text: e.target.value } as any)} style={{ fontSize: '0.8rem' }} />
                    </Field>
                )}

                {/* ── Stair link configuration ── */}
                {draft.kind === 'stair' && (() => {
                    const otherLevels = mapLevels.filter(l => l.id !== currentLevelId).sort((a, b) => b.floor - a.floor);
                    const targetLevel = mapLevels.find(l => l.id === draft.linkLevelId);
                    const targetStairs = (targetLevel?.shapes ?? []).filter((x): x is MapStairShape => x.kind === 'stair');
                    return (
                        <div style={{
                            marginTop: 4, padding: 8, borderRadius: 5,
                            background: 'rgba(201,168,76,0.06)',
                            border: '1px solid rgba(201,168,76,0.2)',
                            display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                            <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                                ⇅ COLLEGAMENTO TRA PIANI
                            </span>
                            <Field label="Tipo">
                                <select className="input" value={draft.stairKind ?? 'stairs'}
                                    onChange={e => commit({ stairKind: e.target.value as MapStairShape['stairKind'] } as any)}
                                    style={{ fontSize: '0.78rem' }}>
                                    <option value="stairs">Scala</option>
                                    <option value="ladder">Scala a pioli</option>
                                    <option value="trapdoor">Botola</option>
                                    <option value="portal">Portale magico</option>
                                </select>
                            </Field>
                            <Field label="Direzione">
                                <select className="input" value={draft.direction ?? 'up'}
                                    onChange={e => commit({ direction: e.target.value as MapStairShape['direction'] } as any)}
                                    style={{ fontSize: '0.78rem' }}>
                                    <option value="up">▲ Sale</option>
                                    <option value="down">▼ Scende</option>
                                    <option value="both">⇅ Entrambe</option>
                                </select>
                            </Field>
                            <Field label="Piano di destinazione">
                                <select className="input" value={draft.linkLevelId ?? ''}
                                    onChange={e => commit({ linkLevelId: e.target.value || undefined, linkShapeId: undefined } as any)}
                                    style={{ fontSize: '0.78rem' }}>
                                    <option value="">— nessuno —</option>
                                    {otherLevels.map(l => (
                                        <option key={l.id} value={l.id}>
                                            {getLevelShortLabel(l.floor)} · {l.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            {draft.linkLevelId && (
                                <Field label="Punto di arrivo (opzionale)">
                                    <select className="input" value={draft.linkShapeId ?? ''}
                                        onChange={e => commit({ linkShapeId: e.target.value || undefined } as any)}
                                        style={{ fontSize: '0.78rem' }}>
                                        <option value="">centro mappa</option>
                                        {targetStairs.map(t => (
                                            <option key={t.id} value={t.id}>{t.name ?? 'Scala'}</option>
                                        ))}
                                    </select>
                                </Field>
                            )}
                            <button className="btn-secondary"
                                disabled={!draft.linkLevelId}
                                onClick={() => onAutoPair(draft as MapStairShape)}
                                style={{
                                    justifyContent: 'center', fontSize: '0.74rem',
                                    opacity: draft.linkLevelId ? 1 : 0.5,
                                    cursor: draft.linkLevelId ? 'pointer' : 'not-allowed',
                                }}>
                                🔗 Crea scala speculare al piano collegato
                            </button>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                Doppio click sulla scala per teletrasportarti al piano collegato.
                            </span>
                        </div>
                    );
                })()}

                <div style={{ display: 'flex', gap: 6 }}>
                    {(draft.kind !== 'line' && draft.kind !== 'stamp' && draft.kind !== 'text' && draft.kind !== 'door' && draft.kind !== 'stair') && (
                        <Field label="Fill" style={{ flex: 1 }}>
                            <input type="color" value={draft.fill ?? '#e8e0cc'} onChange={e => commit({ fill: e.target.value })}
                                style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                        </Field>
                    )}
                    {draft.kind === 'door' && (
                        <Field label="Mask" style={{ flex: 1 }}>
                            <input type="color" value={draft.maskFill ?? '#e8e0cc'} onChange={e => commit({ maskFill: e.target.value } as any)}
                                style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                        </Field>
                    )}
                    {draft.kind === 'stamp' && (
                        <Field label="Tint" style={{ flex: 1 }}>
                            <input type="color" value={draft.tint ?? '#ffffff'} onChange={e => commit({ tint: e.target.value } as any)}
                                style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                        </Field>
                    )}
                    <Field label="Stroke" style={{ flex: 1 }}>
                        <input type="color" value={draft.stroke ?? '#18120e'} onChange={e => commit({ stroke: e.target.value })}
                            style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                    </Field>
                </div>
                <Field label="Spess. bordo">
                    <input className="input" type="number" min={0} value={draft.strokeWidth ?? 2} onChange={e => commit({ strokeWidth: Math.max(0, Number(e.target.value)) })} style={{ fontSize: '0.78rem' }} />
                </Field>

                {/* Action bar: order / duplicate / delete */}
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {[
                        { label: '⤓', title: 'Manda dietro (Shift+[)', onClick: onSendToBack },
                        { label: '↓', title: 'Indietro di uno ([)', onClick: onSendBackward },
                        { label: '↑', title: 'Avanti di uno (])', onClick: onBringForward },
                        { label: '⤒', title: 'Porta davanti (Shift+])', onClick: onBringToFront },
                    ].map(b => (
                        <button key={b.label} title={b.title} onClick={b.onClick} style={{
                            flex: 1, height: 26, background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(201,168,76,0.2)', borderRadius: 3,
                            color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1,
                        }}>{b.label}</button>
                    ))}
                </div>
                <button className="btn-secondary" style={{ justifyContent: 'center', fontSize: '0.78rem', marginTop: 4 }}
                    onClick={onDuplicate}>
                    <FaPlus size={9} /> Duplica (Ctrl+D)
                </button>

                <button className="btn-secondary" style={{ justifyContent: 'center', color: 'var(--accent-crimson)', borderColor: 'rgba(192,57,43,0.3)', fontSize: '0.78rem', marginTop: 4 }}
                    onClick={onDelete}>
                    <FaTrash size={10} /> Elimina elemento
                </button>
            </div>
        </div>
    );
};

const Field: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, ...style }}>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        {children}
    </label>
);

/* ════════════════════════════════════════════════════════════════════ */
/*              FLOOR STACK (elevator-style level navigator)            */
/* ════════════════════════════════════════════════════════════════════ */
/**
 * Vertical "building" visualizer pinned to the left edge of the canvas.
 * Each level is a stacked slab; the active slab is taller, gold-highlighted
 * and shows its full label. Above and below the stack, a "+" lets you add
 * new floors. Hotkeys: PageUp / PageDown.
 */
interface FloorStackProps {
    levels: MapLevel[]; // already sorted with highest floor first
    activeLevelId: string;
    canDelete: boolean;
    editingId: string | null;
    editingVal: string;
    onSwitch: (id: string) => void;
    onAddAbove: () => void;
    onAddBelow: () => void;
    onDelete: (id: string) => void;
    onStartRename: (id: string, label: string) => void;
    onChangeRename: (val: string) => void;
    onCommitRename: (id: string) => void;
    onCancelRename: () => void;
}
const FloorStack: React.FC<FloorStackProps> = ({
    levels, activeLevelId, canDelete, editingId, editingVal,
    onSwitch, onAddAbove, onAddBelow, onDelete,
    onStartRename, onChangeRename, onCommitRename, onCancelRename,
}) => {
    const ROW_H = 32;     // every floor is the SAME height
    const PANEL_W = 168;  // fixed panel width
    const activeIdx = levels.findIndex(l => l.id === activeLevelId);

    return (
        <div style={{
            position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0,
            zIndex: 22, pointerEvents: 'auto', width: PANEL_W,
            background: 'linear-gradient(180deg, rgba(20,16,12,0.92) 0%, rgba(15,12,9,0.96) 100%)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
            overflow: 'hidden',
        }}>
            {/* ── Header strip with title + add-above ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px 6px 10px',
                borderBottom: '1px solid rgba(201,168,76,0.18)',
                background: 'rgba(0,0,0,0.35)',
            }}>
                <span style={{
                    fontSize: '0.6rem', letterSpacing: '0.18em', fontWeight: 700,
                    color: '#c9a84c', fontFamily: 'var(--font-heading)',
                }}>PIANI</span>
                <button onClick={onAddAbove} title="Aggiungi piano sopra" style={floorIconBtn}>
                    <FaPlus size={9} />
                </button>
            </div>

            {/* ── Stack body with elevator rail on the left ── */}
            <div style={{ position: 'relative', display: 'flex' }}>
                {/* Rail */}
                <div style={{
                    position: 'relative', width: 14, flexShrink: 0,
                    background: 'rgba(0,0,0,0.3)',
                    borderRight: '1px solid rgba(201,168,76,0.12)',
                }}>
                    {/* Elevator car indicator */}
                    {activeIdx >= 0 && (
                        <div style={{
                            position: 'absolute',
                            top: activeIdx * ROW_H + ROW_H / 2 - 8,
                            left: 2, width: 10, height: 16,
                            background: 'linear-gradient(180deg, #f5d97a 0%, #c9a84c 100%)',
                            borderRadius: 2,
                            boxShadow: '0 0 8px rgba(201,168,76,0.6)',
                            transition: 'top 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} />
                    )}
                </div>

                {/* Floors list */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    maxHeight: ROW_H * 8, overflowY: 'auto',
                }}>
                    {levels.map(lv => {
                        const active = lv.id === activeLevelId;
                        const isEditing = editingId === lv.id;
                        return (
                            <div key={lv.id}
                                onClick={() => !isEditing && onSwitch(lv.id)}
                                onDoubleClick={() => onStartRename(lv.id, lv.label)}
                                title={`${getLevelFullLabel(lv.floor)} · ${lv.label} (doppio click per rinominare)`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '0 8px', height: ROW_H, flexShrink: 0,
                                    background: active ? 'rgba(201,168,76,0.14)' : 'transparent',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    cursor: 'pointer', transition: 'background 0.15s',
                                    position: 'relative',
                                }}
                                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                                <span style={{
                                    fontSize: '0.62rem', fontFamily: 'var(--font-heading)',
                                    letterSpacing: '0.06em', fontWeight: 700,
                                    color: active ? '#f5d97a' : 'rgba(255,255,255,0.55)',
                                    minWidth: 22, textAlign: 'center', flexShrink: 0,
                                }}>
                                    {getLevelShortLabel(lv.floor)}
                                </span>
                                {isEditing ? (
                                    <form onSubmit={e => { e.preventDefault(); onCommitRename(lv.id); }}
                                        onClick={e => e.stopPropagation()} style={{ flex: 1 }}>
                                        <input autoFocus value={editingVal}
                                            onChange={e => onChangeRename(e.target.value)}
                                            onBlur={() => onCommitRename(lv.id)}
                                            onKeyDown={e => e.key === 'Escape' && onCancelRename()}
                                            style={{
                                                width: '100%', background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid var(--accent-gold)', borderRadius: 3,
                                                padding: '2px 5px', color: '#fff', fontSize: '0.72rem',
                                                outline: 'none',
                                            }} />
                                    </form>
                                ) : (
                                    <>
                                        <span style={{
                                            flex: 1, fontSize: '0.72rem',
                                            color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                                            fontWeight: active ? 600 : 400,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {lv.label}
                                        </span>
                                        {active && canDelete && (
                                            <button title="Elimina piano"
                                                onClick={e => { e.stopPropagation(); onDelete(lv.id); }}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: '#e74c3c', padding: 2, opacity: 0.7,
                                                    display: 'flex', alignItems: 'center', lineHeight: 1,
                                                }}><FaTimes size={9} /></button>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Footer strip with add-below + hotkey hint ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px 5px 10px',
                borderTop: '1px solid rgba(201,168,76,0.18)',
                background: 'rgba(0,0,0,0.35)',
            }}>
                <span style={{
                    fontSize: '0.55rem', letterSpacing: '0.12em',
                    color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-heading)',
                }}>PgUp · PgDn</span>
                <button onClick={onAddBelow} title="Aggiungi piano sotto (interrato)" style={floorIconBtn}>
                    <FaPlus size={9} />
                </button>
            </div>
        </div>
    );
};
const floorIconBtn: React.CSSProperties = {
    width: 20, height: 20, borderRadius: 3, padding: 0,
    background: 'rgba(201,168,76,0.15)', color: '#f5d97a',
    border: '1px solid rgba(201,168,76,0.4)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
};

interface LayersPanelProps {
    layers: MapLayer[];
    shapes: MapShape[];
    onChange: (layers: MapLayer[]) => void;
    onClose: () => void;
}
const LayersPanel: React.FC<LayersPanelProps> = ({ layers, shapes, onChange, onClose }) => {
    const counts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const s of shapes) c[s.layerId] = (c[s.layerId] ?? 0) + 1;
        return c;
    }, [shapes]);

    const toggleVis = (id: string) => onChange(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    const toggleLock = (id: string) => onChange(layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l));
    const rename = (id: string, name: string) => onChange(layers.map(l => l.id === id ? { ...l, name } : l));
    const move = (id: string, dir: -1 | 1) => {
        const idx = layers.findIndex(l => l.id === id);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= layers.length) return;
        const next = [...layers];
        [next[idx], next[target]] = [next[target], next[idx]];
        onChange(next);
    };
    const addNew = (kind: MapLayerKind) => {
        const sameKind = layers.filter(l => l.kind === kind).length;
        onChange([...layers, makeLayer(kind, sameKind)]);
    };
    const remove = (id: string) => {
        if (layers.length <= 1) return;
        if (!confirm('Eliminare questo layer? Gli elementi orfani non verranno disegnati finché non vengono spostati su un altro layer.')) return;
        onChange(layers.filter(l => l.id !== id));
    };

    return (
        <div style={{
            position: 'absolute', top: 12, right: 12, width: 240, maxHeight: 'calc(100% - 80px)',
            background: 'rgba(20, 16, 13, 0.94)', backdropFilter: 'blur(14px)',
            border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8,
            display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 25,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        }}>
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.72rem', color: 'var(--accent-gold)', letterSpacing: '0.1em', flex: 1 }}>LAYER</span>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><FaTimes size={11} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
                {[...layers].slice().reverse().map(l => (
                    <div key={l.id} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 6px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.03)', marginBottom: 3, fontSize: '0.74rem',
                    }}>
                        <button onClick={() => toggleVis(l.id)} title={l.visible ? 'Nascondi' : 'Mostra'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: l.visible ? 'var(--accent-gold)' : 'var(--text-muted)', padding: 2 }}>
                            {l.visible ? <FaEye size={10} /> : <FaEyeSlash size={10} />}
                        </button>
                        <button onClick={() => toggleLock(l.id)} title={l.locked ? 'Sblocca' : 'Blocca'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: l.locked ? 'var(--accent-crimson)' : 'var(--text-muted)', padding: 2 }}>
                            {l.locked ? <FaLock size={10} /> : <FaLockOpen size={10} />}
                        </button>
                        <input value={l.name} onChange={e => rename(l.id, e.target.value)}
                            style={{ flex: 1, background: 'transparent', border: '1px solid transparent', color: 'inherit', outline: 'none', fontSize: '0.74rem', padding: '2px 4px', borderRadius: 3 }}
                            onFocus={e => (e.target as HTMLInputElement).style.border = '1px solid rgba(201,168,76,0.3)'}
                            onBlur={e => (e.target as HTMLInputElement).style.border = '1px solid transparent'} />
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{counts[l.id] ?? 0}</span>
                        <button onClick={() => move(l.id, +1)} title="Su" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><FaArrowUp size={9} /></button>
                        <button onClick={() => move(l.id, -1)} title="Giù" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><FaArrowDown size={9} /></button>
                        {layers.length > 1 && (
                            <button onClick={() => remove(l.id)} title="Elimina" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', opacity: 0.7, padding: 2 }}><FaTrash size={9} /></button>
                        )}
                    </div>
                ))}
            </div>
            <div style={{ padding: 6, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {LAYER_DEFAULTS.map(d => (
                    <button key={d.kind} onClick={() => addNew(d.kind)} className="btn-secondary" style={{ fontSize: '0.68rem', padding: '4px 6px', justifyContent: 'center' }}>
                        <FaPlus size={9} /> {d.name}
                    </button>
                ))}
            </div>
        </div>
    );
};
