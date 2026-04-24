import React from 'react';

/**
 * Built-in icon set bundled under `src/assets/icons/<category>/<name>.svg`.
 * All SVGs are loaded eagerly as raw strings at build time and rendered inline
 * so they can be tinted via `currentColor` (use the `inv-svg-tinted` utility).
 */
const RAW = import.meta.glob('../assets/icons/**/*.svg', {
    eager: true,
    query: '?raw',
    import: 'default',
}) as Record<string, string>;

type Catalog = Record<string, Record<string, string>>;

const CATALOG: Catalog = (() => {
    const out: Catalog = {};
    for (const [path, svg] of Object.entries(RAW)) {
        const m = path.match(/icons\/([^/]+)\/([^/]+)\.svg$/);
        if (!m) continue;
        const [, category, name] = m;
        (out[category] ||= {})[name] = svg;
    }
    return out;
})();

const sanitize = (svg: string): string =>
    svg
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');

/** Lookup raw SVG markup. Returns `undefined` if not found. */
export function getDndIconSvg(category: string, name: string): string | undefined {
    return CATALOG[category]?.[name];
}

/** List of all category names (folders). */
export function listDndIconCategories(): string[] {
    return Object.keys(CATALOG).sort();
}

/** List of icon names within a category. */
export function listDndIconNames(category: string): string[] {
    return Object.keys(CATALOG[category] ?? {}).sort();
}

/** Flat list of every bundled icon as `{category,name,svg}`. */
export function listAllDndIcons(): { category: string; name: string; svg: string }[] {
    const out: { category: string; name: string; svg: string }[] = [];
    for (const cat of Object.keys(CATALOG)) {
        for (const n of Object.keys(CATALOG[cat])) {
            out.push({ category: cat, name: n, svg: CATALOG[cat][n] });
        }
    }
    return out.sort((a, b) =>
        a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category),
    );
}

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
    /** Category folder under `src/assets/icons` (e.g. `hp`, `condition`). */
    category: string;
    /** SVG file name without extension. */
    name: string;
    /** Pixel size (square). Defaults to 16. */
    size?: number;
    /** Apply the global `inv-svg-tinted` utility so the SVG follows currentColor. */
    tinted?: boolean;
    /** Fallback node when the requested icon doesn't exist. */
    fallback?: React.ReactNode;
}

/**
 * Render an inline SVG from the bundled icon catalog.
 *
 * ```tsx
 * <DndIcon category="hp" name="full" size={24} />
 * ```
 */
export const DndIcon: React.FC<Props> = ({
    category,
    name,
    size = 16,
    tinted = true,
    fallback = null,
    className,
    style,
    ...rest
}) => {
    const svg = getDndIconSvg(category, name);
    if (!svg) return <>{fallback}</>;
    const cls = [tinted ? 'inv-svg-tinted' : '', className].filter(Boolean).join(' ');
    return (
        <span
            {...rest}
            className={cls}
            style={{
                display: 'inline-flex',
                width: size,
                height: size,
                lineHeight: 0,
                flexShrink: 0,
                ...style,
            }}
            dangerouslySetInnerHTML={{ __html: sanitize(svg) }}
        />
    );
};
