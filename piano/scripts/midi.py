import sys
import glob
import signal
import atexit
import argparse
import selectors
from evdev import InputDevice, categorize, ecodes
import rtmidi

CANDIDATE_DEVICE_PATTERNS = [
    '/dev/input/by-id/usb-Compx_2.4G_Wireless_Receiver*event*'
]

KEY_MAP = {
    # Row 0 (Keyboard Matrix Row 0)
    'KEY_SHIFTRIGHT': 89,   # F6
    'KEY_RIGHTSHIFT': 89,
    'KEY_SLASH': 91,        # G6
    'KEY_PERIOD': 93,       # A6
    'KEY_DOT': 93,
    'KEY_COMMA': 95,        # B6
    'KEY_M': 97,            # C#7
    'KEY_N': 99,            # D#7
    'KEY_B': 101,           # F7
    'KEY_V': 103,           # G7
    'KEY_C': 105,           # A7
    'KEY_X': 107,           # B7
    'KEY_Z': 109,           # C#8
    'KEY_SHIFTLEFT': 111,   # D#8
    'KEY_LEFTSHIFT': 111,
    'KEY_SHIFT': 111,

    # Row 1 (Keyboard Matrix Row 1)
    'KEY_ENTER': 82,        # A#5
    'KEY_QUOTE': 84,        # C6
    'KEY_APOSTROPHE': 84,
    'KEY_SEMICOLON': 86,    # D6
    'KEY_L': 88,            # E6
    'KEY_K': 90,            # F#6
    'KEY_J': 92,            # G#6
    'KEY_H': 94,            # A#6
    'KEY_G': 96,            # C7
    'KEY_F': 98,            # D7
    'KEY_D': 100,           # E7
    'KEY_S': 102,           # F#7
    'KEY_A': 104,           # G#7

    # Row 2 (Keyboard Matrix Row 2)
    'KEY_BRACKETRIGHT': 77, # F5
    'KEY_RIGHTBRACE': 77,
    'KEY_CLOSEBRACE': 77,

    'KEY_BRACKETLEFT': 79,  # G5
    'KEY_LEFTBRACE': 79,
    'KEY_OPENBRACE': 79,
    'KEY_P': 81,            # A5
    'KEY_O': 83,            # B5
    'KEY_I': 85,            # C#6
    'KEY_U': 87,            # D#6
    'KEY_Y': 89,            # F6
    'KEY_T': 91,            # G6
    'KEY_R': 93,            # A6
    'KEY_E': 95,            # B6
    'KEY_W': 97,            # C#7
    'KEY_Q': 99,            # D#7

    # Row 3 (Keyboard Matrix Row 3)
    'KEY_BACKSPACE': 70,    # A#4
    'KEY_DELETE': 70,
    'KEY_EQUAL': 72,        # C5
    'KEY_MINUS': 74,        # D5
    'KEY_0': 76,            # E5
    'KEY_9': 78,            # F#5
    'KEY_8': 80,            # G#5
    'KEY_7': 82,            # A#5
    'KEY_6': 84,            # C6
    'KEY_5': 86,            # D6
    'KEY_4': 88,            # E6
    'KEY_3': 90,            # F#6
    'KEY_2': 92,            # G#6
}

# Right-hand board keys send on MIDI Channel 2 (0x91/0x81) for Magenta color
# Left-hand board keys send on MIDI Channel 1 (0x90/0x80) for Cyan color
RIGHT_BOARD_KEYS = {
    # Row 0 Right
    'KEY_SHIFTRIGHT', 'KEY_RIGHTSHIFT', 'KEY_SLASH', 'KEY_PERIOD', 'KEY_DOT', 'KEY_COMMA', 'KEY_M', 'KEY_N',
    # Row 1 Right
    'KEY_ENTER', 'KEY_QUOTE', 'KEY_APOSTROPHE', 'KEY_SEMICOLON', 'KEY_L', 'KEY_K', 'KEY_J',
    # Row 2 Right
    'KEY_BRACKETRIGHT', 'KEY_RIGHTBRACE', 'KEY_CLOSEBRACE', 'KEY_BRACKETLEFT', 'KEY_LEFTBRACE', 'KEY_OPENBRACE', 'KEY_P', 'KEY_O', 'KEY_I', 'KEY_U',
    # Row 3 Right
    'KEY_BACKSPACE', 'KEY_DELETE', 'KEY_EQUAL', 'KEY_MINUS', 'KEY_0', 'KEY_9', 'KEY_8',
}


