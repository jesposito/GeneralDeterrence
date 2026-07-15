import { DistrictName, RoadType } from '../types';
import {
    ROAD_NODES, ROAD_SEGMENTS, DISTRICT_DEFINITIONS, mapVersionRef,
    RoadNode, RoadSegment, DistrictDefinition,
} from './mapData';
import { mulberry32, pick, range, type Rng } from './rng';
import { rollWeather, currentWeatherRef, type Season } from './weather';

// Procedural map generator. Selects a seeded road-network grammar, builds it in a
// canonical frame, then applies seeded flips for orientation variety. District IDs never
// change, so every balance constant keyed by DistrictName keeps working.

const WORLD_W = 1280 * 3;
const WORLD_H = 720 * 3;

export interface GeneratedMapMeta {
    seed: number;
    themeName: string;
    layoutName: string;
    topologyName: string;
}

// ---------------------------------------------------------------------------
// Regions: each map rolls a regional character that drives its scenery profile and
// biases its theme — a High Country run FEELS different from a Geothermal one.
export type DecorType =
    | 'tree' | 'house' | 'building' | 'warehouse'
    | 'cabbageTree' | 'ponga' | 'pohutukawa' | 'flax'
    | 'sheep' | 'pukeko' | 'kiwi' | 'kereru' | 'tui'
    | 'steamVent' | 'boulder' | 'vineyard'
    | 'clothesline' | 'trampoline' | 'rugbyPosts';

export interface MapRegion {
    name: string;
    themeNames: string[]; // theme picked from these
    decorProfile: Record<DistrictName, { type: DecorType; count: number }[]>;
}

const REGIONS: MapRegion[] = [
    {
        name: 'Coastal Run',
        themeNames: ['Neon Night', 'Rainshift'],
        decorProfile: {
            'Karori North': [{ type: 'pohutukawa', count: 50 }, { type: 'flax', count: 50 }, { type: 'sheep', count: 40 }, { type: 'tree', count: 60 }, { type: 'kiwi', count: 8 }],
            'Karori West': [{ type: 'house', count: 70 }, { type: 'pohutukawa', count: 18 }, { type: 'tui', count: 12 }, { type: 'clothesline', count: 14 }, { type: 'trampoline', count: 10 }, { type: 'rugbyPosts', count: 2 }],
            'Karori Central': [{ type: 'building', count: 45 }, { type: 'pukeko', count: 8 }, { type: 'flax', count: 10 }],
            'Karori East': [{ type: 'warehouse', count: 28 }, { type: 'flax', count: 28 }, { type: 'pukeko', count: 10 }],
            'Karori': [{ type: 'pohutukawa', count: 26 }, { type: 'kereru', count: 10 }, { type: 'house', count: 10 }],
        },
    },
    {
        name: 'High Country',
        themeNames: ['Frostbeat', 'Aurora Watch'],
        decorProfile: {
            'Karori North': [{ type: 'boulder', count: 60 }, { type: 'sheep', count: 110 }, { type: 'tree', count: 40 }, { type: 'flax', count: 25 }],
            'Karori West': [{ type: 'house', count: 62 }, { type: 'cabbageTree', count: 18 }, { type: 'boulder', count: 12 }, { type: 'clothesline', count: 12 }, { type: 'trampoline', count: 8 }, { type: 'rugbyPosts', count: 2 }],
            'Karori Central': [{ type: 'building', count: 40 }, { type: 'ponga', count: 8 }],
            'Karori East': [{ type: 'warehouse', count: 26 }, { type: 'boulder', count: 20 }, { type: 'flax', count: 15 }],
            'Karori': [{ type: 'boulder', count: 16 }, { type: 'flax', count: 14 }, { type: 'house', count: 8 }],
        },
    },
    {
        name: 'Heartland',
        themeNames: ['Dusk Patrol', 'Ember Line'],
        decorProfile: {
            'Karori North': [{ type: 'vineyard', count: 70 }, { type: 'sheep', count: 80 }, { type: 'cabbageTree', count: 40 }, { type: 'kiwi', count: 6 }],
            'Karori West': [{ type: 'house', count: 66 }, { type: 'cabbageTree', count: 22 }, { type: 'tui', count: 8 }, { type: 'clothesline', count: 12 }, { type: 'trampoline', count: 9 }, { type: 'rugbyPosts', count: 2 }],
            'Karori Central': [{ type: 'building', count: 42 }, { type: 'pukeko', count: 8 }],
            'Karori East': [{ type: 'warehouse', count: 34 }, { type: 'vineyard', count: 18 }, { type: 'flax', count: 15 }],
            'Karori': [{ type: 'vineyard', count: 14 }, { type: 'house', count: 12 }, { type: 'kereru', count: 6 }],
        },
    },
    {
        name: 'Geothermal',
        themeNames: ['Ember Line', 'Aurora Watch'],
        decorProfile: {
            'Karori North': [{ type: 'steamVent', count: 45 }, { type: 'ponga', count: 55 }, { type: 'flax', count: 35 }, { type: 'kiwi', count: 10 }],
            'Karori West': [{ type: 'house', count: 62 }, { type: 'ponga', count: 20 }, { type: 'tui', count: 8 }, { type: 'clothesline', count: 12 }, { type: 'trampoline', count: 8 }, { type: 'rugbyPosts', count: 2 }],
            'Karori Central': [{ type: 'building', count: 42 }, { type: 'steamVent', count: 8 }, { type: 'ponga', count: 8 }],
            'Karori East': [{ type: 'warehouse', count: 28 }, { type: 'steamVent', count: 14 }, { type: 'flax', count: 12 }],
            'Karori': [{ type: 'steamVent', count: 14 }, { type: 'ponga', count: 12 }, { type: 'kereru', count: 8 }],
        },
    },
    {
        name: 'Big Smoke',
        themeNames: ['Neon Night', 'Rainshift'],
        decorProfile: {
            'Karori North': [{ type: 'tree', count: 90 }, { type: 'sheep', count: 40 }, { type: 'cabbageTree', count: 30 }, { type: 'flax', count: 20 }],
            'Karori West': [{ type: 'house', count: 95 }, { type: 'tui', count: 15 }, { type: 'cabbageTree', count: 12 }, { type: 'clothesline', count: 16 }, { type: 'trampoline', count: 12 }, { type: 'rugbyPosts', count: 3 }],
            'Karori Central': [{ type: 'building', count: 65 }, { type: 'pukeko', count: 10 }, { type: 'ponga', count: 8 }],
            'Karori East': [{ type: 'warehouse', count: 40 }, { type: 'flax', count: 18 }, { type: 'pukeko', count: 10 }],
            'Karori': [{ type: 'house', count: 16 }, { type: 'pohutukawa', count: 12 }, { type: 'kereru', count: 8 }],
        },
    },
];

