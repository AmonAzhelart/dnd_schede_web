import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';

interface Props {
    compact?: boolean;
}

/**
 * Dropdown to switch the active UI language.
 * Persists the choice via i18next-browser-languagedetector (localStorage key: `dnd_lang`).
 */
export function LanguageSwitcher({ compact = false }: Props) {
    const { i18n, t } = useTranslation();

    const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.resolvedLanguage)
        ?? SUPPORTED_LANGUAGES[0];

    return (
        <label
            className="text-xs text-muted"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title={t('common.language')}
        >
            {!compact && <span>{current.flag}</span>}
            <select
                value={current.code}
                onChange={e => i18n.changeLanguage(e.target.value)}
                style={{
                    background: 'transparent',
                    border: '1px solid var(--border, #444)',
                    borderRadius: 6,
                    padding: '2px 6px',
                    color: 'inherit',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                }}
            >
                {SUPPORTED_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                        {l.flag} {compact ? l.code.toUpperCase() : l.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
