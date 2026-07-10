import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_PIXELS, MAX_RENDER_DPR } from '../constants';
import { getCanvasRenderScale } from './gameRenderer';

describe('getCanvasRenderScale', () => {
  it('caps ordinary high-DPR phones at the render DPR limit', () => {
    expect(getCanvasRenderScale(844, 390, 3, MAX_RENDER_DPR, MAX_CANVAS_PIXELS)).toBe(1.25);
  });

  it('downscales below DPR 1 when a 4K canvas exceeds the pixel budget', () => {
    const scale = getCanvasRenderScale(3840, 2160, 2, 1.5, 5_000_000);
    expect(scale).toBeLessThan(1);
    expect(Math.round(3840 * scale) * Math.round(2160 * scale)).toBeLessThanOrEqual(5_005_000);
  });
});
