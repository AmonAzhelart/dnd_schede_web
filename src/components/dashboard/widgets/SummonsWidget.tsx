import React, { useState } from 'react';
import { FaDragon, FaTimes, FaSkull } from 'react-icons/fa';
import { GiScrollUnfurled } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import { CreaturePortrait, computeEffectiveCreatureStats } from '../../CreatureStatBlock';
import { CreaturePopup } from '../../CreaturePopup';
import type { ActiveSummon, ActivePet, CreatureStatOverride } from '../../../types/dnd';
import type { WidgetRenderProps } from '../widgetTypes';

/* --- helpers -------------------------------------------------------- */
const hpColor = (pct: number) =>
    pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f0c040' : pct > 0 ? '#e67e22' : '#636e72';

/* --- mini card ------------------------------------------------------- */
interface CardProps {
    creature: ActiveSummon['creature'];
    label: string;
    sublabel?: string;
    currentHp: number;
    maxHp: number;
    roundsRemaining?: number | null;
    overrides: CreatureStatOverride[];
    onOpen: () => void;
    onHpDelta: (d: number) => void;
    onRemove: () => void;
    onRoundDecrement?: () => void;
    accentColor: string;
}
const MiniCard: React.FC<CardProps> = ({
    creature, label, sublabel, currentHp, maxHp, roundsRemaining,
    onOpen, onHpDelta, onRemove, onRoundDecrement, accentColor,
}) => {
    const pct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
    const dead = currentHp <= 0;
    const hc = hpColor(pct);

    return (
        <div
            style={{
                display: 'flex', alignItems: 'center', background: 'var(--bg-surface)',
                borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '3px solid ' + (dead ? 'rgba(99,110,114,0.45)' : accentColor),
                opacity: dead ? 0.62 : 1, overflow: 'hidden', cursor: 'pointer',
                height: 44, gap: 0, transition: 'opacity 0.15s',
            }}
            onClick={onOpen} title="Apri scheda completa"
        >
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 7, paddingRight: 6 }}>
                <CreaturePortrait creature={creature} size={30} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, paddingRight: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.82rem', color: dead ? 'var(--text-muted)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>{label}</span>
                    {sublabel && <span style={{ fontSize: '0.58rem', color: accentColor, opacity: 0.85, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct * 100 + '%', background: hc, borderRadius: 3, transition: 'width 0.3s, background 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-heading)', flexShrink: 0, color: dead ? 'var(--text-muted)' : hc, lineHeight: 1 }}>
                        {dead ? <FaSkull style={{ verticalAlign: 'middle' }} /> : currentHp + '/' + maxHp}
                    </span>
                </div>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 9px', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.44rem', color: 'var(--text-muted)', textTransform: 'uppercase', lineHeight: 1 }}>CA</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.92rem', color: 'var(--accent-gold)', lineHeight: 1.3 }}>{creature.ac}</span>
            </div>
            {roundsRemaining != null && (
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 7px', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%', justifyContent: 'center' }} onClick={ev => ev.stopPropagation()}>
                    <button className="btn-ghost" style={{ fontSize: '0.58rem', color: 'var(--accent-gold)', padding: '2px 4px', lineHeight: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }} onClick={onRoundDecrement} title="Decrementa round">
                        <span style={{ fontSize: '0.44rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>time</span>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.82rem', lineHeight: 1 }}>{roundsRemaining}</span>
                    </button>
                </div>
            )}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%' }} onClick={ev => ev.stopPropagation()}>
                <button className="btn-ghost" style={{ flex: 1, padding: '0 9px', fontSize: '0.68rem', color: 'var(--accent-success)', borderBottom: '1px solid rgba(255,255,255,0.06)', borderRadius: 0, lineHeight: 1 }} onClick={() => onHpDelta(1)} title="+1 PF">+1</button>
                <button className="btn-ghost" style={{ flex: 1, padding: '0 9px', fontSize: '0.68rem', color: 'var(--accent-crimson)', borderRadius: 0, lineHeight: 1 }} onClick={() => onHpDelta(-1)} title="-1 PF">-1</button>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 7px', borderLeft: '1px solid rgba(255,255,255,0.06)', height: '100%' }} onClick={ev => ev.stopPropagation()}>
                <button className="btn-ghost" style={{ padding: '4px 3px', color: 'var(--text-muted)', lineHeight: 1 }} onClick={onRemove} title="Rimuovi"><FaTimes size={9} /></button>
            </div>
        </div>
    );
};

