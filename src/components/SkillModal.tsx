import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import type { Skill, StatType } from '../types/dnd';
import { FaTimes } from 'react-icons/fa';

export const SkillModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { character, setCharacter } = useCharacterStore();
  const [name, setName] = useState('');
  const [stat, setStat] = useState<StatType>('int');
  const [ranks, setRanks] = useState(1);
  const [classSkill, setClassSkill] = useState(false);
  const [armorCheckPenalty, setArmorCheckPenalty] = useState(false);
  const [canUseUntrained, setCanUseUntrained] = useState(true);

  const handleSave = () => {
    if (!character || !name.trim()) return;
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + uuidv4().slice(0, 4);
    const newSkill: Skill = { id, name: name.trim(), stat, ranks, classSkill, armorCheckPenalty, canUseUntrained };
    setCharacter({ ...character, skills: { ...character.skills, [id]: newSkill } });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-heading" style={{ color: 'var(--accent-gold)' }}>Nuova Abilità</h3>
          <button className="btn-ghost" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="flex-col gap-3">
          <input className="input" placeholder="Nome abilità (es. Conoscenze Locali)" value={name} onChange={e => setName(e.target.value)} autoFocus />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="flex gap-2 items-center">
              <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>Stat base:</span>
              <select className="input" value={stat} onChange={e => setStat(e.target.value as StatType)}>
                <option value="str">Forza</option>
                <option value="dex">Destrezza</option>
                <option value="con">Costituzione</option>
                <option value="int">Intelligenza</option>
                <option value="wis">Saggezza</option>
                <option value="cha">Carisma</option>
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>Gradi:</span>
              <input className="input" type="number" value={ranks} onChange={e => setRanks(+e.target.value)} min={0} style={{ width: 80 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <label className="flex gap-2 items-center" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={classSkill} onChange={e => setClassSkill(e.target.checked)} />
              <span className="text-sm text-muted">Di Classe</span>
            </label>
            <label className="flex gap-2 items-center" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={armorCheckPenalty} onChange={e => setArmorCheckPenalty(e.target.checked)} />
              <span className="text-sm text-muted">Pen. Armatura</span>
            </label>
            <label className="flex gap-2 items-center" style={{ cursor: 'pointer' }}
              title="Può essere usata anche senza gradi spesi">
              <input type="checkbox" checked={canUseUntrained} onChange={e => setCanUseUntrained(e.target.checked)} />
              <span className="text-sm text-muted">Senza gradi</span>
            </label>
          </div>
        </div>

        <button className="btn-primary w-full" style={{ justifyContent: 'center' }} onClick={handleSave}>Salva Abilità</button>
      </div>
    </div>
  );
};
