import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadSkillNameCache, onSkillNameCacheReady, getCachedSkillLocalizedName } from '../services/skillNameCache';
import { pickLocalized } from '../i18n';
import type { Skill } from '../types/dnd';

/**
 * Returns a stable `displayName(skill)` function that resolves:
 *   1. catalog `localizedName` for the skill's canonical name (loaded once)
 *   2. `skill.localizedName` stored on the skill itself (if any)
 *   3. `skill.name` as fallback
 * Triggers a re-render when the catalog cache becomes available.
 */
export function useSkillDisplayName(): (skill: Skill) => string {
    const { i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        loadSkillNameCache();
        onSkillNameCacheReady(() => forceUpdate(n => n + 1));
    }, []);

    return useCallback(
        (skill: Skill) => {
            // Catalog name takes priority; skill-level localizedName is a fallback.
            const loc = getCachedSkillLocalizedName(skill.name) ?? skill.localizedName;
            return (loc ? pickLocalized(loc as any, lang) : '') || skill.name;
        },
        [lang],
    );
}
