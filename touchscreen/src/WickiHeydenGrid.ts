import * as PIXI from 'pixi.js';
import { AudioEngine } from './AudioEngine';
import { HexKey } from './HexKey';
import { toNumberedNotation } from './NoteUtils';
import { drawRoundedHexagon, keyId } from './HexUtils';
import { buildGrid, updateLayoutPortrait, updateLayoutLandscape, updateLayoutLandscapeSingle, LayoutResult } from './GridLayout';
import { SettingsUI } from './SettingsUI';
import { PointerHandler } from './PointerHandler';

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
  private readonly COLS_LANDSCAPE_SINGLE = 8;
  private readonly ROWS_LANDSCAPE_SINGLE = 12;
  private readonly COLS_PORTRAIT_WIDE = 12;
  private readonly ROWS_PORTRAIT_WIDE = 6;
  private readonly BASE_MIDI = 36; // C2

  // Landscape mode
  private isLandscape: boolean = false;
  private activeKeys: HexKey[] = [];
  private leftBoardKeyCount: number = 0;
  private hexSize: number = 30;

  // Single board mode
  private useSingleLandscapeBoard: boolean = false;

  // Wide portrait mode (12x6)
  private useWidePortrait: boolean = false;
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
    let setSingleBoardMode: (enabled: boolean) => void = () => {};
    let setWidePortrait: (enabled: boolean) => void = () => {};
    this.settingsUI = new SettingsUI(this.app.stage, (enabled: boolean) => {
      setGlidingEnabled(enabled);
    }, (enabled: boolean) => {
      setSingleBoardMode(enabled);
    }, (enabled: boolean) => {
      setWidePortrait(enabled);
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

    // Wire up the single-board mode toggle
    setSingleBoardMode = (enabled: boolean) => {
      this.useSingleLandscapeBoard = enabled;
      this.updateLayout();
    };

    // Wire up the wide portrait mode toggle
    setWidePortrait = (enabled: boolean) => {
      this.useWidePortrait = enabled;
      this.updateLayout();
    };

    this.updateLayout();
    this.pointerHandler.setupInteraction();

    // Handle resize
    window.addEventListener('resize', () => {
      this.app.resize();
      this.updateLayout();
    });
  }

  private updateLayout(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    this.isLandscape = width > height;

    let result: LayoutResult;
    if (!this.isLandscape && this.useWidePortrait) {
      // Wide portrait 12x6 grid
      const wideKeys = buildGrid(
        this.sampleNoteNames,
        this.COLS_PORTRAIT_WIDE,
        this.ROWS_PORTRAIT_WIDE,
        this.BASE_MIDI
      );
      result = updateLayoutPortrait(width, height, wideKeys, this.COLS_PORTRAIT_WIDE);
    } else if (this.isLandscape && this.useSingleLandscapeBoard) {
      // Single 12x8 board spanning full width in landscape
      const singleKeys = buildGrid(
        this.sampleNoteNames,
        this.COLS_LANDSCAPE_SINGLE,
        this.ROWS_LANDSCAPE_SINGLE,
        this.BASE_MIDI
      );
      result = updateLayoutLandscapeSingle(width, height, singleKeys, this.COLS_LANDSCAPE_SINGLE);
    } else if (this.isLandscape) {
      result = updateLayoutLandscape(width, height, this.hexKeys, this.COLS);
    } else {
      result = updateLayoutPortrait(width, height, this.hexKeys, this.COLS);
    }

    this.activeKeys = result.activeKeys;
    this.leftBoardKeyCount = result.leftBoardKeyCount;
    this.hexSize = result.hexSize;

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
    this.app.destroy(true, { children: true });
  }
}