/** The active map's region (null → renderer falls back to its base scenery profile). */
export const currentRegionRef: { current: MapRegion | null } = { current: null };

// ---------------------------------------------------------------------------
// Themes: per-district ground tints + decor colors. "Neon Night" = the original look.
interface Theme {
    name: string;
    ground: Record<DistrictName, string>;
    decor: Record<DistrictName, string>;
    road: string;
}

const THEMES: Theme[] = [
    {
        name: 'Neon Night',
        ground: { 'Karori': 'rgba(5, 5, 20, 0.8)', 'Karori Central': 'rgba(7, 8, 33, 0.7)', 'Karori North': 'rgba(26, 10, 59, 0.7)', 'Karori West': 'rgba(28, 13, 64, 0.7)', 'Karori East': 'rgba(17, 13, 44, 0.7)' },
        decor: { 'Karori': '#a0aec0', 'Karori Central': '#22d3ee', 'Karori North': '#34d399', 'Karori West': '#fb923c', 'Karori East': '#facc15' },
        road: '#374151',
    },
    {
        name: 'Dusk Patrol',
        ground: { 'Karori': 'rgba(30, 12, 8, 0.8)', 'Karori Central': 'rgba(42, 18, 10, 0.7)', 'Karori North': 'rgba(48, 22, 30, 0.7)', 'Karori West': 'rgba(38, 16, 22, 0.7)', 'Karori East': 'rgba(28, 14, 16, 0.7)' },
        decor: { 'Karori': '#f6ad55', 'Karori Central': '#fbbf24', 'Karori North': '#f87171', 'Karori West': '#fb923c', 'Karori East': '#fde047' },
        road: '#44403c',
    },
    {
        name: 'Rainshift',
        ground: { 'Karori': 'rgba(4, 18, 24, 0.8)', 'Karori Central': 'rgba(6, 26, 34, 0.7)', 'Karori North': 'rgba(8, 34, 36, 0.7)', 'Karori West': 'rgba(6, 28, 40, 0.7)', 'Karori East': 'rgba(5, 22, 30, 0.7)' },
        decor: { 'Karori': '#7dd3fc', 'Karori Central': '#2dd4bf', 'Karori North': '#4ade80', 'Karori West': '#38bdf8', 'Karori East': '#a5f3fc' },
        road: '#334155',
    },
    {
        name: 'Aurora Watch',
        ground: { 'Karori': 'rgba(10, 6, 30, 0.8)', 'Karori Central': 'rgba(14, 10, 44, 0.7)', 'Karori North': 'rgba(6, 30, 34, 0.7)', 'Karori West': 'rgba(20, 8, 44, 0.7)', 'Karori East': 'rgba(8, 18, 40, 0.7)' },
        decor: { 'Karori': '#c4b5fd', 'Karori Central': '#a78bfa', 'Karori North': '#5eead4', 'Karori West': '#f0abfc', 'Karori East': '#93c5fd' },
        road: '#3f3f56',
    },
    {
        name: 'Ember Line',
        ground: { 'Karori': 'rgba(24, 6, 6, 0.8)', 'Karori Central': 'rgba(34, 10, 8, 0.7)', 'Karori North': 'rgba(40, 16, 6, 0.7)', 'Karori West': 'rgba(30, 10, 12, 0.7)', 'Karori East': 'rgba(22, 8, 10, 0.7)' },
        decor: { 'Karori': '#fca5a5', 'Karori Central': '#f97316', 'Karori North': '#fbbf24', 'Karori West': '#ef4444', 'Karori East': '#fdba74' },
        road: '#451a1a',
    },
    {
        name: 'Frostbeat',
        ground: { 'Karori': 'rgba(10, 14, 28, 0.8)', 'Karori Central': 'rgba(14, 20, 38, 0.7)', 'Karori North': 'rgba(20, 28, 48, 0.7)', 'Karori West': 'rgba(12, 22, 42, 0.7)', 'Karori East': 'rgba(10, 18, 34, 0.7)' },
        decor: { 'Karori': '#e2e8f0', 'Karori Central': '#bae6fd', 'Karori North': '#f1f5f9', 'Karori West': '#93c5fd', 'Karori East': '#cbd5e1' },
        road: '#1e293b',
    },
];

