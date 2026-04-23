import React from 'react';
import { FaLanguage } from 'react-icons/fa';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

export const LanguagesWidget: React.FC<WidgetRenderProps> = () => {
    const { character, addLanguage, removeLanguage } = useCharacterStore();
    if (!character) return null;
    const langs = character.languages ?? [];

    return (
        <div className="w-lang-root">
            <div className="w-meta">
                <FaLanguage size={12} style={{ color: '#b48ad3' }} />
                <span><strong style={{ color: '#b48ad3' }}>{langs.length}</strong> lingue conosciute</span>
            </div>

            <div className="w-lang-zone w-scroll">
                {langs.length === 0 && (
                    <div className="w-empty" style={{ width: '100%' }}>
                        Nessuna lingua. Aggiungine una qui sotto.
                    </div>
                )}
                {langs.map(lang => (
                    <span
                        key={lang.id}
                        className="w-lang-banner"
                        onDoubleClick={() => removeLanguage(lang.id)}
                        title="Doppio click per rimuovere"
                    >
                        {lang.name}
                        <button
                            className="w-lang-banner-x"
                            onClick={() => removeLanguage(lang.id)}
                            aria-label={`Rimuovi ${lang.name}`}
                        >×</button>
                    </span>
                ))}
            </div>

            <input
                type="text"
                className="input w-lang-input"
                placeholder="Aggiungi lingua e premi Invio…"
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                            addLanguage({ id: val.toLowerCase().replace(/\s+/g, '_'), name: val });
                            (e.target as HTMLInputElement).value = '';
                        }
                    }
                }}
            />
        </div>
    );
};
