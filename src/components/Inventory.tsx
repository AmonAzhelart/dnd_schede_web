import React, { useState, useEffect } from 'react';
import './Inventory.css';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import {
  FaPlus, FaTrash, FaEdit, FaCheck, FaTimes,
  FaArrowUp, FaArrowDown, FaSearch, FaImage,
} from 'react-icons/fa';
import type { Item, WeaponDetails, ArmorDetails, AmmoDetails } from '../types/dnd';
import { type CatalogIcon } from '../services/admin';
import { useIconCatalog, sanitizeSvg } from '../services/iconCache';
import { CatalogPicker } from './CatalogPicker';

/** Render an inline SVG with safe HTML insertion. */
const SvgIcon: React.FC<{ svg: string; size?: number; className?: string }> = ({ svg, size, className }) => (
  <span
    className={className}
    style={{
      display: 'inline-flex',
      width: size ?? '100%',
      height: size ?? '100%',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
  />
);

// ─── Types ────────────────────────────────────────────
type MainTab = 'items' | 'currency';
type ItemTabKey = 'all' | Item['type'];

// ─── Constants ────────────────────────────────────────
const ITEM_TABS: { key: ItemTabKey; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'Tutti', icon: '📦', color: 'var(--text-secondary)' },
  { key: 'weapon', label: 'Armi', icon: '⚔', color: 'var(--accent-crimson)' },
  { key: 'ammo', label: 'Munizioni', icon: '🏹', color: 'var(--accent-crimson)' },
  { key: 'armor', label: 'Armature', icon: '🛡', color: 'var(--accent-gold)' },
  { key: 'shield', label: 'Scudi', icon: '🪬', color: 'var(--accent-gold)' },
  { key: 'protectiveItem', label: 'Prot.', icon: '🔮', color: 'var(--accent-gold)' },
  { key: 'gear', label: 'Equip.', icon: '🎒', color: 'var(--text-muted)' },
  { key: 'consumable', label: 'Consumabili', icon: '🧪', color: 'var(--accent-success)' },
  { key: 'component', label: 'Componenti', icon: '✨', color: 'var(--accent-arcane)' },
  { key: 'misc', label: 'Misc.', icon: '📜', color: 'var(--text-muted)' },
];
const TYPE_COLOR: Record<Item['type'], string> = {
  weapon: 'var(--accent-crimson)', armor: 'var(--accent-gold)', shield: 'var(--accent-gold)',
  protectiveItem: 'var(--accent-gold)', gear: 'var(--text-muted)', consumable: 'var(--accent-success)',
  component: 'var(--accent-arcane)', misc: 'var(--text-muted)', ammo: 'var(--accent-crimson)',
};
const TYPE_LABEL: Record<Item['type'], string> = {
  weapon: 'Arma', armor: 'Armatura', shield: 'Scudo', protectiveItem: 'Prot.',
  gear: 'Equipaggiamento', consumable: 'Consumabile', component: 'Componente', misc: 'Miscellanea',
  ammo: 'Munizioni',
};
const TYPE_ICON: Record<Item['type'], string> = {
  weapon: '⚔', armor: '🛡', shield: '🛡', protectiveItem: '🔮',
  gear: '🎒', consumable: '🧪', component: '✨', misc: '📜', ammo: '🏹',
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
  weaponDetails: undefined, armorDetails: undefined, ammoDetails: undefined,
  associatedSpell: '', equippedAmmoId: undefined,
});
const EMPTY_WD = (): WeaponDetails => ({
  damage: '1d6', damageType: 'c', criticalMultiplier: 'x2',
  criticalRange: '', rangeIncrement: '', attackBonus: 0, notes: '',
});
const EMPTY_AD = (): ArmorDetails => ({
  armorBonus: 0, maxDex: undefined, checkPenalty: 0,
  spellFailure: 0, speed: undefined, armorType: '', specialProperties: '',
});
const EMPTY_AMD = (): AmmoDetails => ({
  attackBonus: 0, extraDamage: '', extraDamageType: '', notes: '',
});
const EMPTY_TX = (): { description: string; dir: 'in' | 'out'; platinum: number; gold: number; silver: number; copper: number } => ({
  description: '', dir: 'in', platinum: 0, gold: 0, silver: 0, copper: 0,
});

