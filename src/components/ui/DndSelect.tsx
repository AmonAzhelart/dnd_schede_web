/* ============================================================================
 * DndSelect ─ on-brand replacement for native <select>.
 *   ▸ Headless-style: keyboard + mouse + touch, accessible (WAI-ARIA listbox).
 *   ▸ Portal popup so it never gets clipped by modal/overflow ancestors.
 *   ▸ Dark glass + gold accents, matches the rest of the design system.
 *   ▸ Optional <optgroup>-like sections via the `group` field on options.
 * ----------------------------------------------------------------------------
 *   <DndSelect
 *      value={value}
 *      onChange={setValue}
 *      options={[{ value, label, group? }, ...]}
 *      placeholder="…"
 *      disabled
 *   />
 * ========================================================================== */
import React, {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import './DndSelect.css';

export type DndSelectOption<V extends string = string> = {
    value: V;
    label: string;
    /** Optional section heading the option belongs to (renders an optgroup). */
    group?: string;
    /** Optional secondary text shown to the right of the label. */
    hint?: string;
    disabled?: boolean;
};

export type DndSelectProps<V extends string = string> = {
    value: V;
    onChange: (value: V) => void;
    options: DndSelectOption<V>[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
    /** Aria label when no visible label is associated. */
    ariaLabel?: string;
    /** Min popup width in px (defaults to trigger width). */
    minPopupWidth?: number;
    /** Max popup height in px before scrolling. */
    maxPopupHeight?: number;
};

const POPUP_VIEWPORT_PAD = 8;

export function DndSelect<V extends string = string>(props: DndSelectProps<V>) {
    const {
        value,
        onChange,
        options,
        placeholder = 'Seleziona…',
        disabled,
        className,
        id,
        ariaLabel,
        minPopupWidth,
        maxPopupHeight = 320,
    } = props;

    const reactId = useId();
    const listboxId = id ?? `dnd-sel-${reactId}`;

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popupRef = useRef<HTMLDivElement | null>(null);
    const optionRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());

    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState<number>(-1);
    const [popupPos, setPopupPos] = useState<{
        top: number; left: number; width: number; placement: 'down' | 'up';
    } | null>(null);

    /* Keep options ordered by group for visual sectioning while preserving
       the caller's intra-group ordering. */
    const orderedOptions = useMemo(() => {
        const sections: { group?: string; items: DndSelectOption<V>[] }[] = [];
        const indexByGroup = new Map<string | undefined, number>();
        options.forEach(opt => {
            const k = opt.group;
            let idx = indexByGroup.get(k);
            if (idx === undefined) {
                idx = sections.length;
                indexByGroup.set(k, idx);
                sections.push({ group: k, items: [] });
            }
            sections[idx].items.push(opt);
        });
        const flat: DndSelectOption<V>[] = [];
        sections.forEach(s => s.items.forEach(o => flat.push(o)));
        return { sections, flat };
    }, [options]);

    const selectedIdx = useMemo(
        () => orderedOptions.flat.findIndex(o => o.value === value),
        [orderedOptions, value],
    );

    const selectedOption = selectedIdx >= 0 ? orderedOptions.flat[selectedIdx] : undefined;

    /* ── popup placement ───────────────────────────────────────────────── */
    const measure = useCallback(() => {
        const trig = triggerRef.current;
        if (!trig) return;
        const r = trig.getBoundingClientRect();
        const vh = window.innerHeight;
        const spaceBelow = vh - r.bottom - POPUP_VIEWPORT_PAD;
        const spaceAbove = r.top - POPUP_VIEWPORT_PAD;
        const desired = Math.min(maxPopupHeight, 360);
        const placement: 'down' | 'up' =
            spaceBelow >= desired || spaceBelow >= spaceAbove ? 'down' : 'up';
        setPopupPos({
            top: placement === 'down' ? r.bottom + 6 : r.top - 6,
            left: r.left,
            width: Math.max(r.width, minPopupWidth ?? 0),
            placement,
        });
    }, [maxPopupHeight, minPopupWidth]);

    useLayoutEffect(() => {
        if (!open) return;
        measure();
    }, [open, measure]);

    useEffect(() => {
        if (!open) return;
        const handler = () => measure();
        window.addEventListener('resize', handler);
        window.addEventListener('scroll', handler, true);
        return () => {
            window.removeEventListener('resize', handler);
            window.removeEventListener('scroll', handler, true);
        };
    }, [open, measure]);

    /* ── click outside / escape ────────────────────────────────────────── */
    useEffect(() => {
        if (!open) return;
        const onDocPointer = (e: PointerEvent) => {
            const t = e.target as Node;
            if (
                triggerRef.current?.contains(t) ||
                popupRef.current?.contains(t)
            ) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', onDocPointer);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('pointerdown', onDocPointer);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    /* ── focus / activeIdx sync when opening ───────────────────────────── */
    useEffect(() => {
        if (!open) return;
        const start = selectedIdx >= 0 ? selectedIdx : 0;
        setActiveIdx(start);
        // Scroll the active row into view on next paint.
        requestAnimationFrame(() => {
            const el = optionRefs.current.get(start);
            el?.scrollIntoView({ block: 'nearest' });
        });
    }, [open, selectedIdx]);

    /* ── typeahead buffer ──────────────────────────────────────────────── */
    const typeBufRef = useRef<{ buf: string; t: number }>({ buf: '', t: 0 });
    const typeahead = useCallback((ch: string) => {
        const now = Date.now();
        const prev = typeBufRef.current;
        const buf = (now - prev.t > 600 ? '' : prev.buf) + ch.toLowerCase();
        typeBufRef.current = { buf, t: now };
        const items = orderedOptions.flat;
        const startFrom = (activeIdx + (buf.length === 1 ? 1 : 0)) % items.length;
        for (let i = 0; i < items.length; i++) {
            const idx = (startFrom + i) % items.length;
            if (items[idx].disabled) continue;
            if (items[idx].label.toLowerCase().startsWith(buf)) {
                setActiveIdx(idx);
                optionRefs.current.get(idx)?.scrollIntoView({ block: 'nearest' });
                return;
            }
        }
    }, [activeIdx, orderedOptions]);

    /* ── keyboard handling on trigger / popup ──────────────────────────── */
    const moveActive = useCallback((delta: number) => {
        const items = orderedOptions.flat;
        if (items.length === 0) return;
        let idx = activeIdx;
        for (let i = 0; i < items.length; i++) {
            idx = (idx + delta + items.length) % items.length;
            if (!items[idx].disabled) break;
        }
        setActiveIdx(idx);
        optionRefs.current.get(idx)?.scrollIntoView({ block: 'nearest' });
    }, [activeIdx, orderedOptions]);

    const onTriggerKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (!open) {
            if (
                e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
                e.key === 'Enter'    || e.key === ' '
            ) {
                e.preventDefault();
                setOpen(true);
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                setOpen(true);
                typeahead(e.key);
            }
            return;
        }
        // open
        if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); moveActive(-1); }
        else if (e.key === 'Home')      { e.preventDefault(); setActiveIdx(0); optionRefs.current.get(0)?.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'End')       {
            e.preventDefault();
            const last = orderedOptions.flat.length - 1;
            setActiveIdx(last);
            optionRefs.current.get(last)?.scrollIntoView({ block: 'nearest' });
        }
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            commit(activeIdx);
        }
        else if (e.key === 'Tab') {
            setOpen(false);
        }
        else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            typeahead(e.key);
        }
    };

    const commit = (idx: number) => {
        const opt = orderedOptions.flat[idx];
        if (!opt || opt.disabled) return;
        onChange(opt.value);
        setOpen(false);
        triggerRef.current?.focus();
    };

    const renderOptionRow = (opt: DndSelectOption<V>, flatIdx: number) => {
        const isSelected = opt.value === value;
        const isActive = flatIdx === activeIdx;
        return (
            <li
                key={opt.value}
                ref={el => { optionRefs.current.set(flatIdx, el); }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                className={
                    'dnd-sel-opt' +
                    (isSelected ? ' is-selected' : '') +
                    (isActive ? ' is-active' : '') +
                    (opt.disabled ? ' is-disabled' : '')
                }
                onMouseEnter={() => !opt.disabled && setActiveIdx(flatIdx)}
                onClick={() => commit(flatIdx)}
            >
                <span className="dnd-sel-opt-check" aria-hidden>
                    {isSelected ? '✓' : ''}
                </span>
                <span className="dnd-sel-opt-label">{opt.label}</span>
                {opt.hint && <span className="dnd-sel-opt-hint">{opt.hint}</span>}
            </li>
        );
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                id={id}
                className={'dnd-sel-trigger' + (open ? ' is-open' : '') + (disabled ? ' is-disabled' : '') + (className ? ' ' + className : '')}
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                onKeyDown={onTriggerKey}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-label={ariaLabel}
            >
                <span className={'dnd-sel-value' + (selectedOption ? '' : ' is-placeholder')}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="dnd-sel-chev" aria-hidden>
                    <svg viewBox="0 0 12 12" width="12" height="12">
                        <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </button>

            {open && popupPos && createPortal(
                <div
                    ref={popupRef}
                    className={'dnd-sel-popup placement-' + popupPos.placement}
                    style={{
                        position: 'fixed',
                        top: popupPos.placement === 'down' ? popupPos.top : undefined,
                        bottom: popupPos.placement === 'up'
                            ? Math.max(POPUP_VIEWPORT_PAD, window.innerHeight - popupPos.top)
                            : undefined,
                        left: popupPos.left,
                        width: popupPos.width,
                        maxHeight: maxPopupHeight,
                        zIndex: 10000,
                    }}
                    role="presentation"
                >
                    <ul
                        id={listboxId}
                        role="listbox"
                        className="dnd-sel-list"
                        tabIndex={-1}
                    >
                        {(() => {
                            let flatIdx = 0;
                            return orderedOptions.sections.map((sec, si) => (
                                <React.Fragment key={si}>
                                    {sec.group && (
                                        <li className="dnd-sel-group" role="presentation">
                                            <span>{sec.group}</span>
                                        </li>
                                    )}
                                    {sec.items.map(opt => renderOptionRow(opt, flatIdx++))}
                                </React.Fragment>
                            ));
                        })()}
                        {orderedOptions.flat.length === 0 && (
                            <li className="dnd-sel-empty" role="presentation">Nessuna opzione</li>
                        )}
                    </ul>
                </div>,
                document.body,
            )}
        </>
    );
}

export default DndSelect;
