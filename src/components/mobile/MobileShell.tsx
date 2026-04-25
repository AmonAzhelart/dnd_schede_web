/* ============================================================================
 * MobileShell ─ Mobile / tablet bottom command bar.
 *
 *   Two stacked rows fixed at the bottom of the viewport:
 *     Row 1 ─ inner sheet tabs (rendered via portal by CharacterSheet,
 *             only visible when the active app tab is "scheda").
 *     Row 2 ─ left stats │ centred avatar (FAB) │ right stats + actions
 *
 *   Tapping the avatar opens an app-level navigation popup so the user can
 *   switch between Scheda / Diario & NPC / Mappe / Back-Office /
 *   Cambia personaggio.
 *
 *   Slots exposed for portals (CharacterSheet.tsx populates these):
 *     #mobile-shell-tabs-slot    — sheet tabs row
 *     #mobile-shell-actions-slot — header action buttons (edit, palette …)
 * ========================================================================== */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCharacterStore } from '../../store/characterStore';
import { FaChevronLeft, FaSignOutAlt } from 'react-icons/fa';
import { useMobileContextActions } from './mobileShellSlots';
import './MobileShell.css';

export type MobileNavItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
};

export type MobileShellProps = {
    appTab: string;
    setAppTab: (id: string) => void;
    navItems: MobileNavItem[];
    onSwitchCharacter: () => void;
    onLogout?: () => void;
};

/** Hook: tracks a CSS media query. */
export const useMediaQuery = (query: string): boolean => {
    const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
    const [matches, setMatches] = useState<boolean>(get);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return matches;
};

