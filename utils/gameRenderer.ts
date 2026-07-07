import * as CONSTANTS from '../constants';
import { ROAD_SEGMENTS, ROAD_NODES, DISTRICT_DEFINITIONS, mapVersionRef } from './mapData';
import { currentRegionRef } from './mapGen';
import { currentWeatherRef } from './weather';
import { Player, Civilian, SparkParticle, SkidMark, TireSmokeParticle, DeterrenceBlob, CollectionEffect, FloatingScoreText, Explosion, PatrolPost, RIDSType } from '../types';
import { getDistrictForPoint } from './geometry';

// Pre-computed node positions for fast lookup
const nodePosMap = new Map(ROAD_NODES.map(n => [n.id, n.pos]));

// Procedural maps: when mapGen bumps the map version, every map-derived cache here
// (node positions, decorations, ground-color grid, the static-map canvas) is stale.
let rendererCachesForVersion = mapVersionRef.current;
function ensureRendererCaches(): void {
  if (rendererCachesForVersion === mapVersionRef.current) return;
  rendererCachesForVersion = mapVersionRef.current;
  nodePosMap.clear();
  for (const n of ROAD_NODES) nodePosMap.set(n.id, n.pos);
  decorationCache = null;
  staticMapCanvas = null;
  districtColorCache.clear();
}

// Decoration cache — generated once and reused
interface Decoration {
  // NZ scenery set: tī kōuka (cabbage tree), ponga (tree fern), pōhutukawa, harakeke (flax),
  // regional features (steam vents, tor boulders, vineyard rows) plus the locals —
  // sheep, pūkeko, kiwi, kererū, tūī.
  type: 'tree' | 'house' | 'building' | 'warehouse'
      | 'cabbageTree' | 'ponga' | 'pohutukawa' | 'flax'
      | 'sheep' | 'pukeko' | 'kiwi' | 'kereru' | 'tui'
      | 'steamVent' | 'boulder' | 'vineyard'
      | 'clothesline' | 'trampoline' | 'rugbyPosts';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rot?: number;
  color: string;
}

let decorationCache: Decoration[] | null = null;

