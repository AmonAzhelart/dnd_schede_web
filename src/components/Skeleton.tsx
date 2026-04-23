import React from 'react';

export const SkeletonLine: React.FC<{
    width?: string | number;
    height?: number;
    style?: React.CSSProperties;
}> = ({ width = '100%', height = 14, style }) => (
    <div
        className="skeleton"
        style={{ width, height, borderRadius: 4, ...style }}
    />
);

export const SkeletonCharacterCard: React.FC = () => (
    <div
        className="btn-secondary w-full"
        style={{
            justifyContent: 'space-between',
            padding: '0.9rem 1.2rem',
            borderRadius: 'var(--radius-sm)',
            pointerEvents: 'none',
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
                className="skeleton"
                style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonLine width={120} height={14} />
                <SkeletonLine width={80} height={10} />
            </div>
        </div>
    </div>
);

export const SkeletonSheet: React.FC = () => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            padding: '1.25rem 2rem 0',
            gap: '1rem',
        }}
    >
        {/* Header panel */}
        <div
            className="glass-panel"
            style={{ padding: '1.5rem', flexShrink: 0, display: 'flex', gap: '1.5rem', alignItems: 'center' }}
        >
            <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SkeletonLine width="40%" height={28} />
                <div style={{ display: 'flex', gap: 8 }}>
                    <SkeletonLine width={70} height={18} />
                    <SkeletonLine width={90} height={18} />
                    <SkeletonLine width={60} height={18} />
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 160 }}>
                <SkeletonLine width={80} height={12} />
                <SkeletonLine width={120} height={36} />
                <SkeletonLine width="100%" height={8} />
            </div>
        </div>

        {/* Tabs bar */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {[100, 120, 80, 100, 80, 140, 90].map((w, i) => (
                <SkeletonLine key={i} width={w} height={32} />
            ))}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 16, paddingBottom: '2rem' }}>
            {[200, 160, 180, 180].map((w, i) => (
                <div key={i} style={{ width: w, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <SkeletonLine width="60%" height={12} />
                    {Array.from({ length: 5 }).map((_, j) => (
                        <SkeletonLine key={j} width="100%" height={60} />
                    ))}
                </div>
            ))}
        </div>
    </div>
);