// ---------------------------------------------------------------------------
// Canonical-frame generation. Node ids reuse the hand map's prefixes (m/c/s/r/i/h)
// purely for debuggability.

interface Built {
    nodes: RoadNode[];
    segments: RoadSegment[];
    districts: DistrictDefinition[];
}

function buildCanonical(rng: Rng): Built {
    const nodes: RoadNode[] = [];
    const segments: RoadSegment[] = [];
    const node = (id: string, x: number, y: number): string => {
        nodes.push({ id, pos: { x: Math.round(x), y: Math.round(y) } });
        return id;
    };
    const seg = (a: string, b: string, type: RoadType) =>
        segments.push({ id: `seg-${a}-${b}`, startNodeId: a, endNodeId: b, type });
    const j = (amt: number) => range(rng, -amt, amt); // jitter

    // Motorway: vertical corridor on the east edge.
    const mx = 3400 + j(120);
    const mYs = [100 + j(50), range(rng, 550, 850), range(rng, 1350, 1650), 2000 + j(60)];
    const m = mYs.map((y, i) => node(`m${i + 1}`, mx + j(40), y));
    for (let i = 0; i < m.length - 1; i++) seg(m[i], m[i + 1], 'Motorway');

    // Town Centre: cols x rows grid, roughly centred.
    const cols = pick(rng, [2, 3] as const);
    const rows = pick(rng, [2, 3] as const);
    const cellW = range(rng, 340, 440);
    const cellH = range(rng, 270, 330);
    const gridX = 1900 + j(160) - ((cols - 1) * cellW) / 2;
    const gridY = 1200 + j(120) - ((rows - 1) * cellH) / 2;
    const grid: string[][] = [];
    for (let r = 0; r < rows; r++) {
        grid.push([]);
        for (let c = 0; c < cols; c++) {
            grid[r].push(node(`c${r}_${c}`, gridX + c * cellW + j(35), gridY + r * cellH + j(35)));
        }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) seg(grid[r][c], grid[r][c + 1], 'Primary');
        if (r + 1 < rows) seg(grid[r][c], grid[r + 1][c], 'Primary');
    }
    const cTL = grid[0][0], cTR = grid[0][cols - 1], cBL = grid[rows - 1][0], cBR = grid[rows - 1][cols - 1];

    // Centre ↔ motorway connectors (two, for loop routes).
    const cm1 = node('cm1', 2800 + j(80), gridY + j(60));
    const cm2 = node('cm2', 2800 + j(80), gridY + (rows - 1) * cellH + j(60));
    seg(cTR, cm1, 'Primary'); seg(cm1, m[1], 'Primary');
    seg(cBR, cm2, 'Primary'); seg(cm2, m[2], 'Primary');

    // Suburban west: 2x2 ring + tail.
    const sx = 500 + j(80), sy = 900 + j(60);
    const sW = range(rng, 600, 800), sH = range(rng, 500, 650);
    const s1 = node('s1', sx, sy);
    const s2 = node('s2', sx + sW, sy + j(40));
    const s3 = node('s3', sx + j(40), sy + sH);
    const s4 = node('s4', sx + sW + j(40), sy + sH + j(40));
    const s5 = node('s5', sx + sW / 2 + j(60), sy + sH + range(rng, 220, 340));
    seg(s1, s2, 'Suburban'); seg(s1, s3, 'Suburban'); seg(s2, s4, 'Suburban');
    seg(s3, s4, 'Suburban'); seg(s3, s5, 'Suburban'); seg(s4, s5, 'Suburban');
    seg(cTL, s2, 'Primary'); seg(cBL, s4, 'Primary');

    // Rural north: winding chain across the top; ends tied to suburb + motorway.
    const ruralCount = pick(rng, [4, 5, 6] as const);
    const rXs: string[] = [];
    for (let i = 0; i < ruralCount; i++) {
        const x = 450 + ((2500 - 450) / (ruralCount - 1)) * i + j(90);
        const y = (i % 2 === 0 ? 220 : 430) + j(90);
        rXs.push(node(`r${i + 1}`, x, y));
    }
    for (let i = 0; i < rXs.length - 1; i++) seg(rXs[i], rXs[i + 1], 'Rural');
    seg(s1, rXs[0], 'Rural');
    const rSpur = node('rs', 2850 + j(60), 200 + j(60));
    seg(rXs[rXs.length - 1], rSpur, 'Rural'); seg(rSpur, m[0], 'Rural');
    seg(rXs[rXs.length - 1], m[0], 'Rural');
    seg(cTL, rXs[Math.min(1, rXs.length - 1)], 'Rural');
    const ruralMaxY = Math.max(...rXs.map(id => nodes.find(n => n.id === id)!.pos.y), 430);

    // Industrial south: chain tied to motorway end, centre and suburb tail.
    const i1 = node('i1', 1700 + j(80), 2000 + j(50));
    const i2 = node('i2', 2800 + j(80), 2000 + j(50));
    const i3 = node('i3', 2100 + j(80), 1820 + j(50));
    seg(i1, i2, 'Industrial'); seg(i3, i2, 'Industrial'); seg(i1, s5, 'Industrial');
    seg(i2, m[3], 'Industrial'); seg(cBL, i1, 'Primary'); seg(cBR, i3, 'Primary');

    // Karori pocket: secluded loop off the suburb's SW corner.
    const kx = 350 + j(60), ky = 1850 + j(60);
    const kEntry = node('k_entry', kx - 50, ky - 250);
    const h = [
        node('h1', kx - 200, ky - 100), node('h2', kx - 200, ky + 100),
        node('h3', kx, ky + 200), node('h4', kx + 200, ky + 100), node('h5', kx + 200, ky - 100),
    ];
    seg(s3, kEntry, 'Suburban'); seg(kEntry, h[0], 'Suburban');
    for (let i = 0; i < h.length - 1; i++) seg(h[i], h[i + 1], 'Suburban');

    // Districts — order matters (specific before large), ids fixed.
    const boundaryY = Math.min(820, ruralMaxY + 260);
    const midX = WORLD_W / 2;
    const kMinX = Math.max(0, kx - 320), kMinY = ky - 320;
    const cPad = 180;
    const districts: DistrictDefinition[] = [
        { id: 'Karori', name: 'Karori', bounds: { x: kMinX, y: kMinY, width: 640, height: Math.min(WORLD_H - kMinY, 640) }, theme: { groundColor: '', roadColor: '', decorColor: '' } },
        { id: 'Karori Central', name: 'Town Centre', bounds: { x: gridX - cPad, y: gridY - cPad, width: (cols - 1) * cellW + cPad * 2, height: (rows - 1) * cellH + cPad * 2 }, theme: { groundColor: '', roadColor: '', decorColor: '' } },
        { id: 'Karori North', name: 'Rural North', bounds: { x: 0, y: 0, width: WORLD_W, height: boundaryY }, theme: { groundColor: '', roadColor: '', decorColor: '' } },
        { id: 'Karori West', name: 'Suburban West', bounds: { x: 0, y: boundaryY, width: midX, height: WORLD_H - boundaryY }, theme: { groundColor: '', roadColor: '', decorColor: '' } },
        { id: 'Karori East', name: 'Motorway East', bounds: { x: midX, y: boundaryY, width: midX, height: WORLD_H - boundaryY }, theme: { groundColor: '', roadColor: '', decorColor: '' } },
    ];

    return { nodes, segments, districts };
}

