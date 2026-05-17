import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuid } from 'uuid';
import {
    FaPlus, FaTrash, FaEdit, FaTimes, FaSave, FaSearch, FaSkull,
    FaChevronLeft, FaDragon, FaUpload, FaBolt, FaPaw,
    FaMinus,
} from 'react-icons/fa';
import { GiScrollUnfurled, GiMagicSwirl } from 'react-icons/gi';
import { useCharacterStore } from '../store/characterStore';
import { saveCharacterToDb } from '../services/db';
import { creatureCatalog, type CatalogCreature } from '../services/admin';
import type {
    BestiaryEntry, ActiveSummon, ActivePet, Creature, CreatureSize,
    CreatureTypeCategory, CreatureAlignment, CreatureAction, CreatureSpecialAbility,
    CreatureStatOverride, CreatureRuntimeModifier,
} from '../types/dnd';
import { CreaturePortrait, StatBlock, computeEffectiveCreatureStats } from './CreatureStatBlock';
import { CreaturePopup } from './CreaturePopup';
import { CompanionPanel } from './CompanionPanel';
import { useMediaQuery } from './mobile/MobileShell';
import './Bestiary.css';
const pctColor = (p: number) => p > 0.6 ? 'healthy' : p > 0.3 ? 'wounded' : p > 0 ? 'critical' : 'dead';

const CREATURE_SIZES: CreatureSize[] = ['Minuscola', 'Piccola', 'Media', 'Grande', 'Enorme', 'Mastodontica', 'Colossale'];
const CREATURE_TYPES: CreatureTypeCategory[] = [
    'Aberrazione', 'Animale', 'Costrutto', 'Drago', 'Elementale', 'Fatato', 'Gigante',
    'Umanoide', 'Bestia Magica', 'Umanoide Mostruoso', 'Melma', 'Esterno', 'Vegetale', 'Non Morto', 'Verme',
];
const CREATURE_ALIGNMENTS: CreatureAlignment[] = [
    'Legale Buono', 'Neutrale Buono', 'Caotico Buono',
    'Legale Neutrale', 'Neutrale', 'Caotico Neutrale',
    'Legale Malvagio', 'Neutrale Malvagio', 'Caotico Malvagio',
];

type BestiaryTab = 'catalogo' | 'personale' | 'evocazioni' | 'compagni';

/* ─── image compress util ─────────────────────────────────────── */
async function compressCreatureImage(file: File): Promise<{ data: string; type: 'svg' | 'webp' | 'png' }> {
    if (file.type === 'image/svg+xml') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read-failed'));
            reader.onload = () => resolve({ data: String(reader.result), type: 'svg' });
            reader.readAsText(file);
        });
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read-failed'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('decode-failed'));
            img.onload = () => {
                const MAX = 256;
                const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * ratio));
                const h = Math.max(1, Math.round(img.height * ratio));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('canvas')); return; }
                ctx.drawImage(img, 0, 0, w, h);
                resolve({ data: canvas.toDataURL('image/webp', 0.75), type: 'webp' });
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

/* ─── empty creature ──────────────────────────────────────────── */
const EMPTY_CREATURE = (): Creature => ({
    id: uuid(), name: '', size: 'Media', type: 'Bestia Magica', alignment: 'Neutrale',
    str: 10, dex: 10, con: 10, int: 2, wis: 10, cha: 4,
    hp: 10, ac: 12, speed: 9, bab: 0,
    fortitude: 0, reflex: 0, will: 0,
    actions: [], specialAbilities: [],
    description: '', challengeRating: '1', tags: [],
});

/* StatBlock and CreaturePortrait are imported from CreatureStatBlock.tsx */

/* ═══════════════════════════════════════════════════════════════
   Creature editor (user-side, for personal bestiary)
═══════════════════════════════════════════════════════════════ */
interface CreatureEditorProps {
    initial: Creature;
    onSave: (c: Creature) => void;
    onCancel: () => void;
    compact?: boolean;
}
interface CreatureEditorHandle { save: () => void; }

