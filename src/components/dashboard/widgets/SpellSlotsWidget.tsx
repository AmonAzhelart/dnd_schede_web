import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GiSpellBook, GiCrystalBall, GiNightSleep } from 'react-icons/gi';
import { FaInfoCircle, FaTimes } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';
import type { Spell, StatType } from '../../../types/dnd';
import { DndIcon, getDndIconSvg } from '../../DndIcon';
import { RollPickerModal, type RollSegment, type RollBreakdownLine } from '../../RollPickerModal';
import { computeSpellDamageDice } from '../../../services/modifiers';

const SCHOOL_ICON_SLUG: Record<string, string> = {
    'Abiurazione': 'abjuration', 'Ammaliamento': 'enchantment', 'Divinazione': 'divination',
    'Evocazione': 'conjuration', 'Illusione': 'illusion', 'Invocazione': 'evocation',
    'Necromanzia': 'necromancy', 'Trasmutazione': 'transmutation',
};

const TAB_LABEL = (lvl: number): string => lvl === 0 ? 'Tr' : String(lvl);
const SECTION_LABEL = (lvl: number): string => lvl === 0 ? 'Trucchetti' : `Livello ${lvl}`;

/**
 * Modal (auto-becomes a bottom-sheet on narrow viewports) showing full spell details.
 */
