import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../store/characterStore';
import { Feats } from './Feats';
import { ClassFeatures } from './ClassFeatures';
import { GiSpinningSword, GiShield, GiAbstract024, GiCogLock } from 'react-icons/gi';

export type AbilitySubTab = 'active' | 'passive' | 'feats' | 'option';

const SUBTABS: {
    key: AbilitySubTab;
    label: string;
    short: string;
    icon: React.ReactNode;
    color: string;
    description: string;
}[] = [
        {
            key: 'active',
            label: 'Capacità Attive',
            short: 'Attive',
            icon: <GiSpinningSword />,
            color: 'var(--accent-warning, #f39c12)',
            description: 'Capacità con risorse o azioni attivabili',
        },
        {
            key: 'passive',
            label: 'Passive',
            short: 'Passive',
            icon: <GiShield />,
            color: 'var(--accent-success, #27ae60)',
            description: 'Capacità sempre attive che modificano il personaggio',
        },
        {
            key: 'feats',
            label: 'Talenti',
            short: 'Talenti',
            icon: <GiAbstract024 />,
            color: 'var(--accent-arcane, #9b59b6)',
            description: 'Talenti acquisiti per livello e difetti',
        },
        {
            key: 'option',
            label: 'Opzioni di personalizzazione',
            short: 'Opzioni',
            icon: <GiCogLock />,
            color: 'var(--accent-gold, #c9a84c)',
            description: 'Opzioni di build: invocazioni, manovre, metamorfosi…',
        },
    ];

interface Props {
    /** Optional initial sub-tab to focus when opening the page. */
    initialTab?: AbilitySubTab;
}

export const AbilitiesPage: React.FC<Props> = ({ initialTab }) => {
    const { character } = useCharacterStore();
    const [tab, setTab] = useState<AbilitySubTab>(initialTab ?? 'active');

    useEffect(() => {
        if (initialTab) setTab(initialTab);
    }, [initialTab]);

    if (!character) return null;

    const cf = character.classFeatures ?? [];
    const counts: Record<AbilitySubTab, number> = {
        active: cf.filter(f => f.subcategory === 'active').length,
        passive: cf.filter(f => f.subcategory === 'passive').length,
        option: cf.filter(f => f.subcategory === 'option').length,
        feats: (character.feats ?? []).length,
    };

    const activeMeta = SUBTABS.find(t => t.key === tab)!;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ─── Sub-tab bar (sticky) ─── */}
            <div
                className="glass-panel"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    padding: 6,
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'stretch',
                }}
                role="tablist"
                aria-label="Privilegi di Classe"
            >
                {SUBTABS.map(t => {
                    const isActive = tab === t.key;
                    const count = counts[t.key];
                    return (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setTab(t.key)}
                            title={t.description}
                            style={{
                                flex: '1 1 140px',
                                minWidth: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-heading)',
                                fontSize: '0.82rem',
                                letterSpacing: '0.04em',
                                background: isActive
                                    ? `linear-gradient(180deg, ${t.color}22, ${t.color}11)`
                                    : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isActive ? t.color + '66' : 'rgba(255,255,255,0.06)'}`,
                                color: isActive ? t.color : 'var(--text-secondary)',
                                transition: 'all 0.15s',
                                position: 'relative',
                            }}
                            onMouseEnter={e => {
                                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            }}
                            onMouseLeave={e => {
                                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                            }}
                        >
                            <span style={{ display: 'inline-flex', fontSize: '1rem', color: t.color, opacity: isActive ? 1 : 0.65 }}>
                                {t.icon}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.label}
                            </span>
                            <span
                                style={{
                                    fontSize: '0.65rem',
                                    background: isActive ? `${t.color}33` : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isActive ? t.color + '55' : 'rgba(255,255,255,0.08)'}`,
                                    color: isActive ? t.color : 'var(--text-muted)',
                                    borderRadius: 10,
                                    padding: '0 7px',
                                    minWidth: 18,
                                    textAlign: 'center',
                                    fontFamily: 'var(--font-heading)',
                                }}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Subtle subtitle */}
            <div
                style={{
                    flexShrink: 0,
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    padding: '0 4px',
                    borderLeft: `2px solid ${activeMeta.color}55`,
                    paddingLeft: 10,
                }}
            >
                {activeMeta.description}
            </div>

            {/* ─── Active sub-tab body ─── */}
            <div>
                {tab === 'feats' ? (
                    <Feats />
                ) : (
                    <ClassFeatures restrictTo={tab} hideToolbar />
                )}
            </div>
        </div>
    );
};
