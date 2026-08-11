/**
 * Shared type definitions used across multiple modules.
 */

/**
 * Interface for interacting with the settings UI from pointer/keyboard handlers.
 * This avoids duplicating the inline type in multiple places.
 */
export interface SettingsUIHandle {
  isOpen: boolean;
  handlePointerDown: (x: number, y: number, pointerId: number) => boolean;
  handlePointerMove: (x: number, y: number, pointerId: number) => void;
  handlePointerUp: (x: number, y: number, pointerId: number) => boolean;
  cancelPress: () => void;
}