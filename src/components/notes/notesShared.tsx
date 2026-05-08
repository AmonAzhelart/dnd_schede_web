/**
 * notesShared.tsx
 * Componenti, tipi e utility condivisi tra NotesWidget e NotesPage.
 * Modifica qui → si aggiorna in entrambi i punti.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaEdit } from 'react-icons/fa';
import type { NoteContextEntry } from '../../types/dnd';

// ─── Tipo base voce glossario ─────────────────────────────────────────────────

export type GlossaryHoverEntry = Pick<NoteContextEntry, 'id' | 'term' | 'info' | 'category'>;

// ─── Costanti ─────────────────────────────────────────────────────────────────

export const CAT_COLORS: Record<NoteContextEntry['category'], string> = {
    person: '#6ab4ff',
    place: '#6aff9e',
    item: '#ffb46a',
    lore: '#c86aff',
    other: '#aaaaaa',
};

export const CAT_LABELS: Record<NoteContextEntry['category'], string> = {
    person: 'Persona',
    place: 'Luogo',
    item: 'Oggetto',
    lore: 'Lore',
    other: 'Altro',
};

export const ALL_CATS: NoteContextEntry['category'][] = ['person', 'place', 'item', 'lore', 'other'];

// ─── Utility ──────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeRx(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MatchPos { start: number; end: number }
export interface CtxRange { start: number; end: number; entryId: string }
export type TooltipPlacement = 'top' | 'bottom';
export type TooltipAlign = 'center' | 'start' | 'end';

export interface HighlightResult {
    html: string;
    matchCount: number;
    matchPositions: MatchPos[];
    contextRanges: CtxRange[];
}

export function getTooltipAnchorFromRect(rect: DOMRect): {
    x: number; y: number; placement: TooltipPlacement; maxHeight: number; align: TooltipAlign;
} {
    const TOOLTIP_HALF_W = 220;
    const GAP = 10;
    const VIEWPORT_MARGIN = 12;
    const PREFERRED_HEIGHT = Math.min(360, Math.round(window.innerHeight * 0.45));
    const EDGE_TRIGGER = 240;

    const desiredX = rect.left + rect.width / 2;
    let align: TooltipAlign = 'center';
    let x = Math.max(TOOLTIP_HALF_W + VIEWPORT_MARGIN, Math.min(desiredX, window.innerWidth - TOOLTIP_HALF_W - VIEWPORT_MARGIN));
    if (rect.left < EDGE_TRIGGER) {
        align = 'start';
        x = Math.max(VIEWPORT_MARGIN, rect.left);
    } else if (window.innerWidth - rect.right < EDGE_TRIGGER) {
        align = 'end';
        x = Math.min(window.innerWidth - VIEWPORT_MARGIN, rect.right);
    }

    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    let placement: TooltipPlacement;
    if (spaceBelow >= PREFERRED_HEIGHT) placement = 'bottom';
    else if (spaceAbove >= PREFERRED_HEIGHT) placement = 'top';
    else placement = spaceBelow >= spaceAbove ? 'bottom' : 'top';

    const availableSpace = Math.max(140, placement === 'top' ? spaceAbove - GAP : spaceBelow - GAP);
    const maxHeight = Math.min(Math.round(window.innerHeight * 0.5), availableSpace);
    const y = placement === 'top'
        ? Math.max(VIEWPORT_MARGIN, rect.top - GAP)
        : Math.min(window.innerHeight - VIEWPORT_MARGIN, rect.bottom + GAP);

    return { x, y, placement, maxHeight, align };
}

export function getCaretCoords(ta: HTMLTextAreaElement): { x: number; y: number } | null {
    try {
        const cs = window.getComputedStyle(ta);
        const ghost = document.createElement('div');
        const camelToDash = (s: string) => s.replace(/([A-Z])/g, m => '-' + m.toLowerCase());
        [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing',
        ].forEach(p => ghost.style.setProperty(camelToDash(p), cs.getPropertyValue(camelToDash(p))));
        ghost.style.cssText += 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;overflow:hidden;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
        ghost.style.width = ta.clientWidth + 'px';
        ghost.textContent = ta.value.substring(0, ta.selectionStart);
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        ghost.appendChild(marker);
        document.body.appendChild(ghost);
        const ghostRect = ghost.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const relLeft = markerRect.left - ghostRect.left;
        const relTop = markerRect.top - ghostRect.top - ta.scrollTop;
        document.body.removeChild(ghost);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        return {
            x: Math.max(6, Math.min(relLeft, ta.clientWidth - 190)),
            y: Math.max(8, relTop + lh),
        };
    } catch { return null; }
}

export function buildHighlightHtml(
    text: string,
    ctxEntries: GlossaryHoverEntry[],
    searchQ: string,
    curMatchIdx: number,
): HighlightResult {
    type RKind = 'ctx' | 'srch' | 'srch-cur';
    interface R { start: number; end: number; kind: RKind; cat?: string; eid?: string }

    const ranges: R[] = [];
    const contextRanges: CtxRange[] = [];

    for (const e of ctxEntries) {
        const t = e.term.trim();
        if (!t) continue;
        try {
            const re = new RegExp(escapeRx(t), 'gi');
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'ctx', cat: e.category, eid: e.id });
                contextRanges.push({ start: m.index, end: m.index + m[0].length, entryId: e.id });
            }
        } catch { /* skip */ }
    }

    const matchPositions: MatchPos[] = [];
    if (searchQ.trim()) {
        try {
            const re = new RegExp(escapeRx(searchQ.trim()), 'gi');
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const idx = matchPositions.length;
                ranges.push({ start: m.index, end: m.index + m[0].length, kind: idx === curMatchIdx ? 'srch-cur' : 'srch' });
                matchPositions.push({ start: m.index, end: m.index + m[0].length });
            }
        } catch { /* skip */ }
    }

    if (ranges.length === 0) {
        return { html: escapeHtml(text), matchCount: matchPositions.length, matchPositions, contextRanges };
    }

    const bdSet = new Set<number>([0, text.length]);
    for (const r of ranges) {
        if (r.start >= 0 && r.start <= text.length) bdSet.add(r.start);
        if (r.end >= 0 && r.end <= text.length) bdSet.add(r.end);
    }
    const bounds = [...bdSet].sort((a, b) => a - b);

    let html = '';
    for (let i = 0; i < bounds.length - 1; i++) {
        const from = bounds[i], to = bounds[i + 1];
        const seg = escapeHtml(text.slice(from, to));
        const cov = ranges.filter(r => r.start <= from && r.end >= to);
        if (cov.length === 0) { html += seg; continue; }

        const sc = cov.find(r => r.kind === 'srch-cur');
        const ss = cov.find(r => r.kind === 'srch');
        const cx = cov.find(r => r.kind === 'ctx');

        const cls: string[] = [];
        if (cx) cls.push(`ctx-mk ctx-${cx.cat}`);
        if (sc) cls.push('srch-hit srch-cur');
        else if (ss) cls.push('srch-hit');

        const da = cx ? ` data-ctx-id="${cx.eid}"` : '';
        html += `<mark class="${cls.join(' ')}"${da}>${seg}</mark>`;
    }

    return { html, matchCount: matchPositions.length, matchPositions, contextRanges };
}

