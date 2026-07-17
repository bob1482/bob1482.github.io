import * as PIXI from 'pixi.js';
import { drawRoundedHexagon } from './HexUtils';

const LONG_PRESS_MS = 500;

/**
 * Settings UI with a PIXI-based button (hexagon matching grid theme)
 * and a pure DOM overlay panel (no PIXI objects, avoids GPU leaks).
 */
export class SettingsUI {
  private button: PIXI.Graphics;
  private buttonLabel: PIXI.Text;

  private buttonX: number = 0;
  private buttonY: number = 0;
  private buttonHalfSize: number = 0;

  private pressStartTime: number = 0;
  private pressPointerId: number = -1;
  private longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  private _windowOpen: boolean = false;
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  private glidingEnabled: boolean = true;
  private useSingleLandscapeBoard: boolean = false;
  private useWidePortrait: boolean = false;
  private onToggleGliding: (enabled: boolean) => void;
  private onToggleSingleBoard: (enabled: boolean) => void;
  private onToggleWidePortrait: (enabled: boolean) => void;

  // DOM elements for the settings overlay
  private overlayEl: HTMLElement;
  private backdropEl: HTMLElement;
  private panelEl: HTMLElement;
  private glideToggleEl: HTMLElement;
  private singleBoardToggleEl: HTMLElement;
  private widePortraitToggleEl: HTMLElement;

  constructor(
    stage: PIXI.Container,
    onToggleGliding: (enabled: boolean) => void,
    onToggleSingleBoard: (enabled: boolean) => void,
    onToggleWidePortrait: (enabled: boolean) => void,
  ) {
    this.onToggleGliding = onToggleGliding;
    this.onToggleSingleBoard = onToggleSingleBoard;
    this.onToggleWidePortrait = onToggleWidePortrait;

    // --- PIXI Settings Button (stays in PIXI for hexagon styling) ---
    this.button = new PIXI.Graphics();
    this.buttonLabel = new PIXI.Text('⚙', {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0x666666,
      align: 'center',
    });
    this.buttonLabel.anchor.set(0.5, 0.5);

    stage.addChild(this.button);
    stage.addChild(this.buttonLabel);

    // --- DOM Settings Overlay (created once, no PIXI objects) ---
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'settings-overlay';
    this.overlayEl.style.display = 'none';

    // Backdrop click closes settings
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'settings-backdrop';
    this.backdropEl.addEventListener('pointerdown', () => this.close());
    this.overlayEl.appendChild(this.backdropEl);

    // Panel
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'settings-panel';
    this.panelEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.overlayEl.appendChild(this.panelEl);

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'settings-title';
    titleEl.textContent = 'Settings';
    this.panelEl.appendChild(titleEl);

    // Close button
    const closeEl = document.createElement('span');
    closeEl.className = 'settings-close';
    closeEl.textContent = '✕';
    closeEl.addEventListener('click', () => this.close());
    this.panelEl.appendChild(closeEl);

    // --- Gliding Notes toggle ---
    const glideRow = document.createElement('div');
    glideRow.className = 'settings-toggle-row';

    const glideLabel = document.createElement('span');
    glideLabel.className = 'settings-toggle-label';
    glideLabel.textContent = 'Gliding Notes';

    this.glideToggleEl = document.createElement('button');
    this.glideToggleEl.className = 'settings-toggle-btn';
    this.glideToggleEl.addEventListener('click', () => {
      this.glidingEnabled = !this.glidingEnabled;
      this.onToggleGliding(this.glidingEnabled);
      this.updateToggleVisuals();
    });

    glideRow.appendChild(glideLabel);
    glideRow.appendChild(this.glideToggleEl);
    this.panelEl.appendChild(glideRow);

    // --- Single Board (Landscape) toggle ---
    const singleRow = document.createElement('div');
    singleRow.className = 'settings-toggle-row';

    const singleLabel = document.createElement('span');
    singleLabel.className = 'settings-toggle-label';
    singleLabel.textContent = 'Single Board (Landscape)';

    this.singleBoardToggleEl = document.createElement('button');
    this.singleBoardToggleEl.className = 'settings-toggle-btn';
    this.singleBoardToggleEl.addEventListener('click', () => {
      this.useSingleLandscapeBoard = !this.useSingleLandscapeBoard;
      this.onToggleSingleBoard(this.useSingleLandscapeBoard);
      this.updateToggleVisuals();
    });

    singleRow.appendChild(singleLabel);
    singleRow.appendChild(this.singleBoardToggleEl);
    this.panelEl.appendChild(singleRow);

    // --- Wide Portrait (12×6) toggle ---
    const wideRow = document.createElement('div');
    wideRow.className = 'settings-toggle-row';

    const wideLabel = document.createElement('span');
    wideLabel.className = 'settings-toggle-label';
    wideLabel.textContent = 'Wide Portrait (12×6)';

    this.widePortraitToggleEl = document.createElement('button');
    this.widePortraitToggleEl.className = 'settings-toggle-btn';
    this.widePortraitToggleEl.addEventListener('click', () => {
      this.useWidePortrait = !this.useWidePortrait;
      this.onToggleWidePortrait(this.useWidePortrait);
      this.updateToggleVisuals();
    });

    wideRow.appendChild(wideLabel);
    wideRow.appendChild(this.widePortraitToggleEl);
    this.panelEl.appendChild(wideRow);

    // Append overlay to the piano container
    const pianoContainer = document.getElementById('piano-container');
    if (pianoContainer) {
      pianoContainer.appendChild(this.overlayEl);
    } else {
      document.body.appendChild(this.overlayEl);
    }
  }