def find_available_keyboards():
    """Find all event devices in /dev/input/by-id/"""
    found = []
    all_by_id = sorted(glob.glob('/dev/input/by-id/*event*'))
    for path in all_by_id:
        try:
            dev = InputDevice(path)
            name = dev.name
            dev.close()
            found.append((path, name))
        except Exception:
            found.append((path, "Unknown (Busy or Inaccessible)"))
    return found


def resolve_device_paths(requested_paths=None):
    """Auto-resolve all matching keyboard/NKRO event interfaces."""
    if requested_paths:
        return requested_paths

    # Match all event interfaces belonging to the target receiver (e.g., kbd + if01 NKRO)
    matched = []
    for pattern in CANDIDATE_DEVICE_PATTERNS:
        for path in sorted(glob.glob(pattern)):
            if path not in matched:
                matched.append(path)
    if matched:
        return matched

    # Fallback to any non-internal kbd devices in by-id
    all_kbds = sorted(glob.glob('/dev/input/by-id/*kbd*'))
    external_kbds = [p for p in all_kbds if 'AT_Translated' not in p]
    if external_kbds:
        return external_kbds

    return [all_kbds[0]] if all_kbds else []


def parse_args():
    parser = argparse.ArgumentParser(description="Keyboard to Virtual MIDI Device Converter")
    parser.add_argument(
        "-t", "--transpose",
        type=int,
        default=0,
        help="Transpose offset in semitones (e.g., -36, -24, -12, 12). Default is 0."
    )
    parser.add_argument(
        "-v", "--velocity",
        type=int,
        default=110,
        help="MIDI Note-On velocity / volume (1-127). Default is 110."
    )
    parser.add_argument(
        "--left-octave",
        type=int,
        default=12,
        help="Octave shift for left board in semitones (e.g. 0 or 12). Default is 12."
    )
    parser.add_argument(
        "-d", "--device",
        action="append",
        default=None,
        help="Path(s) to input device(s). Can be specified multiple times. Auto-detects all receiver interfaces if omitted."
    )
    parser.add_argument(
        "-l", "--list",
        action="store_true",
        help="List all detected input devices and exit."
    )
    return parser.parse_args()


def setup_midi_outputs():
    """Setup Virtual MIDI port and Midi Through connections for seamless browser Web MIDI integration."""
    outputs = []

    # 1. Open Dedicated Virtual Port
    try:
        virt_out = rtmidi.MidiOut()
        virt_out.open_virtual_port("Mechanical MIDI Keyboard")
        outputs.append((virt_out, "Virtual Port 'Mechanical MIDI Keyboard'"))
    except Exception as e:
        print(f"[Warning] Could not open virtual port: {e}")

    # 2. Also open Midi Through / WebMIDI ports so browser receives events immediately
    try:
        probe = rtmidi.MidiOut()
        available_ports = probe.get_ports()
        for idx, port_name in enumerate(available_ports):
            if "Midi Through" in port_name:
                out = rtmidi.MidiOut()
                out.open_port(idx)
                outputs.append((out, f"ALSA Port {idx} ({port_name})"))
        del probe
    except Exception as e:
        print(f"[Warning] Could not enumerate ALSA ports: {e}")

    return outputs


