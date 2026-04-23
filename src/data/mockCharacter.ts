import type { CharacterBase } from '../types/dnd';

export const mockCharacter: CharacterBase = {
  id: 'char_1',
  userId: 'user_1',
  name: 'Kaelen Vaelen',
  race: 'Elfo del Sole',
  characterClass: 'Mago',
  level: 1,
  alignment: 'Legale Buono',
  baseStats: {
    str: 12,
    dex: 17,
    con: 13,
    int: 19,
    wis: 15,
    cha: 15,
    hp: 5,
    ac: 13,
    speed: 9,
    reflex: 3,
    fortitude: 1,
    will: 4,
    bab: 0,
    initiative: 3,
  },
  savingThrows: {
    fortitude: { base: 0, ability: 1, magic: 0, misc: 0 },
    reflex: { base: 0, ability: 3, magic: 0, misc: 0 },
    will: { base: 2, ability: 2, magic: 0, misc: 0 },
  },
  currency: { platinum: 0, gold: 12, silver: 6, copper: 9 },
  movement: { base: 9, fly: 0 },
  hpDetails: {
    current: 5, max: 5, nonLethal: 0, tempHp: 0, negLevels: 0,
    damageReduction: '', elementalResistances: '',
  },
  languages: [
    { id: 'comune', name: 'Comune' },
    { id: 'elfico', name: 'Elfico' },
    { id: 'draconico', name: 'Draconico' },
    { id: 'celestiale', name: 'Celestiale' },
    { id: 'auran', name: 'Auran' },
    { id: 'gnomesco', name: 'Gnomesco' },
  ],
  skills: {
    'concentrazione': { id: 'concentrazione', name: 'Concentrazione', stat: 'con', ranks: 1, classSkill: true, armorCheckPenalty: false, canUseUntrained: true },
    'conoscenze_locali': { id: 'conoscenze_locali', name: 'Conoscenze Locali', stat: 'int', ranks: 1, classSkill: true, armorCheckPenalty: false, canUseUntrained: false },
    'con_arcane': { id: 'con_arcane', name: 'Con. Arcane', stat: 'int', ranks: 3, classSkill: true, armorCheckPenalty: false, canUseUntrained: false },
    'con_architettura': { id: 'con_architettura', name: 'Con. Architettura', stat: 'int', ranks: 1, classSkill: true, armorCheckPenalty: false, canUseUntrained: false },
    'sapienza_magica': { id: 'sapienza_magica', name: 'Sapienza Magica', stat: 'int', ranks: 4, classSkill: true, armorCheckPenalty: false, canUseUntrained: false },
    'cercare': { id: 'cercare', name: 'Cercare', stat: 'int', ranks: 2, classSkill: false, armorCheckPenalty: false, canUseUntrained: true },
    'ascoltare': { id: 'ascoltare', name: 'Ascoltare', stat: 'wis', ranks: 0, classSkill: false, armorCheckPenalty: false, canUseUntrained: true },
    'osservare': { id: 'osservare', name: 'Osservare', stat: 'wis', ranks: 2, classSkill: false, armorCheckPenalty: false, canUseUntrained: true },
  },
  inventory: [
    {
      id: 'item_bastone', name: 'Bastone Ferrato', description: 'Arma semplice da mischia.', type: 'weapon',
      weight: 2, equipped: true, modifiers: [],
      weaponDetails: { damage: '1d6', damageType: 'c', criticalMultiplier: 'x2', rangeIncrement: '' },
    },
    {
      id: 'item_arco', name: 'Arco Corto', description: 'Arma semplice a distanza.', type: 'weapon',
      weight: 1, equipped: false, modifiers: [],
      weaponDetails: { damage: '1d6', damageType: 'p', criticalMultiplier: 'x3', rangeIncrement: '18m' },
    },
    {
      id: 'item_libro', name: 'Libro Incantesimi (Vuoto)', description: 'Libro degli incantesimi.', type: 'gear',
      weight: 1.5, equipped: false, modifiers: [], location: 'zaino',
    },
    {
      id: 'item_borsa_comp', name: 'Borsa Componenti Incantesimi', description: 'Borsa per i componenti materiali.', type: 'gear',
      weight: 0.5, equipped: true, modifiers: [],
    },
    {
      id: 'comp_filo', name: 'Filo di Ramme', description: 'Componente per Messaggio.', type: 'component',
      weight: 0, equipped: false, quantity: 1, modifiers: [], associatedSpell: 'Messaggio', location: 'borsa_componenti',
    },
    {
      id: 'comp_cuoio', name: 'Pezzo Cuoio Conciato', description: 'Componente per Armatura Magica.', type: 'component',
      weight: 0, equipped: false, quantity: 1, modifiers: [], associatedSpell: 'Armatura Magica', location: 'borsa_componenti',
    },
    {
      id: 'item_frecce', name: 'Frecce (40)', description: 'Munizioni per arco.', type: 'consumable',
      weight: 2, equipped: false, quantity: 39, modifiers: [],
    },
    {
      id: 'item_pozione_rossa', name: 'Pozione Rossa', description: 'Pozione sconosciuta.', type: 'consumable',
      weight: 0.1, equipped: false, quantity: 2, modifiers: [],
    },
    {
      id: 'item_olio', name: 'Olio', description: '', type: 'consumable',
      weight: 0.2, equipped: false, quantity: 2, modifiers: [],
    },
    {
      id: 'item_corda', name: 'Corda', description: '15m di corda robusta.', type: 'gear',
      weight: 2, equipped: false, modifiers: [],
    },
    {
      id: 'item_lanterna', name: 'Lanterna', description: '', type: 'gear',
      weight: 0.5, equipped: false, modifiers: [],
    },
    {
      id: 'item_zaino', name: 'Zaino', description: '', type: 'gear',
      weight: 0.5, equipped: false, modifiers: [],
    },
  ],
  feats: [
    {
      id: 'feat_mago_collegio', name: 'Mago di Collegio (P. Arcanista p.181)', description: 'Scuole Proibite: Negromanzia, Ammaliamento, Illusione.',
      active: true, modifiers: [],
    },
    {
      id: 'feat_evoc_rapida', name: 'Evocazione Rapida', description: '', active: true, modifiers: [],
    },
    {
      id: 'feat_aum_evoc', name: 'Aumentare Evocazione', description: '', active: false, modifiers: [],
    },
  ],
  spells: [
    { id: 'sp_acid_splash', name: 'Acid Splash', level: 0, school: 'Evocazione', description: 'Dardo di acido.', castingTime: '1 azione standard', range: 'distanza ravvicinata', duration: 'istantanea' },
    { id: 'sp_mano_magica', name: 'Mano Magica', level: 0, school: 'Trasmutazione', description: 'Muovi oggetti leggeri a distanza.', castingTime: '1 azione standard', range: 'distanza media' },
    { id: 'sp_messaggio', name: 'Messaggio', level: 0, school: 'Trasmutazione', description: 'Sussurra messaggi e ascolta risposte.', castingTime: '1 azione standard', range: '100 piedi' },
    { id: 'sp_resistenza', name: 'Resistenza', level: 0, school: 'Abiurazione', description: '+1 a un tiro salvezza.', castingTime: '1 azione standard', duration: '1 minuto' },
    { id: 'sp_read_magic', name: 'Read Magic', level: 0, school: 'Divinazione', description: 'Leggi scritti magici.', castingTime: '1 azione standard' },
    { id: 'sp_evoca_mostri1', name: 'Evoca Mostri I', level: 1, school: 'Evocazione', description: 'Evoca una creatura per combattere.', castingTime: '1 round', duration: '1 round/livello', components: 'V, S, F (filo di ramme)' },
    { id: 'sp_armatura_magica', name: 'Armatura Magica', level: 1, school: 'Evocazione', description: '+4 CA armatura invisibile.', castingTime: '1 azione standard', duration: '1 ora/livello', components: 'V, S, M (pezzo cuoio)' },
    { id: 'sp_cavalcatura', name: 'Cavalcatura', level: 1, school: 'Evocazione', description: 'Evoca un destriero.', castingTime: '1 minuto', duration: '2 ore/livello' },
    { id: 'sp_servitore', name: 'Servitore Inosservato', level: 1, school: 'Evocazione', description: 'Forza invisibile esegue compiti.', castingTime: '1 azione standard', duration: '1 ora/livello' },
    { id: 'sp_unto', name: 'Unto', level: 1, school: 'Trasmutazione', description: 'Oggetto lubrificato, creatura cade a terra.', castingTime: '1 azione standard', duration: 'round/livello' },
    { id: 'sp_scudo', name: 'Scudo', level: 1, school: 'Abiurazione', description: '+4 CA scudo invisibile, devia magic missile.', castingTime: '1 azione standard', duration: '1 min/livello' },
    { id: 'sp_ritirata_rapida', name: 'Ritirata Rapida', level: 1, school: 'Trasmutazione', description: 'Velocità raddoppiata.', castingTime: '1 azione bonus', duration: 'round/livello' },
    { id: 'sp_caduta_morbida', name: 'Caduta Morbida', level: 1, school: 'Trasmutazione', description: 'Rallenta caduta.', castingTime: '1 azione immediata', duration: 'fino all\'atterraggio' },
    { id: 'sp_globo_fuoco', name: 'Globo di Fuoco Inferiore', level: 1, school: 'Evocazione', description: 'Palla di fuoco più piccola.', castingTime: '1 azione standard', savingThrow: 'Riflessi parziale', components: 'P. Ar.' },
    { id: 'sp_ripara_danni', name: 'Ripara Danni Leggeri', level: 1, school: 'Trasmutazione', description: 'Ripara 1d6 danni a un costrutto.', castingTime: '1 azione standard', components: 'P. Ar.' },
  ],
  preparedSpellIds: ['sp_acid_splash', 'sp_mano_magica', 'sp_evoca_mostri1', 'sp_armatura_magica', 'sp_scudo'],
  spellSlots: {
    '0': { total: 10, used: 0 },
    '1': { total: 2, used: 0 },
  },
};
