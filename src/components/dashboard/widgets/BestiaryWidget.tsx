import React, { useEffect, useState } from 'react';
import { FaDragon } from 'react-icons/fa';
import { GiMagicSwirl, GiScrollUnfurled } from 'react-icons/gi';
import { useCharacterStore } from '../../../store/characterStore';
import { creatureCatalog, type CatalogCreature } from '../../../services/admin';
import type { WidgetRenderProps } from '../widgetTypes';

export const BestiaryWidget: React.FC<WidgetRenderProps> = ({ goTo, size }) => {
    const { character } = useCharacterStore();
    const [catalog, setCatalog] = useState<CatalogCreature[]>([]);
    const bestiary = character?.bestiary ?? [];
    const summons = character?.activeSummons ?? [];
    const pets = character?.activePets ?? [];

    useEffect(() => {
        creatureCatalog.list().then(setCatalog).catch(() => { });
    }, []);

    const isCompact = size.pixelW < 280;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, overflowY: 'auto' }}>
            {/* Summary row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                    { label: 'Catalogo', val: catalog.length, color: 'var(--accent-gold)' },
                    { label: 'Personale', val: bestiary.length, color: 'var(--accent-arcane)' },
                    { label: 'Evocazioni', val: summons.length, color: 'var(--accent-crimson)' },
                    { label: 'Compagni', val: pets.length, color: 'var(--accent-success)' },
                ].map(s => (
                    <div key={s.label} style={{ flex: '1 1 60px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: s.color }}>{s.val}</div>
                        {!isCompact && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</div>}
                    </div>
                ))}
            </div>

            {/* Recent bestiary entries */}
            {bestiary.length > 0 && (
                <div>
                    {!isCompact && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Personale</div>}
                    {bestiary.slice(0, 4).map(e => (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <FaDragon style={{ color: 'var(--accent-gold)', flexShrink: 0, fontSize: '0.75rem' }} />
                            <span style={{ fontSize: '0.78rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.creature.name}</span>
                            {!isCompact && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>CR {e.creature.challengeRating ?? '?'}</span>}
                        </div>
                    ))}
                    {bestiary.length > 4 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>+{bestiary.length - 4} altre…</div>}
                </div>
            )}

            {/* Active summons quick view */}
            {summons.length > 0 && (
                <div>
                    {!isCompact && <div style={{ fontSize: '0.65rem', color: 'var(--accent-arcane)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Evocazioni attive</div>}
                    {summons.slice(0, 3).map(s => {
                        const effHp = s.creature.hp + s.appliedOverrides.filter(o => o.stat === 'hp').reduce((a, o) => a + o.value, 0);
                        const pct = effHp > 0 ? Math.max(0, s.currentHp / effHp) : 0;
                        const col = pct > 0.6 ? '#2ecc71' : pct > 0.3 ? '#f0c040' : '#e74c3c';
                        return (
                            <div key={s.id} style={{ marginBottom: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{s.creature.name}</span>
                                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{s.currentHp}/{effHp}</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct * 100}%`, background: col, transition: 'width 0.3s', borderRadius: 2 }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {bestiary.length === 0 && summons.length === 0 && pets.length === 0 && catalog.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 6 }}>
                    <FaDragon style={{ fontSize: 24, opacity: 0.3 }} />
                    {!isCompact && <span style={{ fontSize: '0.75rem' }}>Nessuna creatura</span>}
                </div>
            )}

            {goTo && (
                <button className="btn-secondary text-xs" style={{ marginTop: 'auto' }} onClick={() => goTo('bestiary')}>
                    <GiScrollUnfurled /> Apri Bestiario
                </button>
            )}
        </div>
    );
};
