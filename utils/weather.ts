import { Rng } from './rng';

// Weather + seasons. Southern-hemisphere seasons come from the real date; weather rolls
// per map seed with season-biased odds, so everyone's Daily Shift shares conditions.
// Driving-condition modifiers feed the sim: rain cuts grip and raises risk, fog cuts
// vision. The teaching angle: worse conditions make visible presence matter more.

export type WeatherKind = 'clear' | 'rain' | 'fog' | 'wind';
export type Season = 'summer' | 'autumn' | 'winter' | 'spring';

export interface Weather {
    kind: WeatherKind;
    season: Season;
    /** 0.6..1.0 for non-clear weather; scales the visual + sim effects. */
    intensity: number;
    label: string; // "Rain, Winter"
    /** <1 = slipperier (scales lateral grip toward drifty). */
    grip: number;
    /** Civilian traffic speed multiplier. */
    civilianSpeed: number;
    /** Life-at-Risk chance multiplier. */
    larChance: number;
    /** Fog only: fraction of the viewport radius still visible (1 = all). */
    vision: number;
}

export function seasonForDate(date = new Date()): Season {
    const m = date.getMonth(); // 0-11, NZ seasons
    if (m === 11 || m <= 1) return 'summer';
    if (m <= 4) return 'autumn';
    if (m <= 7) return 'winter';
    return 'spring';
}

// Season-biased weather odds (cumulative pick order: rain, fog, wind, else clear).
const ODDS: Record<Season, { rain: number; fog: number; wind: number }> = {
    summer: { rain: 0.12, fog: 0.03, wind: 0.10 },
    autumn: { rain: 0.25, fog: 0.12, wind: 0.13 },
    winter: { rain: 0.35, fog: 0.18, wind: 0.12 },
    spring: { rain: 0.22, fog: 0.06, wind: 0.22 },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function rollWeather(rng: Rng, date = new Date()): Weather {
    const season = seasonForDate(date);
    const o = ODDS[season];
    const r = rng();
    const intensity = 0.6 + rng() * 0.4;
    const base: Weather = {
        kind: 'clear', season, intensity, label: `Clear, ${cap(season)}`,
        grip: 1, civilianSpeed: 1, larChance: 1, vision: 1,
    };
    if (r < o.rain) {
        return {
            ...base, kind: 'rain', label: `Rain, ${cap(season)}`,
            grip: 1 - 0.35 * intensity,       // ponytail:tune
            civilianSpeed: 1 - 0.15 * intensity,
            larChance: 1 + 0.3 * intensity,
        };
    }
    if (r < o.rain + o.fog) {
        return {
            ...base, kind: 'fog', label: `Fog, ${cap(season)}`,
            civilianSpeed: 1 - 0.1 * intensity,
            larChance: 1 + 0.2 * intensity,
            vision: 1 - 0.45 * intensity,
        };
    }
    if (r < o.rain + o.fog + o.wind) {
        return {
            ...base, kind: 'wind', label: `Wind, ${cap(season)}`,
            civilianSpeed: 1 - 0.05 * intensity,
        };
    }
    return base;
}

/** The active shift's weather. Set by mapGen.regenerateMap; read by the sim + renderer. */
export const currentWeatherRef: { current: Weather } = {
    current: { kind: 'clear', season: 'summer', intensity: 0, label: 'Clear', grip: 1, civilianSpeed: 1, larChance: 1, vision: 1 },
};

export function weatherRadioLine(w: Weather): string | null {
    switch (w.kind) {
        case 'rain': return 'Rain on the roads tonight. Grip is down, stopping distances are up. Presence matters more, not less.';
        case 'fog': return 'Fog rolling through. Visibility is short, so patrol tight and trust the compass.';
        case 'wind': return 'Blustery one out there. Watch the high-siders and keep the speeds honest.';
        default: return null;
    }
}
