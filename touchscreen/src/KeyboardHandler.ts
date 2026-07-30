import * as PIXI from 'pixi.js';
import { HexKey } from './HexKey';
import { AudioEngine } from './AudioEngine';
import { drawRoundedHexagon } from './HexUtils';

/**
 * Maps keyboard events to Wicki-Heyden hex keys.
 * The layout is a string[][] where layout[row][col] is a keyboard event.code,
 * and the mapping is: gridCol = 7 - keyboardRow, gridRow = keyboardCol (transpose with reversal).
 */
export class KeyboardHandler {
  private engine: AudioEngine;
  private getActiveKeys: () => HexKey[];
  private hexGraphics: Map<string, PIXI.Graphics>;
  private labelTexts: Map<string, PIXI.Text>;
  private getHexSize: () => number;

  private keyMap: Map<string, { col: number; row: number }> = new Map();
  private pressedKeys: Set<string> = new Set();
  private keyToHexKey: Map<string, HexKey> = new Map();
  private eventListeners: { type: string; handler: EventListener }[] = [];
  private isSetup: boolean = false;

  constructor(
    engine: AudioEngine,
    getActiveKeys: () => HexKey[],
    hexGraphics: Map<string, PIXI.Graphics>,
    labelTexts: Map<string, PIXI.Text>,
    getHexSize: () => number,
  ) {
    this.engine = engine;
    this.getActiveKeys = getActiveKeys;
    this.hexGraphics = hexGraphics;
    this.labelTexts = labelTexts;
    this.getHexSize = getHexSize;
  }

  /**
   * Set the keyboard layout mapping.
   * @param layout 8×12 array of keyboard event.code values (empty strings for unused positions)
   */
  setLayout(layout: string[][]): void {
    // Release all currently pressed keys before rebuilding mapping
    for (const [, hexKey] of this.keyToHexKey) {
      hexKey.isPressed = false;
      this.updateKeyVisual(hexKey);
    }
    this.pressedKeys.clear();
    this.keyToHexKey.clear();
    this.keyMap.clear();

    for (let row = 0; row < layout.length; row++) {
      for (let col = 0; col < layout[row].length; col++) {
        const code = layout[row][col];
        if (code) {
          // Transpose with reversal: keyboard row 0 maps to top visual row (grid col layout.length - 1 - row)
          const gridCol = layout.length - 1 - row;
          const gridRow = col;
          this.keyMap.set(code, { col: gridCol, row: gridRow });
        }
      }
    }
  }

  /**
   * Attach keyboard event listeners. Only call this in landscape mode.
   */
  setup(): void {
    if (this.isSetup) return;
    this.isSetup = true;

    const keydownHandler = (e: Event) => {
      const event = e as KeyboardEvent;
      if (event.repeat) return;

      const mapping = this.keyMap.get(event.code);
      if (!mapping) return;

      event.preventDefault();

      // Don't retrigger if already pressed
      if (this.pressedKeys.has(event.code)) return;

      const hexKey = this.findHexKey(mapping.col, mapping.row);
      if (!hexKey) return;

      hexKey.isPressed = true;
      this.pressedKeys.add(event.code);
      this.keyToHexKey.set(event.code, hexKey);
      this.engine.playNoteWithFallback(hexKey.noteName, 0.8);
      this.updateKeyVisual(hexKey);
    };

    const keyupHandler = (e: Event) => {
      const event = e as KeyboardEvent;

      const mapping = this.keyMap.get(event.code);
      if (!mapping) return;

      event.preventDefault();

      const hexKey = this.keyToHexKey.get(event.code);
      if (hexKey) {
        hexKey.isPressed = false;
        this.pressedKeys.delete(event.code);
        this.keyToHexKey.delete(event.code);
        this.updateKeyVisual(hexKey);
      }
    };

    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyupHandler);

    this.eventListeners = [
      { type: 'keydown', handler: keydownHandler as EventListener },
      { type: 'keyup', handler: keyupHandler as EventListener },
    ];
  }

  /**
   * Remove keyboard event listeners and release all pressed keys.
   */
  destroy(): void {
    // Release all pressed keys
    for (const [, hexKey] of this.keyToHexKey) {
      hexKey.isPressed = false;
      this.updateKeyVisual(hexKey);
    }
    this.pressedKeys.clear();
    this.keyToHexKey.clear();

    // Remove event listeners
    for (const { type, handler } of this.eventListeners) {
      document.removeEventListener(type, handler);
    }
    this.eventListeners = [];
    this.isSetup = false;
  }

  private findHexKey(col: number, row: number): HexKey | null {
    const activeKeys = this.getActiveKeys();
    for (const key of activeKeys) {
      if (key.col === col && key.row === row) {
        return key;
      }
    }
    return null;
  }

  private updateKeyVisual(key: HexKey): void {
    if (!key) return;

    const activeKeys = this.getActiveKeys();

    // Find the graphics for this key by searching all entries
    let g: PIXI.Graphics | undefined;
    for (const [id, graphics] of this.hexGraphics) {
      const idx = parseInt(id.split('_')[1], 10);
      if (idx < activeKeys.length && activeKeys[idx] === key) {
        g = graphics;
        break;
      }
    }
    if (!g) return;

    g.clear();

    const cx = key.centerX;
    const cy = key.centerY;
    const hexSize = this.getHexSize();
    const s = hexSize;

    const isAccidental = key.noteName.includes('#');
    let fillColor: number;
    let borderColor: number;

    if (isAccidental) {
      if (key.isPressed) {
        fillColor = 0x555555;
        borderColor = 0x444444;
      } else {
        fillColor = 0x333333;
        borderColor = 0x444444;
      }
    } else {
      if (key.isPressed) {
        fillColor = 0xdddddd;
        borderColor = 0xbbbbbb;
      } else {
        fillColor = 0xf0f0f0;
        borderColor = 0xcccccc;
      }
    }

    g.beginFill(fillColor, 1.0);
    g.lineStyle(1, borderColor, 1.0);
    drawRoundedHexagon(g, cx, cy, s, s);
    g.endFill();
  }
}