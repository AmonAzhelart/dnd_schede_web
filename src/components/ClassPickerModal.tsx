import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes, FaCheck, FaPencilAlt, FaSpinner } from 'react-icons/fa';
import { GiSwordman } from 'react-icons/gi';
import { classCatalog, type CatalogClass } from '../services/admin';
import { useIconCatalog } from '../services/iconCache';
import { pickLocalized } from '../i18n';
import './ClassPickerModal.css';

interface ClassPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (className: string, catalogClass?: CatalogClass) => void;
    currentValue?: string;
}

export const ClassPickerModal: React.FC<ClassPickerModalProps> = ({ isOpen, onClose, onSelect, currentValue }) => {
    const { i18n } = useTranslation();
    const lang = i18n.resolvedLanguage ?? 'it';

    const [catalogClasses, setCatalogClasses] = useState<CatalogClass[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [customInput, setCustomInput] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);

    const { getSvg } = useIconCatalog();

    useEffect(() => {
        if (!isOpen) return;
        setLoadingClasses(true);
        classCatalog.list().then(list => {
            setCatalogClasses(list);
            setLoadingClasses(false);
        });
    }, [isOpen]);

    const filtered = catalogClasses.filter(c =>
        pickLocalized(c.name, lang).toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="cpm-overlay" onClick={onClose}>
            <div className="cpm-modal" onClick={e => e.stopPropagation()}>
                <div className="cpm-header">
                    <h3>Seleziona Classe</h3>
                    <button className="cpm-close" onClick={onClose} aria-label="Chiudi">
                        <FaTimes />
                    </button>
                </div>

                <div className="cpm-search">
                    <FaSearch size={13} />
                    <input
                        type="text"
                        placeholder="Cerca classe..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                {!isCustomMode ? (
                    <>
                        <div className="cpm-list">
                            {loadingClasses ? (
                                <div className="cpm-loading"><FaSpinner className="cpm-spinner" size={18} /> Caricamento...</div>
                            ) : filtered.length === 0 ? (
                                <div className="cpm-empty">Nessuna classe trovata</div>
                            ) : (
                                filtered.map(cls => {
                                    const name = pickLocalized(cls.name, lang);
                                    const svg = getSvg(cls.iconId);
                                    const isActive = currentValue === name;
                                    return (
                                        <button
                                            key={cls.id}
                                            className={`cpm-item ${isActive ? 'active' : ''}`}
                                            onClick={() => { onSelect(name, cls); onClose(); }}
                                        >
                                            <span className="cpm-icon">
                                                {svg ? (
                                                    <span
                                                        className="cpm-svg-icon"
                                                        dangerouslySetInnerHTML={{ __html: svg }}
                                                    />
                                                ) : (
                                                    <GiSwordman size={18} />
                                                )}
                                            </span>
                                            <span className="cpm-name-block">
                                                <span className="cpm-name">{name}</span>
                                                <span className="cpm-meta">
                                                    d{cls.hitDie}
                                                    {' · BAB '}
                                                    {cls.babProgression === 'high' ? 'alto' : cls.babProgression === 'medium' ? 'medio' : 'basso'}
                                                    {cls.spellcasting?.type !== 'none' && cls.spellcasting?.type
                                                        ? ` · ${cls.spellcasting.type === 'arcane' ? 'Arcano' : 'Divino'}`
                                                        : ''}
                                                    {` · ${cls.skillPointsPerLevel} pt/lv`}
                                                </span>
                                            </span>
                                            {isActive && <FaCheck size={12} className="cpm-check" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <button
                            className="cpm-custom-toggle"
                            onClick={() => { setIsCustomMode(true); setCustomInput(''); }}
                        >
                            <FaPencilAlt size={11} /> Classe personalizzata
                        </button>
                    </>
                ) : (
                    <div className="cpm-custom-form">
                        <input
                            type="text"
                            className="input cpm-custom-input"
                            placeholder="Nome della classe..."
                            value={customInput}
                            onChange={e => setCustomInput(e.target.value)}
                            autoFocus
                        />
                        <div className="cpm-custom-buttons">
                            <button
                                className="btn btn-primary"
                                disabled={!customInput.trim()}
                                onClick={() => {
                                    if (customInput.trim()) { onSelect(customInput.trim()); onClose(); }
                                }}
                            >
                                Conferma
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => { setIsCustomMode(false); setCustomInput(''); }}
                            >
                                Indietro
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
