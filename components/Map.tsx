import React, { useMemo } from 'react';
import * as CONSTANTS from '../constants';
// FIX: Module '"../utils/mapData"' declares 'DistrictName' locally, but it is not exported. It is now correctly imported from '../types'.
import { ROAD_SEGMENTS, ROAD_NODES, DISTRICT_DEFINITIONS } from '../utils/mapData';
import { DistrictName } from '../types';
import { getDistrictForPoint, findClosestPointOnRoad } from '../utils/geometry';

interface Decoration {
    type: 'tree' | 'building' | 'house' | 'warehouse';
    x: number;
    y: number;
    width?: number;
    height?: number;
    rot?: number;
}

const GameMap: React.FC = () => {
    const nodeMap = useMemo(() => new Map(ROAD_NODES.map(node => [node.id, node.pos])), []);

    const decorations = useMemo(() => {
        const decs: Decoration[] = [];
        const districtDecorations: Record<DistrictName, { type: Decoration['type']; count: number }> = {
            'Karori North': { type: 'tree', count: 250 },
            'Karori West': { type: 'house', count: 100 },
            'Karori Central': { type: 'building', count: 50 },
            'Karori East': { type: 'warehouse', count: 40 },
            'Karori': { type: 'house', count: 20 },
        };

        DISTRICT_DEFINITIONS.forEach(district => {
            const decorInfo = districtDecorations[district.id];
            if (!decorInfo) return;

            for (let i = 0; i < decorInfo.count; i++) {
                let placed = false;
                let attempts = 0;
                while (!placed && attempts < 10) {
                    attempts++;
                    const x = district.bounds.x + 20 + Math.random() * (district.bounds.width - 40);
                    const y = district.bounds.y + 20 + Math.random() * (district.bounds.height - 40);

                    const closestRoadInfo = findClosestPointOnRoad({ x, y });
                    const roadBuffer = (CONSTANTS.ROAD_WIDTH / 2) + 20; // Distance from centerline to edge + 20px margin
                    const tooCloseToRoad = closestRoadInfo && closestRoadInfo.dist < roadBuffer;

                    if (!tooCloseToRoad) {
                        const rot = Math.floor(Math.random() * 4) * 90;
                        let newDecor: Decoration | null = null;
                        switch (decorInfo.type) {
                            case 'tree':
                                newDecor = { type: 'tree', x, y };
                                break;
                            case 'house':
                                newDecor = { type: 'house', x, y, width: 30, height: 40, rot };
                                break;
                            case 'building':
                                newDecor = { type: 'building', x, y, width: 80, height: 120, rot };
                                break;
                            case 'warehouse':
                                newDecor = { type: 'warehouse', x, y, width: 150, height: 100, rot };
                                break;
                        }
                        if (newDecor) decs.push(newDecor);
                        placed = true;
                    }
                }
            }
        });

        return decs;
    }, []);

    return (
        <svg
            width={CONSTANTS.WORLD_WIDTH}
            height={CONSTANTS.WORLD_HEIGHT}
            className="absolute top-0 left-0 bg-[#0d0221]"
        >
            <defs>
                <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                    <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                </pattern>
            </defs>
            <rect width={CONSTANTS.WORLD_WIDTH} height={CONSTANTS.WORLD_HEIGHT} fill="url(#grid)" />

            {/* District Ground Layers */}
            {DISTRICT_DEFINITIONS.map((district) => (
                <rect
                    key={district.id}
                    x={district.bounds.x} y={district.bounds.y}
                    width={district.bounds.width} height={district.bounds.height}
                    fill={district.theme.groundColor}
                />
            ))}

            {/* Decorations */}
            <g>
                {decorations.map((d, i) => {
                     const districtName = getDistrictForPoint({x: d.x, y: d.y});
                     const districtDef = DISTRICT_DEFINITIONS.find(def => def.id === districtName);
                     const color = districtDef ? districtDef.theme.decorColor : '#f0f';
                     
                     switch (d.type) {
                        case 'tree': // Abstract pyramid tree
                            return (
                                <path 
                                    key={i} 
                                    d={`M ${d.x-10} ${d.y+10} L ${d.x} ${d.y-15} L ${d.x+10} ${d.y+10} Z M ${d.x} ${d.y-15} L ${d.x} ${d.y+15}`}
                                    stroke={color} 
                                    strokeWidth="2" 
                                    fill="none" 
                                    strokeOpacity="0.5"
                                />
                            );
                        case 'house':
                        case 'building':
                        case 'warehouse':
                             return (
                                <rect 
                                    key={i} 
                                    x={d.x - d.width! / 2} y={d.y - d.height! / 2} 
                                    width={d.width} height={d.height} 
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="3"
                                    strokeOpacity="0.7"
                                    transform={`rotate(${d.rot} ${d.x} ${d.y})`} 
                                />
                            );
                        default:
                            return null;
                    }
                })}
            </g>

            {/* Road Kerbs/Outlines */}
            <g>
                {ROAD_SEGMENTS.map((segment) => {
                    const start = nodeMap.get(segment.startNodeId);
                    const end = nodeMap.get(segment.endNodeId);
                    if (!start || !end) return null;

                    return (
                        <line
                            key={`road-kerb-${segment.id}`}
                            x1={start.x} y1={start.y}
                            x2={end.x} y2={end.y}
                            stroke={'#4f46e5'}
                            strokeWidth={CONSTANTS.ROAD_WIDTH + 8}
                            strokeLinecap="round"
                        />
                    )
                })}
            </g>

            {/* Road Surfaces */}
            <g>
                {ROAD_SEGMENTS.map((segment) => {
                    const start = nodeMap.get(segment.startNodeId);
                    const end = nodeMap.get(segment.endNodeId);
                    if (!start || !end) return null;
                    const district = DISTRICT_DEFINITIONS.find(d => d.id === getDistrictForPoint(start));

                    return (
                        <line
                            key={`road-surface-${segment.id}`}
                            x1={start.x} y1={start.y}
                            x2={end.x} y2={end.y}
                            stroke={district ? district.theme.roadColor : '#374151'}
                            strokeWidth={CONSTANTS.ROAD_WIDTH}
                            strokeLinecap="round"
                        />
                    )
                })}
            </g>
            
            {/* Intersection Hubs - Drawn on top to clean up joins */}
            <g>
                {ROAD_NODES.map(node => {
                    const district = DISTRICT_DEFINITIONS.find(d => d.id === getDistrictForPoint(node.pos));
                    return (
                        <g key={`node-hub-${node.id}`}>
                             {/* Roundabout Kerb */}
                            <circle
                                cx={node.pos.x}
                                cy={node.pos.y}
                                r={(CONSTANTS.ROAD_WIDTH / 2) + 20 + 4}
                                fill={'#4f46e5'}
                            />
                            {/* Roundabout road surface */}
                            <circle
                                cx={node.pos.x}
                                cy={node.pos.y}
                                r={(CONSTANTS.ROAD_WIDTH / 2) + 20} // Larger radius for roundabout
                                fill={district ? district.theme.roadColor : '#374151'}
                            />
                            {/* Central island */}
                            <circle
                                cx={node.pos.x}
                                cy={node.pos.y}
                                r={20}
                                fill={district ? district.theme.groundColor : '#0d0221'}
                                stroke="#00ffff"
                                strokeWidth="3"
                            />
                        </g>
                    )
                })}
            </g>
            
            {/* Road Markings */}
            <g>
                {ROAD_SEGMENTS.map((segment) => {
                    const start = nodeMap.get(segment.startNodeId);
                    const end = nodeMap.get(segment.endNodeId);
                    if (!start || !end) return null;

                    let strokeColor = 'none';
                    let strokeDasharray = '';
                    let strokeWidth = 3;

                    switch (segment.type) {
                        case 'Motorway':
                            strokeColor = '#facc15'; // yellow-400
                            strokeWidth = 5;
                            break;
                        case 'Primary':
                        case 'Suburban':
                            strokeColor = 'white';
                            strokeDasharray = '20, 25';
                            break;
                        case 'Industrial':
                            strokeColor = '#facc15'; // yellow-400
                            break;
                        case 'Rural':
                        default:
                            return null; // No center line for rural roads
                    }

                    return (
                        <line
                            key={`marking-${segment.id}`}
                            x1={start.x} y1={start.y}
                            x2={end.x} y2={end.y}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={strokeDasharray}
                            strokeOpacity={0.6}
                            strokeLinecap="round"
                        />
                    );
                })}
            </g>

        </svg>
    );
};

export default React.memo(GameMap);