// ─── TagModal ─────────────────────────────────────────────────────────────────
// Usa createPortal → funziona correttamente sia nel widget che nella pagina intera.

interface TagModalProps {
    initialTerm: string;
    onSave: (term: string, info: string, category: NoteContextEntry['category']) => void;
    onClose: () => void;
}

export const TagModal: React.FC<TagModalProps> = ({ initialTerm, onSave, onClose }) => {
    const [term, setTerm] = useState(initialTerm);
    const [info, setInfo] = useState('');
    const [cat, setCat] = useState<NoteContextEntry['category']>('person');

    return createPortal(
        <div className="wn-overlay-fixed" onMouseDown={onClose}>
            <div className="wn-modal wn-modal-glossary wn-modal-glossary-edit" onMouseDown={e => e.stopPropagation()}>
                <div className="wn-modal-hdr">
                    <span>Aggiungi al Glossario</span>
                    <button className="wn-icon-btn" onClick={onClose}><FaTimes size={11} /></button>
                </div>
                <label className="wn-form-lbl">Termine</label>
                <input className="wn-form-inp" value={term} onChange={e => setTerm(e.target.value)} autoFocus />
                <label className="wn-form-lbl">Categoria</label>
                <div className="wn-cat-row">
                    {ALL_CATS.map(c => (
                        <button
                            key={c}
                            className={`wn-cat-btn ${cat === c ? 'active' : ''}`}
                            style={{ '--cat-c': CAT_COLORS[c] } as React.CSSProperties}
                            onClick={() => setCat(c)}
                        >{CAT_LABELS[c]}</button>
                    ))}
                </div>
                <label className="wn-form-lbl">Descrizione</label>
                <textarea
                    className="wn-form-ta"
                    value={info}
                    onChange={e => setInfo(e.target.value)}
                    rows={4}
                    placeholder="Chi è? Dove si trova? A cosa serve?"
                />
                <div className="wn-modal-footer">
                    <button className="wn-btn-cancel" onClick={onClose}>Annulla</button>
                    <button
                        className="wn-btn-save"
                        onClick={() => term.trim() && onSave(term.trim(), info, cat)}
                    >Salva</button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

// ─── GlossaryDetailsModal ─────────────────────────────────────────────────────

export interface GlossaryDetailsModalProps {
    entry: GlossaryHoverEntry;
    onEdit?: () => void;
    editLabel?: string;
    onClose: () => void;
}

export const GlossaryDetailsModal: React.FC<GlossaryDetailsModalProps> = ({ entry, onEdit, editLabel, onClose }) => createPortal(
    <div className="wn-overlay-fixed" onMouseDown={onClose}>
        <div className="wn-modal wn-modal-glossary" onMouseDown={e => e.stopPropagation()}>
            <div className="wn-modal-hdr">
                <span>{entry.term}</span>
                <button className="wn-icon-btn" onClick={onClose}><FaTimes size={11} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[entry.category], display: 'inline-block' }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {CAT_LABELS[entry.category]}
                </span>
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '42vh', overflowY: 'auto' }}>
                {entry.info?.trim() || 'Nessuna descrizione disponibile.'}
            </div>
            <div className="wn-modal-footer">
                {onEdit && <button className="wn-btn-cancel" onClick={onEdit}><FaEdit size={10} style={{ marginRight: 4 }} />{editLabel ?? 'Modifica'}</button>}
                <button className="wn-btn-save" onClick={onClose}>Chiudi</button>
            </div>
        </div>
    </div>,
    document.body,
);

