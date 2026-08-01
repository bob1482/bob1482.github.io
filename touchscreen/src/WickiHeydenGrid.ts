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

  // Keyboard handler
  private keyboardHandler: KeyboardHandler;

  // Resize debounce timer
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

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

    // Create Pixi application with autoStart: false to stop the 60fps idle loop
    this.app = new PIXI.Application({
      resizeTo: container,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false,
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

    // Keyboard handler with render callback
    this.keyboardHandler = new KeyboardHandler(
      this.engine,
      () => this.activeKeys,
      this.hexGraphics,
      this.labelTexts,
      () => this.hexSize,
      () => this.app.render(), // render callback for keyboard visual updates
    );

    this.updateLayout();
    this.pointerHandler.setupInteraction();

    // Handle resize with debounce
    window.addEventListener('resize', () => {
      if (this.resizeTimer !== null) {
        clearTimeout(this.resizeTimer);
      }
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null;
        this.app.resize();
        this.updateLayout();
      }, 150);
    });
  }

  private updateLayout(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.isLandscape = width > height;

    // Auto-select landscape layout based on aspect ratio:
    // If width is >= 2× height, use Layout 2 (5×10), otherwise use Layout 1 (8×12)
    const landscapeLayoutIndex = this.isLandscape ? (width >= 2 * height ? 1 : 0) : 0;

    let result: LayoutResult;
    if (this.isLandscape) {
      const cols = landscapeLayoutIndex === 0 ? this.COLS_LANDSCAPE_1 : this.COLS_LANDSCAPE_2;
      const rows = landscapeLayoutIndex === 0 ? this.ROWS_LANDSCAPE_1 : this.ROWS_LANDSCAPE_2;
      const baseMidi = landscapeLayoutIndex === 1 ? this.BASE_MIDI_LANDSCAPE_2 : this.BASE_MIDI;
      const singleKeys = buildGrid(
        this.sampleNoteNames,
        cols,
        rows,
        baseMidi,
        false
      );
      const shift = landscapeLayoutIndex === 1; // only Layout 2 uses the odd-column shift
      result = updateLayoutLandscapeSingle(width, height, singleKeys, cols, shift);
    } else {
      result = updateLayoutPortrait(width, height, this.hexKeys, this.COLS);
    }

    this.activeKeys = result.activeKeys;
    this.hexSize = result.hexSize;

    // Manage keyboard handler based on orientation
    if (this.isLandscape) {
      const layout = landscapeLayoutIndex === 0 ? WickiHeydenGrid.KEYBOARD_LAYOUT_1 : WickiHeydenGrid.KEYBOARD_LAYOUT_2;
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

    // Update settings UI position
    this.settingsUI.updateLayout(width, height, this.hexSize, buttonPosX, buttonPosY);

    this.render();
    this.app.render();
  }

  private render(): void {
    // Build set of current key IDs for quick lookup
    const currentKeyIds = new Set<string>();
    for (let i = 0; i < this.activeKeys.length; i++) {
      currentKeyIds.add(keyId(this.activeKeys[i].midi, i));
    }

    // Remove graphics for keys that no longer exist
    for (const [id, g] of this.hexGraphics) {
      if (!currentKeyIds.has(id)) {
        this.container.removeChild(g);
        g.destroy();
        this.hexGraphics.delete(id);
      }
    }
    // Remove labels for keys that no longer exist
    for (const [id, t] of this.labelTexts) {
      if (!currentKeyIds.has(id)) {
        this.container.removeChild(t);
        t.destroy();
        this.labelTexts.delete(id);
      }
    }

    // Remove all children from container so we can re-add in correct order
    while (this.container.children.length > 0) {
      this.container.removeChildAt(0);
    }

    // Draw all active hexagons, reusing or creating graphics/text objects
    for (let i = 0; i < this.activeKeys.length; i++) {
      const key = this.activeKeys[i];
      const id = keyId(key.midi, i);
      const cx = key.centerX;
      const cy = key.centerY;
      const s = this.hexSize;

      // Determine colors
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

      // Reuse or create Graphics object
      let g = this.hexGraphics.get(id);
      if (!g) {
        g = new PIXI.Graphics();
        this.hexGraphics.set(id, g);
      }
      g.clear();

      // Draw rounded pointy-top hexagon
      g.beginFill(fillColor, 1.0);
      g.lineStyle(1, borderColor, 1.0);
      drawRoundedHexagon(g, cx, cy, s, s);
      g.endFill();

      this.container.addChild(g);

      // Label for all keys (numbered musical notation)
      const fontSize = Math.max(10, Math.min(20, this.hexSize * 0.5));
      const info = toNumberedNotation(key.midi);

      // Reuse or create label text
      let label = this.labelTexts.get(id + '_label');
      if (!label) {
        label = new PIXI.Text(info.degree, {
          fontFamily: 'Arial',
          fontSize: fontSize,
          fill: textColor,
          align: 'center',
        });
        label.anchor.set(0.5, 0.5);
        this.labelTexts.set(id + '_label', label);
      }
      label.text = info.degree;
      label.style.fontSize = fontSize;
      label.style.fill = textColor;
      label.x = cx;
      label.y = cy;
      this.container.addChild(label);

      // Remove old dot texts if they exist (they'll be recreated if needed)
      // Dot text objects are handled separately below
      const dotAboveId = id + '_dot_above';
      const dotBelowId = id + '_dot_below';
      
      // Handle dots above
      if (info.dotsAbove > 0) {
        const dotChar = info.dotsAbove === 1 ? '\u2022' : '\u2022\u2022';
        const dotSize = fontSize * 0.7;
        let dotText = this.labelTexts.get(dotAboveId);
        if (!dotText) {
          dotText = new PIXI.Text(dotChar, {
            fontFamily: 'Arial',
            fontSize: dotSize,
            fill: textColor,
            align: 'center',
          });
          dotText.anchor.set(0.5, 0.5);
          this.labelTexts.set(dotAboveId, dotText);
        }
        dotText.text = dotChar;
        dotText.style.fontSize = dotSize;
        dotText.style.fill = textColor;
        dotText.x = cx;
        dotText.y = cy - fontSize * 0.75;
        this.container.addChild(dotText);
      } else {
        // Remove dot above if it exists
        const existing = this.labelTexts.get(dotAboveId);
        if (existing) {
          this.container.removeChild(existing);
          existing.destroy();
          this.labelTexts.delete(dotAboveId);
        }
      }

      // Handle dots below
      if (info.dotsBelow > 0) {
        const dotChar = info.dotsBelow === 1 ? '\u2022' : '\u2022\u2022';
        const dotSize = fontSize * 0.7;
        let dotText = this.labelTexts.get(dotBelowId);
        if (!dotText) {
          dotText = new PIXI.Text(dotChar, {
            fontFamily: 'Arial',
            fontSize: dotSize,
            fill: textColor,
            align: 'center',
          });
          dotText.anchor.set(0.5, 0.5);
          this.labelTexts.set(dotBelowId, dotText);
        }
        dotText.text = dotChar;
        dotText.style.fontSize = dotSize;
        dotText.style.fill = textColor;
        dotText.x = cx;
        dotText.y = cy + fontSize * 0.75;
        this.container.addChild(dotText);
      } else {
        // Remove dot below if it exists
        const existing = this.labelTexts.get(dotBelowId);
        if (existing) {
          this.container.removeChild(existing);
          existing.destroy();
          this.labelTexts.delete(dotBelowId);
        }
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

    // Clean up resize timer
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }

    this.app.destroy(true, { children: true });
  }
}