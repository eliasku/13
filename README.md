[![Build](https://github.com/eliasku/13/actions/workflows/build.yml/badge.svg)](https://github.com/eliasku/13/actions/workflows/build.yml)
[![Pages](https://github.com/eliasku/13/actions/workflows/static.yml/badge.svg)](https://github.com/eliasku/13/actions/workflows/static.yml)
[![Twitter](https://img.shields.io/twitter/follow/eliaskuvoice.svg?style=flat&label=Follow&logoColor=white&color=1da1f2&logo=twitter)](https://twitter.com/eliaskuvoice)
[![Play Release](https://img.shields.io/badge/Play%20Release-online-pink.svg)](https://iioi.herokuapp.com/)
[![Play Latest](https://img.shields.io/badge/Play%20Latest-online-olive.svg)](https://next13.herokuapp.com/)

# ☠️ 13 ☠️

Fast-paced multiplayer top-down shooting game for [js13k 2022 competition](https://js13kgames.com/)

<p align="center">
<img src="13.gif">
</p>

- 🎖️ **7-th place** winner!
- 🥇 **1-st place** in **Server** category
- 🥉 **3-rd place** in **Mobile** category
- Check out [13 game post-mortem](https://eliasku.hashnode.dev/13-game)
- Check out initial 13`kb` submission source-code in [`js13k` branch](https://github.com/eliasku/13/tree/js13k)

## 📖 How to play

Select game server, share the link and wait friends to play:

- The latest release is available on [🚪iioi](https://iioi.herokuapp.com/) server
- Unreleased `master` changes is always deployed to [🚪grtc](https://grtc.herokuapp.com/) or [🚪next13](https://next13.herokuapp.com/) servers
- [Check servers for online players](https://eliasku.github.io/13/servers.html)

### 🎮 Controls

#### 🖱️Mouse | ⌨️ Keyboard

- Move Mouse to aim and look around
- Push Mouse button to shoot
- Use `W A S D` / `↑ ← ↓ →` to move
- Hold `Shift` to slow down moving
- Press `E` to to PICK weapon on the map or DROP your current weapon
- Press `Space` to jump
- Press `R` to reload weapon
- Press `Q` to switch secondary weapon slot

#### 📱 Touch-screen

- Use Left Joystick to walk-run-jump
- Use Right Joystick to aim-shoot (Move around aim-shoot zones to trigger some weapons like Pistol)
- Use `DROP` button to pick weapon on the map or drop your current weapon
- Use `RELOAD` button to reload the weapon
- Use `SWAP` button to swap the secondary weapon slot

### 📜 Rules

At spawn each Player or NPC has 10`hp` (hit points). You are able to get extra 10`sp` (shield points) on top of that.

- Player kills neutral NPC to gain +1 score.
- Player kills another Player to gain +10 scores.

Kill opponents 💀 | 👹 | 🤡 | 🤖 | 🎃 | 🦝 | 🐙 | 🐰 | 🦌 | 🐺 | 🐵 | 🦊 | 🐭 | 🦍 | 🐸 to score `FRAG` and get 5`cr`

Kill NPC 🍅 | 😐 | 🐷 | 🎅🏻 to score `FRAG` and get 1`cr`

### Items

Destroy objects 🛢 | 📦 | 🪦 to get items

- ❤️ Heart: pick to restore 1`hp`
- 💊️ Pill: pick to restore 2`hp`
- 🪙️ Coin: pick for 1`cr` (credits)
- 💎️ Diamond: pick for 5`cr` (credits)
- 🛡️ Shield: pick to add 1`sp` (shield-point)
- 🧱️ Ammo Magazine: pick to add 1`am` (ammo-magazine)

### Weapons

- 🔪 Knife (melee)
- 🪓 Axe (melee)
- 🔫 Pistol (trigger)
- 🖊 Machine-gun (auto)
- ️✏️ Heavy machine-gun (auto)
- 🪥 Shotgun (bouncing, scatter)
- ⛏ Crossbow (high velocity)
- 🔌 Plasma-gun (bouncing, auto)
- 🧵 Rail-gun (piercing)
- 🧣 Uzi (tracer bullets, rapid fire)

### Dev-menu

Tap 4 times on the main game logo to unlock dev-mode and dev-settings.

## Minimal requirements

### Client

- **Good, low-latency network connection** is required for each playing client
- **Fast mobile device or desktop** to not lag other clients
- WebAudio `AudioContext` support is required (available from Safari iOS 14.5, April 2021)
- WebGL context is required
- Modern JS syntax support
- Checked in the latest Chrome, Safari, Firefox on iOS, Android and Mac.

### Server, build stack

- `NodeJS` **v18 or higher** is required
- `NPM` **v7 or higher** is required for workspaces

## 📦 Resources

Code for Music generation in runtime created by [author](https://twitter.com/eliaskuvoice). Some instrument samples are picked from [ZzFXM](https://keithclark.github.io/ZzFXM/) example song `Depp`

Emoji Font [Twemoji Mozilla](https://github.com/mozilla/twemoji-colr/releases) is used for cross-platform emoji rendering. Game is able to work without `e.ttf` file, but some icons are incorrect rotation angle, or different at all. But game should be playable anyway.

2D graphics rendering is started from [js13k-2d](https://github.com/kutuluk/js13k-2d) and highly rewritten for what I need.

Sound Effects - [ZZFX](https://github.com/KilledByAPixel/ZzFX).

## How to build

First of all, install dependencies:
```shell
npm i
```

Use `start` script to build and watch for changes, run local server ([localhost:8080](http://localhost:8080))

```shell 
npm start
```

To deploy the game run the `build` script and then start the server
```shell
# build only
npm run build
# run server
node server.js
```

### Modify game config

1. Recommended way to change global game configuration is via `packages/tools/src/config.ts` file. It provides types and some good utilities to compose the final configuration.
2. Generate `packages/client/assets/config.json` by running `npm run config`.
3. Run `npm start` or `npm run build` - scripts will copy `packages/client/assets/config.json` to `public/config.json`, it will be loaded by the game and will be used for all global configuration.

If you need some new option from the code to be exposed in `config.json`, please create the issue.
