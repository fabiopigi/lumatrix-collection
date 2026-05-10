from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff

NAME = "pixelDesignerTest"
NUM_LEDS = 64

np = None
JOY_CENTER = None

BRIGHTNESS = 0.25
HOLD_MS = 3000
FADE_MS = 1000
FRAME_MS = 33

_exit_press_start = None


def check_exit():
    global _exit_press_start
    if JOY_CENTER is None:
        return False
    if JOY_CENTER.value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
        elif ticks_diff(now, _exit_press_start) >= 1500:
            while JOY_CENTER.value() == 0:
                sleep_ms(20)
            _exit_press_start = None
            return True
    else:
        _exit_press_start = None
    return False


PAGES_HEX = (
    {
        58: "#ffa040", 59: "#ffa040", 60: "#ffa040", 61: "#ffa040", 62: "#ffa040",
        49: "#ffa040", 51: "#ffa040", 53: "#ffa040", 55: "#ffa040",
        41: "#ffa040", 47: "#ffa040",
        33: "#ffa040", 35: "#ffa040", 37: "#ffa040", 39: "#ffa040",
        25: "#ffa040", 27: "#ffa040", 28: "#ffa040", 29: "#ffa040", 31: "#ffa040",
        17: "#ffa040", 23: "#ffa040",
        10: "#ffa040", 11: "#ffa040", 12: "#ffa040", 13: "#ffa040", 14: "#ffa040",
    },
    {
        58: "#00ff00",
        50: "#00ff00",
        40: "#00ff00", 42: "#00ff00", 44: "#00ff00",
        33: "#00ff00", 34: "#00ff00", 35: "#00ff00",
        37: "#8000ff",
        26: "#00ff00",
        28: "#8000ff", 29: "#8000ff", 30: "#8000ff",
        19: "#8000ff", 21: "#8000ff", 23: "#8000ff",
        13: "#8000ff",
        5:  "#8000ff",
    },
    {
        59: "#ff0000", 63: "#ff0000",
        52: "#ff0000", 54: "#ff0000",
        45: "#ff0000",
        32: "#800000",
        36: "#ff0000", 38: "#ff0000",
        24: "#800000", 25: "#800000", 26: "#800000",
        27: "#ff0000",
        31: "#ff0000",
        18: "#800000",
        10: "#800000", 11: "#800000", 12: "#800000",
        4:  "#800000",
        5:  "#800000",
    },
)


def hex_to_rgb(h):
    h = h.lstrip("#")
    r = int(int(h[0:2], 16) * BRIGHTNESS)
    g = int(int(h[2:4], 16) * BRIGHTNESS)
    b = int(int(h[4:6], 16) * BRIGHTNESS)
    return (r, g, b)


def build_pages():
    pages = []
    for page_hex in PAGES_HEX:
        d = {}
        for idx, hx in page_hex.items():
            d[idx] = hex_to_rgb(hx)
        pages.append(d)
    return pages


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def render_page(page):
    clear()
    for idx, color in page.items():
        np[idx] = color
    np.write()


def render_fade(page_a, page_b, t):
    indices = set()
    indices.update(page_a.keys())
    indices.update(page_b.keys())
    clear()
    for idx in indices:
        a = page_a.get(idx, (0, 0, 0))
        b = page_b.get(idx, (0, 0, 0))
        r = int(a[0] + (b[0] - a[0]) * t)
        g = int(a[1] + (b[1] - a[1]) * t)
        bb = int(a[2] + (b[2] - a[2]) * t)
        np[idx] = (r, g, bb)
    np.write()


def hold(ms):
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < ms:
        if check_exit():
            return True
        sleep_ms(20)
    return False


def fade(page_a, page_b, duration_ms):
    t_start = ticks_ms()
    while True:
        if check_exit():
            return True
        elapsed = ticks_diff(ticks_ms(), t_start)
        if elapsed >= duration_ms:
            render_page(page_b)
            return False
        t = elapsed / duration_ms
        render_fade(page_a, page_b, t)
        sleep_ms(FRAME_MS)


def play():
    pages = build_pages()
    if not pages:
        return
    idx = 0
    while True:
        cur = pages[idx]
        nxt = pages[(idx + 1) % len(pages)]
        render_page(cur)
        if hold(HOLD_MS):
            return
        if fade(cur, nxt, FADE_MS):
            return
        idx = (idx + 1) % len(pages)


def run(neopixel, joystick):
    global np, JOY_CENTER, _exit_press_start
    np = neopixel
    JOY_CENTER = joystick["center"]
    _exit_press_start = None
    play()


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
