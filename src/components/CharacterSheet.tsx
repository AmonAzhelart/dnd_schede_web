import React, { useState } from 'react';
import { useCharacterStore } from '../store/characterStore';
import type { CustomAttack } from '../types/dnd';
import { FaHeart, FaStar, FaPlus, FaMinus, FaEdit, FaSearch, FaPalette, FaCheck, FaTrash } from 'react-icons/fa';
import { GiSwordman, GiAxeSword, GiSpellBook, GiTreasureMap, GiAbstract024, GiUpgrade } from 'react-icons/gi';
import { Inventory } from './Inventory';
import { Spellbook } from './Spellbook';
import { AbilitiesPage, type AbilitySubTab } from './AbilitiesPage';
import { SkillModal } from './SkillModal';
import { SkillImportWizard } from './SkillImportWizard';
import { SkeletonSheet } from './Skeleton';
import { OverviewDashboard } from './dashboard/OverviewDashboard';
import { LevelsTab } from './LevelsTab';
import './CharacterSheetHeader.css';

type SheetTab = 'overview' | 'combat' | 'levels' | 'skills' | 'inventory' | 'abilities' | 'spells';

const STAT_NAMES: Record<string, string> = {
  str: 'Forza', dex: 'Destrezza', con: 'Costituzione',
  int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma'
};

