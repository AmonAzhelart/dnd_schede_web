import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import type { Item } from '../types/dnd';
import { FaPlus, FaTrash, FaTimes } from 'react-icons/fa';

export const ItemModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { character, setCharacter } = useCharacterStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Item['type']>('gear');
  const [weight, setWeight] = useState(0);
  const [modifiers, setModifiers] = useState<any[]>([]);

  const addMod = () => setModifiers([...modifiers, { target: 'str', value: 1, type: 'enhancement', source: '' }]);
  const removeMod = (i: number) => setModifiers(modifiers.filter((_, idx) => idx !== i));
  const updateMod = (i: number, field: string, val: any) => {
    const m = [...modifiers]; m[i] = { ...m[i], [field]: val }; setModifiers(m);
  };

  const handleSave = () => {
    if (!character || !name.trim()) return;
    const newItem: Item = {
      id: uuidv4(), name: name.trim(), description, type, weight, equipped: false,
      modifiers: modifiers.map(m => ({ ...m, source: name.trim() }))
    };
    setCharacter({ ...character, inventory: [...character.inventory, newItem] });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-heading" style={{ color: 'var(--accent-gold)' }}>Nuovo Oggetto</h3>
          <button className="btn-ghost" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="flex-col gap-3">
          <input className="input" placeholder="Nome dell'oggetto" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <select className="input" value={type} onChange={e => setType(e.target.value as any)} style={{ flex: 1 }}>
              <option value="weapon">Arma</option>
              <option value="armor">Armatura</option>
              <option value="shield">Scudo</option>
              <option value="gear">Equipaggiamento</option>
              <option value="consumable">Consumabile</option>
            </select>
            <input className="input" type="number" placeholder="Peso (lb)" value={weight} onChange={e => setWeight(+e.target.value)} style={{ width: 100 }} />
          </div>
          <textarea className="input" placeholder="Descrizione..." value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div>
          <div className="section-header">
            <span className="section-title">Modificatori</span>
            <button className="btn-secondary text-xs" onClick={addMod}><FaPlus /> Aggiungi</button>
          </div>
          {modifiers.length === 0 && <p className="text-muted text-xs">Nessun modificatore. L'oggetto non darà bonus matematici.</p>}
          <div className="flex-col gap-2">
            {modifiers.map((mod, i) => (
              <div key={i} className="flex gap-2 items-center card" style={{ padding: '0.5rem' }}>
                <input className="input" value={mod.target} onChange={e => updateMod(i, 'target', e.target.value)} placeholder="es. str, ac" style={{ flex: 1 }} />
                <input className="input" type="number" value={mod.value} onChange={e => updateMod(i, 'value', +e.target.value)} style={{ width: 60 }} />
                <select className="input" value={mod.type} onChange={e => updateMod(i, 'type', e.target.value)} style={{ flex: 1 }}>
                  <option value="enhancement">Potenziamento</option>
                  <option value="armor">Armatura</option>
                  <option value="deflection">Deviazione</option>
                  <option value="dodge">Schivare</option>
                  <option value="circumstance">Circostanza</option>
                  <option value="untyped">Senza tipo</option>
                </select>
                <button className="btn-ghost" style={{ color: 'var(--accent-crimson)' }} onClick={() => removeMod(i)}><FaTrash size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        <button className="btn-primary w-full" style={{ justifyContent: 'center', marginTop: '0.5rem' }} onClick={handleSave}>
          Salva Oggetto
        </button>
      </div>
    </div>
  );
};
