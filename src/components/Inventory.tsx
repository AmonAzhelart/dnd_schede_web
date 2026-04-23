import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import {
  FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaCoins,
  FaChevronDown, FaChevronRight, FaArrowUp, FaArrowDown,
} from 'react-icons/fa';
import { Virtuoso } from 'react-virtuoso';
import type { Item, WeaponDetails, ArmorDetails, CurrencyTransaction } from '../types/dnd';

// ─── Types ────────────────────────────────────────────
type MainTab = 'items' | 'currency';
type ItemTabKey = 'all' | Item['type'];

// ─── Constants ────────────────────────────────────────
const ITEM_TABS: { key: ItemTabKey; label: string; color: string }[] = [
  { key: 'all', label: 'Tutti', color: 'var(--text-secondary)' },
  { key: 'weapon', label: 'Armi', color: 'var(--accent-crimson)' },
  { key: 'armor', label: 'Armature', color: 'var(--accent-gold)' },
  { key: 'shield', label: 'Scudi', color: 'var(--accent-gold)' },
  { key: 'protectiveItem', label: 'Oggetti Prot.', color: 'var(--accent-gold)' },
  { key: 'gear', label: 'Equipaggiamento', color: 'var(--text-muted)' },
  { key: 'consumable', label: 'Consumabili', color: 'var(--accent-success)' },
  { key: 'component', label: 'Componenti', color: 'var(--accent-arcane)' },
];
const TYPE_COLOR: Record<Item['type'], string> = {
  weapon: 'var(--accent-crimson)', armor: 'var(--accent-gold)', shield: 'var(--accent-gold)',
  protectiveItem: 'var(--accent-gold)', gear: 'var(--text-muted)', consumable: 'var(--accent-success)',
  component: 'var(--accent-arcane)',
};
const TYPE_LABEL: Record<Item['type'], string> = {
  weapon: 'Arma', armor: 'Armatura', shield: 'Scudo', protectiveItem: 'Prot.',
  gear: 'Equipaggiamento', consumable: 'Consumabile', component: 'Componente',
};
const TYPE_ICON: Record<Item['type'], string> = {
  weapon: '⚔', armor: '🛡', shield: '🛡', protectiveItem: '🔮',
  gear: '🎒', consumable: '🧪', component: '✨',
};
const MOD_TYPES = [
  { value: 'enhancement', label: 'Potenziamento' }, { value: 'armor', label: 'Armatura' },
  { value: 'deflection', label: 'Deviazione' }, { value: 'dodge', label: 'Schivata' },
  { value: 'naturalArmor', label: 'Arm. Naturale' }, { value: 'shield', label: 'Scudo' },
  { value: 'circumstance', label: 'Circostanza' }, { value: 'untyped', label: 'Senza tipo' },
  { value: 'resistance', label: 'Resistenza' }, { value: 'sacred', label: 'Sacro' },
  { value: 'profane', label: 'Profano' }, { value: 'insight', label: 'Intuizione' },
];
const DAMAGE_TYPES = [
  { value: 'p', label: 'Perforante (p)' }, { value: 't', label: 'Tagliente (t)' },
  { value: 'c', label: 'Contundente (c)' }, { value: 'pt', label: 'Perf./Tagl.' },
  { value: 'tc', label: 'Tagl./Cont.' }, { value: 'magia', label: 'Magico' },
];
const ARMOR_TYPES = [
  { value: '', label: '—' }, { value: 'leggera', label: 'Leggera' },
  { value: 'media', label: 'Media' }, { value: 'pesante', label: 'Pesante' },
  { value: 'scudo', label: 'Scudo' }, { value: 'oggetto', label: 'Oggetto' },
];
const COIN_LABELS = [
  { key: 'platinum' as const, label: 'Platino', abbr: 'pp', color: '#b0c4de' },
  { key: 'gold' as const, label: 'Oro', abbr: 'mo', color: 'var(--accent-gold)' },
  { key: 'silver' as const, label: 'Argento', abbr: 'ma', color: '#c0c0c0' },
  { key: 'copper' as const, label: 'Rame', abbr: 'mr', color: '#b87333' },
];

