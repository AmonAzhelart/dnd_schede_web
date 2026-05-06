import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaMoon, FaBookOpen, FaCalendarDay, FaMinus, FaSearch, FaClock, FaArrowsAltH, FaHourglass, FaShieldAlt, FaFeather, FaBolt, FaDragon, FaTimes, FaGraduationCap } from 'react-icons/fa';
import { GiSpellBook, GiCrystalBall, GiBookmarklet } from 'react-icons/gi';
import type { Spell } from '../types/dnd';
import { spellCatalog, creatureCatalog, type CatalogSpell, type CatalogCreature } from '../services/admin';
import { useIconCatalog } from '../services/iconCache';

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
  summonableCreatureIds: [],
});

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
  selectedSpellId: string | null;
  onSelect: (id: string) => void;
  /** id → name for all known creatures (personal bestiary + catalog) */
  creatureNameMap: Record<string, string>;
  requestDel: (id: string) => void;
}

// ── Sub-components at module level (prevents remount on parent re-render) ─────
// ── School icon picker (replaces native <select> so we can show SVG icons) ─────
const SchoolPicker: React.FC<{ value: string; onChange: (s: string) => void }> = ({ value, onChange }) => (
  <div className="sb-school-picker">
    {SCHOOLS.map(s => {
      const slug = SCHOOL_ICON_SLUG[s];
      const color = SCHOOL_COLOR[s] ?? 'var(--accent-gold)';
      const isSelected = value === s;
      return (
        <button
          key={s}
          type="button"
          className={`sb-school-tile${isSelected ? ' selected' : ''}`}
          style={isSelected
            ? { borderColor: `${color}65`, background: `${color}1a`, boxShadow: `0 0 0 1px ${color}30, 0 2px 14px ${color}22` } as React.CSSProperties
            : {} as React.CSSProperties}
          onClick={() => onChange(s)}
          title={s}
        >
          {slug && getDndIconSvg('spell', slug)
            ? <DndIcon category="spell" name={slug} size={20} style={{ color: isSelected ? color : '#6a5838', transition: 'color 0.15s' }} />
            : <span style={{ fontSize: '1rem' }}>{SCHOOL_ICON[s] ?? '✦'}</span>}
          <span className="sb-school-tile-name" style={isSelected ? { color } : {}}>{s}</span>
        </button>
      );
    })}
  </div>
);

