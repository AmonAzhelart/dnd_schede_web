import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Group } from 'react-konva';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaTimes, FaDownload, FaTrash, FaPlus, FaPencilAlt, FaCheck, FaMap } from 'react-icons/fa';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import type { MapToken, MapLevel, DungeonMap } from '../types/dnd';

const CELL = 40;
const COLS = 60;
const ROWS = 40;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

type Tool = 'room' | 'erase' | 'monster' | 'npc' | 'trap' | 'treasure' | 'door' | 'stairs' | 'info' | 'select';

const TOKEN_ICONS: Record<string, string> = {
  monster: '☠', npc: '🧙', trap: '⚠', treasure: '💰', door: '🚪', stairs: '🪜', info: 'ℹ',
};
const TOKEN_COLORS: Record<string, string> = {
  monster: '#c0392b', npc: '#27ae60', trap: '#e67e22', treasure: '#f1c40f',
  door: '#95a5a6', stairs: '#3498db', info: '#9b59b6',
};

const getLevelShortLabel = (floor: number) => {
  if (floor === 0) return 'PT';
  if (floor > 0) return `P${floor}`;
  return `B${Math.abs(floor)}`;
};
const getLevelFullLabel = (floor: number) => {
  if (floor === 0) return 'Piano Terra';
  if (floor > 0) return `Piano ${floor}`;
  return `Interrato ${Math.abs(floor)}`;
};
const floorTint = (floor: number): string => {
  if (floor === 0) return '#e8e0cc';
  if (floor > 0) return `hsl(40, 28%, ${Math.max(70, 86 - floor * 3)}%)`;
  return `hsl(220, 14%, ${Math.max(45, 72 + floor * 4)}%)`;
};
const createLevel = (floor: number): MapLevel => ({
  id: uuidv4(), floor, label: getLevelFullLabel(floor), tiles: {}, tokens: [],
});
const createMap = (name: string): DungeonMap => {
  const ground = createLevel(0);
  return { id: uuidv4(), name, createdAt: new Date().toISOString(), levels: [ground], activeLevelId: ground.id };
};

const toolBtnBase: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 6, fontSize: '1.05rem',
  border: '1px solid transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s', flexShrink: 0,
};
const levelBtnStyle: React.CSSProperties = {
  height: 28, padding: '0 10px', borderRadius: '4px 4px 0 0',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap',
};

