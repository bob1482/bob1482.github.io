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
  baseMidi: number,
  skipFirstRow: boolean = true
): HexKey[] {
  const hexKeys: HexKey[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Skip the first key (row 0) on every odd column (1st, 3rd, 5th... i.e. col % 2 === 0)
      if (skipFirstRow && col % 2 === 0 && row === 0) continue;

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

/**
 * Layout for a single wide board in landscape mode.
 * Uses a 12×8 hex grid spanning the full width of the screen.
 */
export function updateLayoutLandscapeSingle(
  width: number,
  height: number,
  hexKeys: HexKey[],
  cols: number,
  shiftOddColumnsLeft: boolean = false,
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
  const offsetX = (width - gridW) / 2 + sqrt3 * hexSize;
  const offsetY = (height - gridH_) / 2 + hexSize;

  const adjustedOffsetX = shiftOddColumnsLeft ? offsetX - sqrt3 / 2 * hexSize : offsetX;

  const positionedKeys: HexKey[] = [];

  for (const key of hexKeys) {
    const rcol = key.row;
    const rrow = cols - 1 - key.col;
    const stagger = (rrow % 2 === 1) ? sqrt3 / 2 * hexSize : 0;
    const oddRowShift = (shiftOddColumnsLeft && rrow % 2 === 1) ? sqrt3 * hexSize : 0;
    positionedKeys.push({
      ...key,
      isPressed: false,
      centerX: adjustedOffsetX + rcol * sqrt3 * hexSize - stagger + oddRowShift,
      centerY: offsetY + rrow * 1.5 * hexSize,
    });
  }

  return {
    activeKeys: positionedKeys,
    leftBoardKeyCount: 0,
    hexSize,
  };
}

