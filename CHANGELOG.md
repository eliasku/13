## 1.0.25

- Antialiasing option
- Map generation
- Damage hit labels
- Critical hit chance
- Respawn screen
- High quality text rendering
- Support multiple client versions on server
- Fix key controls bubble to iframe parent
- Simple modal popups instead of browser's prompts
- 
## 1.0.24

- Turn off git info hash from server version verify

## 1.0.23

- Re-enable TURN servers

## 1.0.22

- Remove analytics from Poki build

## 1.0.21

- Move pages to site
- Add firebase analytics  

## 1.0.19

- Add new Uzi weapon 🧣 (tracer bullets)
- Add Laser sight and enable for all guns!
- Walls and map boundaries stops Rail-gun ray projectile
- Load game configuration from JSON file #21
- Fix camera feedback on Y-axis

## 1.0.18

- Add draft walls
- Enable High-DPI by default
- More padding for dynamic font
- Autoplay continue attacks if low-hp and no hp items
- Rework room join flow
- Add top-state out of sync disconnect for Production mode

## 1.0.17

- Add screen shake on object death
- Improve weapon camera feedback
- Fix missing Frog avatar emoji

## 1.0.16

- Fix replays
- Add copy game link URL
- Fix join by game-code
- Add support for checking online on different servers

## 1.0.15

- (dev) `watch` script renamed to `start`
- Fix sound and music

## 1.0.14

- Add simple autoplay mode for debugging
- Change user settings data
- Add replay files initial support (wip)
- Player bot API (wip)

## 1.0.13

- Add in-game menu (graceful way to quit the game room)
- Fix rare font atlas artifacts
- Change settings button in Main Menu
- Add settings for Practice Mode 

## 1.0.12

- Optimize and refactoring game state data
- Changes for [poki](https://poki.com/)

## 1.0.11

- Create and join game rooms #38
- New FROGMAN head
- Brand icons
- RTC packet lag calculation #73

## 1.0.10

- Fix render occlusion
- Fix desync item's lifetime overflow
- Fix start tic sync issue (disable prediction for joining state)

## 1.0.9

- Simple preloader #61
- Simple mesh sprites #41
- Generic mesh virtual pads #64
- Improve Clear pass #62
- Improve Fog pass #63
- `[Escape]` key to navigate back #65
- Fade blood and footprints after some time #68
- Fix `step` sound playing interval

## 1.0.8

- Kid-mode blood #51
- Settings menu #48
- Dev menu: click 4 times on the main Game Logo
- Fix game camera smoothness
- Fix brightness for bone particles
- Weapon affect movement velocity #50
- Add Crosshair reload / empty state alterations
- Land particles and footprints #34
- Fix Weapon items overlaps the floor #42

## 1.0.7

- Offline Practice Mode #37
- Light below the Game Logo
- Cross-platform static monospace font for UI
- Splash Screen NPC start ammo
- Decrease minimum fire distance for Gun weapons for NPC
- Fix EMPTY / NO MAGS spam #44 (add reload / fire button down event) 
- Additional particles when bullet hits player shields
- Fix bullet bouncing on hit with damage #36 
- Keep logo while connecting #8
- Fix dancing nickname (prev Z used)

## 1.0.6

- Fix text particle spawn repeating
- Remove standard weapons drop from Barrels
- Limit max velocity for items drop
- Fix over camera shake effect for rail-gun
- Fix crosshair draw order
- Force ES2020 for client
- Fix resize
- Fix missing `speechSynthesis`
- Zoom out a little bit
- Splash screen on the game

## 1.0.5

### Graphics

- Font glyph combined with shadow
- Render more depth

### Gameplay

- NPC can't spawn with powerful weapon, make game start much easier

### UI

- Splash / Connecting screen improved 

## 1.0.4

- Change to OpenRelay STUN and TURN servers for WebRTC connection
- Change AI low-hp behaviour

## 1.0.3

- Change version label text to `v1.0.3 🏷`
- Fix server spam in `loaded` state before main menu
- Enable `POST` method to load `index.html`

## 1.0.2

### NPC
- NPC don't drop weapon until HP level above 5, then NPC start panic as before
- Slower NPC spawning
- Add Santa Claus NPC skin
- Add AI min-max shooting radius, searching for ammo

### General

- Add map themes #19
- Reset frags on death, add scores #18
- Add coin and diamond items for scores #18
- Add shield item and health-kit to add +2 hp
- Add ammo magazine item #11
- Add loot item lifetime, all items will be removed in 10 seconds #5
- Add weapon reloading mechanics #11
- Add [R] button - reload button to apply new ammo magazine #11
- Add [Q] button - swap secondary weapon slot #13
- Change [E] button to PICK weapon on the map or DROP your current weapon

### UI
- Add simple mini-map #10
- Add "change name" button #14 #23
- Improve Main Menu screen #23
- Add online users info in the Main Menu #23
- Add hyper-link to project available from game's version label #23
- Draw only enemy name label
- Add floating text when picking up items, or "out of ammo" case #24

## 1.0.1
- NPC are also fighting
- Simple text rendering
- HUD rendering
- Display client version
- Fix radial generation
- Add favicon
- Add FPS prefix
- Fix atlas pre-render, use consistent alphabetic baseline
- Display Name on top of character for real players
- Fix sound effects panorama (world scale issue)
