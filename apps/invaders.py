from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random

NAME = "SpaceInvaders"
NUM_LEDS = 64

np = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_CENTER = None

ALIEN_COLOR  = (50, 0, 0)
BULLET_COLOR = (45, 40, 5)
SCORE_COL    = (50, 30, 0)
GAMEOVER_COL = (60, 0, 0)
LEVELUP_COL  = (45, 45, 45)

SHIP_COLORS = [
    (0, 30, 0),
    (0, 45, 5),
    (0, 50, 25),
    (0, 40, 50),
    (15, 50, 55),
]

FRAME_MS = 50
MOVE_SPEED = 0.30

LEVELS = (
    {"streams": 1, "shoot": 14, "alien_step": 28, "spawn": 50},
    {"streams": 1, "shoot": 10, "alien_step": 22, "spawn": 40},
    {"streams": 2, "shoot":  9, "alien_step": 18, "spawn": 32},
    {"streams": 3, "shoot":  7, "alien_step": 14, "spawn": 26},
    {"streams": 3, "shoot":  5, "alien_step": 10, "spawn": 22},
)

LEVEL_THRESHOLDS = (8, 20, 35, 55)

_exit_press_start = None


def level_index(score):
    for i, t in enumerate(LEVEL_THRESHOLDS):
        if score < t:
            return i
    return len(LEVEL_THRESHOLDS)


def stream_offsets(n):
    if n == 1: return (0,)
    if n == 2: return (-1, 1)
    if n == 3: return (-1, 0, 1)
    if n == 5: return (-2, -1, 0, 1, 2)
    return (0,)


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


def gameover_input():
    global _exit_press_start
    if JOY_CENTER is None:
        return None
    if JOY_CENTER.value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
        elif ticks_diff(now, _exit_press_start) >= 1500:
            while JOY_CENTER.value() == 0:
                sleep_ms(20)
            _exit_press_start = None
            return "hold"
    else:
        if _exit_press_start is not None:
            _exit_press_start = None
            return "tap"
    return None


def _gameover_wait(ms):
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < ms:
        r = gameover_input()
        if r == "tap":
            return "restart"
        if r == "hold":
            return "exit"
        sleep_ms(15)
    return None


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def render(player_col, ship_color, aliens, bullets):
    clear()
    for off in (-1, 0, 1):
        c = player_col + off
        if 0 <= c <= 7:
            px(c, 0, ship_color)
    for a in aliens:
        if 0 <= a[1] <= 7:
            px(a[0], a[1], ALIEN_COLOR)
    for b in bullets:
        if 0 <= b[1] <= 7:
            px(b[0], b[1], BULLET_COLOR)
    np.write()


def handle_collisions(bullets, aliens, score):
    if not aliens or not bullets:
        return bullets, aliens, score
    alien_pos = {}
    for i, a in enumerate(aliens):
        alien_pos.setdefault((a[0], a[1]), []).append(i)
    killed = set()
    remaining = []
    for b in bullets:
        key = (b[0], b[1])
        hit = False
        if key in alien_pos:
            for ai in alien_pos[key]:
                if ai not in killed:
                    killed.add(ai)
                    score += 1
                    hit = True
                    break
        if not hit:
            remaining.append(b)
    aliens = [a for i, a in enumerate(aliens) if i not in killed]
    return remaining, aliens, score


def level_up_flash():
    for _ in range(2):
        for i in range(NUM_LEDS):
            np[i] = LEVELUP_COL
        np.write()
        sleep_ms(60)
        clear()
        np.write()
        sleep_ms(40)


FONT = {
    "0": [".XXX.","X...X","X...X","X...X","X...X","X...X",".XXX."],
    "1": ["..X..",".XX..","..X..","..X..","..X..","..X..","XXXXX"],
    "2": [".XXX.","X...X","....X","...X.","..X..",".X...","XXXXX"],
    "3": ["XXXX.","....X","....X",".XXX.","....X","....X","XXXX."],
    "4": ["X...X","X...X","X...X","XXXXX","....X","....X","....X"],
    "5": ["XXXXX","X....","X....","XXXX.","....X","X...X",".XXX."],
    "6": [".XXX.","X....","X....","XXXX.","X...X","X...X",".XXX."],
    "7": ["XXXXX","....X","...X.","..X..","..X..","..X..","..X.."],
    "8": [".XXX.","X...X","X...X",".XXX.","X...X","X...X",".XXX."],
    "9": [".XXX.","X...X","X...X",".XXXX","....X","....X",".XXX."],
    " ": [".....",".....",".....",".....",".....",".....","....."],
    ":": [".....","..X..","..X..",".....","..X..","..X..","....."],
    "S": [".XXXX","X....","X....",".XXX.","....X","....X","XXXX."],
    "C": [".XXXX","X....","X....","X....","X....","X....",".XXXX"],
    "O": [".XXX.","X...X","X...X","X...X","X...X","X...X",".XXX."],
    "R": ["XXXX.","X...X","X...X","XXXX.","X.X..","X..X.","X...X"],
    "E": ["XXXXX","X....","X....","XXXX.","X....","X....","XXXXX"],
}


