import * as PIXI from 'pixi.js';
import { AudioEngine } from './AudioEngine';
import { HexKey } from './HexKey';
import { toNumberedNotation } from './NoteUtils';
import { drawRoundedHexagon, keyId } from './HexUtils';
import { buildGrid, updateLayoutPortrait, updateLayoutLandscape, LayoutResult } from './GridLayout';
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
  private readonly BASE_MIDI = 36; // C2

  // Landscape mode
  private isLandscape: boolean = false;
  private activeKeys: HexKey[] = [];
  private leftBoardKeyCount: number = 0;
  private hexSize: number = 30;

  constructor(
    container: HTMLElement,
    engine: AudioEngine,
    sampleNoteNames: Set<string>
  ) {
    this.engine = engine;

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
    this.settingsUI = new SettingsUI(this.app.stage);

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
        handleOverlayPointerDown: (x, y) => this.settingsUI.handleOverlayPointerDown(x, y),
        cancelPress: () => this.settingsUI.cancelPress(),
      }),
    );

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
    if (this.isLandscape) {
      result = updateLayoutLandscape(width, height, this.hexKeys, this.COLS);
    } else {
      result = updateLayoutPortrait(width, height, this.hexKeys, this.COLS);
    }

    this.activeKeys = result.activeKeys;
    this.leftBoardKeyCount = result.leftBoardKeyCount;
    this.hexSize = result.hexSize;

    // Update settings UI position
    this.settingsUI.updateLayout(width, height, this.hexSize);

    this.render();
  }

  private render(): void {
    // Remove old hex graphics and labels
    for (const [, g] of this.hexGraphics) {
      this.container.removeChild(g);
    }
    for (const [, t] of this.labelTexts) {
      this.container.removeChild(t);
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

      // Determine colors - all keys use the same light color
      let fillColor: number;
      let borderColor: number;

      if (key.isPressed) {
        fillColor = 0xdddddd;
        borderColor = 0xbbbbbb;
      } else {
        fillColor = 0xf0f0f0;
        borderColor = 0xcccccc;
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
        fill: 0x666666,
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
          fill: 0x666666,
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
          fill: 0x666666,
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
    this.settingsUI.destroy();
    this.pointerHandler.reset();
    this.app.destroy(true, { children: true });
  }
}