import { HexKey } from './HexKey';
import { midiToNoteName, hasSample } from './NoteUtils';

export interface LayoutResult {
  activeKeys: HexKey[];
  leftBoardKeyCount: number;
  hexSize: number;
}

/**
 * Build the full set of hex keys for the Wicki-Heyden grid.
 * Portrait mode uses all keys; landscape mode trims and duplicates them.
 */
export function buildGrid(
  sampleNoteNames: Set<string>,
  cols: number,
  rows: number,
  baseMidi: number
): HexKey[] {
  const hexKeys: HexKey[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Skip the first key (row 0) on every odd column (1st, 3rd, 5th... i.e. col % 2 === 0)
      if (col % 2 === 0 && row === 0) continue;

      // Wicki-Heyden layout: even columns are C octaves, odd columns are G octaves
      let columnBase: number;
      if (col % 2 === 0) {
        columnBase = baseMidi + (col / 2) * 12;   // C2, C3, C4, ...
      } else {
        columnBase = baseMidi + 7 + ((col - 1) / 2) * 12;  // G2, G3, G4, ...
      }
      const midi = columnBase + row * 2 - 2;
      const noteName = midiToNoteName(midi);
      const hasS = hasSample(noteName, sampleNoteNames);

      hexKeys.push({
        col,
        row,
        midi,
        noteName,
        hasSample: hasS,
        isPressed: false,
        centerX: 0,
        centerY: 0,
      });
    }
  }

  return hexKeys;
}

export function updateLayoutPortrait(
  width: number,
  height: number,
  hexKeys: HexKey[],
  cols: number,
): LayoutResult {
  const sqrt3 = Math.sqrt(3);

  const padding = 0;
  const availW = width - 2 * padding;
  const availH = height - 2 * padding;

  // Rotated coordinates: 90° CCW
  let minXU = Infinity, maxXU = -Infinity;
  let minYU = Infinity, maxYU = -Infinity;

  for (const key of hexKeys) {
    const rcol = key.row;
    const rrow = cols - 1 - key.col;
    const xu = rcol * sqrt3 - (rrow % 2 === 1 ? sqrt3 / 2 : 0);
    const yu = rrow * 1.5;
    if (xu < minXU) minXU = xu;
    if (xu > maxXU) maxXU = xu;
    if (yu < minYU) minYU = yu;
    if (yu > maxYU) maxYU = yu;
  }

  const unitW = (maxXU - minXU) + sqrt3;
  const unitH = (maxYU - minYU) + 2;

  const hexSize = Math.min(availW / unitW, availH / unitH);

  const gridW = unitW * hexSize;
  const gridH_ = unitH * hexSize;
  const offsetX = (width - gridW) / 2 + (sqrt3 / 2) * hexSize;
  const offsetY = (height - gridH_) / 2 + hexSize;

  const positionedKeys: HexKey[] = [];

  for (const key of hexKeys) {
    const rcol = key.row;
    const rrow = cols - 1 - key.col;
    const stagger = (rrow % 2 === 1) ? sqrt3 / 2 * hexSize : 0;
    positionedKeys.push({
      ...key,
      isPressed: false,
      centerX: offsetX + rcol * sqrt3 * hexSize - stagger,
      centerY: offsetY + rrow * 1.5 * hexSize,
    });
  }

  return {
    activeKeys: positionedKeys,
    leftBoardKeyCount: 0,
    hexSize,
  };
}