interface TopologyTemplate {
    key: string;
    name: string;
    nodes: readonly { id: string; x: number; y: number; jitter?: number }[];
    segments: readonly (readonly [string, string, RoadType])[];
    centreBounds: { x: number; y: number; width: number; height: number };
    pocketBounds: { x: number; y: number; width: number; height: number };
    northBoundary: number;
}

const COASTAL_SPINE: TopologyTemplate = {
    key: 'coast',
    name: 'Coastal Spine',
    northBoundary: 680,
    centreBounds: { x: 1320, y: 720, width: 1420, height: 780 },
    pocketBounds: { x: 80, y: 1540, width: 760, height: 600 },
    nodes: [
        { id: 'm1', x: 3340, y: 120 }, { id: 'm2', x: 3370, y: 560 },
        { id: 'm3', x: 3320, y: 1020 }, { id: 'm4', x: 3360, y: 1510 },
        { id: 'm5', x: 3290, y: 2040 },
        { id: 'r1', x: 260, y: 240 }, { id: 'r2', x: 780, y: 150 },
        { id: 'r3', x: 1320, y: 390 }, { id: 'r4', x: 1930, y: 180 },
        { id: 'r5', x: 2600, y: 380 }, { id: 'r6', x: 3030, y: 210 },
        { id: 's1', x: 320, y: 820 }, { id: 's2', x: 930, y: 800 },
        { id: 's3', x: 1220, y: 1120 }, { id: 's4', x: 360, y: 1360 },
        { id: 's5', x: 980, y: 1450 },
        { id: 'c1', x: 1460, y: 820 }, { id: 'c2', x: 2090, y: 800 },
        { id: 'c3', x: 1510, y: 1260 }, { id: 'c4', x: 2160, y: 1270 },
        { id: 'c5', x: 2610, y: 1040 },
        { id: 'k1', x: 180, y: 1700 }, { id: 'k2', x: 230, y: 2050 },
        { id: 'k3', x: 650, y: 2070 }, { id: 'k4', x: 720, y: 1690 },
        { id: 'i1', x: 2050, y: 1740 }, { id: 'i2', x: 2650, y: 1830 },
        { id: 'i3', x: 3070, y: 2020 },
    ],
    segments: [
        ['m1', 'm2', 'Motorway'], ['m2', 'm3', 'Motorway'], ['m3', 'm4', 'Motorway'], ['m4', 'm5', 'Motorway'],
        ['r1', 'r2', 'Rural'], ['r2', 'r3', 'Rural'], ['r3', 'r4', 'Rural'], ['r4', 'r5', 'Rural'],
        ['r5', 'r6', 'Rural'], ['r6', 'm1', 'Rural'], ['r1', 's1', 'Rural'], ['r3', 'c1', 'Rural'],
        ['s1', 's2', 'Suburban'], ['s2', 's3', 'Suburban'], ['s3', 's5', 'Suburban'],
        ['s5', 's4', 'Suburban'], ['s4', 's1', 'Suburban'], ['s2', 's5', 'Suburban'],
        ['s4', 'k1', 'Suburban'], ['k1', 'k2', 'Suburban'], ['k2', 'k3', 'Suburban'],
        ['k3', 'k4', 'Suburban'], ['k4', 'k1', 'Suburban'],
        ['s2', 'c1', 'Primary'], ['s3', 'c3', 'Primary'], ['c1', 'c2', 'Primary'],
        ['c1', 'c3', 'Primary'], ['c2', 'c4', 'Primary'], ['c3', 'c4', 'Primary'],
        ['c2', 'c5', 'Primary'], ['c4', 'c5', 'Primary'], ['c5', 'm3', 'Primary'],
        ['c4', 'i1', 'Industrial'], ['i1', 'i2', 'Industrial'], ['i2', 'i3', 'Industrial'],
        ['i3', 'm5', 'Industrial'], ['i2', 'm4', 'Industrial'],
    ],
};

