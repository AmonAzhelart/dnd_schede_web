import React, { useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import type { WidgetRenderProps } from '../widgetTypes';

export const NotesWidget: React.FC<WidgetRenderProps> = () => {
    const { character } = useCharacterStore();
    const storageKey = character ? `dash:notes:${character.id}` : 'dash:notes:_';
    const [text, setText] = useState<string>(() => {
        try { return localStorage.getItem(storageKey) ?? ''; } catch { return ''; }
    });

    return (
        <div className="w-note-root">
            <textarea
                className="input w-note-area"
                placeholder="Vergate qui le vostre cronache della sessione…"
                value={text}
                onChange={e => {
                    setText(e.target.value);
                    try { localStorage.setItem(storageKey, e.target.value); } catch { /* ignore */ }
                }}
            />
        </div>
    );
};
