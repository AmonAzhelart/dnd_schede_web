import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import type { Spell } from '../types/dnd';
import { FaTimes } from 'react-icons/fa';

export const SpellModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { character, setCharacter } = useCharacterStore();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [school, setSchool] = useState('Evocazione');
  const [description, setDescription] = useState('');
  const [prepared, setPrepared] = useState(1);

  const handleSave = () => {
    if (!character || !name.trim()) return;
    const newSpell: Spell = { id: uuidv4(), name: name.trim(), level, school, description, prepared, cast: 0 };
    setCharacter({ ...character, spells: [...character.spells, newSpell] });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-heading" style={{ color: 'var(--accent-arcane)' }}>Nuova Magia</h3>
          <button className="btn-ghost" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="flex-col gap-3">
          <input className="input" placeholder="Nome dell'incantesimo" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <div className="flex-col gap-1" style={{ flex: '0 0 80px' }}>
              <label className="text-xs text-muted">Livello</label>
              <input className="input" type="number" value={level} onChange={e => setLevel(+e.target.value)} min={0} max={9} />
            </div>
            <div className="flex-col gap-1" style={{ flex: 1 }}>
              <label className="text-xs text-muted">Scuola</label>
              <select className="input" value={school} onChange={e => setSchool(e.target.value)}>
                {['Abiurazione','Ammaliamento','Divinazione','Evocazione','Illusione','Invocazione','Necromanzia','Trasmutazione'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div className="flex-col gap-1" style={{ flex: '0 0 90px' }}>
              <label className="text-xs text-muted">Lanci/giorno</label>
              <input className="input" type="number" value={prepared} onChange={e => setPrepared(+e.target.value)} min={1} />
            </div>
          </div>
          <textarea className="input" placeholder="Descrizione ed effetti..." value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 100 }} />
        </div>

        <button className="btn-primary w-full" style={{ justifyContent: 'center' }} onClick={handleSave}>
          ✨ Aggiungi al Grimorio
        </button>
      </div>
    </div>
  );
};