const SpellInfoModal: React.FC<{ spell: Spell; onClose: () => void }> = ({ spell, onClose }) => {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 600);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 600);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('resize', onResize);
        window.addEventListener('keydown', onKey);
        // Lock body scroll while modal is open
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const stats: [string, string | undefined][] = [
        ['Scuola', spell.school],
        ['Tempo lancio', spell.castingTime],
        ['Gittata', spell.range],
        ['Durata', spell.duration],
        ['Tiro salv.', spell.savingThrow],
        ['Componenti', spell.components],
    ];

    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
    };
    const dialogStyle: React.CSSProperties = isMobile
        ? {
            width: '100%', maxHeight: '85vh',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            background: 'linear-gradient(160deg, rgba(40,30,55,0.98), rgba(20,20,30,0.98))',
            borderTop: '2px solid var(--accent-arcane)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
        }
        : {
            width: 'min(480px, 100%)', maxHeight: '85vh',
            borderRadius: 12,
            background: 'linear-gradient(160deg, rgba(40,30,55,0.98), rgba(20,20,30,0.98))',
            border: '1px solid var(--accent-arcane)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(155,89,182,0.2)',
            display: 'flex', flexDirection: 'column',
        };

    const schoolSlug = spell.school ? SCHOOL_ICON_SLUG[spell.school] : undefined;

    return createPortal(
        <div onClick={onClose} role="dialog" aria-modal="true" style={overlayStyle}>
            <div onClick={e => e.stopPropagation()} style={dialogStyle}>
                {/* Drag handle for sheet */}
                {isMobile && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
                        <span style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
                    </div>
                )}

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(155,89,182,0.25)',
                }}>
                    {schoolSlug && getDndIconSvg('spell', schoolSlug) && (
                        <DndIcon category="spell" name={schoolSlug} size={22} style={{ color: 'var(--accent-arcane)' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', color: 'var(--accent-arcane)' }}>
                            {spell.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {spell.level === 0 ? 'Trucchetto' : `Livello ${spell.level}`}
                            {spell.school && ` Â· ${spell.school}`}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Chiudi"
                        style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            padding: 6, borderRadius: 4,
                        }}
                    >
                        <FaTimes size={14} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', padding: '12px 16px', flex: 1 }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 6,
                        marginBottom: 12,
                    }}>
                        {stats.filter(([, v]) => v && v.trim()).map(([k, v]) => (
                            <div key={k} style={{
                                background: 'rgba(0,0,0,0.3)',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(155,89,182,0.15)',
                            }}>
                                <div style={{
                                    fontSize: '0.55rem', color: 'var(--text-muted)',
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    marginBottom: 2,
                                }}>{k}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v}</div>
                            </div>
                        ))}
                    </div>

                    {spell.description && (
                        <div>
                            <div style={{
                                fontSize: '0.6rem', color: 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                marginBottom: 4,
                            }}>Descrizione</div>
                            <p style={{
                                margin: 0,
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {spell.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export const SpellSlotsWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const {
        character, setSpellSlotTotal,
        prepareWizardSpell,
        castPreparedSpell, restorePreparedSpell, restWizardSpells,
        getStatModifier, getTotalBab,
    } = useCharacterStore();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [editingSlots, setEditingSlots] = useState(false);
    const [infoSpell, setInfoSpell] = useState<Spell | null>(null);
    const [castPicker, setCastPicker] = useState<{ spell: Spell; lvl: number; prepId: string } | null>(null);
    const [activeLvl, setActiveLvl] = useState<number>(0);

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

    // Ensure activeLvl is always valid
    useEffect(() => {
        if (!levels.includes(activeLvl) && levels.length > 0) {
            setActiveLvl(levels[0]);
        }
    }, [levels, activeLvl]);

    const spellById = useMemo(() => {
        const m = new Map<string, typeof spells[number]>();
        spells.forEach(s => m.set(s.id, s));
        return m;
    }, [spells]);

    const lvl = activeLvl;
    const key = String(lvl);
    const slot = slots[key] ?? { total: 0, used: 0 };
    const list = prep[key] ?? [];
    const remaining = slot.total - slot.used;
    const slotsExhausted = slot.total > 0 && remaining <= 0;
    const availableSpells = spells.filter(s => s.level === lvl);

    return (
        <div className="w-spell-root">
            <div className="w-spell-header">
                <span className="w-spell-header-title">
                    <GiSpellBook /> {narrow ? 'Mago' : 'Preparazione mago'}
                </span>
                <button className="w-spell-rest" onClick={restWizardSpells} title="Riposo (8 ore): ripristina tutti gli incantesimi preparati">
                    <GiNightSleep /> {veryNarrow ? '' : 'Riposo'}
                </button>
                {goTo && !veryNarrow && <button className="w-link" onClick={() => goTo('spells')}>Libro â†’</button>}
            </div>

            {/* Level tabs */}
            <div className="w-spell-tabs" role="tablist">
                {levels.map(l => {
                    const s = slots[String(l)];
                    const p = prep[String(l)] ?? [];
                    const isActive = l === lvl;
                    return (
                        <button
                            key={l}
                            role="tab"
                            aria-selected={isActive}
                            className={`w-spell-tab ${isActive ? 'active' : ''}`}
                            onClick={() => { setActiveLvl(l); setPickerOpen(false); setEditingSlots(false); }}
                            title={SECTION_LABEL(l)}
                        >
                            <span className="w-spell-tab-lv">{TAB_LABEL(l)}</span>
                            {(s?.total ?? 0) > 0 && (
                                <span className="w-spell-tab-slot">{(s.total - s.used)}/{s.total}</span>
                            )}
                            {p.length > 0 && (
                                <span className="w-spell-tab-prep">{p.length}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active level body */}
            <section className="w-spell-section w-scroll" data-level={lvl}>
                <header className="w-spell-section-head">
                    <span className="w-spell-lv-name">{SECTION_LABEL(lvl)}</span>
                    <div
                        className="w-spell-slot-counter"
                        onClick={() => setEditingSlots(e => !e)}
                        title="Click per modificare gli slot totali"
                    >
                        {editingSlots ? (
                            <input
                                type="number" min={0} className="input w-spell-slot-input"
                                defaultValue={slot.total} autoFocus
                                onClick={e => e.stopPropagation()}
                                onBlur={e => { setSpellSlotTotal(lvl, Math.max(0, parseInt(e.target.value) || 0)); setEditingSlots(false); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') { setSpellSlotTotal(lvl, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0)); setEditingSlots(false); }
                                    if (e.key === 'Escape') setEditingSlots(false);
                                }}
                            />
                        ) : (
                            <>
                                <span className={`w-spell-slot-rem ${slotsExhausted ? 'spent' : ''}`}>{remaining}</span>
                                <span className="w-spell-slot-sep">/</span>
                                <span className="w-spell-slot-tot">{slot.total}</span>
                                <span className="w-spell-slot-lbl">slot</span>
                            </>
                        )}
                    </div>
                    <button
                        className="w-spell-add"
                        onClick={() => setPickerOpen(p => !p)}
                        disabled={availableSpells.length === 0}
                        title={availableSpells.length === 0 ? 'Aggiungi incantesimi al libro per prepararli' : 'Prepara un incantesimo'}
                    >+ Prepara</button>
                </header>

                {pickerOpen && (
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
                        <button className="w-spell-picker-close" onClick={() => setPickerOpen(false)}>Fine</button>
                    </div>
                )}

                {list.length === 0 ? (
                    <div className="w-spell-empty">Nessun incantesimo preparato</div>
                ) : (
                    <div className="w-spell-prep-list">
                        {list.map(p => {
                            const s = spellById.get(p.spellId);
                            if (!s) return null;
                            const slug = s.school ? SCHOOL_ICON_SLUG[s.school] : undefined;
                            return (
                                <div key={p.id} className={`w-spell-prep ${p.cast ? 'is-cast' : ''}`}>
                                    <button
                                        className="w-spell-prep-main"
                                        onClick={() => {
                                            if (p.cast) {
                                                restorePreparedSpell(lvl, p.id);
                                            } else {
                                                setCastPicker({ spell: s, lvl, prepId: p.id });
                                            }
                                        }}
                                        title={p.cast ? 'Ripristina (annulla lancio)' : 'Lancia incantesimo (apre il dettaglio dei tiri)'}
                                    >
                                        <span className="w-spell-prep-check">{p.cast ? '✓' : ''}</span>
                                        {slug && getDndIconSvg('spell', slug) && (
                                            <DndIcon category="spell" name={slug} size={14} className="w-spell-prep-school" />
                                        )}
                                        <span className="w-spell-prep-name">{s.name}</span>
                                    </button>
                                    <button
                                        className="w-spell-prep-info"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInfoSpell(s);
                                        }}
                                        title={s.description || 'Dettagli incantesimo'}
                                        aria-label="Dettagli incantesimo"
                                    >
                                        <FaInfoCircle size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {infoSpell && (
                <SpellInfoModal
                    spell={infoSpell}
                    onClose={() => setInfoSpell(null)}
                />
            )}

            {castPicker && (() => {
                const { spell, lvl: castLvl, prepId } = castPicker;
                // Caster level = sum of class levels (fallback to character.level)
                const casterLevel = (character.classLevels?.reduce((s, cl) => s + cl.level, 0) || character.level || 1);
                const segments: RollSegment[] = [];

                // ── Attack segment (touch attacks / rays / normal) ──\n                if (spell.attackMode && spell.attackMode !== 'none') {\n                    const isMelee = spell.attackMode === 'meleeTouch';\n                    const statMod = getStatModifier(isMelee ? 'str' : 'dex');\n                    const bab = getTotalBab();\n                    const breakdown: RollBreakdownLine[] = [\n                        { label: 'BAB', value: bab },\n                        { label: isMelee ? 'Mod. FOR' : 'Mod. DES', value: statMod },\n                    ];\n                    segments.push({\n                        ctx: {\n                            channel: 'spell.attack',\n                            spellId: spell.id,\n                            spellName: spell.name,\n                            spellLevel: spell.level,\n                            spellSchool: spell.school,\n                            spellDamageType: spell.damageType,\n                            attackMode: spell.attackMode,\n                        },\n                        label: spell.attackMode === 'meleeTouch' ? 'Tocco in mischia'\n                            : spell.attackMode === 'rangedTouch' ? 'Tocco a distanza'\n                                : spell.attackMode === 'ray' ? 'Raggio (TxC)'\n                                    : 'Tiro per colpire',\n                        baseBreakdown: breakdown,\n                    });\n                }

                // ── Damage segment (scales with caster level) ──
                if (spell.damagePerLevelDice) {
                    const dice = computeSpellDamageDice(spell, casterLevel);
                    segments.push({
                        ctx: {
                            channel: 'spell.damage',
                            spellId: spell.id,
                            spellName: spell.name,
                            spellLevel: spell.level,
                            spellSchool: spell.school,
                            spellDamageType: spell.damageType,
                            attackMode: spell.attackMode,
                        },
                        label: `Danno${spell.damageType ? ` (${spell.damageType})` : ''} – CL ${casterLevel}`,
                        baseBreakdown: [],
                        baseDice: dice,
                    });
                }

                // ── Save DC segment (when spell has saveStat) ──
                if (spell.saveStat || spell.savingThrow) {
                    const saveStat: StatType = spell.saveStat ?? 'int';
                    const statMod = getStatModifier(saveStat);
                    const breakdown: RollBreakdownLine[] = [
                        { label: 'Base CD', value: 10 },
                        { label: `Liv. magia (${spell.level})`, value: spell.level },
                        { label: `Mod. ${saveStat.toUpperCase()}`, value: statMod },
                    ];
                    segments.push({
                        ctx: {
                            channel: 'spell.dc',
                            spellId: spell.id,
                            spellName: spell.name,
                            spellLevel: spell.level,
                            spellSchool: spell.school,
                            spellDamageType: spell.damageType,
                            attackMode: spell.attackMode,
                        },
                        label: `CD del TS${spell.savingThrow ? ` (${spell.savingThrow})` : ''}`,
                        baseBreakdown: breakdown,
                    });
                }

                // No combat data at all → just open the info modal instead.
                if (segments.length === 0) {
                    setTimeout(() => {
                        castPreparedSpell(castLvl, prepId);
                        setCastPicker(null);
                        setInfoSpell(spell);
                    }, 0);
                    return null;
                }

                return (
                    <RollPickerModal
                        segments={segments}
                        title={spell.name}
                        subtitle={`${spell.level === 0 ? 'Trucchetto' : `Livello ${spell.level}`}${spell.school ? ` · ${spell.school}` : ''} · CL ${casterLevel}`}
                        onConfirm={() => castPreparedSpell(castLvl, prepId)}
                        onClose={() => setCastPicker(null)}
                    />
                );
            })()}
        </div>
    );
};