const TWIN_RIVERS: TopologyTemplate = {
    key: 'river',
    name: 'Twin Centres',
    northBoundary: 650,
    centreBounds: { x: 1040, y: 700, width: 1780, height: 820 },
    pocketBounds: { x: 80, y: 1530, width: 760, height: 610 },
    nodes: [
        { id: 'm1', x: 3520, y: 110 }, { id: 'm2', x: 3500, y: 700 },
        { id: 'm3', x: 3540, y: 1320 }, { id: 'm4', x: 3480, y: 2040 },
        { id: 'r1', x: 240, y: 180 }, { id: 'r2', x: 850, y: 390 },
        { id: 'r3', x: 1510, y: 170 }, { id: 'r4', x: 2290, y: 390 },
        { id: 'r5', x: 3000, y: 190 },
        { id: 's1', x: 280, y: 810 }, { id: 's2', x: 820, y: 820 },
        { id: 's3', x: 300, y: 1370 }, { id: 's4', x: 860, y: 1450 },
        { id: 'w1', x: 1190, y: 790 }, { id: 'w2', x: 1600, y: 800 },
        { id: 'w3', x: 1200, y: 1260 }, { id: 'w4', x: 1600, y: 1270 },
        { id: 'bw1', x: 1800, y: 800, jitter: 10 }, { id: 'be1', x: 2040, y: 800, jitter: 10 },
        { id: 'bw2', x: 1800, y: 1040, jitter: 10 }, { id: 'be2', x: 2040, y: 1040, jitter: 10 },
        { id: 'bw3', x: 1800, y: 1280, jitter: 10 }, { id: 'be3', x: 2040, y: 1280, jitter: 10 },
        { id: 'e1', x: 2250, y: 790 }, { id: 'e2', x: 2700, y: 800 },
        { id: 'e3', x: 2260, y: 1270 }, { id: 'e4', x: 2700, y: 1260 },
        { id: 'k1', x: 180, y: 1700 }, { id: 'k2', x: 220, y: 2050 },
        { id: 'k3', x: 650, y: 2060 }, { id: 'k4', x: 720, y: 1700 },
        { id: 'i1', x: 2140, y: 1760 }, { id: 'i2', x: 2750, y: 1870 },
        { id: 'i3', x: 3260, y: 2020 },
    ],
    segments: [
        ['m1', 'm2', 'Motorway'], ['m2', 'm3', 'Motorway'], ['m3', 'm4', 'Motorway'],
        ['r1', 'r2', 'Rural'], ['r2', 'r3', 'Rural'], ['r3', 'r4', 'Rural'], ['r4', 'r5', 'Rural'],
        ['r5', 'm1', 'Rural'], ['r1', 's1', 'Rural'], ['r3', 'w2', 'Rural'],
        ['s1', 's2', 'Suburban'], ['s2', 's4', 'Suburban'], ['s4', 's3', 'Suburban'],
        ['s3', 's1', 'Suburban'], ['s2', 'w1', 'Primary'], ['s4', 'w3', 'Primary'],
        ['w1', 'w2', 'Primary'], ['w1', 'w3', 'Primary'], ['w2', 'w4', 'Primary'], ['w3', 'w4', 'Primary'],
        ['e1', 'e2', 'Primary'], ['e1', 'e3', 'Primary'], ['e2', 'e4', 'Primary'], ['e3', 'e4', 'Primary'],
        ['w2', 'bw1', 'Primary'], ['bw1', 'be1', 'Primary'], ['be1', 'e1', 'Primary'],
        ['w2', 'bw2', 'Primary'], ['bw2', 'be2', 'Primary'], ['be2', 'e1', 'Primary'],
        ['w4', 'bw3', 'Primary'], ['bw3', 'be3', 'Primary'], ['be3', 'e3', 'Primary'],
        ['e2', 'm2', 'Primary'], ['e4', 'm3', 'Primary'],
        ['s3', 'k1', 'Suburban'], ['k1', 'k2', 'Suburban'], ['k2', 'k3', 'Suburban'],
        ['k3', 'k4', 'Suburban'], ['k4', 'k1', 'Suburban'],
        ['e3', 'i1', 'Industrial'], ['i1', 'i2', 'Industrial'], ['i2', 'i3', 'Industrial'],
        ['i3', 'm4', 'Industrial'], ['i2', 'm3', 'Industrial'],
    ],
};

