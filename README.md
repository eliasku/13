# ☋ 13 ☋

Fast-paced multiplayer top-down shooting game for [js13k 2022 competition](https://js13kgames.com/)

## Minimal requirements

- **Good, low-latency network connection** is required for each playing client
- **Fast mobile device or desktop** to not lag other clients
- `NodeJS` 16 or higher is required for server
- WebAudio `AudioContext` support is required (available from Safari iOS 14.5, April 2021)
- WebGL context and instanced arrays ANGLE extension are required
- Modern JS syntax support
- Checked in the latest Chrome, Safari, Firefox on iOS, Android and Mac.

## Resources

Code for Music generation in runtime created by [author](https://twitter.com/eliaskuvoice). Some instrument samples are picked from [ZzFXM](https://keithclark.github.io/ZzFXM/) example song `Depp`

Emoji Font [Twemoji Mozilla](https://github.com/mozilla/twemoji-colr/releases) is used for cross-platform emoji rendering. Game is able to work without `e.ttf` file, but some icons are incorrect rotation angle, or different at all. But game should be playable anyway.

2D graphics rendering is started from [js13k-2d](https://github.com/kutuluk/js13k-2d) and highly rewritten for what I need.

Sound Effects - [ZZFX](https://github.com/KilledByAPixel/ZzFX).

## Build compression

Shaders are minified in TypeScript source code by [GLSLX - online minifier](https://evanw.github.io/glslx/)

1. [esbuild]() creates bundle from TypeScript source-code
2. Merge and rename properties which are non-overlapping in scope of Type.
3. [terser]() is used to minify and mangle javascript files
4. Rehash properties for selected Web API classes (`WebGLRenderingContext`, `CanvasRenderingContext2D`, `AudioContext`, etc)
5. Pack client with [RoadRoller](https://github.com/lifthrasiir/roadroller) is used for final compression
6. Zip with [AdvanceCOMP](https://www.advancemame.it/comp-readme.html)