export const MapBoard: React.FC = () => {
  const { character, setCharacter } = useCharacterStore();
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  const [tool, setTool] = useState<Tool>('room');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingLevelVal, setEditingLevelVal] = useState('');

  const isDrawing = useRef(false);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ w: Math.max(400, rect.width), h: Math.max(300, rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (character && (!character.maps || character.maps.length === 0)) {
      const first = createMap('Mappa 1');
      setCharacter({ ...character, maps: [first], activeMapId: first.id });
    }
  }, [character?.id]);

  if (!character || !character.maps || character.maps.length === 0) return null;

  const maps = character.maps;
  const activeMapId = character.activeMapId || maps[0].id;
  const activeMap = maps.find(m => m.id === activeMapId) ?? maps[0];
  const activeLevelId = activeMap.activeLevelId;
  const activeLevel = activeMap.levels.find(l => l.id === activeLevelId) ?? activeMap.levels[0];
  const sortedLevels = [...activeMap.levels].sort((a, b) => b.floor - a.floor);

  const updateMaps = (newMaps: DungeonMap[]) => setCharacter({ ...character, maps: newMaps });
  const updateActiveMap = (map: DungeonMap) => updateMaps(maps.map(m => m.id === activeMapId ? map : m));
  const updateActiveLevel = (level: MapLevel) =>
    updateActiveMap({ ...activeMap, levels: activeMap.levels.map(l => l.id === activeLevelId ? level : l) });
  const setTiles = (tiles: typeof activeLevel.tiles) => updateActiveLevel({ ...activeLevel, tiles });
  const setTokens = (tokens: MapToken[]) => updateActiveLevel({ ...activeLevel, tokens });

  const newMap = () => {
    const name = `Mappa ${maps.length + 1}`;
    const m = createMap(name);
    setCharacter({ ...character, maps: [...maps, m], activeMapId: m.id });
    setEditingMapId(m.id); setEditingNameVal(name);
  };
  const selectMap = (id: string) => { setCharacter({ ...character, activeMapId: id }); setSelectedId(null); };
  const commitRenameMap = (id: string) => {
    const val = editingNameVal.trim();
    if (val) updateMaps(maps.map(m => m.id === id ? { ...m, name: val } : m));
    setEditingMapId(null);
  };
  const deleteMap = (id: string) => {
    if (maps.length <= 1) return;
    if (!confirm('Eliminare questa mappa e tutti i suoi livelli?')) return;
    const remaining = maps.filter(m => m.id !== id);
    const newActiveId = id === activeMapId ? remaining[0].id : activeMapId;
    setCharacter({ ...character, maps: remaining, activeMapId: newActiveId });
  };

  const switchLevel = (id: string) => { updateActiveMap({ ...activeMap, activeLevelId: id }); setSelectedId(null); };
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
    const newActiveId = id === activeLevelId ? remaining[0].id : activeLevelId;
    updateActiveMap({ ...activeMap, levels: remaining, activeLevelId: newActiveId });
    setSelectedId(null);
  };
  const commitRenameLevel = (id: string) => {
    const val = editingLevelVal.trim();
    if (val) updateActiveMap({ ...activeMap, levels: activeMap.levels.map(l => l.id === id ? { ...l, label: val } : l) });
    setEditingLevelId(null);
  };

  const coordsFromStage = (e: any) => {
    const pp = e.target.getStage().getPointerPosition();
    return {
      x: Math.floor((pp.x - stagePos.x) / (CELL * stageScale)),
      y: Math.floor((pp.y - stagePos.y) / (CELL * stageScale)),
    };
  };
  const paintTile = (e: any, erase: boolean) => {
    const { x, y } = coordsFromStage(e);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const key = `${x},${y}`;
    const t = { ...activeLevel.tiles };
    if (erase) delete t[key]; else t[key] = { x, y, isFloor: true };
    setTiles(t);
  };
  const placeToken = (e: any) => {
    const { x, y } = coordsFromStage(e);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const tok: MapToken = {
      id: uuidv4(), x: x * CELL + CELL / 2, y: y * CELL + CELL / 2,
      type: tool, name: (TOKEN_ICONS[tool] ?? '?') + ' ' + tool.charAt(0).toUpperCase() + tool.slice(1),
      description: '', color: TOKEN_COLORS[tool] ?? '#888',
    };
    setTokens([...activeLevel.tokens, tok]);
    setSelectedId(tok.id); setTool('select');
  };

  const handleMouseDown = (e: any) => {
    if (e.evt.button === 1 || e.evt.button === 2) {
      setIsPanning(true);
      const pp = stageRef.current.getPointerPosition();
      setPanStart({ x: pp.x - stagePos.x, y: pp.y - stagePos.y });
      return;
    }
    if (e.target === e.target.getStage()) setSelectedId(null);
    if (tool === 'room' || tool === 'erase') {
      isDrawing.current = true;
      paintTile(e, tool === 'erase');
    } else if (tool !== 'select' && e.target === e.target.getStage()) {
      placeToken(e);
    }
  };
  const handleMouseMove = (e: any) => {
    if (isPanning) {
      const pp = stageRef.current.getPointerPosition();
      setStagePos({ x: pp.x - panStart.x, y: pp.y - panStart.y });
      return;
    }
    if (isDrawing.current) paintTile(e, tool === 'erase');
  };
  const handleMouseUp = () => { isDrawing.current = false; setIsPanning(false); };
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const by = 1.1;
    const old = stageScale;
    const ptr = stageRef.current.getPointerPosition();
    const next = Math.min(4, Math.max(0.15, e.evt.deltaY < 0 ? old * by : old / by));
    const mpt = { x: (ptr.x - stagePos.x) / old, y: (ptr.y - stagePos.y) / old };
    setStagePos({ x: ptr.x - mpt.x * next, y: ptr.y - mpt.y * next });
    setStageScale(next);
  };
  const handleTokenDragEnd = (e: any, id: string) => {
    setTokens(activeLevel.tokens.map(t => t.id === id ? { ...t, x: e.target.x(), y: e.target.y() } : t));
  };

  const renderGrid = () => {
    const els: React.ReactNode[] = [];
    for (let i = 0; i <= COLS; i++)
      els.push(<Line key={`v${i}`} points={[i*CELL, 0, i*CELL, CANVAS_H]} stroke="rgba(255,255,255,0.03)" strokeWidth={1} listening={false} />);
    for (let j = 0; j <= ROWS; j++)
      els.push(<Line key={`h${j}`} points={[0, j*CELL, CANVAS_W, j*CELL]} stroke="rgba(255,255,255,0.03)" strokeWidth={1} listening={false} />);
    return els;
  };
  const renderFloor = () =>
    Object.values(activeLevel.tiles).map(tile =>
      <Rect key={`f_${tile.x}_${tile.y}`} x={tile.x * CELL} y={tile.y * CELL} width={CELL} height={CELL} fill={floorTint(activeLevel.floor)} listening={false} />
    );
  const renderWalls = () => {
    const walls: React.ReactNode[] = [];
    const W = 5; const C = '#18120e';
    Object.values(activeLevel.tiles).forEach(({ x, y }) => {
      const t = activeLevel.tiles;
      if (!t[`${x},${y-1}`]) walls.push(<Line key={`wt_${x}_${y}`} points={[x*CELL, y*CELL, (x+1)*CELL, y*CELL]} stroke={C} strokeWidth={W} listening={false} />);
      if (!t[`${x},${y+1}`]) walls.push(<Line key={`wb_${x}_${y}`} points={[x*CELL, (y+1)*CELL, (x+1)*CELL, (y+1)*CELL]} stroke={C} strokeWidth={W} listening={false} />);
      if (!t[`${x-1},${y}`]) walls.push(<Line key={`wl_${x}_${y}`} points={[x*CELL, y*CELL, x*CELL, (y+1)*CELL]} stroke={C} strokeWidth={W} listening={false} />);
      if (!t[`${x+1},${y}`]) walls.push(<Line key={`wr_${x}_${y}`} points={[(x+1)*CELL, y*CELL, (x+1)*CELL, (y+1)*CELL]} stroke={C} strokeWidth={W} listening={false} />);
    });
    return walls;
  };
  const renderTokens = () =>
    activeLevel.tokens.map(token => {
      const sel = token.id === selectedId;
      const r = CELL * 0.37;
      return (
        <Group key={token.id} x={token.x} y={token.y} draggable
          onClick={() => { setSelectedId(token.id); setTool('select'); }}
          onDragEnd={e => handleTokenDragEnd(e, token.id)}
        >
          <Circle radius={r} fill={token.color}
            stroke={sel ? '#fff' : 'rgba(0,0,0,0.55)'} strokeWidth={sel ? 2.5 : 1.5}
            shadowColor={token.color} shadowBlur={sel ? 16 : 5} shadowOpacity={0.75}
          />
          <KonvaText text={TOKEN_ICONS[token.type] ?? '?'} fontSize={15} offsetX={7.5} offsetY={8} listening={false} />
        </Group>
      );
    });

  const selectedToken = activeLevel.tokens.find(t => t.id === selectedId);
  const updateToken = (field: keyof MapToken, val: string) => {
    if (!selectedId) return;
    setTokens(activeLevel.tokens.map(t => t.id === selectedId ? { ...t, [field]: val } : t));
  };

  const exportPNG = () => {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = uri; a.download = `${activeMap.name} - ${activeLevel.label}.png`; a.click();
  };
  const clearLevel = () => {
    if (confirm(`Cancellare tutti i dati di "${activeLevel.label}"?`))
      updateActiveLevel({ ...activeLevel, tiles: {}, tokens: [] });
  };

  const toolGroups: { id?: Tool; icon: string; label: string }[][] = [
    [
      { id: 'room',  icon: '▪', label: 'Stanza' },
      { id: 'erase', icon: '✕', label: 'Gomma' },
    ],
    [
      { id: 'monster',  icon: '☠', label: 'Mostro' },
      { id: 'npc',      icon: '🧙', label: 'NPC' },
      { id: 'trap',     icon: '⚠', label: 'Trappola' },
      { id: 'treasure', icon: '💰', label: 'Tesoro' },
      { id: 'info',     icon: 'ℹ', label: 'Info' },
    ],
    [
      { id: 'door',   icon: '🚪', label: 'Porta' },
      { id: 'stairs', icon: '🪜', label: 'Scale' },
    ],
  ];

  return (
    <div style={{ display: 'flex', height: '100%', userSelect: 'none', gap: 0, overflow: 'hidden' }}>

      {/* MAP LIST */}
      <div style={{
        width: 176, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)', borderRight: '1px solid rgba(201,168,76,0.1)',
        borderRadius: '8px 0 0 8px',
      }}>
        <div style={{ padding: '10px 12px 9px', borderBottom: '1px solid rgba(201,168,76,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.72rem', color: 'var(--accent-gold)', letterSpacing: '0.1em' }}>MAPPE</span>
          <button onClick={newMap} title="Nuova mappa" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', padding: 3, lineHeight: 1 }}>
            <FaPlus size={11} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {maps.map(m => (
            <div key={m.id} onClick={() => selectMap(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                cursor: 'pointer',
                background: m.id === activeMapId ? 'rgba(201,168,76,0.08)' : 'transparent',
                borderLeft: `2px solid ${m.id === activeMapId ? 'var(--accent-gold)' : 'transparent'}`,
                transition: 'all 0.12s',
              }}
            >
              {editingMapId === m.id ? (
                <form onSubmit={e => { e.preventDefault(); commitRenameMap(m.id); }} style={{ flex: 1, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <input autoFocus value={editingNameVal} onChange={e => setEditingNameVal(e.target.value)}
                    onBlur={() => commitRenameMap(m.id)}
                    onKeyDown={e => e.key === 'Escape' && setEditingMapId(null)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--accent-gold)', borderRadius: 3, padding: '2px 5px', color: 'var(--text-primary)', fontSize: '0.78rem', outline: 'none' }}
                  />
                  <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', padding: 0 }}><FaCheck size={10} /></button>
                </form>
              ) : (
                <>
                  <FaMap size={10} style={{ color: m.id === activeMapId ? 'var(--accent-gold)' : 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.79rem', color: m.id === activeMapId ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </span>
                  {m.id === activeMapId && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button title="Rinomina" onClick={e => { e.stopPropagation(); setEditingMapId(m.id); setEditingNameVal(m.name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                        <FaPencilAlt size={9} />
                      </button>
                      {maps.length > 1 && (
                        <button title="Elimina mappa" onClick={e => { e.stopPropagation(); deleteMap(m.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 2, opacity: 0.7 }}>
                          <FaTrash size={9} />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '7px 12px', borderTop: '1px solid rgba(201,168,76,0.08)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {activeMap.levels.length} livell{activeMap.levels.length === 1 ? 'o' : 'i'} · {Object.keys(activeLevel.tiles).length} celle
        </div>
      </div>

      {/* RIGHT: TOOLBAR + CANVAS + LEVELBAR */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* TOOLBAR */}
          <div style={{
            width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'var(--bg-surface)', borderRight: '1px solid rgba(201,168,76,0.07)',
            padding: '10px 5px 8px', gap: 3, overflowY: 'auto',
          }}>
            {toolGroups.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />}
                {group.map(t => (
                  <button key={t.id} title={t.label} onClick={() => t.id && setTool(t.id)}
                    style={{
                      ...toolBtnBase,
                      background: tool === t.id ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${tool === t.id ? 'rgba(201,168,76,0.5)' : 'transparent'}`,
                      color: tool === t.id ? 'var(--accent-gold)' : 'var(--text-muted)',
                      fontSize: t.id === 'room' ? '1.25rem' : t.id === 'erase' ? '0.8rem' : '1rem',
                    }}
                  >
                    {t.icon}
                  </button>
                ))}
              </React.Fragment>
            ))}
            <div style={{ flex: 1 }} />
            <button title="Esporta PNG" onClick={exportPNG}
              style={{ ...toolBtnBase, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
              <FaDownload size={12} />
            </button>
            <button title="Cancella livello" onClick={clearLevel}
              style={{ ...toolBtnBase, background: 'rgba(255,255,255,0.04)', color: 'var(--accent-crimson)', opacity: 0.75 }}>
              <FaTrash size={12} />
            </button>
          </div>

          {/* CANVAS */}
          <div ref={containerRef} style={{
            flex: 1, position: 'relative', background: '#09090b', overflow: 'hidden',
            cursor: tool === 'room' || tool === 'erase' ? 'crosshair' : 'default',
          }}>
            <Stage ref={stageRef}
              width={canvasSize.w - 48}
              height={canvasSize.h}
              scaleX={stageScale} scaleY={stageScale}
              x={stagePos.x} y={stagePos.y}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onContextMenu={e => e.evt.preventDefault()}
            >
              <Layer>
                {renderGrid()}
                {renderFloor()}
                {renderWalls()}
                {renderTokens()}
              </Layer>
            </Stage>

            <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none', letterSpacing: '0.04em' }}>
              {Math.round(stageScale * 100)}%
            </div>

            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 5, padding: '3px 10px', fontSize: '0.75rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', letterSpacing: '0.06em', pointerEvents: 'none' }}>
              {getLevelShortLabel(activeLevel.floor)} · {activeLevel.label}
            </div>

            {selectedToken && (
              <div style={{
                position: 'absolute', top: 8, right: 8, width: 216, zIndex: 20,
                background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '0.9rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', color: selectedToken.color }}>
                    {TOKEN_ICONS[selectedToken.type] ?? '?'} {selectedToken.type.charAt(0).toUpperCase() + selectedToken.type.slice(1)}
                  </span>
                  <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 1 }}>
                    <FaTimes size={11} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input className="input" value={selectedToken.name} onChange={e => updateToken('name', e.target.value)} style={{ fontSize: '0.82rem' }} />
                  <textarea className="input" value={selectedToken.description} onChange={e => updateToken('description', e.target.value)}
                    placeholder="HP, note, descrizione..." style={{ minHeight: 72, fontSize: '0.78rem', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="color" value={selectedToken.color} onChange={e => updateToken('color', e.target.value)}
                      title="Colore token" style={{ width: 32, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                    <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', color: 'var(--accent-crimson)', borderColor: 'rgba(192,57,43,0.3)', fontSize: '0.78rem' }}
                      onClick={() => { setTokens(activeLevel.tokens.filter(t => t.id !== selectedId)); setSelectedId(null); }}>
                      <FaTrash size={10} /> Elimina
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LEVEL BAR */}
        <div style={{
          height: 44, display: 'flex', alignItems: 'flex-end', gap: 3,
          background: 'var(--bg-surface)', borderTop: '1px solid rgba(201,168,76,0.1)',
          padding: '0 10px 0', overflowX: 'auto', flexShrink: 0,
        }}>
          <button onClick={addLevelAbove} title="Aggiungi piano superiore" style={{ ...levelBtnStyle, borderRadius: 4, marginBottom: 8 }}>
            <FiChevronUp size={11} /> Piano
          </button>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.07)', alignSelf: 'center', flexShrink: 0 }} />
          {sortedLevels.map(level => {
            const isActive = level.id === activeLevelId;
            return (
              <div key={level.id} style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
                {editingLevelId === level.id ? (
                  <form onSubmit={e => { e.preventDefault(); commitRenameLevel(level.id); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <input autoFocus value={editingLevelVal} onChange={e => setEditingLevelVal(e.target.value)}
                      onBlur={() => commitRenameLevel(level.id)}
                      onKeyDown={e => e.key === 'Escape' && setEditingLevelId(null)}
                      style={{ width: 90, background: 'rgba(255,255,255,0.08)', border: '1px solid var(--accent-gold)', borderRadius: 3, padding: '2px 5px', color: 'var(--text-primary)', fontSize: '0.75rem', outline: 'none' }}
                    />
                    <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', padding: 0 }}><FaCheck size={10} /></button>
                  </form>
                ) : (
                  <button onClick={() => switchLevel(level.id)}
                    onDoubleClick={() => { setEditingLevelId(level.id); setEditingLevelVal(level.label); }}
                    title={`${getLevelFullLabel(level.floor)} — doppio click per rinominare`}
                    style={{
                      height: isActive ? 34 : 28, padding: '0 12px',
                      borderRadius: '4px 4px 0 0',
                      background: isActive ? 'rgba(201,168,76,0.14)' : 'rgba(255,255,255,0.03)',
                      border: isActive ? '1px solid rgba(201,168,76,0.45)' : '1px solid rgba(255,255,255,0.07)',
                      borderBottom: isActive ? '1px solid var(--bg-surface)' : '1px solid rgba(255,255,255,0.07)',
                      color: isActive ? 'var(--accent-gold)' : 'var(--text-muted)',
                      fontSize: '0.73rem', fontFamily: isActive ? 'var(--font-heading)' : 'var(--font-body)',
                      letterSpacing: isActive ? '0.04em' : '0',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <span style={{ fontSize: '0.6rem', opacity: 0.65, fontFamily: 'var(--font-heading)' }}>{getLevelShortLabel(level.floor)}</span>
                    {level.label}
                    {isActive && activeMap.levels.length > 1 && (
                      <span onClick={e => { e.stopPropagation(); deleteLevel(level.id); }}
                        title="Elimina livello"
                        style={{ marginLeft: 2, opacity: 0.45, fontSize: '0.65rem', color: 'var(--accent-crimson)', cursor: 'pointer', lineHeight: 1 }}>✕</span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.07)', alignSelf: 'center', flexShrink: 0 }} />
          <button onClick={addLevelBelow} title="Aggiungi piano interrato" style={{ ...levelBtnStyle, borderRadius: 4, marginBottom: 8 }}>
            <FiChevronDown size={11} /> Interrato
          </button>
          <div style={{ marginLeft: 'auto', fontSize: '0.67rem', color: 'rgba(255,255,255,0.18)', whiteSpace: 'nowrap', alignSelf: 'center', paddingRight: 4 }}>
            🖱 Rotella=Zoom · Tasto Medio=Pan · 2x click tab=Rinomina
          </div>
        </div>
      </div>
    </div>
  );
};
