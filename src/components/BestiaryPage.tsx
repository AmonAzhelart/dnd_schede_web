import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
    FaPlus, FaTrash, FaEdit, FaTimes, FaSave, FaSearch, FaHeart, FaSkull,
    FaChevronLeft, FaDragon, FaUpload, FaBolt, FaPaw, FaMagic,
    FaChevronDown, FaChevronUp, FaMinus,
} from 'react-icons/fa';
import { GiScrollUnfurled, GiMagicSwirl } from 'react-icons/gi';
import { useCharacterStore } from '../store/characterStore';
import { creatureCatalog, type CatalogCreature } from '../services/admin';
import type {
    BestiaryEntry, ActiveSummon, ActivePet, Creature, CreatureSize,
    CreatureTypeCategory, CreatureAlignment, CreatureAction, CreatureSpecialAbility,
    CreatureStatOverride,
} from '../types/dnd';
import { mod, signMod, CreaturePortrait, StatBlock, type StatBlockProps } from './CreatureStatBlock';
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
}

const CreatureEditor: React.FC<CreatureEditorProps> = ({ initial, onSave, onCancel }) => {
    const [form, setForm] = useState<Creature>(initial);
    const imgInputRef = useRef<HTMLInputElement>(null);
    const [imgBusy, setImgBusy] = useState(false);

    const set = (patch: Partial<Creature>) => setForm(f => ({ ...f, ...patch }));
    const n = (v: string) => Number(v) || 0;

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
            <div className="section-header">
                <span className="section-title">Modifica Creatura</span>
                <div className="flex gap-2">
                    <button className="btn-secondary text-sm" onClick={onCancel}><FaTimes /> Annulla</button>
                    <button className="btn-primary text-sm" onClick={() => form.name.trim() && onSave(form)}><FaSave /> Salva</button>
                </div>
            </div>

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
};

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
    conditions?: string[];
    onHpDelta: (delta: number) => void;
    onDismiss: () => void;
    onEdit: () => void;
    extra?: React.ReactNode;
}

