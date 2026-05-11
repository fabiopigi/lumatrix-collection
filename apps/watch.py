from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens
from _fonts import FONT_3X5

NAME = "Watch"
NUM_LEDS = 64
IDLE_MS = 30_000

np = None
JOY_UP = None
JOY_DOWN = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_SLIDE = None

BRIGHTNESS = 0.25
FRAME_MS = 30
MS_PER_MINUTE = 60_000
REPEAT_DELAY_MS = 380
REPEAT_TICK_MS = 110

# Two palettes from the Pixel Designer reference. Slide switch picks one.
PALETTE_A = ("#ff4000", "#008040")  # orange hours, green minutes
PALETTE_B = ("#0040ff", "#ffff00")  # blue hours, yellow minutes

# Visual layout (y=0 top). Hours occupy rows 0..4, minutes rows 3..7,
# so digit columns overlap in two middle rows.
HOUR_LEFT_X  = 0
HOUR_RIGHT_X = 4
HOUR_Y       = 0
MIN_LEFT_X   = 1
MIN_RIGHT_X  = 5
MIN_Y        = 3


def hex_to_rgb(h, scale=BRIGHTNESS):
    h = h.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


def blend(a, b):
    # Saturating add — physically what overlapping LEDs do.
    r = a[0] + b[0]
    g = a[1] + b[1]
    bb = a[2] + b[2]
    return (r if r < 256 else 255,
            g if g < 256 else 255,
            bb if bb < 256 else 255)


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def _draw_digit(buf, ch, x_off, y_off, color):
    glyph = FONT_3X5.get(ch) or FONT_3X5.get(" ")
    if not glyph:
        return
    for gy in range(5):
        row = glyph[gy]
        for gx in range(3):
            if row[gx] == "X":
                vx = x_off + gx
                vy = y_off + gy
                if 0 <= vx <= 7 and 0 <= vy <= 7:
                    idx = (7 - vy) * 8 + vx
                    buf[idx] = blend(buf[idx], color)


def render(hour, minute, hour_color, min_color):
    buf = [(0, 0, 0)] * NUM_LEDS
    h_str = "{:02d}".format(hour)
    m_str = "{:02d}".format(minute)
    _draw_digit(buf, h_str[0], HOUR_LEFT_X,  HOUR_Y, hour_color)
    _draw_digit(buf, h_str[1], HOUR_RIGHT_X, HOUR_Y, hour_color)
    _draw_digit(buf, m_str[0], MIN_LEFT_X,   MIN_Y,  min_color)
    _draw_digit(buf, m_str[1], MIN_RIGHT_X,  MIN_Y,  min_color)
    for i in range(NUM_LEDS):
        np[i] = buf[i]
    np.write()


def _palette_colors():
    if JOY_SLIDE is not None and JOY_SLIDE.value() == 1:
        h_hex, m_hex = PALETTE_B
    else:
        h_hex, m_hex = PALETTE_A
    return hex_to_rgb(h_hex), hex_to_rgb(m_hex)


def _apply_step(direction, hour, minute):
    if direction == "right": return (hour + 1) % 24, minute
    if direction == "left":  return (hour - 1) % 24, minute
    if direction == "up":    return hour, (minute + 1) % 60
    if direction == "down":  return hour, (minute - 1) % 60
    return hour, minute


def _current_direction():
    if JOY_RIGHT.value() == 0: return "right"
    if JOY_LEFT.value()  == 0: return "left"
    if JOY_UP.value()    == 0: return "up"
    if JOY_DOWN.value()  == 0: return "down"
    return None


def show_watch():
    """Display the watch. Time advances naturally; joystick adjusts it.
    Returns 'exit' on hold-center, 'idle' after IDLE_MS without input."""
    hour = 12
    minute = 0

    now0 = ticks_ms()
    next_tick = now0 + MS_PER_MINUTE
    last_activity = now0
    held_dir = None
    next_repeat = 0

    hour_color, min_color = _palette_colors()
    render(hour, minute, hour_color, min_color)

    while True:
        if screens.check_exit():
            return "exit"

        now = ticks_ms()
        dirty = False

        # Re-read palette every frame so flicking the slide switch is live.
        new_hour_color, new_min_color = _palette_colors()
        if new_hour_color != hour_color or new_min_color != min_color:
            hour_color, min_color = new_hour_color, new_min_color
            dirty = True

        # Natural minute progression.
        if ticks_diff(now, next_tick) >= 0:
            minute = (minute + 1) % 60
            if minute == 0:
                hour = (hour + 1) % 24
            next_tick += MS_PER_MINUTE
            dirty = True

        # Joystick adjustment with hold-to-repeat.
        cur_dir = _current_direction()
        if cur_dir is not None:
            last_activity = now
            if cur_dir != held_dir:
                hour, minute = _apply_step(cur_dir, hour, minute)
                held_dir = cur_dir
                next_repeat = now + REPEAT_DELAY_MS
                dirty = True
            elif ticks_diff(now, next_repeat) >= 0:
                hour, minute = _apply_step(cur_dir, hour, minute)
                next_repeat = now + REPEAT_TICK_MS
                dirty = True
        else:
            held_dir = None
            if ticks_diff(now, last_activity) >= IDLE_MS:
                return "idle"

        if dirty:
            render(hour, minute, hour_color, min_color)

        sleep_ms(FRAME_MS)


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT, JOY_SLIDE
    np = neopixel
    JOY_UP    = joystick["up"]
    JOY_DOWN  = joystick["down"]
    JOY_LEFT  = joystick["left"]
    JOY_RIGHT = joystick["right"]
    JOY_SLIDE = joystick.get("slide")
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = show_watch()
        if outcome == "exit":
            return
        if screens.end_screen() == "exit":
            return


if __name__ == "__main__":
    _np = NeoPixel(Pin(19, Pin.OUT), NUM_LEDS)
    _joy = {
        "up":     Pin(3, Pin.IN),
        "down":   Pin(6, Pin.IN),
        "left":   Pin(7, Pin.IN),
        "right":  Pin(2, Pin.IN),
        "center": Pin(8, Pin.IN),
        "slide":  Pin(9, Pin.IN),
    }
    run(_np, _joy)