  /** Track pointer down for settings button long-press detection */
  handlePointerDown(x: number, y: number, pointerId: number): boolean {
    if (this.hitTest(x, y)) {
      this.pressStartTime = performance.now();
      this.pressPointerId = pointerId;
      this.longPressTimeout = setTimeout(() => {
        this.open();
      }, LONG_PRESS_MS);
      return true;
    }
    return false;
  }

  /** Track pointer move for settings button — cancel if dragged off */
  handlePointerMove(x: number, y: number, pointerId: number): void {
    if (this.pressPointerId === pointerId) {
      if (!this.hitTest(x, y)) {
        this.pressStartTime = 0;
        this.pressPointerId = -1;
        this.clearLongPressTimeout();
      }
    }
  }

  /** Handle pointer up — consume the event so it doesn't trigger a key press */
  handlePointerUp(x: number, y: number, pointerId: number): boolean {
    if (this.pressPointerId === pointerId) {
      this.clearLongPressTimeout();
      this.pressStartTime = 0;
      this.pressPointerId = -1;
      return true;
    }
    return false;
  }

  /** Cancel any active press on pointer cancel */
  cancelPress(): void {
    this.pressStartTime = 0;
    this.pressPointerId = -1;
    this.clearLongPressTimeout();
  }

  /** Check if the settings overlay is open */
  get isOpen(): boolean {
    return this._windowOpen;
  }

  /** Set the current gliding state so the toggle renders correctly */
  setGlidingEnabled(enabled: boolean): void {
    this.glidingEnabled = enabled;
    if (this._windowOpen) {
      this.updateToggleVisuals();
    }
  }

  /** Update layout (called by the grid on resize) */
  updateLayout(width: number, height: number, hexSize: number, buttonPosX?: number, buttonPosY?: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.buttonHalfSize = hexSize / 2;
    if (buttonPosX !== undefined && buttonPosY !== undefined) {
      this.buttonX = buttonPosX;
      this.buttonY = buttonPosY;
    } else {
      // Fallback: bottom-right corner
      this.buttonX = width - this.buttonHalfSize;
      this.buttonY = height - this.buttonHalfSize;
    }
    this.renderButton();

    // Update overlay z-index context if open
    if (this._windowOpen) {
      // no PIXI objects to update
    }
  }

  /** Open the settings window */
  open(): void {
    this._windowOpen = true;
    this.overlayEl.style.display = '';
    this.updateToggleVisuals();
  }

  /** Close the settings window */
  close(): void {
    this._windowOpen = false;
    this.overlayEl.style.display = 'none';
  }

  /** Update only the toggle button visuals (no object creation) */
  private updateToggleVisuals(): void {
    this.updateToggleBtnEl(this.glideToggleEl, this.glidingEnabled);
    this.updateToggleBtnEl(this.singleBoardToggleEl, this.useSingleLandscapeBoard);
    this.updateToggleBtnEl(this.widePortraitToggleEl, this.useWidePortrait);
  }

  private updateToggleBtnEl(el: HTMLElement, enabled: boolean): void {
    el.textContent = enabled ? 'ON' : 'OFF';
    el.className = 'settings-toggle-btn' + (enabled ? ' active' : '');
  }

  /** Render the settings button */
  private renderButton(): void {
    const g = this.button;
    g.clear();

    const cx = this.buttonX;
    const cy = this.buttonY;
    const s = this.buttonHalfSize;

    g.beginFill(0xf0f0f0, 1.0);
    g.lineStyle(1, 0xcccccc, 1.0);
    drawRoundedHexagon(g, cx, cy, s, s);
    g.endFill();

    this.buttonLabel.x = cx;
    this.buttonLabel.y = cy;
    const fontSize = Math.max(8, Math.min(16, s * 0.8));
    this.buttonLabel.style.fontSize = fontSize;
  }

  /** Check if a point hits the settings button */
  private hitTest(x: number, y: number): boolean {
    const cx = this.buttonX;
    const cy = this.buttonY;
    const s = this.buttonHalfSize;
    const sqrt3 = Math.sqrt(3);
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);

    // Quick bounding box check for pointy-top hexagon
    if (dx > s * sqrt3 / 2 || dy > s) return false;

    // Point-in-hexagon test for pointy-top hex
    return dy <= s - dx / sqrt3;
  }

  private clearLongPressTimeout(): void {
    if (this.longPressTimeout !== null) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
  }

  /** Clean up resources */
  destroy(): void {
    if (this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
  }
}