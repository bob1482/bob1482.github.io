const F_ROW_VARIANTS = [
  ["Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace","F7","F8","F9","F10","F11","F12"],
  ["F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","PrintScreen"], 
  ["","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"], 
  ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"] 
];
const F_KEY_LABELS = ["laptop","100r","100s","1-1"];

// --- DATA MAPS ---
let freqToKeyMap = {};

const KEY_MAPS = [
    [],
    ["KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight","F1","F2","F3","F4","F5","F6",],
    ["KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
    ["KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
    ["Digit2", "Digit3", "Digit4", "Digit5", "Digit6","Digit7","KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY",  "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6",],
    ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY",]
];
const COLOR_LEFT = '#00d2ff'; 
const COLOR_RIGHT = '#00d2ff';

"F7","F8","F9","F10","F11","F12","Numpad5","Numpad6","Numpad7","Numpad8","Numpad9","NumpadAdd"
"F1","F2","F3","F4","F5","F6","Numpad0","Numpad1","Numpad2","Numpad3","Numpad4","NumpadSubtract"
"Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace",  "F7","F8","F9","F10","F11","F12"
"KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight",  "F1","F2","F3","F4","F5","F6"


"Digit2", "Digit3", "Digit4", "Digit5", "Digit6","Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"
"KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY",  "KeyN", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"
"KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "Digit2","KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"
"ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyQ",  "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"