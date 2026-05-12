import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useCharacterStore } from '../store/characterStore';
import type { CustomAttack } from '../types/dnd';
import { RACE_PRESETS, getRaceAdjustments } from '../types/dnd';
import { FaHeart, FaStar, FaPlus, FaMinus, FaEdit, FaSearch, FaPalette, FaCheck, FaTrash, FaCamera, FaDragon } from 'react-icons/fa';
import { GiSwordman, GiAxeSword, GiSpellBook, GiTreasureMap, GiAbstract024, GiUpgrade } from 'react-icons/gi';
import { Inventory } from './Inventory';
import { Spellbook } from './Spellbook';
import { AbilitiesPage, type AbilitySubTab } from './AbilitiesPage';
import { SkillModal } from './SkillModal';
import { SkillImportWizard } from './SkillImportWizard';
import { SkeletonSheet } from './Skeleton';
import { OverviewDashboard } from './dashboard/OverviewDashboard';
import { WidgetJumpRail } from './dashboard/WidgetJumpRail';
import { setWidgetJumpTrigger } from './dashboard/widgetJumpBridge';
import { LevelsTab } from './LevelsTab';
import { ModifiersWidget } from './dashboard/widgets/ModifiersWidget';
import { useModifierAura, ModifierArrows } from './dashboard/widgets/ModifierAura';
import { resolveStatOverride } from '../services/modifiers';
import { useMediaQuery } from './mobile/MobileShell';
import { setMobileContextActions, setMobileAvatarTapOverride, setMobileEditExit } from './mobile/mobileShellSlots';
import { BestiaryPage } from './BestiaryPage';
import { SkillsTab } from './SkillsTab';
import { BottomDrawer } from './ui/BottomDrawer';
import './CharacterSheetHeader.css';
import './dashboard/widgets/styles/modifiers.css';
import './SkillsTab.css';

type SheetTab = 'overview' | 'combat' | 'levels' | 'skills' | 'inventory' | 'abilities' | 'spells' | 'bestiary';

const STAT_NAMES: Record<string, string> = {
  str: 'Forza', dex: 'Destrezza', con: 'Costituzione',
  int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma'
};

/**
 * Read a user-picked image and return a data URL whose largest side is `<= maxSize`.
 * Keeps avatars small enough to fit comfortably in a Firestore document.
 */
const downscaleImage = (file: File, maxSize: number): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('read-failed'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('decode-failed'));
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas-ctx')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        reject(e as Error);
      }
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

