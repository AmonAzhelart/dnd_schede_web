import React, { useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '../../../store/characterStore';
import { saveCharacterToDb } from '../../../services/db';
import type { WidgetRenderProps } from '../widgetTypes';

export const NotesWidget: React.FC<WidgetRenderProps> = () => {
    const { character, setQuickNotes } = useCharacterStore();
    const [text, setText] = useState<string>(character?.quickNotes ?? '');
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync local text when character changes (e.g. on initial load or character switch)
    useEffect(() => {
        setText(character?.quickNotes ?? '');
    }, [character?.id]);

    const handleChange = (value: string) => {
        setText(value);
        setQuickNotes(value);
        // Debounced direct save so notes persist even if autosave is slow
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const char = useCharacterStore.getState().character;
            if (char) saveCharacterToDb(char);
        }, 1500);
    };

    return (
        <div className="w-note-root">
            <textarea
                className="input w-note-area"
                placeholder="Vergate qui le vostre cronache della sessione…"
                value={text}
                onChange={e => handleChange(e.target.value)}
            />
        </div>
    );
};
