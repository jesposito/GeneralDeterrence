// Story Codex: collect one "where are they now?" story per completed shift-day.
// Pure localStorage; the collection payoff for streaks.

export interface CodexEntry {
    story: string;
    date: string; // YYYY-MM-DD collected
}

const KEY = 'gd-codex';

const dayKey = (d = new Date()): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function getCodex(): CodexEntry[] {
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** Add today's story if none collected yet today. Returns true if it was new. */
export function collectStory(story: string): boolean {
    try {
        const codex = getCodex();
        const today = dayKey();
        if (codex.some(e => e.date === today) || codex.some(e => e.story === story)) return false;
        codex.push({ story, date: today });
        localStorage.setItem(KEY, JSON.stringify(codex));
        return true;
    } catch {
        return false;
    }
}