export const CharacterSheet: React.FC = () => {
  const { t } = useTranslation();
  const { character, setCharacter, getEffectiveStat, getStatModifier, getSkillBreakdown, updateSkill, deleteSkill,
    getTotalBab, getMultipleAttacks, getTotalMaxHp, setLevelAdjustment, setRaceHitDice } = useCharacterStore();
  const [activeTab, setActiveTab] = useState<SheetTab>('overview');
  const [combatSubTab, setCombatSubTab] = useState<'attacks' | 'modifiers'>('attacks');
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
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 900px)');

  // Live portal target for the sheet inner-tabs row inside the bottom shell.
  const tabsSlot = isMobile ? (typeof document !== 'undefined' ? document.getElementById('mobile-shell-tabs-slot') : null) : null;
  // Force a re-render once after mount so the slot resolves even if the shell
  // mounts after this component on the first paint.
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (isMobile && !tabsSlot) {
      const t = setTimeout(() => forceUpdate(x => x + 1), 0);
      return () => clearTimeout(t);
    }
  }, [isMobile, tabsSlot]);

  // -- Push context actions into the mobile avatar popup ---------------
  // Desktop keeps them inline in the header; on small screens they live
  // under "Azioni rapide" inside the popup that opens on avatar tap.
  useEffect(() => {
    if (!isMobile) {
      setMobileContextActions([]);
      return;
    }
    const acts = [
      {
        id: 'edit-header',
        label: headerEditing ? t('sheet.closeEdit') : t('sheet.editCharacter'),
        icon: <FaEdit size={13} />,
        onClick: () => setHeaderEditing(v => !v),
        active: headerEditing,
      },
    ];
    if (activeTab === 'overview') {
      acts.push({
        id: 'edit-dash',
        label: dashEditMode ? t('sheet.endCustomize') : t('sheet.customizeDashboard'),
        icon: dashEditMode ? <FaCheck size={12} /> : <FaPalette size={12} />,
        onClick: () => setDashEditMode(v => !v),
        active: dashEditMode,
      });
    }
    setMobileContextActions(acts);
    return () => setMobileContextActions([]);
  }, [isMobile, headerEditing, dashEditMode, activeTab]);

  // -- Mobile: while the header edit drawer is open, redirect avatar
  //    taps to the file picker so the user can change the photo. The
  //    new image is saved back to the character (and persisted by the
  //    autosave effect in App.tsx).
  useEffect(() => {
    if (!isMobile || !headerEditing) {
      setMobileAvatarTapOverride(null);
      setMobileEditExit(null);
      return;
    }
    setMobileAvatarTapOverride(() => avatarInputRef.current?.click());
    setMobileEditExit(() => setHeaderEditing(false));
    return () => {
      setMobileAvatarTapOverride(null);
      setMobileEditExit(null);
    };
  }, [isMobile, headerEditing]);

  // --- Custom Attacks state ----------------------------------------
  type CAForm = Omit<CustomAttack, 'id'>;
  const emptyCA = (): CAForm => ({
    name: '', attackStat: 'cha', useBab: false, attackBonusExtra: 0,
    damageDice: '1d10', damageStat: undefined, damageBonusExtra: 0,
    damageType: 'forza', criticalRange: '20', criticalMultiplier: '�2',
    range: '18m', linkedFeatureIds: [], notes: '',
  });
  const [showCAForm, setShowCAForm] = useState(false);
  const [editingCAId, setEditingCAId] = useState<string | null>(null);
  const [caForm, setCAForm] = useState<CAForm>(emptyCA());

  // --- Active modifier auras for the hero header tiles ----------------
  const heroHpAura = useModifierAura('hp');
  const heroAcAura = useModifierAura('ac');
  const heroInitAura = useModifierAura('initiative');
  const heroSpeedAura = useModifierAura('speed');
  const heroBabAura = useModifierAura('bab');

  if (!character) return <SkeletonSheet />;

  const classMaxHp = getTotalMaxHp();
  const maxHp = classMaxHp > 0 ? classMaxHp : (character.hpDetails?.max ?? getEffectiveStat('hp'));
  const currentHp = character.hpDetails?.current ?? character.baseStats.hp;
  const hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  const tabs: { id: SheetTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('sheet.tabs.overview'), icon: <GiSwordman /> },
    { id: 'combat', label: t('sheet.tabs.combat'), icon: <GiAxeSword /> },
    { id: 'levels', label: t('sheet.tabs.levels'), icon: <GiUpgrade /> },
    { id: 'skills', label: t('sheet.tabs.skills'), icon: <FaStar /> },
    { id: 'inventory', label: t('sheet.tabs.inventory'), icon: <GiTreasureMap /> },
    { id: 'abilities', label: t('sheet.tabs.abilities'), icon: <GiAbstract024 /> },
    { id: 'spells', label: t('sheet.tabs.spells'), icon: <GiSpellBook /> },
    { id: 'bestiary', label: t('sheet.tabs.bestiary'), icon: <FaDragon /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }} className="animate-fade-in">
      {/* --- STICKY HEADER + TABS ----------------------------- */}
      <div style={{ flexShrink: 0, padding: '0.5rem 0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* --- CHARACTER HEADER --------------------------- */}
        {(() => {
          const totalClassLevel = (character.classLevels ?? []).reduce((s, cl) => s + cl.level, 0);
          const displayLevel = totalClassLevel > 0 ? totalClassLevel : character.level;
          const classDisplay = (character.classLevels ?? []).length > 0
            ? (character.classLevels ?? []).map(cl => cl.className || '?').filter(Boolean).join(' / ') || character.characterClass
            : character.characterClass;
          const totalBab = getTotalBab();
          const initMod = getEffectiveStat('initiative');
          const hpClass = hpPercent < 25 ? 'crit' : hpPercent < 50 ? 'low' : '';
          return (
            <div className="cs-header">
              <button
                type="button"
                className={'cs-avatar' + (character.avatarUrl ? ' has-image' : '')}
                onClick={() => avatarInputRef.current?.click()}
                title={character.avatarUrl ? 'Cambia immagine' : 'Aggiungi immagine'}
                aria-label="Modifica avatar"
              >
                {character.avatarUrl ? (
                  <img src={character.avatarUrl} alt={character.name} className="cs-avatar-img" />
                ) : (
                  <span className="cs-avatar-initial">{character.name.charAt(0).toUpperCase()}</span>
                )}
                <span className="cs-avatar-overlay" aria-hidden>
                  <FaCamera size={12} />
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const dataUrl = await downscaleImage(file, 320);
                    setCharacter({ ...character, avatarUrl: dataUrl });
                  } catch {
                    /* ignore failures � user can retry or paste a URL in the drawer */
                  }
                }}
              />

              <div className="cs-identity">
                <h2 className="cs-name" title={character.name}>{character.name}</h2>
                <div className="cs-meta">
                  {character.race && <span className="cs-chip race">{character.race}</span>}
                  {classDisplay && <span className="cs-chip class">{classDisplay}</span>}
                  <span className="cs-chip level">Lv. {displayLevel}</span>
                  {character.alignment && <span className="cs-align">{character.alignment}</span>}
                </div>
              </div>

              <div className={'cs-hp' + (heroHpAura.auraClass ? ' ' + heroHpAura.auraClass : '')}>
                <div className="cs-hp-label">
                  <FaHeart color="var(--accent-crimson)" size={9} />
                  PUNTI VITA
                </div>
                <div className="cs-hp-vals">
                  <span className={`cs-hp-cur ${hpClass}`}>{currentHp}</span>
                  <span className="cs-hp-sep">/</span>
                  <span className="cs-hp-max">{maxHp}</span>
                  {(() => {
                    const baseTemp = character.hpDetails?.tempHp ?? 0;
                    const modBonus = heroHpAura.delta > 0 ? heroHpAura.delta : 0;
                    const total = baseTemp + modBonus;
                    return total > 0 ? <span className="cs-hp-bonus">+{total}</span> : null;
                  })()}
                </div>
                <div className="cs-hp-bar">
                  <div className={`cs-hp-bar-fill ${hpClass}`} style={{ width: `${hpPercent}%` }} />
                </div>
                {heroHpAura.delta !== 0 && <ModifierArrows delta={heroHpAura.delta} count={3} />}
              </div>

              <div className="cs-quick">
                <div className={'cs-quick-cell ac' + (heroAcAura.auraClass ? ' ' + heroAcAura.auraClass : '')}>
                  <span className="cs-quick-lbl">CA</span>
                  <span className="cs-quick-val">{getEffectiveStat('ac')}</span>
                  {heroAcAura.delta !== 0 && <ModifierArrows delta={heroAcAura.delta} count={2} />}
                </div>
                <div className={'cs-quick-cell init' + (heroInitAura.auraClass ? ' ' + heroInitAura.auraClass : '')}>
                  <span className="cs-quick-lbl">INIZ</span>
                  <span className="cs-quick-val">{initMod >= 0 ? '+' : ''}{initMod}</span>
                  {heroInitAura.delta !== 0 && <ModifierArrows delta={heroInitAura.delta} count={2} />}
                </div>
                <div className={'cs-quick-cell speed' + (heroSpeedAura.auraClass ? ' ' + heroSpeedAura.auraClass : '')}>
                  <span className="cs-quick-lbl">VEL</span>
                  <span className="cs-quick-val">{character.movement?.base ?? character.baseStats.speed}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>ft</span></span>
                  {heroSpeedAura.delta !== 0 && <ModifierArrows delta={heroSpeedAura.delta} count={2} />}
                </div>
                <div className={'cs-quick-cell bab' + (heroBabAura.auraClass ? ' ' + heroBabAura.auraClass : '')}>
                  <span className="cs-quick-lbl">BAB</span>
                  <span className="cs-quick-val">{totalBab >= 0 ? '+' : ''}{totalBab}</span>
                  {heroBabAura.delta !== 0 && <ModifierArrows delta={heroBabAura.delta} count={2} />}
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
              {/* Mobile: actions are surfaced via the avatar popup
                  (see useEffect below). The inline buttons above are hidden by
                  CSS on small screens. */}
            </div>
          );
        })()}

        {/* --- INLINE HEADER EDIT DRAWER --- */}
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
                  <input
                    className="input"
                    list="race-list"
                    value={character.race}
                    onChange={e => {
                      const newRace = e.target.value;
                      const [la, hd] = getRaceAdjustments(newRace);
                      setCharacter({ ...character, race: newRace });
                      if (la > 0) setLevelAdjustment(la);
                      if (hd > 0) setRaceHitDice(hd);
                    }}
                  />
                  <datalist id="race-list">
                    {RACE_PRESETS.map(r => (
                      <option key={r.name} value={r.name} />
                    ))}
                  </datalist>
                </div>
                <div className="cs-drawer-field">
                  <span className="cs-drawer-label">Allineamento</span>
                  <input className="input" value={character.alignment}
                    onChange={e => setCharacter({ ...character, alignment: e.target.value })} />
                </div>
                <div className="cs-drawer-field cs-drawer-field-wide">
                  <span className="cs-drawer-label">Avatar</span>
                  <div className="cs-drawer-avatar-row">
                    <input
                      className="input"
                      type="url"
                      placeholder="URL immagine (https://� o data:�)"
                      value={character.avatarUrl ?? ''}
                      onChange={e => setCharacter({ ...character, avatarUrl: e.target.value || undefined })}
                    />
                    <button type="button" className="btn-secondary cs-drawer-avatar-btn"
                      onClick={() => avatarInputRef.current?.click()}>
                      Carica�
                    </button>
                    {character.avatarUrl && (
                      <button type="button" className="btn-secondary cs-drawer-avatar-btn"
                        onClick={() => setCharacter({ ...character, avatarUrl: undefined })}>
                        Rimuovi
                      </button>
                    )}
                  </div>
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
                  <span className="cs-drawer-label">Velocit� (ft)</span>
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
                  Classi &amp; BAB � totale: <strong>+{getTotalBab()}</strong>{' '}
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
                  Gestisci livelli ?
                </button>
              </div>
            </div>
          );
        })()}

        {/* --- TABS --------------------------------------- */}
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
        {/* Mobile: also portal the tabs into the bottom shell row 1.
            On mobile we move "Panoramica" to the rightmost slot so the
            press-and-hold widget jump anchors next to the avatar/stats. */}
        {isMobile && tabsSlot && createPortal(
          <>
            {(() => {
              const overview = tabs.find(t => t.id === 'overview');
              const others = tabs.filter(t => t.id !== 'overview');
              const ordered = overview ? [...others, overview] : tabs;
              return ordered.map(tab => {
                const isOverview = tab.id === 'overview';
                return (
                  <button
                    key={tab.id}
                    ref={isOverview ? (el => setWidgetJumpTrigger(el)) : undefined}
                    className={`cs-tab ${activeTab === tab.id ? 'active' : ''}${isOverview ? ' cs-tab-jump' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    title={isOverview ? `${tab.label} � tieni premuto per saltare a un widget` : tab.label}
                    aria-label={tab.label}
                  >
                    {tab.icon}<span className="cs-tab-label">{tab.label}</span>
                  </button>
                );
              });
            })()}
          </>,
          tabsSlot,
        )}
      </div>{/* end sticky header+tabs */}

      {/* --- CONTENT AREA --------------------------------- */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 0.75rem' }}>

        {/* --- SIMPLE SCROLL TABS (overview / combat / skills / abilities) --- */}
        {(activeTab === 'overview' || activeTab === 'combat' || activeTab === 'skills' || activeTab === 'levels' || activeTab === 'abilities') && (
          <div style={{ flex: 1, overflowY: activeTab === 'skills' ? 'hidden' : 'auto', display: activeTab === 'skills' ? 'flex' : undefined, flexDirection: activeTab === 'skills' ? 'column' : undefined, minHeight: 0, paddingTop: '1rem', paddingBottom: activeTab === 'skills' ? 0 : '2rem' }}>

            {activeTab === 'levels' && <LevelsTab />}

            {/* --- TAB: OVERVIEW (CUSTOM DASHBOARD) ---------- */}
            {activeTab === 'overview' && (
              <OverviewDashboard goTo={(t) => {
                // Legacy compatibility: map old tab names to the new merged 'abilities' tab.
                if (t === 'feats') { setAbilitiesInitialTab('active'); setActiveTab('abilities'); return; }
                if (t === 'classfeatures') { setAbilitiesInitialTab('active'); setActiveTab('abilities'); return; }
                if (t.startsWith('abilities:')) {
                  setAbilitiesInitialTab(t.slice('abilities:'.length) as AbilitySubTab);
                  setActiveTab('abilities');
                  return;
                }
                setActiveTab(t as SheetTab);
              }} editMode={dashEditMode} setEditMode={setDashEditMode} />
            )}

            {/* --- TAB: COMBAT -------------------------------- */}
            {activeTab === 'combat' && (
              <div className="animate-fade-in flex-col gap-4">
                {/* Sub-tabs */}
                <div className="combat-subtabs" role="tablist" aria-label="Sezioni combattimento">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={combatSubTab === 'attacks'}
                    className={'combat-subtab' + (combatSubTab === 'attacks' ? ' is-active' : '')}
                    onClick={() => setCombatSubTab('attacks')}
                  >
                    <GiAxeSword /> Attacchi / Armi
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={combatSubTab === 'modifiers'}
                    className={'combat-subtab' + (combatSubTab === 'modifiers' ? ' is-active' : '')}
                    onClick={() => setCombatSubTab('modifiers')}
                  >
                    <GiAbstract024 /> Modificatori Attivi
                    {(character.activeModifiers?.length ?? 0) > 0 && (
                      <span className="combat-subtab-badge">{character.activeModifiers!.length}</span>
                    )}
                  </button>
                </div>

                {combatSubTab === 'attacks' && (
                  <div className="flex-col gap-4">

                    {/* -- BAB Breakdown card ----------------------- */}
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
                              ? {meleeAttacks.length} attacchi per round
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
                    {isMobile && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {character.inventory
                          .filter(i => i.equipped && i.type === 'weapon')
                          .map(w => {
                            const isRanged = !!(w.weaponDetails?.rangeIncrement);
                            const atkStatOverride = resolveStatOverride(character, { channel: 'attack', weapon: w, isRanged }, getStatModifier);
                            const abilityMod = getStatModifier(atkStatOverride ?? (isRanged ? 'dex' : 'str'));
                            const weaponBonus = w.weaponDetails?.attackBonus ?? 0;
                            const attacks = getMultipleAttacks(abilityMod + weaponBonus);
                            const fmtA = (arr: number[]) => arr.map(v => (v >= 0 ? `+${v}` : `${v}`)).join('/');
                            const primaryBonus = attacks[0];
                            const critStr = w.weaponDetails
                              ? `Crit ${w.weaponDetails.criticalRange ? w.weaponDetails.criticalRange + '/' : ''}x${w.weaponDetails.criticalMultiplier.replace(/[^0-9]/g, '')}`
                              : null;
                            return (
                              <div key={w.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{w.name}</span>
                                  <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)', fontSize: '1.2rem' }}>{primaryBonus >= 0 ? '+' : ''}{primaryBonus}</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {w.weaponDetails?.damage && (
                                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(180,40,40,0.15)', color: 'var(--accent-crimson)', border: '1px solid rgba(180,40,40,0.3)' }}>{w.weaponDetails.damage}</span>
                                  )}
                                  {w.weaponDetails?.damageType && (
                                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>{w.weaponDetails.damageType}</span>
                                  )}
                                  {critStr && (
                                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>{critStr}</span>
                                  )}
                                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {w.weaponDetails?.rangeIncrement ? `${w.weaponDetails.rangeIncrement}m` : 'Mischia'}
                                  </span>
                                  {attacks.length > 1 && (
                                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(100,80,200,0.15)', color: 'var(--accent-arcane)', border: '1px solid rgba(100,80,200,0.3)' }}>{fmtA(attacks)}</span>
                                  )}
                                </div>
                                {w.weaponDetails?.notes && (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{w.weaponDetails.notes}</span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                    {!isMobile && (
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
                              const atkStatOverride = resolveStatOverride(
                                character,
                                { channel: 'attack', weapon: w, isRanged },
                                getStatModifier,
                              );
                              const abilityMod = getStatModifier(atkStatOverride ?? (isRanged ? 'dex' : 'str'));
                              const weaponBonus = w.weaponDetails?.attackBonus ?? 0;
                              const attacks = getMultipleAttacks(abilityMod + weaponBonus);
                              const fmtA = (arr: number[]) => arr.map(v => (v >= 0 ? `+${v}` : `${v}`)).join('/');
                              const primaryBonus = attacks[0];
                              return (
                                <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-primary)', fontWeight: 500 }}>{w.name}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)' }}>{primaryBonus >= 0 ? '+' : ''}{primaryBonus}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'var(--font-heading)', fontSize: '0.82rem', color: attacks.length > 1 ? 'var(--accent-arcane)' : 'var(--text-muted)' }}>{fmtA(attacks)}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-secondary)' }}>{w.weaponDetails?.damage ?? '�'}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{w.weaponDetails?.damageType ?? '�'}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {w.weaponDetails ? `${w.weaponDetails.criticalRange ? w.weaponDetails.criticalRange + '/' : ''}�${w.weaponDetails.criticalMultiplier.replace('x', '').replace('�', '')}` : '�'}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{w.weaponDetails?.rangeIncrement || 'Mischia'}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{w.weaponDetails?.notes || '�'}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    )}
                    {character.inventory.filter(i => i.equipped && (i.type === 'armor' || i.type === 'shield' || i.type === 'protectiveItem')).length > 0 && (
                      <>
                        <div className="section-header" style={{ marginTop: '0.5rem' }}>
                          <span className="section-title">Protezioni Equipaggiate</span>
                        </div>
                          {isMobile && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                              {character.inventory
                                .filter(i => i.equipped && (i.type === 'armor' || i.type === 'shield' || i.type === 'protectiveItem'))
                                .map(a => (
                                  <div key={a.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>{a.name}</span>
                                      <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-gold)', fontSize: '1.2rem' }}>CA +{a.armorDetails?.armorBonus ?? 0}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                      {a.armorDetails?.maxDex !== undefined && a.armorDetails.maxDex !== null && (
                                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>Max Des {a.armorDetails.maxDex}</span>
                                      )}
                                      {!!a.armorDetails?.checkPenalty && (
                                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(180,40,40,0.15)', color: 'var(--accent-crimson)', border: '1px solid rgba(180,40,40,0.3)' }}>Pen {a.armorDetails.checkPenalty}</span>
                                      )}
                                      {!!a.armorDetails?.spellFailure && (
                                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,200,50,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(255,200,50,0.2)' }}>Incant. {a.armorDetails.spellFailure}%</span>
                                      )}
                                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>{a.armorDetails?.armorType ?? a.type}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                          {!isMobile && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {['Protezione', 'Bonus CA', 'Max Des', 'Penalit�', 'Incant.%', 'Tipo'].map(h => (
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
                                    <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{a.armorDetails?.maxDex ?? '�'}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', color: a.armorDetails?.checkPenalty ? 'var(--accent-crimson)' : 'var(--text-muted)' }}>{a.armorDetails?.checkPenalty ?? 0}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{a.armorDetails?.spellFailure ? `${a.armorDetails.spellFailure}%` : '�'}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{a.armorDetails?.armorType ?? a.type}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                          )}
                      </>
                    )}

                    {/* --- CUSTOM ATTACKS -------------------------------------------- */}
                    <div className="section-header" style={{ marginTop: '1.25rem' }}>
                      <span className="section-title">Attacchi Personalizzati</span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { setCAForm(emptyCA()); setEditingCAId(null); setShowCAForm(true); }}
                      >
                        <FaPlus size={10} /> Nuovo
                      </button>
                    </div>

                    {/* - FORM - */}
                    {(() => {
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
                      const closeForm = () => { setShowCAForm(false); setEditingCAId(null); };
                      const formBody = (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                            <div style={{ ...fld, gridColumn: 'span 2' }}>
                              <span style={lbl}>Nome attacco *</span>
                              <input className="input" value={caForm.name} onChange={e => setCAForm(f => ({ ...f, name: e.target.value }))} placeholder="es. Deflagazione Occulta" style={{ fontSize: isMobile ? '1rem' : '0.85rem' }} />
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Stat per colpire</span>
                              <select className="input" value={caForm.attackStat ?? ''} onChange={e => setCAForm(f => ({ ...f, attackStat: (e.target.value as import('../types/dnd').StatType) || undefined }))} style={{ fontSize: isMobile ? '1rem' : '0.82rem' }}>
                                {statOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                              </select>
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Bonus extra att.</span>
                              <input className="input" type="number" value={caForm.attackBonusExtra ?? 0} onChange={e => setCAForm(f => ({ ...f, attackBonusExtra: parseInt(e.target.value) || 0 }))} style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={{ ...fld, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <input type="checkbox" id="ca-bab" checked={!!caForm.useBab} onChange={e => setCAForm(f => ({ ...f, useBab: e.target.checked }))} />
                              <label htmlFor="ca-bab" style={{ ...lbl, cursor: 'pointer', letterSpacing: 0 }}>Includi BAB</label>
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Dadi danno</span>
                              <input className="input" value={caForm.damageDice} onChange={e => setCAForm(f => ({ ...f, damageDice: e.target.value }))} placeholder="es. 1d10" style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Stat per danno</span>
                              <select className="input" value={caForm.damageStat ?? ''} onChange={e => setCAForm(f => ({ ...f, damageStat: (e.target.value as import('../types/dnd').StatType) || undefined }))} style={{ fontSize: isMobile ? '1rem' : '0.82rem' }}>
                                {statOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                              </select>
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Bonus extra danno</span>
                              <input className="input" type="number" value={caForm.damageBonusExtra ?? 0} onChange={e => setCAForm(f => ({ ...f, damageBonusExtra: parseInt(e.target.value) || 0 }))} style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Tipo danno</span>
                              <input className="input" value={caForm.damageType} onChange={e => setCAForm(f => ({ ...f, damageType: e.target.value }))} placeholder="es. forza" style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Critico (range)</span>
                              <input className="input" value={caForm.criticalRange ?? ''} onChange={e => setCAForm(f => ({ ...f, criticalRange: e.target.value }))} placeholder="es. 20" style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Critico (mult.)</span>
                              <input className="input" value={caForm.criticalMultiplier ?? ''} onChange={e => setCAForm(f => ({ ...f, criticalMultiplier: e.target.value }))} placeholder="es. �2" style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={fld}>
                              <span style={lbl}>Gittata</span>
                              <input className="input" value={caForm.range ?? ''} onChange={e => setCAForm(f => ({ ...f, range: e.target.value }))} placeholder="es. 18m" style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
                            </div>
                            <div style={{ ...fld, gridColumn: 'span 2' }}>
                              <span style={lbl}>Note</span>
                              <input className="input" value={caForm.notes ?? ''} onChange={e => setCAForm(f => ({ ...f, notes: e.target.value }))} placeholder="Note aggiuntive..." style={{ fontSize: isMobile ? '1rem' : '0.82rem' }} />
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
                                      {f.kind === 'Privilegio' ? '?' : '?'} {f.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={closeForm}>Annulla</button>
                            <button className="btn btn-primary btn-sm" onClick={saveCA} disabled={!caForm.name.trim()}>Salva</button>
                          </div>
                        </>
                      );
                      if (isMobile) {
                        return (
                          <BottomDrawer
                            open={showCAForm}
                            onClose={closeForm}
                            title={editingCAId ? 'Modifica Attacco' : 'Nuovo Attacco'}
                            accentColor="var(--accent-crimson)"
                          >
                            {formBody}
                          </BottomDrawer>
                        );
                      }
                      return showCAForm ? (
                        <div className="card" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.25)' }}>
                          {formBody}
                        </div>
                      ) : null;
                    })()}

                    {/* - TABLE - */}
                    {(character.customAttacks ?? []).length === 0 && !showCAForm ? (
                      <p className="text-muted text-sm" style={{ padding: '0.4rem 0' }}>Nessun attacco personalizzato. Premi "Nuovo" per aggiungerne uno.</p>
                    ) : (
                      <>
                        {isMobile && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
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
                                <div key={atk.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem', flex: 1 }}>{atk.name}</span>
                                    <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-crimson)', fontSize: '1.1rem' }}>{atkBonus >= 0 ? '+' : ''}{atkBonus}</span>
                                    <button className="btn-ghost" style={{ color: 'var(--accent-gold)', padding: 4 }} onClick={() => { setCAForm({ ...atk }); setEditingCAId(atk.id); setShowCAForm(true); }}><FaEdit size={14} /></button>
                                    <button className="btn-ghost" style={{ color: 'var(--accent-crimson)', padding: 4 }} onClick={() => { setCharacter({ ...character, customAttacks: (character.customAttacks ?? []).filter(a => a.id !== atk.id) }); }}><FaTrash size={14} /></button>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(180,40,40,0.15)', color: 'var(--accent-crimson)', border: '1px solid rgba(180,40,40,0.3)' }}>{dmgDisplay}</span>
                                    {atk.damageType && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>{atk.damageType}</span>}
                                    {(atk.criticalMultiplier || atk.criticalRange) && (
                                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        Crit {atk.criticalRange ? `${atk.criticalRange}/` : ''}{atk.criticalMultiplier}
                                      </span>
                                    )}
                                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>{atk.range || 'Mischia'}</span>
                                  </div>
                                  {linkedNames.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {linkedNames.map(n => (
                                        <span key={n} style={{ padding: '1px 6px', borderRadius: 10, fontSize: '0.72rem', background: 'rgba(155,89,182,0.2)', color: 'var(--accent-arcane)', border: '1px solid rgba(155,89,182,0.3)' }}>{n}</span>
                                      ))}
                                    </div>
                                  )}
                                  {atk.notes && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{atk.notes}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!isMobile && (
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
                                    {atk.criticalRange && atk.criticalMultiplier ? `${atk.criticalRange}/${atk.criticalMultiplier}` : atk.criticalMultiplier ?? '�'}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{atk.range || 'Mischia'}</td>
                                  <td style={{ padding: '0.4rem 0.6rem', maxWidth: 160 }}>
                                    {linkedNames.length > 0 ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                        {linkedNames.map(n => (
                                          <span key={n} style={{ padding: '1px 6px', borderRadius: 10, fontSize: '0.65rem', background: 'rgba(155,89,182,0.2)', color: 'var(--accent-arcane)', border: '1px solid rgba(155,89,182,0.3)', whiteSpace: 'nowrap' }}>{n}</span>
                                        ))}
                                      </div>
                                    ) : <span className="text-muted">�</span>}
                                  </td>
                                  <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{atk.notes || '�'}</td>
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
                      </>
                    )}
                  </div>
                )}

                {combatSubTab === 'modifiers' && (
                  <div className="combat-modifiers-panel">
                    <ModifiersWidget size={{ w: 4, h: 4, pixelW: 880, pixelH: 600, size: 'xl' }} />
                  </div>
                )}
              </div>
            )}

            {/* --- TAB: SKILLS -------------------------------- */}
            {activeTab === 'skills' && <SkillsTab />}

            {activeTab === 'abilities' && <AbilitiesPage initialTab={abilitiesInitialTab} />}
          </div>
        )}

        {/* --- COMPONENT TABS ----------------------------------- */}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'spells' && <Spellbook />}
        {activeTab === 'bestiary' && <BestiaryPage />}
      </div>

      {/* --- MODALS -------------------------------------------- */}
      {isSkillModalOpen && (
        <SkillModal onClose={() => setIsSkillModalOpen(false)} />
      )}
      {showImportWizard && (
        <SkillImportWizard onClose={() => setShowImportWizard(false)} />
      )}

      {/* Widget jump rail (anchored to the mobile "Panoramica" tab). */}
      <WidgetJumpRail />
    </div>
  );
};
