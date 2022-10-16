# 13 game (js13kGames-2022)

So I decide to enter the [js13k 2022](https://js13kgames.com/) competition.  The result is a [game "13"](https://js13kgames.com/entries/13) - that's fast-action peer-to-peer realtime multiplayer top-down shooter which fits 13kb (including the nodejs server)!

![13 the game](images/400.png)

## Goals

Personal goal has been set before theme announcement. It want try implement peer to peer realtime multiplayer gameplay. I have not done any multiplayer games before, but very interested in topic and read tons of articles about approach. 

## Death Theme!

I've been thinking about something original in terms of gameplay for a few days. I wish the game would cover the topic better. In the end, I decided that the simpler the better and began to focus around the idea of "Bullet-Hell". I realized that if I use Emoji for the faces of the characters, then it could be similar to the maxi psychopathic killers, so I was reminded of "The Purge" movie series. 

![Characters](images/ref_masks.jpg)

An urban or suburban locations could be more interesting for tactical moves in multiplayer game, but it seemed that it would be too much for 13kb limit and because of poor art skills. I decided that it would take place in a forest glade, which in principle can cause the right associations with thrillers, where killers hunt down and chasing heroes through the wild night. I was skeptical about the lighting, but by the end I had the will to implement the simplest "fog of war", which improved the overall picture.

Inspired by **Nuclear Throne** for the shooting mechanics, and **Hotline Miami** in terms of styling (dirty high-res pixel-art without filtering), as well as the blood jets and smudges on the map.

I love platform games, but taking into account that it would be more interesting to make game in a different genre, I settled on the top-down shooter.

I thought if I was lucky, I would give the damn name "13" and make 13 characters and 13 weapons. But time and size limits prevent me from finishing all another weapons.

## Networking

I use WebRTC for fast data exchange without confirmation and without ordering (like UDP protocol).

Architecture is simple. I use the Deterministic Lock-Step setup: the player waits until all players input for this tick will be received, and only then Player able to simulate and represent this tick state. Full determinism of game logic. To prevent short lags, I use a scheme with overlapping ticks for input. The player assigns input commands execution time a little ahead of time (delayed input), despite the feedback delay on the client of several frames, we are able to smoothly accumulate buffer of inputs on clients to prevent failing down into the cold state (when there is not enough input to simulate a tick).

I did not use any web-socket for signaling between clients to instantiate peer connections. I decide to implement a simpler solution for data exchange via `fetch` and `EventSource`. The server is keeping current connections and managing simple message exchange from client to client. A client sends server a command with destination client identifier, the server sends this message to the recipient through a server-side event. In my opinion, it turned out to be the most compact in comparison with web-sockets solution.

I didn't do the complex handling of connectivity issues with a purpose. No handling for player connection drops, tracking the lag, kicking a flaky player. Just to save more bytes in the build size! I implemented simple timeouts, in case if some player can't connect in 5 seconds, connection drops. If we start connectivity issues for 5 seconds, we drop connection. In this project, I focused on a successful connection scenario only.

## Graphics

I use WebGL with instanced arrays rendering. I took [js13k-2d](https://github.com/kutuluk/js13k-2d) as a basis and gradually mixed the code in and out. Removing everything related to discard-alpha and z-buffer, adding color-offset for the hit effect. Color offset Alpha component is used as factor-parameter to smoothly change blending from `normal` to `additive` (it's a classic technique which premultiplied-alpha allowed).

For more efficient compression, move all GL constants has been moved to manually created `const enum GL`.

Final shader minified with [GLSLX](https://github.com/evanw/glslx).

Initially, blood particles and shells lay on the map and accumulated continuously. That's slowed down the rendering. At some point I decide to turn the map background into the FBO and started drawing the accumulated particles on the surface for completed tics.

I thought of lighting through the grid originally, but then quickly realized that there would be a lot of calculation code. I have no possibility to add another shader for lighting. So I decide to draw light sources into a texture. The light source is generated on the canvas with gradient filled circle into separated texture with linear filtering. We render that texture for each light source with special blending mode, that subtracts alpha from the receiver `blendFunc(GL.ZERO, GL.ONE_MINUS_SRC_ALPHA)`. I draw this texture without filtering on top of everything. The effect of the "fog of war" was obtained and nice squares are notable, which adds the feeling that we are actually calculating the mesh-grid on CPU, as a tile grid.

At game startup I prerender all game sprites in an canvas: simple squares, circles, elements of a virtual joystick, emoji sprites. And then create single atlas for all game objects. I pre-draw all emoji icons on a temporary canvas and then scaling it down into an atlas cell, this was done to achieve greater pixelation of the emoji. To reach the object's hard pixel boundaries I cut semi-transparent values on alpha channel for nearly each sprite.


## Audio

Initially, I took what was always in front of my eyes - [SFXR](https://sfxr.me/) for sound effects and [SoundBox](https://github.com/mbitsnbites/soundbox) for music. Having quickly ported the code to TypeScript and add some sounds and the example music track, I realized that I was already quite limited in size. And I also had to make a simulation of panoramic audio: balance the sound between the left and right output channels, as well as calculate the volume depending on the distance from the sound source.

And right away I threw my energy into optimizing the size of the code and the efficiency of sound data. Did a preprocessing of the parameters for `SFXR` to remove some calculations in the sound generation code, which gave me a good result in terms of code-size.

Anyway, music and sounds prevented me from adding new features, and I tried the library [ZZFX](https://github.com/KilledByAPixel/ZzFX) and [ZZFXM](https://keithclark.github.io/ZzFXM/). Main idea is to use `ZZFX` generated sound as instrument samples, that removes some code duplication. For a long time I tested with `Depp's music track` from the `ZZFXM` examples.

By the end of the project, when I had over-size about ~200 bytes, I plan to write a short powerful track myself, in the tracker, or at least CUT the patterns from the `Depp` music. As a result, I stuck in the tracker for hours, I could not realize any musical ideas. I understood that the music player and the track itself would take about 500 bytes. I didn't have enough space...

It was a panic and I decided to try another approach - procedural music generation using the same `ZZFX` samples. I took a minor scale and began with a bass playing cycle, and as always, help and inspiration came from my beloved wife, at some launch iteration she recognized the bass line as one of the `Justice` track, after that everything fell into place with a rhythmic pattern, then drum snare, kick, hats comes in with variability and delays, then add an Q-filter to the bass line and automated some parameters in a random way. The result is **less than 100 lines of TypeScript code!**

I am very pleased how result sounds. If there more time, then maybe I would add separated second track for splash screen.

Then, at the last moment, I added a simple Welcome message and game process commenter with speech-synthesis API. It also added lovely audio variety.

## Performance

To reduce the build size I almost do not optimize the use of memory and allocations. I create and clone objects massively on every simulation tick. Although this should cause a heavy load on the garbage collector and frame execution time in general, but final game runs at 60 FPS even on modern mobile devices. In the future, I think this can be easily optimized by adding functions that do all this stuff inplace object, another stuff could be placed inside object pools, and so on.

What really needed to be optimized in the first place was to find only visible objects, then sort only visible objects to determine the draw-order.

Unfortunately, collision checking had to be optimized at the very beginning. Instead of naive implementation with a complete enumeration of the object archetype pairs, it was necessary to use spatial hashing. This technique reduces the number of pairs for checking as much as possible. Because we run the simulation one or more ticks per frame - it helped a lot. It also showed that the version with loose-grid is pretty same size comparing with naive variant. Again, unfortunately, this optimization was not included in the final build.

## Code compression

Codebase is focused around modern EcmaScript syntax and its features. Plain types without unnecessary nesting, global variables, plain functions.

All regular tricks are also used. For example:
- Arrays of arrow-functions instead of `switch`
- Arrow functions everywhere (no `function` keyword at all)
- No `class` keyword also.
- `{}` and `[]` literals, clone by deconstruction syntax.
- Optional chaining for properties, methods, indexed access. `arr[i]?.[j].?(args)`
- Re-exports, for example `export const {sin, cos, ...} = Math;`
- Using of undefined array elements `[,,,,,3]`
- Using arrow-function optional arguments instead of declaring `let` in local scope.

Build pipeline:
1. Build TypeScript directly into a javascript bundle using `esbuild`. This includes syntax minification, which, for example, will changes `const` -> `let` (`terser` will not do it). Also there we substitute all defines (as `process.env.NODE_ENV`), and drop out all `console.*` calls.
2. Merge properties between types (see below).
3. Drive code through `terser`.
4. Do Web API hashing (see below).
5. Crash JavaScript code with Roadroller.  
6. Create ZIP archive.
Keep in mind you will need to enable all compression levels to the max for the final build, and hopefully analyze your code changes with exactly this setup. Any code changes are done which decrease size before Roadroller and ZIP could actually increase the final ZIP size.

#### Merge properties between non-overlapped types

TypeScript could set some strict rules about type's properties, we could consider that all types are not used together within an object. If we assign same ordered names across types, terser will choose the same identifiers for them, which in turn reduces the overall vocabulary used in the code. To my surprise, in 2022 there is still no tool that would minify code at the TypeScript level.

#### Web API hashing

We can't rename Web API methods and functions, but we can create alias with shorter names for them before using them. This is a common technique for js13k games and can be implemented from scratch if understood right. All we need to do for this:
1. Get all the properties that we will use for specific classes
2. Calculate SEED in which the abbreviated HASH values will not intersect within each type. 
3. Generate a symbol-dictionary and sort it, taking into account the number of identifier usages in the minified code (after `terser` step).
4. We substitute the dictionary in the final assembly, and rename all encountered usages (it's simple because another props already mangled by `terser`).

## Things I would start from next time

1. Would use [js13k Game Server](https://github.com/js13kGames/js13kserver) from the start because of Server category. I just didn't read the rules at the very beginning and I did not think there was a Special rules for Multiplayer games. However, my server turned out to be so simple and tiny that I didn’t see the point of moving everything to the server sandbox 12 hours before submitting the final project build. Another thing I was worried about was that the game wouldn't work on [js13kgames.com](https://js13kgames.com/) site or submit will not use link to Heroku deployed nodes.
2. I would immediately do a fixed-timestep game loop (remove code for multiplying on delta-time). I would immediately start the game physics in integer coordinate-system (just better for networking packing and determinism normalization flow).
3. It was necessary from the very beginning of the project to integrate the prompt "Use Emoji font?". When everything was ready for me, I was already struggling with the size in stress, because of 3 extra bytes oversize. At such a moment, I don’t want to touch any game code that have already been tested, so I had to revise the initialization code and add additional state to remove one conditional branch.
4. After submitting the project, I changed the collision checking system from naive n^2 object-to-object checking to a loose-grid spatial hashing broad-phase, which turned out to be a very serious optimization for simulating additional predicted tics (when we don’t have enough events from all opponents). In the original project, unfortunately, running too far ahead can lead to low FPS.
5. As you work on the project, it would be necessary to make drafts for the report.


## Features wish-list
- Collect experience points and quick level-up skills 
- Ammo mechanics (finite ammo quantity)
- Reload mechanics (reload time between clips)
- Second weapon slot (to switch active)
- Rocket launcher, grenades, barrel explosions
- Character footprints and more particles
- Laser machine-gun
- Scissors weapon! Like Boomerang with multiple reflections
- Generate tiled map topology for better tactical aspect of the gameplay
- Game rooms. Public and private games. Join to random game room
- Gamepad support

