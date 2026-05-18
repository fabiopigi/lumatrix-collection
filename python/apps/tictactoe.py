from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens

NAME = "TicTacToe"

FRAME_MS = 35
WIN_FLASH_MS = 2200

np = None
W = 8
H = 8
NUM_LEDS = 64
JOY_UP = None
JOY_DOWN = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_CENTER = None

RED = (64, 0, 0)
RED_DARK = (24, 0, 0)
ORANGE = (64, 28, 0)
GREEN = (32, 64, 0)
GREEN_DARK = (12, 24, 0)
CYAN = (0, 48, 64)
GRID = (16, 16, 18)

GREEN_32 = ('...####...', '..######..', '.########.', '####..####', '###....###', '###....###', '####..####', '.########.', '..######..', '...####...')
RED_32 = ('.#......#.', '###....###', '.###..###.', '..######..', '...####...', '...####...', '..######..', '.###..###.', '###....###', '.#......#.')
GREEN_16 = ('.##.', '####', '####', '.##.')
RED_16 = ('####', '#..#', '#..#', '####')
GREEN_8 = ('##', '##')
RED_8 = ('##', '##')


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def index_xy(x, y):
    # x/y are visual coordinates, with y=0 at the top.
    return (H - 1 - y) * W + x


def px(x, y, color):
    if 0 <= x < W and 0 <= y < H:
        np[index_xy(x, y)] = color


def scale_color(color, t):
    return (int(color[0] * t), int(color[1] * t), int(color[2] * t))


def pulse_factor():
    # 1s cycle: 500ms fade out, 500ms fade in. Range stays visible, never flashes off.
    p = ticks_ms() % 1000
    if p < 500:
        t = 1.0 - (p / 500.0)
    else:
        t = (p - 500) / 500.0
    return 0.35 + (0.65 * t)


def small_cell_pixels(cell_x, cell_y):
    # Exact 8x8 Pixel Designer geometry: grid lines are x=2,5 and y=2,5.
    xs = ((0, 1), (3, 4), (6, 7))[cell_x]
    ys = ((0, 1), (3, 4), (6, 7))[cell_y]
    return xs, ys


def draw_small_scaled_pixel(vx, vy, color, scale):
    x0 = vx * scale
    y0 = vy * scale
    for y in range(y0, y0 + scale):
        for x in range(x0, x0 + scale):
            px(x, y, color)


def draw_small_scaled_grid(scale):
    # Direct pixel-scale of the 8x8 board design.
    for v in (2, 5):
        for y in range(8):
            draw_small_scaled_pixel(v, y, GRID, scale)
        for x in range(8):
            draw_small_scaled_pixel(x, v, GRID, scale)


def cell_bounds_32(cell_x, cell_y):
    # 32x32 board has 10px cells separated by 1px grid lines at x/y 10 and 21.
    xs = ((0, 9), (11, 20), (22, 31))[cell_x]
    ys = ((0, 9), (11, 20), (22, 31))[cell_y]
    return xs[0], ys[0], xs[1], ys[1]


def draw_grid_32():
    for x in (10, 21):
        for y in range(32):
            px(x, y, GRID)
    for y in (10, 21):
        for x in range(32):
            px(x, y, GRID)


def pattern_for_size(player):
    if W >= 32 and H >= 32:
        return RED_32 if player == 1 else GREEN_32
    if W >= 16 and H >= 16:
        return RED_16 if player == 1 else GREEN_16
    return RED_8 if player == 1 else GREEN_8


def draw_pattern_at(x0, y0, pattern, color):
    for y, row in enumerate(pattern):
        for x, ch in enumerate(row):
            if ch == "#":
                px(x0 + x, y0 + y, color)


