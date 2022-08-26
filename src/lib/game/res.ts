import {createTexture, getSubTexture, Texture} from "../graphics/draw2d";
import {createAudioBuffer} from "../audio/sfxr";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";
import {toRad} from "../utils/math";

export let snd_blip: AudioBuffer | null = null;
export let snd_pick: AudioBuffer | null = null;
export let snd_heal: AudioBuffer | null = null;
export let snd_med: AudioBuffer | null = null;
export let snd_shoot: AudioBuffer | null = null;
export let snd_music: AudioBuffer | null = null;

export let img_atlas: Texture;
export let img_players: Texture[] = [];
export let img_barrels: Texture[] = [];
export let img_trees: Texture[] = [];
export let img_weapons: Texture[] = [];
export let img_items: Texture[] = [];

export let img_box: Texture;
export let img_circle_4: Texture;
export let img_circle_16: Texture;

export function createCanvas(size: number, alpha: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    return canvas.getContext("2d", {alpha});
}

function createAtlas(): Texture[] {
    const tempSize = 512;
    const atlasSize = 256;

    const temp = createCanvas(tempSize, true);
    const atlas = createCanvas(atlasSize, true);
    atlas.fillStyle = "#FFF";
    let x = 1;
    let y = 1;
    let x1 = 1;
    let maxHeight = 0;
    let coords: number[] = [];

    const pushSprite = (w: number, h: number) => {
        x = x1;
        x1 = x + w + 1;
        if (x1 + 1 >= atlasSize) {
            y += 1 + maxHeight;
            maxHeight = h;
            x = 1;
            x1 = x + w + 1;
        }
        if (h > maxHeight) maxHeight = h;
        coords.push(x, y, w, h);
    };

    const createEmoji2 = (emoji: string, ox: number, oy: number, w: number, h: number, size: number, a: number, sx: number, sy: number, cut: number) => {
        const scaleUp = 8;
        const emojiSize = (size * scaleUp) | 0;
        temp.clearRect(0, 0, tempSize, tempSize);
        temp.font = emojiSize + "px emoji";
        temp.textAlign = "center";
        temp.textBaseline = "middle";
        temp.translate(tempSize / 2, tempSize / 2);
        temp.rotate(toRad(a ?? 0));
        temp.scale(sx ?? 1, sy ?? 1);
        temp.fillText(emoji, 0, 0);
        temp.resetTransform();
        const alphaThreshold = cut ?? 0x80;
        const scale = 1 / scaleUp;
        pushSprite(w, h);
        // atlas.imageSmoothingEnabled = false;
        atlas.scale(scale, scale);
        atlas.translate(-ox, -oy);
        atlas.drawImage(temp.canvas, (1 + x) / scale, (1 + y) / scale);
        atlas.resetTransform();
        // atlas.imageSmoothingEnabled = true;
        const bmp = atlas.getImageData(x, y, w, h);
        for (let i = 0; i < bmp.data.length; i += 4) {
            let a = bmp.data[i + 3];
            if (a >= alphaThreshold) {
                bmp.data[i + 3] = 0xFF;
            } else {
                bmp.data[i] = 0;
                bmp.data[i + 1] = 0;
                bmp.data[i + 2] = 0;
                bmp.data[i + 3] = 0;
            }
        }
        atlas.putImageData(bmp, x, y);
    }

    const createCircle = (r: number) => {
        const s = r * 2;
        pushSprite(s, s);
        atlas.beginPath();
        atlas.arc(x + r, y + r, r * 0.925, 0, Math.PI * 2);
        atlas.closePath();
        atlas.fill();
    }
    // BOX
    pushSprite(1, 1);
    atlas.fillRect(x, y, 1, 1);
    // CIRCLE
    createCircle(4);
    createCircle(16);

    createEmoji2("💀", 198, 166, 17, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("👹", 192, 166, 19, 18, 16, undefined, undefined, undefined, undefined);
    createEmoji2("😵", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🌚", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("😷", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🤡", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("👨", 203, 166, 16, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🤖", 192, 166, 19, 18, 16, undefined, undefined, undefined, undefined);
    createEmoji2("💩", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🎃", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🤓", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("😡", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🤢", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🦝", 192, 172, 19, 17, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🐙", 192, 166, 19, 18, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🦑", 201, 166, 16, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("🍏", 203, 166, 16, 19, 16, undefined, undefined, undefined, undefined);
    createEmoji2("😾", 192, 166, 19, 19, 16, undefined, undefined, undefined, undefined);

    createEmoji2("🔪", 180, 234, 19, 7, 12, -50, undefined, undefined, undefined);
    createEmoji2("🔨", 193, 189, 20, 13, 16, 44.5, -1, undefined, undefined);
    createEmoji2("🪓", 198, 210, 20, 10, 16, 45, -1, undefined, undefined);
    createEmoji2("🗡", 156, 204, 24, 12, 16, -45, -1, undefined, undefined);
    createEmoji2("🔫", 208, 198, 15, 12, 12, undefined, -1, undefined, undefined);
    createEmoji2("🖊️", 157, 211, 24, 8, 16, -45, -1, undefined, undefined);
    createEmoji2("✏️️", 186, 216, 23, 8, 16, 44.5, -1, undefined, undefined);
    createEmoji2("🪥", 175, 261, 20, 8, 16, 45, undefined, -1, undefined);
    createEmoji2("⛏", 196, 216, 21, 17, 16, 135, undefined, undefined, undefined);

    createEmoji2("🛢", 203, 144, 16, 23, 20, undefined, undefined, undefined, undefined);
    createEmoji2("📦", 193, 144, 18, 22, 20, undefined, undefined, undefined, undefined);
    createEmoji2("🪦", 176, 144, 23, 23, 20, undefined, undefined, undefined, undefined);

    createEmoji2("💊", 216, 200, 13, 13, 10, undefined, undefined, undefined, undefined);
    createEmoji2("❤️", 208, 194, 15, 13, 12, undefined, undefined, undefined, undefined);

    createEmoji2("🌳", 156, 99, 28, 31, 28, undefined, undefined, undefined, 136);
    createEmoji2("🌲", 162, 99, 26, 31, 28, undefined, undefined, undefined, 136);

    let sprites: Texture[] = [];
    img_atlas = createTexture(atlas.canvas);
    for (let i = 0; i < coords.length;) {
        sprites.push(getSubTexture(img_atlas, coords[i++], coords[i++], coords[i++], coords[i++]));
    }

    // TODO: dispose
    atlas.canvas.width = atlas.canvas.height = temp.canvas.width = temp.canvas.height = 0;

    // document.body.appendChild(atlas.canvas);
    // atlas.canvas.style.position = "fixed";
    // atlas.canvas.style.top = "0";
    // atlas.canvas.style.left = "0";
    return sprites;
}

function createImages() {
    "💊,💔,🤍,❤️,🖤,💟,💙,💛,🧡,🤎,💜,💗,💖,💕,♡,♥,💕,❤";
    "🩸🧻";
    // 🧱 looks like ammo particle
    // 🪦 when player died
    // 📏 also good shell alternative yellow color
    "🔥,☁️,☠,🔨,⛏️,🗡,🔪,🔫,🚀,⭐,🌟";
    "★,☆,✢,✥,✦,✧,❂,❉,✯,✰,⋆,✪";

    const sprites = createAtlas();
    let idx = 0;
    img_box = sprites[idx++];
    img_circle_4 = sprites[idx++];
    img_circle_16 = sprites[idx++];
    for (let i = 0; i < 18; ++i) {
        img_players.push(sprites[idx++]);
    }

    img_weapons.push(undefined);
    for (let i = 0; i < 9; ++i) {
        img_weapons.push(sprites[idx++]);
    }
    img_weapons[1].x = 0.3;
    img_weapons[2].x = 0.3;
    img_weapons[3].x = 0.3;
    img_weapons[4].x = 0.3;
    img_weapons[5].x = 0.3;

    for (let i = 0; i < 3; ++i) {
        img_barrels.push(sprites[idx++]);
    }
    img_barrels[0].y = 0.95;
    img_barrels[1].y = 0.85;
    img_barrels[2].y = 0.95;

    for (let i = 0; i < 2; ++i) {
        img_items.push(sprites[idx++]);
    }
    for (let i = 0; i < 2; ++i) {
        img_trees.push(sprites[idx++]);
    }
    img_trees[0].y = 0.95;
    img_trees[1].y = 0.95;
}

function createAudio() {
    snd_med = snd_heal = snd_pick = snd_blip = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
    snd_shoot = createAudioBuffer([0, 0, 0.257585, 0, 0.229939, 0.846236, 0.0561515, -0.611704, 0, 0, 0, 0, 0, 0.775923, -0.102723, 0, 0, 0, 1, 0, 0, 0.028879, 0]);
    snd_music = createAudioBufferFromSong(song);
}

export function loadResources() {
    createImages();
    createAudio();
}