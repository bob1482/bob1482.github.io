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
  private _glideToggleLabel: PIXI.Text | null = null;
  private _glideToggleBtn: PIXI.Graphics | null = null;
  private _glideToggleBtnLabel: PIXI.Text | null = null;
  private _singleBoardToggleLabel: PIXI.Text | null = null;
  private _singleBoardToggleBtn: PIXI.Graphics | null = null;
  private _singleBoardToggleBtnLabel: PIXI.Text | null = null;
  private _widePortraitToggleLabel: PIXI.Text | null = null;
  private _widePortraitToggleBtn: PIXI.Graphics | null = null;
  private _widePortraitToggleBtnLabel: PIXI.Text | null = null;

  private pressStartTime: number = 0;
  private pressPointerId: number = -1;
  private longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  private windowOpen: boolean = false;
  private screenWidth: number = 0;
  private screenHeight: number = 0;

  private glidingEnabled: boolean = true;
  private useSingleLandscapeBoard: boolean = false;
  private useWidePortrait: boolean = false;
  private onToggleGliding: (enabled: boolean) => void;
  private onToggleSingleBoard: (enabled: boolean) => void;
  private onToggleWidePortrait: (enabled: boolean) => void;

  constructor(
    stage: PIXI.Container,
    onToggleGliding: (enabled: boolean) => void,
    onToggleSingleBoard: (enabled: boolean) => void,
    onToggleWidePortrait: (enabled: boolean) => void,
  ) {
    this.onToggleGliding = onToggleGliding;
    this.onToggleSingleBoard = onToggleSingleBoard;
    this.onToggleWidePortrait = onToggleWidePortrait;

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

  /** Set the current gliding state so the toggle renders correctly */
  setGlidingEnabled(enabled: boolean): void {
    this.glidingEnabled = enabled;
    if (this.windowOpen) {
      this.renderWindow(this.screenWidth, this.screenHeight);
    }
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

    // Remove old toggle elements if they exist
    if (this._glideToggleLabel) {
      this.content.removeChild(this._glideToggleLabel);
      this._glideToggleLabel = null;
    }
    if (this._glideToggleBtn) {
      this.content.removeChild(this._glideToggleBtn);
      this._glideToggleBtn = null;
    }
    if (this._glideToggleBtnLabel) {
      this.content.removeChild(this._glideToggleBtnLabel);
      this._glideToggleBtnLabel = null;
    }

    // --- Gliding Notes toggle ---
    const toggleY = panelY + 75;

    // Label
    const toggleLabel = new PIXI.Text('Gliding Notes', {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xcccccc,
      align: 'left',
    });
    toggleLabel.anchor.set(0, 0.5);
    toggleLabel.x = panelX + 25;
    toggleLabel.y = toggleY;
    this.content.addChild(toggleLabel);
    this._glideToggleLabel = toggleLabel;

    // Toggle button (rounded rect)
    const toggleBtnWidth = 60;
    const toggleBtnHeight = 30;
    const toggleBtnX = panelX + panelW - 25 - toggleBtnWidth;
    const toggleBtnY = toggleY - toggleBtnHeight / 2;

    const toggleBtn = new PIXI.Graphics();
    const toggleColor = this.glidingEnabled ? 0x4caf50 : 0x666666;
    toggleBtn.beginFill(toggleColor, 1.0);
    toggleBtn.lineStyle(1, 0x555555, 1.0);
    toggleBtn.drawRoundedRect(0, 0, toggleBtnWidth, toggleBtnHeight, 6);
    toggleBtn.endFill();
    toggleBtn.x = toggleBtnX;
    toggleBtn.y = toggleBtnY;
    toggleBtn.interactive = true;
    toggleBtn.cursor = 'pointer';
    toggleBtn.on('pointerdown', () => {
      this.glidingEnabled = !this.glidingEnabled;
      this.onToggleGliding(this.glidingEnabled);
      this.renderWindow(width, height); // Re-render to update toggle visual
    });
    this.content.addChild(toggleBtn);
    this._glideToggleBtn = toggleBtn;

    // Toggle label (ON / OFF)
    const toggleBtnLabel = new PIXI.Text(this.glidingEnabled ? 'ON' : 'OFF', {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0xffffff,
      align: 'center',
      fontWeight: 'bold',
    });
    toggleBtnLabel.anchor.set(0.5, 0.5);
    toggleBtnLabel.x = toggleBtnX + toggleBtnWidth / 2;
    toggleBtnLabel.y = toggleBtnY + toggleBtnHeight / 2;
    this.content.addChild(toggleBtnLabel);
    this._glideToggleBtnLabel = toggleBtnLabel;

    // Remove old single-board toggle elements if they exist
    if (this._singleBoardToggleLabel) {
      this.content.removeChild(this._singleBoardToggleLabel);
      this._singleBoardToggleLabel = null;
    }
    if (this._singleBoardToggleBtn) {
      this.content.removeChild(this._singleBoardToggleBtn);
      this._singleBoardToggleBtn = null;
    }
    if (this._singleBoardToggleBtnLabel) {
      this.content.removeChild(this._singleBoardToggleBtnLabel);
      this._singleBoardToggleBtnLabel = null;
    }

    // --- Single Board (Landscape) toggle ---
    const singleToggleY = panelY + 125;

    const singleToggleLabel = new PIXI.Text('Single Board (Landscape)', {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xcccccc,
      align: 'left',
    });
    singleToggleLabel.anchor.set(0, 0.5);
    singleToggleLabel.x = panelX + 25;
    singleToggleLabel.y = singleToggleY;
    this.content.addChild(singleToggleLabel);
    this._singleBoardToggleLabel = singleToggleLabel;

    const singleToggleBtnX = panelX + panelW - 25 - toggleBtnWidth;
    const singleToggleBtnY = singleToggleY - toggleBtnHeight / 2;

    const singleToggleBtn = new PIXI.Graphics();
    const singleToggleColor = this.useSingleLandscapeBoard ? 0x4caf50 : 0x666666;
    singleToggleBtn.beginFill(singleToggleColor, 1.0);
    singleToggleBtn.lineStyle(1, 0x555555, 1.0);
    singleToggleBtn.drawRoundedRect(0, 0, toggleBtnWidth, toggleBtnHeight, 6);
    singleToggleBtn.endFill();
    singleToggleBtn.x = singleToggleBtnX;
    singleToggleBtn.y = singleToggleBtnY;
    singleToggleBtn.interactive = true;
    singleToggleBtn.cursor = 'pointer';
    singleToggleBtn.on('pointerdown', () => {
      this.useSingleLandscapeBoard = !this.useSingleLandscapeBoard;
      this.onToggleSingleBoard(this.useSingleLandscapeBoard);
      this.renderWindow(width, height); // Re-render to update toggle visual
    });
    this.content.addChild(singleToggleBtn);
    this._singleBoardToggleBtn = singleToggleBtn;

    const singleToggleBtnLabel = new PIXI.Text(this.useSingleLandscapeBoard ? 'ON' : 'OFF', {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0xffffff,
      align: 'center',
      fontWeight: 'bold',
    });
    singleToggleBtnLabel.anchor.set(0.5, 0.5);
    singleToggleBtnLabel.x = singleToggleBtnX + toggleBtnWidth / 2;
    singleToggleBtnLabel.y = singleToggleBtnY + toggleBtnHeight / 2;
    this.content.addChild(singleToggleBtnLabel);
    this._singleBoardToggleBtnLabel = singleToggleBtnLabel;

    // Remove old wide portrait toggle elements if they exist
    if (this._widePortraitToggleLabel) {
      this.content.removeChild(this._widePortraitToggleLabel);
      this._widePortraitToggleLabel = null;
    }
    if (this._widePortraitToggleBtn) {
      this.content.removeChild(this._widePortraitToggleBtn);
      this._widePortraitToggleBtn = null;
    }
    if (this._widePortraitToggleBtnLabel) {
      this.content.removeChild(this._widePortraitToggleBtnLabel);
      this._widePortraitToggleBtnLabel = null;
    }

    // --- Wide Portrait (12x6) toggle ---
    const wideToggleY = panelY + 175;

    const wideToggleLabel = new PIXI.Text('Wide Portrait (12×6)', {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xcccccc,
      align: 'left',
    });
    wideToggleLabel.anchor.set(0, 0.5);
    wideToggleLabel.x = panelX + 25;
    wideToggleLabel.y = wideToggleY;
    this.content.addChild(wideToggleLabel);
    this._widePortraitToggleLabel = wideToggleLabel;

    const wideToggleBtnX = panelX + panelW - 25 - toggleBtnWidth;
    const wideToggleBtnY = wideToggleY - toggleBtnHeight / 2;

    const wideToggleBtn = new PIXI.Graphics();
    const wideToggleColor = this.useWidePortrait ? 0x4caf50 : 0x666666;
    wideToggleBtn.beginFill(wideToggleColor, 1.0);
    wideToggleBtn.lineStyle(1, 0x555555, 1.0);
    wideToggleBtn.drawRoundedRect(0, 0, toggleBtnWidth, toggleBtnHeight, 6);
    wideToggleBtn.endFill();
    wideToggleBtn.x = wideToggleBtnX;
    wideToggleBtn.y = wideToggleBtnY;
    wideToggleBtn.interactive = true;
    wideToggleBtn.cursor = 'pointer';
    wideToggleBtn.on('pointerdown', () => {
      this.useWidePortrait = !this.useWidePortrait;
      this.onToggleWidePortrait(this.useWidePortrait);
      this.renderWindow(width, height); // Re-render to update toggle visual
    });
    this.content.addChild(wideToggleBtn);
    this._widePortraitToggleBtn = wideToggleBtn;

    const wideToggleBtnLabel = new PIXI.Text(this.useWidePortrait ? 'ON' : 'OFF', {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0xffffff,
      align: 'center',
      fontWeight: 'bold',
    });
    wideToggleBtnLabel.anchor.set(0.5, 0.5);
    wideToggleBtnLabel.x = wideToggleBtnX + toggleBtnWidth / 2;
    wideToggleBtnLabel.y = wideToggleBtnY + toggleBtnHeight / 2;
    this.content.addChild(wideToggleBtnLabel);
    this._widePortraitToggleBtnLabel = wideToggleBtnLabel;
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