/* =================================================================
   SummonsWidget
================================================================= */
export const SummonsWidget: React.FC<WidgetRenderProps> = ({ goTo }) => {
    const {
        character,
        removeSummon, updateSummonHp, updateSummon,
        updatePetHp, removePet,
        computeSummonOverrides, computePetOverrides,
        addCreatureRuntimeModifier, removeCreatureRuntimeModifier,
    } = useCharacterStore();

    const summons = character?.activeSummons ?? [];
    const pets = character?.activePets ?? [];

    type PopupState = { kind: 'summon'; id: string } | { kind: 'pet'; id: string } | null;
    const [popup, setPopup] = useState<PopupState>(null);

    if (summons.length === 0 && pets.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)' }}>
                <FaDragon style={{ fontSize: 28, opacity: 0.35 }} />
                <span style={{ fontSize: '0.78rem' }}>Nessuna evocazione attiva</span>
                {goTo && <button className="btn-secondary text-xs" onClick={() => goTo('bestiary')}>Apri Bestiario</button>}
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflowY: 'auto', padding: '8px 10px' }}>
                {summons.length > 0 && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                            <div style={{ flex: 1, height: 1, background: 'rgba(155,89,182,0.22)' }} />
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-arcane)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Evocazioni</span>
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-arcane)', background: 'rgba(155,89,182,0.14)', border: '1px solid rgba(155,89,182,0.28)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>{summons.length}</span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(155,89,182,0.22)' }} />
                        </div>
                        {summons.map(s => {
                            const liveOv = computeSummonOverrides(s.creature);
                            const maxHp = computeEffectiveCreatureStats(s.creature, liveOv, s.runtimeModifiers ?? []).hp;
                            return (
                                <MiniCard
                                    key={s.id} creature={s.creature} label={s.creature.name} sublabel={s.summonSpellName}
                                    currentHp={s.currentHp} maxHp={maxHp} roundsRemaining={s.roundsRemaining} overrides={liveOv}
                                    accentColor="var(--accent-arcane)" onOpen={() => setPopup({ kind: 'summon', id: s.id })}
                                    onHpDelta={d => updateSummonHp(s.id, d)} onRemove={() => removeSummon(s.id)}
                                    onRoundDecrement={() => updateSummon({ ...s, roundsRemaining: Math.max(0, (s.roundsRemaining ?? 0) - 1) })}
                                />
                            );
                        })}
                    </>
                )}

                {pets.length > 0 && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: summons.length > 0 ? 4 : 0, marginBottom: 1 }}>
                            <div style={{ flex: 1, height: 1, background: 'rgba(39,174,96,0.22)' }} />
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-success)', textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Compagni</span>
                            <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-success)', background: 'rgba(39,174,96,0.14)', border: '1px solid rgba(39,174,96,0.28)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>{pets.length}</span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(39,174,96,0.22)' }} />
                        </div>
                        {pets.map(p => {
                            const liveOv = computePetOverrides(p.creature);
                            const maxHp = computeEffectiveCreatureStats(p.creature, liveOv, p.runtimeModifiers ?? []).hp;
                            return (
                                <MiniCard
                                    key={p.id} creature={p.creature} label={p.nickname ?? p.creature.name}
                                    currentHp={p.currentHp} maxHp={maxHp} overrides={liveOv}
                                    accentColor="var(--accent-success)" onOpen={() => setPopup({ kind: 'pet', id: p.id })}
                                    onHpDelta={d => updatePetHp(p.id, d)} onRemove={() => removePet(p.id)}
                                />
                            );
                        })}
                    </>
                )}

                {goTo && (
                    <button className="btn-secondary text-xs" style={{ marginTop: 4 }} onClick={() => goTo('bestiary')}>
                        <GiScrollUnfurled /> Bestiario completo
                    </button>
                )}
            </div>

            {popup && (() => {
                const closePopup = () => setPopup(null);
                if (popup.kind === 'summon') {
                    const s = summons.find(x => x.id === popup.id);
                    if (!s) { closePopup(); return null; }
                    const liveOv = computeSummonOverrides(s.creature);
                    return (
                        <CreaturePopup kind="summon" entry={s} liveOverrides={liveOv}
                            runtimeModifiers={s.runtimeModifiers ?? []}
                            onAddRuntimeModifier={m => addCreatureRuntimeModifier('summon', s.id, m)}
                            onRemoveRuntimeModifier={mid => removeCreatureRuntimeModifier('summon', s.id, mid)}
                            onClose={closePopup} onHpDelta={d => updateSummonHp(s.id, d)} onRemove={() => removeSummon(s.id)}
                            onRoundDecrement={() => updateSummon({ ...s, roundsRemaining: Math.max(0, (s.roundsRemaining ?? 0) - 1) })}
                        />
                    );
                } else {
                    const p = pets.find(x => x.id === popup.id);
                    if (!p) { closePopup(); return null; }
                    const liveOv = computePetOverrides(p.creature);
                    return (
                        <CreaturePopup kind="pet" entry={p} liveOverrides={liveOv}
                            runtimeModifiers={p.runtimeModifiers ?? []}
                            onAddRuntimeModifier={m => addCreatureRuntimeModifier('pet', p.id, m)}
                            onRemoveRuntimeModifier={mid => removeCreatureRuntimeModifier('pet', p.id, mid)}
                            onClose={closePopup} onHpDelta={d => updatePetHp(p.id, d)} onRemove={() => removePet(p.id)}
                        />
                    );
                }
            })()}
        </>
    );
};
