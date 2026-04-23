import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GiSpellBook, GiCrystalBall, GiNightSleep } from 'react-icons/gi';
import { FaInfoCircle } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import type { Spell } from '../../../types/dnd';

const LEVEL_LABEL = (lvl: number, narrow: boolean) =>
    narrow
        ? (lvl === 0 ? 'Trucch.' : `Lv ${lvl}`)
        : (lvl === 0 ? 'Trucchetti' : `Livello ${lvl}`);

// Popover with rich spell details, anchored to a DOM element via fixed positioning.
const SpellInfoPopover: React.FC<{ spell: Spell; anchor: HTMLElement; onClose: () => void }> = ({ spell, anchor, onClose }) => {
    const [pos, setPos] = useState<{ top: number; left: number }>(() => {
        const r = anchor.getBoundingClientRect();
        return { top: r.bottom + 6, left: r.left };
    });
    useEffect(() => {
        const update = () => {
            const r = anchor.getBoundingClientRect();
            const W = 280;
            let left = r.left;
            if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8);
            let top = r.bottom + 6;
            // If overflow bottom, flip above.
            if (top + 200 > window.innerHeight) top = Math.max(8, r.top - 200 - 6);
            setPos({ top, left });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [anchor, onClose]);

    const stats: [string, string | undefined][] = [
        ['Scuola', spell.school],
        ['Tempo lancio', spell.castingTime],
        ['Gittata', spell.range],
        ['Durata', spell.duration],
        ['Tiro salv.', spell.savingThrow],
        ['Componenti', spell.components],
    ];

    return createPortal(
        <>
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, zIndex: 9998, background: 'transparent',
            }} />
            <div role="dialog" style={{
                position: 'fixed', top: pos.top, left: pos.left, width: 280, zIndex: 9999,
                background: 'linear-gradient(160deg, rgba(40,30,55,0.98), rgba(20,20,30,0.98))',
                border: '1px solid var(--accent-arcane)',
                borderRadius: 8, padding: '10px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(155,89,182,0.2)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem', lineHeight: 1.4,
            }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(155,89,182,0.25)' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: 'var(--accent-arcane)', flex: 1 }}>{spell.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {spell.level === 0 ? 'Trucchetto' : `Liv. ${spell.level}`}
                    </span>
                </div>
                {spell.description && (
                    <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: '0.74rem', maxHeight: 120, overflow: 'auto' }}>
                        {spell.description}
                    </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {stats.filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 6px', borderRadius: 4 }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{v}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>,
        document.body
    );
};

export const SpellSlotsWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const {
        character, setSpellSlotTotal,
        prepareWizardSpell, unprepareWizardSpell,
        castPreparedSpell, restorePreparedSpell, restWizardSpells,
    } = useCharacterStore();
    const [pickerLvl, setPickerLvl] = useState<number | null>(null);
    const [editLvl, setEditLvl] = useState<number | null>(null);
    const [infoSpell, setInfoSpell] = useState<{ spell: Spell; anchor: HTMLElement } | null>(null);

    if (!character) return null;
    const slots = character.spellSlots ?? {};
    const prep = character.preparedSpellsByLevel ?? {};
    const spells = character.spells ?? [];
    const narrow = size.pixelW < 240;
    const veryNarrow = size.pixelW < 180;

    const levels = useMemo(() => {
        const set = new Set<number>();
        Object.entries(slots).forEach(([k, v]) => { if (v.total > 0) set.add(parseInt(k, 10)); });
        Object.entries(prep).forEach(([k, v]) => { if (v.length) set.add(parseInt(k, 10)); });
        if (set.size === 0) [0, 1].forEach(l => set.add(l));
        return Array.from(set).sort((a, b) => a - b);
    }, [slots, prep]);

    const spellById = useMemo(() => {
        const m = new Map<string, typeof spells[number]>();
        spells.forEach(s => m.set(s.id, s));
        return m;
    }, [spells]);

    return (
        <div className="w-spell-root">
            <div className="w-spell-header">
                <span className="w-spell-header-title">
                    <GiSpellBook /> {narrow ? 'Mago' : 'Preparazione mago'}
                </span>
                <button className="w-spell-rest" onClick={restWizardSpells} title="Riposo (8 ore): ripristina tutti gli incantesimi preparati">
                    <GiNightSleep /> {veryNarrow ? '' : 'Riposo'}
                </button>
                {goTo && !veryNarrow && <button className="w-link" onClick={() => goTo('spells')}>Libro →</button>}
            </div>

            <div className="w-spell-levels w-scroll">
                {levels.map(lvl => {
                    const key = String(lvl);
                    const slot = slots[key] ?? { total: 0, used: 0 };
                    const list = prep[key] ?? [];
                    const remaining = slot.total - slot.used;
                    const slotsExhausted = slot.total > 0 && remaining <= 0;
                    const editing = editLvl === lvl;
                    const availableSpells = spells.filter(s => s.level === lvl);

                    return (
                        <section key={lvl} className="w-spell-section" data-level={lvl}>
                            <header className="w-spell-section-head">
                                <span className="w-spell-lv-badge">{lvl}</span>
                                <span className="w-spell-lv-name">{LEVEL_LABEL(lvl, narrow)}</span>
                                <div
                                    className="w-spell-slot-counter"
                                    onClick={() => setEditLvl(editing ? null : lvl)}
                                    title="Click per modificare gli slot totali"
                                >
                                    {editing ? (
                                        <input
                                            type="number" min={0} className="input w-spell-slot-input"
                                            defaultValue={slot.total} autoFocus
                                            onClick={e => e.stopPropagation()}
                                            onBlur={e => { setSpellSlotTotal(lvl, Math.max(0, parseInt(e.target.value) || 0)); setEditLvl(null); }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { setSpellSlotTotal(lvl, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0)); setEditLvl(null); }
                                                if (e.key === 'Escape') setEditLvl(null);
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <span className={`w-spell-slot-rem ${slotsExhausted ? 'spent' : ''}`}>{remaining}</span>
                                            <span className="w-spell-slot-sep">/</span>
                                            <span className="w-spell-slot-tot">{slot.total}</span>
                                            {!narrow && <span className="w-spell-slot-lbl">slot</span>}
                                        </>
                                    )}
                                </div>
                                <button
                                    className="w-spell-add"
                                    onClick={() => setPickerLvl(pickerLvl === lvl ? null : lvl)}
                                    disabled={availableSpells.length === 0}
                                    title={availableSpells.length === 0 ? 'Aggiungi incantesimi al libro per prepararli' : 'Prepara un incantesimo'}
                                >+ {narrow ? '' : 'Prepara'}</button>
                            </header>

                            {pickerLvl === lvl && (
                                <div className="w-spell-picker">
                                    {availableSpells.length === 0 ? (
                                        <div className="w-empty">Nessun incantesimo di livello {lvl} nel libro.</div>
                                    ) : (
                                        <div className="w-spell-picker-grid">
                                            {availableSpells.map(s => (
                                                <button
                                                    key={s.id} className="w-spell-picker-item"
                                                    onClick={() => prepareWizardSpell(lvl, s.id)}
                                                    title={s.description}
                                                >
                                                    <GiCrystalBall /> {s.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button className="w-spell-picker-close" onClick={() => setPickerLvl(null)}>Fine</button>
                                </div>
                            )}

                            {list.length === 0 ? (
                                <div className="w-spell-empty">Nessun incantesimo preparato</div>
                            ) : (
                                <div className="w-spell-prep-grid">
                                    {list.map(p => {
                                        const s = spellById.get(p.spellId);
                                        if (!s) return null;
                                        return (
                                            <div key={p.id} className={`w-spell-prep ${p.cast ? 'is-cast' : ''}`}>
                                                <button
                                                    className="w-spell-prep-main"
                                                    onClick={() => p.cast ? restorePreparedSpell(lvl, p.id) : castPreparedSpell(lvl, p.id)}
                                                    title={p.cast ? 'Ripristina (annulla lancio)' : 'Lancia incantesimo'}
                                                >
                                                    <span className="w-spell-prep-check">{p.cast ? '✓' : ''}</span>
                                                    <span className="w-spell-prep-name">{s.name}</span>
                                                    {s.school && <span className="w-spell-prep-school">{s.school.slice(0, 3)}</span>}
                                                </button>
                                                <button
                                                    className="w-spell-prep-info"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInfoSpell({ spell: s, anchor: e.currentTarget });
                                                    }}
                                                    title={s.description || 'Dettagli incantesimo'}
                                                    aria-label="Dettagli incantesimo"
                                                >
                                                    <FaInfoCircle size={11} />
                                                </button>
                                                <button
                                                    className="w-spell-prep-x"
                                                    onClick={() => unprepareWizardSpell(lvl, p.id)}
                                                    title="Rimuovi preparazione"
                                                >×</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
            {infoSpell && (
                <SpellInfoPopover
                    spell={infoSpell.spell}
                    anchor={infoSpell.anchor}
                    onClose={() => setInfoSpell(null)}
                />
            )}
        </div>
    );
};
