import { GoogleGenAI } from '@google/genai';
import type { CharacterBase } from '../types/dnd';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = 'gemini-2.0-flash';

export const isGeminiConfigured = () => !!API_KEY;

let client: GoogleGenAI | null = null;
const getClient = () => {
    if (!API_KEY) throw new Error('VITE_GEMINI_API_KEY non configurato');
    if (!client) client = new GoogleGenAI({ apiKey: API_KEY });
    return client;
};

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const characterContext = (c: CharacterBase | null): string => {
    if (!c) return '';
    const stats = c.baseStats;
    return [
        `Personaggio attuale del giocatore:`,
        `- Nome: ${c.name}`,
        `- Razza: ${c.race} | Classe: ${c.characterClass} | Livello: ${c.level}`,
        `- Allineamento: ${c.alignment}`,
        `- Stats: STR ${stats.str}, DEX ${stats.dex}, CON ${stats.con}, INT ${stats.int}, WIS ${stats.wis}, CHA ${stats.cha}`,
        `- HP: ${c.hpDetails?.current ?? stats.hp}/${c.hpDetails?.max ?? stats.hp} | CA: ${stats.ac} | Velocità: ${stats.speed}ft`,
        c.feats?.length ? `- Talenti principali: ${c.feats.slice(0, 6).map(f => f.name).join(', ')}` : '',
        c.inventory?.length ? `- Equipaggiamento principale: ${c.inventory.slice(0, 8).map(i => i.name).join(', ')}` : '',
    ].filter(Boolean).join('\n');
};

const systemForChat = (c: CharacterBase | null) => `Sei un assistente esperto di D&D / Pathfinder che aiuta un giocatore durante le sessioni.
Rispondi in italiano, in modo conciso ma utile. Cita regole quando rilevante.
${characterContext(c)}`;

export const sendChatMessage = async (
    history: ChatMessage[],
    userMessage: string,
    character: CharacterBase | null,
): Promise<string> => {
    const ai = getClient();
    const chat = ai.chats.create({
        model: MODEL,
        config: { systemInstruction: systemForChat(character) },
        history: history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    });
    const resp = await chat.sendMessage({ message: userMessage });
    return resp.text ?? '';
};

export interface NotebookSource {
    name: string;
    content: string;
}

export const askAboutDocuments = async (
    sources: NotebookSource[],
    question: string,
    character: CharacterBase | null,
): Promise<string> => {
    const ai = getClient();
    const sourcesBlock = sources
        .map((s, i) => `=== DOCUMENTO ${i + 1}: ${s.name} ===\n${s.content.slice(0, 200_000)}`)
        .join('\n\n');

    const system = `Sei un assistente che risponde a domande basandosi ESCLUSIVAMENTE sui documenti forniti dall'utente.
Se l'informazione non è nei documenti, dillo esplicitamente. Cita sempre il nome del documento da cui traggi l'informazione.
Rispondi in italiano. ${characterContext(character)}`;

    const resp = await ai.models.generateContent({
        model: MODEL,
        config: { systemInstruction: system },
        contents: `${sourcesBlock}\n\n=== DOMANDA DEL GIOCATORE ===\n${question}`,
    });
    return resp.text ?? '';
};
