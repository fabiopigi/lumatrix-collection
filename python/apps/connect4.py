from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens

NAME = "Connect4"
NUM_LEDS = 64

COLS = 8
ROWS = 7  # LED rows 0..6 hold pieces; LED row 7 is the cursor lane.

RED = 1
YELLOW = 2

# Design hexes scaled to the project's 25% brightness convention:
# placed pieces use #ff0000 / #ffff00; the dim cursor mirrors the design's #800000.
PLACED = {RED: (64, 0, 0),  YELLOW: (64, 64, 0)}
CURSOR = {RED: (32, 0, 0),  YELLOW: (32, 32, 0)}

FRAME_MS = 50
FALL_STEP_MS = 70
PULSE_CYCLES = 3
PULSE_HALF_MS = 220
DRAW_HOLD_MS = 1200

np = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_CENTER = None


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def draw_pieces(board):
    for c in range(COLS):
        for r in range(ROWS):
            v = board[c][r]
            if v:
                px(c, r, PLACED[v])


def render_board(board, cursor_col, cursor_player):
    clear()
    draw_pieces(board)
    if cursor_player is not None:
        px(cursor_col, 7, CURSOR[cursor_player])
    np.write()


def column_top(board, col):
    """Lowest empty row in the column, or None if full."""
    for r in range(ROWS):
        if board[col][r] == 0:
            return r
    return None


def animate_drop(board, col, target_row, player):
    color = PLACED[player]
    for r in range(6, target_row - 1, -1):
        if screens.check_exit():
            return False
        clear()
        draw_pieces(board)
        px(col, r, color)
        np.write()
        sleep_ms(FALL_STEP_MS)
    return True


def winning_line(board, col, row, player):
    for dc, dr in ((1, 0), (0, 1), (1, 1), (1, -1)):
        line = [(col, row)]
        c, r = col + dc, row + dr
        while 0 <= c < COLS and 0 <= r < ROWS and board[c][r] == player:
            line.append((c, r))
            c += dc
            r += dr
        c, r = col - dc, row - dr
        while 0 <= c < COLS and 0 <= r < ROWS and board[c][r] == player:
            line.append((c, r))
            c -= dc
            r -= dr
        if len(line) >= 4:
            return line
    return None


def pulse_line(board, line, player):
    bright = PLACED[player]
    dim = (bright[0] // 4, bright[1] // 4, bright[2] // 4)
    cells = set(line)
    for _ in range(PULSE_CYCLES):
        for color in (dim, bright):
            if screens.check_exit():
                return False
            clear()
            for c in range(COLS):
                for r in range(ROWS):
                    v = board[c][r]
                    if not v:
                        continue
                    px(c, r, color if (c, r) in cells else PLACED[v])
            np.write()
            sleep_ms(PULSE_HALF_MS)
    return True


def hold_with_exit(ms):
    """Sleep ms while polling check_exit. Returns True if exit was triggered."""
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < ms:
        if screens.check_exit():
            return True
        sleep_ms(15)
    return False


def play_one_round():
    board = [[0] * ROWS for _ in range(COLS)]
    cursor_col = 4
    player = RED
    moves = 0

    prev_left = False
    prev_right = False
    center_press_start = None

    while True:
        if screens.check_exit():
            return None

        cur_left = JOY_LEFT.value() == 0
        cur_right = JOY_RIGHT.value() == 0
        cur_center = JOY_CENTER.value() == 0

        if cur_left and not prev_left and cursor_col > 0:
            cursor_col -= 1
        if cur_right and not prev_right and cursor_col < COLS - 1:
            cursor_col += 1

        # Drop on release of a short center tap. Long holds belong to check_exit.
        if cur_center and center_press_start is None:
            center_press_start = ticks_ms()
        elif not cur_center and center_press_start is not None:
            held = ticks_diff(ticks_ms(), center_press_start)
            center_press_start = None
            if held < screens.EXIT_HOLD_MS:
                target = column_top(board, cursor_col)
                if target is not None:
                    if not animate_drop(board, cursor_col, target, player):
                        return None
                    board[cursor_col][target] = player
                    moves += 1

                    line = winning_line(board, cursor_col, target, player)
                    if line:
                        if not pulse_line(board, line, player):
                            return None
                        return player

                    if moves >= COLS * ROWS:
                        render_board(board, cursor_col, None)
                        if hold_with_exit(DRAW_HOLD_MS):
                            return None
                        return 0

                    player = YELLOW if player == RED else RED

        prev_left = cur_left
        prev_right = cur_right

        render_board(board, cursor_col, player)
        sleep_ms(FRAME_MS)


def run(neopixel, joystick):
    global np, JOY_LEFT, JOY_RIGHT, JOY_CENTER
    np = neopixel
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
    JOY_CENTER = joystick["center"]
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = play_one_round()
        if outcome is None:
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
