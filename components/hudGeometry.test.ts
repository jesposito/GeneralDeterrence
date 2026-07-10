import { describe, expect, it } from 'vitest';
import { offscreenIndicatorPosition, type ViewTransform } from './hudGeometry';

const view = (zoom: number): ViewTransform => ({
  center: { x: 0, y: 0 },
  zoom,
  viewport: { width: 844, height: 390 },
});

describe('offscreenIndicatorPosition', () => {
  it('uses CSS pixels after zoom when deciding visibility', () => {
    expect(offscreenIndicatorPosition({ x: 400, y: 0 }, view(0.85))).toBeNull();
    expect(offscreenIndicatorPosition({ x: 400, y: 0 }, view(1.02))?.x).toBeCloseTo(814);
  });

  it('intersects the padded viewport edge at mobile base zoom', () => {
    const indicator = offscreenIndicatorPosition({ x: 1000, y: 200 }, view(0.44));
    expect(indicator).not.toBeNull();
    expect(indicator!.x).toBeCloseTo(814);
    expect(indicator!.y).toBeGreaterThan(30);
    expect(indicator!.y).toBeLessThan(360);
  });
});