const needsWeapon = (t: Item['type']) => t === 'weapon';
const needsArmor = (t: Item['type']) => t === 'armor' || t === 'shield' || t === 'protectiveItem';
const needsAmmo = (t: Item['type']) => t === 'ammo';

// ─── Module-level form helpers (outside component to prevent focus-loss) ────
const addMod = (setter: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>) =>
  setter(f => ({ ...f, modifiers: [...f.modifiers, { target: 'str', value: 1, type: 'enhancement', source: '' }] }));
const removeMod = (setter: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>, i: number) =>
  setter(f => ({ ...f, modifiers: f.modifiers.filter((_, idx) => idx !== i) }));
const updateMod = (setter: React.Dispatch<React.SetStateAction<Omit<Item, 'id'>>>, i: number, field: string, val: unknown) =>
  setter(f => ({ ...f, modifiers: f.modifiers.map((m, idx) => idx === i ? { ...m, [field]: val } : m) }));

interface AmmoFieldsProps {
  amd: AmmoDetails;
  onChange: (field: keyof AmmoDetails, val: unknown) => void;
}
const AmmoFields: React.FC<AmmoFieldsProps> = ({ amd, onChange }) => (
  <div style={{ marginTop: 8, padding: '10px', background: 'rgba(192,57,43,0.07)', borderRadius: 6, border: '1px solid rgba(192,57,43,0.2)' }}>
    <div style={{ fontSize: '0.67rem', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>🏹 DETTAGLI MUNIZIONE</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Bonus Attacco
        <input className="input" type="number" value={amd.attackBonus ?? 0} onChange={e => onChange('attackBonus', parseInt(e.target.value) || 0)}
          style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Danno Extra
        <input className="input" value={amd.extraDamage ?? ''} onChange={e => onChange('extraDamage', e.target.value)}
          placeholder="es. 1d6" style={{ fontSize: '0.82rem' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
        Tipo Danno Extra
        <select className="input" value={amd.extraDamageType ?? ''} onChange={e => onChange('extraDamageType', e.target.value)} style={{ fontSize: '0.82rem' }}>
          <option value="">—</option>
          {DAMAGE_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
          <option value="fuoco">Fuoco</option>
          <option value="gelo">Gelo</option>
          <option value="fulmine">Fulmine</option>
          <option value="acido">Acido</option>
          <option value="veleno">Veleno</option>
          <option value="necrotico">Necrotico</option>
          <option value="radiante">Radiante</option>
          <option value="psichico">Psichico</option>
        </select>
      </label>
    </div>
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 8 }}>
      Note
      <input className="input" value={amd.notes ?? ''} onChange={e => onChange('notes', e.target.value)}
        placeholder="Note aggiuntive..." style={{ fontSize: '0.82rem' }} />
    </label>
  </div>
);

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
  onPickIcon: () => void;
  previewSvg?: string;
}
const EditItemForm: React.FC<EditItemFormProps> = ({ itemForm, setItemForm, editingItemId, onSave, onCancel, autoFocus, onPickIcon, previewSvg }) => (
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
            ammoDetails: needsAmmo(t) ? (f.ammoDetails ?? EMPTY_AMD()) : undefined,
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
        <option value="ammo">Munizioni</option>
        <option value="misc">Miscellanea</option>
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
    {/* Ammo-specific fields */}
    {needsAmmo(itemForm.type) && (
      <AmmoFields
        amd={itemForm.ammoDetails ?? EMPTY_AMD()}
        onChange={(field, val) => setItemForm(f => ({ ...f, ammoDetails: { ...(f.ammoDetails ?? EMPTY_AMD()), [field]: val } as AmmoDetails }))}
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
    {/* Icon picker */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ICONA</span>
      <div style={{ width: 40, height: 40, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {previewSvg
          ? <SvgIcon svg={previewSvg} size={28} className="inv-svg-tinted" />
          : <span style={{ fontSize: '1.2rem' }}>{TYPE_ICON[itemForm.type]}</span>}
      </div>
      <button type="button" onClick={onPickIcon} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
        <FaImage size={11} /> Scegli dal Catalogo
      </button>
      {itemForm.iconId && (
        <button type="button" onClick={() => setItemForm(f => ({ ...f, iconId: undefined }))}
          className="btn-ghost" style={{ fontSize: '0.75rem', color: 'var(--accent-crimson)' }}>
          <FaTimes size={10} /> Rimuovi
        </button>
      )}
    </div>
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

// ─── ItemCard ──────────────────────────────────────────
export interface ItemCardProps {
  item: Item;
  selected: boolean;
  onClick: () => void;
  onEquip: () => void;
  onEdit: () => void;
  onDelete: () => void;
  iconSvg?: string;
}
const ItemCard: React.FC<ItemCardProps> = ({ item, selected, onClick, onEquip, onEdit, onDelete, iconSvg }) => {
  const color = TYPE_COLOR[item.type];
  const wd = item.weaponDetails;
  const ad = item.armorDetails;

  let statText: string | null = null;
  let statColor = color;
  if (wd) {
    statText = wd.damage + (wd.criticalMultiplier && wd.criticalMultiplier !== 'x2' ? ` ${wd.criticalMultiplier}` : '');
    statColor = 'var(--accent-crimson)';
  } else if (ad) {
    statText = `CA +${ad.armorBonus}`;
    statColor = 'var(--accent-gold)';
  }

  const cssVars = { '--eq-color': color, '--eq-glow': `${color}55` } as React.CSSProperties;
  const classes = ['inv-item-card', item.equipped ? 'equipped' : '', selected ? 'selected' : ''].filter(Boolean).join(' ');

  return (
    <div className={classes} style={cssVars} onClick={onClick}>
      <div className="inv-card-badge-row">
        {item.equipped ? <div className="inv-card-dot" style={cssVars} /> : <span />}
        {(item.quantity ?? 1) > 1 && <div className="inv-card-qty">×{item.quantity}</div>}
      </div>
      <div className="inv-card-icon">
        {iconSvg ? <SvgIcon svg={iconSvg} /> : TYPE_ICON[item.type]}
      </div>
      <div className="inv-card-name">{item.name}</div>
      {statText && <div className="inv-card-stat" style={{ color: statColor }}>{statText}</div>}
      {item.type === 'weapon' && !!wd?.rangeIncrement && item.equippedAmmoId && (
        <div className="inv-card-stat" style={{ color: 'var(--accent-crimson)', fontSize: '0.6rem' }}>🏹 muniz.</div>
      )}
      {item.weight > 0 && <div className="inv-card-meta">{item.weight} kg</div>}
      <div className="inv-card-actions">
        <button className={`inv-card-btn ${item.equipped ? 'unequip' : 'equip'}`}
          onClick={e => { e.stopPropagation(); onEquip(); }}
          title={item.equipped ? 'Rimuovi' : 'Equipaggia'}>
          {item.equipped ? <FaTimes size={10} /> : <FaCheck size={10} />}
        </button>
        <button className="inv-card-btn" onClick={e => { e.stopPropagation(); onEdit(); }} title="Modifica">
          <FaEdit size={10} />
        </button>
        <button className="inv-card-btn danger" onClick={e => { e.stopPropagation(); onDelete(); }} title="Elimina">
          <FaTrash size={9} />
        </button>
      </div>
    </div>
  );
};

// ─── ItemDetailPanel ───────────────────────────────────
interface DetailPanelProps {
  item: Item;
  onClose: () => void;
  onEquip: () => void;
  onEdit: () => void;
  onDelete: () => void;
  iconSvg?: string;
  ammoItems?: Item[];
  onSetAmmo?: (ammoId: string | null) => void;
}
const ItemDetailPanel: React.FC<DetailPanelProps> = ({ item, onClose, onEquip, onEdit, onDelete, iconSvg, ammoItems, onSetAmmo }) => {
  const color = TYPE_COLOR[item.type];
  const wd = item.weaponDetails;
  const ad = item.armorDetails;
  const amd = item.ammoDetails;
  const isRanged = !!(wd?.rangeIncrement?.trim());
  const loadedAmmo = isRanged && item.equippedAmmoId
    ? ammoItems?.find(a => a.id === item.equippedAmmoId)
    : undefined;
  return (
    <div className="inv-detail-panel">
      <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, zIndex: 1 }}>
        <FaTimes size={12} />
      </button>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: 20 }}>
        <div style={{ fontSize: '2.2rem', lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))', flexShrink: 0 }}>
          {iconSvg ? <SvgIcon svg={iconSvg} size={44} className="inv-svg-tinted" /> : TYPE_ICON[item.type]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.92rem', lineHeight: 1.25, marginBottom: 6, color: item.equipped ? color : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
            {(item.quantity ?? 1) > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 5 }}>×{item.quantity}</span>}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.62rem', color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 3, padding: '2px 8px', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>
              {TYPE_LABEL[item.type]}
            </span>
            {item.equipped && (
              <span style={{ fontSize: '0.62rem', color: 'var(--accent-success)', background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.3)', borderRadius: 3, padding: '2px 8px', fontFamily: 'var(--font-heading)' }}>
                EQUIPAGGIATO
              </span>
            )}
          </div>
        </div>
      </div>
      {item.weight > 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Peso: <span style={{ color: 'var(--text-secondary)' }}>{item.weight} kg</span>
        </div>
      )}
      {/* Weapon stats */}
      {wd && (
        <div style={{ padding: '10px 12px', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>⚔ ARMA</div>
          <div className="inv-detail-stat-grid">
            {[
              { label: 'Danno', value: wd.damage, color: 'var(--accent-crimson)' },
              { label: 'Tipo', value: wd.damageType, color: 'var(--text-secondary)' },
              { label: 'Critico', value: `${wd.criticalRange ? wd.criticalRange + '/' : ''}${wd.criticalMultiplier}`, color: 'var(--accent-crimson)' },
              ...(wd.rangeIncrement ? [{ label: 'Gittata', value: wd.rangeIncrement, color: 'var(--text-secondary)' }] : []),
              ...(wd.attackBonus ? [{ label: 'Bonus Att.', value: `${wd.attackBonus >= 0 ? '+' : ''}${wd.attackBonus}`, color: 'var(--accent-success)' }] : []),
            ].map(s => (
              <div key={s.label} className="inv-detail-stat-box">
                <div className="inv-detail-stat-label">{s.label}</div>
                <div className="inv-detail-stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {wd.notes && <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{wd.notes}</div>}
        </div>
      )}
      {/* Ammo picker for equipped ranged weapons */}
      {isRanged && item.equipped && ammoItems !== undefined && (
        <div style={{ padding: '10px 12px', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>🏹 MUNIZIONI</div>
          {ammoItems.length === 0 ? (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nessuna munizione nell'inventario.</div>
          ) : (
            <select
              className="input"
              style={{ width: '100%', fontSize: '0.82rem' }}
              value={item.equippedAmmoId ?? ''}
              onChange={e => onSetAmmo?.(e.target.value || null)}
            >
              <option value="">— Nessuna munizione —</option>
              {ammoItems.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{(a.quantity ?? 1) > 1 ? ` ×${a.quantity}` : ''}{a.ammoDetails?.attackBonus ? ` (+${a.ammoDetails.attackBonus} att.)` : ''}{a.ammoDetails?.extraDamage ? ` +${a.ammoDetails.extraDamage}` : ''}
                </option>
              ))}
            </select>
          )}
          {loadedAmmo?.ammoDetails && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!!loadedAmmo.ammoDetails.attackBonus && (
                <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 3, background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.28)', color: 'var(--accent-success)', fontFamily: 'var(--font-heading)' }}>
                  {loadedAmmo.ammoDetails.attackBonus > 0 ? '+' : ''}{loadedAmmo.ammoDetails.attackBonus} Attacco
                </span>
              )}
              {loadedAmmo.ammoDetails.extraDamage && (
                <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 3, background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.28)', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)' }}>
                  +{loadedAmmo.ammoDetails.extraDamage}{loadedAmmo.ammoDetails.extraDamageType ? ` (${loadedAmmo.ammoDetails.extraDamageType})` : ''}
                </span>
              )}
              {loadedAmmo.ammoDetails.notes && (
                <div style={{ width: '100%', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>{loadedAmmo.ammoDetails.notes}</div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Ammo stats (when viewing an ammo item) */}
      {amd && (
        <div style={{ padding: '10px 12px', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--accent-crimson)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>🏹 MUNIZIONE</div>
          <div className="inv-detail-stat-grid">
            {[
              ...(amd.attackBonus ? [{ label: 'Bonus Att.', value: `${amd.attackBonus >= 0 ? '+' : ''}${amd.attackBonus}`, color: 'var(--accent-success)' }] : []),
              ...(amd.extraDamage ? [{ label: 'Danno Extra', value: amd.extraDamage, color: 'var(--accent-crimson)' }] : []),
              ...(amd.extraDamageType ? [{ label: 'Tipo Extra', value: amd.extraDamageType, color: 'var(--text-secondary)' }] : []),
            ].map(s => (
              <div key={s.label} className="inv-detail-stat-box">
                <div className="inv-detail-stat-label">{s.label}</div>
                <div className="inv-detail-stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {amd.notes && <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{amd.notes}</div>}
        </div>
      )}
      {/* Armor stats */}
      {ad && (
        <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 8 }}>🛡 PROTEZIONE</div>
          <div className="inv-detail-stat-grid">
            {[
              { label: 'Bonus CA', value: `+${ad.armorBonus}`, color: 'var(--accent-gold)' },
              { label: 'Des. Max', value: ad.maxDex != null ? `+${ad.maxDex}` : '—', color: 'var(--text-secondary)' },
              { label: 'Pen. Prova', value: String(ad.checkPenalty ?? 0), color: ad.checkPenalty ? 'var(--accent-crimson)' : 'var(--text-secondary)' },
              { label: 'Fall. Inc.', value: `${ad.spellFailure ?? 0}%`, color: ad.spellFailure ? 'var(--accent-crimson)' : 'var(--text-secondary)' },
              ...(ad.speed != null ? [{ label: 'Velocità', value: `${ad.speed}m`, color: 'var(--text-secondary)' }] : []),
            ].map(s => (
              <div key={s.label} className="inv-detail-stat-box">
                <div className="inv-detail-stat-label">{s.label}</div>
                <div className="inv-detail-stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {ad.specialProperties && <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{ad.specialProperties}</div>}
        </div>
      )}
      {item.associatedSpell && (
        <div style={{ fontSize: '0.76rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Incantesimo: </span>
          <span style={{ color: 'var(--accent-arcane)' }}>{item.associatedSpell}</span>
        </div>
      )}
      {item.modifiers.length > 0 && (
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 6 }}>MODIFICATORI</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {item.modifiers.map((m, i) => (
              <span key={i} style={{ fontSize: '0.68rem', padding: '3px 9px', borderRadius: 3, background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.28)', color: 'var(--accent-success)', fontFamily: 'var(--font-heading)' }}>
                {m.value >= 0 ? '+' : ''}{m.value} {m.target.toUpperCase()}<span style={{ opacity: 0.6, fontSize: '0.6rem', marginLeft: 3 }}>({m.type})</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {item.description && (
        <div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', marginBottom: 5 }}>DESCRIZIONE</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.55 }}>{item.description}</p>
        </div>
      )}
      {/* Actions */}
      <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', gap: 7 }}>
        <button onClick={onEquip} style={{ flex: 1, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.74rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em', background: item.equipped ? 'rgba(192,57,43,0.12)' : 'rgba(39,174,96,0.12)', border: `1px solid ${item.equipped ? 'rgba(192,57,43,0.4)' : 'rgba(39,174,96,0.4)'}`, color: item.equipped ? 'var(--accent-crimson)' : 'var(--accent-success)', minWidth: 0 }}>
          {item.equipped ? 'Rimuovi' : 'Equipaggia'}
        </button>
        <button onClick={onEdit} style={{ padding: '8px 11px', borderRadius: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)' }}>
          <FaEdit size={12} />
        </button>
        <button onClick={onDelete} style={{ padding: '8px 11px', borderRadius: 6, cursor: 'pointer', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', color: 'var(--accent-crimson)' }}>
          <FaTrash size={11} />
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────
export const Inventory: React.FC = () => {
  const { character, setCharacter, toggleEquipItem, addCurrencyTransaction } = useCharacterStore();

  const [mainTab, setMainTab] = useState<MainTab>('items');
  const [itemTab, setItemTab] = useState<ItemTabKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState<Omit<Item, 'id'>>(EMPTY_ITEM());
  const [search, setSearch] = useState('');
  // Currency
  const [txForm, setTxForm] = useState(EMPTY_TX());
  // Icon catalog (shared cache, loaded once per session)
  const { icons: iconCatalogItems, resolveItemSvg, loading: iconCatalogLoading } = useIconCatalog();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const openIconPicker = () => setIconPickerOpen(true);
  const pickIcon = (ic: CatalogIcon) => {
    setItemForm(f => ({ ...f, iconId: ic.id }));
    setIconPickerOpen(false);
  };

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
  (['weapon', 'armor', 'shield', 'protectiveItem', 'gear', 'consumable', 'component', 'ammo'] as Item['type'][]).forEach(t => {
    itemCounts[t] = allItems.filter(i => i.type === t).length;
  });
  const searchQ = search.trim().toLowerCase();
  const filtered = (itemTab === 'all' ? allItems : allItems.filter(i => i.type === itemTab))
    .filter(i => !searchQ || i.name.toLowerCase().includes(searchQ) || (i.description ?? '').toLowerCase().includes(searchQ));
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
  const handleSetAmmo = (weaponId: string, ammoId: string | null) => {
    setCharacter({
      ...character,
      inventory: allItems.map(i => i.id === weaponId ? { ...i, equippedAmmoId: ammoId ?? undefined } : i),
    });
  };
  const startEditItem = (item: Item) => {
    setItemForm({
      name: item.name, description: item.description ?? '', type: item.type,
      weight: item.weight, modifiers: [...item.modifiers], equipped: item.equipped,
      quantity: item.quantity ?? 1, location: item.location ?? '',
      weaponDetails: item.weaponDetails ? { ...item.weaponDetails } : undefined,
      armorDetails: item.armorDetails ? { ...item.armorDetails } : undefined,
      ammoDetails: item.ammoDetails ? { ...item.ammoDetails } : undefined,
      associatedSpell: item.associatedSpell ?? '',
      iconId: item.iconId,
      equippedAmmoId: item.equippedAmmoId,
    });
    setEditingItemId(item.id); setIsAddingItem(false);
  };
  const cancelEditItem = () => { setEditingItemId(null); setIsAddingItem(false); setItemForm(EMPTY_ITEM()); };
  const deleteItemFn = (id: string) => {
    setCharacter({ ...character, inventory: allItems.filter(i => i.id !== id) });
    if (editingItemId === id) cancelEditItem();
    if (selectedId === id) setSelectedId(null);
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
  const selectedItem = allItems.find(i => i.id === selectedId) ?? null;
  const ammoItems = allItems.filter(i => i.type === 'ammo');
  const commonCardProps = (item: Item) => ({
    item,
    selected: selectedId === item.id,
    onClick: () => setSelectedId(selectedId === item.id ? null : item.id),
    onEquip: () => toggleEquipItem(item.id),
    onEdit: () => startEditItem(item),
    onDelete: () => deleteItemFn(item.id),
    iconSvg: resolveItemSvg(item),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* ── MAIN TABS ── */}
      <div className="inv-main-tabs" style={{ borderBottom: '1px solid rgba(201,168,76,0.12)', marginBottom: 10 }}>
        <button className={`inv-main-tab-btn${mainTab === 'items' ? ' active' : ''}`} onClick={() => setMainTab('items')}>
          Oggetti ({allItems.length})
        </button>
        <button className={`inv-main-tab-btn${mainTab === 'currency' ? ' active' : ''}`} onClick={() => setMainTab('currency')}>
          Monete
        </button>
      </div>

      {/* ═══════════ TAB: ITEMS ═══════════ */}
      {mainTab === 'items' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>{totalWeight.toFixed(1)} kg</span>
              <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>·</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{allItems.length} oggetti</span>
            </div>
            <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              onClick={() => { setIsAddingItem(true); setEditingItemId(null); setItemForm(EMPTY_ITEM()); }}>
              <FaPlus size={10} /> Nuovo
            </button>
          </div>

          {/* Search */}
          <div className="inv-search-wrap">
            <FaSearch className="inv-search-icon" size={12} />
            <input
              className="inv-search-input"
              placeholder="Cerca oggetti…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="inv-search-clear" onClick={() => setSearch('')} title="Cancella">
                <FaTimes size={10} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="inv-cat-pills">
            {ITEM_TABS.filter(t => t.key === 'all' || (itemCounts[t.key] ?? 0) > 0).map(t => (
              <button key={t.key}
                className={`inv-cat-pill${itemTab === t.key ? ' active' : ''}`}
                style={itemTab === t.key ? { '--pill-border': `${t.color}66`, '--pill-color': t.color, '--pill-bg': `${t.color}14` } as React.CSSProperties : {}}
                onClick={() => setItemTab(t.key)}>
                {t.icon} {t.label}
                <span className="inv-cat-count">{t.key === 'all' ? allItems.length : (itemCounts[t.key] ?? 0)}</span>
              </button>
            ))}
          </div>

          {/* Content: grid + optional detail panel */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

            {/* Scrollable items area */}
            <div className="inv-scroll" style={{ flex: 1, minWidth: 0 }}>

              {equipped.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div className="inv-section-hdr">
                    <span className="inv-section-hdr-text">EQUIPAGGIATO</span>
                    <div className="inv-section-hdr-line" />
                    <span className="inv-section-hdr-count">{equipped.length}</span>
                  </div>
                  <div className="inv-item-grid">
                    {equipped.map(item => <ItemCard key={item.id} {...commonCardProps(item)} />)}
                  </div>
                </div>
              )}

              {backpack.length > 0 && (
                <div>
                  {equipped.length > 0 && (
                    <div className="inv-section-hdr">
                      <span className="inv-section-hdr-text">ZAINO</span>
                      <div className="inv-section-hdr-line" />
                      <span className="inv-section-hdr-count">{backpack.length}</span>
                    </div>
                  )}
                  <div className="inv-item-grid">
                    {backpack.map(item => <ItemCard key={item.id} {...commonCardProps(item)} />)}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: 0.25 }}>🎒</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {searchQ ? `Nessun risultato per "${search}".` : itemTab === 'all' ? 'Inventario vuoto.' : 'Nessun oggetto in questa categoria.'}
                  </div>
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selectedItem && (
              <div style={{ width: 'min(230px, 42%)', flexShrink: 0 }}>
                <ItemDetailPanel
                  item={selectedItem}
                  onClose={() => setSelectedId(null)}
                  onEquip={() => toggleEquipItem(selectedItem.id)}
                  onEdit={() => startEditItem(selectedItem)}
                  onDelete={() => deleteItemFn(selectedItem.id)}
                  iconSvg={resolveItemSvg(selectedItem)}
                  ammoItems={ammoItems}
                  onSetAmmo={(ammoId) => handleSetAmmo(selectedItem.id, ammoId)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TAB: CURRENCY ═══════════ */}
      {mainTab === 'currency' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 16 }}>

          {/* Coin balance */}
          <div className="glass-panel" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.13em', marginBottom: 14 }}>TESORO</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COIN_LABELS.map(({ key, label, abbr, color }) => (
                <div key={key} className="inv-coin-tile" style={{ borderColor: `${color}22` }}>
                  <div className="inv-coin-orb" style={{ color, background: `${color}18`, borderColor: `${color}40` }}>{abbr}</div>
                  <div className="inv-coin-amount" style={{ color }}>{currency[key] ?? 0}</div>
                  <div className="inv-coin-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* New transaction */}
          <div className="glass-panel" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.13em', marginBottom: 12 }}>NUOVA TRANSAZIONE</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['in', 'out'] as const).map(dir => (
                <button key={dir} onClick={() => setTxForm(f => ({ ...f, dir }))} style={{
                  padding: '5px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem',
                  background: txForm.dir === dir ? (dir === 'in' ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)') : 'transparent',
                  border: txForm.dir === dir ? `1px solid ${dir === 'in' ? 'rgba(39,174,96,0.5)' : 'rgba(192,57,43,0.5)'}` : '1px solid rgba(255,255,255,0.1)',
                  color: txForm.dir === dir ? (dir === 'in' ? 'var(--accent-success)' : 'var(--accent-crimson)') : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-heading)',
                }}>
                  {dir === 'in' ? <FaArrowDown size={10} /> : <FaArrowUp size={10} />}
                  {dir === 'in' ? 'Entrata' : 'Uscita'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {COIN_LABELS.map(({ key, label, color }) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.7rem', color }}>
                  {label}
                  <input className="input" type="number" min={0} value={txForm[key] || ''}
                    onChange={e => setTxForm(f => ({ ...f, [key]: parseInt(e.target.value) || 0 }))}
                    placeholder="0" style={{ width: 68, textAlign: 'center', fontSize: '0.88rem', fontFamily: 'var(--font-heading)', color }} />
                </label>
              ))}
            </div>
            <input className="input" placeholder="Descrizione transazione..." value={txForm.description}
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
              <div style={{ padding: '8px 14px 7px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.12em' }}>STORICO TRANSAZIONI</span>
              </div>
              {txLog.map(tx => {
                const isPositive = (tx.gold + tx.platinum + tx.silver + tx.copper) >= 0;
                const parts = COIN_LABELS.map(({ key, abbr, color }) => tx[key] !== 0 ? { label: abbr, value: tx[key], color } : null).filter(Boolean) as { label: string; value: number; color: string }[];
                return (
                  <div key={tx.id} className="inv-tx-row">
                    <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: isPositive ? 'var(--accent-success)' : 'var(--accent-crimson)' }} />
                    {isPositive ? <FaArrowDown size={9} color="var(--accent-success)" /> : <FaArrowUp size={9} color="var(--accent-crimson)" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || '—'}</div>
                      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      {parts.map(p => (
                        <span key={p.label} style={{ fontFamily: 'var(--font-heading)', fontSize: '0.82rem', color: p.color }}>
                          {p.value > 0 ? '+' : ''}{p.value} {p.label}
                        </span>
                      ))}
                    </div>
                    <button onClick={() => setCharacter({ ...character, currencyLog: txLog.filter(t => t.id !== tx.id) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-crimson)', padding: '3px 5px', opacity: 0.4, flexShrink: 0 }}>
                      <FaTrash size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {txLog.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>Nessuna transazione registrata.</div>
          )}
        </div>
      )}

      {/* ─── Edit / Add Modal ─── */}
      {(isAddingItem || editingItemId !== null) && (
        <div className="inv-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) cancelEditItem(); }}>
          <div className="inv-modal-box">
            <div className="inv-modal-header">
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.88rem', color: 'var(--accent-gold)', letterSpacing: '0.08em' }}>
                {editingItemId ? '⚙ MODIFICA OGGETTO' : '＋ NUOVO OGGETTO'}
              </div>
              <button onClick={cancelEditItem} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <FaTimes size={13} />
              </button>
            </div>
            <EditItemForm itemForm={itemForm} setItemForm={setItemForm} editingItemId={editingItemId} onSave={saveItem} onCancel={cancelEditItem} onPickIcon={openIconPicker} previewSvg={resolveItemSvg({ type: itemForm.type, iconId: itemForm.iconId, weaponDetails: itemForm.weaponDetails })} autoFocus />
          </div>
        </div>
      )}

      {iconPickerOpen && (
        <CatalogPicker<CatalogIcon>
          title="Scegli un'icona"
          items={iconCatalogItems}
          loading={iconCatalogLoading}
          onClose={() => setIconPickerOpen(false)}
          onPick={pickIcon}
          groupBy={ic => ic.category?.trim() || undefined}
          uncategorisedLabel="Senza cartella"
          map={ic => ({
            id: ic.id,
            name: ic.name,
            subtitle: ic.category,
            tags: ic.tags,
            previewSvg: ic.svg,
            raw: ic,
          })}
        />
      )}
    </div>
  );
};
