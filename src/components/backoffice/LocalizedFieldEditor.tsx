import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../../i18n';
import type { LocalizedField } from '../../services/admin';

interface Props {
    label: string;
    value: LocalizedField | undefined;
    onChange: (next: LocalizedField) => void;
    multiline?: boolean;
    placeholder?: string;
}

/**
 * Editor for a multilingual catalog field.
 * Internally normalises the value to a `Record<lang, string>`. Renders one
 * input per supported language, with the active UI language highlighted.
 */
export function LocalizedFieldEditor({ label, value, onChange, multiline, placeholder }: Props) {
    const { i18n } = useTranslation();
    const current = (i18n.resolvedLanguage ?? 'it') as LanguageCode;
    const [open, setOpen] = useState(false);

    // Normalise to a map for editing.
    const asMap: Record<string, string> = typeof value === 'string'
        ? { [current]: value }
        : ({ ...(value ?? {}) } as Record<string, string>);

    const update = (lang: LanguageCode, next: string) => {
        const merged = { ...asMap, [lang]: next };
        // Drop empty strings to keep payloads small.
        for (const k of Object.keys(merged)) if (!merged[k]) delete merged[k];
        onChange(merged as LocalizedField);
    };

    const InputTag: any = multiline ? 'textarea' : 'input';

    return (
        <div>
            <label className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{label}</span>
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', fontSize: '0.7rem', cursor: 'pointer' }}
                    title="Espandi tutte le lingue"
                >
                    {open ? '▴ Solo lingua corrente' : '▾ Tutte le lingue'}
                </button>
            </label>
            {open ? (
                <div className="flex-col gap-1">
                    {SUPPORTED_LANGUAGES.map(l => (
                        <div key={l.code} className="flex items-center gap-2">
                            <span style={{ width: 28, fontSize: '0.7rem', color: l.code === current ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                                {l.flag} {l.code.toUpperCase()}
                            </span>
                            <InputTag
                                className="input w-full"
                                rows={multiline ? 3 : undefined}
                                placeholder={placeholder}
                                value={asMap[l.code] ?? ''}
                                onChange={(e: any) => update(l.code, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <InputTag
                    className="input w-full"
                    rows={multiline ? 3 : undefined}
                    placeholder={placeholder}
                    value={asMap[current] ?? ''}
                    onChange={(e: any) => update(current, e.target.value)}
                />
            )}
        </div>
    );
}
