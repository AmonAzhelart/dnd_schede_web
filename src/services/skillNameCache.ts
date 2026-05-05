/**
 * Lightweight module-level cache for catalog skill localized names.
 * Loaded once on first use; components subscribe to be notified when ready.
 */
import { skillCatalog } from './admin';
import type { LocalizedField } from './admin';

let cache: Record<string, LocalizedField> = {};
let loaded = false;
const listeners: Array<() => void> = [];

/** Trigger a load (no-op if already loading or loaded). */
export function loadSkillNameCache(): void {
    if (loaded) return;
    // Guard against multiple concurrent calls
    if ((loadSkillNameCache as any)._pending) return;
    (loadSkillNameCache as any)._pending = true;
    skillCatalog.list().then(skills => {
        cache = {};
        for (const s of skills) {
            if (s.localizedName) cache[s.name] = s.localizedName;
        }
        loaded = true;
        for (const cb of listeners) cb();
        listeners.length = 0;
    }).catch(() => {
        (loadSkillNameCache as any)._pending = false;
    });
}

/** Register a callback that fires once when the cache is ready. */
export function onSkillNameCacheReady(cb: () => void): void {
    if (loaded) { cb(); return; }
    listeners.push(cb);
}

/** Return the LocalizedField for a canonical skill name, or undefined if not found. */
export function getCachedSkillLocalizedName(canonicalName: string): LocalizedField | undefined {
    return cache[canonicalName];
}
