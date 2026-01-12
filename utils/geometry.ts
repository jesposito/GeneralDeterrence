import { DistrictName } from '../types';
import { ROAD_NODES, ROAD_SEGMENTS, DISTRICT_DEFINITIONS as MAP_DISTRICT_DEFINITIONS, RoadNode } from './mapData';

export const DISTRICT_DEFINITIONS = MAP_DISTRICT_DEFINITIONS;

const nodeMap = new Map(ROAD_NODES.map(node => [node.id, node]));
const adjacencyList: Map<string, string[]> = new Map();

for (const node of ROAD_NODES) {
  adjacencyList.set(node.id, []);
}
for (const segment of ROAD_SEGMENTS) {
  adjacencyList.get(segment.startNodeId)?.push(segment.endNodeId);
  adjacencyList.get(segment.endNodeId)?.push(segment.startNodeId);
}

export const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getDistanceSq = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
};

export const getRads = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

export const findClosestPointOnRoad = (point: { x: number, y: number }): { point: { x: number, y: number }, dist: number, angle: number } | null => {
  let closestPointResult: { x: number, y: number } | null = null;
  let minDistance = Infinity;
  let roadAngle = 0;

  for (const segment of ROAD_SEGMENTS) {
    const startNode = nodeMap.get(segment.startNodeId);
    const endNode = nodeMap.get(segment.endNodeId);
    if (!startNode || !endNode) continue;
    
    const { x: x1, y: y1 } = startNode.pos;
    const { x: x2, y: y2 } = endNode.pos;
    const { x, y } = point;

    const lenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    
    let t = 0;
    if (lenSq !== 0) {
      t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
      t = Math.max(0, Math.min(1, t)); // Clamp t to the segment
    }

    const currentClosestPoint = {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
    
    const dist = getDistance(point, currentClosestPoint);

    if (dist < minDistance) {
      minDistance = dist;
      closestPointResult = currentClosestPoint;
      roadAngle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    }
  }

  if (!closestPointResult) return null;

  return { point: closestPointResult, dist: minDistance, angle: roadAngle };
};

export const findClosestNode = (point: { x: number; y: number }): { node: RoadNode; dist: number } | null => {
  if (ROAD_NODES.length === 0) return null;

  let closestNode: RoadNode = ROAD_NODES[0];
  let minDistanceSq = Infinity;

  for (const node of ROAD_NODES) {
    const dx = point.x - node.pos.x;
    const dy = point.y - node.pos.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestNode = node;
    }
  }

  return { node: closestNode, dist: Math.sqrt(minDistanceSq) };
};


export const generateNewPath = (districtId?: DistrictName, startNodeId?: string, homeDistrictId?: DistrictName): string[] | null => {
    let startNode: RoadNode;

    let effectiveHomeDistrict = homeDistrictId;
    // When spawning a new car in Karori, lock its path to that district.
    if (!startNodeId && districtId === 'Karori') {
        effectiveHomeDistrict = 'Karori';
    }

    if (startNodeId) {
        const node = nodeMap.get(startNodeId);
        if (node) {
            startNode = node;
        } else {
            // Fallback if provided ID is invalid
            const potentialStartNodes = ROAD_NODES;
            if (potentialStartNodes.length === 0) return null;
            startNode = potentialStartNodes[Math.floor(Math.random() * potentialStartNodes.length)];
        }
    } else {
        // Original logic for spawning new cars
        let potentialStartNodes = ROAD_NODES;
        if (districtId) {
            const district = DISTRICT_DEFINITIONS.find(d => d.id === districtId);
            if (district) {
                const districtNodes = ROAD_NODES.filter(node => {
                    const { x, y } = node.pos;
                    const bounds = district.bounds;
                    return x >= bounds.x && x <= bounds.x + bounds.width &&
                        y >= bounds.y && y <= bounds.y + bounds.height;
                });
                if (districtNodes.length > 0) {
                    potentialStartNodes = districtNodes;
                }
            }
        }
        if (potentialStartNodes.length === 0) return null;
        startNode = potentialStartNodes[Math.floor(Math.random() * potentialStartNodes.length)];
    }
    
    let currentNodeId = startNode.id;
    
    const pathNodeIds: string[] = [currentNodeId];
    const pathLength = 3 + Math.floor(Math.random() * 5); // Path of 3 to 7 segments

    for(let i = 0; i < pathLength; i++) {
        const neighbors = adjacencyList.get(currentNodeId);
        if (!neighbors || neighbors.length === 0) break;
        
        let candidates = neighbors;
        // Avoid immediately going back unless it's a dead end
        if (neighbors.length > 1 && pathNodeIds.length > 1) {
            const previousNodeId = pathNodeIds[pathNodeIds.length - 2];
            const nonReturning = neighbors.filter(id => id !== previousNodeId);
            if (nonReturning.length > 0) {
                candidates = nonReturning;
            }
        }

        let nextNodeId: string;

        // Apply home district logic if applicable
        if (effectiveHomeDistrict && candidates.length > 1) {
            const stayInDistrict = Math.random() < 0.8; // 80% chance
            const neighborsInDistrict = candidates.filter(id => {
                const node = nodeMap.get(id);
                return node && getDistrictForPoint(node.pos) === effectiveHomeDistrict;
            });

            if (stayInDistrict && neighborsInDistrict.length > 0) {
                nextNodeId = neighborsInDistrict[Math.floor(Math.random() * neighborsInDistrict.length)];
            } else {
                // Roam (20% chance) or no path available within district, so pick from any candidate
                nextNodeId = candidates[Math.floor(Math.random() * candidates.length)];
            }
        } else {
            // Default behavior if no home district or at a dead end
            nextNodeId = candidates[Math.floor(Math.random() * candidates.length)];
        }

        pathNodeIds.push(nextNodeId);
        currentNodeId = nextNodeId;
    }
    
    if (pathNodeIds.length < 2) return null;
    
    return pathNodeIds;
};