function generateDecorations(): Decoration[] {
  if (decorationCache) return decorationCache;

  const decs: Decoration[] = [];
  // Per-district scenery mixes — NZ flavour: paddocks of sheep and tī kōuka up in the rural
  // zone, tūī in the suburbs, pūkeko working the verges, pōhutukawa + kererū around the bays.
  // A generated map's REGION overrides this base profile (Coastal Run, High Country,
  // Heartland, Geothermal, Big Smoke — see utils/mapGen.ts).
  const baseProfile: Record<string, { type: Decoration['type']; count: number }[]> = {
    'Karori North': [
      { type: 'tree', count: 120 }, { type: 'cabbageTree', count: 60 },
      { type: 'sheep', count: 70 }, { type: 'flax', count: 30 }, { type: 'kiwi', count: 10 },
    ],
    'Karori West': [
      { type: 'house', count: 80 }, { type: 'cabbageTree', count: 25 },
      { type: 'tui', count: 14 }, { type: 'flax', count: 12 },
    ],
    'Karori Central': [
      { type: 'building', count: 45 }, { type: 'ponga', count: 10 }, { type: 'pukeko', count: 8 },
    ],
    'Karori East': [
      { type: 'warehouse', count: 30 }, { type: 'flax', count: 25 }, { type: 'pukeko', count: 10 },
    ],
    'Karori': [
      { type: 'house', count: 12 }, { type: 'pohutukawa', count: 18 },
      { type: 'kereru', count: 8 }, { type: 'ponga', count: 10 },
    ],
  };

  // Simple distance check without importing findClosestPointOnRoad to avoid circular deps
  // We'll do a rough check against all segments
  const getDistToRoad = (x: number, y: number): number => {
    let minDist = Infinity;
    for (const seg of ROAD_SEGMENTS) {
      const start = nodePosMap.get(seg.startNodeId);
      const end = nodePosMap.get(seg.endNodeId);
      if (!start || !end) continue;
      // Project point onto segment
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((x - start.x) * dx + (y - start.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  };

  const districtDecorations = currentRegionRef.current?.decorProfile ?? baseProfile;

  for (const district of DISTRICT_DEFINITIONS) {
    const mixes = districtDecorations[district.id];
    if (!mixes) continue;

    for (const decorInfo of mixes) {
      // Birds like the roadside: pūkeko famously work the verges, so they get a NEGATIVE
      // buffer band (near the road, not on it) instead of the keep-clear rule.
      const nearRoad = decorInfo.type === 'pukeko';
      for (let i = 0; i < decorInfo.count; i++) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 10) {
          attempts++;
          const x = district.bounds.x + 20 + Math.random() * (district.bounds.width - 40);
          const y = district.bounds.y + 20 + Math.random() * (district.bounds.height - 40);
          const roadBuffer = (CONSTANTS.ROAD_WIDTH / 2) + 20;
          const distToRoad = getDistToRoad(x, y);
          const ok = nearRoad
            ? distToRoad >= roadBuffer - 15 && distToRoad <= roadBuffer + 60
            : distToRoad >= roadBuffer;
          if (ok) {
            const rot = Math.floor(Math.random() * 4) * 90;
            let width: number | undefined;
            let height: number | undefined;
            switch (decorInfo.type) {
              case 'house': width = 30; height = 40; break;
              case 'building': width = 80; height = 120; break;
              case 'warehouse': width = 150; height = 100; break;
            }
            decs.push({ type: decorInfo.type, x, y, width, height, rot, color: district.theme.decorColor });
            placed = true;
          }
        }
      }
    }
  }

  decorationCache = decs;
  return decs;
}

// Static map cache — the entire world background, district grounds, grid, decorations,
// roads (kerb + surface), intersection hubs, and lane markings are all static once the
// map data and decorations are computed. Render them ONCE to an offscreen canvas and
// drawImage it under the same camera transform every frame, replacing thousands of
// canvas operations per frame with a single blit.
let staticMapCanvas: HTMLCanvasElement | null = null;

// District ground color cache
const districtColorCache = new Map<string, string>();
function getDistrictGroundColor(x: number, y: number): string {
  const key = `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
  if (districtColorCache.has(key)) return districtColorCache.get(key)!;
  const district = DISTRICT_DEFINITIONS.find(d =>
    x >= d.bounds.x && x <= d.bounds.x + d.bounds.width &&
    y >= d.bounds.y && y <= d.bounds.y + d.bounds.height
  );
  const color = district ? district.theme.groundColor : '#0d0221';
  districtColorCache.set(key, color);
  return color;
}

function buildStaticMap(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CONSTANTS.WORLD_WIDTH;
  c.height = CONSTANTS.WORLD_HEIGHT;
  const sctx = c.getContext('2d');
  if (!sctx) throw new Error('Static map canvas: 2d context unavailable');

  // World background
  sctx.fillStyle = '#0d0221';
  sctx.fillRect(0, 0, CONSTANTS.WORLD_WIDTH, CONSTANTS.WORLD_HEIGHT);

  // District grounds
  for (const district of DISTRICT_DEFINITIONS) {
    sctx.fillStyle = district.theme.groundColor;
    sctx.fillRect(district.bounds.x, district.bounds.y, district.bounds.width, district.bounds.height);
  }

  // Grid pattern
  sctx.strokeStyle = 'rgba(255,255,255,0.05)';
  sctx.lineWidth = 1;
  for (let x = 0; x < CONSTANTS.WORLD_WIDTH; x += 80) {
    sctx.beginPath();
    sctx.moveTo(x, 0);
    sctx.lineTo(x, CONSTANTS.WORLD_HEIGHT);
    sctx.stroke();
  }
  for (let y = 0; y < CONSTANTS.WORLD_HEIGHT; y += 80) {
    sctx.beginPath();
    sctx.moveTo(0, y);
    sctx.lineTo(CONSTANTS.WORLD_WIDTH, y);
    sctx.stroke();
  }

  // Decorations
  const decorations = generateDecorations();
  for (const d of decorations) {
    sctx.strokeStyle = d.color;
    sctx.lineWidth = 2;
    sctx.globalAlpha = 0.5;
    switch (d.type) {
      case 'tree': {
        sctx.beginPath();
        sctx.moveTo(d.x - 10, d.y + 10);
        sctx.lineTo(d.x, d.y - 15);
        sctx.lineTo(d.x + 10, d.y + 10);
        sctx.moveTo(d.x, d.y - 15);
        sctx.lineTo(d.x, d.y + 15);
        sctx.stroke();
        break;
      }
      case 'house':
      case 'building':
      case 'warehouse': {
        sctx.save();
        sctx.translate(d.x, d.y);
        sctx.rotate((d.rot! * Math.PI) / 180);
        sctx.strokeRect(-d.width! / 2, -d.height! / 2, d.width!, d.height!);
        sctx.restore();
        break;
      }
      case 'cabbageTree': { // tī kōuka: bare trunk, spiky radial crown
        sctx.beginPath();
        sctx.moveTo(d.x, d.y + 16);
        sctx.lineTo(d.x, d.y - 10);
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2;
          sctx.moveTo(d.x, d.y - 10);
          sctx.lineTo(d.x + Math.cos(ang) * 11, d.y - 10 + Math.sin(ang) * 7 - 4);
        }
        sctx.stroke();
        break;
      }
      case 'ponga': { // tree fern from above: radial fronds
        sctx.beginPath();
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          sctx.moveTo(d.x, d.y);
          sctx.quadraticCurveTo(
            d.x + Math.cos(ang + 0.35) * 9, d.y + Math.sin(ang + 0.35) * 9,
            d.x + Math.cos(ang) * 15, d.y + Math.sin(ang) * 15,
          );
        }
        sctx.stroke();
        break;
      }
      case 'pohutukawa': { // broad crown + red blossom dots
        sctx.beginPath();
        sctx.arc(d.x, d.y, 15, 0, Math.PI * 2);
        sctx.stroke();
        sctx.fillStyle = '#dc2626';
        for (let a = 0; a < 5; a++) {
          const ang = (a / 5) * Math.PI * 2 + 0.6;
          sctx.beginPath();
          sctx.arc(d.x + Math.cos(ang) * 9, d.y + Math.sin(ang) * 9, 2.2, 0, Math.PI * 2);
          sctx.fill();
        }
        break;
      }
      case 'flax': { // harakeke: fan of blades from the base
        sctx.beginPath();
        for (let a = -2; a <= 2; a++) {
          sctx.moveTo(d.x, d.y + 8);
          sctx.lineTo(d.x + a * 5, d.y - 12 + Math.abs(a) * 3);
        }
        sctx.stroke();
        break;
      }
      case 'sheep': { // wool blob + dark head
        sctx.fillStyle = 'rgba(240, 240, 235, 0.75)';
        sctx.beginPath();
        sctx.ellipse(d.x, d.y, 9, 6, (d.rot! * Math.PI) / 180, 0, Math.PI * 2);
        sctx.fill();
        sctx.fillStyle = 'rgba(30, 30, 35, 0.9)';
        sctx.beginPath();
        sctx.arc(d.x + Math.cos((d.rot! * Math.PI) / 180) * 9, d.y + Math.sin((d.rot! * Math.PI) / 180) * 6, 3, 0, Math.PI * 2);
        sctx.fill();
        break;
      }
      case 'pukeko': { // blue body, red beak, long legs — working the verge
        sctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
        sctx.beginPath();
        sctx.ellipse(d.x, d.y, 6, 4.5, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.fillStyle = '#ef4444';
        sctx.beginPath();
        sctx.arc(d.x + 6, d.y - 2, 2, 0, Math.PI * 2);
        sctx.fill();
        sctx.strokeStyle = '#ef4444';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(d.x - 2, d.y + 4); sctx.lineTo(d.x - 2, d.y + 10);
        sctx.moveTo(d.x + 2, d.y + 4); sctx.lineTo(d.x + 2, d.y + 10);
        sctx.stroke();
        break;
      }
      case 'kiwi': { // round brown body, long down-curved beak
        sctx.fillStyle = 'rgba(120, 85, 55, 0.9)';
        sctx.beginPath();
        sctx.ellipse(d.x, d.y, 6, 5, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.strokeStyle = 'rgba(200, 170, 140, 0.9)';
        sctx.lineWidth = 1.5;
        sctx.beginPath();
        sctx.moveTo(d.x + 5, d.y - 1);
        sctx.quadraticCurveTo(d.x + 13, d.y + 1, d.x + 15, d.y + 5);
        sctx.stroke();
        break;
      }
      case 'kereru': { // plump wood pigeon: green back, white belly
        sctx.fillStyle = 'rgba(34, 90, 60, 0.9)';
        sctx.beginPath();
        sctx.arc(d.x, d.y, 6, Math.PI, Math.PI * 2);
        sctx.fill();
        sctx.fillStyle = 'rgba(240, 240, 240, 0.9)';
        sctx.beginPath();
        sctx.arc(d.x, d.y, 6, 0, Math.PI);
        sctx.fill();
        break;
      }
      case 'tui': { // dark bird, white throat tuft
        sctx.fillStyle = 'rgba(20, 25, 40, 0.95)';
        sctx.beginPath();
        sctx.ellipse(d.x, d.y, 5, 4, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.fillStyle = 'rgba(250, 250, 250, 0.95)';
        sctx.beginPath();
        sctx.arc(d.x + 3, d.y + 1, 1.5, 0, Math.PI * 2);
        sctx.fill();
        break;
      }
      case 'steamVent': { // geothermal: pool ring + drifting steam curls
        sctx.strokeStyle = 'rgba(190, 225, 235, 0.75)';
        sctx.beginPath();
        sctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
        sctx.stroke();
        sctx.beginPath();
        sctx.moveTo(d.x - 4, d.y - 10);
        sctx.quadraticCurveTo(d.x - 8, d.y - 18, d.x - 3, d.y - 24);
        sctx.moveTo(d.x + 4, d.y - 8);
        sctx.quadraticCurveTo(d.x + 9, d.y - 16, d.x + 4, d.y - 22);
        sctx.stroke();
        break;
      }
      case 'boulder': { // tor country: irregular grey lump
        sctx.fillStyle = 'rgba(120, 128, 140, 0.55)';
        sctx.beginPath();
        sctx.moveTo(d.x - 10, d.y + 5);
        sctx.lineTo(d.x - 6, d.y - 7);
        sctx.lineTo(d.x + 3, d.y - 9);
        sctx.lineTo(d.x + 10, d.y - 2);
        sctx.lineTo(d.x + 7, d.y + 6);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();
        break;
      }
      case 'vineyard': { // row crops: short parallel lines
        sctx.save();
        sctx.translate(d.x, d.y);
        sctx.rotate((d.rot! * Math.PI) / 180);
        sctx.beginPath();
        for (let r = -1; r <= 1; r++) {
          sctx.moveTo(-16, r * 8);
          sctx.lineTo(16, r * 8);
        }
        sctx.stroke();
        sctx.restore();
        break;
      }
      case 'clothesline': { // the rotary hills hoist, from above: rim + crossed arms
        sctx.save();
        sctx.translate(d.x, d.y);
        sctx.rotate((d.rot! * Math.PI) / 180);
        sctx.beginPath();
        sctx.rect(-9, -9, 18, 18);
        sctx.moveTo(-9, -9); sctx.lineTo(9, 9);
        sctx.moveTo(9, -9); sctx.lineTo(-9, 9);
        sctx.stroke();
        // a couple of pegged tea towels
        sctx.fillStyle = 'rgba(255,255,255,0.35)';
        sctx.fillRect(-8, -9, 5, 4);
        sctx.fillRect(3, 7, 5, 4);
        sctx.restore();
        break;
      }
      case 'trampoline': { // backyard tramp from above: dark mat, sprung rim
        sctx.beginPath();
        sctx.arc(d.x, d.y, 11, 0, Math.PI * 2);
        sctx.stroke();
        sctx.fillStyle = 'rgba(0,0,0,0.45)';
        sctx.beginPath();
        sctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
        sctx.fill();
        break;
      }
      case 'rugbyPosts': { // the park H, both ends implied by one set
        sctx.beginPath();
        sctx.moveTo(d.x - 7, d.y + 12); sctx.lineTo(d.x - 7, d.y - 14);
        sctx.moveTo(d.x + 7, d.y + 12); sctx.lineTo(d.x + 7, d.y - 14);
        sctx.moveTo(d.x - 7, d.y); sctx.lineTo(d.x + 7, d.y);
        sctx.stroke();
        break;
      }
    }
    sctx.globalAlpha = 1;
  }

  // Roads (kerb outline)
  sctx.lineCap = 'round';
  sctx.lineJoin = 'round';
  sctx.strokeStyle = '#4f46e5';
  sctx.lineWidth = CONSTANTS.ROAD_WIDTH + 8;
  for (const segment of ROAD_SEGMENTS) {
    const start = nodePosMap.get(segment.startNodeId);
    const end = nodePosMap.get(segment.endNodeId);
    if (!start || !end) continue;
    sctx.beginPath();
    sctx.moveTo(start.x, start.y);
    sctx.lineTo(end.x, end.y);
    sctx.stroke();
  }

  // Road surfaces
  for (const segment of ROAD_SEGMENTS) {
    const start = nodePosMap.get(segment.startNodeId);
    const end = nodePosMap.get(segment.endNodeId);
    if (!start || !end) continue;
    const district = DISTRICT_DEFINITIONS.find(d =>
      start.x >= d.bounds.x && start.x <= d.bounds.x + d.bounds.width &&
      start.y >= d.bounds.y && start.y <= d.bounds.y + d.bounds.height
    );
    sctx.strokeStyle = district ? district.theme.roadColor : '#374151';
    sctx.lineWidth = CONSTANTS.ROAD_WIDTH;
    sctx.beginPath();
    sctx.moveTo(start.x, start.y);
    sctx.lineTo(end.x, end.y);
    sctx.stroke();
  }

  // Intersection hubs
  for (const node of ROAD_NODES) {
    const district = DISTRICT_DEFINITIONS.find(d =>
      node.pos.x >= d.bounds.x && node.pos.x <= d.bounds.x + d.bounds.width &&
      node.pos.y >= d.bounds.y && node.pos.y <= d.bounds.y + d.bounds.height
    );
    const roadColor = district ? district.theme.roadColor : '#374151';
    const groundColor = district ? district.theme.groundColor : '#0d0221';

    sctx.fillStyle = '#4f46e5';
    sctx.beginPath();
    sctx.arc(node.pos.x, node.pos.y, (CONSTANTS.ROAD_WIDTH / 2) + 20 + 4, 0, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = roadColor;
    sctx.beginPath();
    sctx.arc(node.pos.x, node.pos.y, (CONSTANTS.ROAD_WIDTH / 2) + 20, 0, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = groundColor;
    sctx.strokeStyle = '#00ffff';
    sctx.lineWidth = 3;
    sctx.beginPath();
    sctx.arc(node.pos.x, node.pos.y, 20, 0, Math.PI * 2);
    sctx.fill();
    sctx.stroke();
  }

  // Road markings
  for (const segment of ROAD_SEGMENTS) {
    const start = nodePosMap.get(segment.startNodeId);
    const end = nodePosMap.get(segment.endNodeId);
    if (!start || !end) continue;

    let strokeColor = 'none';
    let lineWidth = 3;
    sctx.setLineDash([]);

    switch (segment.type) {
      case 'Motorway':
        strokeColor = '#facc15';
        lineWidth = 5;
        break;
      case 'Primary':
      case 'Suburban':
        strokeColor = 'white';
        sctx.setLineDash([20, 25]);
        break;
      case 'Industrial':
        strokeColor = '#facc15';
        break;
      case 'Rural':
      default:
        continue;
    }

    sctx.strokeStyle = strokeColor;
    sctx.lineWidth = lineWidth;
    sctx.globalAlpha = 0.6;
    sctx.beginPath();
    sctx.moveTo(start.x, start.y);
    sctx.lineTo(end.x, end.y);
    sctx.stroke();
    sctx.globalAlpha = 1;
    sctx.setLineDash([]);
  }

  return c;
}

function getStaticMap(): HTMLCanvasElement {
  if (!staticMapCanvas) staticMapCanvas = buildStaticMap();
  return staticMapCanvas;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  shake: number;
}

export interface RenderState {
  player: Player;
  civilians: Civilian[];
  /** Faded replay marker of the player's PB run on this daily map. */
  ghost?: { x: number; y: number; angle: number } | null;
  /** Display name for the isChampion unit (yesterday's daily #1). */
  championName?: string | null;
  sparks: SparkParticle[];
  skidMarks: SkidMark[];
  tireSmoke: TireSmokeParticle[];
  floatingScoreTexts: FloatingScoreText[];
  deterrenceBlobs: DeterrenceBlob[];
  collectionEffects: CollectionEffect[];
  explosions: Explosion[];
  patrolPosts: PatrolPost[];
  highlightedPath: { x: number; y: number }[] | null;
  pathfindingTargetId: number | null;
  targetedCarId: number | null;
  isBraking: boolean;
}

// Cache prefers-reduced-motion once at module scope (not per frame) — gd-0wi.25.
const prefersReducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export function drawGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: CameraState,
  state: RenderState,
  time: number
): void {
  ensureRendererCaches(); // rebuild map-derived caches after a procedural regen
  // gd-0wi.25: never shake the camera when the user prefers reduced motion.
  const shakeAmt = prefersReducedMotion ? 0 : camera.shake;
  const shakeX = shakeAmt > 0 ? (Math.random() - 0.5) * shakeAmt * 2 : 0;
  const shakeY = shakeAmt > 0 ? (Math.random() - 0.5) * shakeAmt * 2 : 0;

  ctx.save();

  // Handle DPR for crisp rendering on mobile
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);

  // Camera transform: center on camera position, apply zoom and shake
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Frustum culling (gd-0wi.7): skip entities outside the visible viewport. Bounds are the
  // world rect the camera shows, plus a margin for entity radius + glow. This also skips the
  // per-entity shadowBlur of off-screen cars (gd-0wi.8).
  const cullHalfW = width / 2 / camera.zoom + 80;
  const cullHalfH = height / 2 / camera.zoom + 80;
  const cminX = camera.x - cullHalfW, cmaxX = camera.x + cullHalfW;
  const cminY = camera.y - cullHalfH, cmaxY = camera.y + cullHalfH;
  const onScreen = (p: { x: number; y: number }) => p.x >= cminX && p.x <= cmaxX && p.y >= cminY && p.y <= cmaxY;

  // Draw cached static map (background, district grounds, grid, decorations,
  // road kerbs/surfaces, intersection hubs, lane markings) — single drawImage
  // replaces thousands of canvas operations per frame. Built once on first call.
  // Source-rect blit: sample only the visible world region (reusing the cull rect)
  // instead of pushing the full 3840x2160 texture through the GPU every frame —
  // the single biggest mobile win (batch A deferral, landed here with measurement).
  {
    const sx = Math.max(0, cminX);
    const sy = Math.max(0, cminY);
    const sw = Math.min(CONSTANTS.WORLD_WIDTH, cmaxX) - sx;
    const sh = Math.min(CONSTANTS.WORLD_HEIGHT, cmaxY) - sy;
    if (sw > 0 && sh > 0) ctx.drawImage(getStaticMap(), sx, sy, sw, sh, sx, sy, sw, sh);
  }

  // Draw GPS path
  if (state.highlightedPath && state.highlightedPath.length > 1) {
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.6)';
    ctx.lineWidth = 30;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([50, 20]);
    // Animate dash offset
    ctx.lineDashOffset = -(time / 500) * 50;
    ctx.beginPath();
    ctx.moveTo(state.highlightedPath[0].x, state.highlightedPath[0].y);
    for (let i = 1; i < state.highlightedPath.length; i++) {
      ctx.lineTo(state.highlightedPath[i].x, state.highlightedPath[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // Draw patrol post auras
  for (const post of state.patrolPosts) {
    if (!onScreen(post.pos)) continue;
    const alpha = post.remainingTime / CONSTANTS.PATROL_POST_DURATION;
    ctx.fillStyle = `rgba(6, 182, 212, ${alpha * 0.3})`;
    ctx.strokeStyle = `rgba(6, 182, 212, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(post.pos.x, post.pos.y, CONSTANTS.PATROL_POST_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw skid marks
  for (const skid of state.skidMarks) {
    if (!onScreen(skid.pos)) continue;
    const age = (time - skid.spawnTime) / CONSTANTS.SKID_MARK_LIFESPAN;
    ctx.globalAlpha = 1 - age;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.save();
    ctx.translate(skid.pos.x, skid.pos.y);
    ctx.rotate((skid.angle * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(15, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Draw tire smoke
  for (const smoke of state.tireSmoke) {
    if (!onScreen(smoke.pos)) continue;
    const age = (time - smoke.spawnTime) / CONSTANTS.TIRE_SMOKE_PARTICLE_LIFESPAN;
    const scale = 0.5 + age * 1.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(smoke.pos.x, smoke.pos.y, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw explosions
  for (const exp of state.explosions) {
    if (!onScreen(exp.pos)) continue;
    const age = (time - exp.spawnTime) / CONSTANTS.EXPLOSION_LIFESPAN;
    const radius = age * CONSTANTS.EXPLOSION_MAX_RADIUS;
    ctx.fillStyle = `rgba(239, 68, 68, ${1 - age})`;
    ctx.beginPath();
    ctx.arc(exp.pos.x, exp.pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(251, 191, 36, ${1 - age})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(exp.pos.x, exp.pos.y, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ghost of your personal-best run (Devil Daggers lesson: losing to something visible teaches).
  if (state.ghost && onScreen(state.ghost)) {
    ctx.save();
    ctx.translate(state.ghost.x, state.ghost.y);
    ctx.rotate(((state.ghost.angle - 90) * Math.PI) / 180);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.strokeRect(-22, -12, 44, 24);
    ctx.restore();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 14px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PB', state.ghost.x, state.ghost.y - 24);
    ctx.globalAlpha = 1;
  }

  // Draw civilian cars (off-screen culled)
  for (const car of state.civilians) {
    if (!onScreen(car.pos)) continue;
    if (car.isChampion) {
      // Yesterday's #1 patrols tonight's map: white unit, red/blue bar, name tag.
      ctx.save();
      ctx.translate(car.pos.x, car.pos.y);
      ctx.rotate(((car.angle - 90) * Math.PI) / 180);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(-22, -12, 44, 24);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-6, -12, 6, 24);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, -12, 6, 24);
      ctx.strokeStyle = '#0d0221';
      ctx.lineWidth = 2;
      ctx.strokeRect(-22, -12, 44, 24);
      ctx.restore();
      if (state.championName) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`INSP. ${state.championName.toUpperCase().slice(0, 10)}`, car.pos.x, car.pos.y - 26);
      }
      continue;
    }
    drawCivilianCar(ctx, car, car.id === state.targetedCarId, car.id === state.pathfindingTargetId, !!car.isYieldingToSiren, time);
  }

  // Draw player car
  drawPlayerCar(ctx, state.player, state.isBraking, time);

  // Draw deterrence blobs
  for (const blob of state.deterrenceBlobs) {
    if (!onScreen(blob.pos)) continue;
    const age = (time - blob.spawnTime) / CONSTANTS.DETERRENCE_BLOB_LIFESPAN;
    ctx.fillStyle = `rgba(217, 70, 239, ${1 - age})`;
    ctx.beginPath();
    ctx.arc(blob.pos.x, blob.pos.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw collection effects
  for (const effect of state.collectionEffects) {
    if (!onScreen(effect.pos)) continue;
    const age = (time - effect.spawnTime) / 400;
    const scale = 1 + age * 2;
    ctx.strokeStyle = `rgba(217, 70, 239, ${1 - age})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(effect.pos.x, effect.pos.y, 10 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw sparks
  for (const spark of state.sparks) {
    if (!onScreen(spark.pos)) continue;
    const age = (time - spark.spawnTime) / CONSTANTS.SPARK_LIFESPAN;
    ctx.fillStyle = `rgba(251, 191, 36, ${1 - age})`;
    ctx.beginPath();
    ctx.arc(spark.pos.x, spark.pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw floating score texts
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const text of state.floatingScoreTexts) {
    if (!onScreen(text.pos)) continue;
    const age = (time - text.spawnTime) /
      (text.variant === 'speech' ? CONSTANTS.SPEECH_BUBBLE_LIFESPAN : CONSTANTS.FLOATING_SCORE_TEXT_LIFESPAN);
    if (text.variant === 'speech') {
      // Kiwi speech bubble: rounded rect + tail, gentle rise, fade at the end.
      const yOffset = -30 - 15 * age;
      ctx.globalAlpha = age > 0.75 ? (1 - age) * 4 : 1;
      ctx.font = 'bold 15px Rajdhani, sans-serif';
      const w = ctx.measureText(text.text).width + 20;
      const x = text.pos.x, y = text.pos.y + yOffset;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 14, w, 28, 9);
      ctx.moveTo(x - 5, y + 13);
      ctx.lineTo(x, y + 24);
      ctx.lineTo(x + 7, y + 13);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.fillText(text.text, x, y + 1);
      continue;
    }
    const yOffset = -80 * age;
    ctx.globalAlpha = 1 - age;
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(text.text, text.pos.x, text.pos.y + yOffset);
    ctx.fillText(text.text, text.pos.x, text.pos.y + yOffset);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Weather overlay, drawn in screen space over everything (fog must hide the world).
  drawWeatherOverlay(ctx, width, height, time);
}

// Rain streaks / fog vignette. Animated streaks are skipped under prefers-reduced-motion
// (a static tint carries the "it's raining" signal instead).
function drawWeatherOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void {
  const w = currentWeatherRef.current;
  if (w.kind === 'clear' || w.kind === 'wind') return; // wind is sim/audio flavour only
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);

  if (w.kind === 'rain') {
    ctx.fillStyle = `rgba(56, 130, 190, ${0.05 + 0.04 * w.intensity})`; // wet tint
    ctx.fillRect(0, 0, width, height);
    if (!prefersReducedMotion) {
      const count = Math.round(50 * w.intensity);
      ctx.strokeStyle = 'rgba(190, 220, 245, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        // Stateless streaks: position derives from index + time, cycling down-left.
        const x = ((i * 97.31 + time * 0.55) % (width + 40)) - 20;
        const y = ((i * 53.7 + time * 1.15) % (height + 40)) - 20;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 16);
      }
      ctx.stroke();
    }
  } else if (w.kind === 'fog') {
    const cx = width / 2, cy = height / 2;
    const clear = Math.min(width, height) * 0.55 * w.vision;
    const grad = ctx.createRadialGradient(cx, cy, clear, cx, cy, Math.max(width, height) * 0.85);
    grad.addColorStop(0, 'rgba(180, 195, 210, 0)');
    grad.addColorStop(1, `rgba(180, 195, 210, ${0.55 + 0.3 * w.intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

const RIDS_ICONS: Record<RIDSType, string> = {
  Restraints: '⚠️',
  Impairment: '🥴',
  Distractions: '📱',
  Speed: '🔥',
};

const CAR_COLORS = [
  '#ec4899', // pink-500
  '#9333ea', // purple-600
  '#10b981', // emerald-500
  '#f97316', // orange-500
  '#0ea5e9', // sky-500
  '#e11d48', // rose-500
  '#facc15', // yellow-400
];

function drawCivilianCar(
  ctx: CanvasRenderingContext2D,
  car: Civilian,
  isTargeted: boolean,
  isPathfindingTarget: boolean,
  isYielding: boolean,
  time: number
): void {
  ctx.save();
  ctx.translate(car.pos.x, car.pos.y);
  ctx.rotate((car.angle * Math.PI) / 180);

  // Vehicle variety: [width, height] per type (car is the classic 25x45).
  const dims: Record<string, [number, number]> = {
    car: [25, 45], ute: [26, 50], truck: [30, 72], bus: [30, 80], bike: [12, 28], camper: [28, 58],
  };
  const [carWidth, carHeight] = dims[car.vehicleType || 'car'] || dims.car;

  // Life at Risk pulse ring
  if (car.isLifeAtRisk) {
    const pulseScale = 1 + Math.sin(time / 200) * 0.3;
    ctx.save();
    ctx.rotate((-car.angle * Math.PI) / 180);
    ctx.fillStyle = `rgba(239, 68, 68, 0.5)`;
    ctx.beginPath();
    ctx.arc(0, 0, 16 * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // RIDS offender pulse ring — visibility aid at mobile scales (base zoom ~0.5).
  // Drawn in WORLD space (not rotated with the car) so the halo stays oriented.
  if (car.ridsType && !car.isLifeAtRisk) {
    const t = time / 350;
    const ringScale = 1 + Math.sin(t) * 0.18;
    ctx.save();
    ctx.rotate((-car.angle * Math.PI) / 180);
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.45 + Math.sin(t) * 0.15})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 28 * ringScale, 0, Math.PI * 2);
    ctx.stroke();
    // Filled fade so the ring reads even on busy backgrounds
    ctx.fillStyle = `rgba(250, 204, 21, 0.12)`;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * ringScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Pathfinding target ring
  if (isPathfindingTarget) {
    ctx.save();
    ctx.rotate((-car.angle * Math.PI) / 180);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    const pulse = 1 + Math.sin(time / 300) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, 32 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Car body color (campers read as the classic white rental box)
  const colorIndex = Math.floor(car.id * CAR_COLORS.length) % CAR_COLORS.length;
  const bodyColor = car.isLifeAtRisk
    ? `rgb(${200 + Math.sin(time / 100) * 55 | 0}, 0, 0)`
    : car.vehicleType === 'camper' ? '#e7e5e4' : CAR_COLORS[colorIndex];

  // Targeted flash
  if (isTargeted) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 22;
  } else if (car.ridsType && !car.isLifeAtRisk) {
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;
  }

  // Draw car body
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Chamfered flat nose (a single centre point read as a spike, especially on long vehicles).
  ctx.moveTo(-carWidth * 0.28, -carHeight / 2);
  ctx.lineTo(carWidth * 0.28, -carHeight / 2);
  ctx.lineTo(carWidth / 2, -carHeight / 4);
  ctx.lineTo(carWidth / 2, carHeight / 2);
  ctx.lineTo(-carWidth / 2, carHeight / 2);
  ctx.lineTo(-carWidth / 2, -carHeight / 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Roof
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-carWidth * 0.425, -carHeight * 0.15, carWidth * 0.85, carHeight * 0.45);

  // Windshield
  ctx.fillStyle = 'rgba(203, 213, 225, 0.5)';
  ctx.beginPath();
  ctx.moveTo(-carWidth * 0.375, -carHeight * 0.2);
  ctx.lineTo(carWidth * 0.375, -carHeight * 0.2);
  ctx.lineTo(carWidth * 0.5, -carHeight * 0.05);
  ctx.lineTo(-carWidth * 0.5, -carHeight * 0.05);
  ctx.closePath();
  ctx.fill();

  // Headlights
  ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
  ctx.fillRect(-carWidth * 0.35, -carHeight / 2 + 2, carWidth * 0.15, 3);
  ctx.fillRect(carWidth * 0.2, -carHeight / 2 + 2, carWidth * 0.15, 3);

  // Brake lights
  if (car.isBraking || isYielding) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ef4444';
  } else {
    ctx.fillStyle = '#7f1d1d';
  }
  ctx.fillRect(-carWidth * 0.4, carHeight / 2 - 4, carWidth * 0.15, 4);
  ctx.fillRect(carWidth * 0.25, carHeight / 2 - 4, carWidth * 0.15, 4);
  ctx.shadowBlur = 0;

  // Type flourishes so the mix reads at a glance.
  if (car.vehicleType === 'truck') {
    // Cab/trailer split + container
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-carWidth / 2 + 2, -carHeight * 0.1, carWidth - 4, carHeight * 0.55);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-carWidth / 2 + 2, -carHeight * 0.1, carWidth - 4, carHeight * 0.55);
  } else if (car.vehicleType === 'bus') {
    // Window strips down the sides
    ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-carWidth / 2 + 3, -carHeight * 0.28 + i * carHeight * 0.16, carWidth - 6, carHeight * 0.08);
    }
  } else if (car.vehicleType === 'camper') {
    // Rental stripe + roof vent
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(-carWidth / 2, -carHeight * 0.05, carWidth, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-carWidth * 0.2, carHeight * 0.12, carWidth * 0.4, carHeight * 0.18);
  }

  ctx.restore();

  // RIDS icon — bigger + stronger glow for legibility at mobile zoom (~0.5).
  if (car.ridsType && !car.isLifeAtRisk) {
    ctx.save();
    ctx.translate(car.pos.x, car.pos.y - 42);
    const bobY = Math.sin(time / 500) * -5;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 14;
    ctx.fillText(RIDS_ICONS[car.ridsType], 0, bobY);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Yielding indicator
  if (isYielding) {
    ctx.save();
    ctx.translate(car.pos.x, car.pos.y - 30);
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }
}

function drawPlayerCar(ctx: CanvasRenderingContext2D, player: Player, isBraking: boolean, time: number): void {
  ctx.save();
  ctx.translate(player.pos.x, player.pos.y);

  // Idle bob animation
  if (player.speed < 0.1) {
    ctx.translate(0, Math.sin(time / 500) * -1);
  }

  ctx.rotate((player.angle * Math.PI) / 180);

  const carWidth = 28;
  const carHeight = 50;

  // Deterrence aura
  const vigilanceBonus = CONSTANTS.VIGILANCE_AURA_BONUS_MAX * (player.vigilance / 100);
  const baseRadius = player.isSirenActive ? CONSTANTS.PLAYER_SIREN_AURA_RADIUS : CONSTANTS.PLAYER_AURA_RADIUS;
  const auraRadius = baseRadius + vigilanceBonus;
  const pulseSize = 1 + Math.sin(time / 300) * 0.05;

  ctx.fillStyle = player.isSirenActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 211, 238, 0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, auraRadius * pulseSize, 0, Math.PI * 2);
  ctx.fill();

  // Headlight beams
  const beamLength = 120;
  ctx.fillStyle = 'rgba(255, 255, 220, 0.15)';
  ctx.beginPath();
  ctx.moveTo(-carWidth * 0.15, -carHeight / 2);
  ctx.lineTo(-carWidth * 0.4, -carHeight / 2 - beamLength);
  ctx.lineTo(carWidth * 0.4, -carHeight / 2 - beamLength);
  ctx.lineTo(carWidth * 0.15, -carHeight / 2);
  ctx.closePath();
  ctx.fill();

  // Boost flames
  if (player.isBoosting) {
    const flicker = 1 + Math.sin(time / 50) * 0.3;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-carWidth * 0.15, carHeight / 2);
    ctx.lineTo(-carWidth * 0.25, carHeight / 2 + 20 * flicker);
    ctx.lineTo(-carWidth * 0.05, carHeight / 2 + 15 * flicker);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(carWidth * 0.15, carHeight / 2);
    ctx.lineTo(carWidth * 0.25, carHeight / 2 + 20 * flicker);
    ctx.lineTo(carWidth * 0.05, carHeight / 2 + 15 * flicker);
    ctx.closePath();
    ctx.fill();
  }

  // Main body
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Chamfered flat nose (a single centre point read as a spike, especially on long vehicles).
  ctx.moveTo(-carWidth * 0.28, -carHeight / 2);
  ctx.lineTo(carWidth * 0.28, -carHeight / 2);
  ctx.lineTo(carWidth / 2, -carHeight / 4);
  ctx.lineTo(carWidth / 2, carHeight / 2);
  ctx.lineTo(-carWidth / 2, carHeight / 2);
  ctx.lineTo(-carWidth / 2, -carHeight / 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Blue stripes
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(-carWidth * 0.35, -carHeight / 4, carWidth * 0.2, carHeight * 0.75);
  ctx.fillRect(carWidth * 0.15, -carHeight / 4, carWidth * 0.2, carHeight * 0.75);

  // Headlights
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 8;
  ctx.fillRect(-carWidth * 0.35, -carHeight / 2 + 8, carWidth * 0.15, 5);
  ctx.fillRect(carWidth * 0.2, -carHeight / 2 + 8, carWidth * 0.15, 5);
  ctx.shadowBlur = 0;

  // Taillights
  if (isBraking) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ef4444';
  } else {
    ctx.fillStyle = '#991b1b';
  }
  ctx.fillRect(-carWidth * 0.4, carHeight / 2 - 5, carWidth * 0.1, 5);
  ctx.fillRect(carWidth * 0.3, carHeight / 2 - 5, carWidth * 0.1, 5);
  ctx.shadowBlur = 0;

  // Windshield
  ctx.fillStyle = 'rgba(22, 78, 99, 0.8)';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-carWidth * 0.3, -carHeight * 0.15);
  ctx.lineTo(carWidth * 0.3, -carHeight * 0.15);
  ctx.lineTo(carWidth * 0.5, carHeight * 0.05);
  ctx.lineTo(-carWidth * 0.5, carHeight * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Light bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-carWidth * 0.35, -carHeight / 2 + 2, carWidth * 0.7, 5);
  if (player.isSirenActive) {
    const sirenPhase = Math.floor(time / 200) % 2;
    ctx.fillStyle = sirenPhase === 0 ? '#ef4444' : '#7f1d1d';
    ctx.fillRect(-carWidth * 0.35, -carHeight / 2 + 2, carWidth * 0.35, 5);
    ctx.fillStyle = sirenPhase === 0 ? '#1e3a8a' : '#3b82f6';
    ctx.fillRect(0, -carHeight / 2 + 2, carWidth * 0.35, 5);
  } else {
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-carWidth * 0.35, -carHeight / 2 + 2, carWidth * 0.35, 5);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, -carHeight / 2 + 2, carWidth * 0.35, 5);
  }

  ctx.restore();
}
