import { describe, it, expect } from 'vitest';
import { regenerateMap } from './mapGen';
import { ROAD_NODES, ROAD_SEGMENTS, DISTRICT_DEFINITIONS } from './mapData';
import { findShortestPath, getDistrictForPoint } from './geometry';

const snapshot = () => JSON.stringify({ n: ROAD_NODES, s: ROAD_SEGMENTS, d: DISTRICT_DEFINITIONS });

const bfsConnected = (): boolean => {
  const adj = new Map<string, string[]>();
  for (const n of ROAD_NODES) adj.set(n.id, []);
  for (const s of ROAD_SEGMENTS) {
    adj.get(s.startNodeId)!.push(s.endNodeId);
    adj.get(s.endNodeId)!.push(s.startNodeId);
  }
  const seen = new Set([ROAD_NODES[0].id]);
  const q = [ROAD_NODES[0].id];
  while (q.length) for (const nb of adj.get(q.shift()!)!) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  return seen.size === ROAD_NODES.length;
};

describe('regenerateMap', () => {
  it('is deterministic for the same seed (Daily Shift fairness)', () => {
    regenerateMap(20260707);
    const a = snapshot();
    regenerateMap(12345);
    regenerateMap(20260707);
    expect(snapshot()).toBe(a);
  });

  it('produces different maps for different seeds', () => {
    regenerateMap(1);
    const a = snapshot();
    regenerateMap(2);
    expect(snapshot()).not.toBe(a);
  });

  it('uses five materially different deterministic topology grammars', () => {
    const fixedDate = new Date(2026, 6, 15, 12);
    const signatures = new Map<string, string>();
    for (let seed = 1; seed <= 300 && signatures.size < 5; seed++) {
      const { topologyName } = regenerateMap(seed, fixedDate);
      if (signatures.has(topologyName)) continue;

      const nodeIds = ROAD_NODES.map(node => node.id);
      const segmentIds = ROAD_SEGMENTS.map(segment => segment.id);
      expect(new Set(nodeIds).size, `${topologyName}: duplicate node id`).toBe(nodeIds.length);
      expect(new Set(segmentIds).size, `${topologyName}: duplicate segment id`).toBe(segmentIds.length);
      const degrees = new Map(ROAD_NODES.map(n => [n.id, 0]));
      const nodePositions = new Map(ROAD_NODES.map(node => [node.id, node.pos]));
      const roadTypes = new Map<string, number>();
      expect(bfsConnected(), `${topologyName} disconnected`).toBe(true);
      for (const segment of ROAD_SEGMENTS) {
        expect(degrees.has(segment.startNodeId), `${topologyName}: missing segment start`).toBe(true);
        expect(degrees.has(segment.endNodeId), `${topologyName}: missing segment end`).toBe(true);
        degrees.set(segment.startNodeId, degrees.get(segment.startNodeId)! + 1);
        degrees.set(segment.endNodeId, degrees.get(segment.endNodeId)! + 1);
        const start = nodePositions.get(segment.startNodeId)!;
        const end = nodePositions.get(segment.endNodeId)!;
        expect((start.x - end.x) ** 2 + (start.y - end.y) ** 2, `${topologyName}: zero-length segment`).toBeGreaterThan(0);
        roadTypes.set(segment.type, (roadTypes.get(segment.type) ?? 0) + 1);
      }
      for (const district of DISTRICT_DEFINITIONS) {
        expect(
          ROAD_NODES.some(node => getDistrictForPoint(node.pos) === district.id && (degrees.get(node.id) ?? 0) > 0),
          `${topologyName}: district ${district.id} has no usable road node`,
        ).toBe(true);
      }
      signatures.set(topologyName, JSON.stringify({
        nodes: ROAD_NODES.length,
        segments: ROAD_SEGMENTS.length,
        degrees: [...degrees.values()].sort((a, b) => a - b),
        roadTypes: [...roadTypes].sort(([a], [b]) => a.localeCompare(b)),
      }));
    }

    expect([...signatures.keys()].sort()).toEqual([
      'Classic Grid', 'Coastal Spine', 'High Country Switchbacks', 'Rural Hub', 'Twin Centres',
    ]);
    expect(new Set(signatures.values()).size).toBe(5);
  });

  it('generates a fully connected road network across many seeds', () => {
    for (let seed = 100; seed < 140; seed++) {
      regenerateMap(seed);
      expect(bfsConnected(), `seed ${seed} disconnected`).toBe(true);
      // Every segment endpoint must exist and all nodes stay inside the world.
      const ids = new Set(ROAD_NODES.map(n => n.id));
      for (const s of ROAD_SEGMENTS) {
        expect(ids.has(s.startNodeId)).toBe(true);
        expect(ids.has(s.endNodeId)).toBe(true);
      }
      for (const n of ROAD_NODES) {
        expect(n.pos.x).toBeGreaterThanOrEqual(0);
        expect(n.pos.x).toBeLessThanOrEqual(1280 * 3);
        expect(n.pos.y).toBeGreaterThanOrEqual(0);
        expect(n.pos.y).toBeLessThanOrEqual(720 * 3);
      }
    }
  });

  it('keeps all five district identities and every district holds at least one node', () => {
    for (let seed = 200; seed < 220; seed++) {
      regenerateMap(seed);
      const ids = DISTRICT_DEFINITIONS.map(d => d.id).sort();
      expect(ids).toEqual(['Karori', 'Karori Central', 'Karori East', 'Karori North', 'Karori West'].sort());
      for (const d of DISTRICT_DEFINITIONS) {
        const hasNode = ROAD_NODES.some(n => getDistrictForPoint(n.pos) === d.id);
        expect(hasNode, `seed ${seed}: district ${d.id} has no road nodes`).toBe(true);
      }
    }
  });

  it('A* pathfinding works on regenerated maps (geometry caches rebuild)', () => {
    regenerateMap(424242);
    const path = findShortestPath(ROAD_NODES[0].id, ROAD_NODES[ROAD_NODES.length - 1].id);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
  });
});
