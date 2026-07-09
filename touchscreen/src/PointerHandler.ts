import * as PIXI from 'pixi.js';
import { HexKey } from './HexKey';
import { AudioEngine } from './AudioEngine';
import { hitTestHexagon, keyId, drawRoundedHexagon } from './HexUtils';

const LONG_PRESS_MS = 500;

export class PointerHandler {
  private app: PIXI.Application;
  private engine: AudioEngine;
  private container: PIXI.Container;
  private hexGraphics: Map<string, PIXI.Graphics>;
  private labelTexts: Map<string, PIXI.Text>;

  private pointerToKeyMap: Map<number, HexKey> = new Map();
  private pressedKeys: Set<number> = new Set();

  private getActiveKeys: () => HexKey[];
  private getHexSize: () => number;
  private getSettingsUI: () => {
    isOpen: boolean;
    handlePointerDown: (x: number, y: number, pointerId: number) => boolean;
    handlePointerMove: (x: number, y: number, pointerId: number) => void;
    handlePointerUp: (x: number, y: number, pointerId: number) => boolean;
    handleOverlayPointerDown: (x: number, y: number) => void;
    cancelPress: () => void;
  };

  constructor(
    app: PIXI.Application,
    engine: AudioEngine,
    container: PIXI.Container,
    hexGraphics: Map<string, PIXI.Graphics>,
    labelTexts: Map<string, PIXI.Text>,
    getActiveKeys: () => HexKey[],
    getHexSize: () => number,
    getSettingsUI: () => {
      isOpen: boolean;
      handlePointerDown: (x: number, y: number, pointerId: number) => boolean;
      handlePointerMove: (x: number, y: number, pointerId: number) => void;
      handlePointerUp: (x: number, y: number, pointerId: number) => boolean;
      handleOverlayPointerDown: (x: number, y: number) => void;
      cancelPress: () => void;
    },
  ) {
    this.app = app;
    this.engine = engine;
    this.container = container;
    this.hexGraphics = hexGraphics;
    this.labelTexts = labelTexts;
    this.getActiveKeys = getActiveKeys;
    this.getHexSize = getHexSize;
    this.getSettingsUI = getSettingsUI;
  }

  setupInteraction(): void {
    const canvas = this.app.view as HTMLCanvasElement;

    // Pointer events for low-latency multi-touch
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.engine.resume();
      const pos = this.getLocalPosition(e);
      const settingsUI = this.getSettingsUI();

      // Check if settings window is open
      if (settingsUI.isOpen) {
        settingsUI.handleOverlayPointerDown(pos.x, pos.y);
        return;
      }

      // Check if pressing the settings button
      if (settingsUI.handlePointerDown(pos.x, pos.y, e.pointerId)) {
        return;
      }

      this.handlePointerDown(pos.x, pos.y, e.pointerId);
      canvas.setPointerCapture(e.pointerId);

      // Auto fullscreen on tap
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      e.preventDefault();
      const pos = this.getLocalPosition(e);
      const settingsUI = this.getSettingsUI();

      settingsUI.handlePointerMove(pos.x, pos.y, e.pointerId);

      this.handlePointerMove(pos.x, pos.y, e.pointerId);
    });

    canvas.addEventListener('pointerup', (e: PointerEvent) => {
      e.preventDefault();
      const pos = this.getLocalPosition(e);
      const settingsUI = this.getSettingsUI();

      if (settingsUI.handlePointerUp(pos.x, pos.y, e.pointerId)) {
        return;
      }

      this.handlePointerUp(pos.x, pos.y, e.pointerId);
      canvas.releasePointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointercancel', () => {
      this.handlePointerUp(0, 0, -1);
      this.getSettingsUI().cancelPress();
    });

    // Prevent default touch behavior
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
    }, { passive: false });
  }

  private getLocalPosition(e: PointerEvent): { x: number; y: number } {
    const canvas = this.app.view as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = this.app.screen.width / rect.width;
    const scaleY = this.app.screen.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private handlePointerDown(x: number, y: number, pointerId: number): void {
    const key = this.hitTest(x, y);
    if (key) {
      key.isPressed = true;
      this.pressedKeys.add(key.midi);
      this.pointerToKeyMap.set(pointerId, key);
      this.engine.playNoteWithFallback(key.noteName, 0.8);
      this.updateKeyVisual(key);
    }
  }

  private handlePointerMove(x: number, y: number, pointerId: number): void {
    const currentKey = this.pointerToKeyMap.get(pointerId);
    const key = this.hitTest(x, y);

    if (key && (!currentKey || key !== currentKey)) {
      // Release old key if different
      if (currentKey) {
        currentKey.isPressed = false;
        this.pressedKeys.delete(currentKey.midi);
        this.updateKeyVisual(currentKey);
      }
      // Press new key
      key.isPressed = true;
      this.pressedKeys.add(key.midi);
      this.pointerToKeyMap.set(pointerId, key);
      this.engine.playNoteWithFallback(key.noteName, 0.8);
      this.updateKeyVisual(key);
    } else if (!key && currentKey) {
      // Moved off grid - release
      currentKey.isPressed = false;
      this.pressedKeys.delete(currentKey.midi);
      this.updateKeyVisual(currentKey);
      this.pointerToKeyMap.delete(pointerId);
    }
  }

  private handlePointerUp(_x: number, _y: number, pointerId: number): void {
    const key = this.pointerToKeyMap.get(pointerId);
    if (key) {
      key.isPressed = false;
      this.pressedKeys.delete(key.midi);
      this.updateKeyVisual(key);
      this.pointerToKeyMap.delete(pointerId);
    }
  }

  private hitTest(x: number, y: number): HexKey | null {
    const hexSize = this.getHexSize();
    const activeKeys = this.getActiveKeys();

    // Iterate in reverse (top rows drawn last, so test them first for correctness)
    for (let i = activeKeys.length - 1; i >= 0; i--) {
      const key = activeKeys[i];
      if (hitTestHexagon(x, y, key.centerX, key.centerY, hexSize)) {
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
      // Extract the index from the keyId
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

    let fillColor: number;
    let borderColor: number;

    if (key.isPressed) {
      fillColor = 0xdddddd;
      borderColor = 0xbbbbbb;
    } else {
      fillColor = 0xf0f0f0;
      borderColor = 0xcccccc;
    }

    g.beginFill(fillColor, 1.0);
    g.lineStyle(1, borderColor, 1.0);
    drawRoundedHexagon(g, cx, cy, s, s);
    g.endFill();
  }

  /** Clean up any pressed keys */
  reset(): void {
    this.pointerToKeyMap.clear();
    this.pressedKeys.clear();
  }
}