import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../../../store/characterStore';
import { saveCharacterToDb } from '../../../services/db';
import { subscribePlayerCampaignGlossary } from '../../../services/campaign';
import type { WidgetRenderProps } from '../widgetTypes';
import {
    FaPlus, FaTimes, FaSearch, FaChevronUp, FaChevronDown,
    FaBook, FaTag, FaEye, FaEdit, FaTrash, FaUser, FaGlobe,
} from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import type { NoteContextEntry, NoteTab } from '../../../types/dnd';
import type { CampaignGlossaryEntry } from '../../../types/campaign';
import {
    type GlossaryHoverEntry, CAT_COLORS, CAT_LABELS, ALL_CATS,
    type TooltipPlacement, type TooltipAlign,
    getTooltipAnchorFromRect, getCaretCoords, buildHighlightHtml,
    TagModal, GlossaryDetailsModal, GlossaryEditModal, PersonalNoteEditModal,
} from '../../notes/notesShared';





// ─── NotesWidget ──────────────────────────────────────────────────────────────

export const NotesWidget: React.FC<WidgetRenderProps> = () => {
    const {
        character,
        setNoteTabs,
        addNoteContextEntry,
        updateNoteContextEntry,
        removeNoteContextEntry,
    } = useCharacterStore();

    const rawTabs = character?.noteTabs;
    const ctxEntries = useMemo(() => character?.noteContext ?? [], [character?.noteContext]);
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

    // Tabs – migrate from quickNotes if needed
    const tabs: NoteTab[] = useMemo(() => {
        if (rawTabs && rawTabs.length > 0) return rawTabs;
        const legacy = character?.quickNotes ?? '';
        return [{ id: 'tab-legacy', name: 'Note', content: legacy }];
    }, [rawTabs, character?.quickNotes]);

    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    useEffect(() => {
        if (tabs.length === 0) return;
        if (!activeTabId || !tabs.find(t => t.id === activeTabId)) {
            setActiveTabId(tabs[0].id);
        }
    }, [tabs, activeTabId]);

    const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

    // ── Persist ──
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistTabs = useCallback((newTabs: NoteTab[]) => {
        setNoteTabs(newTabs);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const char = useCharacterStore.getState().character;
            if (char) saveCharacterToDb(char);
        }, 1500);
    }, [setNoteTabs]);

    // ── Content change ──
    const handleChange = useCallback((value: string) => {
        const newTabs = tabs.map(t => t.id === activeTabId ? { ...t, content: value } : t);
        persistTabs(newTabs);
    }, [tabs, activeTabId, persistTabs]);

    // ── Tab management ──
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

    // ── Search ──
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [curMatch, setCurMatch] = useState(0);
    const [matchCount, setMatchCount] = useState(0);
    const [glossSearch, setGlossSearch] = useState('');
    const [glossSection, setGlossSection] = useState<'personal' | 'campaign'>('personal');
    const [glossCatFilter, setGlossCatFilter] = useState<NoteContextEntry['category'] | 'all'>('all');

    useEffect(() => { if (!searchOpen) setSearchQ(''); }, [searchOpen]);
    useEffect(() => { setCurMatch(0); }, [searchQ, activeTabId]);

    const goPrev = () => setCurMatch(i => matchCount === 0 ? 0 : (i - 1 + matchCount) % matchCount);
    const goNext = () => setCurMatch(i => matchCount === 0 ? 0 : (i + 1) % matchCount);

    const filteredPersonalEntries = useMemo(() => {
        const query = glossSearch.trim().toLowerCase();
        return ctxEntries.filter((entry: NoteContextEntry) => {
            if (glossCatFilter !== 'all' && entry.category !== glossCatFilter) return false;
            if (!query) return true;
            return entry.term.toLowerCase().includes(query) || entry.info.toLowerCase().includes(query);
        });
    }, [ctxEntries, glossSearch, glossCatFilter]);

    const filteredCampaignEntries = useMemo(() => {
        const query = glossSearch.trim().toLowerCase();
        return campaignEntries.filter(entry => {
            if (glossCatFilter !== 'all' && entry.category !== glossCatFilter) return false;
            if (!query) return true;
            if (entry.term.toLowerCase().includes(query)) return true;
            if ((entry.info ?? '').toLowerCase().includes(query)) return true;
            return (entry.sections ?? []).some(sec =>
                sec.label.toLowerCase().includes(query)
                || sec.content.toLowerCase().includes(query),
            );
        });
    }, [campaignEntries, glossSearch, glossCatFilter]);

    // ── Glossario panel ──
    const [glossOpen, setGlossOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<NoteContextEntry | null>(null);
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [editingCampaignNoteEntry, setEditingCampaignNoteEntry] = useState<CampaignGlossaryEntry | null>(null);

    // ── Tag (selection → add context) ──
    const [tagModal, setTagModal] = useState<string | null>(null);
    const [glossModal, setGlossModal] = useState<(GlossaryHoverEntry & { onEdit?: () => void; editLabel?: string }) | null>(null);
    const [selText, setSelText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        setSelText(ta.value.slice(ta.selectionStart, ta.selectionEnd).trim());
    };

    // ── Autocomplete ──────────────────────────────────────────────────────────
    const [acSuggestions, setAcSuggestions] = useState<NoteContextEntry[]>([]);
    const [acWord, setAcWord] = useState('');
    const [acPos, setAcPos] = useState<{ x: number; y: number } | null>(null);
    const [acIdx, setAcIdx] = useState(0);

    const updateAutocomplete = useCallback((ta: HTMLTextAreaElement) => {
        if (allGlossaryEntries.length === 0) { setAcSuggestions([]); return; }
        const before = ta.value.slice(0, ta.selectionStart);
        // match last word-like token at cursor (letters, accented chars, apostrophe, dash)
        const m = before.match(/[\wàáâãäåæçèéêëìíîïðñòóôõöùúûüýÿ'\-]{2,}$/i);
        const word = m ? m[0] : '';
        if (word.length >= 2) {
            const sugg = allGlossaryEntries
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

    // ── Hover tooltip via mirror marks (mirror is z-index 2, marks have pointer-events: auto) ──
    const handleMirrorOver = (e: React.MouseEvent<HTMLDivElement>) => {
        const marked = (e.target as HTMLElement).closest('[data-ctx-id]') as HTMLElement | null;
        if (!marked) return;
        const entry = allGlossaryEntries.find(c => c.id === marked.dataset.ctxId);
        if (!entry) return;
        clearTooltipClose();
        const p = getTooltipAnchorFromRect(marked.getBoundingClientRect());
        setTooltip({ entry, x: p.x, y: p.y, placement: p.placement, maxHeight: p.maxHeight, align: p.align });
    };

    const handleMirrorOut = () => { }; // handled by global pointermove below

    // ── Preview tooltip ──
    const handlePreviewOver = (e: React.MouseEvent<HTMLDivElement>) => {
        const marked = (e.target as HTMLElement).closest('[data-ctx-id]') as HTMLElement | null;
        if (!marked) return;
        const entry = allGlossaryEntries.find(c => c.id === marked.dataset.ctxId);
        if (!entry) return;
        clearTooltipClose();
        const p = getTooltipAnchorFromRect(marked.getBoundingClientRect());
        setTooltip({ entry, x: p.x, y: p.y, placement: p.placement, maxHeight: p.maxHeight, align: p.align });
    };

    const handlePreviewOut = () => { }; // handled by global pointermove below

    // ── Preview mode ──
    const [preview, setPreview] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    // ── Highlight result ──
    const hlResult = useMemo(
        () => buildHighlightHtml(activeTab?.content ?? '', allGlossaryEntries, searchQ, curMatch),
        [activeTab?.content, allGlossaryEntries, searchQ, curMatch],
    );

    useEffect(() => {
        const n = hlResult.matchCount;
        setMatchCount(n);
        setCurMatch(prev => n === 0 ? 0 : Math.min(prev, n - 1));
    }, [hlResult.matchCount]);

    // Scroll mirror in sync with textarea
    const syncScroll = () => {
        if (!textareaRef.current || !mirrorRef.current) return;
        mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
    };

    // In edit mode: select match in textarea on navigation
    useEffect(() => {
        if (preview || !textareaRef.current) return;
        const mp = hlResult.matchPositions[curMatch];
        if (!mp) return;
        const ta = textareaRef.current;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(mp.start, mp.end);
    }, [curMatch, preview, hlResult.matchPositions]);

    // In preview mode: scroll to current match
    useEffect(() => {
        if (!preview || !previewRef.current) return;
        const cur = previewRef.current.querySelector<HTMLElement>('.srch-cur');
        if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [curMatch, preview]);

    // ── Tooltip (shared edit + preview) ──────────────────────────────────────
    const [tooltip, setTooltip] = useState<{ entry: GlossaryHoverEntry; x: number; y: number; placement: TooltipPlacement; maxHeight: number; align: TooltipAlign } | null>(null);
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

    // ── Close tooltip when mouse leaves the mark (global, active only while tooltip is shown) ──
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



    const content = activeTab?.content ?? '';

    return (
        <div className="wn-root">

            {/* ── Tab bar ── */}
            <div className="wn-tabs">
                <div className="wn-tabs-scroll">
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className={`wn-tab ${tab.id === activeTabId ? 'active' : ''}`}
                            onClick={() => setActiveTabId(tab.id)}
                            onDoubleClick={() => { setRenamingId(tab.id); setRenameVal(tab.name); }}
                            title="Doppio click per rinominare"
                        >
                            {renamingId === tab.id ? (
                                <input
                                    className="wn-tab-ri"
                                    value={renameVal}
                                    autoFocus
                                    onChange={e => setRenameVal(e.target.value)}
                                    onBlur={commitRename}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') commitRename();
                                        if (e.key === 'Escape') setRenamingId(null);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <>
                                    <span className="wn-tab-nm">{tab.name}</span>
                                    {tabs.length > 1 && (
                                        <button
                                            className="wn-tab-x"
                                            onClick={e => { e.stopPropagation(); deleteTab(tab.id); }}
                                            aria-label="Chiudi tab"
                                        ><FaTimes size={7} /></button>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <button className="wn-tab-add" onClick={addTab} title="Nuova tab"><FaPlus size={9} /></button>
            </div>

            {/* ── Toolbar ── */}
            <div className="wn-toolbar">
                <button
                    className={`wn-tbtn ${searchOpen ? 'on' : ''}`}
                    onClick={() => setSearchOpen(v => !v)}
                    title="Cerca"
                ><FaSearch size={11} /></button>

                <button
                    className={`wn-tbtn ${glossOpen ? 'on' : ''}`}
                    onClick={() => setGlossOpen(v => !v)}
                    title="Glossario"
                >
                    <FaBook size={11} />
                    {allGlossaryEntries.length > 0 && <span className="wn-badge">{allGlossaryEntries.length}</span>}
                </button>

                {!preview && selText && !ctxEntries.some((e: NoteContextEntry) => e.term.toLowerCase() === selText.toLowerCase()) && (
                    <button
                        className="wn-tbtn accent"
                        onClick={() => setTagModal(selText)}
                        title={`Aggiungi "${selText}" al glossario`}
                    >
                        <FaTag size={10} />
                        <span className="wn-tbtn-lbl">Tagga</span>
                    </button>
                )}

                <div className="wn-tb-spacer" />

                <button
                    className={`wn-tbtn ${preview ? 'on' : ''}`}
                    onClick={() => setPreview(v => !v)}
                    title={preview ? 'Torna in modifica' : 'Anteprima con glossario'}
                >{preview ? <FaEdit size={11} /> : <FaEye size={11} />}</button>
            </div>

            {/* ── Search bar ── */}
            {searchOpen && (
                <div className="wn-search">
                    <FaSearch size={10} className="wn-search-ico" />
                    <input
                        className="wn-search-inp"
                        placeholder="Cerca nelle note…"
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') goNext(); if (e.key === 'Escape') setSearchOpen(false); }}
                        autoFocus
                    />
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

            {/* ── Body ── */}
            <div className={`wn-body ${glossOpen ? 'with-gloss' : ''}`}>

                {/* Editor / Preview */}
                <div className="wn-editor">
                    {preview ? (
                        <div
                            ref={previewRef}
                            className="wn-preview"
                            onMouseOver={handlePreviewOver}
                            onMouseOut={handlePreviewOut}
                            onMouseLeave={handleEditorMouseLeave}
                            dangerouslySetInnerHTML={{ __html: hlResult.html || '<span class="wn-ph">Vergate qui le vostre cronache della sessione…</span>' }}
                        />
                    ) : (
                        <div
                            ref={wrapRef}
                            className="wn-mwrap"
                            onMouseLeave={handleEditorMouseLeave}
                        >
                            <div
                                ref={mirrorRef}
                                className="wn-mirror"
                                onMouseOver={handleMirrorOver}
                                onMouseOut={handleMirrorOut}
                                dangerouslySetInnerHTML={{ __html: hlResult.html }}
                            />
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
                                <div
                                    className="wn-ac-dropdown"
                                    style={{ position: 'absolute', left: acPos.x, top: acPos.y, zIndex: 4 }}
                                    onMouseDown={e => e.preventDefault()}
                                >
                                    {acSuggestions.map((e, i) => (
                                        <div
                                            key={e.id}
                                            className={`wn-ac-item ${i === acIdx ? 'active' : ''}`}
                                            onMouseDown={() => acceptSuggestion(e)}
                                            onMouseEnter={() => setAcIdx(i)}
                                        >
                                            <span className="wn-ac-dot" style={{ background: CAT_COLORS[e.category] }} />
                                            <span className="wn-ac-word">
                                                <span className="wn-ac-typed">{e.term.slice(0, acWord.length)}</span>
                                                <span className="wn-ac-rest">{e.term.slice(acWord.length)}</span>
                                            </span>
                                            <span className="wn-ac-cat">{CAT_LABELS[e.category]}</span>
                                            {i === acIdx && <span className="wn-ac-hint">Tab ↵</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Glossario panel */}
                {glossOpen && (() => {
                    const hasCampaign = !!character?.campaignId;
                    return (
                        <div className="wn-gloss">
                            {/* Header */}
                            <div className="wn-gloss-hdr">
                                <span>Glossario</span>
                                {glossSection === 'personal' && (
                                    <button
                                        className="wn-icon-btn"
                                        title="Nuova voce"
                                        onClick={() => { setEditingEntry({ id: uuidv4(), term: '', info: '', category: 'other' }); setIsNewEntry(true); }}
                                    ><FaPlus size={10} /></button>
                                )}
                            </div>

                            {/* Section tabs */}
                            {hasCampaign && (
                                <div className="wn-gloss-tabs">
                                    <button
                                        className={`wn-gloss-tab ${glossSection === 'personal' ? 'active' : ''}`}
                                        onClick={() => { setGlossSection('personal'); setGlossCatFilter('all'); }}
                                    >
                                        <FaUser size={9} />
                                        <span>Personale</span>
                                        <span className="wn-gloss-tab-badge">{ctxEntries.length}</span>
                                    </button>
                                    <button
                                        className={`wn-gloss-tab ${glossSection === 'campaign' ? 'active' : ''}`}
                                        onClick={() => { setGlossSection('campaign'); setGlossCatFilter('all'); }}
                                    >
                                        <FaGlobe size={9} />
                                        <span>Campagna</span>
                                        <span className="wn-gloss-tab-badge">{campaignEntries.length}</span>
                                    </button>
                                </div>
                            )}

                            {/* Search */}
                            <div className="wn-gloss-searchbar">
                                <FaSearch size={9} className="wn-gloss-searchbar-ico" />
                                <input
                                    className="wn-gloss-searchbar-inp"
                                    placeholder="Cerca…"
                                    value={glossSearch}
                                    onChange={e => setGlossSearch(e.target.value)}
                                />
                                {glossSearch && (
                                    <button className="wn-icon-btn" onClick={() => setGlossSearch('')} title="Pulisci">
                                        <FaTimes size={8} />
                                    </button>
                                )}
                            </div>

                            {/* Category filters */}
                            <div className="wn-gloss-cat-filters">
                                {(['all', ...ALL_CATS] as const).map(c => (
                                    <button
                                        key={c}
                                        className={`wn-gloss-cat-filter ${glossCatFilter === c ? 'active' : ''}`}
                                        style={{ '--filter-c': c === 'all' ? 'var(--accent-gold, #c9a84c)' : CAT_COLORS[c as NoteContextEntry['category']] } as React.CSSProperties}
                                        onClick={() => setGlossCatFilter(c === glossCatFilter ? 'all' : c)}
                                        title={c === 'all' ? 'Tutte le categorie' : CAT_LABELS[c as NoteContextEntry['category']]}
                                    >
                                        {c === 'all' ? 'Tutti' : CAT_LABELS[c as NoteContextEntry['category']]}
                                    </button>
                                ))}
                            </div>

                            {/* Entry list */}
                            <div className="wn-gloss-list">
                                {/* Personal section */}
                                {glossSection === 'personal' && (
                                    <>
                                        {filteredPersonalEntries.length === 0 && (
                                            <div className="wn-gloss-empty">
                                                {ctxEntries.length === 0
                                                    ? <>Seleziona testo e clicca <strong>Tagga</strong> per aggiungere voci.</>
                                                    : glossSearch
                                                        ? `Nessun risultato per "${glossSearch}".`
                                                        : 'Nessuna voce in questa categoria.'
                                                }
                                            </div>
                                        )}

                                        {filteredPersonalEntries.map((entry: NoteContextEntry) => (
                                            <div
                                                key={entry.id}
                                                className="wn-gloss-entry"
                                                onClick={() => setGlossModal({ ...entry, onEdit: () => { setGlossModal(null); setEditingEntry({ ...entry }); }, editLabel: 'Modifica voce' })}
                                                role="button"
                                                title="Apri descrizione"
                                            >
                                                <>
                                                    <div className="wn-ge-top">
                                                        <span
                                                            className="wn-ge-dot"
                                                            style={{ background: CAT_COLORS[entry.category] }}
                                                            title={CAT_LABELS[entry.category]}
                                                        />
                                                        <span className="wn-ge-term">{entry.term || <em>vuoto</em>}</span>
                                                        <div className="wn-ge-acts">
                                                            <button className="wn-icon-btn" onClick={(e) => { e.stopPropagation(); setEditingEntry({ ...entry }); }} title="Modifica"><FaEdit size={9} /></button>
                                                            <button className="wn-icon-btn danger" onClick={(e) => { e.stopPropagation(); removeNoteContextEntry(entry.id); }} title="Elimina"><FaTrash size={9} /></button>
                                                        </div>
                                                    </div>
                                                    {entry.info && <div className="wn-ge-info">{entry.info}</div>}
                                                </>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Campaign section */}
                                {glossSection === 'campaign' && (
                                    <>
                                        {filteredCampaignEntries.length === 0 && (
                                            <div className="wn-gloss-empty">
                                                {campaignEntries.length === 0
                                                    ? 'Il master non ha ancora condiviso voci.'
                                                    : glossSearch
                                                        ? `Nessun risultato per "${glossSearch}".`
                                                        : 'Nessuna voce in questa categoria.'
                                                }
                                            </div>
                                        )}

                                        {filteredCampaignEntries.map(entry => {
                                            const currentNote = character?.campaignId
                                                ? (character.playerGlossaryNotes?.[`${character.campaignId}::${entry.id}`] ?? '')
                                                : '';

                                            return (
                                                <div
                                                    key={entry.id}
                                                    className="wn-gloss-entry"
                                                    onClick={() => {
                                                        const detail = (entry.sections ?? []).length > 0
                                                            ? entry.sections.map(sec => sec.label ? `${sec.label}\n${sec.content}` : sec.content).join('\n\n')
                                                            : (entry.info || 'Nessuna descrizione disponibile.');
                                                        setGlossModal({ id: `cmp-${entry.id}`, term: entry.term, info: detail, category: entry.category as NoteContextEntry['category'], onEdit: () => { setGlossModal(null); setEditingCampaignNoteEntry(entry); }, editLabel: 'La mia nota' });
                                                    }}
                                                    role="button"
                                                    title="Apri descrizione"
                                                >
                                                    <div className="wn-ge-top">
                                                        <span
                                                            className="wn-ge-dot"
                                                            style={{ background: CAT_COLORS[entry.category as NoteContextEntry['category']] }}
                                                            title={CAT_LABELS[entry.category as NoteContextEntry['category']]}
                                                        />
                                                        <span className="wn-ge-term">{entry.term}</span>
                                                    </div>
                                                    {(entry.sections ?? []).length > 0
                                                        ? entry.sections.map(sec => (
                                                            <div key={sec.id} className="wn-ge-info">
                                                                {sec.label ? `${sec.label}: ${sec.content}` : sec.content}
                                                            </div>
                                                        ))
                                                        : entry.info && <div className="wn-ge-info">{entry.info}</div>
                                                    }
                                                    {/* Personal notes section */}
                                                    <div className="wn-ge-personal-notes" onClick={e => e.stopPropagation()}>
                                                        {currentNote ? (
                                                            <div className="wn-ge-note-display">
                                                                <div className="wn-ge-note-label">📝 Mia nota:</div>
                                                                <div className="wn-ge-note-text">{currentNote}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="wn-ge-note-empty">Nessuna nota personale</div>
                                                        )}
                                                        <button
                                                            className="wn-icon-btn"
                                                            onClick={() => setEditingCampaignNoteEntry(entry)}
                                                            title="Aggiungi/modifica nota"
                                                        ><FaEdit size={9} /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* ── Context tooltip – rendered via Portal to escape parent transform context ── */}
            {tooltip && createPortal(
                <div
                    className="wn-ctx-tip"
                    tabIndex={0}
                    onMouseEnter={e => { clearTooltipClose(); e.currentTarget.focus(); }}
                    onMouseLeave={() => scheduleTooltipClose(160)}
                    style={{
                        position: 'fixed',
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: `${tooltip.align === 'center' ? 'translateX(-50%)' : tooltip.align === 'end' ? 'translateX(-100%)' : 'translateX(0)'} ${tooltip.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)'}`,
                        maxHeight: `${tooltip.maxHeight}px`,
                        '--cat-c': CAT_COLORS[tooltip.entry.category],
                    } as React.CSSProperties}
                >
                    <div className="wn-ctx-tip-hdr">
                        <span className="wn-ctx-tip-cat">{CAT_LABELS[tooltip.entry.category]}</span>
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

            {editingEntry && (
                <GlossaryEditModal
                    entry={editingEntry}
                    isNew={isNewEntry}
                    onSave={(entry) => {
                        if (isNewEntry) addNoteContextEntry(entry);
                        else updateNoteContextEntry(entry);
                        setEditingEntry(null);
                        setIsNewEntry(false);
                    }}
                    onCancel={() => { setEditingEntry(null); setIsNewEntry(false); }}
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