export const MobileShell: React.FC<MobileShellProps> = ({
    appTab,
    setAppTab,
    navItems,
    onSwitchCharacter,
    onLogout,
}) => {
    const { character, getEffectiveStat, getStatModifier } = useCharacterStore();
    const contextActions = useMobileContextActions();
    const [navOpen, setNavOpen] = useState(false);
    const popupRef = useRef<HTMLDivElement | null>(null);
    const avatarRef = useRef<HTMLButtonElement | null>(null);

    /* ── Close popup on outside click / esc ─────────────────────────── */
    useEffect(() => {
        if (!navOpen) return;
        const onPointer = (e: PointerEvent) => {
            const t = e.target as Node;
            if (popupRef.current?.contains(t) || avatarRef.current?.contains(t)) return;
            setNavOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [navOpen]);

    /* ── Derived stats (graceful when no character) ─────────────────── */
    const stats = useMemo(() => {
        if (!character) return null;
        const maxHp = character.hpDetails?.max ?? getEffectiveStat('hp');
        const curHp = character.hpDetails?.current ?? character.baseStats.hp;
        const hpPct = Math.max(0, Math.min(100, (curHp / maxHp) * 100));
        const init = getStatModifier('dex');
        return {
            hpCur: curHp,
            hpMax: maxHp,
            hpPct,
            ac: getEffectiveStat('ac'),
            init,
            speed: character.movement?.base ?? character.baseStats.speed ?? 30,
        };
    }, [character, getEffectiveStat, getStatModifier]);

    const initial = (character?.name ?? '?').charAt(0).toUpperCase();
    const showSheetTabs = appTab === 'scheda' && !!character;

    return (
        <>
            <div className="mob-shell" role="region" aria-label="Barra mobile">
                {/* ── Row 1: sheet tabs slot (visible only when on scheda) ── */}
                <div
                    id="mobile-shell-tabs-slot"
                    className={'mob-shell-tabs' + (showSheetTabs ? '' : ' is-empty')}
                />

                {/* ── Row 2: stats + avatar + actions ── */}
                <div className="mob-shell-row">
                    <div className="mob-shell-side mob-shell-side-l">
                        {stats && (
                            <>
                                <button
                                    type="button"
                                    className="mob-shell-stat hp"
                                    onClick={() => setAppTab('scheda')}
                                    title={`Punti vita ${stats.hpCur}/${stats.hpMax}`}
                                >
                                    <span className="mob-shell-stat-lbl">PV</span>
                                    <span className="mob-shell-stat-val">
                                        {stats.hpCur}<span className="sep">/</span>{stats.hpMax}
                                    </span>
                                    <span className="mob-shell-stat-bar" aria-hidden>
                                        <span
                                            className={
                                                'fill ' + (stats.hpPct < 25 ? 'crit' : stats.hpPct < 50 ? 'low' : 'ok')
                                            }
                                            style={{ width: `${stats.hpPct}%` }}
                                        />
                                    </span>
                                </button>
                                <div className="mob-shell-stat ac" title="Classe armatura">
                                    <span className="mob-shell-stat-lbl">CA</span>
                                    <span className="mob-shell-stat-val">{stats.ac}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mob-shell-center">
                        <button
                            ref={avatarRef}
                            type="button"
                            className={'mob-shell-avatar' + (navOpen ? ' is-open' : '') + (character?.avatarUrl ? ' has-image' : '')}
                            onClick={() => setNavOpen(o => !o)}
                            aria-label="Apri menu di navigazione"
                            aria-expanded={navOpen}
                            aria-haspopup="menu"
                        >
                            {character?.avatarUrl ? (
                                <img src={character.avatarUrl} alt="" className="mob-shell-avatar-img" />
                            ) : (
                                <span className="mob-shell-avatar-init">{initial}</span>
                            )}
                            <span className="mob-shell-avatar-ring" aria-hidden />
                        </button>
                        {character && (
                            <span className="mob-shell-name" title={character.name}>{character.name}</span>
                        )}
                    </div>

                    <div className="mob-shell-side mob-shell-side-r">
                        {stats && (
                            <>
                                <div className="mob-shell-stat init" title="Iniziativa">
                                    <span className="mob-shell-stat-lbl">INIZ</span>
                                    <span className="mob-shell-stat-val">
                                        {stats.init >= 0 ? '+' : ''}{stats.init}
                                    </span>
                                </div>
                                <div className="mob-shell-stat speed" title="Velocità">
                                    <span className="mob-shell-stat-lbl">VEL</span>
                                    <span className="mob-shell-stat-val">
                                        {stats.speed}<span className="unit">ft</span>
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Navigation popup ──────────────────────────────────────── */}
            {navOpen && (
                <>
                    <div
                        className="mob-shell-popup-backdrop"
                        onPointerDown={() => setNavOpen(false)}
                        aria-hidden
                    />
                    <div
                        ref={popupRef}
                        className="mob-shell-popup"
                        role="menu"
                        aria-label="Naviga"
                    >
                        <div className="mob-shell-popup-arrow" aria-hidden />
                        {contextActions.length > 0 && (
                            <>
                                <div className="mob-shell-popup-section">Azioni rapide</div>
                                <div className="mob-shell-popup-grid">
                                    {contextActions.map(a => (
                                        <button
                                            key={a.id}
                                            type="button"
                                            role="menuitem"
                                            className={'mob-shell-popup-btn ctx' + (a.active ? ' is-active' : '')}
                                            onClick={() => { a.onClick(); setNavOpen(false); }}
                                        >
                                            <span className="mob-shell-popup-ico">{a.icon}</span>
                                            <span className="mob-shell-popup-lbl">{a.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="mob-shell-popup-divider" />
                            </>
                        )}
                        <div className="mob-shell-popup-section">Naviga</div>
                        <div className="mob-shell-popup-grid">
                            {navItems.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="menuitem"
                                    className={'mob-shell-popup-btn' + (appTab === item.id ? ' is-active' : '')}
                                    onClick={() => { setAppTab(item.id); setNavOpen(false); }}
                                >
                                    <span className="mob-shell-popup-ico">{item.icon}</span>
                                    <span className="mob-shell-popup-lbl">{item.label}</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                role="menuitem"
                                className="mob-shell-popup-btn alt"
                                onClick={() => { onSwitchCharacter(); setNavOpen(false); }}
                            >
                                <span className="mob-shell-popup-ico"><FaChevronLeft size={16} /></span>
                                <span className="mob-shell-popup-lbl">Cambia personaggio</span>
                            </button>
                            {onLogout && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    className="mob-shell-popup-btn danger"
                                    onClick={() => { onLogout(); setNavOpen(false); }}
                                >
                                    <span className="mob-shell-popup-ico"><FaSignOutAlt size={15} /></span>
                                    <span className="mob-shell-popup-lbl">Logout</span>
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default MobileShell;
