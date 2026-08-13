import sys
import argparse
from evdev import InputDevice, categorize, ecodes
import rtmidi

DEFAULT_DEVICE_PATH = '/dev/input/by-id/usb-YJX_CHIP_WirelessDevice-event-kbd'

KEY_MAP = {
    # Row 0 (Keyboard Matrix Row 0)
    'KEY_SHIFTRIGHT': 91,   # G6
    'KEY_RIGHTSHIFT': 91,
    'KEY_SLASH': 93,        # A6
    'KEY_PERIOD': 95,       # B6
    'KEY_DOT': 95,
    'KEY_COMMA': 97,        # C#7
    'KEY_M': 99,            # D#7
    'KEY_N': 101,           # F7
    'KEY_B': 103,           # G7
    'KEY_V': 105,           # A7
    'KEY_C': 107,           # B7
    'KEY_X': 109,           # C#8
    'KEY_Z': 111,           # D#8
    'KEY_SHIFTLEFT': 113,   # F8
    'KEY_LEFTSHIFT': 113,
    'KEY_SHIFT': 113,

    # Row 1 (Keyboard Matrix Row 1)
    'KEY_ENTER': 84,        # C6
    'KEY_QUOTE': 86,        # D6
    'KEY_APOSTROPHE': 86,
    'KEY_SEMICOLON': 88,    # E6
    'KEY_L': 90,            # F#6
    'KEY_K': 92,            # G#6
    'KEY_J': 94,            # A#6
    'KEY_H': 96,            # C7
    'KEY_G': 98,            # D7
    'KEY_F': 100,           # E7
    'KEY_D': 102,           # F#7
    'KEY_S': 104,           # G#7
    'KEY_A': 106,           # A#7

    # Row 2 (Keyboard Matrix Row 2)
    'KEY_BRACKETRIGHT': 79, # G5
    'KEY_RIGHTBRACE': 79,
    'KEY_CLOSEBRACE': 79,

    'KEY_BRACKETLEFT': 81,  # A5
    'KEY_LEFTBRACE': 81,
    'KEY_OPENBRACE': 81,
    'KEY_P': 83,            # B5
    'KEY_O': 85,            # C#6
    'KEY_I': 87,            # D#6
    'KEY_U': 89,            # F6
    'KEY_Y': 91,            # G6
    'KEY_T': 93,            # A6
    'KEY_R': 95,            # B6
    'KEY_E': 97,            # C#7
    'KEY_W': 99,            # D#7
    'KEY_Q': 101,           # F7

    # Row 3 (Keyboard Matrix Row 3)
    'KEY_BACKSPACE': 72,    # C5
    'KEY_DELETE': 72,
    'KEY_EQUAL': 74,        # D5
    'KEY_MINUS': 76,        # E5
    'KEY_0': 78,            # F#5
    'KEY_9': 80,            # G#5
    'KEY_8': 82,            # A#5
    'KEY_7': 84,            # C6
    'KEY_6': 86,            # D6
    'KEY_5': 88,            # E6
    'KEY_4': 90,            # F#6
    'KEY_3': 92,            # G#6
    'KEY_2': 94,            # A#6
}

# Right-hand board keys send on MIDI Channel 2 (0x91/0x81) for distinct color visualizer support
RIGHT_BOARD_KEYS = {
    # Row 0 Right
    'KEY_SHIFTRIGHT', 'KEY_RIGHTSHIFT', 'KEY_SLASH', 'KEY_PERIOD', 'KEY_DOT', 'KEY_COMMA', 'KEY_M', 'KEY_N',
    # Row 1 Right
    'KEY_ENTER', 'KEY_QUOTE', 'KEY_APOSTROPHE', 'KEY_SEMICOLON', 'KEY_L', 'KEY_K', 'KEY_J', 'KEY_H',
    # Row 2 Right
    'KEY_BRACKETRIGHT', 'KEY_RIGHTBRACE', 'KEY_CLOSEBRACE', 'KEY_BRACKETLEFT', 'KEY_LEFTBRACE', 'KEY_OPENBRACE', 'KEY_P', 'KEY_O', 'KEY_I', 'KEY_U',
    # Row 3 Right
    'KEY_BACKSPACE', 'KEY_DELETE', 'KEY_EQUAL', 'KEY_MINUS', 'KEY_0', 'KEY_9', 'KEY_8', 'KEY_7'
}

def parse_args():
    parser = argparse.ArgumentParser(description="Keyboard to Virtual MIDI Device Converter")
    parser.add_argument(
        "-t", "--transpose",
        type=int,
        default=0,
        help="Transpose offset in semitones (e.g., -12, -2, 12). Default is 0."
    )
    parser.add_argument(
        "-d", "--device",
        type=str,
        default=DEFAULT_DEVICE_PATH,
        help=f"Path to input device (default: {DEFAULT_DEVICE_PATH})"
    )
    return parser.parse_args()

def main():
    args = parse_args()
    transpose = args.transpose
    device_path = args.device

    # Setup Virtual MIDI Port
    midi_out = rtmidi.MidiOut()
    midi_out.open_virtual_port("Mechanical MIDI Keyboard")

    try:
        dev = InputDevice(device_path)
        # Grab the keyboard exclusively so Linux does NOT receive normal typing inputs from it
        dev.grab()
        print(f"Successfully grabbed {dev.name}.")
        print(f"Emulating Virtual MIDI device 'Mechanical MIDI Keyboard'...")
        print(f"Transpose setting: {transpose:+d} semitones.")
        print(f"Left Board keys -> MIDI Channel 2 (Magenta visual notes)")
        print(f"Right Board keys -> MIDI Channel 1 (Cyan visual notes)")
        print("Press Ctrl+C to stop.\n")
    except Exception as e:
        print(f"Failed to open device {device_path}: {e}")
        sys.exit(1)

    # Listen for Key Events
    try:
        for event in dev.read_loop():
            if event.type == ecodes.EV_KEY:
                key_event = categorize(event)
                
                # Normalize keycodes into a list to check for any matching aliases
                keycodes = key_event.keycode if isinstance(key_event.keycode, list) else [key_event.keycode]
                
                # Find the first matching keycode alias in KEY_MAP
                matched_key = next((k for k in keycodes if k in KEY_MAP), None)

                if matched_key:
                    # Apply transposition and clamp to valid MIDI note range (0..127)
                    base_note = KEY_MAP[matched_key]
                    note = max(0, min(127, base_note + transpose))

                    # Determine channel (reversed): Right board -> Channel 1 (0x90/0x80), Left board -> Channel 2 (0x91/0x81)
                    is_right = matched_key in RIGHT_BOARD_KEYS
                    note_on_cmd = 0x90 if is_right else 0x91
                    note_off_cmd = 0x80 if is_right else 0x81

                    # Key Press (Down)
                    if key_event.keystate == key_event.key_down:
                        midi_out.send_message([note_on_cmd, note, 110])  # Note On (Velocity 60)
                    
                    # Key Release (Up)
                    elif key_event.keystate == key_event.key_up:
                        midi_out.send_message([note_off_cmd, note, 0])   # Note Off

    except KeyboardInterrupt:
        pass
    finally:
        # Release the keyboard back to normal when script exits
        dev.ungrab()
        print("\nKeyboard released.")

if __name__ == '__main__':
    main()
