/**
 * Shared constants used across the application.
 * Centralized here to avoid magic numbers scattered throughout the codebase.
 */

/** Audio */

/** Default velocity for note playback (0.0 - 1.0) */
export const DEFAULT_VELOCITY = 0.8;

/** Default note decay time in seconds */
export const DEFAULT_DECAY_SECONDS = 5.0;

/** Base gain level (minimum gain at velocity 0) */
export const GAIN_BASE = 0.3;

/** Velocity-to-gain multiplier (gain = GAIN_BASE + velocity * GAIN_VELOCITY_MULT) */
export const GAIN_VELOCITY_MULT = 0.7;

/** Minimum velocity clamp value to avoid silence */
export const MIN_VELOCITY = 0.01;

/** Maximum velocity clamp value */
export const MAX_VELOCITY = 1.0;

/** Maximum simultaneous voices before oldest are released */
export const MAX_VOICES = 8;

/** Release ramp time (seconds) when killing a voice to avoid clicks */
export const VOICE_RELEASE_SECONDS = 0.01;

/** Rendering */

/** Font size as a fraction of hex size */
export const FONT_SIZE_FACTOR = 0.5;

/** Minimum font size in pixels */
export const MIN_FONT_SIZE = 10;

/** Maximum font size in pixels */
export const MAX_FONT_SIZE = 20;

/** Dot size as a fraction of font size */
export const DOT_SIZE_FACTOR = 0.7;

/** Dot vertical offset from center as a fraction of font size */
export const DOT_OFFSET_FACTOR = 0.75;

/** Corner radius as a fraction of hex size */
export const CORNER_RADIUS_FACTOR = 0.3;

/** Settings button label font size range */
export const SETTINGS_BTN_MIN_FONT = 8;
export const SETTINGS_BTN_MAX_FONT = 16;
export const SETTINGS_BTN_FONT_FACTOR = 0.8;

/** Layout */

/** Resize debounce delay in milliseconds */
export const RESIZE_DEBOUNCE_MS = 150;

/** Epsilon for grouping keys into rows by Y coordinate */
export const ROW_Y_EPSILON = 1;