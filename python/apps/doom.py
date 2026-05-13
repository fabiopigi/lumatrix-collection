from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import math
import random
import _screens as screens

NAME = "Doom"
NUM_LEDS = 64
IDLE_MS = 10_000

np = None
JOY_UP = None
JOY_DOWN = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_SEL = None

MAP_SIZE = 10
FOV = math.pi / 3
BRIGHTNESS = 0.15
MAX_DIST = 8.0

px, py, pa = 1.5, 1.5, 0.0
world_map = [[1 for _ in range(MAP_SIZE)] for _ in range(MAP_SIZE)]
z_buffer = [MAX_DIST] * 8
enemies = []
projectiles = []
frame_buffer = [[0.0, 0.0, 0.0] for _ in range(NUM_LEDS)]


def generate_map():
    global px, py, enemies, world_map
    enemies = []
    world_map = [[1 for _ in range(MAP_SIZE)] for _ in range(MAP_SIZE)]
    cx, cy = random.randint(1, 8), random.randint(1, 8)
    px, py = float(cx), float(cy)
    for _ in range(40):
        world_map[cy][cx] = 0
        direction = random.choice([(0, 1), (0, -1), (1, 0), (-1, 0)])
        nx, ny = cx + direction[0], cy + direction[1]
        if 0 < nx < MAP_SIZE - 1 and 0 < ny < MAP_SIZE - 1:
            cx, cy = nx, ny

    while len(enemies) < 3:
        ex, ey = random.randint(1, 8), random.randint(1, 8)
        if world_map[ey][ex] == 0 and (abs(ex - px) > 2 or abs(ey - py) > 2):
            enemies.append([ex + 0.5, ey + 0.5, 1, 0])


def clear_buffer():
    for i in range(NUM_LEDS):
        frame_buffer[i][0] = 0.0
        frame_buffer[i][1] = 0.0
        frame_buffer[i][2] = 0.0


def show_buffer():
    for i in range(NUM_LEDS):
        r = min(255, int(frame_buffer[i][0] * BRIGHTNESS))
        g = min(255, int(frame_buffer[i][1] * BRIGHTNESS))
        b = min(255, int(frame_buffer[i][2] * BRIGHTNESS))
        np[i] = (r, g, b)
    np.write()


def draw_sprite(x_pos, y_pos, dist, size, color):
    half_s = size / 2.0
    start_x = int(x_pos - half_s + 0.5)
    end_x = int(x_pos + half_s + 0.5)
    start_y = int(y_pos - half_s + 0.5)
    end_y = int(y_pos + half_s + 0.5)

    for ix in range(start_x, end_x + 1):
        if 0 <= ix < 8 and dist < z_buffer[ix]:
            for iy in range(start_y, end_y + 1):
                if 0 <= iy < 8:
                    idx = iy * 8 + ix
                    frame_buffer[idx][0] = min(255, frame_buffer[idx][0] + color[0])
                    frame_buffer[idx][1] = min(255, frame_buffer[idx][1] + color[1])
                    frame_buffer[idx][2] = min(255, frame_buffer[idx][2] + color[2])


def render_world():
    global z_buffer
    for i in range(8):
        ray_angle = (pa - FOV / 2.0) + (i / 8.0) * FOV
        rx, ry, d = px, py, 0.0
        while d < MAX_DIST:
            d += 0.1
            if world_map[int(ry + math.sin(ray_angle) * d)][int(rx + math.cos(ray_angle) * d)] == 1:
                break

        actual_dist = d * math.cos(ray_angle - pa)
        z_buffer[i] = actual_dist
        height = min(8, max(1, int(8 / (actual_dist + 0.01))))
        start_y = (8 - height) // 2
        nz = max(0.0, min(1.0, 1.0 - (actual_dist / 7.0)))
        for y in range(start_y, start_y + height):
            frame_buffer[y * 8 + i] = [200 * nz, 50 * nz ** 2, 255 * (1 - nz)]

    t = ticks_ms()
    for e in enemies:
        dx, dy = e[0] - px, e[1] - py
        dist = math.sqrt(dx * dx + dy * dy)
        angle = math.atan2(dy, dx) - pa
        while angle < -math.pi: angle += 2 * math.pi
        while angle > math.pi: angle -= 2 * math.pi

        if abs(angle) < FOV:
            sx = (angle / FOV + 0.5) * 8
            size = max(1, int(6 / (dist + 0.5)))
            color = [255, 255, 255] if e[3] > 0 else [255, (math.sin(t / 100) + 1) * 100, 0]
            if e[3] > 0: e[3] -= 1
            draw_sprite(sx, 3.5, dist, size, color)

    for p in projectiles:
        dx, dy = p[0] - px, p[1] - py
        dist = math.sqrt(dx * dx + dy * dy)
        angle = math.atan2(dy, dx) - pa
        while angle < -math.pi: angle += 2 * math.pi
        while angle > math.pi: angle -= 2 * math.pi

        if abs(angle) < FOV:
            sx = (angle / FOV + 0.5) * 8
            size = max(1.0, 6.0 - (dist * 4.0))
            draw_sprite(sx, 4.0, dist, size, [255, 255, 100])


def update_game():
    global projectiles, enemies
    new_projs = []
    for p in projectiles:
        p[0] += math.cos(p[2]) * 0.4
        p[1] += math.sin(p[2]) * 0.4

        if world_map[int(p[1])][int(p[0])] == 1:
            continue

        hit_enemy = False
        for e in enemies:
            edist = math.sqrt((p[0] - e[0]) ** 2 + (p[1] - e[1]) ** 2)
            if edist < 0.4:
                e[2] -= 1
                e[3] = 3
                hit_enemy = True
                break

        if not hit_enemy and math.sqrt((p[0] - px) ** 2 + (p[1] - py) ** 2) < MAX_DIST:
            new_projs.append(p)

    projectiles = new_projs
    enemies = [e for e in enemies if e[2] > 0]


def play_doom():
    """Run a doom session. Returns 'exit' or 'idle'."""
    global px, py, pa, projectiles
    projectiles = []
    pa = 0.0
    generate_map()

    last_activity = ticks_ms()

    while True:
        if screens.check_exit():
            return "exit"

        active = False
        if JOY_LEFT.value() == 0:
            pa -= 0.15
            active = True
        if JOY_RIGHT.value() == 0:
            pa += 0.15
            active = True

        nx, ny = px, py
        if JOY_UP.value() == 0:
            nx += math.cos(pa) * 0.15
            ny += math.sin(pa) * 0.15
            active = True
        if JOY_DOWN.value() == 0:
            nx -= math.cos(pa) * 0.15
            ny -= math.sin(pa) * 0.15
            active = True
        if world_map[int(ny)][int(nx)] == 0:
            px, py = nx, ny

        if JOY_SEL.value() == 0:
            if len(projectiles) == 0:
                projectiles.append([px, py, pa])
            active = True

        if active:
            last_activity = ticks_ms()
        elif ticks_diff(ticks_ms(), last_activity) >= IDLE_MS:
            return "idle"

        update_game()
        clear_buffer()
        render_world()
        show_buffer()

        if not enemies:
            generate_map()

        sleep_ms(30)


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT, JOY_SEL
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
    JOY_SEL = joystick["center"]
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = play_doom()
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
