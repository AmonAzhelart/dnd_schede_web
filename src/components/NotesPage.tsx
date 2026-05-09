/**
 * NotesPage – full-page replacement for the old "Diario & NPC" tab.
 * Left panel: personal glossary + campaign glossary (read-only for players).
 * Right panel: multi-tab notes editor with search, autocomplete and preview.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../store/characterStore';
import { saveCharacterToDb } from '../services/db';
import { subscribePlayerCampaignGlossary } from '../services/campaign';
import {
    FaPlus, FaTimes, FaSearch, FaChevronUp, FaChevronDown,
    FaBook, FaTag, FaEye, FaEdit, FaTrash, FaGlobe, FaUser,
} from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import type { NoteContextEntry, NoteTab } from '../types/dnd';
import type { CampaignGlossaryEntry } from '../types/campaign';
import './dashboard/widgets/styles/notes.css';
import './NotesPage.css';
import {
    type GlossaryHoverEntry, CAT_COLORS, CAT_LABELS, ALL_CATS,
    type TooltipPlacement, type TooltipAlign,
    getTooltipAnchorFromRect, getCaretCoords, buildHighlightHtml,
    TagModal, GlossaryDetailsModal, GlossaryEditModal, PersonalNoteEditModal,
} from './notes/notesShared';





// ─── NotesPage ────────────────────────────────────────────────────────────────

export const NotesPage: React.FC = () => {
    const {
        character,
        setNoteTabs,
        addNoteContextEntry,
        updateNoteContextEntry,
        removeNoteContextEntry,
    } = useCharacterStore();

    const rawTabs = character?.noteTabs;
    const ctxEntries = useMemo(() => character?.noteContext ?? [], [character?.noteContext]);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabs: NoteTab[] = useMemo(() => {
        if (rawTabs && rawTabs.length > 0) return rawTabs;
        const legacy = character?.quickNotes ?? '';
        return [{ id: 'tab-legacy', name: 'Note', content: legacy }];
    }, [rawTabs, character?.quickNotes]);

    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    useEffect(() => {
        if (tabs.length === 0) return;
        if (!activeTabId || !tabs.find(t => t.id === activeTabId)) setActiveTabId(tabs[0].id);
    }, [tabs, activeTabId]);

    const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

    // ── Persist ───────────────────────────────────────────────────────────────
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistTabs = useCallback((newTabs: NoteTab[]) => {
        setNoteTabs(newTabs);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const char = useCharacterStore.getState().character;
            if (char) saveCharacterToDb(char);
        }, 1500);
    }, [setNoteTabs]);

    const handleChange = useCallback((value: string) => {
        const newTabs = tabs.map(t => t.id === activeTabId ? { ...t, content: value } : t);
        persistTabs(newTabs);
    }, [tabs, activeTabId, persistTabs]);

    // ── Tab management ────────────────────────────────────────────────────────
    const addTab = useCallback(() => {
        const t: NoteTab = { id: uuidv4(), name: `Tab ${tabs.length + 1}`, content: '' };
        persistTabs([...tabs, t]);
        setActiveTabId(t.id);
    }, [tabs, persistTabs]);

    const deleteTab = useCallback((id: string) => {
        if (tabs.length <= 1) return;
        const next = tabs.filter(t => t.id !== id);
        persistTabs(next);
        if (activeTabId === id) setActiveTabId(next[0].id);
    }, [tabs, activeTabId, persistTabs]);

    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameVal, setRenameVal] = useState('');

    const commitRename = useCallback(() => {
        if (renamingId && renameVal.trim()) {
            persistTabs(tabs.map(t => t.id === renamingId ? { ...t, name: renameVal.trim() } : t));
        }
        setRenamingId(null);
    }, [renamingId, renameVal, tabs, persistTabs]);

    // ── Search ────────────────────────────────────────────────────────────────
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [curMatch, setCurMatch] = useState(0);
    const [matchCount, setMatchCount] = useState(0);

    useEffect(() => { if (!searchOpen) setSearchQ(''); }, [searchOpen]);
    useEffect(() => { setCurMatch(0); }, [searchQ, activeTabId]);

    const goPrev = () => setCurMatch(i => matchCount === 0 ? 0 : (i - 1 + matchCount) % matchCount);
    const goNext = () => setCurMatch(i => matchCount === 0 ? 0 : (i + 1) % matchCount);

    // ── Glossary panel state ──────────────────────────────────────────────────
    const [glossSection, setGlossSection] = useState<'personal' | 'campaign'>('personal');
    const [editState, setEditState] = useState<{ entry: NoteContextEntry; isNew: boolean } | null>(null);
    const [glossSearch, setGlossSearch] = useState('');
    const [glossCatFilter, setGlossCatFilter] = useState<NoteContextEntry['category'] | 'all'>('all');
    const [editingCampaignNoteEntry, setEditingCampaignNoteEntry] = useState<CampaignGlossaryEntry | null>(null);
    const [campaignGlossSearch, setCampaignGlossSearch] = useState('');
    const [campaignGlossCatFilter, setCampaignGlossCatFilter] = useState<CampaignGlossaryEntry['category'] | 'all'>('all');

    // ── Campaign glossary ─────────────────────────────────────────────────────
    const [campaignEntries, setCampaignEntries] = useState<CampaignGlossaryEntry[]>([]);

    useEffect(() => {
        const campaignId = character?.campaignId;
        const userId = character?.userId;
        if (!campaignId || !userId) {
            setCampaignEntries([]);
            return;
        }
        return subscribePlayerCampaignGlossary(campaignId, userId, setCampaignEntries);
    }, [character?.campaignId, character?.userId]);

    const allGlossaryEntries = useMemo<GlossaryHoverEntry[]>(() => {
        const campaignMapped: GlossaryHoverEntry[] = campaignEntries.map(e => ({
            id: `cmp-${e.id}`,
            term: e.term,
            info: (e.sections ?? []).map(s => [s.label, s.content].filter(Boolean).join(': ')).join(' | ') || e.info || '',
            category: e.category as NoteContextEntry['category'],
        }));
        return [...ctxEntries, ...campaignMapped];
    }, [ctxEntries, campaignEntries]);

    // ── Tag / autocomplete ────────────────────────────────────────────────────
    const [tagModal, setTagModal] = useState<string | null>(null);
    const [glossModal, setGlossModal] = useState<(GlossaryHoverEntry & { onEdit?: () => void; editLabel?: string }) | null>(null);
    const [selText, setSelText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        setSelText(ta.value.slice(ta.selectionStart, ta.selectionEnd).trim());
    };

    const [acSuggestions, setAcSuggestions] = useState<NoteContextEntry[]>([]);
    const [acWord, setAcWord] = useState('');
    const [acPos, setAcPos] = useState<{ x: number; y: number } | null>(null);
    const [acIdx, setAcIdx] = useState(0);

    const updateAutocomplete = useCallback((ta: HTMLTextAreaElement) => {
        // Combine personal + campaign entries for suggestions
        const allTerms = allGlossaryEntries;
        if (allTerms.length === 0) { setAcSuggestions([]); return; }
        const before = ta.value.slice(0, ta.selectionStart);
        const m = before.match(/[\wàáâãäåæçèéêëìíîïðñòóôõöùúûüýÿ'\-]{2,}$/i);
        const word = m ? m[0] : '';
        if (word.length >= 2) {
            const sugg = allTerms
                .filter(e => e.term.toLowerCase().startsWith(word.toLowerCase()) && e.term.toLowerCase() !== word.toLowerCase())
                .slice(0, 5);
            if (sugg.length > 0) {
                setAcWord(word);
                setAcSuggestions(sugg);
                setAcIdx(0);
                setAcPos(getCaretCoords(ta));
                return;
            }
        }
        setAcSuggestions([]);
        setAcPos(null);
    }, [allGlossaryEntries]);

    const acceptSuggestion = useCallback((entry: NoteContextEntry) => {
        const ta = textareaRef.current;
        if (!ta || !acWord) return;
        const pos = ta.selectionStart;
        const before = ta.value.slice(0, pos);
        const after = ta.value.slice(pos);
        const newBefore = before.slice(0, before.length - acWord.length) + entry.term;
        const newVal = newBefore + after;
        handleChange(newVal);
        const newCursor = newBefore.length;
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = newCursor; ta.focus(); });
        setAcSuggestions([]);
        setAcPos(null);
        setSelText('');
    }, [acWord, handleChange]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (acSuggestions.length === 0) return;
        if (e.key === 'Tab') { e.preventDefault(); acceptSuggestion(acSuggestions[acIdx]); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setAcIdx(i => (i + 1) % acSuggestions.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIdx(i => (i - 1 + acSuggestions.length) % acSuggestions.length); }
        else if (e.key === 'Escape') { setAcSuggestions([]); }
    };

    // ── Preview mode ──────────────────────────────────────────────────────────
    const [preview, setPreview] = useState(false);

    // ── Highlight ─────────────────────────────────────────────────────────────
    const hlResult = useMemo(
        () => buildHighlightHtml(activeTab?.content ?? '', allGlossaryEntries, searchQ, curMatch),
        [activeTab?.content, allGlossaryEntries, searchQ, curMatch],
    );

    useEffect(() => {
        const n = hlResult.matchCount;
        setMatchCount(n);
        setCurMatch(prev => n === 0 ? 0 : Math.min(prev, n - 1));
    }, [hlResult.matchCount]);

    const syncScroll = () => {
        if (!textareaRef.current || !mirrorRef.current) return;
        mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    };

    useEffect(() => {
        if (preview || !textareaRef.current) return;
        const mp = hlResult.matchPositions[curMatch];
        if (!mp) return;
        const ta = textareaRef.current;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(mp.start, mp.end);
    }, [curMatch, preview, hlResult.matchPositions]);

    useEffect(() => {
        if (!preview || !previewRef.current) return;
        const cur = previewRef.current.querySelector<HTMLElement>('.srch-cur');
        if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [curMatch, preview]);

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const [tooltip, setTooltip] = useState<{
        entry: GlossaryHoverEntry;
        x: number; y: number; placement: TooltipPlacement; maxHeight: number; align: TooltipAlign;
    } | null>(null);
    const tooltipCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTooltipClose = useCallback(() => {
        if (!tooltipCloseTimerRef.current) return;
        clearTimeout(tooltipCloseTimerRef.current);
        tooltipCloseTimerRef.current = null;
    }, []);

    const scheduleTooltipClose = useCallback((delayMs = 220) => {
        clearTooltipClose();
        tooltipCloseTimerRef.current = setTimeout(() => {
            setTooltip(null);
            tooltipCloseTimerRef.current = null;
        }, delayMs);
    }, [clearTooltipClose]);

    const handleEditorMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
        const next = e.relatedTarget as HTMLElement | null;
        if (next?.closest('.wn-ctx-tip')) return;
        scheduleTooltipClose(240);
    };

    useEffect(() => {
        if (!tooltip) return;
        const handler = (e: PointerEvent) => {
            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
            if (el?.closest('[data-ctx-id]') || el?.closest('.wn-ctx-tip')) {
                clearTooltipClose();
                return;
            }
            scheduleTooltipClose(180);
        };
        document.addEventListener('pointermove', handler);
        return () => document.removeEventListener('pointermove', handler);
    }, [tooltip, clearTooltipClose, scheduleTooltipClose]);

    useEffect(() => {
        return () => clearTooltipClose();
    }, [clearTooltipClose]);

    const handleMirrorOver = (e: React.MouseEvent<HTMLDivElement>) => {
        const marked = (e.target as HTMLElement).closest('[data-ctx-id]') as HTMLElement | null;
        if (!marked) return;
        const entry = allGlossaryEntries.find(c => c.id === marked.dataset.ctxId);
        if (!entry) return;
        clearTooltipClose();
        const p = getTooltipAnchorFromRect(marked.getBoundingClientRect());
        setTooltip({ entry, x: p.x, y: p.y, placement: p.placement, maxHeight: p.maxHeight, align: p.align });
    };

    const handlePreviewOver = (e: React.MouseEvent<HTMLDivElement>) => {
        const marked = (e.target as HTMLElement).closest('[data-ctx-id]') as HTMLElement | null;
        if (!marked) return;
        const entry = allGlossaryEntries.find(c => c.id === marked.dataset.ctxId);
        if (!entry) return;
        clearTooltipClose();
        const p = getTooltipAnchorFromRect(marked.getBoundingClientRect());
        setTooltip({ entry, x: p.x, y: p.y, placement: p.placement, maxHeight: p.maxHeight, align: p.align });
    };

    const content = activeTab?.content ?? '';
    const hasCampaign = !!character?.campaignId;

    if (!character) return null;

    return (
        <div className="np-root">

            {/* ── Left: Glossary panel ── */}
            <div className="np-gloss-panel">
                <div className="np-gloss-header">
                    <FaBook size={13} style={{ color: 'var(--accent-gold)' }} />
                    <span>Glossario</span>
                    {hasCampaign && (
                        <div className="np-gloss-tabs">
                            <button
                                className={`np-gloss-tab ${glossSection === 'personal' ? 'active' : ''}`}
                                onClick={() => setGlossSection('personal')}
                                title="Glossario personale"
                            ><FaUser size={10} /> Personale <span className="np-gloss-count">{ctxEntries.length}</span></button>
                            <button
                                className={`np-gloss-tab ${glossSection === 'campaign' ? 'active' : ''}`}
                                onClick={() => setGlossSection('campaign')}
                                title="Glossario campagna"
                            ><FaGlobe size={10} /> Campagna <span className="np-gloss-count">{campaignEntries.length}</span></button>
                        </div>
                    )}
                </div>

                {/* Personal glossary */}
                {glossSection === 'personal' && (
                    <div className="np-gloss-body">
                        <div className="np-gloss-toolbar">
                            <span className="np-gloss-sub">Personale</span>
                            <button className="wn-icon-btn" title="Nuova voce"
                                onClick={() => setEditState({ entry: { id: uuidv4(), term: '', info: '', category: 'other' }, isNew: true })}>
                                <FaPlus size={10} />
                            </button>
                        </div>

                        {ctxEntries.length > 0 && (
                            <>
                                <div className="np-gloss-search">
                                    <FaSearch size={9} className="np-gloss-search-ico" />
                                    <input
                                        className="np-gloss-search-inp"
                                        placeholder="Cerca voci…"
                                        value={glossSearch}
                                        onChange={e => setGlossSearch(e.target.value)}
                                    />
                                    {glossSearch && (
                                        <button className="wn-icon-btn" onClick={() => setGlossSearch('')}>
                                            <FaTimes size={8} />
                                        </button>
                                    )}
                                </div>
                                <div className="np-gloss-cat-filters">
                                    {(['all', ...ALL_CATS] as const).map(c => (
                                        <button
                                            key={c}
                                            className={`np-gloss-cat-filter ${glossCatFilter === c ? 'active' : ''}`}
                                            style={{ '--filter-c': c === 'all' ? 'var(--accent-gold)' : CAT_COLORS[c as NoteContextEntry['category']] } as React.CSSProperties}
                                            onClick={() => setGlossCatFilter(c === glossCatFilter ? 'all' : c)}
                                        >
                                            {c === 'all' ? 'Tutti' : CAT_LABELS[c as NoteContextEntry['category']]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {ctxEntries.length === 0 && !(editState?.isNew) && (
                            <div className="np-gloss-empty">
                                <FaBook size={22} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 6 }} />
                                <p>Nessuna voce. Seleziona del testo nell'editor e clicca "Tagga".</p>
                            </div>
                        )}

                        {ctxEntries
                            .filter((e: NoteContextEntry) => {
                                if (glossCatFilter !== 'all' && e.category !== glossCatFilter) return false;
                                if (glossSearch.trim()) {
                                    const q = glossSearch.toLowerCase();
                                    return e.term.toLowerCase().includes(q) || e.info.toLowerCase().includes(q);
                                }
                                return true;
                            })
                            .map((entry: NoteContextEntry) => {
                                return (
                                    <div
                                        key={entry.id}
                                        className="np-gloss-entry"
                                        onClick={() => setGlossModal({ ...entry, onEdit: () => { setGlossModal(null); setEditState({ entry: { ...entry }, isNew: false }); }, editLabel: 'Modifica voce' })}
                                        role="button"
                                        title="Apri descrizione"
                                    >
                                        <div className="np-gloss-entry-dot"
                                            style={{ background: CAT_COLORS[entry.category], '--dot-color': CAT_COLORS[entry.category] } as React.CSSProperties} />
                                        <div className="np-gloss-entry-body">
                                            <div className="np-gloss-term">{entry.term}</div>
                                            {entry.info && <div className="np-gloss-info">{entry.info}</div>}
                                        </div>
                                        <div className="np-gloss-entry-acts">
                                            <button className="wn-icon-btn"
                                                onClick={(e) => { e.stopPropagation(); setEditState({ entry: { ...entry }, isNew: false }); }}
                                                title="Modifica"><FaEdit size={9} /></button>
                                            <button className="wn-icon-btn danger"
                                                onClick={(e) => { e.stopPropagation(); removeNoteContextEntry(entry.id); }}
                                                title="Elimina"><FaTrash size={9} /></button>
                                        </div>
                                    </div>
                                );
                            })}

                        {ctxEntries.length > 0 && glossSearch && ctxEntries.filter((e: NoteContextEntry) => {
                            if (glossCatFilter !== 'all' && e.category !== glossCatFilter) return false;
                            const q = glossSearch.toLowerCase();
                            return e.term.toLowerCase().includes(q) || e.info.toLowerCase().includes(q);
                        }).length === 0 && (
                                <div className="np-gloss-empty">
                                    <FaSearch size={16} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 6 }} />
                                    <p>Nessun risultato per "{glossSearch}"</p>
                                </div>
                            )}
                    </div>
                )}

                {/* Campaign glossary */}
                {glossSection === 'campaign' && (
                    <div className="np-gloss-body">
                        <div className="np-gloss-toolbar">
                            <span className="np-gloss-sub">Condiviso dal Master</span>
                        </div>

                        {campaignEntries.length > 0 && (
                            <>
                                <div className="np-gloss-search">
                                    <FaSearch size={9} className="np-gloss-search-ico" />
                                    <input
                                        className="np-gloss-search-inp"
                                        placeholder="Cerca voci…"
                                        value={campaignGlossSearch}
                                        onChange={e => setCampaignGlossSearch(e.target.value)}
                                    />
                                    {campaignGlossSearch && (
                                        <button className="wn-icon-btn" onClick={() => setCampaignGlossSearch('')}>
                                            <FaTimes size={8} />
                                        </button>
                                    )}
                                </div>
                                <div className="np-gloss-cat-filters">
                                    {(['all', ...ALL_CATS] as const).map(c => (
                                        <button
                                            key={c}
                                            className={`np-gloss-cat-filter ${campaignGlossCatFilter === c ? 'active' : ''}`}
                                            style={{ '--filter-c': c === 'all' ? 'var(--accent-gold)' : CAT_COLORS[c as NoteContextEntry['category']] } as React.CSSProperties}
                                            onClick={() => setCampaignGlossCatFilter(c === campaignGlossCatFilter ? 'all' : c)}
                                        >
                                            {c === 'all' ? 'Tutti' : CAT_LABELS[c as NoteContextEntry['category']]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {campaignEntries.length === 0 && (
                            <div className="np-gloss-empty">
                                <FaGlobe size={22} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 6 }} />
                                <p>Il master non ha ancora condiviso voci con te.</p>
                            </div>
                        )}

                        {campaignEntries
                            .filter(entry => {
                                if (campaignGlossCatFilter !== 'all' && entry.category !== campaignGlossCatFilter) return false;
                                if (campaignGlossSearch.trim()) {
                                    const q = campaignGlossSearch.toLowerCase();
                                    const infoText = (entry.sections ?? []).map(s => `${s.label} ${s.content}`).join(' ') || entry.info || '';
                                    return entry.term.toLowerCase().includes(q) || infoText.toLowerCase().includes(q);
                                }
                                return true;
                            })
                            .map(entry => {
                                const currentNote = character?.campaignId
                                    ? (character.playerGlossaryNotes?.[`${character.campaignId}::${entry.id}`] ?? '')
                                    : '';
                                const previewInfo = (entry.sections ?? []).length > 0
                                    ? (entry.sections[0].content ?? '').slice(0, 80)
                                    : (entry.info ?? '').slice(0, 80);
                                return (
                                    <div
                                        key={entry.id}
                                        className="np-gloss-entry campaign"
                                        onClick={() => {
                                            const detail = (entry.sections ?? []).length > 0
                                                ? entry.sections.map(sec => sec.label ? `${sec.label}\n${sec.content}` : sec.content).join('\n\n')
                                                : (entry.info || 'Nessuna descrizione disponibile.');
                                            setGlossModal({ id: `cmp-${entry.id}`, term: entry.term, info: detail, category: entry.category as NoteContextEntry['category'], onEdit: () => { setGlossModal(null); setEditingCampaignNoteEntry(entry); }, editLabel: 'La mia nota' });
                                        }}
                                        role="button"
                                        title="Apri descrizione"
                                    >
                                        <div className="np-gloss-entry-dot"
                                            style={{ background: CAT_COLORS[entry.category as NoteContextEntry['category']], '--dot-color': CAT_COLORS[entry.category as NoteContextEntry['category']] } as React.CSSProperties} />
                                        <div className="np-gloss-entry-body">
                                            <div className="np-gloss-term">
                                                {entry.term}
                                                <span className="np-gloss-cat-badge"
                                                    style={{ '--cat-c': CAT_COLORS[entry.category as NoteContextEntry['category']] } as React.CSSProperties}>
                                                    {CAT_LABELS[entry.category as NoteContextEntry['category']]}
                                                </span>
                                            </div>
                                            {previewInfo && <div className="np-gloss-info np-gloss-info-clamp">{previewInfo}{previewInfo.length >= 80 ? '…' : ''}</div>}
                                            {currentNote && (
                                                <div className="np-gloss-note-indicator" onClick={e => e.stopPropagation()}>
                                                    <span className="np-gloss-note-dot" />
                                                    <span className="np-gloss-note-preview">{currentNote.slice(0, 60)}{currentNote.length > 60 ? '…' : ''}</span>
                                                    <button className="wn-icon-btn" onClick={() => setEditingCampaignNoteEntry(entry)} title="Modifica nota"><FaEdit size={8} /></button>
                                                </div>
                                            )}
                                            {!currentNote && (
                                                <div className="np-gloss-note-indicator np-gloss-note-empty-inline" onClick={e => e.stopPropagation()}>
                                                    <span className="np-gloss-note-empty-text">Nessuna nota personale</span>
                                                    <button className="wn-icon-btn" onClick={() => setEditingCampaignNoteEntry(entry)} title="Aggiungi nota"><FaEdit size={8} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        }

                        {campaignEntries.length > 0 && (campaignGlossSearch || campaignGlossCatFilter !== 'all') &&
                            campaignEntries.filter(entry => {
                                if (campaignGlossCatFilter !== 'all' && entry.category !== campaignGlossCatFilter) return false;
                                if (campaignGlossSearch.trim()) {
                                    const q = campaignGlossSearch.toLowerCase();
                                    const infoText = (entry.sections ?? []).map(s => `${s.label} ${s.content}`).join(' ') || entry.info || '';
                                    return entry.term.toLowerCase().includes(q) || infoText.toLowerCase().includes(q);
                                }
                                return true;
                            }).length === 0 && (
                                <div className="np-gloss-empty">
                                    <FaSearch size={16} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 6 }} />
                                    <p>Nessun risultato per "{campaignGlossSearch || CAT_LABELS[campaignGlossCatFilter as NoteContextEntry['category']]}"</p>
                                </div>
                            )
                        }
                    </div>
                )}
            </div>

            {/* ── Right: Notes editor ── */}
            <div className="np-editor-panel">

                {/* Tab bar */}
                <div className="wn-tabs">
                    <div className="wn-tabs-scroll">
                        {tabs.map(tab => (
                            <div key={tab.id}
                                className={`wn-tab ${tab.id === activeTabId ? 'active' : ''}`}
                                onClick={() => setActiveTabId(tab.id)}
                                onDoubleClick={() => { setRenamingId(tab.id); setRenameVal(tab.name); }}
                                title="Doppio click per rinominare">
                                {renamingId === tab.id ? (
                                    <input className="wn-tab-ri" value={renameVal} autoFocus
                                        onChange={e => setRenameVal(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') commitRename();
                                            if (e.key === 'Escape') setRenamingId(null);
                                        }}
                                        onClick={e => e.stopPropagation()} />
                                ) : (
                                    <>
                                        <span className="wn-tab-nm">{tab.name}</span>
                                        {tabs.length > 1 && (
                                            <button className="wn-tab-x"
                                                onClick={e => { e.stopPropagation(); deleteTab(tab.id); }}
                                                aria-label="Chiudi tab"><FaTimes size={7} /></button>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <button className="wn-tab-add" onClick={addTab} title="Nuova tab"><FaPlus size={9} /></button>
                </div>

                {/* Toolbar */}
                <div className="wn-toolbar">
                    <button className={`wn-tbtn ${searchOpen ? 'on' : ''}`}
                        onClick={() => setSearchOpen(v => !v)} title="Cerca">
                        <FaSearch size={11} />
                    </button>

                    {!preview && selText && !ctxEntries.some((e: NoteContextEntry) => e.term.toLowerCase() === selText.toLowerCase()) && (
                        <button className="wn-tbtn accent" onClick={() => setTagModal(selText)}
                            title={`Aggiungi "${selText}" al glossario`}>
                            <FaTag size={10} />
                            <span className="wn-tbtn-lbl">Tagga</span>
                        </button>
                    )}

                    <div className="wn-tb-spacer" />

                    <button className={`wn-tbtn ${preview ? 'on' : ''}`}
                        onClick={() => setPreview(v => !v)}
                        title={preview ? 'Torna in modifica' : 'Anteprima con glossario'}>
                        {preview ? <FaEdit size={11} /> : <FaEye size={11} />}
                    </button>
                </div>

                {/* Search bar */}
                {searchOpen && (
                    <div className="wn-search">
                        <FaSearch size={10} className="wn-search-ico" />
                        <input className="wn-search-inp" placeholder="Cerca nelle note…"
                            value={searchQ} onChange={e => setSearchQ(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') goNext(); if (e.key === 'Escape') setSearchOpen(false); }}
                            autoFocus />
                        {searchQ && (
                            <span className={`wn-match-cnt ${matchCount === 0 ? 'zero' : ''}`}>
                                {matchCount === 0 ? '0' : `${curMatch + 1}/${matchCount}`}
                            </span>
                        )}
                        <button className="wn-nav-btn" onClick={goPrev} disabled={matchCount === 0} title="Precedente"><FaChevronUp size={9} /></button>
                        <button className="wn-nav-btn" onClick={goNext} disabled={matchCount === 0} title="Successivo"><FaChevronDown size={9} /></button>
                        <button className="wn-nav-btn" onClick={() => setSearchOpen(false)}><FaTimes size={9} /></button>
                    </div>
                )}

                {/* Body */}
                <div className="np-editor-body">
                    {preview ? (
                        <div ref={previewRef} className="wn-preview"
                            onMouseOver={handlePreviewOver}
                            onMouseLeave={handleEditorMouseLeave}
                            dangerouslySetInnerHTML={{ __html: hlResult.html || '<span class="wn-ph">Vergate qui le vostre cronache della sessione…</span>' }}
                        />
                    ) : (
                        <div className="wn-mwrap" onMouseLeave={handleEditorMouseLeave}>
                            <div ref={mirrorRef} className="wn-mirror"
                                onMouseOver={handleMirrorOver}
                                dangerouslySetInnerHTML={{ __html: hlResult.html }} />
                            <textarea
                                ref={textareaRef}
                                className="wn-ta"
                                value={content}
                                onChange={e => { handleChange(e.target.value); updateAutocomplete(e.target); }}
                                onScroll={syncScroll}
                                onMouseUp={handleMouseUp}
                                onClick={e => updateAutocomplete(e.currentTarget)}
                                onKeyUp={e => { handleMouseUp(); updateAutocomplete(e.currentTarget); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Vergate qui le vostre cronache della sessione…"
                                spellCheck={false}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                            />

                            {acSuggestions.length > 0 && acPos && (
                                <div className="wn-ac-dropdown"
                                    style={{ position: 'absolute', left: acPos.x, top: acPos.y, zIndex: 4 }}
                                    onMouseDown={e => e.preventDefault()}>
                                    {acSuggestions.map((e, i) => (
                                        <button key={e.id}
                                            className={`wn-ac-item ${i === acIdx ? 'active' : ''}`}
                                            style={{ '--cat-c': CAT_COLORS[e.category] } as React.CSSProperties}
                                            onMouseDown={() => acceptSuggestion(e)}>
                                            <span className="wn-ac-cat">{CAT_LABELS[e.category]}</span>
                                            <span>{e.term}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tooltip portal */}
            {tooltip && createPortal(
                <div className="wn-ctx-tip" tabIndex={0} onMouseEnter={e => { clearTooltipClose(); e.currentTarget.focus(); }} onMouseLeave={() => scheduleTooltipClose(160)} style={{
                    position: 'fixed', left: tooltip.x, top: tooltip.y,
                    transform: `${tooltip.align === 'center' ? 'translateX(-50%)' : tooltip.align === 'end' ? 'translateX(-100%)' : 'translateX(0)'} ${tooltip.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)'}`,
                    maxHeight: `${tooltip.maxHeight}px`,
                    '--cat-c': CAT_COLORS[tooltip.entry.category ?? 'other'],
                } as React.CSSProperties}>
                    <div className="wn-ctx-tip-hdr">
                        <span className="wn-ctx-tip-cat">{CAT_LABELS[tooltip.entry.category ?? 'other']}</span>
                        <span className="wn-ctx-tip-term">{tooltip.entry.term}</span>
                    </div>
                    {tooltip.entry.info && <div className="wn-ctx-tip-body">{tooltip.entry.info}</div>}
                </div>,
                document.body,
            )}

            {/* Tag modal */}
            {tagModal !== null && (
                <TagModal
                    initialTerm={tagModal}
                    onSave={(term, info, category) => {
                        addNoteContextEntry({ id: uuidv4(), term, info, category });
                        setTagModal(null);
                        setSelText('');
                    }}
                    onClose={() => setTagModal(null)}
                />
            )}

            {glossModal && (
                <GlossaryDetailsModal
                    entry={glossModal}
                    onEdit={glossModal.onEdit}
                    editLabel={glossModal.editLabel}
                    onClose={() => setGlossModal(null)}
                />
            )}

            {editState && (
                <GlossaryEditModal
                    entry={editState.entry}
                    isNew={editState.isNew}
                    onSave={(saved) => {
                        if (saved.term.trim()) {
                            if (editState.isNew) addNoteContextEntry(saved);
                            else updateNoteContextEntry(saved);
                        }
                        setEditState(null);
                    }}
                    onCancel={() => setEditState(null)}
                />
            )}

            {editingCampaignNoteEntry && character?.campaignId && (
                <PersonalNoteEditModal
                    entryTerm={editingCampaignNoteEntry.term}
                    initialNote={character.playerGlossaryNotes?.[`${character.campaignId}::${editingCampaignNoteEntry.id}`] ?? ''}
                    onSave={(note) => {
                        const { setPlayerGlossaryNote } = useCharacterStore.getState();
                        setPlayerGlossaryNote(character.campaignId!, editingCampaignNoteEntry.id, note);
                        const updated = useCharacterStore.getState().character;
                        if (updated) saveCharacterToDb(updated);
                        setEditingCampaignNoteEntry(null);
                    }}
                    onCancel={() => setEditingCampaignNoteEntry(null)}
                />
            )}
        </div>
    );
};