// ─── GlossaryEditModal ────────────────────────────────────────────────────────

export interface GlossaryEditModalProps {
    entry: NoteContextEntry;
    /** true = "Nuova voce", false = "Modifica voce" (default) */
    isNew?: boolean;
    onSave: (entry: NoteContextEntry) => void;
    onCancel: () => void;
}

export const GlossaryEditModal: React.FC<GlossaryEditModalProps> = ({ entry, isNew = false, onSave, onCancel }) => {
    const [term, setTerm] = useState(entry.term);
    const [info, setInfo] = useState(entry.info);
    const [cat, setCat] = useState(entry.category);

    return createPortal(
        <div className="wn-overlay-fixed" onMouseDown={onCancel}>
            <div className="wn-modal wn-modal-glossary wn-modal-glossary-edit" onMouseDown={e => e.stopPropagation()}>
                <div className="wn-modal-hdr">
                    <span>{isNew ? 'Nuova voce' : 'Modifica voce'}</span>
                    <button className="wn-icon-btn" onClick={onCancel}><FaTimes size={11} /></button>
                </div>
                <label className="wn-form-lbl">Termine</label>
                <input className="wn-form-inp" value={term} onChange={e => setTerm(e.target.value)} autoFocus />
                <label className="wn-form-lbl">Categoria</label>
                <div className="wn-cat-row">
                    {ALL_CATS.map(c => (
                        <button
                            key={c}
                            className={`wn-cat-btn ${cat === c ? 'active' : ''}`}
                            style={{ '--cat-c': CAT_COLORS[c] } as React.CSSProperties}
                            onClick={() => setCat(c)}
                        >{CAT_LABELS[c]}</button>
                    ))}
                </div>
                <label className="wn-form-lbl">Descrizione</label>
                <textarea
                    className="wn-form-ta"
                    value={info}
                    onChange={e => setInfo(e.target.value)}
                    rows={6}
                    placeholder="Descrizione…"
                />
                <div className="wn-modal-footer">
                    <button className="wn-btn-cancel" onClick={onCancel}>Annulla</button>
                    <button
                        className="wn-btn-save"
                        onClick={() => { if (term.trim()) onSave({ ...entry, term: term.trim(), info, category: cat }); }}
                    >Salva</button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

// ─── PersonalNoteEditModal ────────────────────────────────────────────────────

export interface PersonalNoteEditModalProps {
    entryTerm: string;
    initialNote: string;
    onSave: (note: string) => void;
    onCancel: () => void;
}

export const PersonalNoteEditModal: React.FC<PersonalNoteEditModalProps> = ({ entryTerm, initialNote, onSave, onCancel }) => {
    const [note, setNote] = useState(initialNote);

    return createPortal(
        <div className="wn-overlay-fixed" onMouseDown={onCancel}>
            <div className="wn-modal wn-modal-glossary wn-modal-glossary-edit" onMouseDown={e => e.stopPropagation()}>
                <div className="wn-modal-hdr">
                    <span>📝 Nota su "{entryTerm}"</span>
                    <button className="wn-icon-btn" onClick={onCancel}><FaTimes size={11} /></button>
                </div>
                <label className="wn-form-lbl">La mia nota personale</label>
                <textarea
                    className="wn-form-ta"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={7}
                    placeholder="Scrivi i tuoi pensieri su questa voce…"
                    autoFocus
                />
                <div className="wn-modal-footer">
                    <button className="wn-btn-cancel" onClick={onCancel}>Annulla</button>
                    <button className="wn-btn-save" onClick={() => onSave(note)}>Salva</button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