export const CharacterSheet: React.FC = () => {
  const { character, setCharacter, getEffectiveStat, getStatModifier, getSkillBreakdown, updateSkill, deleteSkill,
    getTotalBab, getMultipleAttacks } = useCharacterStore();
  const [activeTab, setActiveTab] = useState<SheetTab>('overview');
  const [abilitiesInitialTab, setAbilitiesInitialTab] = useState<AbilitySubTab | undefined>(undefined);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillEditForm, setSkillEditForm] = useState<import('../types/dnd').Skill | null>(null);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState<'all' | 'class' | 'trained' | 'untrained'>('all');
  const [showUnusable, setShowUnusable] = useState(true);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [dashEditMode, setDashEditMode] = useState(false);

  // ─── Custom Attacks state ────────────────────────────────────────
  type CAForm = Omit<CustomAttack, 'id'>;
  const emptyCA = (): CAForm => ({
    name: '', attackStat: 'cha', useBab: false, attackBonusExtra: 0,
    damageDice: '1d10', damageStat: undefined, damageBonusExtra: 0,
    damageType: 'forza', criticalRange: '20', criticalMultiplier: '×2',
    range: '18m', linkedFeatureIds: [], notes: '',
  });
  const [showCAForm, setShowCAForm] = useState(false);
  const [editingCAId, setEditingCAId] = useState<string | null>(null);
  const [caForm, setCAForm] = useState<CAForm>(emptyCA());

  if (!character) return <SkeletonSheet />;

  const maxHp = character.hpDetails?.max ?? getEffectiveStat('hp');
  const currentHp = character.hpDetails?.current ?? character.baseStats.hp;
  const hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  const tabs: { id: SheetTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Panoramica', icon: <GiSwordman /> },
    { id: 'combat', label: 'Combattimento', icon: <GiAxeSword /> },
    { id: 'levels', label: 'Livelli', icon: <GiUpgrade /> },
    { id: 'skills', label: 'Abilità', icon: <FaStar /> },
    { id: 'inventory', label: 'Inventario', icon: <GiTreasureMap /> },
    { id: 'abilities', label: 'Privilegi di Classe', icon: <GiAbstract024 /> },
    { id: 'spells', label: 'Grimorio', icon: <GiSpellBook /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }} className="animate-fade-in">
      {/* ─── STICKY HEADER + TABS ───────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '0.5rem 0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* ─── CHARACTER HEADER ─────────────────────────── */}
        {(() => {
          const totalClassLevel = (character.classLevels ?? []).reduce((s, cl) => s + cl.level, 0);
          const displayLevel = totalClassLevel > 0 ? totalClassLevel : character.level;
          const classDisplay = (character.classLevels ?? []).length > 0
            ? (character.classLevels ?? []).map(cl => cl.className || '?').filter(Boolean).join(' / ') || character.characterClass
            : character.characterClass;
          const totalBab = getTotalBab();
          const initMod = getStatModifier('dex');
          const hpClass = hpPercent < 25 ? 'crit' : hpPercent < 50 ? 'low' : '';
          return (
            <div className="cs-header">
              <div className="cs-avatar">{character.name.charAt(0).toUpperCase()}</div>

              <div className="cs-identity">
                <h2 className="cs-name" title={character.name}>{character.name}</h2>
                <div className="cs-meta">
                  {character.race && <span className="cs-chip race">{character.race}</span>}
                  {classDisplay && <span className="cs-chip class">{classDisplay}</span>}
                  <span className="cs-chip level">Lv. {displayLevel}</span>
                  {character.alignment && <span className="cs-align">{character.alignment}</span>}
                </div>
              </div>

              <div className="cs-hp">
                <div className="cs-hp-label">
                  <FaHeart color="var(--accent-crimson)" size={9} />
                  PUNTI VITA
                </div>
                <div className="cs-hp-vals">
                  <span className={`cs-hp-cur ${hpClass}`}>{currentHp}</span>
                  <span className="cs-hp-sep">/</span>
                  <span className="cs-hp-max">{maxHp}</span>
                </div>
                <div className="cs-hp-bar">
                  <div className={`cs-hp-bar-fill ${hpClass}`} style={{ width: `${hpPercent}%` }} />
                </div>
              </div>

              <div className="cs-quick">
                <div className="cs-quick-cell ac">
                  <span className="cs-quick-lbl">CA</span>
                  <span className="cs-quick-val">{getEffectiveStat('ac')}</span>
                </div>
                <div className="cs-quick-cell init">
                  <span className="cs-quick-lbl">INIZ</span>
                  <span className="cs-quick-val">{initMod >= 0 ? '+' : ''}{initMod}</span>
                </div>
                <div className="cs-quick-cell speed">
                  <span className="cs-quick-lbl">VEL</span>
                  <span className="cs-quick-val">{character.baseStats.speed}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>ft</span></span>
                </div>
                <div className="cs-quick-cell bab">
                  <span className="cs-quick-lbl">BAB</span>
                  <span className="cs-quick-val">{totalBab >= 0 ? '+' : ''}{totalBab}</span>
                </div>
              </div>

              <div className="cs-actions">
                <button
                  className={`cs-action-btn ${headerEditing ? 'active' : ''}`}
                  title={headerEditing ? 'Chiudi modifica' : 'Modifica dati personaggio'}
                  onClick={() => setHeaderEditing(v => !v)}
                  aria-label="Modifica"
                >
                  <FaEdit size={13} />
                </button>
                {activeTab === 'overview' && (
                  <button
                    className={`cs-action-btn ${dashEditMode ? 'active' : ''}`}
                    title={dashEditMode ? 'Termina personalizzazione' : 'Personalizza dashboard'}
                    onClick={() => setDashEditMode(v => !v)}
                    aria-label="Personalizza"
                  >
                    {dashEditMode ? <FaCheck size={12} /> : <FaPalette size={12} />}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ─── INLINE HEADER EDIT DRAWER ─── */}
        {headerEditing && (() => {
          const baseMaxHp = character.hpDetails?.max ?? getEffectiveStat('hp');
          const baseCurHp = character.hpDetails?.current ?? character.baseStats.hp;
          const setHp = (cur: number, max: number) => setCharacter({
            ...character,
            hpDetails: { ...(character.hpDetails ?? {}), current: Math.min(cur, max), max },
          });
          const setStat = (k: import('../types/dnd').StatType, v: number) => setCharacter({
            ...character,
            baseStats: { ...character.baseStats, [k]: v },
          });
          const STATS: { k: import('../types/dnd').StatType; lbl: string }[] = [
            { k: 'str', lbl: 'FOR' }, { k: 'dex', lbl: 'DES' }, { k: 'con', lbl: 'COS' },
            { k: 'int', lbl: 'INT' }, { k: 'wis', lbl: 'SAG' }, { k: 'cha', lbl: 'CAR' },
          ];
          return (
            <div className="cs-drawer-wrap">
              <div className="cs-drawer">
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">Nome</span>
                  <input className="input" value={character.name}
                    onChange={e => setCharacter({ ...character, name: e.target.value })} />
                </div>
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">Razza</span>
                  <input className="input" value={character.race}
                    onChange={e => setCharacter({ ...character, race: e.target.value })} />
                </div>
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">Allineamento</span>
                  <input className="input" value={character.alignment}
                    onChange={e => setCharacter({ ...character, alignment: e.target.value })} />
                </div>
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">PV Max</span>
                  <input className="input" type="number" min={1}
                    value={baseMaxHp}
                    onChange={e => setHp(baseCurHp, Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">PV Attuali</span>
                  <input className="input" type="number"
                    value={baseCurHp}
                    onChange={e => setHp(parseInt(e.target.value) || 0, baseMaxHp)} />
                </div>
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">Velocità (ft)</span>
                  <input className="input" type="number" min={0} step={5}
                    value={character.baseStats.speed}
                    onChange={e => setCharacter({ ...character, baseStats: { ...character.baseStats, speed: Math.max(0, parseInt(e.target.value) || 0) } })} />
                </div>
                {STATS.map(({ k, lbl }) => (
                  <div key={k} className="cs-drawer-field">
                    <span className="cs-drawer-label">{lbl}</span>
                    <input className="input" type="number" min={1}
                      value={character.baseStats[k] ?? 10}
                      onChange={e => setStat(k, Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                ))}
              </div>
              <div className="cs-drawer-foot">
                <span className="cs-drawer-foot-info">
                  Classi &amp; BAB — totale: <strong>+{getTotalBab()}</strong>{' '}
                  {(character.classLevels ?? []).length > 0 && (
                    <span className="muted">
                      ({(character.classLevels ?? []).map(cl => `${cl.className || '?'} ${cl.level}`).join(' / ')})
                    </span>
                  )}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                  onClick={() => { setActiveTab('levels'); setHeaderEditing(false); }}
                >
                  Gestisci livelli →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ─── TABS ─────────────────────────────────────── */}
        <div className="cs-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`cs-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              {tab.icon} <span className="cs-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>{/* end sticky header+tabs */}

      {/* ─── CONTENT AREA ───────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 0.75rem' }}>

        {/* ─── SIMPLE SCROLL TABS (overview / combat / skills) ─── */}
        {(activeTab === 'overview' || activeTab === 'combat' || activeTab === 'skills' || activeTab === 'levels') && (
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: '1rem', paddingBottom: '2rem' }}>

            {activeTab === 'levels' && <LevelsTab />}

            {/* ─── TAB: OVERVIEW (CUSTOM DASHBOARD) ────────── */}
            {activeTab === 'overview' && (
              <OverviewDashboard goTo={(t) => {
                // Legacy compatibility: map old tab names to the new merged 'abilities' tab.
                if (t === 'feats') { setAbilitiesInitialTab('feats'); setActiveTab('abilities'); return; }
                if (t === 'classfeatures') { setAbilitiesInitialTab('active'); setActiveTab('abilities'); return; }
                if (t.startsWith('abilities:')) {
                  setAbilitiesInitialTab(t.slice('abilities:'.length) as AbilitySubTab);
                  setActiveTab('abilities');
                  return;
                }
                setActiveTab(t as SheetTab);
              }} editMode={dashEditMode} setEditMode={setDashEditMode} />
            )}

            {/* ─── TAB: COMBAT ──────────────────────────────── */}
            {activeTab === 'combat' && (
              <div className="animate-fade-in flex-col gap-4">

                {/* ── BAB Breakdown card ─────────────────────── */}
                {(() => {
                  const totalBab = getTotalBab();
                  const strMod = getStatModifier('str');
                  const dexMod = getStatModifier('dex');
                  const meleeAttacks = getMultipleAttacks(strMod);
                  const rangedAttacks = getMultipleAttacks(dexMod);
                  const fmtList = (arr: number[]) => arr.map(v => (v >= 0 ? `+${v}` : `${v}`)).join('/');
                  const classLevels = character.classLevels ?? [];
                  const PROG_LABEL: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Bassa' };
                  return (
                    <div className="card" style={{ padding: '0.7rem 1rem', background: 'rgba(0,0,0,0.22)', display: 'flex', flexWrap: 'wrap', gap: '1.2rem', alignItems: 'flex-start' }}>
                      {/* BAB sources */}
                      <div>
                        <div style={{ fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Bonus Attacco Base</div>
                        {classLevels.length > 0 ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {classLevels.map((cl, i) => {
                              const clBab = cl.babProgression === 'high' ? cl.level
                                : cl.babProgression === 'medium' ? Math.floor(cl.level * 3 / 4)
                                  : Math.floor(cl.level / 2);
                              return (
                                <span key={cl.id}>
                                  {i > 0 && <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>+</span>}
                                  <span style={{ color: 'var(--text-primary)' }}>{cl.className || '?'}</span>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> {cl.level} ({PROG_LABEL[cl.babProgression]})</span>
                                  <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-heading)', marginLeft: 3 }}>+{clBab}</span>
                                </span>
                              );
                            })}
                            <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>=</span>
                            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-gold)' }}>+{totalBab}</span>
                          </div>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--accent-gold)' }}>+{totalBab}</span>
                        )}
                      </div>
                      {/* Melee */}
                      <div>
                        <div style={{ fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>TC in Mischia</div>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-crimson)' }}>{fmtList(meleeAttacks)}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 5 }}>BAB {totalBab >= 0 ? '+' : ''}{totalBab} + FOR {strMod >= 0 ? '+' : ''}{strMod}</span>
                      </div>
                      {/* Ranged */}
                      <div>
                        <div style={{ fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>TC a Distanza</div>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--accent-ice)' }}>{fmtList(rangedAttacks)}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 5 }}>BAB {totalBab >= 0 ? '+' : ''}{totalBab} + DES {dexMod >= 0 ? '+' : ''}{dexMod}</span>
                      </div>
                      {meleeAttacks.length > 1 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-arcane)', alignSelf: 'center' }}>
                          ⚡ {meleeAttacks.length} attacchi per round
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="section-header">
                  <span className="section-title">Armi Equipaggiate</span>
                </div>
                {character.inventory.filter(i => i.equipped && i.type === 'weapon').length === 0 && (
                  <p className="text-muted text-sm" style={{ padding: '0.5rem 0' }}>Nessuna arma equipaggiata. Vai nell'inventario e premi "Equipaggia".</p>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        {['Arma', 'Bonus Att.', 'Attacchi', 'Danni', 'Tipo', 'Critico', 'Gittata', 'Note'].map(h => (
                          <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 'normal', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {character.inventory
                        .filter(i => i.equipped && i.type === 'weapon')
                        .map(w => {
                          const isRanged = !!(w.weaponDetails?.rangeIncrement);
                          const abilityMod = isRanged ? getStatModifier('dex') : getStatModifier('str');
                          const weaponBonus = w.weaponDetails?.attackBonus ?? 0;
                          const attacks = getMultipleAttacks(abilityMod + weaponBonus);
                          const fmtA = (arr: number[]) => arr.map(v => (v >= 0 ? `+${v}` : `${v}`)).join('/');
                          const primaryBonus = attacks[0];
                          return (
                            <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-primary)', fontWeight: 500 }}>{w.name}</td>
                              <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)' }}>{primaryBonus >= 0 ? '+' : ''}{primaryBonus}</td>
                              <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-heading)', fontSize: '0.82rem', color: attacks.length > 1 ? 'var(--accent-arcane)' : 'var(--text-muted)' }}>{fmtA(attacks)}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-secondary)' }}>{w.weaponDetails?.damage ?? '—'}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{w.weaponDetails?.damageType ?? '—'}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {w.weaponDetails ? `${w.weaponDetails.criticalRange ? w.weaponDetails.criticalRange + '/' : ''}×${w.weaponDetails.criticalMultiplier.replace('x', '').replace('×', '')}` : '—'}
                              </td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{w.weaponDetails?.rangeIncrement || 'Mischia'}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{w.weaponDetails?.notes || '—'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {character.inventory.filter(i => i.equipped && (i.type === 'armor' || i.type === 'shield' || i.type === 'protectiveItem')).length > 0 && (
                  <>
                    <div className="section-header" style={{ marginTop: '0.5rem' }}>
                      <span className="section-title">Protezioni Equipaggiate</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            {['Protezione', 'Bonus CA', 'Max Des', 'Penalità', 'Incant.%', 'Tipo'].map(h => (
                              <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 'normal', letterSpacing: '0.08em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {character.inventory
                            .filter(i => i.equipped && (i.type === 'armor' || i.type === 'shield' || i.type === 'protectiveItem'))
                            .map(a => (
                              <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-primary)', fontWeight: 500 }}>{a.name}</td>
                                <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)' }}>+{a.armorDetails?.armorBonus ?? 0}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{a.armorDetails?.maxDex ?? '—'}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: a.armorDetails?.checkPenalty ? 'var(--accent-crimson)' : 'var(--text-muted)' }}>{a.armorDetails?.checkPenalty ?? 0}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{a.armorDetails?.spellFailure ? `${a.armorDetails.spellFailure}%` : '—'}</td>
                                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{a.armorDetails?.armorType ?? a.type}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ─── CUSTOM ATTACKS ──────────────────────────────────────────── */}
                <div className="section-header" style={{ marginTop: '1.25rem' }}>
                  <span className="section-title">Attacchi Personalizzati</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setCAForm(emptyCA()); setEditingCAId(null); setShowCAForm(true); }}
                  >
                    <FaPlus size={10} /> Nuovo
                  </button>
                </div>

                {/* ─ FORM ─ */}
                {showCAForm && (() => {
                  const allFeatures = [
                    ...(character.classFeatures ?? []).map(f => ({ id: f.id, name: f.name, kind: 'Privilegio' as const })),
                    ...(character.feats ?? []).map(f => ({ id: f.id, name: f.name, kind: 'Talento' as const })),
                  ];
                  const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 };
                  const lbl: React.CSSProperties = { fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };
                  const statOpts: { v: string; l: string }[] = [
                    { v: '', l: 'Nessuno' }, { v: 'str', l: 'FOR' }, { v: 'dex', l: 'DES' },
                    { v: 'con', l: 'COS' }, { v: 'int', l: 'INT' }, { v: 'wis', l: 'SAG' }, { v: 'cha', l: 'CAR' },
                  ];
                  const saveCA = () => {
                    if (!caForm.name.trim()) return;
                    const attacks = [...(character.customAttacks ?? [])];
                    if (editingCAId) {
                      const idx = attacks.findIndex(a => a.id === editingCAId);
                      if (idx >= 0) attacks[idx] = { ...caForm, id: editingCAId };
                    } else {
                      attacks.push({ ...caForm, id: uuidv4() });
                    }
                    setCharacter({ ...character, customAttacks: attacks });
                    setShowCAForm(false); setEditingCAId(null);
                  };
                  return (
                    <div className="card" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.25)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                        <div style={{ ...fld, gridColumn: 'span 2' }}>
                          <span style={lbl}>Nome attacco *</span>
                          <input className="input" value={caForm.name} onChange={e => setCAForm(f => ({ ...f, name: e.target.value }))} placeholder="es. Deflagazione Occulta" style={{ fontSize: '0.85rem' }} />
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Stat per colpire</span>
                          <select className="input" value={caForm.attackStat ?? ''} onChange={e => setCAForm(f => ({ ...f, attackStat: (e.target.value as import('../types/dnd').StatType) || undefined }))} style={{ fontSize: '0.82rem' }}>
                            {statOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Bonus extra att.</span>
                          <input className="input" type="number" value={caForm.attackBonusExtra ?? 0} onChange={e => setCAForm(f => ({ ...f, attackBonusExtra: parseInt(e.target.value) || 0 }))} style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={{ ...fld, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" id="ca-bab" checked={!!caForm.useBab} onChange={e => setCAForm(f => ({ ...f, useBab: e.target.checked }))} />
                          <label htmlFor="ca-bab" style={{ ...lbl, cursor: 'pointer', letterSpacing: 0 }}>Includi BAB</label>
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Dadi danno</span>
                          <input className="input" value={caForm.damageDice} onChange={e => setCAForm(f => ({ ...f, damageDice: e.target.value }))} placeholder="es. 1d10" style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Stat per danno</span>
                          <select className="input" value={caForm.damageStat ?? ''} onChange={e => setCAForm(f => ({ ...f, damageStat: (e.target.value as import('../types/dnd').StatType) || undefined }))} style={{ fontSize: '0.82rem' }}>
                            {statOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Bonus extra danno</span>
                          <input className="input" type="number" value={caForm.damageBonusExtra ?? 0} onChange={e => setCAForm(f => ({ ...f, damageBonusExtra: parseInt(e.target.value) || 0 }))} style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Tipo danno</span>
                          <input className="input" value={caForm.damageType} onChange={e => setCAForm(f => ({ ...f, damageType: e.target.value }))} placeholder="es. forza" style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Critico (range)</span>
                          <input className="input" value={caForm.criticalRange ?? ''} onChange={e => setCAForm(f => ({ ...f, criticalRange: e.target.value }))} placeholder="es. 20" style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Critico (mult.)</span>
                          <input className="input" value={caForm.criticalMultiplier ?? ''} onChange={e => setCAForm(f => ({ ...f, criticalMultiplier: e.target.value }))} placeholder="es. ×2" style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={fld}>
                          <span style={lbl}>Gittata</span>
                          <input className="input" value={caForm.range ?? ''} onChange={e => setCAForm(f => ({ ...f, range: e.target.value }))} placeholder="es. 18m" style={{ fontSize: '0.82rem' }} />
                        </div>
                        <div style={{ ...fld, gridColumn: 'span 2' }}>
                          <span style={lbl}>Note</span>
                          <input className="input" value={caForm.notes ?? ''} onChange={e => setCAForm(f => ({ ...f, notes: e.target.value }))} placeholder="Note aggiuntive..." style={{ fontSize: '0.82rem' }} />
                        </div>
                      </div>
                      {allFeatures.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={lbl}>Privilegi / Talenti collegati (informativo)</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                            {allFeatures.map(f => {
                              const linked = (caForm.linkedFeatureIds ?? []).includes(f.id);
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setCAForm(ff => ({
                                    ...ff,
                                    linkedFeatureIds: linked
                                      ? (ff.linkedFeatureIds ?? []).filter(id => id !== f.id)
                                      : [...(ff.linkedFeatureIds ?? []), f.id],
                                  }))}
                                  style={{
                                    padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', cursor: 'pointer',
                                    border: `1px solid ${linked ? 'var(--accent-arcane)' : 'rgba(255,255,255,0.12)'}`,
                                    background: linked ? 'rgba(155,89,182,0.25)' : 'rgba(255,255,255,0.04)',
                                    color: linked ? 'var(--accent-arcane)' : 'var(--text-muted)',
                                  }}
                                >
                                  {f.kind === 'Privilegio' ? '⚡' : '★'} {f.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowCAForm(false); setEditingCAId(null); }}>Annulla</button>
                        <button className="btn btn-primary btn-sm" onClick={saveCA} disabled={!caForm.name.trim()}>Salva</button>
                      </div>
                    </div>
                  );
                })()}

                {/* ─ TABLE ─ */}
                {(character.customAttacks ?? []).length === 0 && !showCAForm ? (
                  <p className="text-muted text-sm" style={{ padding: '0.4rem 0' }}>Nessun attacco personalizzato. Premi "Nuovo" per aggiungerne uno.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          {['Attacco', 'Bonus Att.', 'Danni', 'Tipo', 'Critico', 'Gittata', 'Collegati', 'Note', ''].map(h => (
                            <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontFamily: 'var(--font-heading)', fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 'normal', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(character.customAttacks ?? []).map(atk => {
                          const atkBonus = (atk.useBab ? (character.baseStats.bab || 0) : 0)
                            + (atk.attackStat ? getStatModifier(atk.attackStat) : 0)
                            + (atk.attackBonusExtra ?? 0);
                          const dmgExtra = (atk.damageStat ? getStatModifier(atk.damageStat) : 0) + (atk.damageBonusExtra ?? 0);
                          const dmgDisplay = dmgExtra !== 0
                            ? `${atk.damageDice} ${dmgExtra >= 0 ? '+' : ''}${dmgExtra}`
                            : atk.damageDice;
                          const linkedNames = (atk.linkedFeatureIds ?? []).map(id => {
                            const f = [...(character.classFeatures ?? []), ...(character.feats ?? [])].find(x => x.id === id);
                            return f?.name ?? null;
                          }).filter(Boolean) as string[];
                          return (
                            <tr key={atk.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-primary)', fontWeight: 500 }}>{atk.name}</td>
                              <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)' }}>{atkBonus >= 0 ? '+' : ''}{atkBonus}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-secondary)' }}>{dmgDisplay}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{atk.damageType}</td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {atk.criticalRange && atk.criticalMultiplier ? `${atk.criticalRange}/${atk.criticalMultiplier}` : atk.criticalMultiplier ?? '—'}
                              </td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{atk.range || 'Mischia'}</td>
                              <td style={{ padding: '0.4rem 0.6rem', maxWidth: 160 }}>
                                {linkedNames.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                    {linkedNames.map(n => (
                                      <span key={n} style={{ padding: '1px 6px', borderRadius: 10, fontSize: '0.65rem', background: 'rgba(155,89,182,0.2)', color: 'var(--accent-arcane)', border: '1px solid rgba(155,89,182,0.3)', whiteSpace: 'nowrap' }}>{n}</span>
                                    ))}
                                  </div>
                                ) : <span className="text-muted">—</span>}
                              </td>
                              <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{atk.notes || '—'}</td>
                              <td style={{ padding: '0.4rem 0.6rem', whiteSpace: 'nowrap' }}>
                                <button className="btn-ghost" style={{ marginRight: 4, color: 'var(--accent-gold)' }} onClick={() => {
                                  setCAForm({ ...atk });
                                  setEditingCAId(atk.id);
                                  setShowCAForm(true);
                                }}><FaEdit size={12} /></button>
                                <button className="btn-ghost" style={{ color: 'var(--accent-crimson)' }} onClick={() => {
                                  setCharacter({ ...character, customAttacks: (character.customAttacks ?? []).filter(a => a.id !== atk.id) });
                                }}><FaTrash size={12} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB: SKILLS ──────────────────────────────── */}
            {activeTab === 'skills' && (
              <div className="animate-fade-in flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="section-title">Abilità ({Object.values(character.skills).length})</span>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowImportWizard(true)}>Importa preset</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setIsSkillModalOpen(true)}><FaPlus size={10} /> Nuova</button>
                  </div>
                </div>

                {/* Search + filters */}
                <div className="flex gap-2 items-center flex-wrap">
                  <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
                    <FaSearch size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      className="input"
                      placeholder="Cerca abilità..."
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                      style={{ width: '100%', padding: '4px 8px 4px 26px', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div className="flex gap-1" style={{ flexShrink: 0 }}>
                    {([
                      ['all', 'Tutte'],
                      ['class', 'Di classe'],
                      ['trained', 'Con gradi'],
                      ['untrained', 'Senza gradi'],
                    ] as const).map(([k, l]) => (
                      <button key={k} onClick={() => setSkillFilter(k)}
                        className={`btn btn-sm ${skillFilter === k ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const filteredAll = Object.values(character.skills).filter(s => {
                    if (skillSearch && !s.name.toLowerCase().includes(skillSearch.toLowerCase())) return false;
                    if (skillFilter === 'class' && !s.classSkill) return false;
                    if (skillFilter === 'trained' && s.ranks < 1) return false;
                    if (skillFilter === 'untrained' && s.ranks > 0) return false;
                    return true;
                  }).sort((a, b) => a.name.localeCompare(b.name));
                  const usableList = filteredAll.filter(s => getSkillBreakdown(s.id).usable);
                  const unusableList = filteredAll.filter(s => !getSkillBreakdown(s.id).usable);

                  const renderCard = (skill: import('../types/dnd').Skill) => {
                    const bd = getSkillBreakdown(skill.id);
                    const total = bd.total;
                    const isEditing = editingSkillId === skill.id;
                    const totalColor = !bd.usable ? 'var(--text-muted)' : total >= 5 ? 'var(--accent-gold)' : total >= 0 ? 'var(--text-primary)' : 'var(--accent-crimson)';
                    const accent = skill.classSkill ? 'var(--accent-gold)' : 'rgba(155,89,182,0.5)';
                    return (
                      <div key={skill.id} className="card" style={{
                        padding: 0,
                        opacity: bd.usable ? 1 : 0.55,
                        borderLeft: `3px solid ${accent}`,
                        display: 'flex', flexDirection: 'column',
                      }}>
                        {/* Header: name + total */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)',
                        }}>
                          {isEditing && skillEditForm ? (
                            <input className="input" style={{ flex: 1, fontSize: '0.85rem', padding: '3px 6px' }}
                              value={skillEditForm.name}
                              onChange={e => setSkillEditForm({ ...skillEditForm, name: e.target.value })} />
                          ) : (
                            <>
                              <span style={{ flex: 1, color: skill.classSkill ? 'var(--accent-gold)' : 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  onClick={() => updateSkill({ ...skill, classSkill: !skill.classSkill })}
                                  className="btn-ghost"
                                  title={skill.classSkill ? 'Abilità di classe (clicca per disattivare)' : 'Segna come abilità di classe'}
                                  style={{ padding: 2, color: skill.classSkill ? 'var(--accent-gold)' : 'var(--text-muted)' }}
                                >
                                  <FaStar size={10} />
                                </button>
                                {skill.name}
                              </span>
                              <span style={{
                                fontFamily: 'var(--font-heading)', fontSize: '1.25rem',
                                color: totalColor,
                                minWidth: 40, textAlign: 'right',
                              }} title={bd.usable ? '' : 'Abilità non utilizzabile'}>
                                {total >= 0 ? '+' : ''}{total}
                              </span>
                            </>
                          )}
                          <div className="flex gap-1 items-center">
                            {isEditing ? (
                              <>
                                <button className="btn btn-primary btn-sm" onClick={() => { if (skillEditForm) { updateSkill({ ...skillEditForm, id: skill.id }); } setEditingSkillId(null); setSkillEditForm(null); }}>✓</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSkillId(null); setSkillEditForm(null); }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button className="btn-ghost" title="Modifica" onClick={() => { setEditingSkillId(skill.id); setSkillEditForm({ ...skill }); }}><FaEdit size={11} /></button>
                                <button className="btn-ghost" title="Elimina" style={{ color: 'var(--accent-crimson)' }} onClick={() => deleteSkill(skill.id)}><FaTrash size={11} /></button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Breakdown */}
                        <div style={{ padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {/* Components row */}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.7rem' }}>
                            {/* Stat */}
                            {isEditing && skillEditForm ? (
                              <select className="input" style={{ width: 70, fontSize: '0.72rem', padding: '1px 3px' }}
                                value={skillEditForm.stat}
                                onChange={e => setSkillEditForm({ ...skillEditForm, stat: e.target.value as import('../types/dnd').StatType })}>
                                {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(s => <option key={s} value={s}>{STAT_NAMES[s]?.slice(0, 3)}</option>)}
                              </select>
                            ) : (
                              <span style={{ background: 'rgba(155,89,182,0.12)', border: '1px solid rgba(155,89,182,0.25)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-heading)', fontSize: '0.65rem' }}>
                                {STAT_NAMES[skill.stat]?.slice(0, 3) ?? skill.stat} {bd.statMod >= 0 ? '+' : ''}{bd.statMod}
                              </span>
                            )}
                            {/* Ranks */}
                            {isEditing && skillEditForm ? (
                              <input type="number" className="input" style={{ width: 48, textAlign: 'center', fontSize: '0.72rem', padding: '1px 3px' }}
                                value={skillEditForm.ranks}
                                onChange={e => setSkillEditForm({ ...skillEditForm, ranks: parseInt(e.target.value) || 0 })} />
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', borderRadius: 3, fontFamily: 'var(--font-heading)', fontSize: '0.65rem', overflow: 'hidden' }} title="Gradi spesi">
                                <button
                                  className="btn-ghost"
                                  style={{ padding: '0 4px', height: '100%', color: 'var(--text-muted)', fontSize: '0.7rem', borderRight: '1px solid rgba(255,255,255,0.06)' }}
                                  onClick={() => updateSkill({ ...skill, ranks: Math.max(0, skill.ranks - 1) })}
                                  disabled={skill.ranks <= 0}
                                  title="Riduci gradi"
                                ><FaMinus size={7} /></button>
                                <span style={{ padding: '1px 6px' }}>Gr. {skill.ranks}</span>
                                <button
                                  className="btn-ghost"
                                  style={{ padding: '0 4px', height: '100%', color: 'var(--text-muted)', fontSize: '0.7rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
                                  onClick={() => updateSkill({ ...skill, ranks: skill.ranks + 1 })}
                                  title="Aumenta gradi"
                                ><FaPlus size={7} /></button>
                              </span>
                            )}
                            {/* Class skill bonus */}
                            {bd.classBonus > 0 && (
                              <span style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--accent-gold)', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-heading)', fontSize: '0.65rem' }} title="Bonus abilità di classe">
                                Classe +{bd.classBonus}
                              </span>
                            )}
                            {/* canUseUntrained toggle */}
                            <button
                              onClick={() => updateSkill({ ...skill, canUseUntrained: !skill.canUseUntrained })}
                              className="btn-ghost"
                              style={{
                                padding: '1px 6px', borderRadius: 3, fontSize: '0.6rem', letterSpacing: '0.04em',
                                background: skill.canUseUntrained ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${skill.canUseUntrained ? 'rgba(46,204,113,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                color: skill.canUseUntrained ? '#2ecc71' : 'var(--text-muted)',
                              }}
                              title={skill.canUseUntrained ? 'Utilizzabile senza gradi (clicca per disattivare)' : 'Richiede gradi (clicca per consentire utilizzo senza gradi)'}
                            >
                              Senza gradi
                            </button>
                          </div>
                          {/* External modifier sources */}
                          {bd.sources.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                              {bd.sources.map((src, idx) => {
                                const kindColor = src.kind === 'item' ? '#3498db' : src.kind === 'feat' ? '#e67e22' : '#9b59b6';
                                const kindLbl = src.kind === 'item' ? 'Equip.' : src.kind === 'feat' ? 'Talento' : 'Privilegio';
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem' }}>
                                    <span style={{
                                      background: `${kindColor}22`, color: kindColor,
                                      border: `1px solid ${kindColor}55`,
                                      padding: '0 4px', borderRadius: 2,
                                      fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                                      flexShrink: 0,
                                    }}>{kindLbl}</span>
                                    <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={src.source}>
                                      {src.source}
                                    </span>
                                    <span style={{ color: src.value >= 0 ? 'var(--accent-gold)' : 'var(--accent-crimson)', fontFamily: 'var(--font-heading)' }}>
                                      {src.value >= 0 ? '+' : ''}{src.value}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const gridStyle: React.CSSProperties = {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 8,
                  };
                  const sectionHeader = (label: string, count: number, color: string, extra?: React.ReactNode) => (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginTop: 4, marginBottom: 2,
                      paddingBottom: 4,
                      borderBottom: `1px solid ${color}33`,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.78rem',
                        color,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>{label}</span>
                      <span style={{
                        background: `${color}22`,
                        color,
                        border: `1px solid ${color}55`,
                        padding: '0 6px',
                        borderRadius: 99,
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-heading)',
                      }}>{count}</span>
                      {extra && <div style={{ marginLeft: 'auto' }}>{extra}</div>}
                    </div>
                  );

                  return (
                    <>
                      {sectionHeader('Utilizzabili', usableList.length, 'var(--accent-gold)')}
                      {usableList.length === 0 ? (
                        <p className="text-muted text-sm" style={{ padding: '4px 0' }}>
                          Nessuna abilità utilizzabile con i filtri correnti.
                        </p>
                      ) : (
                        <div style={gridStyle}>{usableList.map(renderCard)}</div>
                      )}

                      {unusableList.length > 0 && (
                        <>
                          {sectionHeader(
                            'Non utilizzabili',
                            unusableList.length,
                            'var(--text-muted)',
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                              onClick={() => setShowUnusable(v => !v)}
                            >
                              {showUnusable ? 'Nascondi' : 'Mostra'}
                            </button>
                          )}
                          {showUnusable && (
                            <div style={gridStyle}>{unusableList.map(renderCard)}</div>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ─── COMPONENT TABS ─────────────────────────────────── */}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'abilities' && <AbilitiesPage initialTab={abilitiesInitialTab} />}
        {activeTab === 'spells' && <Spellbook />}
      </div>

      {/* ─── MODALS ──────────────────────────────────────────── */}
      {isSkillModalOpen && (
        <SkillModal onClose={() => setIsSkillModalOpen(false)} />
      )}
      {showImportWizard && (
        <SkillImportWizard onClose={() => setShowImportWizard(false)} />
      )}
    </div>
  );
};