const SpellEditForm: React.FC<SpellEditFormProps> = ({ form, setForm, saveSpell, cancelEdit, editingId, autoFocus }) => {
  const { character } = useCharacterStore();
  const bestiary = character?.bestiary ?? [];
  const linkedIds: string[] = form.summonableCreatureIds ?? [];

  const [catalogCreatures, setCatalogCreatures] = useState<CatalogCreature[]>([]);
  useEffect(() => { creatureCatalog.list().then(setCatalogCreatures); }, []);

  type PickerItem = { id: string; name: string; cr?: number | string; type?: string; source: 'personale' | 'catalogo' };
  const pickerItems: PickerItem[] = [
    ...bestiary.map(e => ({ id: e.id, name: e.creature.name, cr: e.creature.challengeRating, type: e.creature.type, source: 'personale' as const })),
    ...catalogCreatures
      .filter(c => !bestiary.some(e => e.catalogId === c.id))
      .map(c => ({ id: c.id, name: c.name, cr: c.challengeRating, type: c.type, source: 'catalogo' as const })),
  ];

  const [creatureSearch, setCreatureSearch] = useState('');
  const [crFilter, setCrFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const crNum = (cr: number | string | undefined) => {
    if (cr === undefined) return 0;
    if (typeof cr === 'number') return cr;
    const parts = String(cr).split('/');
    return parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(cr) || 0;
  };
  const filteredPickerItems = pickerItems.filter(item => {
    const q = creatureSearch.trim().toLowerCase();
    if (q && !item.name.toLowerCase().includes(q) && !(item.type ?? '').toLowerCase().includes(q)) return false;
    if (crFilter === 'low' && crNum(item.cr) > 3) return false;
    if (crFilter === 'mid' && (crNum(item.cr) < 4 || crNum(item.cr) > 10)) return false;
    if (crFilter === 'high' && crNum(item.cr) < 11) return false;
    return true;
  });
  const linkedItems = pickerItems.filter(i => linkedIds.includes(i.id));
  const toggleCreature = (id: string) =>
    setForm(f => ({ ...f, summonableCreatureIds: (f.summonableCreatureIds ?? []).includes(id) ? (f.summonableCreatureIds ?? []).filter(i => i !== id) : [...(f.summonableCreatureIds ?? []), id] }));

  const _schoolColor = SCHOOL_COLOR[form.school] ?? 'var(--accent-gold)'; void _schoolColor;
  const _schoolIcon = SCHOOL_ICON[form.school] ?? '✦'; void _schoolIcon;

  return (
    <div className="sb-edit-form">

      {/* ── IDENTITÀ ── */}
      <div className="sb-ef-section" style={{ paddingTop: 14 }}>
        {/* Nome — full width */}
        <div className="sb-ef-field">
          <label className="sb-ef-label">Nome incantesimo *</label>
          <input className="input" autoFocus={autoFocus}
            placeholder="Es. Palla di Fuoco…"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') saveSpell(); if (e.key === 'Escape') cancelEdit(); }}
            style={{ fontSize: '0.88rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.02em' }} />
        </div>

        {/* Livello + Scuola */}
        <div className="sb-ef-level-row">
          <div className="sb-ef-field">
            <label className="sb-ef-label">Livello slot</label>
            <input className="input" type="number" min={0} max={9} value={form.level}
              onChange={e => setForm(f => ({ ...f, level: Math.min(9, Math.max(0, +e.target.value)) }))}
              style={{ width: '100%', fontSize: '1rem', textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700 }} />
          </div>
        </div>
        <div className="sb-ef-field">
          <label className="sb-ef-label">Scuola di Magia</label>
          <SchoolPicker value={form.school} onChange={school => setForm(f => ({ ...f, school }))} />
        </div>
      </div>

      {/* ── DESCRIZIONE ── */}
      <div className="sb-ef-section">
        <div className="sb-ef-field">
          <label className="sb-ef-label">Descrizione ed Effetti</label>
          <textarea className="input"
            placeholder="Descrivi l'effetto, la meccanica, le condizioni…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ minHeight: 88, fontSize: '0.8rem', resize: 'vertical', lineHeight: 1.6 }} />
        </div>
      </div>

      {/* ── PROPRIETÀ ── */}
      <div className="sb-ef-section">
        <div className="sb-ef-section-hdr"><FaClock size={9} /> Proprietà</div>
        <div className="sb-ef-grid">
          {([
            ['castingTime', 'Tempo di lancio', <FaClock size={9} />],
            ['range', 'Gittata', <FaArrowsAltH size={9} />],
            ['duration', 'Durata', <FaHourglass size={9} />],
            ['savingThrow', 'Tiro Salvezza', <FaShieldAlt size={9} />],
            ['components', 'Componenti', <FaFeather size={9} />],
          ] as [keyof Omit<Spell, 'id'>, string, React.ReactNode][]).map(([field, label]) => (
            <div key={field} className="sb-ef-field">
              <label className="sb-ef-label">{label}</label>
              <input className="input"
                value={(form[field] as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                style={{ fontSize: '0.8rem' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── COMBATTIMENTO ── */}
      <div className="sb-ef-section">
        <div className="sb-ef-section-hdr"><FaBolt size={9} /> Danno &amp; Combattimento <span style={{ opacity: 0.5, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(opzionale)</span></div>
        <div className="sb-ef-grid">
          <div className="sb-ef-field sb-ef-field-full">
            <label className="sb-ef-label">Tipo di tiro per colpire</label>
            <select className="input" value={form.attackMode ?? 'none'}
              onChange={e => setForm(f => ({ ...f, attackMode: e.target.value as Spell['attackMode'] }))}
              style={{ fontSize: '0.8rem' }}>
              <option value="none">— Nessuno (non è un attacco)</option>
              <option value="rangedTouch">Tocco a distanza</option>
              <option value="meleeTouch">Tocco in mischia</option>
              <option value="ray">Raggio</option>
              <option value="normal">Attacco normale</option>
              <option value="save">Tiro Salvezza (CD)</option>
            </select>
          </div>
          <div className="sb-ef-field">
            <label className="sb-ef-label">Dadi base (es. 2d6)</label>
            <input className="input" value={form.baseDice ?? ''}
              onChange={e => setForm(f => ({ ...f, baseDice: e.target.value }))}
              placeholder="vuoto = nessun danno"
              style={{ fontSize: '0.8rem' }} />
          </div>
          <div className="sb-ef-field">
            <label className="sb-ef-label">Tipo di danno</label>
            <input className="input" value={form.damageType ?? ''}
              onChange={e => setForm(f => ({ ...f, damageType: e.target.value }))}
              placeholder="fuoco, freddo, forza…"
              style={{ fontSize: '0.8rem' }} />
          </div>
          {(form.attackMode === 'save') && (
            <div className="sb-ef-field">
              <label className="sb-ef-label">Caratteristica CD</label>
              <select className="input" value={form.saveStat ?? 'int'}
                onChange={e => setForm(f => ({ ...f, saveStat: e.target.value as Spell['saveStat'] }))}
                style={{ fontSize: '0.8rem' }}>
                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(s => (
                  <option key={s} value={s}>{({ str: 'Forza', dex: 'Destrezza', con: 'Costituzione', int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma' }[s])}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Upcast sub-section */}
        <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed rgba(180,140,60,0.14)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: '0.58rem', letterSpacing: '0.1em', color: '#5a4e35', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
            <FaGraduationCap size={9} /> Potenziamento (Upcast)
          </div>
          <div className="sb-ef-grid">
            <div className="sb-ef-field sb-ef-field-full">
              <label className="sb-ef-label">Dadi extra per step (es. 1d6)</label>
              <input className="input" value={form.upcastDice ?? ''}
                onChange={e => setForm(f => ({ ...f, upcastDice: e.target.value }))}
                placeholder="vuoto = nessun upcast"
                style={{ fontSize: '0.8rem' }} />
            </div>
            <div className="sb-ef-field">
              <label className="sb-ef-label">Livelli slot per step</label>
              <input className="input" type="number" min={1} value={form.upcastEveryLevels ?? 1}
                onChange={e => setForm(f => ({ ...f, upcastEveryLevels: Math.max(1, +e.target.value || 1) }))}
                style={{ fontSize: '0.8rem' }} />
            </div>
            <div className="sb-ef-field">
              <label className="sb-ef-label">Max step</label>
              <input className="input" type="number" min={1} value={form.upcastMaxSteps ?? ''}
                onChange={e => setForm(f => ({ ...f, upcastMaxSteps: e.target.value === '' ? undefined : Math.max(1, +e.target.value) }))}
                placeholder="illimitato"
                style={{ fontSize: '0.8rem' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── CREATURE EVOCABILI ── */}
      <div className="sb-ef-section">
        <div className="sb-ef-section-hdr" style={{ color: 'var(--accent-crimson)' }}><FaDragon size={10} /> Creature Evocabili <span style={{ opacity: 0.5, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(opzionale)</span></div>

        {/* Linked badges */}
        {linkedItems.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {linkedItems.map(item => (
              <button key={item.id} className="sb-ef-creature-badge" onClick={() => toggleCreature(item.id)} title="Clicca per scollegare">
                <FaCheck size={8} /> {item.name}
                {item.cr !== undefined && <span style={{ opacity: 0.6, fontSize: '0.62rem' }}>GS {item.cr}</span>}
                <FaTimes size={7} style={{ marginLeft: 1, opacity: 0.7 }} />
              </button>
            ))}
          </div>
        )}

        {/* Search + CR filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <FaSearch size={9} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input className="input" placeholder="Cerca per nome o tipo…"
              value={creatureSearch} onChange={e => setCreatureSearch(e.target.value)}
              style={{ fontSize: '0.78rem', paddingLeft: 26 }} />
          </div>
          <select className="input" value={crFilter} onChange={e => setCrFilter(e.target.value as typeof crFilter)}
            style={{ flexShrink: 0, width: 110, fontSize: '0.75rem' }}>
            <option value="all">Tutti GS</option>
            <option value="low">GS 1–3</option>
            <option value="mid">GS 4–10</option>
            <option value="high">GS 11+</option>
          </select>
        </div>

        {/* Creature list */}
        {pickerItems.length === 0 ? (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            Nessuna creatura. Aggiungile dal Bestiario.
          </p>
        ) : filteredPickerItems.length === 0 ? (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Nessun risultato.</p>
        ) : (
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, scrollbarWidth: 'thin' }}>
            {filteredPickerItems.map(item => {
              const linked = linkedIds.includes(item.id);
              return (
                <button key={item.id} className={`sb-ef-creature-item${linked ? ' linked' : ''}`} onClick={() => toggleCreature(item.id)}>
                  <span className="sb-ef-creature-check">{linked && <FaCheck size={9} />}</span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  {item.type && <span style={{ opacity: 0.4, fontSize: '0.64rem' }}>{item.type}</span>}
                  {item.cr !== undefined && <span style={{ opacity: 0.5, fontSize: '0.64rem', flexShrink: 0 }}>GS {item.cr}</span>}
                  <span style={{ opacity: 0.3, fontSize: '0.6rem', flexShrink: 0 }}>{item.source === 'catalogo' ? 'cat.' : 'pers.'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── AZIONI ── */}
      <div className="sb-form-actions">
        <button onClick={cancelEdit} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Annulla</button>
        <button onClick={saveSpell} className="btn-primary"
          style={{ fontSize: '0.8rem', justifyContent: 'center', opacity: form.name.trim() ? 1 : 0.45 }}
          disabled={!form.name.trim()}>
          <FaCheck size={10} /> {editingId ? 'Salva Modifiche' : 'Aggiungi al Grimorio'}
        </button>
      </div>
    </div>
  );
};

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
        background: 'linear-gradient(160deg, #1e1a12 0%, #14100a 100%)', border: '1px solid rgba(180,140,60,0.30)',
        borderRadius: 6, padding: '10px', boxShadow: '0 8px 28px rgba(0,0,0,0.75)',
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
                  background: isTaken ? 'rgba(20,16,10,0.5)' : 'linear-gradient(135deg, rgba(180,140,60,0.16), rgba(100,80,30,0.10))',
                  border: `1px solid ${isTaken ? 'rgba(180,140,60,0.07)' : 'rgba(180,140,60,0.35)'}`,
                  color: isTaken ? '#3a3020' : 'var(--accent-gold)',
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

// ── Spell detail panel (sidebar view mode) ──────────────────────────────────────
const STAT_ICONS: Record<string, React.ReactNode> = {
  'Tempo di lancio': <FaClock size={10} />,
  'Gittata': <FaArrowsAltH size={10} />,
  'Durata': <FaHourglass size={10} />,
  'Tiro Salvezza': <FaShieldAlt size={10} />,
  'Componenti': <FaFeather size={10} />,
};

const SpellDetailPanel: React.FC<{
  spell: Spell;
  prepCount: number;
  canPrepare: boolean;
  onPrepare: () => void;
  onUnprepare: () => void;
  creatureNameMap: Record<string, string>;
}> = ({ spell, prepCount, canPrepare, onPrepare, onUnprepare, creatureNameMap }) => {
  const { t } = useTranslation();
  const { resolveSchoolSvg, sanitizeSvg } = useIconCatalog();
  const color = SCHOOL_COLOR[spell.school] ?? 'var(--text-muted)';
  const schoolSvg = resolveSchoolSvg(spell.school);
  const linkedNames = (spell.summonableCreatureIds ?? []).map(id => creatureNameMap[id]).filter(Boolean) as string[];
  const stats: [string, string | undefined][] = [
    ['Tempo di lancio', spell.castingTime],
    ['Gittata', spell.range],
    ['Durata', spell.duration],
    ['Tiro Salvezza', spell.savingThrow],
    ['Componenti', spell.components],
  ];
  const visibleStats = stats.filter(([, v]) => v?.trim());
  const hasDamage = spell.attackMode !== 'none' && spell.baseDice;
  const isCantrip = spell.level === 0;

  return (
    <div className="sb-spell-detail">

      {/* ── School + damage hero strip ── */}
      <div className="sb-sdp-hero" style={{ '--sdp-color': color } as React.CSSProperties}>
        <div className="sb-sdp-hero-school">
          {schoolSvg
            ? <span className="sb-sdp-school-svg inv-svg-tinted" style={{ color }} dangerouslySetInnerHTML={{ __html: sanitizeSvg(schoolSvg) }} />
            : <span style={{ fontSize: '1rem', lineHeight: 1 }}>{SCHOOL_ICON[spell.school] ?? '✦'}</span>}
          <span className="sb-sdp-school-name" style={{ color }}>
            {t(`spellbook.schools.${spell.school}`, spell.school)}
          </span>
          {isCantrip && <span className="sb-sdp-level-pill" style={{ background: `${color}22`, borderColor: `${color}44`, color }}>Trucchetto</span>}
          {!isCantrip && <span className="sb-sdp-level-pill" style={{ background: `${color}18`, borderColor: `${color}38`, color }}>Lv {spell.level}</span>}
        </div>
        {hasDamage && (
          <div className="sb-sdp-damage-chip" style={{ background: `${color}18`, borderColor: `${color}45`, color }}>
            <FaBolt size={9} />
            <span>{spell.baseDice}{spell.damageType ? ` ${spell.damageType}` : ''}</span>
            {spell.attackMode === 'save' && <span className="sb-sdp-save-tag">TS {spell.saveStat?.toUpperCase()}</span>}
          </div>
        )}
      </div>

      {/* ── Stats list ── */}
      {visibleStats.length > 0 && (
        <div className="sb-sdp-stats">
          {visibleStats.map(([label, val]) => (
            <div key={label} className="sb-sdp-stat-row">
              <span className="sb-sdp-stat-icon" style={{ color }}>{STAT_ICONS[label]}</span>
              <span className="sb-sdp-stat-label">{label}</span>
              <span className="sb-sdp-stat-value">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Description ── */}
      {spell.description && (
        <div className="sb-sdp-desc">
          <div className="sb-sdp-desc-label">Descrizione</div>
          <p className="sb-sdp-desc-text">{spell.description}</p>
        </div>
      )}

      {/* ── Upcast ── */}
      {spell.upcastDice && (
        <div className="sb-sdp-upcast" style={{ borderLeftColor: `${color}55`, background: `${color}08` }}>
          <div className="sb-sdp-upcast-hdr">
            <FaGraduationCap size={11} style={{ color }} />
            <span style={{ color }}>Potenziamento</span>
          </div>
          <span className="sb-sdp-upcast-text">
            +{spell.upcastDice} per ogni livello superiore al {spell.upcastEveryLevels ?? 1}°
            {spell.upcastMaxSteps ? ` (max ${spell.upcastMaxSteps} volte)` : ''}
          </span>
        </div>
      )}

      {/* ── Linked creatures ── */}
      {linkedNames.length > 0 && (
        <div className="sb-sdp-creatures">
          <div className="sb-sdp-section-label"><FaDragon size={10} style={{ color }} /> Creature evocabili</div>
          <div className="sb-sdp-creature-list">
            {linkedNames.map(n => (
              <span key={n} className="sb-sdp-creature-badge" style={{ borderColor: `${color}40`, background: `${color}12`, color }}>
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Prepare action strip ── */}
      <div className="sb-sdp-prep-strip" style={{ '--sdp-color': color } as React.CSSProperties}>
        <div className="sb-sdp-prep-info">
          <span className="sb-sdp-prep-label">Preparazioni</span>
          <span className="sb-sdp-prep-count" style={prepCount > 0 ? { color } : {}}>
            {prepCount > 0 ? `${prepCount}×` : '—'}
          </span>
        </div>
        <div className="sb-sdp-prep-actions">
          <button className="sb-sdp-unprepare-btn" onClick={onUnprepare} disabled={prepCount === 0} title="Rimuovi una preparazione">
            <FaMinus size={9} />
          </button>
          <button
            className={`sb-sdp-prepare-btn${canPrepare ? ' can' : ''}`}
            onClick={() => { if (canPrepare) onPrepare(); }}
            disabled={!canPrepare}
            title={canPrepare ? 'Prepara una copia' : 'Nessuno slot disponibile'}
            style={canPrepare ? { background: `${color}22`, borderColor: `${color}60`, color } as React.CSSProperties : {}}>
            <FaPlus size={9} /> Prepara
          </button>
        </div>
      </div>

    </div>
  );
};

// ── Kanban card (prepared spell in daily tab) ──────────────────────────────────
const KanbanCard: React.FC<{
  prep: { id: string; spellId: string; cast: boolean };
  spell: Spell;
  slotLevel: number;
  onCast: () => void;
  onRestore: () => void;
  onRemove: () => void;
}> = ({ prep, spell, slotLevel, onCast, onRestore, onRemove }) => {
  const spColor = SCHOOL_COLOR[spell.school] ?? 'var(--text-muted)';
  const isUpcast = spell.level < slotLevel;
  const slug = SCHOOL_ICON_SLUG[spell.school];
  return (
    <div className={`sb-kanban-card${prep.cast ? ' cast' : ''}`}
      style={{ '--kcard-c': spColor, borderLeftColor: spColor } as React.CSSProperties}>
      <div className="sb-kcard-school-strip" style={{ background: `${spColor}18` }}>
        {slug && getDndIconSvg('spell', slug)
          ? <DndIcon category="spell" name={slug} size={13} style={{ color: spColor, flexShrink: 0 }} />
          : <span style={{ fontSize: '0.75rem', color: spColor }}>{SCHOOL_ICON[spell.school] ?? '✦'}</span>
        }
        <span className="sb-kcard-school-name" style={{ color: `${spColor}cc` }}>
          {spell.school}
        </span>
        {isUpcast && (
          <span className="sb-kcard-upcast" style={{ color: spColor }}>
            <DndIcon category="spell" name="upcast" size={9} style={{ color: spColor }} />
            Lv{slotLevel}
          </span>
        )}
      </div>
      <div className="sb-kcard-body">
        <span className="sb-kcard-name">{spell.name}</span>
        <div className="sb-kcard-actions">
          <button
            className={`sb-kcast-btn${prep.cast ? ' restore' : ' ready'}`}
            onClick={prep.cast ? onRestore : onCast}
            title={prep.cast ? 'Ripristina slot' : 'Lancia (consuma slot)'}
            style={!prep.cast ? { '--btn-c': spColor } as React.CSSProperties : {}}>
            {prep.cast
              ? <FaMinus size={9} />
              : <DndIcon category="spell" name="consumed" size={13} style={{ color: 'inherit' }} />
            }
            <span>{prep.cast ? 'Ripristina' : 'Lancia'}</span>
          </button>
          <button className="sb-kcard-remove" onClick={onRemove} title="Rimuovi preparazione">
            <FaTimes size={8} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Spell card ─────────────────────────────────────────────────────────────────
const SpellCard: React.FC<SpellRowProps> = ({ spell, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, creatureNameMap, selectedSpellId, onSelect, requestDel }) => {
  const { t } = useTranslation();
  const prepCount = prepCountFor(spell.id);
  const isSelected = selectedSpellId === spell.id;
  const color = SCHOOL_COLOR[spell.school] ?? 'var(--text-muted)';
  const { resolveSchoolSvg, sanitizeSvg } = useIconCatalog();
  const schoolSvg = resolveSchoolSvg(spell.school);
  const MAX_DESC = 100;
  const slot = slots[String(spell.level)];
  const slotsLeft = slot ? slot.total - slot.used : 0;
  const canPrepare = spell.level === 0 || slotsLeft > 0 || prepCount < (slot?.total ?? 0);
  const linkedNames = (spell.summonableCreatureIds ?? [])
    .map(id => creatureNameMap[id])
    .filter(Boolean) as string[];

  const stats: [React.ReactNode, string | undefined, string][] = [
    [<FaClock size={9} />, spell.castingTime, 'Tempo'],
    [<FaArrowsAltH size={9} />, spell.range, 'Gittata'],
    [<FaHourglass size={9} />, spell.duration, 'Durata'],
    [<FaShieldAlt size={9} />, spell.savingThrow, 'TS'],
    [<FaFeather size={9} />, spell.components, 'Comp.'],
  ];
  const visibleStats = stats.filter(([, v]) => v && v.trim());
  const schoolClass = spell.school ? `sb-card--${spell.school.toLowerCase()}` : '';

  return (
    <div
      className={`sb-card ${schoolClass}${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(spell.id)}
      style={{
        '--c': color,
        cursor: 'pointer',
        borderColor: isSelected ? `${color}70` : undefined,
        borderLeftColor: color,
        borderLeftWidth: '3px',
        boxShadow: isSelected
          ? `0 0 0 2px ${color}40, 0 4px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.10)`
          : `0 2px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.05)`,
      } as React.CSSProperties}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `0 6px 22px rgba(0,0,0,0.5), 0 0 14px ${color}28, inset 0 1px 0 rgba(201,168,76,0.10)`;
        el.style.borderColor = isSelected ? `${color}80` : `${color}50`;
        el.style.borderLeftColor = color;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = isSelected
          ? `0 0 0 2px ${color}40, 0 4px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.10)`
          : `0 2px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.05)`;
        el.style.borderColor = isSelected ? `${color}70` : `rgba(180,140,60,0.18)`;
        el.style.borderLeftColor = color;
      }}
    >
      {/* Top accent bar */}
      <div className="sb-card-accent" style={{ background: `linear-gradient(90deg, ${color}cc, ${color}44, transparent)` }} />

      {/* Edit / delete buttons */}
      <div className="sb-card-btns">
        <button className="sb-icon-btn edit" onClick={e => { e.stopPropagation(); startEdit(spell); }} title="Modifica"><FaEdit size={10} /></button>
        <button className="sb-icon-btn del" onClick={e => { e.stopPropagation(); requestDel(spell.id); }} title="Elimina"><FaTrash size={10} /></button>
      </div>

      {/* Header */}
      <div className="sb-card-header" style={{ background: `linear-gradient(180deg, ${color}18, ${color}06)`, borderBottomColor: `${color}25` }}>
        <div className="sb-card-level" style={{ background: `linear-gradient(135deg, ${color}, ${color}77)`, boxShadow: `0 2px 6px ${color}44`, fontSize: spell.level === 0 ? undefined : '1rem' }}
          {...(spell.level === 0 ? { className: 'sb-card-level trucchetto' } : {})}>
          {spell.level === 0 ? 'TR' : spell.level}
        </div>
        <div className="sb-card-info">
          <span className="sb-card-name">{spell.name}</span>
          <span className="sb-card-school" style={{ color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 4, padding: '2px 7px', lineHeight: 1.5 }}>
            {schoolSvg ? (
              <span
                className="sb-card-school-svg inv-svg-tinted"
                style={{ color }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvg(schoolSvg) }}
              />
            ) : SCHOOL_ICON_SLUG[spell.school] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[spell.school]) ? (
              <DndIcon category="spell" name={SCHOOL_ICON_SLUG[spell.school]} size={11} style={{ color }} />
            ) : (
              SCHOOL_ICON[spell.school] ?? ''
            )} {t(`spellbook.schools.${spell.school}`, spell.school)}
          </span>
        </div>
      </div>

      {/* Body — grows to push footer to bottom */}
      <div className="sb-card-body">
        {/* Description — truncated, full view in sidebar */}
        {spell.description && (
          <div className="sb-card-desc-wrap">
            <p className="sb-card-desc">
              {spell.description.length > MAX_DESC ? spell.description.slice(0, MAX_DESC) + '…' : spell.description}
            </p>
          </div>
        )}

        {/* Stats */}
        {visibleStats.length > 0 && (
          <div className="sb-card-stats">
            {visibleStats.map(([icon, val, label]) => (
              <div key={label} className="sb-stat" style={{ borderColor: `${color}28`, background: `${color}08` }}>
                <span className="sb-stat-icon" style={{ color: `${color}99` }}>{icon}</span>
                <span className="sb-stat-label">{label}</span>
                <span className="sb-stat-value">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Linked creatures */}
        {linkedNames.length > 0 && (
          <div className="sb-card-linked">
            {linkedNames.map(name => (
              <span key={name} className="sb-linked-chip">
                <FaDragon size={7} /> {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer — always pinned to bottom */}
      <div className="sb-card-footer" style={{ background: `linear-gradient(180deg, ${color}05, ${color}12)`, borderTopColor: `${color}28` }}>
        <div className={`sb-prep-counter${prepCount > 0 ? ' has-preps' : ''}`}
          style={prepCount > 0 ? { '--c-border': `${color}44`, '--c-bg': `${color}14`, '--c-color': color } as React.CSSProperties : {}}>
          <button className="sb-prep-minus" onClick={e => { e.stopPropagation(); unprepareSpellOne(spell.id); }} disabled={prepCount === 0} title="Rimuovi una preparazione">
            <FaMinus size={9} />
          </button>
          <span className="sb-prep-count">{prepCount}×</span>
        </div>
        <button
          className={`sb-prepare-btn${canPrepare ? ' can-prepare' : ''}`}
          onClick={e => { e.stopPropagation(); if (canPrepare) prepareWizardSpell(spell.level, spell.id); }}
          disabled={!canPrepare}
          title={canPrepare ? 'Prepara una copia di questo incantesimo' : 'Nessuno slot disponibile'}
          style={canPrepare ? { '--c-btn-bg': `${color}22`, '--c-btn-border': `${color}70` } as React.CSSProperties : {}}>
          <FaPlus size={10} /> Prepara
        </button>
      </div>
    </div>
  );
};

// ── Spell catalog picker modal (school tabs + level sub-tabs) ─────────────────
const SpellCatalogPicker: React.FC<{
  items: CatalogSpell[];
  loading: boolean;
  knownNames: Set<string>;
  onPick: (cs: CatalogSpell) => void;
  onClose: () => void;
}> = ({ items, loading, knownNames, onPick, onClose }) => {
  const [activeSchool, setActiveSchool] = useState<string>('all');
  const [activeLevel, setActiveLevel] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const presentSchools = useMemo(() =>
    SCHOOLS.filter(s => items.some(i => i.school === s)), [items]);

  const levelsInSchool = useMemo(() => {
    const src = activeSchool === 'all' ? items : items.filter(i => i.school === activeSchool);
    return [...new Set(src.map(i => i.level))].sort((a, b) => a - b);
  }, [items, activeSchool]);

  const handleSchoolTab = (school: string) => {
    setActiveSchool(school);
    setActiveLevel('all');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (activeSchool !== 'all' && i.school !== activeSchool) return false;
      if (activeLevel !== 'all' && i.level !== activeLevel) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
  }, [items, activeSchool, activeLevel, search]);

  const activeColor = activeSchool === 'all' ? 'rgba(180,140,60,0.7)' : (SCHOOL_COLOR[activeSchool] ?? 'rgba(180,140,60,0.7)');

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(780px, 100%)', maxHeight: '88vh',
          background: 'linear-gradient(160deg, #1e1a12 0%, #14100a 100%)',
          border: '1px solid rgba(180,140,60,0.28)',
          borderRadius: 12, display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(180,140,60,0.16)', background: 'rgba(0,0,0,0.25)', flexShrink: 0 }}>
          <GiBookmarklet size={18} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#d4c090', letterSpacing: '0.07em', flex: 1 }}>
            Catalogo Magie — Importa
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#7a6840', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <FaTimes size={16} />
          </button>
        </div>

        {/* ── School tab rail ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 14px', borderBottom: '1px solid rgba(180,140,60,0.1)', flexShrink: 0, background: 'rgba(0,0,0,0.12)' }}>
          <button
            onClick={() => handleSchoolTab('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${activeSchool === 'all' ? 'rgba(180,140,60,0.5)' : 'rgba(180,140,60,0.13)'}`,
              background: activeSchool === 'all' ? 'rgba(180,140,60,0.12)' : 'transparent',
              color: activeSchool === 'all' ? '#d4c090' : '#5a4e35',
              fontFamily: 'var(--font-heading)', fontSize: '0.73rem', letterSpacing: '0.04em',
              transition: 'all 0.15s', fontWeight: activeSchool === 'all' ? 700 : 400,
            }}>
            ✦ Tutti
            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 20, background: activeSchool === 'all' ? 'rgba(180,140,60,0.18)' : 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-body)' }}>{items.length}</span>
          </button>
          {presentSchools.map(school => {
            const color = SCHOOL_COLOR[school] ?? 'var(--accent-gold)';
            const isActive = activeSchool === school;
            const count = items.filter(i => i.school === school).length;
            return (
              <button key={school} onClick={() => handleSchoolTab(school)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${isActive ? `${color}50` : 'rgba(180,140,60,0.13)'}`,
                background: isActive ? `${color}16` : 'transparent',
                color: isActive ? color : '#5a4e35',
                fontFamily: 'var(--font-heading)', fontSize: '0.73rem', letterSpacing: '0.04em',
                transition: 'all 0.15s', fontWeight: isActive ? 700 : 400,
              }}>
                {SCHOOL_ICON_SLUG[school] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[school])
                  ? <DndIcon category="spell" name={SCHOOL_ICON_SLUG[school]} size={12} style={{ color: isActive ? color : '#5a4e35', flexShrink: 0 }} />
                  : <span style={{ fontSize: '0.75rem', lineHeight: 1 }}>{SCHOOL_ICON[school] ?? '✦'}</span>}
                {school}
                <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: 20, background: isActive ? `${color}1e` : 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-body)' }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Level sub-tabs ── */}
        {levelsInSchool.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '7px 14px', borderBottom: `1px solid ${activeColor}1a`, flexShrink: 0 }}>
            <button
              onClick={() => setActiveLevel('all')}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '0.69rem', cursor: 'pointer',
                border: `1px solid ${activeLevel === 'all' ? activeColor : 'rgba(180,140,60,0.18)'}`,
                background: activeLevel === 'all' ? `${activeColor}16` : 'transparent',
                color: activeLevel === 'all' ? activeColor : '#5a4e35',
                transition: 'all 0.15s', fontFamily: 'var(--font-heading)',
              }}>
              Tutti i livelli
            </button>
            {levelsInSchool.map(level => {
              const isActive = activeLevel === level;
              const count = items.filter(i => (activeSchool === 'all' || i.school === activeSchool) && i.level === level).length;
              return (
                <button key={level} onClick={() => setActiveLevel(isActive ? 'all' : level)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.69rem', cursor: 'pointer',
                  border: `1px solid ${isActive ? activeColor : 'rgba(180,140,60,0.18)'}`,
                  background: isActive ? `${activeColor}16` : 'transparent',
                  color: isActive ? activeColor : '#5a4e35',
                  transition: 'all 0.15s', fontFamily: 'var(--font-heading)',
                }}>
                  {level === 0 ? 'Trucchetto' : `Lv ${level}`}
                  <span style={{ fontSize: '0.6rem', padding: '0 4px', borderRadius: 20, background: isActive ? `${activeColor}1e` : 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-body)' }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Search ── */}
        <div style={{ padding: '8px 14px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(26,22,15,0.9)', border: '1px solid rgba(180,140,60,0.18)', borderRadius: 6, padding: '7px 12px' }}>
            <FaSearch size={11} style={{ color: '#5a4e35', flexShrink: 0 }} />
            <input
              autoFocus
              style={{ background: 'transparent', border: 'none', color: '#c8b888', outline: 'none', flex: 1, fontSize: '0.82rem' }}
              placeholder={activeSchool === 'all' ? 'Cerca per nome o descrizione…' : `Cerca in ${activeSchool}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: '#5a4e35', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <FaTimes size={10} />
              </button>
            )}
          </div>
        </div>

        {/* ── Results ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 8px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(180,140,60,0.2) transparent' }}>
          {loading && <div style={{ color: '#7a6840', fontSize: '0.8rem', padding: '2.5rem 0', textAlign: 'center' }}>Caricamento catalogo…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ color: '#5a4e35', fontSize: '0.8rem', padding: '2.5rem 0', textAlign: 'center', fontStyle: 'italic' }}>Nessuna magia trovata.</div>
          )}
          {!loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {filtered.map(cs => {
                const color = SCHOOL_COLOR[cs.school] ?? 'var(--accent-gold)';
                const alreadyKnown = knownNames.has(cs.name.trim().toLowerCase());
                const isExpanded = expandedId === cs.id;
                return (
                  <div key={cs.id} style={{
                    borderRadius: 8,
                    border: `1px solid ${alreadyKnown ? 'rgba(39,174,96,0.22)' : `${color}16`}`,
                    background: alreadyKnown ? 'rgba(39,174,96,0.04)' : 'rgba(255,255,255,0.018)',
                    overflow: 'hidden',
                    transition: 'border-color 0.12s',
                  }}>
                    {/* Main row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
                      {SCHOOL_ICON_SLUG[cs.school] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[cs.school])
                        ? <DndIcon category="spell" name={SCHOOL_ICON_SLUG[cs.school]} size={16} style={{ color, flexShrink: 0 }} />
                        : <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>{SCHOOL_ICON[cs.school] ?? '✦'}</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', fontSize: '0.88rem', color: '#d4c090', flexWrap: 'wrap' }}>
                          {cs.name}
                          <span style={{ fontSize: '0.63rem', color, background: `${color}16`, border: `1px solid ${color}28`, padding: '1px 6px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
                            {cs.level === 0 ? 'Trucchetto' : `Lv ${cs.level}`}
                          </span>
                          {activeSchool === 'all' && <span style={{ fontSize: '0.63rem', color: '#7a6840', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>{cs.school}</span>}
                          {alreadyKnown && (
                            <span style={{ fontSize: '0.60rem', color: '#27ae60', background: 'rgba(39,174,96,0.14)', border: '1px solid rgba(39,174,96,0.32)', padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
                              ✓ Già importata
                            </span>
                          )}
                        </div>
                        {!isExpanded && cs.description && (
                          <div style={{ fontSize: '0.7rem', color: '#5a4e35', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {cs.description}
                          </div>
                        )}
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {cs.castingTime && !isExpanded && (
                          <span style={{ fontSize: '0.65rem', color: '#5a4e35', whiteSpace: 'nowrap' }}>⏱ {cs.castingTime}</span>
                        )}
                        {cs.description && (
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : cs.id); }}
                            title={isExpanded ? 'Comprimi' : 'Espandi dettagli'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
                              background: isExpanded ? `${color}20` : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${isExpanded ? `${color}44` : 'rgba(255,255,255,0.08)'}`,
                              color: isExpanded ? color : '#5a4e35', fontSize: '0.7rem',
                              transition: 'all 0.13s', flexShrink: 0,
                            }}>
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                        <button
                          onClick={() => onPick(cs)}
                          title="Importa nel grimorio"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                            background: alreadyKnown ? 'rgba(180,140,60,0.06)' : `${color}18`,
                            border: `1px solid ${alreadyKnown ? 'rgba(180,140,60,0.22)' : `${color}40`}`,
                            color: alreadyKnown ? '#7a6840' : color,
                            fontSize: '0.68rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em',
                            transition: 'all 0.12s', flexShrink: 0, whiteSpace: 'nowrap',
                          }}>
                          {alreadyKnown ? 'Reimporta' : 'Importa'}
                        </button>
                      </div>
                    </div>
                    {/* Expanded description */}
                    {isExpanded && (
                      <div style={{ padding: '0 12px 12px 42px', borderTop: `1px solid ${color}14` }}>
                        {cs.castingTime && (
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '7px 0 8px', fontSize: '0.70rem', color: '#8a7850' }}>
                            <span>⏱ {cs.castingTime}</span>
                            {cs.range && <span>⇤ {cs.range}</span>}
                            {cs.duration && <span>⧗ {cs.duration}</span>}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.76rem', color: '#b0986a', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {cs.description}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(180,140,60,0.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.18)', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', color: '#5a4e35' }}>{filtered.length} / {items.length} magie</span>
          <button
            onClick={onClose}
            style={{ background: 'rgba(180,140,60,0.08)', border: '1px solid rgba(180,140,60,0.22)', color: '#b09a70', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const Spellbook: React.FC = () => {
  const { t } = useTranslation();
  const {
    character, addSpell, updateSpell, deleteSpell, setSpellSlotTotal,
    prepareWizardSpell, unprepareWizardSpell, castPreparedSpell, restorePreparedSpell, restWizardSpells,
  } = useCharacterStore();
  const [spellTab, setSpellTab] = useState<SpellTab>('grimoire');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [pickerLvl, setPickerLvl] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Spell, 'id'>>(EMPTY_SPELL());
  const [grimActiveSchool, setGrimActiveSchool] = useState<string>('all');
  const [grimActiveLevel, setGrimActiveLevel] = useState<number | 'all'>('all');
  const [grimSearch, setGrimSearch] = useState('');
  const [dailyLvlPickerOpen, setDailyLvlPickerOpen] = useState(false);
  const dailyLvlBtnRef = useRef<HTMLButtonElement>(null);

  // Catalog picker
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogSpell[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogCreatureCache, setCatalogCreatureCache] = useState<CatalogCreature[]>([]);
  // Load catalog creatures once for name resolution in spell badges
  useEffect(() => { creatureCatalog.list().then(setCatalogCreatureCache); }, []);
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

  // Levels that exist in grimoire (for slot levels only)
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
      setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL());
    } else {
      const newId = uuidv4();
      addSpell({ ...form, id: newId });
      setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL());
      setSelectedSpellId(newId);
    }
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
    setSelectedSpellId(spell.id);
  };
  const cancelEdit = () => { setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL()); };
  const closeSidebar = () => { setSelectedSpellId(null); setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL()); };

  const formProps: SpellEditFormProps = { form, setForm, saveSpell, cancelEdit, editingId };

  // id → name map for all known creatures (personal bestiary + catalog)
  const bestiary = character.bestiary ?? [];
  const creatureNameMap: Record<string, string> = {};
  bestiary.forEach(e => { creatureNameMap[e.id] = e.creature.name; });
  catalogCreatureCache.forEach(c => { if (!creatureNameMap[c.id]) creatureNameMap[c.id] = c.name; });

  const requestDel = (id: string) => setConfirmDelId(id);
  const cardProps = { editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps, isMobile, creatureNameMap, selectedSpellId, requestDel, onSelect: (id: string) => { setSelectedSpellId(id); setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL()); } };

  // Spell lookup
  const spellById = new Map<string, Spell>();
  spells.forEach(s => spellById.set(s.id, s));

  // Grimoire filter
  const grimSearchLower = grimSearch.trim().toLowerCase();
  const grimPresentSchools = SCHOOLS.filter(sc => spells.some(s => s.school === sc));
  const grimLevelsInSchool = [...new Set(
    (grimActiveSchool === 'all' ? spells : spells.filter(s => s.school === grimActiveSchool)).map(s => s.level)
  )].sort((a, b) => a - b);
  const filteredGrimSpells = spells.filter(s => {
    if (grimActiveSchool !== 'all' && s.school !== grimActiveSchool) return false;
    if (grimActiveLevel !== 'all' && s.level !== grimActiveLevel) return false;
    if (grimSearchLower && !s.name.toLowerCase().includes(grimSearchLower) && !s.school.toLowerCase().includes(grimSearchLower) && !t(`spellbook.schools.${s.school}`, s.school).toLowerCase().includes(grimSearchLower)) return false;
    return true;
  });
  const grimActiveColor = grimActiveSchool === 'all' ? 'rgba(180,140,60,0.6)' : (SCHOOL_COLOR[grimActiveSchool] ?? 'rgba(180,140,60,0.6)');

  return (
    <div className="sb-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* ── Copertina del Grimorio ── */}
      <div className="sb-cover">
        <div className="sb-cover-icon">
          <GiSpellBook size={24} />
        </div>
        <div className="sb-cover-info">
          <div className="sb-cover-title">{t('spellbook.grimoire')}</div>
          <div className="sb-cover-subtitle">{spells.length === 1 ? '1 incantesimo' : `${spells.length} incantesimi`} · {t('spellbook.dailySpells').toLowerCase()} {totalPreps > 0 ? `· ${totalPreps} preparati` : ''}</div>
        </div>
        <div className="sb-cover-actions">
          <button className="sb-nav-rest" onClick={restWizardSpells} title={t('spellbook.longRest')}>
            <FaMoon size={10} /> {t('spellbook.longRest')}
          </button>
        </div>
      </div>

      {/* ── Navigazione tab ── */}
      <div className="sb-nav">
        {([['grimoire', <><FaBookOpen size={11} /> {t('spellbook.grimoire')}</>, spells.length],
        ['daily', <><FaCalendarDay size={11} /> {t('spellbook.dailySpells')}</>, totalPreps]] as [SpellTab, React.ReactNode, number][]).map(([key, label, cnt]) => (
          <button key={key} className={`sb-nav-tab${spellTab === key ? ' active' : ''}`} onClick={() => setSpellTab(key)}>
            {label}
            <span className="sb-nav-badge">{cnt}</span>
          </button>
        ))}
      </div>

      {/* ── GRIMOIRE TAB ── */}
      {spellTab === 'grimoire' && (
        <div className="sb-grimoire-row">
          <div className="sb-grimoire-main">
            {/* ── School tab rail ── */}
            <div className="sb-filter-rail" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 14px 0', flexShrink: 0 }}>
              <button
                onClick={() => { setGrimActiveSchool('all'); setGrimActiveLevel('all'); setGrimSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${grimActiveSchool === 'all' ? 'rgba(180,140,60,0.55)' : 'rgba(180,140,60,0.14)'}`,
                  background: grimActiveSchool === 'all' ? 'rgba(180,140,60,0.1)' : 'transparent',
                  color: grimActiveSchool === 'all' ? '#d4c090' : '#5a4e35',
                  fontFamily: 'var(--font-heading)', fontSize: '0.72rem', letterSpacing: '0.04em',
                  transition: 'all 0.15s', fontWeight: grimActiveSchool === 'all' ? 700 : 400,
                }}>
                ✦ {t('spellbook.all')}
                <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 20, background: grimActiveSchool === 'all' ? 'rgba(180,140,60,0.2)' : 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-body)' }}>{spells.length}</span>
              </button>
              {grimPresentSchools.map(sc => {
                const c = SCHOOL_COLOR[sc] ?? 'var(--accent-arcane)';
                const isActive = grimActiveSchool === sc;
                const count = spells.filter(s => s.school === sc).length;
                return (
                  <button key={sc} onClick={() => { setGrimActiveSchool(isActive ? 'all' : sc); setGrimActiveLevel('all'); setGrimSearch(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${isActive ? `${c}50` : 'rgba(180,140,60,0.14)'}`,
                    background: isActive ? `${c}14` : 'transparent',
                    color: isActive ? c : '#5a4e35',
                    fontFamily: 'var(--font-heading)', fontSize: '0.72rem', letterSpacing: '0.04em',
                    transition: 'all 0.15s', fontWeight: isActive ? 700 : 400,
                  }}>
                    {SCHOOL_ICON_SLUG[sc] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[sc])
                      ? <DndIcon category="spell" name={SCHOOL_ICON_SLUG[sc]} size={12} style={{ color: isActive ? c : '#5a4e35' }} />
                      : <span style={{ fontSize: '0.75rem' }}>{SCHOOL_ICON[sc] ?? '✦'}</span>}
                    {t(`spellbook.schools.${sc}`, sc)}
                    <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: 20, background: isActive ? `${c}1e` : 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-body)' }}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Level sub-tabs (always shown when there are levels) ── */}
            {grimLevelsInSchool.length > 0 && (
              <div className="sb-level-rail" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 14px 0', flexShrink: 0 }}>
                <button
                  onClick={() => setGrimActiveLevel('all')}
                  style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: '0.68rem', cursor: 'pointer',
                    border: `1px solid ${grimActiveLevel === 'all' ? grimActiveColor : 'rgba(180,140,60,0.18)'}`,
                    background: grimActiveLevel === 'all' ? `${grimActiveColor}14` : 'transparent',
                    color: grimActiveLevel === 'all' ? grimActiveColor : '#5a4e35',
                    transition: 'all 0.15s', fontFamily: 'var(--font-heading)',
                  }}>
                  {t('spellbook.all')} livelli
                </button>
                {grimLevelsInSchool.map(lv => {
                  const isActive = grimActiveLevel === lv;
                  const lvTabColor = grimActiveSchool === 'all' ? (LEVEL_COLOR[lv] ?? grimActiveColor) : grimActiveColor;
                  const count = spells.filter(s => (grimActiveSchool === 'all' || s.school === grimActiveSchool) && s.level === lv).length;
                  return (
                    <button key={lv}
                      onClick={() => setGrimActiveLevel(isActive ? 'all' : lv)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.68rem', cursor: 'pointer',
                        border: `1px solid ${isActive ? lvTabColor : 'rgba(180,140,60,0.18)'}`,
                        background: isActive ? `${lvTabColor}18` : 'transparent',
                        color: isActive ? lvTabColor : '#5a4e35',
                        transition: 'all 0.15s', fontFamily: 'var(--font-heading)',
                      }}>
                      {lv === 0 ? t('spellbook.cantripShort') : `${t('spellbook.levelShort')} ${lv}`}
                      <span style={{ fontSize: '0.6rem', padding: '0 4px', borderRadius: 20, background: isActive ? `${lvTabColor}1e` : 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-body)' }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Toolbar ── */}
            <div className="sb-toolbar">
              <div className="sb-search-wrap">
                <FaSearch size={11} className="sb-search-icon" />
                <input className="sb-search-input" value={grimSearch} onChange={e => setGrimSearch(e.target.value)}
                  placeholder="Cerca nel grimorio…" />
              </div>
              <button className="btn-primary" style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  setIsAdding(true); setEditingId(null); setSelectedSpellId(null);
                  setForm({ ...EMPTY_SPELL(), level: grimActiveLevel === 'all' ? 1 : grimActiveLevel });
                }}
                disabled={isAdding}>
                <FaPlus size={10} /> <span className="sb-btn-label">{t('spellbook.addSpell')}</span>
              </button>
              <button className="btn-secondary" style={{ fontSize: '0.8rem' }}
                onClick={openCatalogPicker} disabled={isAdding}>
                <GiBookmarklet size={11} /> <span className="sb-btn-label">{t('spellbook.fromCatalog')}</span>
              </button>
            </div>

            {/* Cards area */}
            {spells.length === 0 && !isAdding ? (
              <div className="sb-empty">
                <GiSpellBook size={32} className="sb-empty-icon" />
                <p className="sb-empty-text">Il grimorio è vuoto.</p>
                <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => { setIsAdding(true); setForm({ ...EMPTY_SPELL(), level: 1 }); }}>
                  <FaPlus size={10} /> {t('spellbook.addSpell')}
                </button>
              </div>
            ) : filteredGrimSpells.length === 0 ? (
              <div className="sb-empty">
                <p className="sb-empty-text">
                  {grimSearchLower
                    ? <>Nessun incantesimo corrisponde a <strong>"{grimSearch}"</strong>.</>
                    : <>Nessun incantesimo{grimActiveSchool !== 'all' ? ` di ${t(`spellbook.schools.${grimActiveSchool}`, grimActiveSchool)}` : ''}{grimActiveLevel !== 'all' ? (grimActiveLevel === 0 ? ' trucchetto' : ` di livello ${grimActiveLevel}`) : ''}.</>}
                </p>
              </div>
            ) : (
              <div className="sb-scroll-area" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 8 }}>
                {grimActiveSchool === 'all' && grimActiveLevel === 'all' ? (
                  // Group by level when showing all schools/all levels
                  (() => {
                    const levelKeys = [...new Set(filteredGrimSpells.map(s => s.level))].sort((a, b) => a - b);
                    return levelKeys.map(lv => {
                      const lvColor = LEVEL_COLOR[lv] ?? 'var(--accent-gold)';
                      const lvSpells = filteredGrimSpells.filter(s => s.level === lv);
                      return (
                        <div key={lv} style={{ marginBottom: '1.2rem' }}>
                          <div className="sb-level-hdr">
                            <span className="sb-level-badge" style={{ background: `${lvColor}22`, border: `1px solid ${lvColor}55`, color: lvColor, width: 'auto', minWidth: 28, height: 'auto', padding: '2px 10px', borderRadius: 12, fontSize: '0.82rem' }}>
                              {lv === 0 ? 'Trucchetti' : `Livello ${lv}`}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#5a4e35', fontFamily: 'var(--font-body)' }}>{lvSpells.length}</span>
                          </div>
                          <div className="sb-cards-grid">
                            {lvSpells.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <div className="sb-cards-grid">
                    {filteredGrimSpells.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                  </div>
                )}
              </div>
            )}
          </div>{/* /sb-grimoire-main */}

          {/* ── Spell detail sidebar (desktop) ── */}
          {(selectedSpellId !== null || isAdding) && !isMobile && (() => {
            const sel = spells.find(s => s.id === selectedSpellId);
            const isEditMode = editingId !== null || isAdding;
            const displaySchool = isEditMode ? form.school : (sel?.school ?? '');
            const displayLevel = isEditMode ? form.level : (sel?.level ?? 1);
            const displayName = isEditMode ? (form.name || (isAdding ? 'Nuovo Incantesimo' : '—')) : (sel?.name ?? '—');
            const displayColor = SCHOOL_COLOR[displaySchool] ?? 'var(--accent-gold)';
            return (
              <aside className="sb-detail-col" key={selectedSpellId ?? '__new__'}>
                {/* Color accent bar at top */}
                <div className="sb-sidebar-accent-bar" style={{ background: `linear-gradient(90deg, ${displayColor}00, ${displayColor}cc 40%, ${displayColor}cc 60%, ${displayColor}00)` }} />
                <div className="sb-sidebar-hdr" style={{ '--col': displayColor } as React.CSSProperties}>
                  <div className="sb-sidebar-hdr-icon" style={{ background: `${displayColor}18`, border: `1.5px solid ${displayColor}40`, boxShadow: `0 2px 14px ${displayColor}30` }}>
                    {SCHOOL_ICON_SLUG[displaySchool] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[displaySchool])
                      ? <DndIcon category="spell" name={SCHOOL_ICON_SLUG[displaySchool]} size={28} style={{ color: displayColor }} />
                      : <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{SCHOOL_ICON[displaySchool] ?? '✦'}</span>}
                  </div>
                  <div className="sb-sidebar-hdr-info">
                    <div className="sb-sidebar-hdr-name">{displayName}</div>
                    <div className="sb-sidebar-hdr-meta">
                      <span className="sb-sidebar-hdr-level-badge" style={{ background: `${displayColor}20`, borderColor: `${displayColor}50`, color: displayColor }}>
                        {displayLevel === 0 ? 'Trucchetto' : `Lv ${displayLevel}`}
                      </span>
                      {displaySchool && <span className="sb-sidebar-hdr-school" style={{ color: displayColor }}>{t(`spellbook.schools.${displaySchool}`, displaySchool)}</span>}
                    </div>
                  </div>
                  <div className="sb-sidebar-hdr-actions">
                    {sel && !isEditMode && (
                      <>
                        <button className="sb-sidebar-action-btn" onClick={() => startEdit(sel)} title="Modifica" style={{ color: displayColor, borderColor: `${displayColor}40`, background: `${displayColor}12` }}>
                          <FaEdit size={12} />
                        </button>
                        <button className="sb-sidebar-action-btn danger" onClick={() => setConfirmDelId(sel.id)} title="Elimina">
                          <FaTrash size={11} />
                        </button>
                      </>
                    )}
                    <button className="sb-sidebar-close" onClick={closeSidebar} title="Chiudi"><FaTimes size={13} /></button>
                  </div>
                </div>
                <div className="sb-sidebar-body">
                  {isEditMode ? (
                    <SpellEditForm {...formProps} autoFocus />
                  ) : sel ? (
                    <SpellDetailPanel
                      spell={sel}
                      prepCount={prepCountFor(sel.id)}
                      canPrepare={sel.level === 0 || ((slots[String(sel.level)]?.total ?? 0) - (slots[String(sel.level)]?.used ?? 0)) > 0 || prepCountFor(sel.id) < (slots[String(sel.level)]?.total ?? 0)}
                      onPrepare={() => prepareWizardSpell(sel.level, sel.id)}
                      onUnprepare={() => unprepareSpellOne(sel.id)}
                      creatureNameMap={creatureNameMap}
                    />
                  ) : null}
                </div>
              </aside>
            );
          })()}
        </div>
      )}

      {/* ── DAILY TAB ── */}
      {spellTab === 'daily' && (
        <div className="sb-daily-wrap">
          <div className="sb-daily-hdr">
            <GiSpellBook size={20} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
            <div className="sb-daily-hdr-info">
              <span className="sb-daily-hdr-title">Preparazione Giornaliera</span>
              <span className="sb-daily-hdr-sub">Ogni carta è una copia dell'incantesimo. Lancia per consumare uno slot.</span>
            </div>
            <button ref={dailyLvlBtnRef}
              style={{ background: 'rgba(180,140,60,0.10)', border: '1px solid rgba(180,140,60,0.30)', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setDailyLvlPickerOpen(o => !o)}>
              <FaPlus size={9} /> Livello
            </button>
            {dailyLvlPickerOpen && (
              <LevelPickerPopover anchorRef={dailyLvlBtnRef} taken={slotLevels}
                onPick={(lvl) => setSpellSlotTotal(lvl, Math.max(1, slots[String(lvl)]?.total ?? 1))}
                onClose={() => setDailyLvlPickerOpen(false)} align="right" title="Aggiungi livello" />
            )}
          </div>
          {slotLevels.length === 0 ? (
            <div className="sb-empty">
              <GiCrystalBall size={32} className="sb-empty-icon" />
              <p className="sb-empty-text">Nessuno slot configurato.</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Aggiungi un livello per cominciare a preparare.</p>
            </div>
          ) : (
            <div className="sb-kanban-board sb-scroll-area">
              {slotLevels.map(lv => {
                const s = slots[String(lv)] ?? { total: 0, used: 0 };
                const available = s.total - s.used;
                const preps = prepByLevel[String(lv)] ?? [];
                const readyPreps = preps.filter(p => !p.cast);
                const castPreps = preps.filter(p => p.cast);
                const grimoireForLevel = spells.filter(sp => sp.level <= lv);
                const isPickerOpen = pickerLvl === lv;
                const lvName = lv === 0 ? 'Trucchetti' : `Livello ${lv}`;
                const accent = LEVEL_COLOR[lv] ?? 'var(--accent-arcane)';
                return (
                  <div key={lv} className="sb-kanban-col" style={{ '--kc': accent } as React.CSSProperties}>
                    <div className="sb-kanban-col-hdr" style={{ borderBottomColor: `${accent}28` }}>
                      <div className="sb-kanban-col-title">
                        <div className={`sb-slot-level-badge${lv === 0 ? ' trucchetto' : ''}`}
                          style={lv !== 0 ? { background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 2px 10px ${accent}55`, color: '#0a0806' } : {}}>
                          {lv === 0 ? 'TR' : lv}
                        </div>
                        <span className="sb-kanban-level-name" style={{ color: accent }}>{lvName}</span>
                        <span className="sb-kanban-avail-badge" style={{ color: available > 0 ? accent : '#4a4030', borderColor: available > 0 ? `${accent}44` : 'rgba(180,140,60,0.12)' }}>
                          {available}/{s.total}
                        </span>
                      </div>
                      {s.total > 0 && (
                        <div className="sb-kanban-slot-row">
                          <SlotPips total={s.total} used={s.used} color={accent} />
                          <div className="sb-slot-adjust">
                            <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, s.total + 1)} disabled={s.total >= 9}>+</button>
                            <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, Math.max(0, s.total - 1))}>-</button>
                          </div>
                        </div>
                      )}
                      {s.total === 0 && (
                        <div className="sb-slot-adjust" style={{ alignSelf: 'flex-end' }}>
                          <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, s.total + 1)} disabled={s.total >= 9}>+</button>
                          <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, Math.max(0, s.total - 1))}>-</button>
                        </div>
                      )}
                    </div>
                    <button className="sb-kanban-add-btn"
                      onClick={() => setPickerLvl(isPickerOpen ? null : lv)}
                      style={{ color: isPickerOpen ? accent : undefined, background: isPickerOpen ? `${accent}18` : undefined, borderColor: isPickerOpen ? `${accent}55` : undefined }}>
                      <FaPlus size={8} /> {isPickerOpen ? 'Chiudi' : 'Prepara'}
                    </button>
                    {isPickerOpen && (
                      <div className="sb-kanban-picker">
                        {grimoireForLevel.length === 0 ? (
                          <p className="sb-picker-empty">Nessun incantesimo di livello {lv} o inferiore nel grimorio.</p>
                        ) : (
                          grimoireForLevel.map(sp => {
                            const spColor = SCHOOL_COLOR[sp.school] ?? 'var(--text-muted)';
                            const spSlug = SCHOOL_ICON_SLUG[sp.school];
                            return (
                              <button key={sp.id} className="sb-kanban-pick-spell"
                                style={{ borderLeftColor: spColor }}
                                onClick={() => prepareWizardSpell(lv, sp.id)}>
                                {spSlug && getDndIconSvg('spell', spSlug)
                                  ? <DndIcon category="spell" name={spSlug} size={11} style={{ color: spColor, flexShrink: 0 }} />
                                  : <span style={{ color: spColor, fontSize: '0.8rem' }}>{SCHOOL_ICON[sp.school] ?? '✦'}</span>
                                }
                                <span>{sp.name}</span>
                                {sp.level < lv && (
                                  <span className="sb-pick-upcast" style={{ color: accent }}>
                                    ↑Lv{sp.level}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                    <div className="sb-kanban-cards">
                      {readyPreps.length === 0 && !isPickerOpen && (
                        <p className="sb-kanban-empty-col">Nessun incantesimo preparato</p>
                      )}
                      {readyPreps.map(p => {
                        const sp = spellById.get(p.spellId);
                        if (!sp) return null;
                        return (
                          <KanbanCard key={p.id} prep={p} spell={sp} slotLevel={lv}
                            onCast={() => castPreparedSpell(lv, p.id)}
                            onRestore={() => restorePreparedSpell(lv, p.id)}
                            onRemove={() => unprepareWizardSpell(lv, p.id)}
                          />
                        );
                      })}
                    </div>
                    {castPreps.length > 0 && (
                      <div className="sb-kanban-cast-section">
                        <div className="sb-kanban-cast-label">Lanciati ({castPreps.length})</div>
                        {castPreps.map(p => {
                          const sp = spellById.get(p.spellId);
                          if (!sp) return null;
                          return (
                            <KanbanCard key={p.id} prep={p} spell={sp} slotLevel={lv}
                              onCast={() => castPreparedSpell(lv, p.id)}
                              onRestore={() => restorePreparedSpell(lv, p.id)}
                              onRemove={() => unprepareWizardSpell(lv, p.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

      {/* Mobile: spell detail bottom drawer */}
      {isMobile && (() => {
        const mSel = spells.find(s => s.id === selectedSpellId);
        return (
          <BottomDrawer
            open={selectedSpellId !== null && !isAdding && editingId === null && !!mSel}
            onClose={() => setSelectedSpellId(null)}
            title={mSel?.name}
            accentColor={SCHOOL_COLOR[mSel?.school ?? ''] ?? 'var(--accent-arcane)'}
          >
            {mSel && (
              <SpellDetailPanel
                spell={mSel}
                prepCount={prepCountFor(mSel.id)}
                canPrepare={mSel.level === 0 || ((slots[String(mSel.level)]?.total ?? 0) - (slots[String(mSel.level)]?.used ?? 0)) > 0}
                onPrepare={() => prepareWizardSpell(mSel.level, mSel.id)}
                onUnprepare={() => unprepareSpellOne(mSel.id)}
                creatureNameMap={creatureNameMap}
              />
            )}
          </BottomDrawer>
        );
      })()}

      {catalogOpen && (
        <SpellCatalogPicker
          items={catalogItems}
          loading={catalogLoading}
          knownNames={new Set(spells.map(s => s.name.trim().toLowerCase()))}
          onClose={() => setCatalogOpen(false)}
          onPick={importFromCatalog}
        />
      )}

      {/* ── Modale conferma eliminazione ── */}
      {confirmDelId && (() => {
        const target = spells.find(s => s.id === confirmDelId);
        return (
          <div className="sb-del-overlay" onClick={() => setConfirmDelId(null)}>
            <div className="sb-del-modal" onClick={e => e.stopPropagation()}>
              <div className="sb-del-modal-icon"><FaTrash size={18} /></div>
              <p className="sb-del-modal-title">Eliminare l'incantesimo?</p>
              {target && <p className="sb-del-modal-name">«{target.name}»</p>}
              <p className="sb-del-modal-warn">L'azione non può essere annullata.</p>
              <div className="sb-del-modal-btns">
                <button className="sb-del-cancel" onClick={() => setConfirmDelId(null)}>Annulla</button>
                <button className="sb-del-confirm" onClick={() => { deleteSpell(confirmDelId); if (selectedSpellId === confirmDelId) closeSidebar(); setConfirmDelId(null); }}>
                  Elimina
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