def draw_selection(cell_x, cell_y, player):
    color = scale_color(RED_DARK if player == 1 else GREEN_DARK, pulse_factor())

    if W >= 32 and H >= 32:
        x0, y0, x1, y1 = cell_bounds_32(cell_x, cell_y)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                px(x, y, color)
        return

    scale = max(1, W // 8)
    xs, ys = small_cell_pixels(cell_x, cell_y)
    for vy in ys:
        for vx in xs:
            draw_small_scaled_pixel(vx, vy, color, scale)


def draw_mark(cell_x, cell_y, player, override_color=None):
    color = override_color if override_color is not None else (RED if player == 1 else GREEN)
    pattern = pattern_for_size(player)

    if W >= 32 and H >= 32:
        x0, y0, _, _ = cell_bounds_32(cell_x, cell_y)
        draw_pattern_at(x0, y0, pattern, color)
        return

    scale = max(1, W // 8)
    xs, ys = small_cell_pixels(cell_x, cell_y)
    x0 = xs[0] * scale
    y0 = ys[0] * scale
    draw_pattern_at(x0, y0, pattern, color)


def winner(board):
    lines = (
        (0, 1, 2), (3, 4, 5), (6, 7, 8),
        (0, 3, 6), (1, 4, 7), (2, 5, 8),
        (0, 4, 8), (2, 4, 6),
    )
    for a, b, c in lines:
        if board[a] and board[a] == board[b] and board[a] == board[c]:
            return board[a], (a, b, c)
    if all(board):
        return 3, ()
    return 0, ()


def render(board, cursor_x, cursor_y, player, win_line=(), win_flash=False):
    clear()

    if W >= 32 and H >= 32:
        draw_grid_32()
    else:
        draw_small_scaled_grid(max(1, W // 8))

    selected_idx = cursor_y * 3 + cursor_x
    if not win_flash and board[selected_idx] == 0:
        draw_selection(cursor_x, cursor_y, player)

    flash_alt = (ticks_ms() // 180) % 2 == 1

    for i, mark in enumerate(board):
        if not mark:
            continue
        color = None
        if win_flash and i in win_line:
            if mark == 1:
                color = ORANGE if flash_alt else RED
            else:
                color = CYAN if flash_alt else GREEN
        draw_mark(i % 3, i // 3, mark, color)

    np.write()


def show_win_flash(board, cursor_x, cursor_y, player, line):
    start = ticks_ms()
    while ticks_diff(ticks_ms(), start) < WIN_FLASH_MS:
        if screens.check_exit():
            return None
        render(board, cursor_x, cursor_y, player, line, True)
        sleep_ms(FRAME_MS)
    return "done"


def play_one_round():
    board = [0] * 9
    cursor_x = 1
    cursor_y = 1
    player = 1  # Red starts.

    prev_up = prev_down = prev_left = prev_right = prev_center = False

    while True:
        if screens.check_exit():
            return None

        cur_up = JOY_UP.value() == 0
        cur_down = JOY_DOWN.value() == 0
        cur_left = JOY_LEFT.value() == 0
        cur_right = JOY_RIGHT.value() == 0
        cur_center = JOY_CENTER.value() == 0

        if cur_up and not prev_up:
            cursor_y = max(0, cursor_y - 1)
        if cur_down and not prev_down:
            cursor_y = min(2, cursor_y + 1)
        if cur_left and not prev_left:
            cursor_x = max(0, cursor_x - 1)
        if cur_right and not prev_right:
            cursor_x = min(2, cursor_x + 1)

        if cur_center and not prev_center:
            idx = cursor_y * 3 + cursor_x
            if board[idx] == 0:
                board[idx] = player
                result, line = winner(board)
                if result:
                    if line:
                        if show_win_flash(board, cursor_x, cursor_y, player, line) is None:
                            return None
                    else:
                        render(board, cursor_x, cursor_y, player)
                        sleep_ms(900)
                    if result == 1:
                        return 1
                    if result == 2:
                        return 2
                    return 0
                player = 2 if player == 1 else 1

        prev_up = cur_up
        prev_down = cur_down
        prev_left = cur_left
        prev_right = cur_right
        prev_center = cur_center

        render(board, cursor_x, cursor_y, player)
        sleep_ms(FRAME_MS)


def run(neopixel, joystick, display=None, screens_np=None):
    global np, W, H, NUM_LEDS, JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT, JOY_CENTER
    np = neopixel
    W = display["width"] if display else 8
    H = display["height"] if display else 8
    NUM_LEDS = W * H

    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
    JOY_CENTER = joystick["center"]

    screens.init(screens_np if screens_np is not None else neopixel, joystick,
                 display["width"] if display else None,
                 display["height"] if display else None)

    while True:
        if screens.loading_screen() == "exit":
            return
        score = play_one_round()
        if score is None:
            return
        if screens.game_over_screen(score) == "exit":
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