def text_to_bitmap(text):
    rows = ["", "", "", "", "", "", ""]
    for ch in text:
        glyph = FONT.get(ch, FONT[" "])
        for i, line in enumerate(glyph):
            rows[i] += line + "."
    return rows


def gameover_marquee(text, color, step_ms=70):
    bitmap = text_to_bitmap(text)
    total = len(bitmap[0])
    for offset in range(-8, total + 1):
        clear()
        for i in range(7):
            for j in range(8):
                src = offset + j
                if 0 <= src < total and bitmap[i][src] == "X":
                    px(j, 7 - i, color)
        np.write()
        r = _gameover_wait(step_ms)
        if r:
            return r
    return None


def game_over_sequence(score):
    for _ in range(3):
        for i in range(NUM_LEDS):
            np[i] = GAMEOVER_COL
        np.write()
        r = _gameover_wait(120)
        if r:
            return r
        clear()
        np.write()
        r = _gameover_wait(80)
        if r:
            return r
    for b in (50, 30, 15, 5, 0):
        for i in range(NUM_LEDS):
            np[i] = (b, 0, 0)
        np.write()
        r = _gameover_wait(70)
        if r:
            return r
    clear()
    np.write()
    r = _gameover_wait(200)
    if r:
        return r
    r = gameover_marquee("SCORE: " + str(score), SCORE_COL)
    if r:
        return r
    r = _gameover_wait(300)
    if r:
        return r
    return "exit"


def play_one_round():
    player_col_f = 4.0
    aliens = []
    bullets = []
    score = 0
    shoot_timer = 0
    alien_timer = 0
    spawn_timer = 0
    prev_level = level_index(0)
    frame = 0
    intro_frames = 14

    while True:
        if check_exit():
            return "exit"

        cur_level = level_index(score)
        params = LEVELS[min(cur_level, len(LEVELS) - 1)]

        if cur_level > prev_level:
            level_up_flash()
            prev_level = cur_level

        ship_color = SHIP_COLORS[min(cur_level, len(SHIP_COLORS) - 1)]

        if JOY_LEFT.value() == 0:
            player_col_f -= MOVE_SPEED
        if JOY_RIGHT.value() == 0:
            player_col_f += MOVE_SPEED
        if player_col_f < 1.0:
            player_col_f = 1.0
        if player_col_f > 6.0:
            player_col_f = 6.0
        player_col = int(round(player_col_f))

        new_bullets = []
        for b in bullets:
            b[1] += 1
            if b[1] <= 7:
                new_bullets.append(b)
        bullets = new_bullets

        bullets, aliens, score = handle_collisions(bullets, aliens, score)

        if frame >= intro_frames:
            alien_timer += 1
            if alien_timer >= params["alien_step"]:
                alien_timer = 0
                for a in aliens:
                    a[1] -= 1
                bullets, aliens, score = handle_collisions(bullets, aliens, score)
                if any(a[1] <= 0 for a in aliens):
                    render(player_col, ship_color, aliens, bullets)
                    return game_over_sequence(score)

        if frame >= intro_frames:
            shoot_timer += 1
            if shoot_timer >= params["shoot"]:
                shoot_timer = 0
                for off in stream_offsets(params["streams"]):
                    bx = player_col + off
                    if 0 <= bx <= 7:
                        bullets.append([bx, 1])

        if frame >= intro_frames:
            spawn_timer += 1
            if spawn_timer >= params["spawn"]:
                spawn_timer = 0
                aliens.append([random.randint(0, 7), 7])

        render(player_col, ship_color, aliens, bullets)
        sleep_ms(FRAME_MS)
        frame += 1


def play():
    while True:
        if play_one_round() == "exit":
            return


def run(neopixel, joystick):
    global np, JOY_LEFT, JOY_RIGHT, JOY_CENTER, _exit_press_start
    np = neopixel
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
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
    while True:
        run(_np, _joy)