// ─── Helpers ──────────────────────────────────────────
const EMPTY_ITEM = (): Omit<Item, 'id'> => ({
  name: '', description: '', type: 'gear', weight: 0, modifiers: [],
  equipped: false, quantity: 1, location: '',
  weaponDetails: undefined, armorDetails: undefined, associatedSpell: '',
});
const EMPTY_WD = (): WeaponDetails => ({
  damage: '1d6', damageType: 'c', criticalMultiplier: 'x2',
  criticalRange: '', rangeIncrement: '', attackBonus: 0, notes: '',
});
const EMPTY_AD = (): ArmorDetails => ({
  armorBonus: 0, maxDex: undefined, checkPenalty: 0,
  spellFailure: 0, speed: undefined, armorType: '', specialProperties: '',
});
const EMPTY_TX = (): { description: string; dir: 'in' | 'out'; platinum: number; gold: number; silver: number; copper: number } => ({
  description: '', dir: 'in', platinum: 0, gold: 0, silver: 0, copper: 0,
});

const needsWeapon = (t: Item['type']) => t === 'weapon';
const needsArmor = (t: Item['type']) => t === 'armor' || t === 'shield' || t === 'protectiveItem';

// ─── Sub-components ───────────────────────────────────
const SectionLabel: React.FC<{ label: string; color?: string }> = ({ label, color = 'var(--text-muted)' }) => (
  <div style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ fontSize: '0.67rem', color, fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }}>{label}</span>
  </div>
);

// ─── Module-level helpers (outside Inventory to prevent focus-loss on re-render) ───
const addMod = (setter: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>) =>
  setter(f => ({ ...f, modifiers: [...f.modifiers, { target: 'str', value: 1, type: 'enhancement', source: '' }] }));
const removeMod = (setter: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>, i: number) =>
  setter(f => ({ ...f, modifiers: f.modifiers.filter((_, idx) => idx !== i) }));
const updateMod = (setter: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>, i: number, field: string, val: unknown) =>
  setter(f => ({ ...f, modifiers: f.modifiers.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }));