const RURAL_HUB: TopologyTemplate = {
    key: 'hub',
    name: 'Rural Hub',
    northBoundary: 740,
    centreBounds: { x: 1320, y: 820, width: 1280, height: 720 },
    pocketBounds: { x: 90, y: 1510, width: 720, height: 630 },
    nodes: [
        { id: 'hub', x: 1900, y: 340, jitter: 16 },
        { id: 'r1', x: 220, y: 180 }, { id: 'r2', x: 780, y: 520 },
        { id: 'r3', x: 1120, y: 120 }, { id: 'r4', x: 2670, y: 140 },
        { id: 'r5', x: 3160, y: 500 }, { id: 'r6', x: 3630, y: 170 },
        { id: 'm1', x: 3440, y: 620 }, { id: 'm2', x: 3500, y: 1120 },
        { id: 'm3', x: 3440, y: 1600 }, { id: 'm4', x: 3520, y: 2050 },
        { id: 's1', x: 280, y: 850 }, { id: 's2', x: 850, y: 900 },
        { id: 's3', x: 300, y: 1370 }, { id: 's4', x: 940, y: 1460 },
        { id: 'c1', x: 1430, y: 900 }, { id: 'c2', x: 1980, y: 850 },
        { id: 'c3', x: 2460, y: 970 }, { id: 'c4', x: 1540, y: 1370 },
        { id: 'c5', x: 2150, y: 1370 },
        { id: 'k1', x: 170, y: 1690 }, { id: 'k2', x: 210, y: 2050 },
        { id: 'k3', x: 650, y: 2060 }, { id: 'k4', x: 710, y: 1690 },
        { id: 'i1', x: 1940, y: 1780 }, { id: 'i2', x: 2580, y: 1930 },
        { id: 'i3', x: 3140, y: 1760 },
    ],
    segments: [
        ['r1', 'r2', 'Rural'], ['r2', 'hub', 'Rural'], ['r3', 'hub', 'Rural'],
        ['hub', 'r4', 'Rural'], ['hub', 'r5', 'Rural'], ['r5', 'r6', 'Rural'],
        ['r1', 'r3', 'Rural'], ['r4', 'r6', 'Rural'], ['r2', 's2', 'Rural'],
        ['r5', 'm1', 'Rural'], ['hub', 'c2', 'Rural'],
        ['m1', 'm2', 'Motorway'], ['m2', 'm3', 'Motorway'], ['m3', 'm4', 'Motorway'],
        ['s1', 's2', 'Suburban'], ['s2', 's4', 'Suburban'], ['s4', 's3', 'Suburban'],
        ['s3', 's1', 'Suburban'], ['s2', 'c1', 'Primary'], ['s4', 'c4', 'Primary'],
        ['c1', 'c2', 'Primary'], ['c2', 'c3', 'Primary'], ['c1', 'c4', 'Primary'],
        ['c2', 'c5', 'Primary'], ['c3', 'c5', 'Primary'], ['c4', 'c5', 'Primary'],
        ['c3', 'm2', 'Primary'], ['c5', 'm3', 'Primary'],
        ['s3', 'k1', 'Suburban'], ['k1', 'k2', 'Suburban'], ['k2', 'k3', 'Suburban'],
        ['k3', 'k4', 'Suburban'], ['k4', 'k1', 'Suburban'],
        ['c4', 'i1', 'Industrial'], ['i1', 'i2', 'Industrial'], ['i2', 'i3', 'Industrial'],
        ['i3', 'm3', 'Industrial'], ['i2', 'm4', 'Industrial'],
    ],
};

const HILL_SWITCHBACKS: TopologyTemplate = {
    key: 'hill',
    name: 'High Country Switchbacks',
    northBoundary: 820,
    centreBounds: { x: 1280, y: 880, width: 1460, height: 680 },
    pocketBounds: { x: 80, y: 1510, width: 750, height: 630 },
    nodes: [
        { id: 'r1', x: 180, y: 170 }, { id: 'r2', x: 920, y: 480 },
        { id: 'r3', x: 470, y: 730 }, { id: 'r4', x: 1390, y: 560 },
        { id: 'r5', x: 1050, y: 170 }, { id: 'r6', x: 1900, y: 330 },
        { id: 'r7', x: 2540, y: 120 }, { id: 'r8', x: 3100, y: 600 },
        { id: 's1', x: 260, y: 910 }, { id: 's2', x: 900, y: 900 },
        { id: 's3', x: 340, y: 1370 }, { id: 's4', x: 1040, y: 1480 },
        { id: 'c1', x: 1400, y: 940 }, { id: 'c2', x: 2010, y: 900 },
        { id: 'c3', x: 2600, y: 1010 }, { id: 'c4', x: 1510, y: 1390 },
        { id: 'c5', x: 2180, y: 1420 },
        { id: 'm1', x: 1160, y: 1990 }, { id: 'm2', x: 1940, y: 2030 },
        { id: 'm3', x: 2700, y: 1980 }, { id: 'm4', x: 3580, y: 2020 },
        { id: 'k1', x: 170, y: 1690 }, { id: 'k2', x: 210, y: 2050 },
        { id: 'k3', x: 650, y: 2060 }, { id: 'k4', x: 720, y: 1690 },
        { id: 'i1', x: 1980, y: 1740 }, { id: 'i2', x: 2710, y: 1690 },
        { id: 'i3', x: 3360, y: 1600 },
    ],
    segments: [
        ['r1', 'r2', 'Rural'], ['r2', 'r3', 'Rural'], ['r3', 'r4', 'Rural'],
        ['r4', 'r5', 'Rural'], ['r5', 'r6', 'Rural'], ['r6', 'r7', 'Rural'],
        ['r7', 'r8', 'Rural'], ['r3', 's1', 'Rural'], ['r4', 'c1', 'Rural'], ['r8', 'c3', 'Rural'],
        ['s1', 's2', 'Suburban'], ['s2', 's4', 'Suburban'], ['s4', 's3', 'Suburban'],
        ['s3', 's1', 'Suburban'], ['s2', 'c1', 'Primary'], ['s4', 'c4', 'Primary'],
        ['c1', 'c2', 'Primary'], ['c2', 'c3', 'Primary'], ['c1', 'c4', 'Primary'],
        ['c2', 'c5', 'Primary'], ['c3', 'c5', 'Primary'], ['c4', 'c5', 'Primary'],
        ['s3', 'k1', 'Suburban'], ['k1', 'k2', 'Suburban'], ['k2', 'k3', 'Suburban'],
        ['k3', 'k4', 'Suburban'], ['k4', 'k1', 'Suburban'],
        ['c4', 'm1', 'Industrial'], ['c5', 'i1', 'Industrial'], ['i1', 'i2', 'Industrial'],
        ['i2', 'i3', 'Industrial'], ['i3', 'm4', 'Industrial'], ['i2', 'm3', 'Industrial'],
        ['m1', 'm2', 'Motorway'], ['m2', 'm3', 'Motorway'], ['m3', 'm4', 'Motorway'],
    ],
};

