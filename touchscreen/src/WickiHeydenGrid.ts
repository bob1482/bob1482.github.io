import * as PIXI from 'pixi.js';
import { AudioEngine } from './AudioEngine';
import { HexKey } from './HexKey';
import { toNumberedNotation } from './NoteUtils';
import { drawRoundedHexagon, keyId } from './HexUtils';
import { buildGrid, updateLayoutPortrait, updateLayoutLandscapeSingle, LayoutResult } from './GridLayout';
import { SettingsUI } from './SettingsUI';
import { PointerHandler } from './PointerHandler';
import { KeyboardHandler } from './KeyboardHandler';

export class WickiHeydenGrid {
  private app: PIXI.Application;
  private engine: AudioEngine;
  private hexKeys: HexKey[] = [];
  private hexGraphics: Map<string, PIXI.Graphics> = new Map();
  private labelTexts: Map<string, PIXI.Text> = new Map();
  private container: PIXI.Container;

  private settingsUI: SettingsUI;
  private pointerHandler: PointerHandler;

  // Grid dimensions
  private readonly COLS = 10;
  private readonly ROWS = 4;
  private readonly COLS_LANDSCAPE_1 = 8;
  private readonly ROWS_LANDSCAPE_1 = 12;
  private readonly COLS_LANDSCAPE_2 = 5;
  private readonly ROWS_LANDSCAPE_2 = 10;
  private readonly BASE_MIDI = 36; // C2
  private readonly BASE_MIDI_LANDSCAPE_2 = 48; // C3 (one octave up for 5x10 layout)

  // Landscape mode
  private isLandscape: boolean = false;
  private activeKeys: HexKey[] = [];
  private hexSize: number = 30;
  private landscapeLayoutIndex: number = 0; // 0 = layout 1 (8x12), 1 = layout 2 (5x10)

  // Keyboard handler
  private keyboardHandler: KeyboardHandler;

  // Keyboard layout 1: 8 rows × 12 columns
  private static readonly KEYBOARD_LAYOUT_1: string[][] = [
    [],
    ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"],
    ["Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0","Minus","Equal","Backspace"],
    ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight"],
    ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote", "Enter"],
    ["ShiftLeft","KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash","ShiftRight"],
    [],
    [],
  ];

  // Keyboard layout 2: 5 rows × 12 columns
  private static readonly KEYBOARD_LAYOUT_2: string[][] = [
    ["F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"],
    ["Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0","Minus","Equal","Backspace"],
    ["KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight"],
    ["KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote", "Enter"],
    ["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash","ShiftRight"],
  ];

  private sampleNoteNames: Set<string>;

