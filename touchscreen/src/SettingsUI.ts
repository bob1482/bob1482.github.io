import * as PIXI from 'pixi.js';
import { drawRoundedHexagon } from './HexUtils';

const LONG_PRESS_MS = 500;

export class SettingsUI {
  private button: PIXI.Graphics;
  private buttonLabel: PIXI.Text;

  private buttonX: number = 0;
  private buttonY: number = 0;
  private buttonHalfSize: number = 0;

  private overlay: PIXI.Container;
  private content: PIXI.Graphics;

  private _settingsTitle: PIXI.Text | null = null;
  private _settingsCloseBtn: PIXI.Text | null = null;

  private pressStartTime: number = 0;
  private pressPointerId: number = -1;
  private longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  private windowOpen: boolean = false;
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  constructor(stage: PIXI.Container) {
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

    // Settings window overlay (initially hidden)
    this.overlay = new PIXI.Container();
    this.overlay.visible = false;
    this.content = new PIXI.Graphics();
    this.overlay.addChild(this.content);
    stage.addChild(this.overlay);
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
    return this.windowOpen;
  }

  /** Handle a general pointer down on the overlay (close if clicking outside panel) */
  handleOverlayPointerDown(x: number, y: number): void {
    if (!this.windowOpen) return;
    const width = this.screenWidth;
    const height = this.screenHeight;
    const panelW = Math.min(width * 0.7, 400);
    const panelH = Math.min(height * 0.5, 300);
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;
    if (x < panelX || x > panelX + panelW || y < panelY || y > panelY + panelH) {
      this.close();
    }
  }

  /** Update layout (called by the grid on resize) */
  updateLayout(width: number, height: number, hexSize: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.buttonHalfSize = hexSize / 2;
    this.buttonX = width - this.buttonHalfSize;
    this.buttonY = height - this.buttonHalfSize;
    this.renderButton();

    if (this.windowOpen) {
      this.renderWindow(width, height);
    }
  }

  /** Open the settings window */
  open(): void {
    this.windowOpen = true;
    this.overlay.visible = true;
    this.renderWindow(this.screenWidth, this.screenHeight);
  }

  /** Close the settings window */
  close(): void {
    this.windowOpen = false;
    this.overlay.visible = false;
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

  /** Render the settings window overlay */
  private renderWindow(width: number, height: number): void {
    this.content.clear();

    // Semi-transparent dark background covering full screen
    this.content.beginFill(0x000000, 0.5);
    this.content.drawRect(0, 0, width, height);
    this.content.endFill();

    // Centered panel
    const panelW = Math.min(width * 0.7, 400);
    const panelH = Math.min(height * 0.5, 300);
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    // Panel background
    this.content.beginFill(0x2a2a2a, 1.0);
    this.content.lineStyle(1, 0x444444, 1.0);
    this.content.drawRoundedRect(panelX, panelY, panelW, panelH, 12);
    this.content.endFill();

    // Title text
    const title = new PIXI.Text('Settings', {
      fontFamily: 'Arial',
      fontSize: 22,
      fill: 0xcccccc,
      align: 'center',
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0.5);
    title.x = width / 2;
    title.y = panelY + 30;
    if (this._settingsTitle) {
      this.content.removeChild(this._settingsTitle);
    }
    this.content.addChild(title);
    this._settingsTitle = title;

    // Close button (X)
    const closeBtn = new PIXI.Text('✕', {
      fontFamily: 'Arial',
      fontSize: 20,
      fill: 0x888888,
      align: 'center',
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.x = panelX + panelW - 20;
    closeBtn.y = panelY + 20;
    closeBtn.interactive = true;
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => {
      this.close();
    });
    if (this._settingsCloseBtn) {
      this.content.removeChild(this._settingsCloseBtn);
    }
    this.content.addChild(closeBtn);
    this._settingsCloseBtn = closeBtn;
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
    this.overlay.removeChildren();
  }
}