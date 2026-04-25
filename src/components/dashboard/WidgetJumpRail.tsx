/* ============================================================================
 * WidgetJumpRail ─ press-and-hold jump menu, with NO own trigger.
 *
 * Behaviour is unchanged from the previous version (drag-select rail with
 * auto-scroll near the edges, sticky-mode on tap, smooth-scroll + flash
 * on release). What changed is the trigger: instead of rendering its own
 * button, the rail attaches its pointer listeners to an arbitrary DOM
 * element registered through `widgetJumpBridge.setWidgetJumpTrigger`.
 *
 * Mount this component once near the app root. OverviewDashboard publishes
 * the widget list via `setWidgetJumpData`; CharacterSheet registers the
 * mobile "Panoramica" sheet tab as the trigger via a callback ref.
 * ========================================================================== */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getWidgetDef } from './widgets';
import { useWidgetJumpState } from './widgetJumpBridge';
import './WidgetJump.css';

const HOLD_MS = 220;
const AUTO_SCROLL_ZONE = 38;
const AUTO_SCROLL_MAX = 14;
const TAP_MOVE_TOLERANCE = 8;

type RailRect = { left: number; top: number; width: number; height: number };

export const WidgetJumpRail: React.FC = () => {
    const { triggerEl, widgets, editMode } = useWidgetJumpState();

    const railRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);
    const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
    const holdTimerRef = useRef<number | null>(null);
    const autoScrollRafRef = useRef<number | null>(null);
    const autoScrollSpeedRef = useRef<number>(0);
    const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
    const downPointRef = useRef<{ x: number; y: number } | null>(null);
    const draggingRef = useRef<boolean>(false);
    const activePointerIdRef = useRef<number | null>(null);
    const suppressNextClickRef = useRef<boolean>(false);
    /** Mirror of `hoveredUid` so the pointerup handler (which lives in a
     *  useEffect with stable deps) can read the live value. */
    const hoveredUidRef = useRef<string | null>(null);

    const [open, setOpen] = useState(false);
    const [hoveredUid, setHoveredUid] = useState<string | null>(null);
    const [railRect, setRailRect] = useState<RailRect | null>(null);

    const ordered = useMemo(() => {
        return [...widgets]
            .filter(w => !!getWidgetDef(w.type))
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    }, [widgets]);

    /* ── Rail placement (anchored above the trigger, hugged to the right) ── */
    const placeRail = (): void => {
        const btn = triggerEl;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const wantedH = ordered.length * 30 + 78;
        const maxH = Math.min(window.innerHeight - 32, Math.max(180, wantedH));
        const width = Math.min(260, window.innerWidth - 16);
        const top = Math.max(12, r.top - maxH - 12);
        // Anchor the rail's right edge to the viewport's right margin so the
        // popup sits as far right as possible (the trigger lives at the
        // bottom-right corner already).
        const RIGHT_MARGIN = 6;
        const left = Math.max(8, window.innerWidth - width - RIGHT_MARGIN);
        setRailRect({ left, top, width, height: maxH });
    };

    /* ── Hit-test rail rows ───────────────────────────────────────── */
    const findRowAt = (clientX: number, clientY: number): string | null => {
        const list = listRef.current;
        if (!list) return null;
        const lr = list.getBoundingClientRect();
        if (clientX < lr.left - 32 || clientX > lr.right + 32) return null;
        if (clientY < lr.top - 4 || clientY > lr.bottom + 4) return null;
        for (const el of itemsRef.current) {
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (clientY >= r.top && clientY <= r.bottom) {
                return el.dataset.uid ?? null;
            }
        }
        return null;
    };

    /* ── Auto-scroll while dragging near rail edges ───────────────── */
    const tickAutoScroll = (): void => {
        const list = listRef.current;
        const speed = autoScrollSpeedRef.current;
        const last = lastPointerRef.current;
        if (!list || speed === 0) {
            autoScrollRafRef.current = null;
            return;
        }
        list.scrollTop += speed;
        if (last) {
            const uid = findRowAt(last.x, last.y);
            hoveredUidRef.current = uid;
            setHoveredUid(uid);
        }
        autoScrollRafRef.current = window.requestAnimationFrame(tickAutoScroll);
    };

    const updateAutoScroll = (clientY: number): void => {
        const rail = railRef.current;
        if (!rail) { autoScrollSpeedRef.current = 0; return; }
        const r = rail.getBoundingClientRect();
        const distTop = clientY - r.top;
        const distBot = r.bottom - clientY;
        let speed = 0;
        if (distTop < AUTO_SCROLL_ZONE) {
            const t = 1 - Math.max(0, distTop) / AUTO_SCROLL_ZONE;
            speed = -Math.ceil(AUTO_SCROLL_MAX * t);
        } else if (distBot < AUTO_SCROLL_ZONE) {
            const t = 1 - Math.max(0, distBot) / AUTO_SCROLL_ZONE;
            speed = Math.ceil(AUTO_SCROLL_MAX * t);
        }
        autoScrollSpeedRef.current = speed;
        if (speed !== 0 && autoScrollRafRef.current == null) {
            autoScrollRafRef.current = window.requestAnimationFrame(tickAutoScroll);
        }
    };

    const stopAutoScroll = (): void => {
        autoScrollSpeedRef.current = 0;
        if (autoScrollRafRef.current != null) {
            window.cancelAnimationFrame(autoScrollRafRef.current);
            autoScrollRafRef.current = null;
        }
    };

    const cancelHold = (): void => {
        if (holdTimerRef.current != null) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    };

    const scrollToWidget = (uid: string): void => {
        const el = document.querySelector<HTMLElement>(`[data-widget-uid="${uid}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('wjump-flash');
        window.setTimeout(() => el.classList.remove('wjump-flash'), 900);
    };

    /* ── Attach pointer listeners to the external trigger element ── */
    useEffect(() => {
        const btn = triggerEl;
        if (!btn || editMode || ordered.length === 0) return;

        btn.classList.add('wjump-anchor');

        const onPointerDown = (e: PointerEvent): void => {
            // Only react to primary pointer.
            if (e.button !== undefined && e.button !== 0) return;
            activePointerIdRef.current = e.pointerId;
            downPointRef.current = { x: e.clientX, y: e.clientY };
            draggingRef.current = false;
            btn.classList.add('wjump-anchor-armed');
            // IMPORTANT: capture immediately. If we wait for the hold timer
            // to fire, the browser will have already routed subsequent
            // pointermove/up events to whatever the finger is over (e.g. the
            // rail), and the rail's `pointerdown outside` listener would
            // close it as soon as the finger moved off the tab.
            try { btn.setPointerCapture(e.pointerId); } catch { /* no-op */ }
            cancelHold();
            holdTimerRef.current = window.setTimeout(() => {
                holdTimerRef.current = null;
                draggingRef.current = true;
                placeRail();
                setOpen(true);
                btn.classList.add('wjump-anchor-open');
                if (navigator.vibrate) {
                    try { navigator.vibrate(10); } catch { /* no-op */ }
                }
            }, HOLD_MS);
        };

        const onPointerMove = (e: PointerEvent): void => {
            const down = downPointRef.current;
            if (!down) return;
            // Cancel hold if the user moves significantly before timer fires
            // (so the tap can still navigate normally).
            if (holdTimerRef.current != null) {
                const dx = e.clientX - down.x;
                const dy = e.clientY - down.y;
                if (dx * dx + dy * dy > TAP_MOVE_TOLERANCE * TAP_MOVE_TOLERANCE) {
                    cancelHold();
                    btn.classList.remove('wjump-anchor-armed');
                    downPointRef.current = null;
                }
                return;
            }
            if (!draggingRef.current) return;
            lastPointerRef.current = { x: e.clientX, y: e.clientY };
            const uid = findRowAt(e.clientX, e.clientY);
            hoveredUidRef.current = uid;
            setHoveredUid(uid);
            updateAutoScroll(e.clientY);
        };

        const finish = (e: PointerEvent | null, cancelled: boolean): void => {
            const wasDragging = draggingRef.current;
            cancelHold();
            stopAutoScroll();
            btn.classList.remove('wjump-anchor-armed');
            if (e && activePointerIdRef.current != null) {
                try { btn.releasePointerCapture(activePointerIdRef.current); } catch { /* no-op */ }
            }
            activePointerIdRef.current = null;
            downPointRef.current = null;
            if (cancelled) {
                draggingRef.current = false;
                setOpen(false);
                setHoveredUid(null);
                hoveredUidRef.current = null;
                btn.classList.remove('wjump-anchor-open');
                lastPointerRef.current = null;
                return;
            }
            if (wasDragging) {
                // Hold-and-drag ended: jump to the highlighted widget if any,
                // and suppress the synthetic click so the tab does not switch.
                suppressNextClickRef.current = true;
                const uid = hoveredUidRef.current;
                if (uid) scrollToWidget(uid);
                setOpen(false);
                setHoveredUid(null);
                hoveredUidRef.current = null;
                btn.classList.remove('wjump-anchor-open');
                lastPointerRef.current = null;
                draggingRef.current = false;
                return;
            }
            // Short tap: let the tab's normal click handler run.
            draggingRef.current = false;
        };

        const onPointerUp = (e: PointerEvent): void => finish(e, false);
        const onPointerCancel = (e: PointerEvent): void => finish(e, true);
        const onContextMenu = (e: MouseEvent): void => { e.preventDefault(); };

        const onClickSuppress = (e: MouseEvent): void => {
            if (suppressNextClickRef.current) {
                e.preventDefault();
                e.stopPropagation();
                suppressNextClickRef.current = false;
            }
        };

        btn.addEventListener('pointerdown', onPointerDown);
        btn.addEventListener('pointermove', onPointerMove);
        btn.addEventListener('pointerup', onPointerUp);
        btn.addEventListener('pointercancel', onPointerCancel);
        // NOTE: do NOT bind `lostpointercapture` to the cancel handler.
        // `lostpointercapture` fires naturally after every `pointerup`, so
        // binding it would double-trigger and prematurely close the rail.
        btn.addEventListener('contextmenu', onContextMenu);
        btn.addEventListener('click', onClickSuppress, true);

        return () => {
            btn.removeEventListener('pointerdown', onPointerDown);
            btn.removeEventListener('pointermove', onPointerMove);
            btn.removeEventListener('pointerup', onPointerUp);
            btn.removeEventListener('pointercancel', onPointerCancel);
            btn.removeEventListener('contextmenu', onContextMenu);
            btn.removeEventListener('click', onClickSuppress, true);
            btn.classList.remove('wjump-anchor', 'wjump-anchor-armed', 'wjump-anchor-open');
            cancelHold();
            stopAutoScroll();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [triggerEl, editMode, ordered.length]);

    /* ── Sticky-mode dismissal & re-placement on reflow ──────────── */
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (railRef.current?.contains(e.target as Node)) return;
            if (triggerEl?.contains(e.target as Node)) return;
            setOpen(false);
            setHoveredUid(null);
            triggerEl?.classList.remove('wjump-anchor-open');
        };
        const onReflow = () => placeRail();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerEl?.classList.remove('wjump-anchor-open');
            }
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onReflow);
        window.addEventListener('scroll', onReflow, true);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
            stopAutoScroll();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (editMode || ordered.length === 0 || !triggerEl) return null;
    if (!open || !railRect) return null;

    const onItemClick = (uid: string): void => {
        scrollToWidget(uid);
        setOpen(false);
        setHoveredUid(null);
        triggerEl?.classList.remove('wjump-anchor-open');
    };

    return createPortal(
        <div
            ref={railRef}
            className="wjump-rail"
            role="menu"
            aria-label="Indice widget"
            style={{
                left: `${railRect.left}px`,
                top: `${railRect.top}px`,
                width: `${railRect.width}px`,
                maxHeight: `${railRect.height}px`,
            }}
        >
            <div className="wjump-rail-head">
                <span className="wjump-rail-title">Salta a…</span>
                <span className="wjump-rail-count">{ordered.length}</span>
            </div>
            <ul ref={listRef} className="wjump-list">
                {ordered.map((w, i) => {
                    const def = getWidgetDef(w.type)!;
                    const active = hoveredUid === w.uid;
                    return (
                        <li key={w.uid} className="wjump-li">
                            <button
                                type="button"
                                ref={el => { itemsRef.current[i] = el; }}
                                data-uid={w.uid}
                                className={'wjump-item' + (active ? ' is-active' : '')}
                                style={{ ['--wj-accent' as never]: def.accent || 'var(--accent-gold)' }}
                                onClick={() => onItemClick(w.uid)}
                            >
                                <span className="wjump-ico">{def.icon}</span>
                                <span className="wjump-lbl">{def.title}</span>
                                <span className="wjump-mark" aria-hidden />
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="wjump-rail-foot">
                <span className="wjump-rail-hint">trascina · rilascia per saltare</span>
            </div>
        </div>,
        document.body,
    );
};

export default WidgetJumpRail;
