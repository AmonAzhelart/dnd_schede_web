import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaMoon, FaBookOpen, FaCalendarDay, FaMinus, FaSearch, FaClock, FaArrowsAltH, FaHourglass, FaShieldAlt, FaFeather, FaBolt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { GiSpellBook, GiCrystalBall, GiBookmarklet } from 'react-icons/gi';
import type { Spell } from '../types/dnd';

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
}

// ── Sub-components at module level (prevents remount on parent re-render) ─────
const SpellEditForm: React.FC<SpellEditFormProps> = ({ form, setForm, saveSpell, cancelEdit, editingId, autoFocus }) => (
  <div style={{ padding: '12px', background: 'rgba(155,89,182,0.06)', border: '1px solid rgba(155,89,182,0.25)', borderRadius: 6, margin: '4px 0' }}>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
      <input className="input" autoFocus={autoFocus} placeholder="Nome incantesimo *" value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') saveSpell(); if (e.key === 'Escape') cancelEdit(); }}
        style={{ flex: '1 1 200px', fontSize: '0.85rem' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <label style={{ fontSize: '0.67rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>LIVELLO</label>
        <input className="input" type="number" min={0} max={9} value={form.level}
          onChange={e => setForm(f => ({ ...f, level: Math.min(9, Math.max(0, +e.target.value)) }))}
          style={{ width: 64, fontSize: '0.85rem', textAlign: 'center' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <label style={{ fontSize: '0.67rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>SCUOLA</label>
        <select className="input" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
          style={{ flex: '0 0 145px', fontSize: '0.85rem' }}>
          {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
    <textarea className="input" placeholder="Descrizione ed effetti..." value={form.description}
      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      style={{ width: '100%', minHeight: 56, fontSize: '0.82rem', resize: 'vertical', marginBottom: 8 }} />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
      {([['castingTime', 'Tempo di lancio'], ['range', 'Gittata'], ['duration', 'Durata'], ['savingThrow', 'Tiro Salvezza'], ['components', 'Componenti']] as [keyof Omit<Spell, 'id'>, string][]).map(([field, label]) => (
        <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 120px' }}>
          <label style={{ fontSize: '0.67rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{label.toUpperCase()}</label>
          <input className="input" value={(form[field] as string) ?? ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            style={{ fontSize: '0.8rem' }} />
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <button onClick={cancelEdit} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Annulla</button>
      <button onClick={saveSpell} className="btn-primary" style={{ fontSize: '0.8rem', justifyContent: 'center', opacity: form.name.trim() ? 1 : 0.5 }}>
        <FaCheck size={10} /> {editingId ? 'Aggiorna' : 'Aggiungi al Grimorio'}
      </button>
    </div>
  </div>
);

// ── Bookmark tab (rubrica style) ─────────────────────────────────────────────
const BookmarkTab: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}> = ({ active, onClick, label, count, icon }) => (
  <button onClick={onClick}
    style={{
      padding: '6px 12px', cursor: 'pointer', transition: 'all 0.13s',
      borderRadius: '6px 6px 0 0',
      background: active
        ? 'linear-gradient(180deg, rgba(155,89,182,0.25), rgba(155,89,182,0.08))'
        : 'rgba(255,255,255,0.02)',
      border: active ? '1px solid rgba(155,89,182,0.4)' : '1px solid rgba(255,255,255,0.05)',
      borderBottom: active ? '1px solid rgba(28,28,39,1)' : '1px solid transparent',
      color: active ? 'var(--accent-arcane)' : 'var(--text-muted)',
      fontFamily: 'var(--font-heading)', fontSize: '0.78rem', letterSpacing: '0.04em',
      display: 'flex', alignItems: 'center', gap: 6,
      marginBottom: -1, position: 'relative', zIndex: active ? 2 : 1,
      boxShadow: active ? '0 -2px 6px rgba(155,89,182,0.2)' : 'none',
    }}>
    {icon}
    {label}
    <span style={{
      fontSize: '0.6rem', opacity: active ? 0.85 : 0.6,
      background: active ? 'rgba(155,89,182,0.25)' : 'rgba(255,255,255,0.06)',
      borderRadius: 8, padding: '0 5px', minWidth: 16, textAlign: 'center',
      fontFamily: 'var(--font-base, inherit)',
    }}>{count}</span>
  </button>
);

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

// ── Spell card (always-expanded, premium) ─────────────────────────────────────
const SpellCard: React.FC<SpellRowProps> = ({ spell, editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps }) => {
  const prepCount = prepCountFor(spell.id);
  const isEdit = editingId === spell.id;
  const color = SCHOOL_COLOR[spell.school] ?? 'var(--text-muted)';
  const [descExpanded, setDescExpanded] = useState(false);
  const MAX_DESC = 120;
  const needsTruncation = (spell.description?.length ?? 0) > MAX_DESC;
  const slot = slots[String(spell.level)];
  const slotsLeft = slot ? slot.total - slot.used : 0;
  const canPrepare = spell.level === 0 || slotsLeft > 0 || prepCount < (slot?.total ?? 0);
  if (isEdit) return <SpellEditForm {...formProps} />;

  const stats: [React.ReactNode, string | undefined, string][] = [
    [<FaClock size={9} />, spell.castingTime, 'Tempo'],
    [<FaArrowsAltH size={9} />, spell.range, 'Gittata'],
    [<FaHourglass size={9} />, spell.duration, 'Durata'],
    [<FaShieldAlt size={9} />, spell.savingThrow, 'TS'],
    [<FaFeather size={9} />, spell.components, 'Comp.'],
  ];
  const visibleStats = stats.filter(([, v]) => v && v.trim());

  return (
    <div style={{
      position: 'relative',
      background: `
        linear-gradient(160deg, ${color}14 0%, rgba(255,255,255,0.025) 45%, rgba(0,0,0,0.18) 100%),
        rgba(20,20,30,0.55)
      `,
      border: `1px solid ${color}40`,
      borderRadius: 10,
      padding: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = `0 6px 18px ${color}40, inset 0 1px 0 rgba(255,255,255,0.06)`;
        el.style.borderColor = `${color}80`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)';
        el.style.borderColor = `${color}40`;
      }}>

      {/* Top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}55, transparent)` }} />

      {/* Floating edit/delete (top-right) */}
      <div style={{
        position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 2,
      }}>
        <button onClick={() => startEdit(spell)} title="Modifica"
          style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-arcane)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}>
          <FaEdit size={10} />
        </button>
        <button onClick={() => deleteSpell(spell.id)} title="Elimina"
          style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-crimson)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}>
          <FaTrash size={10} />
        </button>
      </div>

      {/* Header band */}
      <div style={{
        padding: '10px 70px 8px 12px',
        background: `linear-gradient(180deg, ${color}12, transparent)`,
        borderBottom: `1px solid ${color}1f`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Level chip */}
        <div style={{
          width: 30, height: 30, borderRadius: 6,
          background: `linear-gradient(135deg, ${color}, ${color}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'var(--font-heading)',
          fontSize: spell.level === 0 ? '0.62rem' : '1rem',
          boxShadow: `0 2px 6px ${color}55`, flexShrink: 0,
          letterSpacing: spell.level === 0 ? '0.05em' : 0,
        }}>
          {spell.level === 0 ? 'TR' : spell.level}
        </div>
        <div style={{ flex: 1, minWidth: 100, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '0.01em' }}>
            {spell.name}
          </span>
          <span style={{ fontSize: '0.66rem', color, opacity: 0.95, letterSpacing: '0.04em' }}>
            {spell.school}
          </span>
        </div>
      </div>

      {/* Description */}
      {spell.description && (
        <div style={{ padding: '10px 12px 4px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            {needsTruncation && !descExpanded
              ? spell.description.slice(0, MAX_DESC) + '…'
              : spell.description}
          </p>
          {needsTruncation && (
            <button onClick={() => setDescExpanded(e => !e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: '0.7rem', padding: '3px 0 0', opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
              {descExpanded ? <><FaEyeSlash size={9} /> Meno</> : <><FaEye size={9} /> Mostra di più</>}
            </button>
          )}
        </div>
      )}

      {/* Stats grid */}
      {visibleStats.length > 0 && (
        <div style={{
          margin: '8px 12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
          gap: 5,
        }}>
          {visibleStats.map(([icon, val, label]) => (
            <div key={label} style={{
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 5, padding: '5px 7px',
              display: 'flex', flexDirection: 'column', gap: 1,
            }}>
              <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ opacity: 0.8, display: 'flex', alignItems: 'center' }}>{icon}</span>{label}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.15 }}>
                {val}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: prep controls only (clean) */}
      <div style={{
        marginTop: 'auto',
        padding: '8px 10px',
        background: `linear-gradient(180deg, transparent, ${color}10)`,
        borderTop: `1px solid ${color}1f`,
        display: 'flex', alignItems: 'stretch', gap: 6,
      }}>
        {/* Prep counter group: [-] N× */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: prepCount > 0 ? `${color}1a` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${prepCount > 0 ? color + '44' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 5, overflow: 'hidden', flexShrink: 0,
        }}>
          <button onClick={() => unprepareSpellOne(spell.id)}
            disabled={prepCount === 0}
            title="Rimuovi una preparazione"
            style={{
              width: 26, height: 30,
              background: 'transparent', border: 'none',
              borderRight: `1px solid ${prepCount > 0 ? color + '33' : 'transparent'}`,
              cursor: prepCount > 0 ? 'pointer' : 'not-allowed',
              color: prepCount > 0 ? 'var(--accent-crimson)' : 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <FaMinus size={9} />
          </button>
          <span style={{
            minWidth: 30, padding: '0 6px',
            fontFamily: 'var(--font-heading)', fontSize: '0.85rem',
            color: prepCount > 0 ? color : 'var(--text-muted)',
            textAlign: 'center', lineHeight: '30px',
          }}>{prepCount}×</span>
        </div>

        {/* Prepara button (large) */}
        <button onClick={() => { if (canPrepare) prepareWizardSpell(spell.level, spell.id); }}
          disabled={!canPrepare}
          style={{
            flex: '1 1 auto',
            padding: '6px 12px', borderRadius: 5,
            background: canPrepare ? `linear-gradient(135deg, ${color}55, ${color}22)` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canPrepare ? color + '88' : 'rgba(255,255,255,0.08)'}`,
            cursor: canPrepare ? 'pointer' : 'not-allowed',
            color: canPrepare ? '#fff' : 'var(--text-muted)',
            fontFamily: 'var(--font-heading)', fontSize: '0.82rem', letterSpacing: '0.05em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'filter 0.15s, transform 0.1s',
            textShadow: canPrepare ? `0 1px 2px ${color}` : 'none',
          }}
          onMouseEnter={e => { if (canPrepare) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'; }}
          title={canPrepare ? 'Prepara una copia di questo incantesimo' : 'Nessuno slot disponibile'}>
          <FaPlus size={10} /> Prepara
        </button>
      </div>
    </div>
  );
};

// ── Slot pips visualizer ──────────────────────────────────────────────────────
const SlotPips: React.FC<{ total: number; used: number; color: string }> = ({ total, used, color }) => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
    {Array.from({ length: Math.min(total, 10) }, (_, i) => {
      const spent = i < used;
      return (
        <div key={i} style={{
          width: 11, height: 11, borderRadius: '50%',
          background: spent ? 'rgba(255,255,255,0.06)' : color,
          border: `1px solid ${spent ? 'rgba(255,255,255,0.12)' : color}`,
          boxShadow: spent ? 'none' : `0 0 5px ${color}88`,
          transition: 'all 0.25s',
          flexShrink: 0,
        }} />
      );
    })}
  </div>
);

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
  // Grimorie rubrica
  const [grimSelected, setGrimSelected] = useState<number | 'all'>('all');
  const [grimSearch, setGrimSearch] = useState('');
  const [grimLvlPickerOpen, setGrimLvlPickerOpen] = useState(false);
  // Daily tab
  const [dailyLvlPickerOpen, setDailyLvlPickerOpen] = useState(false);
  const grimLvlBtnRef = useRef<HTMLButtonElement>(null);
  const dailyLvlBtnRef = useRef<HTMLButtonElement>(null);

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
      savingThrow: spell.savingThrow ?? '', components: spell.components ?? ''
    });
    setEditingId(spell.id); setIsAdding(false);
  };
  const cancelEdit = () => { setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL()); };

  const formProps: SpellEditFormProps = { form, setForm, saveSpell, cancelEdit, editingId };
  const cardProps = { editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps };

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
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(155,89,182,0.15)' }}>
        {([['grimoire', <><FaBookOpen size={11} /> Grimorio</>, spells.length],
        ['daily', <><FaCalendarDay size={11} /> Incantesimi del Giorno</>, totalPreps]] as [SpellTab, React.ReactNode, number][]).map(([key, label, cnt]) => (
          <button key={key} onClick={() => setSpellTab(key)}
            style={{
              padding: '6px 14px', borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'all 0.13s',
              background: spellTab === key ? 'rgba(155,89,182,0.12)' : 'transparent',
              border: spellTab === key ? '1px solid rgba(155,89,182,0.35)' : '1px solid transparent',
              borderBottom: spellTab === key ? '1px solid rgba(28,28,39,1)' : '1px solid transparent',
              color: spellTab === key ? 'var(--accent-arcane)' : 'var(--text-muted)',
              fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6
            }}>
            {label}
            <span style={{ fontSize: '0.62rem', opacity: 0.65, background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '0 4px', minWidth: 16, textAlign: 'center' }}>{cnt}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={restWizardSpells} title="Riposo lungo: ripristina slot e annulla i lanci"
          style={{
            padding: '4px 12px', borderRadius: '4px 4px 0 0', fontSize: '0.75rem', cursor: 'pointer',
            background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', color: 'var(--accent-ice)',
            display: 'flex', alignItems: 'center', gap: 5, marginBottom: 0, transition: 'all 0.15s'
          }}>
          <FaMoon size={10} /> Riposo Lungo
        </button>
      </div>

      {/* ── GRIMOIRE TAB (rubrica) ── */}
      {spellTab === 'grimoire' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Action bar: search + add */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <FaSearch size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.6 }} />
              <input className="input" value={grimSearch} onChange={e => setGrimSearch(e.target.value)}
                placeholder="Cerca per nome o scuola..."
                style={{ width: '100%', fontSize: '0.82rem', paddingLeft: 28 }} />
            </div>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }}
              onClick={() => {
                setIsAdding(true); setEditingId(null);
                setForm({ ...EMPTY_SPELL(), level: grimSelected === 'all' ? 1 : grimSelected });
              }}
              disabled={isAdding}>
              <FaPlus size={10} /> Aggiungi Incantesimo
            </button>
          </div>

          {/* Bookmarks strip (rubrica tabs) */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap', borderBottom: '1px solid rgba(155,89,182,0.15)', paddingBottom: 0 }}>
            <BookmarkTab
              active={grimSelected === 'all'}
              onClick={() => setGrimSelected('all')}
              label="Tutti"
              count={spells.length}
              icon={<GiBookmarklet size={11} />}
            />
            {levels.map(lv => (
              <BookmarkTab
                key={lv}
                active={grimSelected === lv}
                onClick={() => setGrimSelected(lv)}
                label={lv === 0 ? 'Trucch.' : `Lv ${lv}`}
                count={spells.filter(s => s.level === lv).length}
              />
            ))}
            {/* Show bookmark for selected level even if it has no spells yet */}
            {typeof grimSelected === 'number' && !levels.includes(grimSelected) && (
              <BookmarkTab
                active={true}
                onClick={() => setGrimSelected(grimSelected)}
                label={grimSelected === 0 ? 'Trucch.' : `Lv ${grimSelected}`}
                count={0}
              />
            )}
            {/* Add level bookmark */}
            <button ref={grimLvlBtnRef} onClick={() => setGrimLvlPickerOpen(o => !o)}
              title="Aggiungi un nuovo segnalibro di livello"
              style={{
                padding: '5px 10px', borderRadius: '6px 6px 0 0', cursor: 'pointer',
                background: 'transparent', border: '1px dashed rgba(155,89,182,0.35)',
                borderBottom: 'none',
                color: 'var(--accent-arcane)', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <FaPlus size={9} /> Livello
            </button>
            {grimLvlPickerOpen && (
              <LevelPickerPopover
                anchorRef={grimLvlBtnRef}
                taken={levels}
                onPick={(lvl) => {
                  setGrimSelected(lvl);
                  setIsAdding(true); setEditingId(null);
                  setForm({ ...EMPTY_SPELL(), level: lvl });
                }}
                onClose={() => setGrimLvlPickerOpen(false)}
                align="left"
                title="Aggiungi un livello al grimorio"
              />
            )}
          </div>

          {/* Add form */}
          {isAdding && <div style={{ flexShrink: 0 }}><SpellEditForm {...formProps} autoFocus /></div>}

          {/* Cards area */}
          {spells.length === 0 && !isAdding ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <GiSpellBook size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ marginBottom: 12 }}>Il grimorio è vuoto.</p>
              <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => { setIsAdding(true); setForm({ ...EMPTY_SPELL(), level: 1 }); }}>
                <FaPlus size={10} /> Aggiungi il primo incantesimo
              </button>
            </div>
          ) : filteredGrimSpells.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {grimSearchLower
                ? <>Nessun incantesimo corrisponde a <strong>"{grimSearch}"</strong>.</>
                : <>Nessun incantesimo di {grimSelected === 'all' ? 'questo grimorio' : (grimSelected === 0 ? 'trucchetto' : `livello ${grimSelected}`)}.</>}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 8 }}>
              {grimSelected === 'all' ? (
                /* Grouped by level */
                filteredLevelKeys.map(lv => (
                  <div key={lv} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, background: 'linear-gradient(135deg, #9b59b6, #6c3483)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(155,89,182,0.4)', flexShrink: 0 }}>
                        {lv}
                      </div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', color: 'var(--accent-arcane)', letterSpacing: '0.05em' }}>
                        {LevelLabel(lv)}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(155,89,182,0.25), transparent)' }} />
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                        {filteredByLevel.get(lv)!.length} {filteredByLevel.get(lv)!.length === 1 ? 'incantesimo' : 'incantesimi'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                      {filteredByLevel.get(lv)!.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                    </div>
                  </div>
                ))
              ) : (
                /* Single level grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
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
          <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <GiSpellBook size={22} style={{ color: 'var(--accent-arcane)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 200 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: 'var(--accent-arcane)', letterSpacing: '0.05em' }}>
                Preparazione del Mago
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Prepara più copie dello stesso incantesimo: ognuna può essere lanciata una sola volta.
              </span>
            </div>
            <button ref={dailyLvlBtnRef} onClick={() => setDailyLvlPickerOpen(o => !o)}
              style={{ background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.3)', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', color: 'var(--accent-arcane)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FaPlus size={9} /> Aggiungi livello
            </button>
            {dailyLvlPickerOpen && (
              <LevelPickerPopover
                anchorRef={dailyLvlBtnRef}
                taken={slotLevels}
                onPick={(lvl) => setSpellSlotTotal(lvl, Math.max(1, slots[String(lvl)]?.total ?? 1))}
                onClose={() => setDailyLvlPickerOpen(false)}
                align="right"
                title="Aggiungi un livello (anche trucchetti)"
              />
            )}
          </div>

          {slotLevels.length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <GiCrystalBall size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ marginBottom: 6 }}>Nessuno slot configurato.</p>
              <p style={{ fontSize: '0.78rem' }}>Aggiungi un livello qui sopra per cominciare a preparare gli incantesimi.</p>
            </div>
          )}

          {/* Per-level sections */}
          {slotLevels.map(lv => {
            const s = slots[String(lv)] ?? { total: 0, used: 0 };
            const available = s.total - s.used;
            const preps = prepByLevel[String(lv)] ?? [];
            const grimoireForLevel = spells.filter(sp => sp.level === lv);
            const isPickerOpen = pickerLvl === lv;
            const lvName = lv === 0 ? 'Trucchetti' : `Livello ${lv}`;
            const accent = LEVEL_COLOR[lv] ?? 'var(--accent-arcane)';

            return (
              <div key={lv} className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${accent}` }}>
                {/* Level header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: `linear-gradient(90deg, ${accent}18, transparent)`, borderBottom: `1px solid ${accent}22`, flexWrap: 'wrap' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${accent}, ${accent}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-heading)', fontSize: lv === 0 ? '0.6rem' : '1.05rem', boxShadow: `0 2px 10px ${accent}55`, flexShrink: 0, letterSpacing: lv === 0 ? '0.04em' : 0 }}>
                    {lv === 0 ? 'TR' : lv}
                  </div>
                  <div style={{ flex: 1, minWidth: 100, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', color: accent, letterSpacing: '0.04em' }}>
                      {lvName}
                    </span>
                    {s.total > 0 && <SlotPips total={s.total} used={s.used} color={accent} />}
                  </div>

                  {/* Slot count badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, background: `${accent}18`, border: `1px solid ${accent}33`, borderRadius: 6, padding: '4px 10px', minWidth: 52 }}>
                    <span style={{ fontSize: '1.1rem', color: available > 0 ? accent : 'var(--text-muted)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                      {available}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>/ {s.total} slot</span>
                  </div>
                  {/* Adjust total */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => setSpellSlotTotal(lv, s.total + 1)} disabled={s.total >= 9}
                      style={{ width: 22, height: 18, borderRadius: '3px 3px 0 0', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    <button onClick={() => setSpellSlotTotal(lv, Math.max(0, s.total - 1))}
                      style={{ width: 22, height: 18, borderRadius: '0 0 3px 3px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}>−</button>
                  </div>

                  <button onClick={() => setPickerLvl(isPickerOpen ? null : lv)}
                    style={{ background: isPickerOpen ? `${accent}33` : `${accent}18`, border: `1px solid ${accent}55`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: accent, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', transition: 'all 0.15s' }}>
                    <FaPlus size={9} /> {isPickerOpen ? 'Chiudi' : 'Prepara'}
                  </button>
                </div>

                {/* Picker (grimoire spells of this level) */}
                {isPickerOpen && (
                  <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.22)', borderBottom: `1px solid ${accent}18` }}>
                    {grimoireForLevel.length === 0 ? (
                      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                        Nessun incantesimo di livello {lv} nel grimorio. Aggiungilo dalla scheda Grimorio.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                        {grimoireForLevel.map(sp => {
                          const spColor = SCHOOL_COLOR[sp.school] ?? 'var(--text-muted)';
                          return (
                            <button key={sp.id} onClick={() => prepareWizardSpell(lv, sp.id)}
                              title={`Prepara una copia di ${sp.name}`}
                              style={{ background: `${spColor}0d`, border: `1px solid ${spColor}33`, borderLeft: `3px solid ${spColor}`, borderRadius: 5, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = `${spColor}22`)}
                              onMouseLeave={e => (e.currentTarget.style.background = `${spColor}0d`)}>
                              <FaPlus size={8} style={{ color: spColor, flexShrink: 0 }} />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
                              <span style={{ fontSize: '0.62rem', color: spColor, opacity: 0.85, flexShrink: 0 }}>{SCHOOL_ICON[sp.school] ?? ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Prepared instances list */}
                <div style={{ padding: preps.length === 0 ? '12px 14px' : '10px' }}>
                  {preps.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                      Nessun incantesimo preparato per questo livello. Clicca <strong>Prepara</strong> per scegliere dal grimorio.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 7 }}>
                      {preps.map(p => {
                        const sp = spellById.get(p.spellId);
                        if (!sp) return null;
                        const spColor = SCHOOL_COLOR[sp.school] ?? 'var(--text-muted)';
                        return (
                          <div key={p.id}
                            style={{
                              background: p.cast
                                ? 'rgba(255,255,255,0.02)'
                                : `linear-gradient(135deg, ${spColor}12, rgba(0,0,0,0.18))`,
                              border: `1px solid ${p.cast ? 'rgba(255,255,255,0.06)' : spColor + '35'}`,
                              borderLeft: `3px solid ${p.cast ? 'rgba(255,255,255,0.1)' : spColor}`,
                              borderRadius: 7, padding: '8px 10px',
                              display: 'flex', alignItems: 'center', gap: 9,
                              opacity: p.cast ? 0.5 : 1, transition: 'all 0.2s',
                            }}>
                            {/* Cast toggle button */}
                            <button
                              onClick={() => p.cast ? restorePreparedSpell(lv, p.id) : castPreparedSpell(lv, p.id)}
                              title={p.cast ? 'Ripristina slot' : 'Lancia (consuma uno slot)'}
                              style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: p.cast ? 'rgba(255,255,255,0.05)' : `radial-gradient(circle at 35% 35%, ${spColor}cc, ${spColor}55)`,
                                border: `2px solid ${p.cast ? 'rgba(255,255,255,0.12)' : spColor}`,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: p.cast ? 'var(--text-muted)' : '#fff',
                                boxShadow: p.cast ? 'none' : `0 2px 8px ${spColor}55`,
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { if (!p.cast) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.25)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'; }}>
                              {p.cast ? <FaMinus size={9} /> : <FaBolt size={9} />}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.83rem', color: p.cast ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: p.cast ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, lineHeight: 1.2 }}>
                                {sp.name}
                              </div>
                              <div style={{ fontSize: '0.63rem', color: spColor, opacity: 0.85, letterSpacing: '0.03em', marginTop: 2 }}>
                                {SCHOOL_ICON[sp.school] ?? ''} {sp.school}
                              </div>
                            </div>
                            <button onClick={() => unprepareWizardSpell(lv, p.id)}
                              title="Rimuovi questa preparazione"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.18)', padding: 4, lineHeight: 1, flexShrink: 0, borderRadius: 4, transition: 'color 0.15s' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-crimson)')}
                              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.18)')}>
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
    </div>
  );
};