  constructor(
    container: HTMLElement,
    engine: AudioEngine,
    sampleNoteNames: Set<string>
  ) {
    this.engine = engine;
    this.sampleNoteNames = sampleNoteNames;

    // Create Pixi application
    this.app = new PIXI.Application({
      resizeTo: container,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    container.appendChild(this.app.view as HTMLCanvasElement);

    // Main container
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);

    // Settings UI (manages its own PIXI objects on the stage)
    // Forward reference: pointerHandler not yet created, so we store a callback
    let setGlidingEnabled: (enabled: boolean) => void = () => {};
    this.settingsUI = new SettingsUI(this.app.stage, (enabled: boolean) => {
      setGlidingEnabled(enabled);
    }, (index: number) => {
      this.setLandscapeLayout(index);
    });

    // Build the grid data
    this.hexKeys = buildGrid(sampleNoteNames, this.COLS, this.ROWS, this.BASE_MIDI);

    // Pointer handler
    this.pointerHandler = new PointerHandler(
      this.app,
      this.engine,
      this.container,
      this.hexGraphics,
      this.labelTexts,
      () => this.activeKeys,
      () => this.hexSize,
      () => ({
        isOpen: this.settingsUI.isOpen,
        handlePointerDown: (x, y, id) => this.settingsUI.handlePointerDown(x, y, id),
        handlePointerMove: (x, y, id) => this.settingsUI.handlePointerMove(x, y, id),
        handlePointerUp: (x, y, id) => this.settingsUI.handlePointerUp(x, y, id),
        cancelPress: () => this.settingsUI.cancelPress(),
      }),
    );

    // Wire up the gliding toggle now that pointerHandler exists
    setGlidingEnabled = (enabled: boolean) => {
      this.pointerHandler.setGlidingEnabled(enabled);
      this.settingsUI.setGlidingEnabled(enabled);
    };

    // Keyboard handler
    this.keyboardHandler = new KeyboardHandler(
      this.engine,
      () => this.activeKeys,
      this.hexGraphics,
      this.labelTexts,
      () => this.hexSize,
    );

    this.updateLayout();
    this.pointerHandler.setupInteraction();

    // Handle resize
    window.addEventListener('resize', () => {
      this.app.resize();
      this.updateLayout();
    });
  }

  private setLandscapeLayout(index: number): void {
    if (index === this.landscapeLayoutIndex) return;
    this.landscapeLayoutIndex = index;
    this.updateLayout();
  }

  private updateLayout(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.isLandscape = width > height;

    let result: LayoutResult;
    if (this.isLandscape) {
      const cols = this.landscapeLayoutIndex === 0 ? this.COLS_LANDSCAPE_1 : this.COLS_LANDSCAPE_2;
      const rows = this.landscapeLayoutIndex === 0 ? this.ROWS_LANDSCAPE_1 : this.ROWS_LANDSCAPE_2;
      const baseMidi = this.landscapeLayoutIndex === 1 ? this.BASE_MIDI_LANDSCAPE_2 : this.BASE_MIDI;
      const singleKeys = buildGrid(
        this.sampleNoteNames,
        cols,
        rows,
        baseMidi,
        false
      );
      const shift = this.landscapeLayoutIndex === 1; // only Layout 2 uses the odd-column shift
      result = updateLayoutLandscapeSingle(width, height, singleKeys, cols, shift);
    } else {
      result = updateLayoutPortrait(width, height, this.hexKeys, this.COLS);
    }

    this.activeKeys = result.activeKeys;
    this.hexSize = result.hexSize;

    // Manage keyboard handler based on orientation
    if (this.isLandscape) {
      const layout = this.landscapeLayoutIndex === 0 ? WickiHeydenGrid.KEYBOARD_LAYOUT_1 : WickiHeydenGrid.KEYBOARD_LAYOUT_2;
      this.keyboardHandler.setLayout(layout);
      this.keyboardHandler.setup();
    } else {
      this.keyboardHandler.destroy();
    }

    // Compute settings button position: place it as the next hex on the bottom visual row
    const sqrt3 = Math.sqrt(3);
    // Find the bottom row (highest centerY) among active keys
    // Use a small epsilon to group keys into rows
    let bottomY = 0;
    for (const key of this.activeKeys) {
      if (key.centerY > bottomY) bottomY = key.centerY;
    }
    // Among keys at the bottom row, find the rightmost one
    let rightmostX = 0;
    for (const key of this.activeKeys) {
      if (Math.abs(key.centerY - bottomY) < 1) {
        if (key.centerX > rightmostX) rightmostX = key.centerX;
      }
    }
    // Position the button at the next hex spot to the right of the rightmost bottom key
    const buttonPosX = rightmostX + (3 / 4) * sqrt3 * this.hexSize;
    const buttonPosY = bottomY - this.hexSize / 4;

    // Update settings UI position and landscape layout state
    this.settingsUI.updateLayout(width, height, this.hexSize, buttonPosX, buttonPosY);
    this.settingsUI.setLandscapeLayoutIndex(this.landscapeLayoutIndex);

    this.render();
  }

  private render(): void {
    // Remove old hex graphics and labels, destroying to free GPU memory
    for (const [, g] of this.hexGraphics) {
      this.container.removeChild(g);
      g.destroy();
    }
    for (const [, t] of this.labelTexts) {
      this.container.removeChild(t);
      t.destroy();
    }
    this.hexGraphics.clear();
    this.labelTexts.clear();

    // Re-add settings button and label to ensure proper z-order
    while (this.container.children.length > 0) {
      this.container.removeChildAt(0);
    }

    // Draw all active hexagons
    for (let i = 0; i < this.activeKeys.length; i++) {
      const key = this.activeKeys[i];
      const g = new PIXI.Graphics();
      const cx = key.centerX;
      const cy = key.centerY;
      const s = this.hexSize;

      // Determine colors - accidental keys are dark, natural keys are light
      const isAccidental = key.noteName.includes('#');
      let fillColor: number;
      let borderColor: number;
      let textColor: number;

      if (isAccidental) {
        if (key.isPressed) {
          fillColor = 0x555555;
          borderColor = 0x444444;
        } else {
          fillColor = 0x333333;
          borderColor = 0x444444;
        }
        textColor = 0xffffff;
      } else {
        if (key.isPressed) {
          fillColor = 0xdddddd;
          borderColor = 0xbbbbbb;
        } else {
          fillColor = 0xf0f0f0;
          borderColor = 0xcccccc;
        }
        textColor = 0x666666;
      }

      // Draw rounded pointy-top hexagon
      g.beginFill(fillColor, 1.0);
      g.lineStyle(1, borderColor, 1.0);
      drawRoundedHexagon(g, cx, cy, s, s);
      g.endFill();

      this.container.addChild(g);
      this.hexGraphics.set(keyId(key.midi, i), g);

      // Label for all keys (numbered musical notation)
      const fontSize = Math.max(10, Math.min(20, this.hexSize * 0.5));
      const info = toNumberedNotation(key.midi);

      // Base degree text
      const label = new PIXI.Text(info.degree, {
        fontFamily: 'Arial',
        fontSize: fontSize,
        fill: textColor,
        align: 'center',
      });
      label.anchor.set(0.5, 0.5);
      label.x = cx;
      label.y = cy;
      this.container.addChild(label);
      this.labelTexts.set(keyId(key.midi, i), label);

      // Dots above (rendered as separate text, positioned higher)
      if (info.dotsAbove > 0) {
        const dotChar = info.dotsAbove === 1 ? '\u2022' : '\u2022\u2022';
        const dotSize = fontSize * 0.7;
        const dotText = new PIXI.Text(dotChar, {
          fontFamily: 'Arial',
          fontSize: dotSize,
          fill: textColor,
          align: 'center',
        });
        dotText.anchor.set(0.5, 0.5);
        dotText.x = cx;
        dotText.y = cy - fontSize * 0.75;
        this.container.addChild(dotText);
      }

      // Dots below (rendered as separate text, positioned lower)
      if (info.dotsBelow > 0) {
        const dotChar = info.dotsBelow === 1 ? '\u2022' : '\u2022\u2022';
        const dotSize = fontSize * 0.7;
        const dotText = new PIXI.Text(dotChar, {
          fontFamily: 'Arial',
          fontSize: dotSize,
          fill: textColor,
          align: 'center',
        });
        dotText.anchor.set(0.5, 0.5);
        dotText.x = cx;
        dotText.y = cy + fontSize * 0.75;
        this.container.addChild(dotText);
      }
    }
  }

  /** Clean up resources */
  destroy(): void {
    // Destroy all hex graphics and labels to free GPU memory
    for (const [, g] of this.hexGraphics) {
      this.container.removeChild(g);
      g.destroy();
    }
    for (const [, t] of this.labelTexts) {
      this.container.removeChild(t);
      t.destroy();
    }
    this.hexGraphics.clear();
    this.labelTexts.clear();
    this.settingsUI.destroy();
    this.pointerHandler.reset();
    this.keyboardHandler.destroy();
    this.app.destroy(true, { children: true });
  }
}