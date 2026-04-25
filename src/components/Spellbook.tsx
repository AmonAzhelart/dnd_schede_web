import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaMoon, FaBookOpen, FaCalendarDay, FaMinus, FaSearch, FaClock, FaArrowsAltH, FaHourglass, FaShieldAlt, FaFeather, FaBolt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { GiSpellBook, GiCrystalBall, GiBookmarklet } from 'react-icons/gi';
import type { Spell } from '../types/dnd';
import { spellCatalog, type CatalogSpell } from '../services/admin';
import { useIconCatalog } from '../services/iconCache';
import { CatalogPicker } from './CatalogPicker';
import { DndIcon, getDndIconSvg } from './DndIcon';
import { useMediaQuery } from './mobile/MobileShell';
import { BottomDrawer } from './ui/BottomDrawer';

/** Italian school name → english slug for `src/assets/icons/spell/<slug>.svg`. */
const SCHOOL_ICON_SLUG: Record<string, string> = {
  'Abiurazione': 'abjuration',
  'Ammaliamento': 'enchantment',
  'Divinazione': 'divination',
  'Evocazione': 'conjuration',
  'Illusione': 'illusion',
  'Invocazione': 'evocation',
  'Necromanzia': 'necromancy',
  'Trasmutazione': 'transmutation',
};
import './Spellbook.css';

type SpellTab = 'grimoire' | 'daily';

const SCHOOLS = ['Abiurazione', 'Ammaliamento', 'Divinazione', 'Evocazione', 'Illusione', 'Invocazione', 'Necromanzia', 'Trasmutazione'];

const SCHOOL_COLOR: Record<string, string> = {
  'Evocazione': 'var(--accent-crimson)',
  'Invocazione': 'var(--accent-gold)',
  'Abiurazione': 'var(--accent-ice)',
  'Ammaliamento': 'var(--accent-arcane)',
  'Divinazione': 'var(--accent-success)',
  'Illusione': '#a29bfe',
  'Necromanzia': '#636e72',
  'Trasmutazione': '#fdcb6e',
};

const LEVEL_COLOR: Record<number, string> = {
  0: '#74b9ff',
  1: 'var(--accent-arcane)',
  2: '#a29bfe',
  3: 'var(--accent-ice)',
  4: '#00cec9',
  5: '#fdcb6e',
  6: 'var(--accent-gold)',
  7: 'var(--accent-warning)',
  8: 'var(--accent-crimson)',
  9: '#e84393',
};

const SCHOOL_ICON: Record<string, string> = {
  'Evocazione': '🔥', 'Invocazione': '✨', 'Abiurazione': '🛡',
  'Ammaliamento': '💫', 'Divinazione': '🔮', 'Illusione': '👁',
  'Necromanzia': '💀', 'Trasmutazione': '⚗',
};

const EMPTY_SPELL = (): Omit<Spell, 'id'> => ({
  name: '', level: 1, school: 'Evocazione', description: '',
  castingTime: '', range: '', duration: '', savingThrow: '', components: '',
  attackMode: 'none', baseDice: '', damageType: '', saveStat: 'int',
  upcastDice: '', upcastEveryLevels: 1, upcastMaxSteps: undefined,
});

const LevelLabel = (level: number) => level === 0 ? 'Trucchetti' : `Livello ${level}`;

// ── Sub-component prop types ────────────────────────────────────────────────
interface SpellEditFormProps {
  form: Omit<Spell, 'id'>;
  setForm: React.Dispatch<React.SetStateAction<Omit<Spell, 'id'>>>;
  saveSpell: () => void;
  cancelEdit: () => void;
  editingId: string | null;
  autoFocus?: boolean;
}
interface SpellRowProps {
  spell: Spell;
  editingId: string | null;
  prepCountFor: (spellId: string) => number;
  slots: Record<string, { total: number; used: number }>;
  prepareWizardSpell: (level: number, spellId: string) => void;
  unprepareSpellOne: (spellId: string) => void;
  startEdit: (spell: Spell) => void;
  deleteSpell: (id: string) => void;
  formProps: SpellEditFormProps;
  isMobile?: boolean;
}

