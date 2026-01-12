import { DistrictName, RoadType } from '../types';

export interface RoadNode {
  id: string;
  pos: { x: number; y: number };
}

export interface RoadSegment {
  id: string;
  startNodeId: string;
  endNodeId: string;
  type: RoadType;
}

export const ROAD_NODES: RoadNode[] = [
    // Motorway (North-South on the East side)
    { id: 'm1', pos: { x: 3400, y: 100 } },
    { id: 'm2', pos: { x: 3400, y: 700 } },
    { id: 'm3', pos: { x: 3400, y: 1500 } },
    { id: 'm4', pos: { x: 3400, y: 2000 } },

    // Town Centre Grid
    { id: 'c1', pos: { x: 1700, y: 900 } },
    { id: 'c2', pos: { x: 2100, y: 900 } },
    { id: 'c3', pos: { x: 1700, y: 1200 } },
    { id: 'c4', pos: { x: 2100, y: 1200 } },
    { id: 'c5', pos: { x: 1700, y: 1500 } },
    { id: 'c6', pos: { x: 2100, y: 1500 } },
    
    // Connectors from Centre to Motorway
    { id: 'cm1', pos: { x: 2800, y: 900 } },
    { id: 'cm2', pos: { x: 2800, y: 1500 } },

    // Suburban West
    { id: 's1', pos: { x: 500, y: 900 } },
    { id: 's2', pos: { x: 1200, y: 900 } },
    { id: 's3', pos: { x: 500, y: 1500 } },
    { id: 's4', pos: { x: 1200, y: 1500 } },
    { id: 's5', pos: { x: 850, y: 1800 } },
    
    // Rural North (Winding Roads)
    { id: 'r1', pos: { x: 500, y: 200 } },
    { id: 'r2', pos: { x: 1200, y: 400 } },
    { id: 'r3', pos: { x: 1800, y: 250 } },
    { id: 'r4', pos: { x: 2500, y: 500 } },
    { id: 'r5', pos: { x: 2800, y: 200 } },

    // Industrial South
    { id: 'i1', pos: { x: 1700, y: 2000 } },
    { id: 'i2', pos: { x: 2800, y: 2000 } },
    { id: 'i3', pos: { x: 2100, y: 1800 } },

    // Karori (New secluded area)
    { id: 'k_entry', pos: { x: 300, y: 1600 } },
    { id: 'h1', pos: { x: 150, y: 1750 } },
    { id: 'h2', pos: { x: 150, y: 1950 } },
    { id: 'h3', pos: { x: 350, y: 2050 } },
    { id: 'h4', pos: { x: 550, y: 1950 } },
    { id: 'h5', pos: { x: 550, y: 1750 } },
];

export const ROAD_SEGMENTS: RoadSegment[] = [
    // Motorway
    { id: 'seg-m1-m2', startNodeId: 'm1', endNodeId: 'm2', type: 'Motorway' },
    { id: 'seg-m2-m3', startNodeId: 'm2', endNodeId: 'm3', type: 'Motorway' },
    { id: 'seg-m3-m4', startNodeId: 'm3', endNodeId: 'm4', type: 'Motorway' },

    // Town Centre
    { id: 'seg-c1-c2', startNodeId: 'c1', endNodeId: 'c2', type: 'Primary' },
    { id: 'seg-c1-c3', startNodeId: 'c1', endNodeId: 'c3', type: 'Primary' },
    { id: 'seg-c2-c4', startNodeId: 'c2', endNodeId: 'c4', type: 'Primary' },
    { id: 'seg-c3-c4', startNodeId: 'c3', endNodeId: 'c4', type: 'Primary' },
    { id: 'seg-c3-c5', startNodeId: 'c3', endNodeId: 'c5', type: 'Primary' },
    { id: 'seg-c4-c6', startNodeId: 'c4', endNodeId: 'c6', type: 'Primary' },
    { id: 'seg-c5-c6', startNodeId: 'c5', endNodeId: 'c6', type: 'Primary' },
    
    // Connectors
    { id: 'seg-c2-cm1', startNodeId: 'c2', endNodeId: 'cm1', type: 'Primary' },
    { id: 'seg-c6-cm2', startNodeId: 'c6', endNodeId: 'cm2', type: 'Primary' },
    { id: 'seg-cm1-m2', startNodeId: 'cm1', endNodeId: 'm2', type: 'Primary' },
    { id: 'seg-cm2-m3', startNodeId: 'cm2', endNodeId: 'm3', type: 'Primary' },
    { id: 'seg-c1-s2', startNodeId: 'c1', endNodeId: 's2', type: 'Primary' },
    { id: 'seg-c5-s4', startNodeId: 'c5', endNodeId: 's4', type: 'Primary' },
    { id: 'seg-c5-i1', startNodeId: 'c5', endNodeId: 'i1', type: 'Primary' },
    { id: 'seg-c6-i3', startNodeId: 'c6', endNodeId: 'i3', type: 'Primary' },

    // Suburban
    { id: 'seg-s1-s2', startNodeId: 's1', endNodeId: 's2', type: 'Suburban' },
    { id: 'seg-s1-s3', startNodeId: 's1', endNodeId: 's3', type: 'Suburban' },
    { id: 'seg-s2-s4', startNodeId: 's2', endNodeId: 's4', type: 'Suburban' },
    { id: 'seg-s3-s4', startNodeId: 's3', endNodeId: 's4', type: 'Suburban' },
    { id: 'seg-s3-s5', startNodeId: 's3', endNodeId: 's5', type: 'Suburban' },
    { id: 'seg-s4-s5', startNodeId: 's4', endNodeId: 's5', type: 'Suburban' },

    // Rural
    { id: 'seg-s1-r1', startNodeId: 's1', endNodeId: 'r1', type: 'Rural' },
    { id: 'seg-r1-r2', startNodeId: 'r1', endNodeId: 'r2', type: 'Rural' },
    { id: 'seg-r2-r3', startNodeId: 'r2', endNodeId: 'r3', type: 'Rural' },
    { id: 'seg-r3-r4', startNodeId: 'r3', endNodeId: 'r4', type: 'Rural' },
    { id: 'seg-r4-m1', startNodeId: 'r4', endNodeId: 'm1', type: 'Rural' },
    { id: 'seg-r3-r5', startNodeId: 'r3', endNodeId: 'r5', type: 'Rural' },
    { id: 'seg-r5-m1', startNodeId: 'r5', endNodeId: 'm1', type: 'Rural' },
    { id: 'seg-c1-r2', startNodeId: 'c1', endNodeId: 'r2', type: 'Rural' },

    // Industrial
    { id: 'seg-i1-i2', startNodeId: 'i1', endNodeId: 'i2', type: 'Industrial' },
    { id: 'seg-i1-s5', startNodeId: 'i1', endNodeId: 's5', type: 'Industrial' },
    { id: 'seg-i3-i2', startNodeId: 'i3', endNodeId: 'i2', type: 'Industrial' },
    { id: 'seg-i2-m4', startNodeId: 'i2', endNodeId: 'm4', type: 'Industrial' },

    // Karori Segments
    { id: 'seg-s3-k_entry', startNodeId: 's3', endNodeId: 'k_entry', type: 'Suburban' }, // Connection to main network
    { id: 'seg-k_entry-h1', startNodeId: 'k_entry', endNodeId: 'h1', type: 'Suburban' },
    { id: 'seg-h1-h2', startNodeId: 'h1', endNodeId: 'h2', type: 'Suburban' },
    { id: 'seg-h2-h3', startNodeId: 'h2', endNodeId: 'h3', type: 'Suburban' },
    { id: 'seg-h3-h4', startNodeId: 'h3', endNodeId: 'h4', type: 'Suburban' },
    { id: 'seg-h4-h5', startNodeId: 'h4', endNodeId: 'h5', type: 'Suburban' },
];

