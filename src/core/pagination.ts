export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

export function clampPage(page: number, total: number): number {
  if (!Number.isFinite(page)) return 1;
  const lastPage = Math.max(Math.round(total), 1);
  return Math.min(Math.max(Math.round(page), 1), lastPage);
}

export function stepZoom(current: number, direction: 1 | -1): number {
  if (direction === 1) {
    const next = ZOOM_LEVELS.find((level) => level > current + 0.001);
    return next ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ?? current;
  }

  const previous = [...ZOOM_LEVELS].reverse().find((level) => level < current - 0.001);
  return previous ?? ZOOM_LEVELS[0] ?? current;
}

export function fitWidthScale(pageWidth: number, availableWidth: number): number {
  if (!(pageWidth > 0) || !(availableWidth > 0)) return 1;
  const scale = availableWidth / pageWidth;
  return Math.min(Math.max(Math.round(scale * 100) / 100, MIN_ZOOM), MAX_ZOOM);
}