function buildTemplate(rng: Rng, template: TopologyTemplate): Built {
    const nodes = template.nodes.map(({ id, x, y, jitter = 28 }) => ({
        id: `${template.key}_${id}`,
        pos: { x: Math.round(x + range(rng, -jitter, jitter)), y: Math.round(y + range(rng, -jitter, jitter)) },
    }));
    const segments = template.segments.map(([start, end, type]) => ({
        id: `seg-${template.key}_${start}-${template.key}_${end}`,
        startNodeId: `${template.key}_${start}`,
        endNodeId: `${template.key}_${end}`,
        type,
    }));
    const emptyTheme = () => ({ groundColor: '', roadColor: '', decorColor: '' });
    const { centreBounds, pocketBounds, northBoundary } = template;
    const districts: DistrictDefinition[] = [
        { id: 'Karori', name: 'Karori', bounds: { ...pocketBounds }, theme: emptyTheme() },
        { id: 'Karori Central', name: 'Town Centre', bounds: { ...centreBounds }, theme: emptyTheme() },
        { id: 'Karori North', name: 'Rural North', bounds: { x: 0, y: 0, width: WORLD_W, height: northBoundary }, theme: emptyTheme() },
        { id: 'Karori West', name: 'Suburban West', bounds: { x: 0, y: northBoundary, width: WORLD_W / 2, height: WORLD_H - northBoundary }, theme: emptyTheme() },
        { id: 'Karori East', name: 'Motorway East', bounds: { x: WORLD_W / 2, y: northBoundary, width: WORLD_W / 2, height: WORLD_H - northBoundary }, theme: emptyTheme() },
    ];
    return { nodes, segments, districts };
}

interface Topology {
    name: string;
    build: (rng: Rng) => Built;
}

const TOPOLOGIES: readonly Topology[] = [
    { name: 'Classic Grid', build: buildCanonical },
    { name: COASTAL_SPINE.name, build: rng => buildTemplate(rng, COASTAL_SPINE) },
    { name: TWIN_RIVERS.name, build: rng => buildTemplate(rng, TWIN_RIVERS) },
    { name: RURAL_HUB.name, build: rng => buildTemplate(rng, RURAL_HUB) },
    { name: HILL_SWITCHBACKS.name, build: rng => buildTemplate(rng, HILL_SWITCHBACKS) },
];

// Seeded orientation flips. Topology is untouched; positions and bounds mirror.
function applyFlips(built: Built, flipX: boolean, flipY: boolean): void {
    if (!flipX && !flipY) return;
    for (const n of built.nodes) {
        if (flipX) n.pos.x = WORLD_W - n.pos.x;
        if (flipY) n.pos.y = WORLD_H - n.pos.y;
    }
    for (const d of built.districts) {
        if (flipX) d.bounds.x = WORLD_W - d.bounds.x - d.bounds.width;
        if (flipY) d.bounds.y = WORLD_H - d.bounds.y - d.bounds.height;
    }
}

// Real NZ place names per district archetype, drawn from all over the motu. IDs stay
// fixed (balance constants key on them); only display names vary. The archetype tag keeps
// the teaching cue (a first-timer must still see instantly which district is the rural one).
const DISTRICT_NAME_POOLS: Record<DistrictName, string[]> = {
    'Karori North': [
        'Mākara', 'Ōhāriu Valley', 'Maniototo', 'Rangitīkei', 'Waipara', 'Kaipara Flats',
        'Wairarapa Plains', 'Waitaki Valley', 'Te Kūiti Backroads', 'Cheviot Hills',
        'Ōpōtiki Coast Road', 'Central Hawke’s Bay',
    ],
    'Karori West': [
        'Karori', 'Ngaio', 'Ponsonby', 'Riccarton', 'Mosgiel', 'Papatoetoe', 'Māngere',
        'Ilam', 'Havelock North', 'Tawa', 'Rototuna', 'Andersons Bay', 'Whakatū', 'Highfield',
    ],
    'Karori Central': [
        'Te Aro', 'Queen Street', 'Cathedral Square', 'The Octagon', 'Victoria Street',
        'Trafalgar Quarter', 'Riverside Centre', 'The Strand',
    ],
    'Karori East': [
        'SH1 Corridor', 'Desert Road', 'Waikato Expressway', 'Southern Motorway',
        'Northwestern Motorway', 'Kāpiti Expressway', 'Ngauranga Gorge', 'Transmission Gully',
        'Centennial Highway', 'SH2 Corridor',
    ],
    'Karori': [
        'Ōwhiro Bay', 'Piha', 'Raglan', 'Moeraki', 'Kaiteriteri', 'Sumner', 'Ōakura',
        'Curio Bay', 'Mount Maunganui', 'Days Bay', 'Ōhope', 'Tata Beach',
    ],
};
const ARCHETYPE_TAG: Record<DistrictName, string> = {
    'Karori North': 'Rural',
    'Karori West': 'Suburbs',
    'Karori Central': 'Centre',
    'Karori East': 'Motorway',
    'Karori': 'Bays',
};

