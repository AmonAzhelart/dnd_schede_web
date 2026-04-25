import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import type { Spell, StatType } from '../types/dnd';
import { FaTimes } from 'react-icons/fa';

const SCHOOLS = ['Abiurazione', 'Ammaliamento', 'Divinazione', 'Evocazione', 'Illusione', 'Invocazione', 'Necromanzia', 'Trasmutazione'];

const ATTACK_MODES: { v: NonNullable<Spell['attackMode']>; label: string }[] = [
  { v: 'none', label: 'Nessun TxC (solo TS o effetto)' },
  { v: 'rangedTouch', label: 'Tocco a distanza (raggio)' },
  { v: 'meleeTouch', label: 'Tocco in mischia' },
  { v: 'ray', label: 'Raggio (TxC distanza)' },
  { v: 'normal', label: 'Attacco normale' },
];

const SAVE_STATS: StatType[] = ['int', 'wis', 'cha', 'str', 'dex', 'con'];

export const SpellModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { character, setCharacter } = useCharacterStore();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [school, setSchool] = useState('Evocazione');
  const [description, setDescription] = useState('');
  const [prepared, setPrepared] = useState(1);
  // Roll/scaling fields
  const [attackMode, setAttackMode] = useState<NonNullable<Spell['attackMode']>>('none');
  const [damagePerLevelDice, setDamagePerLevelDice] = useState('');
  const [dicePerLevels, setDicePerLevels] = useState(1);
  const [damageMaxDice, setDamageMaxDice] = useState<number | ''>('');
  const [damageType, setDamageType] = useState('');
  const [savingThrow, setSavingThrow] = useState('');
  const [saveStat, setSaveStat] = useState<StatType>('int');

  const handleSave = () => {
    if (!character || !name.trim()) return;
    const newSpell: Spell = {
      id: uuidv4(),
      name: name.trim(),
      level,
      school,
      description,
      prepared,
      cast: 0,
      attackMode,
      savingThrow: savingThrow.trim() || undefined,
      saveStat,
      damagePerLevelDice: damagePerLevelDice.trim() || undefined,
      dicePerLevels: damagePerLevelDice.trim() ? Math.max(1, dicePerLevels) : undefined,
      damageMaxDice: damageMaxDice === '' ? undefined : Math.max(1, damageMaxDice),
      damageType: damageType.trim() || undefined,
    };
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
                {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-col gap-1" style={{ flex: '0 0 90px' }}>
              <label className="text-xs text-muted">Lanci/giorno</label>
              <input className="input" type="number" value={prepared} onChange={e => setPrepared(+e.target.value)} min={1} />
            </div>
          </div>

          <textarea className="input" placeholder="Descrizione ed effetti..." value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 80 }} />

          {/* ── Combat / scaling block (D&D 3.5) ── */}
          <div style={{
            border: '1px solid rgba(155,89,182,0.18)', borderRadius: 8,
            padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              TIRO &amp; SCALING (opzionale)
            </div>

            <div className="flex gap-2">
              <div className="flex-col gap-1" style={{ flex: 1 }}>
                <label className="text-xs text-muted">Tipo di tiro per colpire</label>
                <select className="input" value={attackMode} onChange={e => setAttackMode(e.target.value as NonNullable<Spell['attackMode']>)}>
                  {ATTACK_MODES.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-col gap-1" style={{ flex: 1 }}>
                <label className="text-xs text-muted">Dadi per "step" (es. 1d6)</label>
                <input className="input" placeholder="1d6 / 1d4+1 / vuoto" value={damagePerLevelDice} onChange={e => setDamagePerLevelDice(e.target.value)} />
              </div>
              <div className="flex-col gap-1" style={{ flex: '0 0 100px' }}>
                <label className="text-xs text-muted">Liv./step</label>
                <input className="input" type="number" min={1} value={dicePerLevels} onChange={e => setDicePerLevels(Math.max(1, +e.target.value || 1))} title="Livelli incantatore necessari per +1 dado (es. 1 per Palla di Fuoco, 2 per Dardo Incantato)" />
              </div>
              <div className="flex-col gap-1" style={{ flex: '0 0 90px' }}>
                <label className="text-xs text-muted">Max dadi</label>
                <input className="input" type="number" min={1} value={damageMaxDice} onChange={e => setDamageMaxDice(e.target.value === '' ? '' : Math.max(1, +e.target.value))} placeholder="—" title="Numero massimo di dadi (es. 10 per Palla di Fuoco, 5 per Dardo Incantato)" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-col gap-1" style={{ flex: 1 }}>
                <label className="text-xs text-muted">Tipo di danno</label>
                <input className="input" value={damageType} onChange={e => setDamageType(e.target.value)} placeholder="fuoco, freddo, elettricità…" />
              </div>
              <div className="flex-col gap-1" style={{ flex: 1 }}>
                <label className="text-xs text-muted">Tiro salvezza</label>
                <input className="input" value={savingThrow} onChange={e => setSavingThrow(e.target.value)} placeholder="Riflessi dimezza" />
              </div>
              <div className="flex-col gap-1" style={{ flex: '0 0 90px' }}>
                <label className="text-xs text-muted">CD da</label>
                <select className="input" value={saveStat} onChange={e => setSaveStat(e.target.value as StatType)}>
                  {SAVE_STATS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <button className="btn-primary w-full" style={{ justifyContent: 'center' }} onClick={handleSave}>
          ✨ Aggiungi al Grimorio
        </button>
      </div>
    </div>
  );
};
