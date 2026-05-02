import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaMoon, FaBookOpen, FaCalendarDay, FaMinus, FaSearch, FaClock, FaArrowsAltH, FaHourglass, FaShieldAlt, FaFeather, FaBolt, FaEye, FaEyeSlash, FaDragon, FaTimes, FaLayerGroup, FaGraduationCap } from 'react-icons/fa';
import { GiSpellBook, GiCrystalBall, GiBookmarklet, GiMagicGate } from 'react-icons/gi';
import type { Spell } from '../types/dnd';
import { spellCatalog, creatureCatalog, type CatalogSpell, type CatalogCreature } from '../services/admin';
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
type GrimGroupBy = 'level' | 'school';

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

  const schoolColor = SCHOOL_COLOR[form.school] ?? 'var(--accent-gold)';
  const schoolIcon = SCHOOL_ICON[form.school] ?? '✦';

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
            ['range',       'Gittata',         <FaArrowsAltH size={9} />],
            ['duration',    'Durata',          <FaHourglass size={9} />],
            ['savingThrow', 'Tiro Salvezza',   <FaShieldAlt size={9} />],
            ['components',  'Componenti',      <FaFeather size={9} />],
          ] as [keyof Omit<Spell,'id'>, string, React.ReactNode][]).map(([field, label]) => (
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
                {(['str','dex','con','int','wis','cha'] as const).map(s => (
                  <option key={s} value={s}>{({ str:'Forza', dex:'Destrezza', con:'Costituzione', int:'Intelligenza', wis:'Saggezza', cha:'Carisma' }[s])}</option>
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

// ── Bookmark tab ─────────────────────────────────────────────────────────────
const BookmarkTab: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
  color?: string;
}> = ({ active, onClick, label, count, icon, color }) => (
  <button onClick={onClick} className={`sb-bookmark${active ? ' active' : ''}`}
    style={active && color ? { borderColor: `${color}55`, color, background: `linear-gradient(180deg, ${color}22, ${color}08)`, borderBottomColor: 'var(--bg-base,#0d0d0f)' } : {}}>
    {icon}
    {label}
    <span className="sb-bookmark-count">{count}</span>
  </button>
);

// ── School section header ─────────────────────────────────────────────────────
const SchoolSectionHeader: React.FC<{
  school: string;
  count: number;
  color: string;
}> = ({ school, count, color }) => {
  const { t } = useTranslation();
  const { resolveSchoolSvg, sanitizeSvg } = useIconCatalog();
  const schoolSvg = resolveSchoolSvg(school);
  const schoolName = t(`spellbook.schools.${school}`, school);
  const schoolDesc = t(`spellbook.schoolDesc.${school}`, '');

  const iconNode = schoolSvg ? (
    <span
      className="sb-school-hdr-svg inv-svg-tinted"
      style={{ color }}
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(schoolSvg) }}
    />
  ) : SCHOOL_ICON_SLUG[school] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[school]) ? (
    <DndIcon category="spell" name={SCHOOL_ICON_SLUG[school]} size={32} style={{ color }} />
  ) : (
    <span style={{ fontSize: '1.6rem' }}>{SCHOOL_ICON[school] ?? '✦'}</span>
  );

  return (
    <div className="sb-school-hdr" style={{ '--sc': color, borderColor: `${color}28` } as React.CSSProperties}>
      <div className="sb-school-hdr-icon-wrap" style={{ background: `${color}18`, border: `1px solid ${color}40`, boxShadow: `0 0 18px ${color}25` }}>
        {iconNode}
      </div>
      <div className="sb-school-hdr-info">
        <div className="sb-school-hdr-name" style={{ color }}>{schoolName}</div>
        {schoolDesc && <div className="sb-school-hdr-desc">{schoolDesc}</div>}
      </div>
      <div className="sb-school-hdr-right">
        <div className="sb-school-hdr-count" style={{ color }}>{count}</div>
        <div className="sb-school-hdr-count-label">{t('spellbook.spellCount_other', { count, defaultValue: 'incant.' })}</div>
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
  'Gittata':         <FaArrowsAltH size={10} />,
  'Durata':          <FaHourglass size={10} />,
  'Tiro Salvezza':   <FaShieldAlt size={10} />,
  'Componenti':      <FaFeather size={10} />,
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
    ['Gittata',         spell.range],
    ['Durata',          spell.duration],
    ['Tiro Salvezza',   spell.savingThrow],
    ['Componenti',      spell.components],
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
  return (
    <div className={`sb-kanban-card${prep.cast ? ' cast' : ''}`}
      style={{ borderTopColor: prep.cast ? 'rgba(255,255,255,0.08)' : spColor }}>
      <div className="sb-kanban-card-main">
        <span className="sb-kanban-card-school">{SCHOOL_ICON[spell.school] ?? '✦'}</span>
        <span className="sb-kanban-card-name">{spell.name}</span>
        {isUpcast && <span className="sb-kanban-upcast-badge" style={{ color: spColor }}>↑{slotLevel}</span>}
      </div>
      <div className="sb-kanban-card-actions">
        <button
          className={`sb-cast-btn${!prep.cast ? ' active' : ''}`}
          onClick={prep.cast ? onRestore : onCast}
          title={prep.cast ? 'Ripristina slot' : 'Lancia (consuma slot)'}
          style={!prep.cast ? { background: `radial-gradient(circle at 35% 35%, ${spColor}cc, ${spColor}55)`, border: `2px solid ${spColor}`, boxShadow: `0 2px 8px ${spColor}55` } : {}}>
          {prep.cast ? <FaMinus size={8} /> : <FaBolt size={8} />}
        </button>
        <button className="sb-remove-btn" onClick={onRemove} title="Rimuovi preparazione"><FaTrash size={8} /></button>
      </div>
    </div>
  );
};

// ── Spell card ─────────────────────────────────────────────────────────────────
const SpellCard: React.FC<SpellRowProps> = ({ spell, editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps, isMobile, creatureNameMap, selectedSpellId, onSelect }) => {
  const { t } = useTranslation();
  const prepCount = prepCountFor(spell.id);
  const isEdit = editingId === spell.id;
  const isSelected = selectedSpellId === spell.id;
  const color = SCHOOL_COLOR[spell.school] ?? 'var(--text-muted)'; const { resolveSchoolSvg, sanitizeSvg } = useIconCatalog();
  const schoolSvg = resolveSchoolSvg(spell.school); const [descExpanded, setDescExpanded] = useState(false);
  const MAX_DESC = 120;
  const needsTruncation = (spell.description?.length ?? 0) > MAX_DESC;
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

  return (
    <div
      className={`sb-card${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(spell.id)}
      style={{
        '--c': color,
        cursor: 'pointer',
        borderColor: isSelected ? `${color}70` : `rgba(180,140,60,0.22)`,
        background: `linear-gradient(160deg, ${color}16 0%, transparent 48%), linear-gradient(180deg, #1e1a12 0%, #141009 100%)`,
        boxShadow: isSelected
          ? `0 0 0 2px ${color}50, 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.10)`
          : `0 2px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.05)`,
      } as React.CSSProperties}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `0 6px 22px rgba(0,0,0,0.5), 0 0 14px ${color}28, inset 0 1px 0 rgba(201,168,76,0.10)`;
        el.style.borderColor = isSelected ? `${color}80` : `${color}55`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = isSelected
          ? `0 0 0 2px ${color}50, 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.10)`
          : `0 2px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(201,168,76,0.05)`;
        el.style.borderColor = isSelected ? `${color}70` : `rgba(180,140,60,0.22)`;
      }}
    >

      {/* Top accent bar */}
      <div className="sb-card-accent" style={{ background: `linear-gradient(90deg, ${color}, ${color}44, transparent)` }} />

      {/* Edit / delete buttons */}
      <div className="sb-card-btns">
        <button className="sb-icon-btn edit" onClick={e => { e.stopPropagation(); startEdit(spell); }} title="Modifica"><FaEdit size={10} /></button>
        <button className="sb-icon-btn del" onClick={e => { e.stopPropagation(); deleteSpell(spell.id); }} title="Elimina"><FaTrash size={10} /></button>
      </div>

      {/* Header */}
      <div className="sb-card-header" style={{ background: `linear-gradient(180deg, ${color}12, transparent)`, borderBottomColor: `rgba(180,140,60,0.12)` }}>
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
            )} {t(`spellbook.schools.${spell.school}`, spell.school)}
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
            <button className="sb-desc-toggle" style={{ color }} onClick={e => { e.stopPropagation(); setDescExpanded(v => !v); }}>
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
      {/* Linked creatures */}
      {linkedNames.length > 0 && (
        <div style={{ padding: '4px 10px 0', display: 'flex', flexWrap: 'wrap', gap: 4, borderTop: `1px solid rgba(231,76,60,0.15)`, marginTop: 4, paddingTop: 6 }}>
          {linkedNames.map(name => (
            <span key={name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.65rem', padding: '2px 6px', borderRadius: 12,
              background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.35)',
              color: 'var(--accent-crimson)',
            }}>
              <FaDragon size={7} /> {name}
            </span>
          ))}
        </div>
      )}
      <div className="sb-card-footer" style={{ background: `linear-gradient(180deg, transparent, rgba(0,0,0,0.2))`, borderTopColor: `rgba(180,140,60,0.10)` }}>
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
  const { t } = useTranslation();
  const {
    character, addSpell, updateSpell, deleteSpell, setSpellSlotTotal,
    prepareWizardSpell, unprepareWizardSpell, castPreparedSpell, restorePreparedSpell, restWizardSpells,
  } = useCharacterStore();
  const [spellTab, setSpellTab] = useState<SpellTab>('grimoire');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [pickerLvl, setPickerLvl] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Spell, 'id'>>(EMPTY_SPELL());
  const [grimGroupBy, setGrimGroupBy] = useState<GrimGroupBy>('level');
  const [grimSelected, setGrimSelected] = useState<number | 'all'>('all');
  const [grimSchoolSelected, setGrimSchoolSelected] = useState<string | 'all'>('all');
  const [grimSearch, setGrimSearch] = useState('');
  const [grimLvlPickerOpen, setGrimLvlPickerOpen] = useState(false);
  const [dailyLvlPickerOpen, setDailyLvlPickerOpen] = useState(false);
  const grimLvlBtnRef = useRef<HTMLButtonElement>(null);
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

  const cardProps = { editingId, prepCountFor, slots, prepareWizardSpell, unprepareSpellOne, startEdit, deleteSpell, formProps, isMobile, creatureNameMap, selectedSpellId, onSelect: (id: string) => { setSelectedSpellId(id); setEditingId(null); setIsAdding(false); setForm(EMPTY_SPELL()); } };

  // Spell lookup
  const spellById = new Map<string, Spell>();
  spells.forEach(s => spellById.set(s.id, s));

  // Grimorie filtered list
  const grimSearchLower = grimSearch.trim().toLowerCase();
  const filteredGrimSpells = spells.filter(s => {
    if (grimGroupBy === 'level' && grimSelected !== 'all' && s.level !== grimSelected) return false;
    if (grimGroupBy === 'school' && grimSchoolSelected !== 'all' && s.school !== grimSchoolSelected) return false;
    if (grimSearchLower && !s.name.toLowerCase().includes(grimSearchLower) && !s.school.toLowerCase().includes(grimSearchLower) && !t(`spellbook.schools.${s.school}`, s.school).toLowerCase().includes(grimSearchLower)) return false;
    return true;
  });
  // Group filtered by level for "all level" view
  const filteredByLevel = new Map<number, Spell[]>();
  filteredGrimSpells.forEach(s => {
    if (!filteredByLevel.has(s.level)) filteredByLevel.set(s.level, []);
    filteredByLevel.get(s.level)!.push(s);
  });
  const filteredLevelKeys = [...filteredByLevel.keys()].sort((a, b) => a - b);

  // Group filtered by school for "school" view
  const filteredBySchool = new Map<string, Spell[]>();
  filteredGrimSpells.forEach(s => {
    if (!filteredBySchool.has(s.school)) filteredBySchool.set(s.school, []);
    filteredBySchool.get(s.school)!.push(s);
  });
  // Keep canonical school order
  const filteredSchoolKeys = SCHOOLS.filter(sc => filteredBySchool.has(sc));

  // Schools present in the grimoire (for school bookmark tabs)
  const schoolsInGrimoire = SCHOOLS.filter(sc => spells.some(s => s.school === sc));

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
            {/* Barra strumenti: cerca + toggle visualizzazione + aggiungi */}
            <div className="sb-toolbar">
              <div className="sb-search-wrap">
                <FaSearch size={11} className="sb-search-icon" />
                <input className="sb-search-input" value={grimSearch} onChange={e => setGrimSearch(e.target.value)}
                  placeholder={`Cerca nel grimorio…`} />
              </div>
              {/* Toggle visualizzazione */}
              <div className="sb-view-toggle">
                <button
                  className={`sb-view-btn${grimGroupBy === 'level' ? ' active' : ''}`}
                  onClick={() => { setGrimGroupBy('level'); setGrimSearch(''); }}
                  title={t('spellbook.groupByLevel')}>
                  <FaLayerGroup size={10} /> {t('spellbook.groupByLevel')}
                </button>
                <button
                  className={`sb-view-btn${grimGroupBy === 'school' ? ' active' : ''}`}
                  onClick={() => { setGrimGroupBy('school'); setGrimSearch(''); }}
                  title={t('spellbook.groupBySchool')}>
                  <GiMagicGate size={12} /> {t('spellbook.groupBySchool')}
                </button>
              </div>
              <button className="btn-primary" style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  setIsAdding(true); setEditingId(null); setSelectedSpellId(null);
                  setForm({ ...EMPTY_SPELL(), level: grimSelected === 'all' ? 1 : grimSelected });
                }}
                disabled={isAdding}>
                <FaPlus size={10} /> {t('spellbook.addSpell')}
              </button>
              <button className="btn-secondary" style={{ fontSize: '0.8rem' }}
                onClick={openCatalogPicker} disabled={isAdding}>
                <GiBookmarklet size={11} /> {t('spellbook.fromCatalog')}
              </button>
            </div>

            {/* ── Bookmark strip: LEVEL mode ── */}
            {grimGroupBy === 'level' && (
              <div className="sb-bookmarks">
                <BookmarkTab active={grimSelected === 'all'} onClick={() => setGrimSelected('all')} label={t('spellbook.all')} count={spells.length} icon={<GiBookmarklet size={11} />} />
                {levels.map(lv => (
                  <BookmarkTab key={lv} active={grimSelected === lv} onClick={() => setGrimSelected(lv)}
                    label={lv === 0 ? t('spellbook.cantripShort') : `${t('spellbook.levelShort')} ${lv}`}
                    count={spells.filter(s => s.level === lv).length} />
                ))}
                {typeof grimSelected === 'number' && !levels.includes(grimSelected) && (
                  <BookmarkTab active={true} onClick={() => setGrimSelected(grimSelected)}
                    label={grimSelected === 0 ? t('spellbook.cantripShort') : `${t('spellbook.levelShort')} ${grimSelected}`} count={0} />
                )}
                <button ref={grimLvlBtnRef} className="sb-bookmark-add" onClick={() => setGrimLvlPickerOpen(o => !o)} title="Aggiungi livello">
                  <FaPlus size={9} /> {t('spellbook.level')}
                </button>
                {grimLvlPickerOpen && (
                  <LevelPickerPopover anchorRef={grimLvlBtnRef} taken={levels}
                    onPick={(lvl) => { setGrimSelected(lvl); setIsAdding(true); setEditingId(null); setForm({ ...EMPTY_SPELL(), level: lvl }); }}
                    onClose={() => setGrimLvlPickerOpen(false)} align="left" title="Aggiungi un livello al grimorio" />
                )}
              </div>
            )}

            {/* ── Bookmark strip: SCHOOL mode ── */}
            {grimGroupBy === 'school' && (
              <div className="sb-bookmarks">
                <BookmarkTab active={grimSchoolSelected === 'all'} onClick={() => setGrimSchoolSelected('all')}
                  label={t('spellbook.all')} count={spells.length} icon={<GiBookmarklet size={11} />} />
                {schoolsInGrimoire.map(sc => {
                  const c = SCHOOL_COLOR[sc] ?? 'var(--accent-arcane)';
                  return (
                    <BookmarkTab key={sc} active={grimSchoolSelected === sc}
                      onClick={() => setGrimSchoolSelected(sc)}
                      label={t(`spellbook.schools.${sc}`, sc)}
                      count={spells.filter(s => s.school === sc).length}
                      color={c}
                      icon={
                        SCHOOL_ICON_SLUG[sc] && getDndIconSvg('spell', SCHOOL_ICON_SLUG[sc])
                          ? <DndIcon category="spell" name={SCHOOL_ICON_SLUG[sc]} size={12} style={{ color: c, flexShrink: 0 }} />
                          : <span style={{ fontSize: '0.8rem' }}>{SCHOOL_ICON[sc] ?? ''}</span>
                      }
                    />
                  );
                })}
              </div>
            )}

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
                    : <>Nessun incantesimo{grimGroupBy === 'school' && grimSchoolSelected !== 'all' ? ` di ${t(`spellbook.schools.${grimSchoolSelected}`, grimSchoolSelected)}` : grimSelected !== 'all' ? (grimSelected === 0 ? ' di trucchetto' : ` di livello ${grimSelected}`) : ''}.</>}
                </p>
              </div>
            ) : (
              <div className="sb-scroll-area" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 8 }}>

                {/* ── LEVEL grouping view ── */}
                {grimGroupBy === 'level' && (
                  grimSelected === 'all' ? (
                    filteredLevelKeys.map(lv => (
                      <div key={lv} style={{ marginBottom: 20 }}>
                        <div className="sb-level-hdr" style={{ '--lc': LEVEL_COLOR[lv] ?? 'var(--accent-arcane)' } as React.CSSProperties}>
                          <div className="sb-level-badge" style={{ background: `linear-gradient(135deg, ${LEVEL_COLOR[lv] ?? 'var(--accent-arcane)'}, ${LEVEL_COLOR[lv] ?? 'var(--accent-arcane)'}88)`, boxShadow: `0 2px 10px ${LEVEL_COLOR[lv] ?? 'var(--accent-arcane)'}44` }}>
                            {lv === 0 ? 'TR' : lv}
                          </div>
                          <span className="sb-level-label" style={{ color: LEVEL_COLOR[lv] ?? 'var(--accent-arcane)' }}>
                            {lv === 0 ? t('spellbook.cantrips') : `${t('spellbook.level')} ${lv}`}
                          </span>
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
                  )
                )}

                {/* ── SCHOOL grouping view ── */}
                {grimGroupBy === 'school' && (
                  grimSchoolSelected === 'all' ? (
                    filteredSchoolKeys.map(sc => {
                      const spellsForSchool = filteredBySchool.get(sc) ?? [];
                      const c = SCHOOL_COLOR[sc] ?? 'var(--accent-arcane)';
                      return (
                        <div key={sc}>
                          <SchoolSectionHeader school={sc} count={spellsForSchool.length} color={c} />
                          <div className="sb-cards-grid">
                            {spellsForSchool.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                          </div>
                          <div className="sb-ornament-divider" aria-hidden="true"><span>✦</span></div>
                        </div>
                      );
                    })
                  ) : (
                    <>
                      <SchoolSectionHeader
                        school={grimSchoolSelected}
                        count={filteredGrimSpells.length}
                        color={SCHOOL_COLOR[grimSchoolSelected] ?? 'var(--accent-arcane)'}
                      />
                      <div className="sb-cards-grid">
                        {filteredGrimSpells.map(s => <SpellCard key={s.id} spell={s} {...cardProps} />)}
                      </div>
                    </>
                  )
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
                        <button className="sb-sidebar-action-btn danger" onClick={() => { deleteSpell(sel.id); closeSidebar(); }} title="Elimina">
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
                  <div key={lv} className="sb-kanban-col" style={{ '--kc': accent, borderTopColor: accent } as React.CSSProperties}>
                    <div className="sb-kanban-col-hdr">
                      <div className="sb-kanban-col-title">
                        <div className={`sb-slot-level-badge${lv === 0 ? ' trucchetto' : ''}`}
                          style={lv !== 0 ? { background: `linear-gradient(135deg, ${accent}, ${accent}88)`, boxShadow: `0 2px 10px ${accent}55`, color: '#0a0806' } : {}}>
                          {lv === 0 ? 'TR' : lv}
                        </div>
                        <span className="sb-kanban-level-name" style={{ color: accent }}>{lvName}</span>
                      </div>
                      <div className="sb-kanban-slot-info">
                        {s.total > 0 && <SlotPips total={s.total} used={s.used} color={accent} />}
                        <div className="sb-kanban-counter">
                          <span style={{ color: available > 0 ? accent : 'var(--text-muted)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{available}</span>
                          <span style={{ color: '#5a4e35', fontSize: '0.7rem' }}>/{s.total}</span>
                        </div>
                      </div>
                      <div className="sb-slot-adjust">
                        <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, s.total + 1)} disabled={s.total >= 9}>+</button>
                        <button className="sb-adj-btn" onClick={() => setSpellSlotTotal(lv, Math.max(0, s.total - 1))}>-</button>
                      </div>
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
                            return (
                              <button key={sp.id} className="sb-kanban-pick-spell"
                                style={{ borderLeftColor: spColor }}
                                onClick={() => prepareWizardSpell(lv, sp.id)}>
                                <span style={{ color: spColor, fontSize: '0.8rem' }}>{SCHOOL_ICON[sp.school] ?? '✦'}</span>
                                <span>{sp.name}</span>
                                {sp.level < lv && <span style={{ color: 'var(--accent-arcane)', fontSize: '0.62rem', marginLeft: 'auto' }}>↑Lv{sp.level}</span>}
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
