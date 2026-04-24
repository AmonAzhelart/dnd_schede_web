import React from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { StatType } from '../../../types/dnd';

/**
 * Returns the active modifier delta and the matching aura class for a given target.
 * Targets follow the same ids used by ModifiersWidget (e.g. 'str', 'ac', 'hp',
 * 'fortitude', 'speed', 'bab', 'skill.<id>').
 */
export function useModifierAura(target: StatType | string) {
    const delta = useCharacterStore(s => s.getActiveModifierDelta(target));
    const auraClass = delta > 0 ? 'w-mod-aura-buff' : delta < 0 ? 'w-mod-aura-malus' : '';
    return { delta, auraClass };
}

/**
 * Floating arrow particles to overlay on top of any aura'd element.
 * Parent must have position: relative + overflow: hidden (the aura classes provide that).
 */
export function ModifierArrows({ delta, count = 3 }: { delta: number; count?: number }) {
    if (!delta) return null;
    const isBuff = delta > 0;
    return (
        <div className={`w-mod-arrows ${isBuff ? 'is-buff' : 'is-malus'}`} aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <span
                    key={i}
                    className="w-mod-arrow"
                    style={{
                        left: `${20 + i * 30}%`,
                        animationDelay: `${i * 0.9}s`,
                        animationDuration: `${2.8 + (i % 2) * 0.6}s`,
                    }}
                >{isBuff ? '▲' : '▼'}</span>
            ))}
        </div>
    );
}

/**
 * Drop-in wrapper that applies the pulsing border + arrow particles around any
 * value affected by an active modifier. Renders children unchanged when no
 * modifier is active.
 */
type Props = {
    target: StatType | string;
    children: React.ReactNode;
    /** Tag of the wrapping element. Defaults to span (inline-block). */
    as?: 'span' | 'div';
    className?: string;
    arrowCount?: number;
    /** Render arrows. Set to false on very small UIs where they would be cramped. */
    showArrows?: boolean;
};

export function ModifierAura({
    target,
    children,
    as = 'span',
    className = '',
    arrowCount = 3,
    showArrows = true,
}: Props) {
    const { delta, auraClass } = useModifierAura(target);
    const Tag: 'span' | 'div' = as;
    if (!auraClass) {
        return <Tag className={className}>{children}</Tag>;
    }
    return (
        <Tag className={`w-mod-host ${auraClass} ${className}`.trim()}>
            {children}
            {showArrows && <ModifierArrows delta={delta} count={arrowCount} />}
        </Tag>
    );
}
