import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import type { AdventureNote, Npc } from '../types/dnd';

export const AdventureDiary: React.FC = () => {
  const { character, setCharacter } = useCharacterStore();
  const [activeSubTab, setActiveSubTab] = useState<'notes' | 'npcs'>('notes');

  if (!character) return null;

  const addNote = () => {
    const note: AdventureNote = { id: uuidv4(), title: 'Nuovo Appunto', content: '', date: new Date().toLocaleDateString('it-IT') };
    setCharacter({ ...character, notes: [...(character.notes || []), note] });
  };

  const updateNote = (id: string, field: keyof AdventureNote, value: string) =>
    setCharacter({ ...character, notes: character.notes.map(n => n.id === id ? { ...n, [field]: value } : n) });

  const deleteNote = (id: string) => {
    if (confirm('Eliminare questo appunto?'))
      setCharacter({ ...character, notes: character.notes.filter(n => n.id !== id) });
  };

  const addNpc = () => {
    const npc: Npc = { id: uuidv4(), name: 'Nuovo NPC', role: '', relationship: 'Neutrale', description: '' };
    setCharacter({ ...character, npcs: [...(character.npcs || []), npc] });
  };

  const updateNpc = (id: string, field: keyof Npc, value: string) =>
    setCharacter({ ...character, npcs: character.npcs.map(n => n.id === id ? { ...n, [field]: value } : n) });

  const deleteNpc = (id: string) => {
    if (confirm('Eliminare questo NPC?'))
      setCharacter({ ...character, npcs: character.npcs.filter(n => n.id !== id) });
  };

  return (
    <div className="flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(['notes', 'npcs'] as const).map(t => (
          <button key={t} className={`btn-secondary ${activeSubTab === t ? 'active' : ''}`} onClick={() => setActiveSubTab(t)}>
            {t === 'notes' ? '📜 Appunti' : '🧙 NPC'}
          </button>
        ))}
      </div>

      {/* Notes */}
      {activeSubTab === 'notes' && (
        <div className="flex-col gap-4 animate-fade-in">
          <div className="section-header">
            <span className="section-title">Appunti di Sessione</span>
            <button className="btn-primary text-xs" onClick={addNote}><FaPlus /> Nuovo</button>
          </div>
          {(!character.notes || character.notes.length === 0) && (
            <p className="text-muted text-sm">Nessun appunto salvato. Crea il primo!</p>
          )}
          <div className="flex flex-wrap gap-4">
            {(character.notes || []).map(note => (
              <div key={note.id} className="card flex-col gap-2" style={{ flex: '1 1 280px' }}>
                <div className="flex justify-between items-center">
                  <input
                    value={note.title}
                    onChange={e => updateNote(note.id, 'title', e.target.value)}
                    className="input"
                    style={{ flex: 1, background: 'transparent', border: 'none', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', fontSize: '1.05rem', padding: '0' }}
                  />
                  <button className="btn-ghost" style={{ color: 'var(--accent-crimson)' }} onClick={() => deleteNote(note.id)}><FaTrash size={12}/></button>
                </div>
                <span className="text-xs text-muted">{note.date}</span>
                <textarea
                  value={note.content}
                  onChange={e => updateNote(note.id, 'content', e.target.value)}
                  className="input"
                  style={{ minHeight: 100, marginTop: 4 }}
                  placeholder="Scrivi qui..."
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NPCs */}
      {activeSubTab === 'npcs' && (
        <div className="flex-col gap-4 animate-fade-in">
          <div className="section-header">
            <span className="section-title">Personaggi Incontrati</span>
            <button className="btn-primary text-xs" onClick={addNpc}><FaPlus /> Nuovo NPC</button>
          </div>
          {(!character.npcs || character.npcs.length === 0) && (
            <p className="text-muted text-sm">Nessun NPC registrato.</p>
          )}
          <div className="flex flex-wrap gap-4">
            {(character.npcs || []).map(npc => (
              <div key={npc.id} className="card flex-col gap-2" style={{ flex: '1 1 280px' }}>
                <div className="flex justify-between items-center">
                  <input
                    value={npc.name}
                    onChange={e => updateNpc(npc.id, 'name', e.target.value)}
                    className="input"
                    style={{ flex: 1, background: 'transparent', border: 'none', fontFamily: 'var(--font-heading)', color: 'var(--accent-arcane)', fontSize: '1.05rem', padding: '0' }}
                  />
                  <button className="btn-ghost" style={{ color: 'var(--accent-crimson)' }} onClick={() => deleteNpc(npc.id)}><FaTrash size={12}/></button>
                </div>
                <div className="flex gap-2">
                  <input value={npc.role} onChange={e => updateNpc(npc.id, 'role', e.target.value)} className="input" placeholder="Ruolo" style={{ flex: 1, fontSize: '0.8rem' }} />
                  <input value={npc.relationship} onChange={e => updateNpc(npc.id, 'relationship', e.target.value)} className="input" placeholder="Relazione" style={{ flex: 1, fontSize: '0.8rem' }} />
                </div>
                <textarea value={npc.description} onChange={e => updateNpc(npc.id, 'description', e.target.value)} className="input" placeholder="Descrizione..." style={{ minHeight: 80, marginTop: 4 }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
