import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import it from './locales/it.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            it: { translation: it },
            en: { translation: en },
            es: { translation: es },
            de: { translation: de },
            fr: { translation: fr },
        },
        fallbackLng: 'it',
        supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'dnd_lang',
        },
    });

export default i18n;

/**
 * Helper to read a localized field from a catalog item.
 * Catalog items can store either a plain string (legacy) or a multilingual map:
 *   `{ it: 'Guerriero', en: 'Fighter' }`
 * Falls back to italian, then to the first available value.
 */
export type LocalizedString = string | Partial<Record<LanguageCode, string>>;

export function pickLocalized(value: LocalizedString | undefined, lang: string): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const exact = (value as Record<string, string>)[lang];
    if (exact) return exact;
    if (value.it) return value.it;
    if (value.en) return value.en;
    const first = Object.values(value).find(Boolean);
    return first ?? '';
}