// ── Sub-components at module level (prevents remount on parent re-render) ─────
const SpellEditForm: React.FC<SpellEditFormProps> = ({ form, setForm, saveSpell, cancelEdit, editingId, autoFocus }) => (
  <div className="sb-edit-form">
    <div className="sb-form-row">
      <input className="input" autoFocus={autoFocus} placeholder="Nome incantesimo *" value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') saveSpell(); if (e.key === 'Escape') cancelEdit(); }}
        style={{ flex: '1 1 200px', fontSize: '0.85rem' }} />
      <div className="sb-form-field">
        <label className="sb-form-label">Livello</label>
        <input className="input" type="number" min={0} max={9} value={form.level}
          onChange={e => setForm(f => ({ ...f, level: Math.min(9, Math.max(0, +e.target.value)) }))}
          style={{ width: 64, fontSize: '0.85rem', textAlign: 'center' }} />
      </div>
      <div className="sb-form-field">
        <label className="sb-form-label">Scuola</label>
        <select className="input" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
          style={{ flex: '0 0 145px', fontSize: '0.85rem' }}>
          {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
    <textarea className="input" placeholder="Descrizione ed effetti..." value={form.description}
      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      style={{ width: '100%', minHeight: 56, fontSize: '0.82rem', resize: 'vertical' }} />
    <div className="sb-form-row">
      {([['castingTime', 'Tempo di lancio'], ['range', 'Gittata'], ['duration', 'Durata'], ['savingThrow', 'Tiro Salvezza'], ['components', 'Componenti']] as [keyof Omit<Spell, 'id'>, string][]).map(([field, label]) => (
        <div key={field} className="sb-form-field" style={{ flex: '1 1 120px' }}>
          <label className="sb-form-label">{label}</label>
          <input className="input" value={(form[field] as string) ?? ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            style={{ fontSize: '0.8rem' }} />
        </div>
      ))}
    </div>
    {/* Danno & Combattimento */}
    <div style={{ border: '1px solid rgba(155,89,182,0.18)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>DANNO &amp; COMBATTIMENTO (opzionale)</div>
      <div className="sb-form-row">
        <div className="sb-form-field" style={{ flex: '1 1 200px' }}>
          <label className="sb-form-label">Tipo di TxC</label>
          <select className="input" value={form.attackMode ?? 'none'} onChange={e => setForm(f => ({ ...f, attackMode: e.target.value as Spell['attackMode'] }))} style={{ fontSize: '0.8rem' }}>
            <option value="none">Nessuno</option>
            <option value="rangedTouch">Tocco a distanza</option>
            <option value="meleeTouch">Tocco in mischia</option>
            <option value="ray">Raggio</option>
            <option value="normal">Attacco normale</option>
          </select>
        </div>
        <div className="sb-form-field" style={{ flex: '1 1 120px' }}>
          <label className="sb-form-label">Dadi base (es. 2d6)</label>
          <input className="input" value={form.baseDice ?? ''} onChange={e => setForm(f => ({ ...f, baseDice: e.target.value }))} placeholder="vuoto = nessun danno" style={{ fontSize: '0.8rem' }} />
        </div>
        <div className="sb-form-field" style={{ flex: '1 1 120px' }}>
          <label className="sb-form-label">Tipo danno</label>
          <input className="input" value={form.damageType ?? ''} onChange={e => setForm(f => ({ ...f, damageType: e.target.value }))} placeholder="fuoco, freddo…" style={{ fontSize: '0.8rem' }} />
        </div>
        <div className="sb-form-field" style={{ flex: '0 0 80px' }}>
          <label className="sb-form-label">CD da</label>
          <select className="input" value={form.saveStat ?? 'int'} onChange={e => setForm(f => ({ ...f, saveStat: e.target.value as Spell['saveStat'] }))} style={{ fontSize: '0.8rem' }}>
            {(['int', 'wis', 'cha', 'str', 'dex', 'con'] as const).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
      </div>
      {/* Upcast row */}
      <div className="sb-form-row" style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed rgba(155,89,182,0.18)' }}>
        <div className="sb-form-field" style={{ flex: '1 1 160px' }}>
          <label className="sb-form-label">Upcast: dadi extra/step</label>
          <input className="input" value={form.upcastDice ?? ''}
            onChange={e => setForm(f => ({ ...f, upcastDice: e.target.value }))}
            placeholder="es. 1d6 (vuoto = nessun upcast)" style={{ fontSize: '0.8rem' }} />
        </div>
        <div className="sb-form-field" style={{ flex: '0 0 90px' }}>
          <label className="sb-form-label">Liv. slot/step</label>
          <input className="input" type="number" min={1} value={form.upcastEveryLevels ?? 1}
            onChange={e => setForm(f => ({ ...f, upcastEveryLevels: Math.max(1, +e.target.value || 1) }))}
            title="Livelli di slot sopra il livello base per +1 step" style={{ fontSize: '0.8rem' }} />
        </div>
        <div className="sb-form-field" style={{ flex: '0 0 80px' }}>
          <label className="sb-form-label">Max step</label>
          <input className="input" type="number" min={1} value={form.upcastMaxSteps ?? ''}
            onChange={e => setForm(f => ({ ...f, upcastMaxSteps: e.target.value === '' ? undefined : Math.max(1, +e.target.value) }))}
            placeholder="—" style={{ fontSize: '0.8rem' }} />
        </div>
      </div>
    </div>
    <div className="sb-form-actions">
      <button onClick={cancelEdit} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Annulla</button>
      <button onClick={saveSpell} className="btn-primary" style={{ fontSize: '0.8rem', justifyContent: 'center', opacity: form.name.trim() ? 1 : 0.5 }}>
        <FaCheck size={10} /> {editingId ? 'Aggiorna' : 'Aggiungi al Grimorio'}
      </button>
    </div>
  </div>
);

// ── Bookmark tab ─────────────────────────────────────────────────────────────
const BookmarkTab: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}> = ({ active, onClick, label, count, icon }) => (
  <button onClick={onClick} className={`sb-bookmark${active ? ' active' : ''}`}>
    {icon}
    {label}
    <span className="sb-bookmark-count">{count}</span>
  </button>
);

// ── Slot pips (visual indicator of used vs available slots) ──────────────────
const SlotPips: React.FC<{ total: number; used: number; color: string }> = ({ total, used, color }) => {
  const safeTotal = Math.max(0, Math.min(total, 12));
  return (
    <div className="sb-slot-pips" aria-label={`${used}/${total} slot usati`}>
      {Array.from({ length: safeTotal }, (_, i) => {
        const isUsed = i < used;
        return (
          <span
            key={i}
            className="sb-pip"
            style={{
              background: isUsed ? 'transparent' : color,
              border: `1px solid ${color}`,
              opacity: isUsed ? 0.35 : 1,
            }}
          />
        );
      })}
    </div>
  );
};

// ── Level picker popover (choose any level 0-9) ──────────────────────────────
const LevelPickerPopover: React.FC<{
  anchorRef: React.RefObject<HTMLElement | null>;
  taken: number[];
  onPick: (lvl: number) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  title?: string;
}> = ({ anchorRef, taken, onPick, onClose, align = 'right', title = 'Scegli un livello' }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 240;
      const left = align === 'right' ? r.right - width : r.left;
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - width - 8, left)) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [anchorRef, align]);

  if (!pos) return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      <div style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 240,
        background: 'rgba(28,28,39,0.98)', border: '1px solid rgba(155,89,182,0.4)',
        borderRadius: 6, padding: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {Array.from({ length: 10 }, (_, lvl) => {
            const isTaken = taken.includes(lvl);
            return (
              <button key={lvl} disabled={isTaken}
                onClick={() => { onPick(lvl); onClose(); }}
                title={lvl === 0 ? 'Trucchetti' : `Livello ${lvl}`}
                style={{
                  height: 40, borderRadius: 5,
                  background: isTaken ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, rgba(155,89,182,0.2), rgba(108,52,131,0.15))',
                  border: `1px solid ${isTaken ? 'rgba(255,255,255,0.05)' : 'rgba(155,89,182,0.4)'}`,
                  color: isTaken ? 'var(--text-muted)' : 'var(--accent-arcane)',
                  fontFamily: 'var(--font-heading)', fontSize: '1rem',
                  cursor: isTaken ? 'not-allowed' : 'pointer',
                  opacity: isTaken ? 0.4 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
                }}>
                <span>{lvl}</span>
                {lvl === 0 && <span style={{ fontSize: '0.55rem', opacity: 0.7, letterSpacing: 0 }}>tr.</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
};

// ── Spell card ─────────────────────────────────────────────────────────────────
const SpellCard: React.FC<SpellRowProps> = ({ spell, editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps, isMobile }) => {
  const prepCount = prepCountFor(spell.id);
  const isEdit = editingId === spell.id;
  const color = SCHOOL_COLOR[spell.school] ?? 'var(--text-muted)'; const { resolveSchoolSvg, sanitizeSvg } = useIconCatalog();
  const schoolSvg = resolveSchoolSvg(spell.school); const [descExpanded, setDescExpanded] = useState(false);
  const MAX_DESC = 120;
  const needsTruncation = (spell.description?.length ?? 0) > MAX_DESC;
  const slot = slots[String(spell.level)];
  const slotsLeft = slot ? slot.total - slot.used : 0;
  const canPrepare = spell.level === 0 || slotsLeft > 0 || prepCount < (slot?.total ?? 0);
  // On mobile, the edit form is shown in a BottomDrawer — don't replace the card inline.
  if (isEdit && !isMobile) return <SpellEditForm {...formProps} />;

  const stats: [React.ReactNode, string | undefined, string][] = [
    [<FaClock size={9} />, spell.castingTime, 'Tempo'],
    [<FaArrowsAltH size={9} />, spell.range, 'Gittata'],
    [<FaHourglass size={9} />, spell.duration, 'Durata'],
    [<FaShieldAlt size={9} />, spell.savingThrow, 'TS'],
    [<FaFeather size={9} />, spell.components, 'Comp.'],
  ];
  const visibleStats = stats.filter(([, v]) => v && v.trim());

  return (
    <div className="sb-card" style={{
      '--c': color,
      borderColor: `${color}33`,
      background: `linear-gradient(160deg, ${color}10 0%, rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.18) 100%), rgba(20,20,30,0.55)`,
      boxShadow: `0 2px 8px rgba(0,0,0,0.35)`,
    } as React.CSSProperties}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `0 6px 20px ${color}35, 0 2px 8px rgba(0,0,0,0.4)`;
        el.style.borderColor = `${color}60`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
        el.style.borderColor = `${color}33`;
      }}>

      {/* Top accent bar */}
      <div className="sb-card-accent" style={{ background: `linear-gradient(90deg, ${color}, ${color}44, transparent)` }} />

      {/* Edit / delete buttons */}
      <div className="sb-card-btns">
        <button className="sb-icon-btn edit" onClick={() => startEdit(spell)} title="Modifica"><FaEdit size={10} /></button>
        <button className="sb-icon-btn del" onClick={() => deleteSpell(spell.id)} title="Elimina"><FaTrash size={10} /></button>
      </div>

      {/* Header */}
      <div className="sb-card-header" style={{ background: `linear-gradient(180deg, ${color}0e, transparent)`, borderBottomColor: `${color}18` }}>
        <div className="sb-card-level" style={{ background: `linear-gradient(135deg, ${color}, ${color}77)`, boxShadow: `0 2px 6px ${color}44`, fontSize: spell.level === 0 ? undefined : '1rem' }}
          {...(spell.level === 0 ? { className: 'sb-card-level trucchetto' } : {})}>
          {spell.level === 0 ? 'TR' : spell.level}
        </div>
        <div className="sb-card-info">
          <span className="sb-card-name">{spell.name}</span>
          <span className="sb-card-school" style={{ color }}>
            {schoolSvg ? (
              <span
                className="sb-card-school-svg inv-svg-tinted"
                style={{ color }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvg(schoolSvg) }}
              />
            ) : SCHOOL_ICON_SLUG[spell.school] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[spell.school]) ? (
              <DndIcon
                category="spell"
                name={SCHOOL_ICON_SLUG[spell.school]}
                size={14}
                style={{ color }}
              />
            ) : (
              SCHOOL_ICON[spell.school] ?? ''
            )} {spell.school}
          </span>
        </div>
      </div>

      {/* Description */}
      {spell.description && (
        <div className="sb-card-desc-wrap">
          <p className="sb-card-desc">
            {needsTruncation && !descExpanded ? spell.description.slice(0, MAX_DESC) + '…' : spell.description}
          </p>
          {needsTruncation && (
            <button className="sb-desc-toggle" style={{ color }} onClick={() => setDescExpanded(e => !e)}>
              {descExpanded ? <><FaEyeSlash size={9} /> Meno</> : <><FaEye size={9} /> Mostra di più</>}
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {visibleStats.length > 0 && (
        <div className="sb-card-stats">
          {visibleStats.map(([icon, val, label]) => (
            <div key={label} className="sb-stat">
              <span className="sb-stat-icon">{icon}</span>
              <span className="sb-stat-label">{label}</span>
              <span className="sb-stat-value">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: prep controls */}
      <div className="sb-card-footer" style={{ background: `linear-gradient(180deg, transparent, ${color}0c)`, borderTopColor: `${color}18` }}>
        <div className={`sb-prep-counter${prepCount > 0 ? ' has-preps' : ''}`}
          style={prepCount > 0 ? { '--c-border': `${color}44`, '--c-bg': `${color}14`, '--c-color': color } as React.CSSProperties : {}}>
          <button className="sb-prep-minus" onClick={() => unprepareSpellOne(spell.id)} disabled={prepCount === 0} title="Rimuovi una preparazione">
            <FaMinus size={9} />
          </button>
          <span className="sb-prep-count">{prepCount}×</span>
        </div>
        <button
          className={`sb-prepare-btn${canPrepare ? ' can-prepare' : ''}`}
          onClick={() => { if (canPrepare) prepareWizardSpell(spell.level, spell.id); }}
          disabled={!canPrepare}
          title={canPrepare ? 'Prepara una copia di questo incantesimo' : 'Nessuno slot disponibile'}
          style={canPrepare ? {
            '--c-btn-bg': `${color}22`,
            '--c-btn-border': `${color}66`,
          } as React.CSSProperties : {}}>
          <FaPlus size={10} /> Prepara
        </button>
      </div>
    </div>
  );
};

export const Spellbook: React.FC = () => {
  const {
    character, addSpell, updateSpell, deleteSpell, setSpellSlotTotal,
    prepareWizardSpell, unprepareWizardSpell, castPreparedSpell, restorePreparedSpell, restWizardSpells,
  } = useCharacterStore();
  const [spellTab, setSpellTab] = useState<SpellTab>('grimoire');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [pickerLvl, setPickerLvl] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Spell, 'id'>>(EMPTY_SPELL());
  const [grimSelected, setGrimSelected] = useState<number | 'all'>('all');
  const [grimSearch, setGrimSearch] = useState('');
  const [grimLvlPickerOpen, setGrimLvlPickerOpen] = useState(false);
  const [dailyLvlPickerOpen, setDailyLvlPickerOpen] = useState(false);
  const grimLvlBtnRef = useRef<HTMLButtonElement>(null);
  const dailyLvlBtnRef = useRef<HTMLButtonElement>(null);

  // Catalog picker
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogSpell[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const openCatalogPicker = async () => {
    setCatalogOpen(true);
    if (catalogItems.length === 0) {
      setCatalogLoading(true);
      setCatalogItems(await spellCatalog.list());
      setCatalogLoading(false);
    }
  };
  const importFromCatalog = (cs: CatalogSpell) => {
    addSpell({
      id: uuidv4(),
      name: cs.name,
      level: cs.level,
      school: cs.school,
      description: cs.description,
      castingTime: cs.castingTime ?? '',
      range: cs.range ?? '',
      duration: cs.duration ?? '',
      savingThrow: cs.savingThrow ?? '',
      components: cs.components ?? '',
      attackMode: cs.attackMode,
      baseDice: cs.baseDice ?? cs.damagePerLevelDice,
      damageType: cs.damageType,
      saveStat: cs.saveStat,
      upcastDice: cs.upcastDice,
      upcastEveryLevels: cs.upcastEveryLevels,
      upcastMaxSteps: cs.upcastMaxSteps,
    });
    setCatalogOpen(false);
  };

  if (!character) return null;

  const spells = character.spells ?? [];
  const slots = character.spellSlots ?? {};
  const prepByLevel = character.preparedSpellsByLevel ?? {};

  // Levels that exist in grimoire
  const levels = [...new Set(spells.map(s => s.level))].sort((a, b) => a - b);
  // Levels in slot config or with preparations
  const slotLevels = Array.from(new Set([
    ...Object.keys(slots).filter(k => slots[k].total > 0).map(Number),
    ...Object.keys(prepByLevel).filter(k => (prepByLevel[k]?.length ?? 0) > 0).map(Number),
  ])).sort((a, b) => a - b);

  // Helper: count of preparations of a given spell across all levels
  const prepCountFor = (spellId: string): number => {
    let n = 0;
    for (const list of Object.values(prepByLevel)) {
      for (const p of list) if (p.spellId === spellId) n++;
    }
    return n;
  };

  // Remove ONE preparation of this spell (preferring one not yet cast)
  const unprepareSpellOne = (spellId: string) => {
    for (const [k, list] of Object.entries(prepByLevel)) {
      const lvl = parseInt(k, 10);
      const free = list.find(p => p.spellId === spellId && !p.cast);
      if (free) { unprepareWizardSpell(lvl, free.id); return; }
    }
    for (const [k, list] of Object.entries(prepByLevel)) {
      const lvl = parseInt(k, 10);
      const any = list.find(p => p.spellId === spellId);
      if (any) { unprepareWizardSpell(lvl, any.id); return; }
    }
  };

  // Total preparations count for daily tab badge
  const totalPreps = Object.values(prepByLevel).reduce((acc, l) => acc + l.length, 0);

  const saveSpell = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      updateSpell({ ...form, id: editingId });
    } else {
      addSpell({ ...form, id: uuidv4() });
    }
    setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL());
  };
  const startEdit = (spell: Spell) => {
    setForm({
      name: spell.name, level: spell.level, school: spell.school, description: spell.description ?? '',
      castingTime: spell.castingTime ?? '', range: spell.range ?? '', duration: spell.duration ?? '',
      savingThrow: spell.savingThrow ?? '', components: spell.components ?? '',
      attackMode: spell.attackMode ?? 'none',
      baseDice: spell.baseDice ?? spell.damagePerLevelDice ?? '',
      damageType: spell.damageType ?? '',
      saveStat: spell.saveStat ?? 'int',
      upcastDice: spell.upcastDice ?? '',
      upcastEveryLevels: spell.upcastEveryLevels ?? 1,
      upcastMaxSteps: spell.upcastMaxSteps,
    });
    setEditingId(spell.id); setIsAdding(false);
  };
  const cancelEdit = () => { setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL()); };

  const formProps: SpellEditFormProps = { form, setForm, saveSpell, cancelEdit, editingId };
  const cardProps = { editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps, isMobile };

  // Spell lookup
  const spellById = new Map<string, Spell>();
  spells.forEach(s => spellById.set(s.id, s));

  // Grimorie filtered list
  const grimSearchLower = grimSearch.trim().toLowerCase();
  const filteredGrimSpells = spells.filter(s => {
    if (grimSelected !== 'all' && s.level !== grimSelected) return false;
    if (grimSearchLower && !s.name.toLowerCase().includes(grimSearchLower) && !s.school.toLowerCase().includes(grimSearchLower)) return false;
    return true;
  });
  // Group filtered by level for "all" view
  const filteredByLevel = new Map<number, Spell[]>();
  filteredGrimSpells.forEach(s => {
    if (!filteredByLevel.has(s.level)) filteredByLevel.set(s.level, []);
    filteredByLevel.get(s.level)!.push(s);
  });
  const filteredLevelKeys = [...filteredByLevel.keys()].sort((a, b) => a - b);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Tab switcher */}
      <div className="sb-tabs">
        {([['grimoire', <><FaBookOpen size={11} /> Grimorio</>, spells.length],
        ['daily', <><FaCalendarDay size={11} /> Incantesimi del Giorno</>, totalPreps]] as [SpellTab, React.ReactNode, number][]).map(([key, label, cnt]) => (
          <button key={key} className={`sb-tab${spellTab === key ? ' active' : ''}`} onClick={() => setSpellTab(key)}>
            {label}
            <span className="sb-tab-badge">{cnt}</span>
          </button>
        ))}
        <button className="sb-rest-btn" onClick={restWizardSpells} title="Riposo lungo: ripristina slot e annulla i lanci">
          <FaMoon size={10} /> Riposo Lungo
        </button>
      </div>

      {/* ── GRIMOIRE TAB (rubrica) ── */}
      {spellTab === 'grimoire' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Action bar: search + add */}
          <div className="sb-action-bar">
            <div className="sb-search-wrap">
              <FaSearch size={11} className="sb-search-icon" />
              <input className="sb-search-input" value={grimSearch} onChange={e => setGrimSearch(e.target.value)}
                placeholder="Cerca per nome o scuola..." />
            </div>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}
              onClick={() => {
                setIsAdding(true); setEditingId(null);
                setForm({ ...EMPTY_SPELL(), level: grimSelected === 'all' ? 1 : grimSelected });
              }}
              disabled={isAdding}>
              <FaPlus size={10} /> Aggiungi Incantesimo
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }}
              onClick={openCatalogPicker} disabled={isAdding}>
              <GiBookmarklet size={11} /> Dal Catalogo
            </button>
          </div>

          {/* Bookmarks strip (rubrica tabs) */}
          <div className="sb-bookmarks">
            <BookmarkTab active={grimSelected === 'all'} onClick={() => setGrimSelected('all')} label="Tutti" count={spells.length} icon={<GiBookmarklet size={11} />} />
            {levels.map(lv => (
              <BookmarkTab key={lv} active={grimSelected === lv} onClick={() => setGrimSelected(lv)} label={lv === 0 ? 'Trucch.' : `Lv ${lv}`} count={spells.filter(s => s.level === lv).length} />
            ))}
            {typeof grimSelected === 'number' && !levels.includes(grimSelected) && (
              <BookmarkTab active={true} onClick={() => setGrimSelected(grimSelected)} label={grimSelected === 0 ? 'Trucch.' : `Lv ${grimSelected}`} count={0} />
            )}
            <button ref={grimLvlBtnRef} className="sb-bookmark-add" onClick={() => setGrimLvlPickerOpen(o => !o)} title="Aggiungi un nuovo segnalibro di livello">
              <FaPlus size={9} /> Livello
            </button>
            {grimLvlPickerOpen && (
              <LevelPickerPopover anchorRef={grimLvlBtnRef} taken={levels}
                onPick={(lvl) => { setGrimSelected(lvl); setIsAdding(true); setEditingId(null); setForm({ ...EMPTY_SPELL(), level: lvl }); }}
                onClose={() => setGrimLvlPickerOpen(false)} align="left" title="Aggiungi un livello al grimorio" />
            )}
          </div>

          {/* Add form — inline on desktop, BottomDrawer on mobile */}
          {isAdding && !isMobile && <div style={{ flexShrink: 0 }}><SpellEditForm {...formProps} autoFocus /></div>}

          {/* Cards area */}
          {spells.length === 0 && !isAdding ? (
            <div className="sb-empty">
              <GiSpellBook size={32} className="sb-empty-icon" />
              <p className="sb-empty-text">Il grimorio è vuoto.</p>
              <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => { setIsAdding(true); setForm({ ...EMPTY_SPELL(), level: 1 }); }}>
                <FaPlus size={10} /> Aggiungi il primo incantesimo
              </button>
            </div>
          ) : filteredGrimSpells.length === 0 ? (
            <div className="sb-empty">
              <p className="sb-empty-text">
                {grimSearchLower
                  ? <>Nessun incantesimo corrisponde a <strong>"{grimSearch}"</strong>.</>
                  : <>Nessun incantesimo di {grimSelected === 'all' ? 'questo grimorio' : (grimSelected === 0 ? 'trucchetto' : `livello ${grimSelected}`)}.</>}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 8 }}>
              {grimSelected === 'all' ? (
                filteredLevelKeys.map(lv => (
                  <div key={lv} style={{ marginBottom: 14 }}>
                    <div className="sb-level-hdr">
                      <div className="sb-level-badge">{lv === 0 ? 'TR' : lv}</div>
                      <span className="sb-level-label">{LevelLabel(lv)}</span>
                      <div className="sb-level-line" />
                      <span className="sb-level-count">{filteredByLevel.get(lv)!.length} {filteredByLevel.get(lv)!.length === 1 ? 'incantesimo' : 'incantesimi'}</span>
                    </div>
                    <div className="sb-cards-grid">
                      {filteredByLevel.get(lv)!.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="sb-cards-grid">
                  {filteredGrimSpells.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── DAILY TAB ── */}
      {spellTab === 'daily' && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header / actions */}
          <div className="sb-daily-hdr">
            <GiSpellBook size={22} style={{ color: 'var(--accent-arcane)', flexShrink: 0 }} />
            <div className="sb-daily-hdr-info">
              <span className="sb-daily-hdr-title">Preparazione del Mago</span>
              <span className="sb-daily-hdr-sub">Prepara più copie dello stesso incantesimo: ognuna può essere lanciata una sola volta.</span>
            </div>
            <button ref={dailyLvlBtnRef}
              style={{ background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.3)', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', color: 'var(--accent-arcane)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setDailyLvlPickerOpen(o => !o)}>
              <FaPlus size={9} /> Aggiungi livello
            </button>
            {dailyLvlPickerOpen && (
              <LevelPickerPopover anchorRef={dailyLvlBtnRef} taken={slotLevels}
                onPick={(lvl) => setSpellSlotTotal(lvl, Math.max(1, slots[String(lvl)]?.total ?? 1))}
                onClose={() => setDailyLvlPickerOpen(false)} align="right" title="Aggiungi un livello (anche trucchetti)" />
            )}
          </div>

          {slotLevels.length === 0 && (
            <div className="sb-empty">
              <GiCrystalBall size={32} className="sb-empty-icon" />
              <p className="sb-empty-text">Nessuno slot configurato.</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Aggiungi un livello qui sopra per cominciare a preparare gli incantesimi.</p>
            </div>
          )}

          {/* Per-level sections */}
          {slotLevels.map(lv => {
            const s = slots[String(lv)] ?? { total: 0, used: 0 };
            const available = s.total - s.used;
            const preps = prepByLevel[String(lv)] ?? [];
            const grimoireForLevel = spells.filter(sp => sp.level <= lv);
            const isPickerOpen = pickerLvl === lv;
            const lvName = lv === 0 ? 'Trucchetti' : `Livello ${lv}`;
            const accent = LEVEL_COLOR[lv] ?? 'var(--accent-arcane)';

            return (
              <div key={lv} className="sb-slot-section" style={{ borderLeft: `3px solid ${accent}` }}>
                {/* Level header */}
                <div className="sb-slot-hdr" style={{ background: `linear-gradient(90deg, ${accent}18, transparent)`, borderBottom: `1px solid ${accent}22` }}>
                  <div className={`sb-slot-level-badge${lv === 0 ? ' trucchetto' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 2px 10px ${accent}55` }}>
                    {lv === 0 ? 'TR' : lv}
                  </div>
                  <div className="sb-slot-info">
                    <span className="sb-slot-name" style={{ color: accent }}>{lvName}</span>
                    {s.total > 0 && <SlotPips total={s.total} used={s.used} color={accent} />}
                  </div>
                  <div className="sb-slot-counter" style={{ background: `${accent}16`, border: `1px solid ${accent}30` }}>
                    <span className="sb-slot-available" style={{ color: available > 0 ? accent : 'var(--text-muted)' }}>{available}</span>
                    <span className="sb-slot-total">/ {s.total} slot</span>
                  </div>
                  <div className="sb-slot-adjust">
                    <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, s.total + 1)} disabled={s.total >= 9}>+</button>
                    <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, Math.max(0, s.total - 1))}>−</button>
                  </div>
                  <button className="sb-prep-toggle-btn" onClick={() => setPickerLvl(isPickerOpen ? null : lv)}
                    style={{ background: isPickerOpen ? `${accent}33` : `${accent}18`, border: `1px solid ${accent}55`, color: accent }}>
                    <FaPlus size={9} /> {isPickerOpen ? 'Chiudi' : 'Prepara'}
                  </button>
                </div>

                {/* Picker (grimoire spells of this level) */}
                {isPickerOpen && (
                  <div className="sb-picker">
                    {grimoireForLevel.length === 0 ? (
                      <p className="sb-picker-empty">
                        Nessun incantesimo di livello {lv} (o inferiore) nel grimorio. Aggiungilo dalla scheda Grimorio.
                      </p>
                    ) : (
                      <div className="sb-picker-grid">
                        {grimoireForLevel.map(sp => {
                          const spColor = SCHOOL_COLOR[sp.school] ?? 'var(--text-muted)';
                          const isUpcast = sp.level < lv;
                          return (
                            <button key={sp.id} className="sb-pick-btn"
                              style={{ background: `${spColor}0d`, borderLeftColor: spColor }}
                              onMouseEnter={e => (e.currentTarget.style.background = `${spColor}22`)}
                              onMouseLeave={e => (e.currentTarget.style.background = `${spColor}0d`)}
                              onClick={() => prepareWizardSpell(lv, sp.id)}
                              title={isUpcast
                                ? `Prepara ${sp.name} (Liv. ${sp.level}) in uno slot di Liv. ${lv} — upcast`
                                : `Prepara una copia di ${sp.name}`}>
                              <FaPlus size={8} style={{ color: spColor, flexShrink: 0 }} />
                              <span className="sb-pick-btn-name">
                                {sp.name}
                                {isUpcast && <span style={{ marginLeft: 4, fontSize: '0.65rem', opacity: 0.8 }}>↑Lv{sp.level}</span>}
                              </span>
                              <span className="sb-pick-btn-school" style={{ color: spColor }}>{SCHOOL_ICON[sp.school] ?? ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Prepared instances list */}
                <div className="sb-prep-list" style={preps.length === 0 ? { padding: '12px 14px' } : {}}>
                  {preps.length === 0 ? (
                    <p className="sb-prep-list-empty">
                      Nessun incantesimo preparato per questo livello. Clicca <strong>Prepara</strong> per scegliere dal grimorio.
                    </p>
                  ) : (
                    <div className="sb-prep-grid">
                      {preps.map(p => {
                        const sp = spellById.get(p.spellId);
                        if (!sp) return null;
                        const spColor = SCHOOL_COLOR[sp.school] ?? 'var(--text-muted)';
                        return (
                          <div key={p.id} className={`sb-prep-item${p.cast ? ' cast' : ''}`}
                            style={{
                              background: p.cast ? 'rgba(255,255,255,0.02)' : `linear-gradient(135deg, ${spColor}12, rgba(0,0,0,0.18))`,
                              borderLeftColor: p.cast ? 'rgba(255,255,255,0.1)' : spColor,
                              borderRightColor: p.cast ? 'rgba(255,255,255,0.06)' : `${spColor}30`,
                              borderTopColor: p.cast ? 'rgba(255,255,255,0.06)' : `${spColor}30`,
                              borderBottomColor: p.cast ? 'rgba(255,255,255,0.06)' : `${spColor}30`,
                            }}>
                            <button className={`sb-cast-btn${!p.cast ? ' active' : ''}`}
                              onClick={() => p.cast ? restorePreparedSpell(lv, p.id) : castPreparedSpell(lv, p.id)}
                              title={p.cast ? 'Ripristina slot' : 'Lancia (consuma uno slot)'}
                              style={!p.cast ? { background: `radial-gradient(circle at 35% 35%, ${spColor}cc, ${spColor}55)`, border: `2px solid ${spColor}`, boxShadow: `0 2px 8px ${spColor}55` } : {}}>
                              {p.cast ? <FaMinus size={9} /> : <FaBolt size={9} />}
                            </button>
                            <div className="sb-prep-item-info">
                              <div className="sb-prep-item-name">
                                {sp.name}
                                {sp.level < lv && (
                                  <span style={{ marginLeft: 6, fontSize: '0.65rem', color: 'var(--accent-arcane)' }}
                                    title={`Upcast: preparato in slot di Lv ${lv} (base Lv ${sp.level})`}>
                                    ↑Lv{lv}
                                  </span>
                                )}
                              </div>
                              <div className="sb-prep-item-school" style={{ color: spColor }}>{SCHOOL_ICON[sp.school] ?? ''} {sp.school}</div>
                            </div>
                            <button className="sb-remove-btn" onClick={() => unprepareWizardSpell(lv, p.id)} title="Rimuovi questa preparazione">
                              <FaTrash size={9} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile: spell add/edit bottom drawer */}
      <BottomDrawer
        open={(isAdding || editingId !== null) && isMobile}
        onClose={cancelEdit}
        title={editingId ? 'Modifica Incantesimo' : 'Nuovo Incantesimo'}
        accentColor="var(--accent-arcane)"
      >
        <SpellEditForm {...formProps} autoFocus />
      </BottomDrawer>

      {catalogOpen && (
        <CatalogPicker<CatalogSpell>
          title="Importa dal Catalogo Magie"
          items={catalogItems}
          loading={catalogLoading}
          onClose={() => setCatalogOpen(false)}
          onPick={importFromCatalog}
          map={cs => ({
            id: cs.id,
            name: cs.name,
            subtitle: `Liv. ${cs.level}${cs.school ? ' — ' + cs.school : ''}`,
            description: cs.description,
            tags: cs.tags,
            raw: cs,
          })}
        />
      )}
    </div>
  );
};
