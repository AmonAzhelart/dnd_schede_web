import React, { useState, useMemo } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { v4 as uuidv4 } from 'uuid';
import { SKILL_PRESETS } from '../data/skillPresets';
import type { Skill } from '../types/dnd';
import { FaTimes, FaCheck } from 'react-icons/fa';

interface WizardRow {
    preset: typeof SKILL_PRESETS[number];
    included: boolean;
    classSkill: boolean;
    ranks: number;
}

const STAT_LABEL: Record<string, string> = {
    str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};
const STAT_COLOR: Record<string, string> = {
    str: '#e74c3c', dex: '#27ae60', con: '#e67e22', int: '#3498db', wis: '#9b59b6', cha: '#e91e8c',
};

export const SkillImportWizard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { character, setCharacter } = useCharacterStore();

    const [rows, setRows] = useState<WizardRow[]>(() =>
        SKILL_PRESETS.map(p => ({ preset: p, included: true, classSkill: false, ranks: 0 }))
    );
    const [filter, setFilter] = useState('');

    const existingNames = useMemo(
        () => new Set(Object.values(character?.skills ?? {}).map(s => s.name.toLowerCase())),
        [character]
    );

    // Filter out skills that already exist (by name) and apply search
    const filtered = useMemo(() =>
        rows.filter(r =>
            !existingNames.has(r.preset.name.toLowerCase()) &&
            (!filter || r.preset.name.toLowerCase().includes(filter.toLowerCase()))
        ),
        [rows, filter, existingNames]
    );

    const includedCount = rows.filter(r => r.included && !existingNames.has(r.preset.name.toLowerCase())).length;

    const setField = (name: string, field: keyof WizardRow, value: unknown) =>
        setRows(prev => prev.map(r => r.preset.name === name ? { ...r, [field]: value } : r));

    const bulkAll = () => setRows(r => r.map(x => ({ ...x, included: true })));
    const bulkNone = () => setRows(r => r.map(x => ({ ...x, included: false })));
    const bulkClass = () => setRows(r => r.map(x => ({ ...x, classSkill: x.included })));
    const bulkNoClass = () => setRows(r => r.map(x => ({ ...x, classSkill: false })));
    const bulkZeroRanks = () => setRows(r => r.map(x => ({ ...x, ranks: 0 })));

    const confirm = () => {
        if (!character) return;
        const newSkills: Record<string, Skill> = { ...character.skills };
        rows
            .filter(r => r.included && !existingNames.has(r.preset.name.toLowerCase()))
            .forEach(r => {
                const slug = r.preset.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                const id = slug + '_' + uuidv4().slice(0, 4);
                newSkills[id] = {
                    id,
                    name: r.preset.name,
                    stat: r.preset.stat,
                    ranks: r.ranks,
                    classSkill: r.classSkill,
                    armorCheckPenalty: r.preset.armorCheckPenalty,
                    canUseUntrained: r.preset.canUseUntrained,
                };
            });
        setCharacter({ ...character, skills: newSkills });
        onClose();
    };

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        color: 'inherit',
        padding: '2px 6px',
        fontSize: '0.82rem',
        textAlign: 'center',
        width: '100%',
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: 'var(--bg-base)',
                border: '1px solid rgba(201,168,76,0.3)',
                borderRadius: 8,
                width: 'min(860px, 96vw)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            }}>

                {/* ── HEADER ── */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: 'var(--accent-gold)', marginRight: 4 }}>
                        Importa Abilità Preset
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 8px', borderRadius: 10 }}>
                        {includedCount} selezionate
                    </span>
                    <div style={{ flex: 1 }} />
                    {/* Search */}
                    <input
                        value={filter} onChange={e => setFilter(e.target.value)}
                        placeholder="Cerca abilità…"
                        style={{ ...inputStyle, width: 140, padding: '4px 8px', fontSize: '0.8rem' }}
                    />
                    {/* Bulk buttons */}
                    {[
                        { label: 'Tutte', fn: bulkAll },
                        { label: 'Nessuna', fn: bulkNone },
                    ].map(({ label, fn }) => (
                        <button key={label} onClick={fn}
                            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer', padding: '3px 9px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {label}
                        </button>
                    ))}
                    <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' }}>|</span>
                    <button onClick={bulkClass}
                        style={{ background: 'none', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 4, cursor: 'pointer', padding: '3px 9px', fontSize: '0.7rem', color: 'var(--accent-gold)' }}>
                        Tutte di classe
                    </button>
                    <button onClick={bulkNoClass}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer', padding: '3px 9px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Nessuna di classe
                    </button>
                    <button onClick={bulkZeroRanks}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer', padding: '3px 9px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Azzera gradi
                    </button>
                    <button onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 5px', marginLeft: 4 }}>
                        <FaTimes />
                    </button>
                </div>

                {/* ── COLUMN HEADERS ── */}
                <div style={{
                    padding: '5px 16px',
                    display: 'grid',
                    gridTemplateColumns: '26px 1fr 52px 34px 80px 70px',
                    gap: 6,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em',
                }}>
                    <span>INC.</span>
                    <span>NOME</span>
                    <span style={{ textAlign: 'center' }}>STAT</span>
                    <span style={{ textAlign: 'center' }} title="Utilizzabile senza gradi">⚬ GRADO</span>
                    <span style={{ textAlign: 'center' }}>DI CLASSE</span>
                    <span style={{ textAlign: 'center' }}>GRADI</span>
                </div>

                {/* ── ROWS ── */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {filter ? 'Nessuna abilità trovata.' : 'Tutte le abilità preset sono già presenti nel personaggio.'}
                        </div>
                    )}
                    {filtered.map((row, idx) => {
                        const color = STAT_COLOR[row.preset.stat];
                        return (
                            <div key={row.preset.name}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '26px 1fr 52px 34px 80px 70px',
                                    gap: 6,
                                    padding: '4px 16px',
                                    alignItems: 'center',
                                    borderBottom: '1px solid rgba(255,255,255,0.025)',
                                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'transparent',
                                    opacity: row.included ? 1 : 0.35,
                                    transition: 'opacity 0.12s',
                                }}>
                                {/* Include */}
                                <input type="checkbox" checked={row.included}
                                    onChange={e => setField(row.preset.name, 'included', e.target.checked)}
                                    style={{ cursor: 'pointer' }} />

                                {/* Name */}
                                <span style={{ fontSize: '0.83rem' }}>{row.preset.name}</span>

                                {/* Stat badge */}
                                <span style={{
                                    fontSize: '0.68rem', padding: '1px 5px', borderRadius: 3,
                                    textAlign: 'center',
                                    background: `${color}22`, color, border: `1px solid ${color}44`,
                                }}>
                                    {STAT_LABEL[row.preset.stat]}
                                </span>

                                {/* Untrained dot */}
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: row.preset.canUseUntrained ? 'var(--accent-success)' : 'rgba(255,255,255,0.12)',
                                        boxShadow: row.preset.canUseUntrained ? '0 0 5px var(--accent-success)' : 'none',
                                    }} title={row.preset.canUseUntrained ? 'Utilizzabile senza gradi' : 'Richiede almeno 1 grado'} />
                                </div>

                                {/* Class skill */}
                                <div style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={row.classSkill}
                                        onChange={e => setField(row.preset.name, 'classSkill', e.target.checked)}
                                        disabled={!row.included}
                                        style={{ cursor: row.included ? 'pointer' : 'not-allowed', accentColor: 'var(--accent-gold)' }} />
                                </div>

                                {/* Ranks */}
                                <input type="number" min={0} max={20} value={row.ranks}
                                    onChange={e => setField(row.preset.name, 'ranks', Math.max(0, Math.min(20, +e.target.value)))}
                                    disabled={!row.included}
                                    style={{ ...inputStyle, opacity: row.included ? 1 : 0.4 }} />
                            </div>
                        );
                    })}
                </div>

                {/* ── FOOTER ── */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                        ● = utilizzabile senza gradi &nbsp;|&nbsp; Le abilità già presenti nel personaggio sono escluse
                    </span>
                    <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.82rem' }}>Annulla</button>
                    <button onClick={confirm} className="btn-primary" style={{ fontSize: '0.82rem' }} disabled={includedCount === 0}>
                        <FaCheck size={10} /> Conferma e Carica ({includedCount})
                    </button>
                </div>

            </div>
        </div>
    );
};
