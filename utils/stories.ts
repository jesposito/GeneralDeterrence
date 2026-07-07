import { mulberry32, pick, type Rng } from './rng';

// "Where are they now?" — one line per life saved on the results screen. A mix of
// mundane, funny and genuinely moving, because that's the actual point of the job:
// the person you stopped goes on to have an ordinary life they'd otherwise have lost.

const NAMES = [
    'Bob', 'Aroha', 'Tama', 'Sione', 'Mere', 'Gary', 'Priya', 'Wiremu', 'Jess', 'Hemi',
    'Sam', 'Ana', 'Rawiri', 'Katie', 'Manu', 'Dave', 'Moana', 'Nikau', 'Sophie', 'Tane',
    'Lena', 'Kauri', 'Bex', 'Fetu', 'Marama', 'Trev', 'Anika', 'Mikaere', 'Shaz', 'Pita',
    'Holly', 'Rangi', 'Deb', 'Losa', 'Hana', 'Bruce', 'Kiri', 'Eru', 'Milly', 'Taika',
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
    '{name} made it to their kid\'s netball game. They lost 24–3. Great day anyway.',
    '{name} got the washing in before the southerly hit. Legend behaviour.',
    '{name} kept their dentist appointment. No fillings. Told everyone.',
    '{name} finally descaled the jug. The tea tastes better. Life is good.',
    '{name} arrived at the potluck with the good potato salad. It was gone in minutes.',
    '{name} renewed their WOF on time for the first time ever.',
    '{name} took the scenic route home on Sunday, just because.',
    '{name} spent Tuesday assembling a flat-pack drawer. Only two screws left over.',
    '{name} got the last carpark at the beach. Small wins.',
    '{name} watered the tomatoes all summer. Got four tomatoes. Worth it.',
    "{name} finally watched that show everyone's been on about. It was fine.",
    '{name} went home, hugged the dog, and fell asleep on the couch by nine.',
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
    '{name} started a sourdough. Named it Gerald. Gerald has outlived three flatmates.',
    '{name} won the office sweepstake and spent all of it on a novelty-sized Jandal.',
    '{name} got quietly famous for a fence-painting technique on the community Facebook page.',
    '{name} tried to break the regional record for most pies eaten at a school gala. Second place. Bitter about it.',
    '{name} bought a metal detector. Has found 47 bottle caps and one very confused crab.',
    "{name} became their street's unofficial mayor after the Great Wheelie Bin Storm of next July.",
    '{name} taught aqua aerobics to a class of retirees who now call them "Coach".',
    '{name} entered the gumboot throw at the A&P show. The gumboot is still airborne, some say.',
    '{name} finally learned to whistle at 43. Will not stop.',
    "{name} knitted a jersey for the neighbour's alpaca. The alpaca wears it with dignity.",
    '{name} got a personalised plate that just says CHUR. Waiting list was two years.',
    '{name} claims to have invented the mince and cheese toastie. Cannot be disproven locally.',
];