interface DistrictTheme {
  groundColor: string;
  roadColor: string;
  decorColor: string;
}
export interface DistrictDefinition {
  id: DistrictName;
  name: string;
  bounds: { x: number; y: number; width: number; height: number; };
  theme: DistrictTheme;
}

// FIX: Defined WORLD_WIDTH and WORLD_HEIGHT locally to break a circular dependency
// with constants.ts that was causing type inference issues.
const WORLD_WIDTH = 1280 * 3;
const WORLD_HEIGHT = 720 * 3;
const MID_X = WORLD_WIDTH / 2;
const MID_Y = WORLD_HEIGHT / 2;
const NORTH_SOUTH_BOUNDARY_Y = 800; // New boundary to correctly separate Rural North from other zones.

// The order is important. Smaller, overlapping zones must come before the larger zones they are inside.
export const DISTRICT_DEFINITIONS: DistrictDefinition[] = [
    { 
        id: 'Karori', name: 'Karori', 
        bounds: { x: 50, y: 1700, width: 600, height: 450 }, // Special zone inside West
        theme: { groundColor: 'rgba(5, 5, 20, 0.8)', roadColor: '#2d3748', decorColor: '#a0aec0' } 
    },
    { 
        id: 'Karori Central', name: 'Town Centre', 
        bounds: { x: MID_X - 600, y: MID_Y - 500, width: 1200, height: 1000 }, // Overlaps West and East
        theme: { groundColor: 'rgba(7, 8, 33, 0.7)', roadColor: '#374151', decorColor: '#22d3ee' } 
    },
    { 
        id: 'Karori North', name: 'Rural North', 
        bounds: { x: 0, y: 0, width: WORLD_WIDTH, height: NORTH_SOUTH_BOUNDARY_Y },
        theme: { groundColor: 'rgba(26, 10, 59, 0.7)', roadColor: '#374151', decorColor: '#34d399' } 
    },
    { 
        id: 'Karori West', name: 'Suburban West', 
        bounds: { x: 0, y: NORTH_SOUTH_BOUNDARY_Y, width: MID_X, height: WORLD_HEIGHT - NORTH_SOUTH_BOUNDARY_Y },
        theme: { groundColor: 'rgba(28, 13, 64, 0.7)', roadColor: '#374151', decorColor: '#fb923c' } 
    },
    { 
        id: 'Karori East', name: 'Motorway East', 
        bounds: { x: MID_X, y: NORTH_SOUTH_BOUNDARY_Y, width: MID_X, height: WORLD_HEIGHT - NORTH_SOUTH_BOUNDARY_Y },
        theme: { groundColor: 'rgba(17, 13, 44, 0.7)', roadColor: '#374151', decorColor: '#facc15' } 
    },
];