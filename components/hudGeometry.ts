export interface ViewTransform {
  center: { x: number; y: number };
  zoom: number;
  viewport: { width: number; height: number };
}

export interface IndicatorPosition { x: number; y: number; degrees: number }

export const offscreenIndicatorPosition = (
  target: { x: number; y: number },
  { center, zoom, viewport }: ViewTransform,
  padding = 30,
): IndicatorPosition | null => {
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  const screenX = (target.x - center.x) * zoom + centerX;
  const screenY = (target.y - center.y) * zoom + centerY;

  if (screenX >= padding && screenX <= viewport.width - padding && screenY >= padding && screenY <= viewport.height - padding) return null;

  const deltaX = screenX - centerX;
  const deltaY = screenY - centerY;
  const scaleX = deltaX === 0 ? Number.POSITIVE_INFINITY : (centerX - padding) / Math.abs(deltaX);
  const scaleY = deltaY === 0 ? Number.POSITIVE_INFINITY : (centerY - padding) / Math.abs(deltaY);
  const edgeScale = Math.min(scaleX, scaleY);
  return {
    x: centerX + deltaX * edgeScale,
    y: centerY + deltaY * edgeScale,
    degrees: Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90,
  };
};