export const getDistrictForPoint = (pos: {x: number, y: number}): DistrictName => {
    // By iterating through the pre-ordered DISTRICT_DEFINITIONS, we ensure the first match
    // is the most specific one (e.g., 'Karori' or 'Karori Central' before a larger zone).
    for (const districtDef of DISTRICT_DEFINITIONS) {
        const bounds = districtDef.bounds;
        if (pos.x >= bounds.x && pos.x <= bounds.x + bounds.width &&
            pos.y >= bounds.y && pos.y <= bounds.y + bounds.height) {
            return districtDef.id;
        }
    }
    
    // Fallback in case a point is outside all defined districts.
    return 'Karori West';
};

// A* Pathfinding
class PriorityQueue<T> {
    private items: { item: T; priority: number }[] = [];
    enqueue(item: T, priority: number) { this.items.push({ item, priority }); this.items.sort((a, b) => a.priority - b.priority); }
    dequeue(): T | undefined { return this.items.shift()?.item; }
    isEmpty(): boolean { return this.items.length === 0; }
}

export const findShortestPath = (startNodeId: string, endNodeId: string): string[] | null => {
    if (!nodeMap.has(startNodeId) || !nodeMap.has(endNodeId)) return null;

    const openSet = new PriorityQueue<string>();
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const endNodePos = nodeMap.get(endNodeId)!.pos;
    
    adjacencyList.forEach((_, nodeId) => {
        gScore.set(nodeId, Infinity);
        fScore.set(nodeId, Infinity);
    });

    gScore.set(startNodeId, 0);
    fScore.set(startNodeId, getDistance(nodeMap.get(startNodeId)!.pos, endNodePos));
    openSet.enqueue(startNodeId, fScore.get(startNodeId)!);

    while (!openSet.isEmpty()) {
        const currentId = openSet.dequeue()!;
        if (currentId === endNodeId) {
            const path = [currentId];
            let current = currentId;
            while (cameFrom.has(current)) {
                current = cameFrom.get(current)!;
                path.unshift(current);
            }
            return path;
        }

        const neighbors = adjacencyList.get(currentId) || [];
        for (const neighborId of neighbors) {
            const currentPos = nodeMap.get(currentId)!.pos;
            const neighborPos = nodeMap.get(neighborId)!.pos;
            const tentativeGScore = gScore.get(currentId)! + getDistance(currentPos, neighborPos);

            if (tentativeGScore < (gScore.get(neighborId) ?? Infinity)) {
                cameFrom.set(neighborId, currentId);
                gScore.set(neighborId, tentativeGScore);
                fScore.set(neighborId, tentativeGScore + getDistance(neighborPos, endNodePos));
                openSet.enqueue(neighborId, fScore.get(neighborId)!);
            }
        }
    }

    return null; // No path found
};