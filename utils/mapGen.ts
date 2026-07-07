import { DistrictName, RoadType } from '../types';
import {
    ROAD_NODES, ROAD_SEGMENTS, DISTRICT_DEFINITIONS, mapVersionRef,
    RoadNode, RoadSegment, DistrictDefinition,
} from './mapData';
import { mulberry32, pick, range, type Rng } from './rng';

// Procedural map generator. Builds a connected road network + district layout in a
// canonical frame (motorway east, rural north — the shape of the original hand map),
// then applies seeded flips for orientation variety. District IDs never change, so every
// balance constant keyed by DistrictName keeps working; display names and geometry vary.

const WORLD_W = 1280 * 3;
const WORLD_H = 720 * 3;

export interface GeneratedMapMeta {
    seed: number;
    themeName: string;
    layoutName: string;
}

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

// Real Wellington-region place names per district archetype. IDs stay fixed (balance
// constants key on them); only display names vary. The archetype tag keeps the teaching
// cue (a first-timer must still see instantly which district is the rural one).
const DISTRICT_NAME_POOLS: Record<DistrictName, string[]> = {
    'Karori North': ['Mākara', 'Ōhāriu Valley', 'Horokiwi', 'South Karori', 'Terawhiti', 'Belmont Hills', 'Takarau Gorge', 'Wainuiomata Hills'],
    'Karori West': ['Karori', 'Ngaio', 'Khandallah', 'Brooklyn', 'Tawa', 'Newlands', 'Island Bay', 'Johnsonville', 'Miramar', 'Vogeltown'],
    'Karori Central': ['Te Aro', 'Lambton Quarter', 'Cuba Quarter', 'Courtenay', 'Thorndon', 'Civic Square'],
    'Karori East': ['SH1 Corridor', 'SH2 Corridor', 'Centennial Highway', 'Ngauranga Gorge', 'Transmission Gully', 'The Expressway'],
    'Karori': ['Ōwhiro Bay', 'Mākara Beach', 'Red Rocks', 'Seatoun', 'Days Bay', 'Breaker Bay'],
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
export function regenerateMap(seed: number): GeneratedMapMeta {
    const rng = mulberry32(seed);
    const theme = pick(rng, THEMES);
    const built = buildCanonical(rng);
    const flipX = rng() < 0.5;
    const flipY = rng() < 0.5;
    applyFlips(built, flipX, flipY);
    assignDistrictNames(built, rng);

    const inBounds = built.nodes.every(n => n.pos.x >= 0 && n.pos.x <= WORLD_W && n.pos.y >= 0 && n.pos.y <= WORLD_H);
    if (!isConnected(built) || !inBounds) {
        // Never strand the player on a broken map — restore the hand-authored one.
        commit({
            nodes: DEFAULT_NODES.map(n => ({ ...n, pos: { ...n.pos } })),
            segments: DEFAULT_SEGMENTS.map(s => ({ ...s })),
            districts: DEFAULT_DISTRICTS.map(d => ({ ...d, bounds: { ...d.bounds }, theme: { ...d.theme } })),
        }, THEMES[0]);
        return { seed, themeName: THEMES[0].name, layoutName: 'Karori Classic' };
    }

    commit(built, theme);
    // Label the map by its town centre, like a real patrol area ("Te Aro District").
    const centre = built.districts.find(d => d.id === 'Karori Central');
    const layoutName = `${(centre?.name || 'Karori').replace(/ \(.*\)$/, '')} District`;
    return { seed, themeName: theme.name, layoutName };
}
