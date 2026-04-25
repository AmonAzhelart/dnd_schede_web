/* ============================================================================
 * BottomDrawer — slide-up bottom sheet for mobile / tablet.
 *
 *  Usage:
 *    <BottomDrawer open={open} onClose={() => setOpen(false)} title="Titolo">
 *      {children}
 *    </BottomDrawer>
 *
 *  The drawer is rendered via a React portal into document.body so it sits
 *  on top of everything (z-index: 1200).  The backdrop can be tapped to
 *  close.  An optional `title` renders a sticky handle + title row.
 *  `snapPoints` can be 'half' | 'full' (default 'full').
 * ========================================================================== */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import './BottomDrawer.css';

export interface BottomDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** 'auto'  — height grows with content (max 92 vh).
   *  'full'  — always 92 vh tall.
   *  'half'  — ~52 vh tall.
   */
  size?: 'auto' | 'full' | 'half';
  children: React.ReactNode;
  /** Accent colour for the handle/title bar border. Defaults to gold. */
  accentColor?: string;
  /** Extra class names for the inner sheet div. */
  className?: string;
}

export const BottomDrawer: React.FC<BottomDrawerProps> = ({
  open,
  onClose,
  title,
  size = 'auto',
  children,
  accentColor,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  /* Prevent body scroll while drawer is open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === 'full' ? 'bd-full' : size === 'half' ? 'bd-half' : 'bd-auto';
  const accentStyle = accentColor
    ? ({ '--bd-accent': accentColor } as React.CSSProperties)
    : undefined;

  return createPortal(
    <div
      className="bd-backdrop"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={sheetRef}
        className={`bd-sheet ${sizeClass} ${className}`}
        style={accentStyle}
      >
        {/* ─── Handle bar ─────────────────────────────────── */}
        <div className="bd-handle-row">
          <div className="bd-handle" />
          {title && <div className="bd-title">{title}</div>}
          <button
            type="button"
            className="bd-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* ─── Scrollable content ─────────────────────────── */}
        <div className="bd-body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