function assignDistrictNames(built: Built, rng: Rng): void {
    for (const d of built.districts) {
        d.name = `${pick(rng, DISTRICT_NAME_POOLS[d.id])} (${ARCHETYPE_TAG[d.id]})`;
    }
}

function isConnected(built: Built): boolean {
    if (built.nodes.length === 0) return false;
    const adj = new Map<string, string[]>();
    for (const n of built.nodes) adj.set(n.id, []);
    for (const s of built.segments) {
        adj.get(s.startNodeId)?.push(s.endNodeId);
        adj.get(s.endNodeId)?.push(s.startNodeId);
    }
    const seen = new Set<string>([built.nodes[0].id]);
    const queue = [built.nodes[0].id];
    while (queue.length) {
        for (const nb of adj.get(queue.shift()!) || []) {
            if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
        }
    }
    return seen.size === built.nodes.length;
}

// Pristine copies of the hand-authored map, snapshotted before any regeneration —
// the fallback if a generated map ever fails validation.
const DEFAULT_NODES: RoadNode[] = ROAD_NODES.map(n => ({ ...n, pos: { ...n.pos } }));
const DEFAULT_SEGMENTS: RoadSegment[] = ROAD_SEGMENTS.map(s => ({ ...s }));
const DEFAULT_DISTRICTS: DistrictDefinition[] = DISTRICT_DEFINITIONS.map(d => ({ ...d, bounds: { ...d.bounds }, theme: { ...d.theme } }));

function commit(built: Built, theme: Theme): void {
    for (const d of built.districts) {
        d.theme = { groundColor: theme.ground[d.id], roadColor: theme.road, decorColor: theme.decor[d.id] };
    }
    ROAD_NODES.length = 0; ROAD_NODES.push(...built.nodes);
    ROAD_SEGMENTS.length = 0; ROAD_SEGMENTS.push(...built.segments);
    DISTRICT_DEFINITIONS.length = 0; DISTRICT_DEFINITIONS.push(...built.districts);
    mapVersionRef.current++; // geometry + renderer caches rebuild lazily off this
}

/**
 * Generate and install the map for `seed`. Same seed → same map (Daily Shift fairness).
 * Consumers (geometry caches, renderer static-map cache, per-mount nodeMaps) pick the new
 * map up via mapVersionRef. Falls back to the hand-authored map if validation fails.
 */
// Season nudges the look: winter leans cold themes, summer leans warm/neon.
const SEASON_THEME_BIAS: Record<Season, string[]> = {
    summer: ['Neon Night', 'Ember Line'],
    autumn: ['Dusk Patrol', 'Ember Line'],
    winter: ['Frostbeat', 'Rainshift'],
    spring: ['Aurora Watch', 'Rainshift'],
};

export function regenerateMap(seed: number, date = new Date()): GeneratedMapMeta {
    const rng = mulberry32(seed);
    const region = pick(rng, REGIONS);
    // date: the competition day (server-provided for dailies) so season/weather can't
    // split across player timezones.
    const weather = rollWeather(rng, date);
    currentWeatherRef.current = weather;
    // Theme: intersect the region's palette with the season's mood when possible.
    const seasonal = region.themeNames.filter(n => SEASON_THEME_BIAS[weather.season].includes(n));
    const themeName = pick(rng, seasonal.length ? seasonal : region.themeNames);
    const theme = THEMES.find(t => t.name === themeName) ?? THEMES[0];
    const topology = pick(rng, TOPOLOGIES);
    const built = topology.build(rng);
    const flipX = rng() < 0.5;
    const flipY = rng() < 0.5;
    applyFlips(built, flipX, flipY);
    assignDistrictNames(built, rng);

    const inBounds = built.nodes.every(n => n.pos.x >= 0 && n.pos.x <= WORLD_W && n.pos.y >= 0 && n.pos.y <= WORLD_H);
    if (!isConnected(built) || !inBounds) {
        // Never strand the player on a broken map — restore the hand-authored one.
        currentRegionRef.current = null; // renderer falls back to its base scenery profile
        commit({
            nodes: DEFAULT_NODES.map(n => ({ ...n, pos: { ...n.pos } })),
            segments: DEFAULT_SEGMENTS.map(s => ({ ...s })),
            districts: DEFAULT_DISTRICTS.map(d => ({ ...d, bounds: { ...d.bounds }, theme: { ...d.theme } })),
        }, THEMES[0]);
        return { seed, themeName: THEMES[0].name, layoutName: 'Karori Classic', topologyName: 'Classic Grid' };
    }

    currentRegionRef.current = region;
    commit(built, theme);
    // Label: town centre + regional character + conditions ("Te Aro District · Geothermal · Rain, Winter").
    const centre = built.districts.find(d => d.id === 'Karori Central');
    const layoutName = `${(centre?.name || 'Karori').replace(/ \(.*\)$/, '')} District · ${region.name} · ${weather.label}`;
    return { seed, themeName: theme.name, layoutName, topologyName: topology.name };
}
