import { mulberry32, pick, type Rng } from './rng';

// "Where are they now?" — one line per life saved on the results screen. A mix of
// mundane, funny and genuinely moving, because that's the actual point of the job:
// the person you stopped goes on to have an ordinary life they'd otherwise have lost.

const NAMES = [
    'Bob', 'Aroha', 'Tama', 'Sione', 'Mere', 'Gary', 'Priya', 'Wiremu', 'Jess', 'Hemi',
    'Sam', 'Ana', 'Rawiri', 'Katie', 'Manu', 'Dave', 'Moana', 'Nikau', 'Sophie', 'Tane',
];

const MUNDANE = [
    '{name} got home in time for dinner. It was sausages.',
    '{name} finally returned those library books. Only 3 weeks overdue.',
    '{name} made it to work on Monday and complained about the traffic.',
    '{name} cleaned the gutters that weekend, like they kept saying they would.',
    "{name} watched the rugby on Saturday. Their team lost. They didn't mind.",
    '{name} remembered to buy milk on the way home. Trim, as requested.',
    '{name} went on to mow the lawns every second Sunday for 40 more years.',
    '{name} finally fixed the squeaky gate. The neighbours sent a card.',
];

const FUNNY = [
    '{name} went on to win $23 on Lotto and told everyone it was "basically a house deposit".',
    '{name} became the regional lawn bowls champion. Nobody knows how. Least of all {name}.',
    "{name} adopted three rescue greyhounds and named them all Kevin.",
    '{name} invented a pie-warmer alarm clock. It failed commercially but wins every argument at parties.',
    '{name} got really into competitive birdwatching and now owes the tūī an apology.',
    '{name} taught their pūkeko to fetch. Sort of. The pūkeko disagrees.',
    '{name} entered MasterChef with a cheese roll recipe. Eliminated week one. No regrets.',
    "{name} finally beat their nan at Scrabble after 14 years. She demanded a rematch. She won.",
];

const AMAZING = [
    '{name} went on to found the research team that cured a rare childhood cancer.',
    '{name} became a search-and-rescue volunteer and pulled four trampers off the Tararuas alive.',
    "{name} raised two kids who both became ICU nurses. They saved hundreds more.",
    '{name} planted 80,000 native trees along the awa. The tūī came back in spring.',
    '{name} donated a kidney to a stranger. The stranger became their best mate.',
    '{name} became a youth mentor — three of their kids are now doctors.',
    '{name} led the kiwi-recovery programme that brought the local population back from 12 birds.',
    "{name} wrote the children's book every Kiwi kid now learns to read with.",
];

export interface SavedLifeStory {
    name: string;
    story: string;
}

/**
 * Deterministic per (seed) so re-renders (and StrictMode) show the same stories.
 * Weighted: mundane lives are the most common — that's the honest lesson.
 */
export function generateSavedLifeStories(count: number, seed: number): SavedLifeStory[] {
    const rng: Rng = mulberry32(seed);
    const usedNames = new Set<string>();
    const stories: SavedLifeStory[] = [];
    for (let i = 0; i < count; i++) {
        let name = pick(rng, NAMES);
        while (usedNames.has(name) && usedNames.size < NAMES.length) name = pick(rng, NAMES);
        usedNames.add(name);
        const roll = rng();
        const pool = roll < 0.4 ? MUNDANE : roll < 0.75 ? FUNNY : AMAZING;
        stories.push({ name, story: pick(rng, pool).replace('{name}', name) });
    }
    return stories;
}

// Pre-shift dispatch chatter — one line as the shift starts.
const RADIO_CHATTER = [
    'Dispatch: quiet night so far. Keep it that way, eh.',
    'Dispatch: reports of a burnout on the main drag. Eyes open.',
    'Dispatch: kick-off just ended at the stadium. Expect traffic.',
    "Dispatch: rain's coming in later. Watch the speeds.",
    'Dispatch: school fair on today — extra foot traffic around the centre.',
    'Dispatch: pūkeko on the carriageway again. Not a euphemism. Drive safe.',
    'Dispatch: long weekend starts tonight. You know what that means.',
    'Dispatch: coffee machine at the station is broken. Godspeed out there.',
];

export function pickRadioChatter(): string {
    return RADIO_CHATTER[Math.floor(Math.random() * RADIO_CHATTER.length)];
}

// Occasional speech bubbles from passing cars. Very kiwi. Very occasional.
const CAR_CHATTER = [
    'Yeah, nah.', 'Chur.', 'Sweet as.', "She'll be right.", 'Hard out.',
    'Choice, bro.', 'Off to the dairy.', 'Gizza wave, officer.', 'Straight to the bach.',
    'Not even.', 'Taking the ute in.', 'Kai time.', 'Too easy.',
];
const WARN_REACTIONS = [
    'Yeah nah, sorry officer.', 'My bad, chur.', "Won't happen again, eh.", 'All good, slowing down.',
];
const ENFORCE_REACTIONS = [
    'Fair cop.', 'Aw, not even ow.', 'Shot, officer…', 'The missus is gonna hear about this.',
];

export const pickCarChatter = (): string => CAR_CHATTER[Math.floor(Math.random() * CAR_CHATTER.length)];
export const pickWarnReaction = (): string => WARN_REACTIONS[Math.floor(Math.random() * WARN_REACTIONS.length)];
export const pickEnforceReaction = (): string => ENFORCE_REACTIONS[Math.floor(Math.random() * ENFORCE_REACTIONS.length)];
