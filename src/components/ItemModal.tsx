import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import type { Item, Modifier } from '../types/dnd';
import { FaTimes } from 'react-icons/fa';
import { ModifierEditor } from './ModifierEditor';

export const ItemModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { character, setCharacter } = useCharacterStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Item['type']>('gear');
  const [weight, setWeight] = useState(0);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);

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
            <select className="input" value={type} onChange={e => setType(e.target.value as Item['type'])} style={{ flex: 1 }}>
              <option value="weapon">Arma</option>
              <option value="armor">Armatura</option>
              <option value="shield">Scudo</option>
              <option value="gear">Equipaggiamento</option>
              <option value="consumable">Consumabile</option>
              <option value="component">Componente</option>
              <option value="misc">Miscellanea</option>
            </select>
            <input className="input" type="number" placeholder="Peso (lb)" value={weight} onChange={e => setWeight(+e.target.value)} style={{ width: 100 }} />
          </div>
          <textarea className="input" placeholder="Descrizione..." value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <ModifierEditor
          modifiers={modifiers}
          onChange={setModifiers}
          accentColor="var(--accent-gold)"
        />

        <button className="btn-primary w-full" style={{ justifyContent: 'center', marginTop: '0.5rem' }} onClick={handleSave}>
          Salva Oggetto
        </button>
      </div>
    </div>
  );
};