const AMAZING = [
    '{name} went on to found the research team that cured a rare childhood cancer.',
    '{name} became a search-and-rescue volunteer and pulled four trampers off the Tararuas alive.',
    "{name} raised two kids who both became ICU nurses. They saved hundreds more.",
    '{name} planted 80,000 native trees along the awa. The tūī came back in spring.',
    '{name} donated a kidney to a stranger. The stranger became their best mate.',
    '{name} became a youth mentor. Three of their kids are now doctors.',
    '{name} led the kiwi-recovery programme that brought the local population back from 12 birds.',
    "{name} wrote the children's book every Kiwi kid now learns to read with.",
    '{name} started a free driving school for teens who couldn\'t afford lessons. Zero crashes in ten years.',
    '{name} became a volunteer firefighter and carried two kids out of a house fire in 2031.',
    '{name} founded the food bank network that now feeds three towns every winter.',
    '{name} talked a stranger off a bridge one night. They have coffee every Thursday now.',
    '{name} became the surgeon who pioneered the technique that saved a prime minister.',
    '{name} coached the under-14s to nationals. Four of them made the Black Ferns.',
    '{name} built the wheelchair-accessible walkway to the summit lookout. Every sunrise belongs to everyone now.',
    '{name} fostered 31 kids over twenty years. All 31 came back for their 60th.',
    '{name} discovered a new species of wētā in their compost bin and gave it their nana\'s name.',
    '{name} set up the community patrol that halved burglaries in their suburb.',
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

// Dispatch radio chatter — one line at shift start, then occasional mid-shift lines.
const RADIO_CHATTER = [
    'Quiet night so far. Keep it that way, eh.',
    'Reports of a burnout on the main drag. Eyes open.',
    'Kick-off just ended at the stadium. Expect traffic.',
    "Rain's coming in later. Watch the speeds.",
    'School fair on today: extra foot traffic around the centre.',
    'Pūkeko on the carriageway again. Not a euphemism. Drive safe.',
    'Long weekend starts tonight. You know what that means.',
    'Coffee machine at the station is broken. Godspeed out there.',
    'Hoons doing skids at the roundabout. Ratepayers unimpressed.',
    'Tourist driving on the wrong side near the lookout. Again.',
    "Farmer's moving the mob across the highway. Mind the sheep.",
    "Someone's shouted the station chocolate fish. Morale is high.",
    'Speed camera van broke down. It’s all you tonight.',
    'Kererū flew into the station window. Bird is fine. Window is not.',
];

export function pickRadioChatter(): string {
    return RADIO_CHATTER[Math.floor(Math.random() * RADIO_CHATTER.length)];
}

// Occasional speech bubbles from passing cars. Very kiwi. Very occasional.
const CAR_CHATTER = [
    'Yeah, nah.', 'Chur.', 'Sweet as.', "She'll be right.", 'Hard out.',
    'Choice, bro.', 'Off to the dairy.', 'Gizza wave, officer.', 'Straight to the bach.',
    'Not even.', 'Taking the ute in.', 'Kai time.', 'Too easy.',
    'Nek minnit…', 'Tu meke.', 'Ka pai.', 'Heaps good.', 'Mint.',
    'Good as gold.', 'Box of birds, mate.', "She's a scorcher today.",
    'Couple mean pies in the back.', 'Just ducking to the dairy.',
    'Aw yeah, all good.', 'Bit fresh out, eh.', 'Chocka traffic today.',
    'Wheres the best chip shop, officer?', 'Running on petrol fumes and a dream.',
];
const WARN_REACTIONS = [
    'Yeah nah, sorry officer.', 'My bad, chur.', "Won't happen again, eh.", 'All good, slowing down.',
    'Good as gold, officer.', 'Cheers for the heads up, aye.', 'Hard case. Sorted now.',
];
const ENFORCE_REACTIONS = [
    'Fair cop.', 'Aw, not even ow.', 'Shot, officer…', 'The missus is gonna hear about this.',
    'Stink one.', 'Busted, eh.', "Mum's gonna kill me.", 'Nek minnit… ticket.',
];

export const pickCarChatter = (): string => CAR_CHATTER[Math.floor(Math.random() * CAR_CHATTER.length)];
export const pickWarnReaction = (): string => WARN_REACTIONS[Math.floor(Math.random() * WARN_REACTIONS.length)];
export const pickEnforceReaction = (): string => ENFORCE_REACTIONS[Math.floor(Math.random() * ENFORCE_REACTIONS.length)];

// ---------------------------------------------------------------------------
// Crime interdiction: once per shift a routine stop can uncover something far bigger.
// The real road-policing lesson — you never know what a stop will find.
export interface Interdiction {
    crime: string;      // short label for banners
    reveal: string;     // in-game flash when the enforce lands
    detail: string;     // end-screen story when busted
    missed: string;     // end-screen line when the car was only warned
}

const INTERDICTIONS: Interdiction[] = [
    {
        crime: 'Drug supply line',
        reveal: 'INTERDICTION: DRUG BUST',
        detail: 'That "routine" stop? Boot full of meth precursor. A whole supply line rolled up by teatime.',
        missed: 'One drove on: the boot full of meth precursor was never opened. Every stop is a chance to look deeper.',
    },
    {
        crime: 'Firearms find',
        reveal: 'INTERDICTION: FIREARMS FOUND',
        detail: 'A seatbelt stop turned up two stolen rifles under a blanket. Detectives sent chocolate biscuits.',
        missed: 'One drove on: two stolen rifles rode past under a blanket. A longer look might have found them.',
    },
    {
        crime: 'Stolen vehicle',
        reveal: 'INTERDICTION: STOLEN VEHICLE RECOVERED',
        detail: 'The plates didn\'t match the car. Someone in Ōtāhuhu got their nana\'s Corolla back.',
        missed: 'One drove on: the plates didn\'t match the car, but nobody checked. Nana\'s Corolla is still missing.',
    },
    {
        crime: 'Arrest warrant',
        reveal: 'INTERDICTION: WANTED PERSON ARRESTED',
        detail: 'The driver had a warrant to arrest and a very bad poker face. Routine stop, major clearance.',
        missed: 'One drove on: a driver with an outstanding warrant and a very good poker face.',
    },
    {
        crime: 'Serious assault prevented',
        reveal: 'INTERDICTION: SERIOUS HARM PREVENTED',
        detail: 'Intel later confirmed the driver was on their way to seriously hurt someone. The stop broke the chain.',
        missed: 'One drove on. What happened at the other end of that trip made the news for the wrong reasons.',
    },
    {
        crime: 'Burglary kit',
        reveal: 'INTERDICTION: BURGLARY KIT SEIZED',
        detail: 'Crowbar, gloves, and a hand-written list of addresses. Three burglaries that never happened.',
        missed: 'One drove on: a crowbar, gloves, and a list of addresses rode past in the back seat.',
    },
];

export const pickInterdiction = (): Interdiction =>
    INTERDICTIONS[Math.floor(Math.random() * INTERDICTIONS.length)];

// ---------------------------------------------------------------------------
// Passive education: principle-true briefing facts (no invented statistics) shown at
// shift start, and a contextual one-line debrief for the results screen.
const BRIEFING_FACTS = [
    'General deterrence: drivers change behaviour because they might be seen, not because they were stopped.',
    'RIDS: Restraints, Impairment, Distractions, Speed: the four behaviours behind most serious road harm.',
    'An unpredictable patrol pattern deters more than a predictable one. Keep them guessing.',
    'Every roadside stop is also a chance to educate, and occasionally to uncover something far worse.',
    'High-visibility presence protects roads you never drive. Word travels faster than you do.',
    'A warning delivered well can change behaviour as much as a ticket. Pick the right tool.',
    'Deterrence decays. A district patrolled yesterday is not a district patrolled today.',
];

export const pickBriefingFact = (): string =>
    BRIEFING_FACTS[Math.floor(Math.random() * BRIEFING_FACTS.length)];

// Real-world juxtaposition, Papers-Please style: the lesson lands by FORMAT (styled like
// your run stats), not lecture. Qualitative and defensible only — no invented statistics.
const REAL_SHIFT_LINES = [
    'Real patrols screen thousands of drivers a day. Nearly all are sober, and that is the point.',
    'Real road policing counts success in crashes that never happened.',
    'Real officers will tell you: the quiet shifts are the ones that worked.',
    'Real deterrence is invisible. Nobody thanks you for the crash they didn\'t have.',
    'Real shifts end with paperwork instead of a score screen. Otherwise: reasonably accurate.',
];
export const pickRealShiftLine = (seed: number): string =>
    REAL_SHIFT_LINES[Math.abs(seed) % REAL_SHIFT_LINES.length];

export function pickDebrief(stats: { coverageRatio: number; livesLost: number; enforcementScore: number; deterrenceScore: number }): string {
    if (stats.coverageRatio >= 0.7) {
        return 'That\'s general deterrence at work: everyone who saw you slowed down, including every driver you never stopped.';
    }
    if (stats.livesLost > 0) {
        return 'Some losses can\'t be chased down after the fact. Coverage and patrol posts buy time before the next one.';
    }
    if (stats.enforcementScore > stats.deterrenceScore * 2) {
        return 'Enforcement matters, but a ticket protects one road. Visible presence protects all of them at once.';
    }
    return 'Visible, unpredictable presence changes driver behaviour before offences happen. That\'s the whole job.';
}
