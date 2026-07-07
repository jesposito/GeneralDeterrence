import { FinalScoreBreakdown } from '../types';
import { DISTRICT_DEFINITIONS } from './mapData';

// Share artifact (Wordle lesson: a spoiler-free story in a matchbox).
// Grid = patrol-time share per district: 🟩 solid presence, 🟨 drive-by, ⬛ neglected.
// The interdiction car is deliberately NEVER mentioned — that's the spoiler.

/** Host-agnostic: links to wherever the game is currently served. */
export const gameUrl = (): string =>
    typeof window !== 'undefined' ? window.location.origin : '';

/** Daily shift number — days since 2026-01-01 (shared by everyone on the same date). */
export function shiftNumber(date = new Date()): number {
    const base = new Date(2026, 0, 1).getTime();
    return Math.max(1, Math.floor((date.getTime() - base) / 86_400_000) + 1);
}

export function districtGlyphs(patrolPath: { x: number; y: number }[]): string {
    if (!patrolPath || patrolPath.length === 0) return '⬛⬛⬛⬛⬛';
    const counts = new Map<string, number>(DISTRICT_DEFINITIONS.map(d => [d.id, 0]));
    for (const p of patrolPath) {
        for (const d of DISTRICT_DEFINITIONS) {
            const b = d.bounds;
            if (p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) {
                counts.set(d.id, (counts.get(d.id) || 0) + 1);
                break;
            }
        }
    }
    const total = patrolPath.length;
    return DISTRICT_DEFINITIONS
        .map(d => {
            const pct = (counts.get(d.id) || 0) / total;
            return pct >= 0.15 ? '🟩' : pct >= 0.06 ? '🟨' : '⬛'; // ponytail:tune thresholds
        })
        .join('');
}

export interface ShareContext {
    mode: 'daily' | 'free';
    storyLine?: string;      // one saved-life story, if any
    percentile?: number | null;
    streak?: number;
}

export function buildShareText(b: FinalScoreBreakdown, ctx: ShareContext): string {
    const header = ctx.mode === 'daily'
        ? `General Deterrence #${shiftNumber()} 🚔 Grade ${b.presenceGrade}`
        : `General Deterrence Free Patrol 🚔 Grade ${b.presenceGrade}`;
    const statBits = [
        `${b.offencesPrevented} prevented`,
        `${b.livesSaved} ${b.livesSaved === 1 ? 'life' : 'lives'} saved`,
    ];
    if (b.overtime) statBits.push('⏱ OVERTIME earned');
    if (ctx.percentile) statBits.push(`Top ${ctx.percentile}% today`);
    if (ctx.streak && ctx.streak > 1) statBits.push(`🔥 ${ctx.streak}-day streak`);

    const lines = [
        header,
        districtGlyphs(b.patrolPath),
        statBits.join(' · '),
    ];
    if (ctx.storyLine) lines.push(`Saved tonight: ${ctx.storyLine}`);
    lines.push(`Cops you can see stop crashes you never hear about. ${gameUrl()}`);
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PNG share card (canvas → blob) for navigator.share({ files }). 1080×1350 (4:5 social).
const CARD_W = 1080;
const CARD_H = 1350;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        const trial = line ? `${line} ${w}` : w;
        if (ctx.measureText(trial).width > maxWidth && line) {
            lines.push(line);
            line = w;
        } else {
            line = trial;
        }
    }
    if (line) lines.push(line);
    return lines;
}

export async function buildShareCard(b: FinalScoreBreakdown, ctx: ShareContext): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const g = canvas.getContext('2d');
    if (!g) return null;

    g.fillStyle = '#0d0221';
    g.fillRect(0, 0, CARD_W, CARD_H);
    // Subtle grid backdrop
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < CARD_W; x += 72) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CARD_H); g.stroke(); }
    for (let y = 0; y < CARD_H; y += 72) { g.beginPath(); g.moveTo(0, y); g.lineTo(CARD_W, y); g.stroke(); }

    g.textAlign = 'center';
    g.fillStyle = '#22d3ee';
    g.font = 'bold 64px Orbitron, sans-serif';
    g.fillText('GENERAL DETERRENCE', CARD_W / 2, 130);
    g.fillStyle = '#f472b6';
    g.font = '42px Rajdhani, sans-serif';
    g.fillText(ctx.mode === 'daily' ? `Daily Shift #${shiftNumber()}` : 'Free Patrol', CARD_W / 2, 195);

    // Grade badge
    const gradeColor: Record<string, string> = { S: '#fde047', A: '#4ade80', B: '#facc15', C: '#f87171' };
    g.strokeStyle = gradeColor[b.presenceGrade];
    g.lineWidth = 10;
    g.strokeRect(CARD_W / 2 - 110, 250, 220, 220);
    g.fillStyle = gradeColor[b.presenceGrade];
    g.font = 'bold 160px Orbitron, sans-serif';
    g.fillText(b.presenceGrade, CARD_W / 2, 420);
    g.font = '36px Rajdhani, sans-serif';
    g.fillText('PRESENCE GRADE', CARD_W / 2, 520);

    // Coverage squares
    const glyphs = districtGlyphs(b.patrolPath);
    const sq = 90, gap = 22;
    const rowW = 5 * sq + 4 * gap;
    let sx = (CARD_W - rowW) / 2;
    const colors: Record<string, string> = { '🟩': '#22c55e', '🟨': '#eab308', '⬛': '#1f2937' };
    for (const ch of [...glyphs]) {
        g.fillStyle = colors[ch] || '#1f2937';
        g.fillRect(sx, 580, sq, sq);
        sx += sq + gap;
    }

    g.fillStyle = '#ffffff';
    g.font = 'bold 52px Rajdhani, sans-serif';
    const statLine = `${b.offencesPrevented} offences prevented · ${b.livesSaved} ${b.livesSaved === 1 ? 'life' : 'lives'} saved${b.overtime ? ' · OVERTIME' : ''}`;
    g.fillText(statLine, CARD_W / 2, 760);
    if (ctx.percentile) {
        g.fillStyle = '#fde047';
        g.fillText(`Top ${ctx.percentile}% today`, CARD_W / 2, 830);
    }

    if (ctx.storyLine) {
        g.fillStyle = '#86efac';
        g.font = 'italic 44px Rajdhani, sans-serif';
        const wrapped = wrapText(g, `“Saved tonight: ${ctx.storyLine}”`, CARD_W - 160);
        let y = 950;
        for (const line of wrapped.slice(0, 4)) { g.fillText(line, CARD_W / 2, y); y += 58; }
    }

    g.fillStyle = '#9ca3af';
    g.font = '40px Rajdhani, sans-serif';
    g.fillText('Cops you can see stop crashes you never hear about.', CARD_W / 2, 1230);
    g.fillStyle = '#22d3ee';
    g.font = 'bold 44px Rajdhani, sans-serif';
    g.fillText(gameUrl().replace(/^https?:\/\//, ''), CARD_W / 2, 1295);

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
}
