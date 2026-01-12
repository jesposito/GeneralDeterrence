import React from 'react';
import { Player, Civilian, District, DispatchedCall, MinimapMode } from '../types';
import * as CONSTANTS from '../constants';
import { ROAD_NODES, ROAD_SEGMENTS } from '../utils/mapData';

interface MinimapProps {
  player: Player;
  civilians: Civilian[];
  districts: District[];
  dispatchedCall: DispatchedCall | null;
  mode: MinimapMode;
}

const Minimap: React.FC<MinimapProps> = ({ player, civilians, districts, dispatchedCall, mode }) => {
  const ridsCars = civilians.filter(c => c.ridsType);
  const livesAtRiskCars = civilians.filter(c => c.isLifeAtRisk);

  const nodeMap = new Map(ROAD_NODES.map(node => [node.id, node.pos]));

  const getZoneColor = (deterrence: number) => {
    const hue = (deterrence / 100) * 120; // 0 (red) to 120 (green)
    return `hsla(${hue}, 100%, 50%, 0.2)`;
  };
  
  const viewRange = CONSTANTS.MINIMAP_VIEW_RANGE;
  const isTactical = mode === 'Tactical';

  const viewBox = isTactical
    ? `${player.pos.x - viewRange} ${player.pos.y - viewRange} ${viewRange * 2} ${viewRange * 2}`
    : `0 0 ${CONSTANTS.WORLD_WIDTH} ${CONSTANTS.WORLD_HEIGHT}`;
  
  const iconScale = isTactical ? 1 : 4; // Make icons larger on strategic map

  return (
    <div 
        className={`w-full h-full bg-black/70 border-2 border-cyan-500/50 ${isTactical ? 'rounded-full' : 'rounded-lg'} overflow-hidden pointer-events-auto relative transition-all duration-300`}
    >
        <svg 
            width="100%" 
            height="100%" 
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid slice"
        >
            <g transform={isTactical ? `rotate(${-player.angle} ${player.pos.x} ${player.pos.y})` : ''}>
                {/* Background */}
                <rect 
                    x={isTactical ? player.pos.x - viewRange * 2 : -100} 
                    y={isTactical ? player.pos.y - viewRange * 2 : -100} 
                    width={isTactical ? viewRange * 4 : CONSTANTS.WORLD_WIDTH + 200} 
                    height={isTactical ? viewRange * 4 : CONSTANTS.WORLD_HEIGHT + 200}
                    fill="#0d0221" 
                />

                {/* Deterrence Zones Overlay */}
                {districts.map(district => (
                    <rect
                        key={`zone-${district.id}`}
                        x={district.bounds.x}
                        y={district.bounds.y}
                        width={district.bounds.width}
                        height={district.bounds.height}
                        fill={getZoneColor(district.deterrence)}
                        style={{ transition: 'fill 0.5s ease' }}
                    />
                ))}

                {/* Hotspot Zones Overlay */}
                <g>
                    {districts
                        .filter(d => d.deterrence < CONSTANTS.DETERRENCE_HOTSPOT_THRESHOLD)
                        .map(district => (
                            <rect
                                key={`hotspot-${district.id}`}
                                x={district.bounds.x}
                                y={district.bounds.y}
                                width={district.bounds.width}
                                height={district.bounds.height}
                                fill="none"
                                stroke="rgba(255, 0, 0, 0.7)"
                                strokeWidth={isTactical ? 15 : 40}
                                className="animate-pulse"
                            />
                    ))}
                </g>
                
                {/* District Labels for Strategic Map */}
                {!isTactical && (
                    <g>
                        {districts.map(district => (
                            <text
                                key={`label-${district.id}`}
                                x={district.bounds.x + district.bounds.width / 2}
                                y={district.bounds.y + district.bounds.height / 2}
                                fontFamily="Orbitron, sans-serif"
                                fontSize="150"
                                fill="white"
                                opacity="0.7"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                fontWeight="bold"
                                className="pointer-events-none"
                                stroke="black"
                                strokeWidth="5"
                                paintOrder="stroke"
                            >
                                {district.name.toUpperCase()}
                            </text>
                        ))}
                    </g>
                )}

                {/* Roads */}
                <g>
                    {ROAD_SEGMENTS.map((segment) => {
                        const start = nodeMap.get(segment.startNodeId);
                        const end = nodeMap.get(segment.endNodeId);
                        if (!start || !end) return null;
                        return (
                            <line
                                key={`map-road-${segment.id}`}
                                x1={start.x} y1={start.y}
                                x2={end.x} y2={end.y}
                                stroke="#4b5563"
                                strokeWidth={isTactical ? 65 : 45}
                            />
                        )
                    })}
                </g>
                
                {/* RIDS Cars (non-life at risk) */}
                {ridsCars.filter(c => !c.isLifeAtRisk).map(car => (
                    <circle
                        key={`map-car-${car.id}`}
                        cx={car.pos.x} cy={car.pos.y}
                        r={12 * iconScale}
                        fill="magenta"
                        opacity="0.9"
                        className="animate-pulse"
                    />
                ))}

                {/* Lives at Risk Cars */}
                {livesAtRiskCars.map(car => (
                     <circle
                        key={`map-lar-car-${car.id}`}
                        cx={car.pos.x} cy={car.pos.y}
                        r={15 * iconScale}
                        fill="#ff0000"
                        className="animate-pulse"
                    />
                ))}

                {/* Dispatched Call Location */}
                {dispatchedCall && (
                     <g>
                        <circle cx={dispatchedCall.pos.x} cy={dispatchedCall.pos.y} r={45 * iconScale} fill="orange" opacity="0.5" className="animate-pulse" />
                        <circle cx={dispatchedCall.pos.x} cy={dispatchedCall.pos.y} r={55 * iconScale} fill="none" stroke="yellow" strokeWidth={8 * iconScale} className="animate-ping" />
                        <path d={`M ${dispatchedCall.pos.x - (18*iconScale)} ${dispatchedCall.pos.y} L ${dispatchedCall.pos.x + (18*iconScale)} ${dispatchedCall.pos.y}`} stroke="yellow" strokeWidth={6 * iconScale} strokeLinecap="round" />
                        <path d={`M ${dispatchedCall.pos.x} ${dispatchedCall.pos.y - (18*iconScale)} L ${dispatchedCall.pos.x} ${dispatchedCall.pos.y + (18*iconScale)}`} stroke="yellow" strokeWidth={6 * iconScale} strokeLinecap="round" />
                     </g>
                )}
                
                 {/* Player Icon for Strategic Map */}
                 {!isTactical && (
                    <path
                        d={`M 0 ${-20 * iconScale} L ${-12 * iconScale} ${12 * iconScale} L ${12 * iconScale} ${12 * iconScale} Z`}
                        transform={`translate(${player.pos.x} ${player.pos.y}) rotate(${player.angle})`}
                        fill="#00ffff"
                        stroke="white"
                        strokeWidth={4 * iconScale}
                        strokeLinejoin="round"
                    />
                 )}
            </g>

            {/* Player Icon for Tactical Map (static in center) */}
            {isTactical && (
                 <path
                    d={`M ${player.pos.x} ${player.pos.y - 25} L ${player.pos.x - 18} ${player.pos.y + 18} L ${player.pos.x + 18} ${player.pos.y + 18} Z`}
                    fill="#00ffff"
                    stroke="white"
                    strokeWidth="8"
                    strokeLinejoin="round"
                />
            )}
        </svg>

        {/* Radar Crosshairs for Tactical mode */}
        {isTactical && (
            <div className="absolute inset-0">
                <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-400/30"></div>
                <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-400/30"></div>
            </div>
        )}
    </div>
  );
};

export default React.memo(Minimap);