interface WeaponFieldsProps {
  wd: WeaponDetails;
  onChange: (field: keyof WeaponDetails, val: unknown) => void;
}
const WeaponFields: React.FC<WeaponFieldsProps> = ({ wd, onChange }) => (
  <div style={{ marginTop: 8, padding: '10px', background: 'rgba(192,57,43,0.07)', borderRadius: 6, border: '1px solid rgba(192,57,43,0.2)' }}>
    <div style={{ fontSize: '0.67rem', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>⚔ DETTAGLI ARMA</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Danno
        <input className="input" value={wd.damage} onChange={e => onChange('damage', e.target.value)}
          placeholder="es. 1d6" style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Tipo Danno
        <select className="input" value={wd.damageType} onChange={e => onChange('damageType', e.target.value)} style={{ fontSize: '0.82rem' }}>
          {DAMAGE_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Critico
        <input className="input" value={wd.criticalMultiplier} onChange={e => onChange('criticalMultiplier', e.target.value)}
          placeholder="es. x2" style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Range Crit.
        <input className="input" value={wd.criticalRange ?? ''} onChange={e => onChange('criticalRange', e.target.value)}
          placeholder="es. 19-20" style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Gittata
        <input className="input" value={wd.rangeIncrement ?? ''} onChange={e => onChange('rangeIncrement', e.target.value)}
          placeholder="es. 18m" style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Bonus Attacco
        <input className="input" type="number" value={wd.attackBonus ?? 0} onChange={e => onChange('attackBonus', parseInt(e.target.value) || 0)}
          style={{ fontSize: '0.82rem' }} />
      </label>
    </div>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 8 }}>
      Note Arma
      <input className="input" value={wd.notes ?? ''} onChange={e => onChange('notes', e.target.value)}
        placeholder="Note aggiuntive..." style={{ fontSize: '0.82rem' }} />
    </label>
  </div>
);

interface ArmorFieldsProps {
  ad: ArmorDetails;
  onChange: (field: keyof ArmorDetails, val: unknown) => void;
}
const ArmorFields: React.FC<ArmorFieldsProps> = ({ ad, onChange }) => (
  <div style={{ marginTop: 8, padding: '10px', background: 'rgba(201,168,76,0.07)', borderRadius: 6, border: '1px solid rgba(201,168,76,0.2)' }}>
    <div style={{ fontSize: '0.67rem', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>🛡 DETTAGLI PROTEZIONE</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Tipo
        <select className="input" value={ad.armorType ?? ''} onChange={e => onChange('armorType', e.target.value)} style={{ fontSize: '0.82rem' }}>
          {ARMOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Bonus CA
        <input className="input" type="number" value={ad.armorBonus} onChange={e => onChange('armorBonus', parseInt(e.target.value) || 0)}
          style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Des. Max
        <input className="input" type="number" value={ad.maxDex ?? ''} onChange={e => onChange('maxDex', e.target.value === '' ? undefined : parseInt(e.target.value))}
          placeholder="—" style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Pen. Prova
        <input className="input" type="number" value={ad.checkPenalty ?? 0} onChange={e => onChange('checkPenalty', parseInt(e.target.value) || 0)}
          style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Fall. Inc. %
        <input className="input" type="number" min={0} max={100} value={ad.spellFailure ?? 0} onChange={e => onChange('spellFailure', parseInt(e.target.value) || 0)}
          style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Velocità (m)
        <input className="input" type="number" value={ad.speed ?? ''} onChange={e => onChange('speed', e.target.value === '' ? undefined : parseInt(e.target.value))}
          placeholder="—" style={{ fontSize: '0.82rem' }} />
      </label>
    </div>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 8 }}>
      Proprietà Speciali
      <input className="input" value={ad.specialProperties ?? ''} onChange={e => onChange('specialProperties', e.target.value)}
        placeholder="es. Resistenza fuoco 5..." style={{ fontSize: '0.82rem' }} />
    </label>
  </div>
);

interface EditItemFormProps {
  itemForm: Omit<Item, 'id'>;
  setItemForm: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>;
  editingItemId: string | null;
  onSave: () => void;
  onCancel: () => void;
  autoFocus?: boolean;
}
const EditItemForm: React.FC<EditItemFormProps> = ({ itemForm, setItemForm, editingItemId, onSave, onCancel, autoFocus }) => (
  <div style={{ padding: '12px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 6, margin: '4px 0' }}>
    {/* Row 1: name, type, weight, quantity */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
      <input className="input" autoFocus={autoFocus} placeholder="Nome *" value={itemForm.name}
        onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        style={{ flex: '1 1 160px', fontSize: '0.85rem' }} />
      <select className="input" value={itemForm.type}
        onChange={e => {
          const t = e.target.value as Item['type'];
          setItemForm(f => ({
            ...f, type: t,
            weaponDetails: needsWeapon(t) ? (f.weaponDetails ?? EMPTY_WD()) : undefined,
            armorDetails: needsArmor(t) ? (f.armorDetails ?? EMPTY_AD()) : undefined,
          }));
        }}
        style={{ flex: '0 0 140px', fontSize: '0.85rem' }}>
        <option value="weapon">Arma</option>
        <option value="armor">Armatura</option>
        <option value="shield">Scudo</option>
        <option value="protectiveItem">Oggetto Prot.</option>
        <option value="gear">Equipaggiamento</option>
        <option value="consumable">Consumabile</option>
        <option value="component">Componente</option>
      </select>
      <input className="input" type="number" min={0} step="0.1" placeholder="Peso (kg)"
        value={itemForm.weight || ''}
        onChange={e => setItemForm(f => ({ ...f, weight: parseFloat(e.target.value) || 0 }))}
        style={{ flex: '0 0 85px', fontSize: '0.85rem' }} />
      <input className="input" type="number" min={1} placeholder="Qty"
        value={itemForm.quantity ?? 1}
        onChange={e => setItemForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
        style={{ flex: '0 0 60px', fontSize: '0.85rem' }} />
    </div>
    {/* Weapon-specific fields */}
    {needsWeapon(itemForm.type) && (
      <WeaponFields
        wd={itemForm.weaponDetails ?? EMPTY_WD()}
        onChange={(field, val) => setItemForm(f => ({ ...f, weaponDetails: { ...(f.weaponDetails ?? EMPTY_WD()), [field]: val } as WeaponDetails }))}
      />
    )}
    {/* Armor-specific fields */}
    {needsArmor(itemForm.type) && (
      <ArmorFields
        ad={itemForm.armorDetails ?? EMPTY_AD()}
        onChange={(field, val) => setItemForm(f => ({ ...f, armorDetails: { ...(f.armorDetails ?? EMPTY_AD()), [field]: val } as ArmorDetails }))}
      />
    )}
    {/* Component: associated spell */}
    {itemForm.type === 'component' && (
      <input className="input" placeholder="Incantesimo associato" value={itemForm.associatedSpell ?? ''}
        onChange={e => setItemForm(f => ({ ...f, associatedSpell: e.target.value }))}
        style={{ marginTop: 8, width: '100%', fontSize: '0.85rem' }} />
    )}
    {/* Description */}
    <textarea className="input" placeholder="Descrizione (opzionale)..." value={itemForm.description}
      onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
      style={{ width: '100%', minHeight: 44, fontSize: '0.82rem', resize: 'vertical', marginTop: 8, marginBottom: 8 }} />
    {/* Modifiers */}
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MODIFICATORI</span>
        <button onClick={() => addMod(setItemForm)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 0' }}>
          <FaPlus size={8} /> Aggiungi
        </button>
      </div>
      {itemForm.modifiers.map((mod, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}>
          <input className="input" value={mod.target} onChange={e => updateMod(setItemForm, i, 'target', e.target.value)}
            placeholder="Stat (es. str, ac)" style={{ flex: 1, fontSize: '0.78rem' }} />
          <input className="input" type="number" value={mod.value} onChange={e => updateMod(setItemForm, i, 'value', +e.target.value)}
            style={{ width: 52, fontSize: '0.78rem', textAlign: 'center' }} />
          <select className="input" value={mod.type} onChange={e => updateMod(setItemForm, i, 'type', e.target.value)}
            style={{ flex: 1, fontSize: '0.78rem' }}>
            {MOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={() => removeMod(setItemForm, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: 3 }}>
            <FaTimes size={10} />
          </button>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Annulla</button>
      <button onClick={onSave} className="btn-primary" style={{ fontSize: '0.8rem', opacity: itemForm.name.trim() ? 1 : 0.5 }}>
        <FaCheck size={10} /> {editingItemId ? 'Aggiorna' : 'Salva'}
      </button>
    </div>
  </div>
);

interface ItemRowProps {
  item: Item;
  expandedId: string | null;
  editingItemId: string | null;
  itemForm: Omit<Item, 'id'>;
  setItemForm: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>;
  onToggleExpand: (id: string) => void;
  onEquip: (id: string) => void;
  onStartEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}
const ItemRow: React.FC<ItemRowProps> = ({ item, expandedId, editingItemId, itemForm, setItemForm, onToggleExpand, onEquip, onStartEdit, onDelete, onSave, onCancel }) => {
  const isExp = expandedId === item.id;
  const isEdit = editingItemId === item.id;
  const color = TYPE_COLOR[item.type];
  if (isEdit) return <EditItemForm itemForm={itemForm} setItemForm={setItemForm} editingItemId={editingItemId} onSave={onSave} onCancel={onCancel} />;
  const wd = item.weaponDetails;
  const ad = item.armorDetails;
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.035)' }}>
      <div onClick={() => onToggleExpand(item.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer',
          background: isExp ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.12s'
        }}
        onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'; }}
        onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <div style={{ width: 3, height: 26, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: 12, flexShrink: 0 }}>{isExp ? '▼' : '▶'}</span>
        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{TYPE_ICON[item.type]}</span>
        <span style={{ flex: 1, fontFamily: 'var(--font-heading)', fontSize: '0.88rem', color: item.equipped ? color : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}{(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ''}
        </span>
        {wd && (
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', flexShrink: 0 }}>
            {wd.damage} {wd.criticalMultiplier ? `/${wd.criticalMultiplier}` : ''}
          </span>
        )}
        {ad && (
          <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', flexShrink: 0 }}>
            CA+{ad.armorBonus}
          </span>
        )}
        <span style={{ fontSize: '0.68rem', color, background: `${color}1a`, border: `1px solid ${color}44`, borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>
          {TYPE_LABEL[item.type]}
        </span>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', width: 50, textAlign: 'right', flexShrink: 0 }}>
          {item.weight > 0 ? `${item.weight}kg` : '—'}
        </span>
        <button onClick={e => { e.stopPropagation(); onEquip(item.id); }}
          style={{
            padding: '3px 9px', borderRadius: 4, fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0,
            background: item.equipped ? 'rgba(192,57,43,0.1)' : 'rgba(39,174,96,0.1)',
            border: `1px solid ${item.equipped ? 'rgba(192,57,43,0.35)' : 'rgba(39,174,96,0.35)'}`,
            color: item.equipped ? 'var(--accent-crimson)' : 'var(--accent-success)'
          }}>
          {item.equipped ? 'Rimuovi' : 'Equip'}
        </button>
        <button onClick={e => { e.stopPropagation(); onStartEdit(item); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 5px', flexShrink: 0 }}>
          <FaEdit size={11} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(item.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '4px 5px', opacity: 0.55, flexShrink: 0 }}>
          <FaTrash size={11} />
        </button>
      </div>
      {isExp && (
        <div style={{ padding: '8px 28px 12px', background: 'rgba(0,0,0,0.18)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          {item.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 8 }}>{item.description}</p>}
          {wd && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
              {[
                { label: 'Danno', value: wd.damage },
                { label: 'Tipo', value: wd.damageType },
                { label: 'Critico', value: `${wd.criticalRange ? wd.criticalRange + '/' : ''}${wd.criticalMultiplier}` },
                { label: 'Gittata', value: wd.rangeIncrement || '—' },
                ...(wd.attackBonus ? [{ label: 'Bonus', value: `${wd.attackBonus >= 0 ? '+' : ''}${wd.attackBonus}` }] : []),
                ...(wd.notes ? [{ label: 'Note', value: wd.notes }] : []),
              ].map(r => (
                <div key={r.label} style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{r.label}:</span>
                  <span style={{ color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)' }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}
          {ad && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
              {[
                { label: 'Bonus CA', value: `+${ad.armorBonus}` },
                { label: 'Des Max', value: ad.maxDex != null ? `+${ad.maxDex}` : '—' },
                { label: 'Pen. Prova', value: String(ad.checkPenalty ?? 0) },
                { label: 'Fall. Inc.', value: `${ad.spellFailure ?? 0}%` },
                ...(ad.speed != null ? [{ label: 'Velocità', value: `${ad.speed}m` }] : []),
                ...(ad.specialProperties ? [{ label: 'Proprietà', value: ad.specialProperties }] : []),
              ].map(r => (
                <div key={r.label} style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{r.label}:</span>
                  <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)' }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}
          {item.associatedSpell && (
            <div style={{ fontSize: '0.78rem', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Incantesimo: </span>
              <span style={{ color: 'var(--accent-arcane)' }}>{item.associatedSpell}</span>
            </div>
          )}
          {item.modifiers.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {item.modifiers.map((m, i) => (
                <span key={i} style={{ fontSize: '0.71rem', padding: '2px 8px', borderRadius: 3, background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.28)', color: 'var(--accent-success)' }}>
                  {m.value >= 0 ? '+' : ''}{m.value} {m.target.toUpperCase()} <span style={{ opacity: 0.65 }}>({m.type})</span>
                </span>
              ))}
            </div>
          )}
          {!item.description && !wd && !ad && item.modifiers.length === 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nessuna descrizione.</span>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────
export const Inventory: React.FC = () => {
  const {
    character, setCharacter, toggleEquipItem,
    setCurrency, addCurrencyTransaction,
  } = useCharacterStore();

  // Main tab
  const [mainTab, setMainTab] = useState<MainTab>('items');
  // Item tab
  const [itemTab, setItemTab] = useState<ItemTabKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState<Omit<Item, 'id'>>(EMPTY_ITEM());
  // Currency
  const [txForm, setTxForm] = useState(EMPTY_TX());

  // Listen for external navigation requests (e.g. from CurrencyWidget)
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<MainTab>).detail;
      if (detail === 'items' || detail === 'currency') setMainTab(detail);
    };
    window.addEventListener('inventory:setTab', onNav as EventListener);
    // Also consume any pending request set before this component mounted.
    const pending = (window as unknown as { __pendingInventoryTab?: MainTab }).__pendingInventoryTab;
    if (pending === 'items' || pending === 'currency') {
      setMainTab(pending);
      delete (window as unknown as { __pendingInventoryTab?: MainTab }).__pendingInventoryTab;
    }
    return () => window.removeEventListener('inventory:setTab', onNav as EventListener);
  }, []);

  if (!character) return null;

  const allItems = character.inventory;
  const itemCounts: Record<string, number> = { all: allItems.length };
  (['weapon', 'armor', 'shield', 'protectiveItem', 'gear', 'consumable', 'component'] as Item['type'][]).forEach(t => {
    itemCounts[t] = allItems.filter(i => i.type === t).length;
  });
  const filtered = itemTab === 'all' ? allItems : allItems.filter(i => i.type === itemTab);
  const equipped = filtered.filter(i => i.equipped);
  const backpack = filtered.filter(i => !i.equipped);
  const totalWeight = allItems.reduce((s, i) => s + (i.weight ?? 0), 0);
  const currency = character.currency ?? { platinum: 0, gold: 0, silver: 0, copper: 0 };
  const txLog = character.currencyLog ?? [];

  // ── Item helpers ──
  const saveItem = () => {
    if (!itemForm.name.trim()) return;
    const newItem = { ...itemForm, id: editingItemId ?? uuidv4() };
    const newInventory = editingItemId
      ? allItems.map(i => i.id === editingItemId ? newItem : i)
      : [...allItems, newItem];
    setCharacter({ ...character, inventory: newInventory });
    setEditingItemId(null); setIsAddingItem(false); setItemForm(EMPTY_ITEM());
  };
  const startEditItem = (item: Item) => {
    setItemForm({
      name: item.name, description: item.description ?? '', type: item.type,
      weight: item.weight, modifiers: [...item.modifiers], equipped: item.equipped,
      quantity: item.quantity ?? 1, location: item.location ?? '',
      weaponDetails: item.weaponDetails ? { ...item.weaponDetails } : undefined,
      armorDetails: item.armorDetails ? { ...item.armorDetails } : undefined,
      associatedSpell: item.associatedSpell ?? '',
    });
    setEditingItemId(item.id); setIsAddingItem(false); setExpandedId(null);
  };
  const cancelEditItem = () => { setEditingItemId(null); setIsAddingItem(false); setItemForm(EMPTY_ITEM()); };
  const deleteItemFn = (id: string) => {
    setCharacter({ ...character, inventory: allItems.filter(i => i.id !== id) });
    if (editingItemId === id) cancelEditItem();
    if (expandedId === id) setExpandedId(null);
  };
  // ── Currency helper ──
  const submitTx = () => {
    if (!txForm.description.trim() && !txForm.gold && !txForm.silver && !txForm.copper && !txForm.platinum) return;
    const sign = txForm.dir === 'out' ? -1 : 1;
    addCurrencyTransaction({
      id: uuidv4(), date: new Date().toISOString(), description: txForm.description,
      platinum: sign * (txForm.platinum || 0), gold: sign * (txForm.gold || 0),
      silver: sign * (txForm.silver || 0), copper: sign * (txForm.copper || 0),
    });
    setTxForm(EMPTY_TX());
  };

  // ─────────────────────────────── RENDER ───────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>

      {/* ── MAIN TABS ── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
        {([
          { key: 'items' as MainTab, label: `Oggetti (${allItems.length})`, color: 'var(--accent-gold)' },
          { key: 'currency' as MainTab, label: 'Monete', color: 'var(--accent-gold)' },
        ]).map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            style={{
              padding: '6px 14px', borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'all 0.13s', fontSize: '0.8rem',
              background: mainTab === t.key ? 'rgba(201,168,76,0.1)' : 'transparent',
              border: mainTab === t.key ? '1px solid rgba(201,168,76,0.3)' : '1px solid transparent',
              borderBottom: mainTab === t.key ? '1px solid rgba(28,28,39,1)' : '1px solid transparent',
              color: mainTab === t.key ? t.color : 'var(--text-muted)'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: ITEMS ═══════════════ */}
      {mainTab === 'items' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-gold)' }}>
              {totalWeight.toFixed(1)} kg · {allItems.length} oggetti
            </span>
            <button className="btn-primary" style={{ fontSize: '0.82rem' }}
              onClick={() => { setIsAddingItem(true); setEditingItemId(null); setItemForm(EMPTY_ITEM()); }} disabled={isAddingItem}>
              <FaPlus size={11} /> Nuovo Oggetto
            </button>
          </div>

          {/* Item sub-tabs */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            {ITEM_TABS.filter(t => t.key === 'all' || (itemCounts[t.key] ?? 0) > 0).map(t => (
              <button key={t.key} onClick={() => setItemTab(t.key)}
                style={{
                  padding: '4px 10px', borderRadius: '4px 4px 0 0', cursor: 'pointer', transition: 'all 0.13s',
                  background: itemTab === t.key ? 'rgba(201,168,76,0.08)' : 'transparent',
                  border: itemTab === t.key ? '1px solid rgba(201,168,76,0.25)' : '1px solid transparent',
                  borderBottom: itemTab === t.key ? '1px solid rgba(28,28,39,1)' : '1px solid transparent',
                  color: itemTab === t.key ? t.color : 'var(--text-muted)', fontSize: '0.73rem',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                {t.label}
                <span style={{ fontSize: '0.6rem', opacity: 0.65, background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '0 4px', minWidth: 14, textAlign: 'center' }}>
                  {t.key === 'all' ? allItems.length : (itemCounts[t.key] ?? 0)}
                </span>
              </button>
            ))}
          </div>

          {isAddingItem && <div style={{ flexShrink: 0 }}><EditItemForm itemForm={itemForm} setItemForm={setItemForm} editingItemId={editingItemId} onSave={saveItem} onCancel={cancelEditItem} autoFocus /></div>}

          {(() => {
            type FlatRow =
              | { kind: 'section'; label: string; color?: string }
              | { kind: 'item'; item: Item }
              | { kind: 'empty'; message: string };
            const rows: FlatRow[] = [];
            if (equipped.length > 0) {
              rows.push({ kind: 'section', label: 'EQUIPAGGIATO', color: 'var(--accent-gold)' });
              equipped.forEach(i => rows.push({ kind: 'item', item: i }));
            }
            if (backpack.length > 0) {
              if (equipped.length > 0) rows.push({ kind: 'section', label: 'ZAINO' });
              backpack.forEach(i => rows.push({ kind: 'item', item: i }));
            }
            if (filtered.length === 0 && !isAddingItem) {
              rows.push({ kind: 'empty', message: itemTab === 'all' ? 'Inventario vuoto.' : 'Nessun oggetto in questa categoria.' });
            }
            const commonProps = {
              expandedId, editingItemId, itemForm, setItemForm,
              onToggleExpand: (id: string) => setExpandedId(expandedId === id ? null : id),
              onEquip: toggleEquipItem,
              onStartEdit: startEditItem,
              onDelete: deleteItemFn,
              onSave: saveItem,
              onCancel: cancelEditItem,
            };
            return (
              <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
                <Virtuoso
                  style={{ height: '100%' }}
                  data={rows}
                  itemContent={(_index, row) => {
                    if (row.kind === 'section') return <SectionLabel label={row.label} color={row.color} />;
                    if (row.kind === 'empty') return (
                      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {row.message}
                      </div>
                    );
                    return <ItemRow item={row.item} {...commonProps} />;
                  }}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════ TAB: CURRENCY ═══════════════ */}
      {mainTab === 'currency' && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
          {/* Balance */}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 10 }}>SALDO ATTUALE</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {COIN_LABELS.map(({ key, label, abbr, color }) => (
                <div key={key} style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', color }}>{currency[key] ?? 0}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.6 }}>{abbr}</div>
                </div>
              ))}
            </div>
          </div>

          {/* New transaction form */}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 10 }}>NUOVA TRANSAZIONE</div>
            {/* In / Out toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['in', 'out'] as const).map(dir => (
                <button key={dir} onClick={() => setTxForm(f => ({ ...f, dir }))}
                  style={{
                    padding: '4px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem',
                    background: txForm.dir === dir ? (dir === 'in' ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)') : 'transparent',
                    border: txForm.dir === dir ? `1px solid ${dir === 'in' ? 'rgba(39,174,96,0.5)' : 'rgba(192,57,43,0.5)'}` : '1px solid rgba(255,255,255,0.1)',
                    color: txForm.dir === dir ? (dir === 'in' ? 'var(--accent-success)' : 'var(--accent-crimson)') : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 5
                  }}>
                  {dir === 'in' ? <FaArrowDown size={10} /> : <FaArrowUp size={10} />}
                  {dir === 'in' ? 'Entrata' : 'Uscita'}
                </button>
              ))}
            </div>
            {/* Amounts */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {COIN_LABELS.map(({ key, label, color }) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color }}>
                  {label}
                  <input className="input" type="number" min={0} value={txForm[key] || ''}
                    onChange={e => setTxForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                    placeholder="0" style={{ width: 72, textAlign: 'center', fontSize: '0.88rem', fontFamily: 'var(--font-heading)', color }} />
                </label>
              ))}
            </div>
            {/* Description */}
            <input className="input" placeholder="Descrizione transazione..."
              value={txForm.description}
              onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') submitTx(); }}
              style={{ width: '100%', marginBottom: 8, fontSize: '0.85rem' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={submitTx} className="btn-primary" style={{ fontSize: '0.82rem' }}>
                <FaCheck size={10} /> Registra
              </button>
            </div>
          </div>

          {/* Transaction log */}
          {txLog.length > 0 && (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <SectionLabel label="STORICO TRANSAZIONI" color="var(--accent-gold)" />
              {txLog.map(tx => {
                const isPositive = (tx.gold + tx.platinum + tx.silver + tx.copper) >= 0;
                const parts = COIN_LABELS.map(({ key, abbr, color }) => tx[key] !== 0 ? { label: abbr, value: tx[key], color } : null).filter(Boolean) as { label: string; value: number; color: string }[];
                return (
                  <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.035)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: isPositive ? 'var(--accent-success)' : 'var(--accent-crimson)' }} />
                    {isPositive ? <FaArrowDown size={10} color="var(--accent-success)" /> : <FaArrowUp size={10} color="var(--accent-crimson)" />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>{tx.description || '—'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {parts.map(p => (
                        <span key={p.label} style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', color: p.color }}>
                          {p.value > 0 ? '+' : ''}{p.value} {p.label}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => setCharacter({ ...character, currencyLog: txLog.filter(t => t.id !== tx.id) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '3px 5px', opacity: 0.45, flexShrink: 0 }}>
                      <FaTrash size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {txLog.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1rem 0' }}>
              Nessuna transazione registrata.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
