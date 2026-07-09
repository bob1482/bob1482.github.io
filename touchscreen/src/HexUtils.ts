import * as PIXI from 'pixi.js';

/** Draw a pointy-top hexagon with rounded corners */
export function drawRoundedHexagon(
  g: PIXI.Graphics,
  cx: number,
  cy: number,
  s: number,
  radius: number
): void {
  const sqrt3 = Math.sqrt(3);
  const r = Math.min(radius, s * 0.3);

  // 6 vertices of a pointy-top hexagon (rotated 90° CCW from flat-top)
  const v: { x: number; y: number }[] = [
    { x: cx, y: cy - s },                               // top
    { x: cx + sqrt3 / 2 * s, y: cy - s / 2 },           // top-right
    { x: cx + sqrt3 / 2 * s, y: cy + s / 2 },           // bottom-right
    { x: cx, y: cy + s },                               // bottom
    { x: cx - sqrt3 / 2 * s, y: cy + s / 2 },           // bottom-left
    { x: cx - sqrt3 / 2 * s, y: cy - s / 2 },           // top-left
  ];

  // Start at the tangent point before v0 (along edge v5->v0)
  const dx0 = v[0].x - v[5].x;
  const dy0 = v[0].y - v[5].y;
  const len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
  const startX = v[0].x - (dx0 / len0) * r;
  const startY = v[0].y - (dy0 / len0) * r;

  g.moveTo(startX, startY);

  for (let i = 0; i < 6; i++) {
    const curr = v[i];
    const next = v[(i + 1) % 6];

    // Tangent point on edge curr->next, r away from curr
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const tx = curr.x + (dx / len) * r;
    const ty = curr.y + (dy / len) * r;

    g.arcTo(curr.x, curr.y, tx, ty, r);
  }

  g.closePath();
}

/** Test if a point (x, y) is inside a pointy-top hexagon centered at (cx, cy) with size s */
export function hitTestHexagon(x: number, y: number, cx: number, cy: number, s: number): boolean {
  const sqrt3 = Math.sqrt(3);
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);

  // Quick bounding box check for pointy-top hexagon
  if (dx > s * sqrt3 / 2 || dy > s) return false;

  // Point-in-hexagon test for pointy-top hex
  return dy <= s - dx / sqrt3;
}

/** Generate a unique key for the graphics/label map using midi and index */
export function keyId(midi: number, index: number): string {
  return `${midi}_${index}`;
}