export function updateLayoutLandscape(
  width: number,
  height: number,
  hexKeys: HexKey[],
  cols: number,
): LayoutResult {
  const sqrt3 = Math.sqrt(3);

  // Build trimmed board: keep only original columns 2-7 (visual rows 2-7)
  // Remove top 2 visual rows (original cols 0,1) and bottom 2 visual rows (original cols 8,9)
  const leftKeys = hexKeys.filter(key => key.col >= 2 && key.col <= 7);

  // Compute the bounding box of one trimmed board in hex units (using rotated coords)
  let minXU = Infinity, maxXU = -Infinity;
  let minYU = Infinity, maxYU = -Infinity;

  for (const key of leftKeys) {
    const rcol = key.row;
    const rrow = 7 - key.col; // visual row within trimmed board: col 2->5, col 7->0
    const xu = rcol * sqrt3 - (rrow % 2 === 1 ? sqrt3 / 2 : 0);
    const yu = rrow * 1.5;
    if (xu < minXU) minXU = xu;
    if (xu > maxXU) maxXU = xu;
    if (yu < minYU) minYU = yu;
    if (yu > maxYU) maxYU = yu;
  }

  const unitW = (maxXU - minXU) + sqrt3;
  const unitH = (maxYU - minYU) + 2;

  const availH = height;

  // Height-constrained hex size (landscape: height is the limiter)
  let hexSize = availH / unitH;

  const oneBoardW = unitW * hexSize;

  // Gap between boards = remaining width after placing both boards
  let gapPx = width - oneBoardW * 2;

  if (gapPx < 0) {
    // Not enough width — shrink hex size so boards fit with zero gap
    hexSize = width / (unitW * 2);
    gapPx = 0;
  }

  const totalH = unitH * hexSize;

  // Left board anchored to left edge; right board anchored to right edge
  const leftOffsetX = (sqrt3 / 2) * hexSize;
  const rightOffsetX = width - oneBoardW + (sqrt3 / 2) * hexSize;
  const offsetY = (height - totalH) / 2 + hexSize;

  // Build active keys: left board + right board
  const activeKeys: HexKey[] = [];
  const leftBoardKeyCount = leftKeys.length;

  for (const key of leftKeys) {
    const rcol = key.row;
    const rrow = 7 - key.col;
    const stagger = (rrow % 2 === 1) ? sqrt3 / 2 * hexSize : 0;

    // Left board key (anchored to left edge)
    const leftKey: HexKey = {
      col: key.col,
      row: key.row,
      midi: key.midi,
      noteName: key.noteName,
      hasSample: key.hasSample,
      isPressed: false,
      centerX: leftOffsetX + rcol * sqrt3 * hexSize - stagger,
      centerY: offsetY + rrow * 1.5 * hexSize,
    };
    activeKeys.push(leftKey);

    // Right board key (same MIDI, anchored to right edge)
    const rightKey: HexKey = {
      col: key.col,
      row: key.row,
      midi: key.midi,
      noteName: key.noteName,
      hasSample: key.hasSample,
      isPressed: false,
      centerX: rightOffsetX + rcol * sqrt3 * hexSize - stagger,
      centerY: offsetY + rrow * 1.5 * hexSize,
    };
    activeKeys.push(rightKey);
  }

  return {
    activeKeys,
    leftBoardKeyCount,
    hexSize,
  };
}

/**
 * Layout for a single wide board in landscape mode.
 * Uses a 12×8 hex grid spanning the full width of the screen.
 */
export function updateLayoutLandscapeSingle(
  width: number,
  height: number,
  hexKeys: HexKey[],
  cols: number,
): LayoutResult {
  const sqrt3 = Math.sqrt(3);

  const padding = 0;
  const availW = width - 2 * padding;
  const availH = height - 2 * padding;

  // Rotated coordinates: 90° CCW (same as portrait)
  let minXU = Infinity, maxXU = -Infinity;
  let minYU = Infinity, maxYU = -Infinity;

  for (const key of hexKeys) {
    const rcol = key.row;
    const rrow = cols - 1 - key.col;
    const xu = rcol * sqrt3 - (rrow % 2 === 1 ? sqrt3 / 2 : 0);
    const yu = rrow * 1.5;
    if (xu < minXU) minXU = xu;
    if (xu > maxXU) maxXU = xu;
    if (yu < minYU) minYU = yu;
    if (yu > maxYU) maxYU = yu;
  }

  const unitW = (maxXU - minXU) + sqrt3;
  const unitH = (maxYU - minYU) + 2;

  const hexSize = Math.min(availW / unitW, availH / unitH);

  const gridW = unitW * hexSize;
  const gridH_ = unitH * hexSize;
  const offsetX = (width - gridW) / 2 + (sqrt3 / 2) * hexSize;
  const offsetY = (height - gridH_) / 2 + hexSize;

  const positionedKeys: HexKey[] = [];

  for (const key of hexKeys) {
    const rcol = key.row;
    const rrow = cols - 1 - key.col;
    const stagger = (rrow % 2 === 1) ? sqrt3 / 2 * hexSize : 0;
    positionedKeys.push({
      ...key,
      isPressed: false,
      centerX: offsetX + rcol * sqrt3 * hexSize - stagger,
      centerY: offsetY + rrow * 1.5 * hexSize,
    });
  }

  return {
    activeKeys: positionedKeys,
    leftBoardKeyCount: 0,
    hexSize,
  };
}