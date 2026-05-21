# Draft email to Pimoroni

**Suggested subject:** Open-source LED-matrix toolkit ❤ Interstate 75 L — quick hello

---

Hi Pimoroni team,

I'm Fabio, writing from Switzerland with a slightly cheeky ask and a project I'd love to tell you about.

For the last year or so, my sister Gina, my friend Mathias and I have been quietly building **LumenLab** — an open-source toolkit for LED-matrix kits running MicroPython on a Pico. It started around a small 8×8 NeoPixel workshop kit (the ZHAW LUMATRIX, here in Switzerland), and it's grown into something we're genuinely proud of:

- A browser-based pixel **designer**, **simulator**, AI-assisted **app creator**, and a **Web-Serial flasher** that lets anyone push apps to a Pico without ever opening Thonny — all live at **https://lumen.fabs.au**
- 13 built-in MicroPython apps (Pong, Snake, Breakout, Space Invaders, a 1D-raycaster Doom, a word-clock, a few more) that all share a launcher and joystick contract
- Source: **https://github.com/fabiopigi/lumenlab**

Quick intro to who's behind it:

- **Fabio Pigagnelli** (me) — programmer, mostly the web toolkit side (Next.js, the simulator, the designer, the flash wizard)
- **Gina Pigagnelli** (my sister) — designer and creative mind; she's also the one who QAs everything on both the hardware and the software side and tells us when something is unintuitive (she's usually right)
- **Mathias Schilling** (my friend) — programmer and hardware integration; the one who solders things and makes them not catch fire

Here's the cheeky bit: we recently stumbled onto your **Interstate 75 L**, and the three of us have been a bit obsessed ever since. It is, almost uncannily, the board we've been informally designing toward — same MicroPython + Pico stack we already target, but with a much bigger HUB75 canvas (32×32 is roughly 16× more pixels than 8×8, which opens up scenes, type, real animations…), plus the option of a sensor add-on (temperature, IMU/gyro) and a joystick. Our roadmap already has two long-standing "wild idea" docs that basically describe exactly this board — we even mention Pimoroni by name in one of them, before we knew the Interstate 75 L existed.

So — and please feel free to politely ignore this — **would you ever consider sponsoring our little team with three Interstate 75 L kits** (board + 32×32 panel + sensor add-on + joystick, one each for Gina, Mathias and me)? Even one would unblock the bring-up; three would let us actually develop in parallel and test multi-device ideas.

In return we'd love to:

- Add a first-class **Interstate 75 L preset** to the designer, simulator and flash wizard, so anyone with the board can click "Flash" and have a launcher running in under a minute, no command line
- Port the launcher and a handful of apps to 32×32, and build out the sensor input layer (tilt games, temp-reactive ambient stuff, etc.) — all open source
- Show **Pimoroni's logo and a product link** prominently on lumen.fabs.au, in the GitHub README, and in the flash wizard whenever the Interstate 75 L preset is picked
- Write up the whole bring-up (with photos, videos, a short demo per app) as something you're welcome to repost on your blog or product page

I put together a slightly longer write-up of the why-it-fits and the what-you'd-get-back here, in case it's useful for whoever inside Pimoroni would have to sign off on something like this:

**https://github.com/fabiopigi/lumenlab/blob/claude/pimoroni-sponsorship-proposal-jmFs9/docs/pimoroni-sponsorship-proposal.md**

No pressure at all if it's not a fit — we're going to keep building either way. But if there's any version of "yes" here, we'd be thrilled, and we'd make sure your team gets to see what we do with the hardware.

Thanks for reading this far, and thanks for making the kind of hardware that makes people like us want to build things on top of it.

Warmly,
Fabio (with Gina & Mathias)
LumenLab — https://lumen.fabs.au
