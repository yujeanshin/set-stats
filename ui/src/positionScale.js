// The position heatmap's color scale (brief-v3 item 8): each cell is
// colored by how far its share is from an even spread, above or below.
// Pure, so test/positionScale.test.js can check it in node.

/** A find uses 3 of the 12 positions, so an even spread is 25% each. */
export const EVEN_SHARE = 0.25;

/**
 * The scale reaches full color at least this far from 25% (5 points), so
 * near-even data looks near-neutral instead of being stretched to fill it.
 */
export const MIN_EXTENT = 0.05;

/** Color steps on each side of neutral. */
export const STEPS = 4;

/** How far from 25% full color is: MIN_EXTENT, or the farthest cell. */
export function heatExtent(shares) {
  const far = shares
    .filter((s) => s != null)
    .reduce((m, s) => Math.max(m, Math.abs(s - EVEN_SHARE)), 0);
  return Math.max(MIN_EXTENT, far);
}

/**
 * The color step of a share, -STEPS (far below 25%) to STEPS (far above),
 * 0 for about even. Null for no data.
 */
export function heatLevel(share, extent) {
  if (share == null) return null;
  const t = (share - EVEN_SHARE) / extent;
  const level = Math.round(t * STEPS);
  return Math.max(-STEPS, Math.min(STEPS, level)) || 0; // no -0
}