const CreatureEditor = React.forwardRef<CreatureEditorHandle, CreatureEditorProps>(
    ({ initial, onSave, onCancel, compact }, ref) => {
    const [form, setForm] = useState<Creature>(initial);
    const imgInputRef = useRef<HTMLInputElement>(null);
    const [imgBusy, setImgBusy] = useState(false);

    const set = (patch: Partial<Creature>) => setForm(f => ({ ...f, ...patch }));
    const n = (v: string) => Number(v) || 0;

    useImperativeHandle(ref, () => ({ save: () => { if (form.name.trim()) onSave(form); } }));

    const addAction = () => set({ actions: [...(form.actions ?? []), { id: uuid(), name: '', range: 'Mischia' }] });
    const updAction = (a: CreatureAction) => set({ actions: (form.actions ?? []).map(x => x.id === a.id ? a : x) });
    const delAction = (id: string) => set({ actions: (form.actions ?? []).filter(x => x.id !== id) });
    const addAbility = () => set({ specialAbilities: [...(form.specialAbilities ?? []), { id: uuid(), name: '', description: '', abilityType: 'EX' }] });
    const updAbility = (a: CreatureSpecialAbility) => set({ specialAbilities: (form.specialAbilities ?? []).map(x => x.id === a.id ? a : x) });
    const delAbility = (id: string) => set({ specialAbilities: (form.specialAbilities ?? []).filter(x => x.id !== id) });

    const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setImgBusy(true);
        try { const { data, type } = await compressCreatureImage(e.target.files[0]); set({ imageData: data, imageType: type }); }
        catch { /* ignore */ } finally { setImgBusy(false); if (imgInputRef.current) imgInputRef.current.value = ''; }
    };

    return (
        <div className="glass-panel flex-col gap-3 animate-fade-in">
            {!compact && (
                <div className="section-header">
                    <span className="section-title">Modifica Creatura</span>
                    <div className="flex gap-2">
                        <button className="btn-secondary text-sm" onClick={onCancel}><FaTimes /> Annulla</button>
                        <button className="btn-primary text-sm" onClick={() => form.name.trim() && onSave(form)}><FaSave /> Salva</button>
                    </div>
                </div>
            )}

            {/* Image */}
            <div className="flex gap-3 items-start">
                {form.imageData
                    ? form.imageType === 'svg'
                        ? <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-surface)', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: form.imageData }} />
                        : <img src={form.imageData} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                    : <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)', fontSize: 32, flexShrink: 0, cursor: 'pointer' }} onClick={() => imgInputRef.current?.click()}><FaDragon /></div>
                }
                <div className="flex-col gap-1">
                    <input ref={imgInputRef} type="file" accept="image/svg+xml,image/webp,image/png" style={{ display: 'none' }} onChange={handleImage} />
                    <button className="btn-secondary text-sm" onClick={() => imgInputRef.current?.click()} disabled={imgBusy}>
                        <FaUpload /> {imgBusy ? 'Caricamento…' : 'Carica immagine (SVG/WebP)'}
                    </button>
                    {form.imageData && <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => set({ imageData: undefined, imageType: undefined })}>Rimuovi immagine</button>}
                </div>
            </div>

            {/* Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 'var(--space-2)' }}>
                <Fld label="Nome *"><input className="input w-full" value={form.name} onChange={e => set({ name: e.target.value })} /></Fld>
                <Fld label="Taglia"><select className="input w-full" value={form.size} onChange={e => set({ size: e.target.value as CreatureSize })}>{CREATURE_SIZES.map(s => <option key={s}>{s}</option>)}</select></Fld>
                <Fld label="Tipo"><select className="input w-full" value={form.type} onChange={e => set({ type: e.target.value as CreatureTypeCategory })}>{CREATURE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Fld>
                <Fld label="Sottotipo"><input className="input w-full" value={form.subtype ?? ''} onChange={e => set({ subtype: e.target.value })} /></Fld>
                <Fld label="Allineamento"><select className="input w-full" value={form.alignment ?? 'Neutrale'} onChange={e => set({ alignment: e.target.value as CreatureAlignment })}>{CREATURE_ALIGNMENTS.map(a => <option key={a}>{a}</option>)}</select></Fld>
                <Fld label="CR"><input className="input w-full" value={form.challengeRating ?? ''} onChange={e => set({ challengeRating: e.target.value })} placeholder="es. 5, 1/2" /></Fld>
            </div>

            {/* Ability scores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-2)' }}>
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(s => (
                    <Fld key={s} label={s.toUpperCase()}>
                        <input className="input w-full" type="number" min={1} value={(form as any)[s]} onChange={e => set({ [s]: n(e.target.value) })} />
                    </Fld>
                ))}
            </div>

            {/* Combat */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 'var(--space-2)' }}>
                <Fld label="PF max"><input className="input w-full" type="number" min={1} value={form.hp} onChange={e => set({ hp: n(e.target.value) })} /></Fld>
                <Fld label="Dadi PF"><input className="input w-full" value={form.hpDice ?? ''} onChange={e => set({ hpDice: e.target.value })} placeholder="4d8+8" /></Fld>
                <Fld label="CA"><input className="input w-full" type="number" value={form.ac} onChange={e => set({ ac: n(e.target.value) })} /></Fld>
                <Fld label="BAB"><input className="input w-full" type="number" value={form.bab} onChange={e => set({ bab: n(e.target.value) })} /></Fld>
                <Fld label="VEL (m)"><input className="input w-full" type="number" value={form.speed} onChange={e => set({ speed: n(e.target.value) })} /></Fld>
                <Fld label="Tempra"><input className="input w-full" type="number" value={form.fortitude} onChange={e => set({ fortitude: n(e.target.value) })} /></Fld>
                <Fld label="Riflessi"><input className="input w-full" type="number" value={form.reflex} onChange={e => set({ reflex: n(e.target.value) })} /></Fld>
                <Fld label="Volontà"><input className="input w-full" type="number" value={form.will} onChange={e => set({ will: n(e.target.value) })} /></Fld>
            </div>

            {/* Defense extras */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'var(--space-2)' }}>
                <Fld label="Riduzione Danni"><input className="input w-full" value={form.damageReduction ?? ''} onChange={e => set({ damageReduction: e.target.value })} placeholder="5/magico" /></Fld>
                <Fld label="Res. Incantesimi"><input className="input w-full" type="number" value={form.spellResistance ?? 0} onChange={e => set({ spellResistance: n(e.target.value) || undefined })} /></Fld>
                <Fld label="Resistenze"><input className="input w-full" value={form.resistances ?? ''} onChange={e => set({ resistances: e.target.value })} placeholder="fuoco 10, freddo 5" /></Fld>
                <Fld label="Immunità"><input className="input w-full" value={form.immunities ?? ''} onChange={e => set({ immunities: e.target.value })} /></Fld>
                <Fld label="Vulnerabilità"><input className="input w-full" value={form.weaknesses ?? ''} onChange={e => set({ weaknesses: e.target.value })} /></Fld>
            </div>

            {/* Actions */}
            <div className="section-header">
                <span className="section-title text-sm">Attacchi</span>
                <button className="btn-secondary text-xs" onClick={addAction}><FaPlus /> Aggiungi</button>
            </div>
            {(form.actions ?? []).map(a => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 4, background: 'var(--bg-surface)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                    <Fld label="Nome"><input className="input w-full" value={a.name} onChange={e => updAction({ ...a, name: e.target.value })} /></Fld>
                    <Fld label="Bonus"><input className="input w-full" type="number" value={a.attackBonus ?? 0} onChange={e => updAction({ ...a, attackBonus: Number(e.target.value) })} /></Fld>
                    <Fld label="Scala su">
                        <select className="input w-full" value={a.attackStat ?? 'str'} onChange={e => updAction({ ...a, attackStat: e.target.value as 'str' | 'dex' | 'none' })}>
                            <option value="str">Forza</option>
                            <option value="dex">Destrezza</option>
                            <option value="none">Nessuna</option>
                        </select>
                    </Fld>
                    <Fld label="Danno"><input className="input w-full" value={a.damage ?? ''} onChange={e => updAction({ ...a, damage: e.target.value })} placeholder="1d8+3" /></Fld>
                    <Fld label="Tipo danno"><input className="input w-full" value={a.damageType ?? ''} onChange={e => updAction({ ...a, damageType: e.target.value })} /></Fld>
                    <Fld label="Gittata"><input className="input w-full" value={a.range ?? 'Mischia'} onChange={e => updAction({ ...a, range: e.target.value })} /></Fld>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => delAction(a.id)}><FaTrash /></button>
                    </div>
                </div>
            ))}

            {/* Special abilities */}
            <div className="section-header">
                <span className="section-title text-sm">Capacità Speciali</span>
                <button className="btn-secondary text-xs" onClick={addAbility}><FaPlus /> Aggiungi</button>
            </div>
            {(form.specialAbilities ?? []).map(a => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr auto', gap: 4, background: 'var(--bg-surface)', padding: 8, borderRadius: 'var(--radius-sm)', alignItems: 'start' }}>
                    <Fld label="Nome"><input className="input w-full" value={a.name} onChange={e => updAbility({ ...a, name: e.target.value })} /></Fld>
                    <Fld label="Tipo"><select className="input w-full" value={a.abilityType} onChange={e => updAbility({ ...a, abilityType: e.target.value as 'EX' | 'SP' | 'SU' })}><option>EX</option><option>SP</option><option>SU</option></select></Fld>
                    <Fld label="Descrizione"><textarea className="input w-full" rows={2} value={a.description} onChange={e => updAbility({ ...a, description: e.target.value })} /></Fld>
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                        <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => delAbility(a.id)}><FaTrash /></button>
                    </div>
                </div>
            ))}

            {/* Description */}
            <Fld label="Descrizione">
                <textarea className="input w-full" rows={4} value={form.description ?? ''} onChange={e => set({ description: e.target.value })} />
            </Fld>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 'var(--space-2)' }}>
                <Fld label="Habitat"><input className="input w-full" value={form.habitat ?? ''} onChange={e => set({ habitat: e.target.value })} /></Fld>
                <Fld label="Organizzazione"><input className="input w-full" value={form.organization ?? ''} onChange={e => set({ organization: e.target.value })} /></Fld>
                <Fld label="Tesoro"><input className="input w-full" value={form.treasureValue ?? ''} onChange={e => set({ treasureValue: e.target.value })} /></Fld>
                <Fld label="Tag (virgola)"><input className="input w-full" value={(form.tags ?? []).join(', ')} onChange={e => set({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></Fld>
            </div>
        </div>
    );
});

