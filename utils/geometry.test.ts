import { describe, it, expect } from 'vitest';
import { getDistance, getDistanceSq, findClosestPointOnRoad, getDistrictForPoint, findNearestInCone, findShortestPath, generateNewPath } from './geometry';
import { mulberry32 } from './rng';

describe('geometry', () => {
  it('getDistance is the Euclidean distance', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('getDistanceSq skips the sqrt', () => {
    expect(getDistanceSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });

  it('findClosestPointOnRoad returns a finite clamped point', () => {
    const r = findClosestPointOnRoad({ x: 0, y: 0 });
    expect(r).not.toBeNull();
    expect(Number.isFinite(r!.dist)).toBe(true);
    expect(Number.isFinite(r!.point.x)).toBe(true);
    expect(Number.isFinite(r!.point.y)).toBe(true);
  });

  it('getDistrictForPoint falls back to Karori West outside all bounds', () => {
    expect(getDistrictForPoint({ x: -999999, y: -999999 })).toBe('Karori West');
  });

  it('findShortestPath returns null for unknown nodes', () => {
    expect(findShortestPath('__nope__', '__nada__')).toBeNull();
  });

  it('generates the same traffic path from the same RNG seed', () => {
    expect(generateNewPath(undefined, undefined, undefined, mulberry32(42)))
      .toEqual(generateNewPath(undefined, undefined, undefined, mulberry32(42)));
  });

  it('targets the nearest candidate inside the forward cone', () => {
    const behind = { id: 'behind', pos: { x: 0, y: 20 } };
    const far = { id: 'far', pos: { x: 0, y: -80 } };
    const near = { id: 'near', pos: { x: 10, y: -40 } };
    expect(findNearestInCone({ x: 0, y: 0 }, 0, [behind, far, near], 100, 60)).toBe(near);
    expect(findNearestInCone({ x: 0, y: 0 }, 0, [behind], 100, 60)).toBeNull();
  });
});