def main():
    args = parse_args()

    if args.list:
        print("Detected Input Devices:")
        for path, name in find_available_keyboards():
            print(f"  {path} -> {name}")
        return

    transpose = args.transpose
    velocity = max(1, min(127, args.velocity))
    left_octave_shift = args.left_octave
    device_paths = resolve_device_paths(args.device)

    if not device_paths:
        print("[Error] No suitable keyboard input device found in /dev/input/by-id/.")
        print("Use --list to see all available devices.")
        sys.exit(1)

    # Setup MIDI outputs
    midi_outputs = setup_midi_outputs()
    if not midi_outputs:
        print("[Error] Failed to initialize any MIDI output ports.")
        sys.exit(1)

    # Open and grab ALL matching input interfaces
    devices = []
    sel = selectors.DefaultSelector()

    for path in device_paths:
        try:
            dev = InputDevice(path)
            dev.grab()
            devices.append(dev)
            sel.register(dev, selectors.EVENT_READ)
            print(f"Grabbed: {path} ({dev.name})")
        except OSError as e:
            if e.errno == 16:  # Device or resource busy
                print(f"[Warning] Device {path} is BUSY [Errno 16] (already grabbed by another process).")
            else:
                print(f"[Warning] Failed to open device {path}: {e}")
        except Exception as e:
            print(f"[Warning] Failed to open device {path}: {e}")

    if not devices:
        print("\n[Error] Could not grab any input devices.")
        print("If another instance is running, stop it with: pkill -f a.py")
        sys.exit(1)

    def broadcast_midi(msg):
        for out, _ in midi_outputs:
            try:
                out.send_message(msg)
            except Exception:
                pass

    active_notes = {}
    cleaned_up = False

    def cleanup():
        nonlocal cleaned_up
        if cleaned_up:
            return
        cleaned_up = True

        # Flush any still-held notes so WebMIDI / DAW doesn't get stuck notes
        for prev_note, prev_off_cmd in active_notes.values():
            broadcast_midi([prev_off_cmd, prev_note, 0])
        active_notes.clear()

        sel.close()

        for out, _ in midi_outputs:
            try:
                out.close_port()
            except Exception:
                pass

        for dev in devices:
            try:
                dev.ungrab()
                dev.close()
            except Exception:
                pass

        if devices:
            print("\nKeyboard interfaces released.")

    atexit.register(cleanup)
    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))

    print("start")

    # Event Loop across all grabbed interfaces
    try:
        while True:
            for key, _ in sel.select():
                dev = key.fileobj
                try:
                    events = dev.read()
                except OSError:
                    continue

                for event in events:
                    if event.type == ecodes.EV_KEY:
                        key_event = categorize(event)
                        keycodes = (
                            key_event.keycode
                            if isinstance(key_event.keycode, list)
                            else [key_event.keycode]
                        )
                        matched_key = next((k for k in keycodes if k in KEY_MAP), None)

                        if matched_key:
                            is_right = matched_key in RIGHT_BOARD_KEYS
                            octave_offset = left_octave_shift if not is_right else 0

                            base_note = KEY_MAP[matched_key]
                            note = max(0, min(127, base_note + transpose + octave_offset))

                            # Left board  -> Channel 1 (0x90 / 0x80 -> Cyan)
                            # Right board -> Channel 2 (0x91 / 0x81 -> Magenta)
                            note_on_cmd = 0x91 if is_right else 0x90
                            note_off_cmd = 0x81 if is_right else 0x80

                            if key_event.keystate == key_event.key_down:
                                if matched_key in active_notes:
                                    prev_note, prev_off_cmd = active_notes.pop(matched_key)
                                    broadcast_midi([prev_off_cmd, prev_note, 0])

                                active_notes[matched_key] = (note, note_off_cmd)
                                broadcast_midi([note_on_cmd, note, velocity])

                            elif key_event.keystate == key_event.key_up:
                                if matched_key in active_notes:
                                    prev_note, prev_off_cmd = active_notes.pop(matched_key)
                                    broadcast_midi([prev_off_cmd, prev_note, 0])
                                else:
                                    broadcast_midi([note_off_cmd, note, 0])

    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == '__main__':
    main()