/* ─── inline Field helper ─── */
const Fld: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div><label className="text-xs text-muted" style={{ display: 'block', marginBottom: 3 }}>{label}</label>{children}</div>
);

/* ═══════════════════════════════════════════════════════════════
   Tracker card (summon or pet)
═══════════════════════════════════════════════════════════════ */
interface TrackerCardProps {
    name: string;
    creature: Creature;
    currentHp: number;
    maxHp: number;
    overrides: CreatureStatOverride[];
    runtimeModifiers?: CreatureRuntimeModifier[];
    conditions?: string[];
    selected?: boolean;
    onClick?: () => void;
    onHpDelta: (delta: number) => void;
    onDismiss: () => void;
    onEdit: () => void;
    extra?: React.ReactNode;
}

const TrackerCard: React.FC<TrackerCardProps> = ({ name, creature, currentHp, maxHp, overrides, runtimeModifiers, conditions, selected, onClick, onHpDelta, onDismiss, onEdit, extra }) => {
    const pct = maxHp > 0 ? Math.max(0, currentHp / maxHp) : 0;
    const [delta, setDelta] = useState(1);
    const eff = computeEffectiveCreatureStats(creature, overrides, runtimeModifiers ?? []);

    return (
        <div
            className={`creature-card${selected ? ' selected' : ''}`}
            style={{ flexDirection: 'column', alignItems: 'stretch', cursor: onClick ? 'pointer' : undefined, gap: 0 }}
            onClick={onClick}
        >
            {/* ── Top row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreaturePortrait creature={creature} size={44} />
                <div className="creature-card-body">
                    <div className="creature-card-name">{name}</div>
                    <div className="creature-card-meta">{creature.size} {creature.type}</div>
                </div>
                <div className="creature-card-badges">
                    <span className="badge-cr">CA {eff.ac}</span>
                    {conditions && conditions.length > 0 && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--accent-crimson)', textAlign: 'right' }}>
                            {conditions.join(', ')}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost text-xs" style={{ padding: '3px 6px', color: 'var(--accent-gold)' }} title="Dettaglio" onClick={onEdit}>
                        <GiScrollUnfurled />
                    </button>
                    <button className="btn-ghost text-xs" style={{ padding: '3px 6px', color: 'var(--accent-crimson)' }} title="Rimuovi" onClick={onDismiss}>
                        <FaTimes />
                    </button>
                </div>
            </div>
            {/* ── HP row ── */}
            <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                        <span>PF</span>
                        <span style={{ color: currentHp <= 0 ? 'var(--accent-crimson)' : undefined }}>{currentHp} / {maxHp}</span>
                    </div>
                    <div className="tracker-hp-bar">
                        <div className={`tracker-hp-fill ${pctColor(pct)}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                    <button className="btn-secondary text-xs" style={{ padding: '2px 6px', minWidth: 24 }} onClick={() => onHpDelta(-delta)}><FaMinus /></button>
                    <input
                        type="number" min={1} value={delta}
                        onChange={e => setDelta(Math.max(1, Number(e.target.value) || 1))}
                        className="input"
                        style={{ width: 42, textAlign: 'center', padding: '2px 4px', fontSize: '0.78rem' }}
                    />
                    <button className="btn-primary text-xs" style={{ padding: '2px 6px', minWidth: 24 }} onClick={() => onHpDelta(delta)}><FaPlus /></button>
                    {currentHp <= 0 && <FaSkull style={{ color: '#636e72' }} />}
                </div>
            </div>
            {extra && <div style={{ marginTop: 6 }}>{extra}</div>}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   SUMMON DIALOG
═══════════════════════════════════════════════════════════════ */
interface SummonDialogProps {
    creature: Creature;
    overrides: CreatureStatOverride[];
    onConfirm: (spellName: string, rounds: number | null) => void;
    onCancel: () => void;
}

const SummonDialog: React.FC<SummonDialogProps> = ({ creature, overrides, onConfirm, onCancel }) => {
    const [spellName, setSpellName] = useState('');
    const [rounds, setRounds] = useState<string>('');
    const effHp = computeEffectiveCreatureStats(creature, overrides, []).hp;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div className="glass-panel" style={{ maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="section-header">
                    <span className="section-title">Evoca — {creature.name}</span>
                    <button className="btn-ghost text-sm" onClick={onCancel}><FaTimes /></button>
                </div>
                {overrides.length > 0 && (
                    <div>
                        <p className="text-xs text-muted" style={{ marginBottom: 6 }}>Modificatori attivi applicati alla creatura:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {overrides.map((o, i) => (
                                <span key={i} className={`override-chip${o.value < 0 ? ' negative' : ''}`}>
                                    {o.source}: {o.stat.toUpperCase()} {o.value >= 0 ? '+' : ''}{o.value}
                                </span>
                            ))}
                        </div>
                        <p className="text-xs text-muted" style={{ marginTop: 6 }}>PF effettivi: <strong style={{ color: 'var(--accent-success)' }}>{effHp}</strong></p>
                    </div>
                )}
                <Fld label="Nome incantesimo (opzionale)">
                    <input className="input w-full" value={spellName} onChange={e => setSpellName(e.target.value)} placeholder="es. Convocare Mostro III" />
                </Fld>
                <Fld label="Durata in round (lasciare vuoto = illimitata)">
                    <input className="input w-full" type="number" min={1} value={rounds} onChange={e => setRounds(e.target.value)} placeholder="es. 10" />
                </Fld>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-secondary text-sm" onClick={onCancel}>Annulla</button>
                    <button className="btn-primary text-sm" onClick={() => onConfirm(spellName, rounds ? Number(rounds) : null)}>
                        <GiMagicSwirl /> Evoca!
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   PET DIALOG
═══════════════════════════════════════════════════════════════ */
interface PetDialogProps {
    creature: Creature;
    overrides: CreatureStatOverride[];
    onConfirm: (nickname: string) => void;
    onCancel: () => void;
}

const PetDialog: React.FC<PetDialogProps> = ({ creature, overrides, onConfirm, onCancel }) => {
    const [nickname, setNickname] = useState('');
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
            <div className="glass-panel" style={{ maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="section-header">
                    <span className="section-title">Aggiungi Compagno — {creature.name}</span>
                    <button className="btn-ghost text-sm" onClick={onCancel}><FaTimes /></button>
                </div>
                {overrides.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {overrides.map((o, i) => (
                            <span key={i} className={`override-chip${o.value < 0 ? ' negative' : ''}`}>
                                {o.source}: {o.stat.toUpperCase()} {o.value >= 0 ? '+' : ''}{o.value}
                            </span>
                        ))}
                    </div>
                )}
                <Fld label="Soprannome (opzionale)">
                    <input className="input w-full" value={nickname} onChange={e => setNickname(e.target.value)} placeholder={creature.name} />
                </Fld>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-secondary text-sm" onClick={onCancel}>Annulla</button>
                    <button className="btn-primary text-sm" onClick={() => onConfirm(nickname)}>
                        <FaPaw /> Aggiungi
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN BestiaryPage
═══════════════════════════════════════════════════════════════ */
export const BestiaryPage: React.FC = () => {
    const {
        character, addBestiaryEntry, updateBestiaryEntry, removeBestiaryEntry,
        addSummon, updateSummon, removeSummon, updateSummonHp,
        addPet, updatePet, removePet, updatePetHp,
        computeSummonOverrides, computePetOverrides,
        addCreatureRuntimeModifier, removeCreatureRuntimeModifier,
        updatePetFeature, removePetFeature, togglePetFeature,
        usePetFeatureResource, resetPetFeatureResource,
        updatePetEquipment, removePetEquipment, togglePetEquipment,
    } = useCharacterStore();

    const saveChar = () => { const c = useCharacterStore.getState().character; if (c) saveCharacterToDb(c); };

    const [tab, setTab] = useState<BestiaryTab>('catalogo');
    const [search, setSearch] = useState('');
    const [catalogItems, setCatalogItems] = useState<CatalogCreature[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    // Master-detail: what's selected in the list pane
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [viewingCreature, setViewingCreature] = useState<{ creature: Creature; overrides?: CreatureStatOverride[]; entry?: BestiaryEntry } | null>(null);
    const [summonDialog, setSummonDialog] = useState<{ creature: Creature; overrides: CreatureStatOverride[]; entryId?: string } | null>(null);
    const [petDialog, setPetDialog] = useState<{ creature: Creature; overrides: CreatureStatOverride[]; entryId?: string } | null>(null);
    const [editingEntry, setEditingEntry] = useState<BestiaryEntry | null>(null);
    const [editingSummon, setEditingSummon] = useState<ActiveSummon | null>(null);
    const [viewingPet, setViewingPet] = useState<ActivePet | null>(null);
    const creatorRef = useRef<CreatureEditorHandle>(null);
    const [editorClosing, setEditorClosing] = useState(false);

    const isMobile = useMediaQuery('(max-width: 859px)');

    const bestiary = character?.bestiary ?? [];
    const summons = character?.activeSummons ?? [];
    const pets = character?.activePets ?? [];

    // Load catalog when on catalog tab
    useEffect(() => {
        if (tab !== 'catalogo') return;
        setCatalogLoading(true);
        creatureCatalog.list().then(list => { setCatalogItems(list); setCatalogLoading(false); });
    }, [tab]);

    const filteredCatalog = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return catalogItems;
        return catalogItems.filter(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q) || (c.challengeRating ?? '').includes(q) || (c.tags ?? []).some(t => t.toLowerCase().includes(q)));
    }, [catalogItems, search]);

    const filteredBestiary = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return bestiary;
        return bestiary.filter(e => e.creature.name.toLowerCase().includes(q) || e.creature.type.toLowerCase().includes(q));
    }, [bestiary, search]);

    /* ── Summon handlers ── */
    const openSummonDialog = (creature: Creature, entryId?: string) => {
        const overrides = computeSummonOverrides(creature);
        setSummonDialog({ creature, overrides, entryId });
    };

    const confirmSummon = (spellName: string, rounds: number | null) => {
        if (!summonDialog) return;
        const { creature, overrides, entryId } = summonDialog;
        const effHp = computeEffectiveCreatureStats(creature, overrides, []).hp;
        const summon: ActiveSummon = {
            id: uuid(),
            creature: { ...creature, imageData: undefined } as Creature, // strip image to save space
            originId: entryId,
            appliedOverrides: overrides,
            currentHp: effHp,
            summonSpellName: spellName || undefined,
            roundsRemaining: rounds,
            durationUnit: rounds ? 'round' : undefined,
            conditions: [],
            activeEffects: [],
            summonedAt: new Date().toISOString(),
        };
        addSummon(summon);
        saveChar();
        setSummonDialog(null);
        setTab('evocazioni');
    };

    /* ── Pet handlers ── */
    const openPetDialog = (creature: Creature, entryId?: string) => {
        const overrides = computePetOverrides(creature);
        setPetDialog({ creature, overrides, entryId });
    };

    const confirmPet = (nickname: string) => {
        if (!petDialog) return;
        const { creature, overrides, entryId } = petDialog;
        const effHp = computeEffectiveCreatureStats(creature, overrides, []).hp;
        const pet: ActivePet = {
            id: uuid(),
            creature: { ...creature, imageData: undefined } as Creature,
            originId: entryId,
            appliedOverrides: overrides,
            currentHp: effHp,
            nickname: nickname || undefined,
            conditions: [],
            activeEffects: [],
            addedAt: new Date().toISOString(),
        };
        addPet(pet);
        saveChar();
        setPetDialog(null);
        setTab('compagni');
    };

    /* ── Add catalog creature to personal bestiary ── */
    const addToBestiary = (c: CatalogCreature) => {
        const entry: BestiaryEntry = {
            id: uuid(),
            catalogId: c.id,
            creature: { ...c },
            addedAt: new Date().toISOString(),
        };
        addBestiaryEntry(entry);
        saveChar();
    };

    /* ── Save personal creature edit ── */
    const saveEdit = (creature: Creature) => {
        if (!editingEntry) return;
        updateBestiaryEntry({ ...editingEntry, creature });
        saveChar();
        setEditingEntry(null);
    };

    const closeMobileEditor = (creature?: Creature) => {
        const entry = editingEntry;
        setEditorClosing(true);
        setTimeout(() => {
            if (creature && entry) { updateBestiaryEntry({ ...entry, creature }); saveChar(); }
            setEditingEntry(null);
            setEditorClosing(false);
        }, 210);
    };

    if (!character) return <div className="text-muted text-center" style={{ padding: 40 }}>Carica un personaggio per accedere al bestiario.</div>;

    /* ── Full-screen overlays (editor, companion panel) ── */
    if (editingEntry && !isMobile) {
        return (
            <div style={{ flex: 1, overflow: 'hidden auto', padding: 'var(--space-4)' }}>
                <CreatureEditor initial={editingEntry.creature} onSave={saveEdit} onCancel={() => setEditingEntry(null)} />
            </div>
        );
    }

    if (viewingPet && isMobile) {
        const freshPet = (character?.activePets ?? []).find(p => p.id === viewingPet.id) ?? viewingPet;
        return (
            <div className="bestiary-pet-overlay">
                <CompanionPanel
                    pet={freshPet}
                    onClose={() => setViewingPet(null)}
                    onUpdatePet={(pet) => { updatePet(pet); saveChar(); }}
                    onUpdateHp={(delta) => { updatePetHp(freshPet.id, delta); saveChar(); }}
                    onAddRuntimeModifier={(m) => { addCreatureRuntimeModifier('pet', freshPet.id, m); saveChar(); }}
                    onRemoveRuntimeModifier={(mid) => { removeCreatureRuntimeModifier('pet', freshPet.id, mid); saveChar(); }}
                    onUpdateFeature={(f) => { updatePetFeature(freshPet.id, f); saveChar(); }}
                    onRemoveFeature={(fid) => { removePetFeature(freshPet.id, fid); saveChar(); }}
                    onToggleFeature={(fid) => { togglePetFeature(freshPet.id, fid); saveChar(); }}
                    onUseFeatureResource={(fid) => { usePetFeatureResource(freshPet.id, fid); saveChar(); }}
                    onResetFeatureResource={(fid) => { resetPetFeatureResource(freshPet.id, fid); saveChar(); }}
                    onUpdateEquipment={(e) => { updatePetEquipment(freshPet.id, e); saveChar(); }}
                    onRemoveEquipment={(eid) => { removePetEquipment(freshPet.id, eid); saveChar(); }}
                    onToggleEquipment={(eid) => { togglePetEquipment(freshPet.id, eid); saveChar(); }}
                    onDismiss={() => { removePet(freshPet.id); saveChar(); setViewingPet(null); }}
                />
            </div>
        );
    }

    /* ── Determine what shows in the detail pane ── */
    const detailContent = (() => {
        // Companion panel — desktop detail pane
        if (viewingPet) {
            const freshPet = (character?.activePets ?? []).find(p => p.id === viewingPet.id) ?? viewingPet;
            return (
                <CompanionPanel
                    pet={freshPet}
                    onClose={() => setViewingPet(null)}
                    onUpdatePet={(pet) => { updatePet(pet); saveChar(); }}
                    onUpdateHp={(delta) => { updatePetHp(freshPet.id, delta); saveChar(); }}
                    onAddRuntimeModifier={(m) => { addCreatureRuntimeModifier('pet', freshPet.id, m); saveChar(); }}
                    onRemoveRuntimeModifier={(mid) => { removeCreatureRuntimeModifier('pet', freshPet.id, mid); saveChar(); }}
                    onUpdateFeature={(f) => { updatePetFeature(freshPet.id, f); saveChar(); }}
                    onRemoveFeature={(fid) => { removePetFeature(freshPet.id, fid); saveChar(); }}
                    onToggleFeature={(fid) => { togglePetFeature(freshPet.id, fid); saveChar(); }}
                    onUseFeatureResource={(fid) => { usePetFeatureResource(freshPet.id, fid); saveChar(); }}
                    onResetFeatureResource={(fid) => { resetPetFeatureResource(freshPet.id, fid); saveChar(); }}
                    onUpdateEquipment={(e) => { updatePetEquipment(freshPet.id, e); saveChar(); }}
                    onRemoveEquipment={(eid) => { removePetEquipment(freshPet.id, eid); saveChar(); }}
                    onToggleEquipment={(eid) => { togglePetEquipment(freshPet.id, eid); saveChar(); }}
                    onDismiss={() => { removePet(freshPet.id); saveChar(); setViewingPet(null); }}
                />
            );
        }
        // Summon stat-block detail
        if (editingSummon) {
            return (
                <>
                    <button className="bestiary-back-btn" onClick={() => setEditingSummon(null)}>
                        <FaChevronLeft /> Evocazioni
                    </button>
                    <StatBlock
                        creature={editingSummon.creature}
                        overrides={editingSummon.appliedOverrides}
                        runtimeModifiers={editingSummon.runtimeModifiers ?? []}
                        onAddRuntimeModifier={(m) => addCreatureRuntimeModifier('summon', editingSummon.id, m)}
                        onRemoveRuntimeModifier={(mid) => removeCreatureRuntimeModifier('summon', editingSummon.id, mid)}
                        onClose={() => setEditingSummon(null)}
                        actionLabel="Rimuovi evocazione"
                        actionIcon={<FaTimes />}
                        onAction={() => { removeSummon(editingSummon.id); saveChar(); setEditingSummon(null); }}
                    />
                </>
            );
        }
        // Creature from catalog / personal bestiary
        if (viewingCreature) {
            const { creature, overrides, entry } = viewingCreature;
            return (
                <>
                    <button className="bestiary-back-btn" onClick={() => { setViewingCreature(null); setSelectedId(null); }}>
                        <FaChevronLeft /> {tab === 'personale' ? 'Personale' : 'Catalogo'}
                    </button>
                    <StatBlock
                        creature={creature}
                        overrides={overrides ?? []}
                        onClose={() => { setViewingCreature(null); setSelectedId(null); }}
                        actionLabel="Evoca"
                        actionIcon={<GiMagicSwirl />}
                        onAction={() => openSummonDialog(creature, entry?.id)}
                        actionLabel2="Aggiungi come Compagno"
                        actionIcon2={<FaPaw />}
                        onAction2={() => openPetDialog(creature, entry?.id)}
                    />
                </>
            );
        }
        return null;
    })();

    const hasDetail = detailContent !== null;
    const tabsConfig = [
        { id: 'catalogo' as const, label: 'Catalogo', icon: <FaDragon />, count: null },
        { id: 'personale' as const, label: 'Personale', icon: <GiScrollUnfurled />, count: bestiary.length },
        { id: 'evocazioni' as const, label: 'Evocazioni', icon: <GiMagicSwirl />, count: summons.length },
        { id: 'compagni' as const, label: 'Compagni', icon: <FaPaw />, count: pets.length },
    ];

    return (
        <div className="bestiary-page animate-fade-in" style={{ padding: 0 }}>
            {/* ── Top toolbar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px 0',
                flexShrink: 0,
            }}>
                {/* Title — only shown when no detail open on mobile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <FaDragon style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Bestiario
                    </span>
                </div>
                {tab === 'personale' && (
                    <button className="btn-primary text-sm" style={{ padding: '5px 12px', flexShrink: 0 }} onClick={() => {
                        const entry: BestiaryEntry = { id: uuid(), creature: EMPTY_CREATURE(), addedAt: new Date().toISOString() };
                        setEditingEntry(entry);
                    }}>
                        <FaPlus /> Nuova
                    </button>
                )}
                {/* Search */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                    padding: '5px 10px', border: '1px solid rgba(255,255,255,0.07)',
                    flexShrink: 0,
                }}>
                    <FaSearch style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', fontSize: '0.82rem', width: 130 }}
                        placeholder="Cerca…" value={search} onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="bestiary-tabs" style={{ padding: '8px 16px 0' }}>
                {tabsConfig.map(t => (
                    <button
                        key={t.id}
                        className={`bestiary-tab-btn${tab === t.id ? ' active' : ''}`}
                        onClick={() => { setTab(t.id); setViewingCreature(null); setSelectedId(null); setEditingSummon(null); setViewingPet(null); }}
                    >
                        {t.icon}
                        <span className="tab-label-text">{t.label}</span>
                        {t.count !== null && t.count > 0 && (
                            <span style={{
                                background: tab === t.id ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.07)',
                                borderRadius: 99, padding: '0 5px', fontSize: '0.65rem', minWidth: 18, textAlign: 'center',
                            }}>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Master-detail split ── */}
            <div className="bestiary-split" style={{ marginTop: 10 }}>

                {/* LIST PANE */}
                <div className="bestiary-list-pane">

                    {/* ── CATALOGO list ── */}
                    {tab === 'catalogo' && (
                        <>
                            {catalogLoading && <div className="bestiary-empty">Caricamento catalogo…</div>}
                            {!catalogLoading && filteredCatalog.length === 0 && (
                                <div className="bestiary-empty">Nessuna creatura nel catalogo.</div>
                            )}
                            <div className="creature-grid">
                                {filteredCatalog.map(c => (
                                    <div
                                        key={c.id}
                                        className={`creature-card${selectedId === c.id ? ' selected' : ''}`}
                                        onClick={() => { setSelectedId(c.id); setViewingCreature({ creature: c, overrides: [] }); }}
                                    >
                                        <div className="creature-card-img">
                                            {c.imageData && c.imageType === 'svg'
                                                ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: c.imageData }} />
                                                : c.imageData ? <img src={c.imageData} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <FaDragon />}
                                        </div>
                                        <div className="creature-card-body">
                                            <div className="creature-card-name">{c.name}</div>
                                            <div className="creature-card-meta">{c.size} {c.type}{c.subtype ? ` (${c.subtype})` : ''}</div>
                                        </div>
                                        <div className="creature-card-badges">
                                            {c.challengeRating && <span className="badge-cr">CR {c.challengeRating}</span>}
                                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>CA {c.ac}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── PERSONALE list ── */}
                    {tab === 'personale' && (
                        <>
                            {filteredBestiary.length === 0 && (
                                <div className="bestiary-empty">Nessuna creatura nel bestiario personale.</div>
                            )}
                            <div className="creature-grid">
                                {filteredBestiary.map(entry => (
                                    <div
                                        key={entry.id}
                                        className={`creature-card${selectedId === entry.id ? ' selected' : ''}`}
                                        onClick={() => { setSelectedId(entry.id); setViewingCreature({ creature: entry.creature, overrides: [], entry }); }}
                                    >
                                        <div className="creature-card-img">
                                            {entry.creature.imageData && entry.creature.imageType === 'svg'
                                                ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: entry.creature.imageData }} />
                                                : entry.creature.imageData ? <img src={entry.creature.imageData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : <FaDragon />}
                                        </div>
                                        <div className="creature-card-body">
                                            <div className="creature-card-name">{entry.creature.name}</div>
                                            <div className="creature-card-meta">{entry.creature.size} {entry.creature.type}</div>
                                        </div>
                                        <div className="creature-card-badges">
                                            {entry.creature.challengeRating && <span className="badge-cr">CR {entry.creature.challengeRating}</span>}
                                            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                                <button className="btn-ghost" style={{ padding: '2px 5px', fontSize: '0.75rem' }} title="Modifica" onClick={() => setEditingEntry(entry)}><FaEdit /></button>
                                                <button className="btn-ghost" style={{ padding: '2px 5px', fontSize: '0.75rem', color: 'var(--accent-crimson)' }} title="Elimina"
                                                    onClick={() => { if (confirm(`Rimuovere ${entry.creature.name}?`)) { removeBestiaryEntry(entry.id); saveChar(); if (selectedId === entry.id) { setSelectedId(null); setViewingCreature(null); } } }}><FaTrash /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── EVOCAZIONI list ── */}
                    {tab === 'evocazioni' && (
                        <>
                            {summons.length === 0 && <div className="bestiary-empty">Nessuna evocazione attiva.</div>}
                            <div className="creature-grid">
                                {summons.map(s => {
                                    const eff = computeEffectiveCreatureStats(s.creature, s.appliedOverrides, s.runtimeModifiers ?? []);
                                    return (
                                        <TrackerCard
                                            key={s.id}
                                            name={s.creature.name}
                                            creature={s.creature}
                                            currentHp={s.currentHp}
                                            maxHp={eff.hp}
                                            overrides={s.appliedOverrides}
                                            runtimeModifiers={s.runtimeModifiers}
                                            conditions={s.conditions}
                                            selected={selectedId === s.id}
                                            onClick={() => { setEditingSummon(s); setSelectedId(s.id); }}
                                            onHpDelta={delta => { updateSummonHp(s.id, delta); saveChar(); }}
                                            onDismiss={() => { if (confirm(`Rimuovere evocazione di ${s.creature.name}?`)) { removeSummon(s.id); saveChar(); } }}
                                            onEdit={() => { setEditingSummon(s); setSelectedId(s.id); }}
                                            extra={
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    {s.summonSpellName && <span><FaBolt style={{ color: 'var(--accent-arcane)' }} /> {s.summonSpellName}</span>}
                                                    {s.roundsRemaining !== null && s.roundsRemaining !== undefined && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            ⏱ {s.roundsRemaining} round
                                                            <button className="btn-ghost" style={{ fontSize: '0.65rem', padding: '1px 4px' }}
                                                                onClick={() => { updateSummon({ ...s, roundsRemaining: Math.max(0, (s.roundsRemaining ?? 0) - 1) }); saveChar(); }}>-1</button>
                                                        </span>
                                                    )}
                                                </div>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* ── COMPAGNI list ── */}
                    {tab === 'compagni' && (
                        <>
                            {pets.length === 0 && <div className="bestiary-empty">Nessun compagno attivo.</div>}
                            <div className="creature-grid">
                                {pets.map(p => {
                                    const eff = computeEffectiveCreatureStats(p.creature, p.appliedOverrides, [
                                        ...(p.runtimeModifiers ?? []),
                                        ...(p.equipment ?? []).filter(e => e.equipped).flatMap(e => e.modifiers.map(m => ({ id: `eq-${e.id}`, name: e.name, stat: m.stat, value: m.value, type: m.type }))),
                                        ...(p.features ?? []).filter(f => f.active).flatMap(f => f.modifiers.map(m => ({ id: `feat-${f.id}`, name: f.name, stat: m.stat, value: m.value, type: m.type }))),
                                    ]);
                                    const featCount = (p.features ?? []).length;
                                    const equipCount = (p.equipment ?? []).filter(e => e.equipped).length;
                                    return (
                                        <TrackerCard
                                            key={p.id}
                                            name={p.nickname ?? p.creature.name}
                                            creature={p.creature}
                                            currentHp={p.currentHp}
                                            maxHp={eff.hp}
                                            overrides={p.appliedOverrides}
                                            runtimeModifiers={p.runtimeModifiers}
                                            conditions={p.conditions}
                                            selected={selectedId === p.id}
                                            onClick={() => { setViewingPet(p); setSelectedId(p.id); }}
                                            onHpDelta={delta => { updatePetHp(p.id, delta); saveChar(); }}
                                            onDismiss={() => { if (confirm(`Rimuovere ${p.nickname ?? p.creature.name}?`)) { removePet(p.id); saveChar(); } }}
                                            onEdit={() => { setViewingPet(p); setSelectedId(p.id); }}
                                            extra={
                                                (featCount > 0 || equipCount > 0 || p.bondLevel) ? (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {featCount > 0 && <span style={{ color: 'var(--accent-gold)' }}><GiScrollUnfurled style={{ marginRight: 3 }} />{featCount} privilegi</span>}
                                                        {equipCount > 0 && <span style={{ color: 'var(--accent-arcane)' }}>🛡 {equipCount} equipaggiati</span>}
                                                        {p.bondLevel ? <span style={{ color: 'var(--accent-gold)' }}>{'★'.repeat(p.bondLevel)}</span> : null}
                                                    </div>
                                                ) : undefined
                                            }
                                        />
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* DETAIL PANE — desktop only, CSS hides it on mobile */}
                <div className="bestiary-detail-pane">
                    {hasDetail ? (
                        <>
                            {detailContent}
                            {/* Sticky action bar for catalog / personal (desktop) */}
                            {viewingCreature && (
                                <div className="creature-detail-actions">
                                    <button className="btn-primary text-sm" onClick={() => openSummonDialog(viewingCreature.creature, viewingCreature.entry?.id)}>
                                        <GiMagicSwirl /> Evoca
                                    </button>
                                    <button className="btn-secondary text-sm" onClick={() => openPetDialog(viewingCreature.creature, viewingCreature.entry?.id)}>
                                        <FaPaw /> Compagno
                                    </button>
                                    {tab === 'catalogo' && !bestiary.some(e => e.catalogId === viewingCreature.creature.id) && (
                                        <button className="btn-ghost text-sm" onClick={() => addToBestiary(viewingCreature.creature as CatalogCreature)}>
                                            <FaPlus /> Aggiungi a Personale
                                        </button>
                                    )}
                                    {tab === 'personale' && viewingCreature.entry && (
                                        <button className="btn-ghost text-sm" onClick={() => setEditingEntry(viewingCreature.entry!)}>
                                            <FaEdit /> Modifica
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bestiary-detail-placeholder">
                            <FaDragon />
                            <span style={{ fontSize: '0.85rem' }}>Seleziona una creatura per vedere i dettagli</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile popup portals */}
            {isMobile && viewingCreature && (() => {
                const { creature, overrides, entry } = viewingCreature;
                return (
                    <CreaturePopup
                        kind="preview"
                        entry={{ id: '_preview', creature, currentHp: 0, appliedOverrides: overrides ?? [], runtimeModifiers: [] }}
                        liveOverrides={overrides ?? []}
                        onClose={() => { setViewingCreature(null); setSelectedId(null); }}
                        extraActions={
                            <>
                                <button className="btn-primary text-sm" onClick={() => openSummonDialog(creature, entry?.id)}>
                                    <GiMagicSwirl /> Evoca
                                </button>
                                <button className="btn-secondary text-sm" onClick={() => openPetDialog(creature, entry?.id)}>
                                    <FaPaw /> Compagno
                                </button>
                                {tab === 'catalogo' && !bestiary.some(e => e.catalogId === creature.id) && (
                                    <button className="btn-ghost text-sm" onClick={() => { addToBestiary(creature as CatalogCreature); setViewingCreature(null); }}>
                                        <FaPlus /> Personale
                                    </button>
                                )}
                                {tab === 'personale' && entry && (
                                    <button className="btn-ghost text-sm" onClick={() => setEditingEntry(entry!)}>
                                        <FaEdit /> Modifica
                                    </button>
                                )}
                            </>
                        }
                    />
                );
            })()}
            {isMobile && editingSummon && (() => {
                const s = editingSummon;
                return (
                    <CreaturePopup
                        kind="summon"
                        entry={s}
                        liveOverrides={s.appliedOverrides}
                        runtimeModifiers={s.runtimeModifiers ?? []}
                        onAddRuntimeModifier={m => addCreatureRuntimeModifier('summon', s.id, m)}
                        onRemoveRuntimeModifier={mid => removeCreatureRuntimeModifier('summon', s.id, mid)}
                        onClose={() => setEditingSummon(null)}
                        onHpDelta={d => { updateSummonHp(s.id, d); saveChar(); }}
                        onRemove={() => { if (confirm(`Rimuovere evocazione di ${s.creature.name}?`)) { removeSummon(s.id); saveChar(); setEditingSummon(null); } }}
                    />
                );
            })()}

            {/* Mobile creature editor bottom sheet */}
            {isMobile && (editingEntry || editorClosing) && createPortal(
                <div
                    className={`ceditor-overlay${editorClosing ? ' closing' : ''}`}
                    onClick={e => { if (e.target === e.currentTarget) closeMobileEditor(); }}
                >
                    <div className={`ceditor-sheet${editorClosing ? ' closing' : ''}`}>
                        <div className="mob-detail-pill" />
                        <div className="ceditor-header">
                            <span className="ceditor-title">Modifica Creatura</span>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => closeMobileEditor()}><FaTimes size={11} /> Annulla</button>
                                <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => creatorRef.current?.save()}><FaSave size={11} /> Salva</button>
                            </div>
                        </div>
                        <div className="ceditor-scroll">
                            <CreatureEditor
                                ref={creatorRef}
                                compact
                                initial={editingEntry?.creature ?? { name: '' } as Creature}
                                onSave={c => closeMobileEditor(c)}
                                onCancel={() => closeMobileEditor()}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Dialogs */}
            {summonDialog && (
                <SummonDialog
                    creature={summonDialog.creature}
                    overrides={summonDialog.overrides}
                    onConfirm={confirmSummon}
                    onCancel={() => setSummonDialog(null)}
                />
            )}
            {petDialog && (
                <PetDialog
                    creature={petDialog.creature}
                    overrides={petDialog.overrides}
                    onConfirm={confirmPet}
                    onCancel={() => setPetDialog(null)}
                />
            )}
        </div>
    );
};