const TrackerCard: React.FC<TrackerCardProps> = ({ name, creature, currentHp, maxHp, overrides, conditions, onHpDelta, onDismiss, onEdit, extra }) => {
    const pct = maxHp > 0 ? Math.max(0, currentHp / maxHp) : 0;
    const [delta, setDelta] = useState(1);

    return (
        <div className="tracker-card">
            <div className="tracker-card-header">
                <CreaturePortrait creature={creature} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div className="text-xs text-muted">{creature.size} {creature.type}</div>
                </div>
                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-gold)' }} onClick={onEdit} title="Dettaglio"><GiScrollUnfurled /></button>
                <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={onDismiss} title="Rimuovi"><FaTimes /></button>
            </div>

            <div className="tracker-body">
                {/* HP bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                    <span>PF</span><span>{currentHp} / {maxHp}</span>
                </div>
                <div className="tracker-hp-bar">
                    <div className={`tracker-hp-fill ${pctColor(pct)}`} style={{ width: `${pct * 100}%` }} />
                </div>

                {/* HP controls */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                    <button className="btn-secondary text-xs" style={{ padding: '2px 8px', minWidth: 28 }} onClick={() => onHpDelta(-delta)}>
                        <FaMinus />
                    </button>
                    <input type="number" min={1} value={delta} onChange={e => setDelta(Math.max(1, Number(e.target.value) || 1))}
                        className="input" style={{ width: 52, textAlign: 'center', padding: '3px 4px', fontSize: '0.8rem' }} />
                    <button className="btn-primary text-xs" style={{ padding: '2px 8px', minWidth: 28 }} onClick={() => onHpDelta(delta)}>
                        <FaPlus />
                    </button>
                    {currentHp <= 0 && <FaSkull style={{ color: '#636e72', marginLeft: 4 }} />}
                </div>

                {/* Override chips */}
                {overrides.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {overrides.map((o, i) => (
                            <span key={i} className={`override-chip${o.value < 0 ? ' negative' : ''}`} style={{ fontSize: '0.62rem' }}>
                                {o.stat.toUpperCase()} {o.value >= 0 ? '+' : ''}{o.value} ({o.source})
                            </span>
                        ))}
                    </div>
                )}

                {/* Conditions */}
                {conditions && conditions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {conditions.map(c => <span key={c} className="badge-type" style={{ fontSize: '0.62rem' }}>{c}</span>)}
                    </div>
                )}

                {/* Key stats */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <span>CA {creature.ac}</span>
                    <span>BAB +{creature.bab}</span>
                    <span>For/Rif/Vol: {creature.fortitude}/{creature.reflex}/{creature.will}</span>
                </div>
                {extra}
            </div>
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
    const effHp = creature.hp + overrides.filter(o => o.stat === 'hp').reduce((s, o) => s + o.value, 0);

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
    } = useCharacterStore();

    const [tab, setTab] = useState<BestiaryTab>('catalogo');
    const [search, setSearch] = useState('');
    const [catalogItems, setCatalogItems] = useState<CatalogCreature[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [viewingCreature, setViewingCreature] = useState<{ creature: Creature; overrides?: CreatureStatOverride[]; entry?: BestiaryEntry } | null>(null);
    const [summonDialog, setSummonDialog] = useState<{ creature: Creature; overrides: CreatureStatOverride[]; entryId?: string } | null>(null);
    const [petDialog, setPetDialog] = useState<{ creature: Creature; overrides: CreatureStatOverride[]; entryId?: string } | null>(null);
    const [editingEntry, setEditingEntry] = useState<BestiaryEntry | null>(null);
    const [editingSummon, setEditingSummon] = useState<ActiveSummon | null>(null);
    const [editingPet, setEditingPet] = useState<ActivePet | null>(null);

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
        const effHp = creature.hp + overrides.filter(o => o.stat === 'hp').reduce((s, o) => s + o.value, 0);
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
        const effHp = creature.hp + overrides.filter(o => o.stat === 'hp').reduce((s, o) => s + o.value, 0);
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
    };

    /* ── Save personal creature edit ── */
    const saveEdit = (creature: Creature) => {
        if (!editingEntry) return;
        updateBestiaryEntry({ ...editingEntry, creature });
        setEditingEntry(null);
    };

    if (!character) return <div className="text-muted text-center" style={{ padding: 40 }}>Carica un personaggio per accedere al bestiario.</div>;

    /* ─────────────────── Editing personal creature ─────────────────── */
    if (editingEntry) {
        return (
            <div style={{ flex: 1, overflow: 'hidden auto', padding: 'var(--space-5)' }}>
                <CreatureEditor initial={editingEntry.creature} onSave={saveEdit} onCancel={() => setEditingEntry(null)} />
            </div>
        );
    }

    /* ─────────────────── Stat block detail sheet ─────────────────── */
    if (viewingCreature) {
        const { creature, overrides, entry } = viewingCreature;
        return (
            <div style={{ flex: 1, overflow: 'hidden auto', padding: 'var(--space-5)' }}>
                <StatBlock
                    creature={creature}
                    overrides={overrides ?? []}
                    onClose={() => setViewingCreature(null)}
                    actionLabel="Evoca"
                    actionIcon={<GiMagicSwirl />}
                    onAction={() => { setViewingCreature(null); openSummonDialog(creature, entry?.id); }}
                    actionLabel2="Aggiungi come Compagno"
                    actionIcon2={<FaPaw />}
                    onAction2={() => { setViewingCreature(null); openPetDialog(creature, entry?.id); }}
                />
            </div>
        );
    }

    /* ─────────────────── Editing active summon ─────────────────── */
    if (editingSummon) {
        return (
            <div style={{ flex: 1, overflow: 'hidden auto', padding: 'var(--space-5)' }}>
                <StatBlock
                    creature={editingSummon.creature}
                    overrides={editingSummon.appliedOverrides}
                    onClose={() => setEditingSummon(null)}
                    actionLabel="Rimuovi evocazione"
                    actionIcon={<FaTimes />}
                    onAction={() => { removeSummon(editingSummon.id); setEditingSummon(null); }}
                />
            </div>
        );
    }

    /* ─────────────────── Editing active pet ─────────────────── */
    if (editingPet) {
        return (
            <div style={{ flex: 1, overflow: 'hidden auto', padding: 'var(--space-5)' }}>
                <StatBlock
                    creature={editingPet.creature}
                    overrides={editingPet.appliedOverrides}
                    onClose={() => setEditingPet(null)}
                    actionLabel="Rimuovi compagno"
                    actionIcon={<FaTimes />}
                    onAction={() => { removePet(editingPet.id); setEditingPet(null); }}
                />
            </div>
        );
    }

    return (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 'var(--space-5)', gap: 'var(--space-3)' }} className="animate-fade-in">
            {/* Header */}
            <div className="section-header" style={{ flexShrink: 0 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FaDragon style={{ color: 'var(--accent-gold)' }} /> Bestiario
                    </h2>
                    <span className="text-muted text-sm">Creature, evocazioni e compagni</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {tab === 'personale' && (
                        <button className="btn-primary text-sm" onClick={() => {
                            const entry: BestiaryEntry = { id: uuid(), creature: EMPTY_CREATURE(), addedAt: new Date().toISOString() };
                            setEditingEntry(entry);
                        }}>
                            <FaPlus /> Nuova Creatura
                        </button>
                    )}
                    <div className="flex items-center gap-2" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.75rem' }}>
                        <FaSearch className="text-muted" style={{ fontSize: '0.8rem' }} />
                        <input style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', fontSize: '0.85rem', width: 160 }}
                            placeholder="Cerca…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bestiary-tabs" style={{ flexShrink: 0 }}>
                {([
                    { id: 'catalogo', label: 'Catalogo', icon: <FaDragon /> },
                    { id: 'personale', label: `Personale (${bestiary.length})`, icon: <GiScrollUnfurled /> },
                    { id: 'evocazioni', label: `Evocazioni (${summons.length})`, icon: <GiMagicSwirl /> },
                    { id: 'compagni', label: `Compagni (${pets.length})`, icon: <FaPaw /> },
                ] as const).map(t => (
                    <button key={t.id} className={`btn-secondary text-sm ${tab === t.id ? 'active' : ''}`}
                        style={tab === t.id ? { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' } : undefined}
                        onClick={() => setTab(t.id)}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* ── CATALOGO ── */}
                {tab === 'catalogo' && (
                    <div>
                        {catalogLoading && <div className="text-muted text-sm">Caricamento catalogo…</div>}
                        {!catalogLoading && filteredCatalog.length === 0 && (
                            <div className="text-muted text-sm">Nessuna creatura nel catalogo. Il SuperAdmin può aggiungerne dal BackOffice.</div>
                        )}
                        <div className="creature-grid">
                            {filteredCatalog.map(c => (
                                <div key={c.id} className="creature-card" onClick={() => setViewingCreature({ creature: c, overrides: computeSummonOverrides(c) })}>
                                    <div className="creature-card-img">
                                        {c.imageData && c.imageType === 'svg'
                                            ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: c.imageData }} />
                                            : c.imageData
                                                ? <img src={c.imageData} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <FaDragon />
                                        }
                                    </div>
                                    <div className="creature-card-body">
                                        <div className="creature-card-name">{c.name}</div>
                                        <div className="creature-card-meta">{c.size} {c.type}{c.subtype ? ` (${c.subtype})` : ''}{c.alignment ? ` · ${c.alignment}` : ''}</div>
                                        <div className="creature-card-meta">CR {c.challengeRating ?? '?'} · CA {c.ac} · PF {c.hp}</div>
                                        <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                            <button className="btn-secondary text-xs" onClick={() => openSummonDialog(c, undefined)}><GiMagicSwirl /> Evoca</button>
                                            <button className="btn-secondary text-xs" onClick={() => openPetDialog(c, undefined)}><FaPaw /> Compagno</button>
                                            {!bestiary.some(e => e.catalogId === c.id) && (
                                                <button className="btn-ghost text-xs" onClick={() => addToBestiary(c)}><FaPlus /> Personale</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── PERSONALE ── */}
                {tab === 'personale' && (
                    <div>
                        {filteredBestiary.length === 0 && (
                            <div className="text-muted text-sm">Nessuna creatura nel bestiario personale. Aggiungila dal catalogo o creane una nuova.</div>
                        )}
                        <div className="creature-grid">
                            {filteredBestiary.map(entry => (
                                <div key={entry.id} className="creature-card" onClick={() => setViewingCreature({ creature: entry.creature, overrides: computeSummonOverrides(entry.creature), entry })}>
                                    <div className="creature-card-img">
                                        {entry.creature.imageData && entry.creature.imageType === 'svg'
                                            ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: entry.creature.imageData }} />
                                            : entry.creature.imageData
                                                ? <img src={entry.creature.imageData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <FaDragon />
                                        }
                                    </div>
                                    <div className="creature-card-body">
                                        <div className="creature-card-name">{entry.creature.name}</div>
                                        <div className="creature-card-meta">{entry.creature.size} {entry.creature.type}</div>
                                        <div className="creature-card-meta">CR {entry.creature.challengeRating ?? '?'} · CA {entry.creature.ac} · PF {entry.creature.hp}</div>
                                        {entry.characterNotes && <div className="creature-card-meta" style={{ fontStyle: 'italic', marginTop: 4 }}>"{entry.characterNotes}"</div>}
                                        <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                            <button className="btn-secondary text-xs" onClick={() => openSummonDialog(entry.creature, entry.id)}><GiMagicSwirl /> Evoca</button>
                                            <button className="btn-secondary text-xs" onClick={() => openPetDialog(entry.creature, entry.id)}><FaPaw /> Compagno</button>
                                            <button className="btn-ghost text-xs" onClick={() => setEditingEntry(entry)}><FaEdit /></button>
                                            <button className="btn-ghost text-xs" style={{ color: 'var(--accent-crimson)' }} onClick={() => { if (confirm(`Rimuovere ${entry.creature.name} dal bestiario personale?`)) removeBestiaryEntry(entry.id); }}><FaTrash /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── EVOCAZIONI ── */}
                {tab === 'evocazioni' && (
                    <div>
                        {summons.length === 0 && <div className="text-muted text-sm">Nessuna creatura evocata. Vai al catalogo o al bestiario personale per evocare.</div>}
                        <div className="tracker-grid">
                            {summons.map(s => {
                                const effHp = s.creature.hp + s.appliedOverrides.filter(o => o.stat === 'hp').reduce((acc, o) => acc + o.value, 0);
                                return (
                                    <TrackerCard
                                        key={s.id}
                                        name={s.creature.name}
                                        creature={s.creature}
                                        currentHp={s.currentHp}
                                        maxHp={effHp}
                                        overrides={s.appliedOverrides}
                                        conditions={s.conditions}
                                        onHpDelta={delta => updateSummonHp(s.id, delta)}
                                        onDismiss={() => { if (confirm(`Rimuovere evocazione di ${s.creature.name}?`)) removeSummon(s.id); }}
                                        onEdit={() => setEditingSummon(s)}
                                        extra={
                                            <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {s.summonSpellName && <span><FaBolt style={{ color: 'var(--accent-arcane)' }} /> {s.summonSpellName}</span>}
                                                {s.roundsRemaining !== null && s.roundsRemaining !== undefined && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        ⏱ {s.roundsRemaining} round
                                                        <button className="btn-ghost" style={{ fontSize: '0.65rem', padding: '1px 4px' }}
                                                            onClick={() => updateSummon({ ...s, roundsRemaining: Math.max(0, (s.roundsRemaining ?? 0) - 1) })}>-1</button>
                                                    </span>
                                                )}
                                            </div>
                                        }
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── COMPAGNI ── */}
                {tab === 'compagni' && (
                    <div>
                        {pets.length === 0 && <div className="text-muted text-sm">Nessun compagno. Vai al catalogo o al bestiario personale e usa "Aggiungi come Compagno".</div>}
                        <div className="tracker-grid">
                            {pets.map(p => {
                                const effHp = p.creature.hp + p.appliedOverrides.filter(o => o.stat === 'hp').reduce((acc, o) => acc + o.value, 0);
                                return (
                                    <TrackerCard
                                        key={p.id}
                                        name={p.nickname ?? p.creature.name}
                                        creature={p.creature}
                                        currentHp={p.currentHp}
                                        maxHp={effHp}
                                        overrides={p.appliedOverrides}
                                        conditions={p.conditions}
                                        onHpDelta={delta => updatePetHp(p.id, delta)}
                                        onDismiss={() => { if (confirm(`Rimuovere ${p.nickname ?? p.creature.name}?`)) removePet(p.id); }}
                                        onEdit={() => setEditingPet(p)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

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
