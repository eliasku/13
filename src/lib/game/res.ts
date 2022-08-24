import {createTexture, getSubTexture, Texture} from "../graphics/draw2d";
import {createAudioBuffer} from "../audio/sfxr";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";

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
export let img_cirle: Texture;

function createAtlas(): Texture[] {
    const canvas = document.createElement("canvas");
    const SIZE = 256;
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d", {alpha: true});
    let x = 1;
    let y = 1;
    let x1 = 1;
    let maxHeight = 0;
    let coords: number[] = [];

    ctx.fillStyle = "#FFF";

    const pushSprite = (w: number, h: number) => {
        x = x1;
        x1 += w;
        if (x1 + 1 >= SIZE) {
            y += 1 + maxHeight;
            maxHeight = h;
            x = 1;
            x1 = w + 1;
        }
        if (h > maxHeight) maxHeight = h;
        coords.push(x, y, w, h, 0.5, 0.5);
    };

    let emojiSize = 14;
    const createEmoji = (emoji: string) => {
        const w_ = emojiSize + 4; // 14->16
        const h_ = emojiSize + 6; // 14 -> 20
        pushSprite(w_, h_);
        ctx.font = emojiSize + "px emoji";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const comp = 1 + (emojiSize / 5);
        const ty = y + (h_ / 2 + comp) | 0;
        // ctx.fillStyle = "white";
        ctx.fillText(emoji, x + (w_ >>> 1), ty);

        // ctx.fillStyle = "rgba(255,255,255,0.5)";
        // ctx.fillRect(x, ty, w_, 1);
        // ctx.fillRect(x, y, w_, 1);
        // ctx.fillRect(x, y + h_ - 1, w_, 1);

        const bmp = ctx.getImageData(x, y, w_, h_);
        for (let i = 0; i < bmp.data.length; i += 4) {
            let a = bmp.data[i + 3] / 0xFF;
            if (a > 0.5) {
                bmp.data[i + 3] = 0xFF;
                // bmp.data[i + 2] /= a;
                // bmp.data[i + 1] /= a;
                // bmp.data[i + 0] /= a;
            } else {
                bmp.data[i + 3] = 0;
                bmp.data[i + 2] = 0;
                bmp.data[i + 1] = 0;
                bmp.data[i + 0] = 0;
            }
        }
        ctx.putImageData(bmp, x, y);
    }

    // BOX
    pushSprite(1, 1);
    ctx.fillRect(x, y, 1, 1);
    // CIRCLE
    pushSprite(8, 8);
    ctx.beginPath();
    ctx.arc(x + 4, y + 4, 3.7, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    emojiSize = 14;
    `💀,👹,😵,🌚,😷,🤡,👨🏻,🤖,💩,🎃,🤓,😡,🤢,🦝,🐙,🦑,🍏,😾`.split(",").map(createEmoji);
    emojiSize = 20;
    `🛢️,📦`.split(",").map(createEmoji);

    emojiSize = 10;
    createEmoji("🔪");
    emojiSize = 16;
    createEmoji("🔨");
    createEmoji("⛏");
    createEmoji("🗡");
    emojiSize = 12;
    createEmoji("🔫");

    `💊,❤️`.split(",").map(createEmoji);
    emojiSize = 28;
    "🌳,🌲".split(",").map(createEmoji);

    let sprites: Texture[] = [];
    img_atlas = createTexture(canvas);
    for (let i = 0; i < coords.length;) {
        sprites.push(getSubTexture(img_atlas, coords[i++], coords[i++], coords[i++], coords[i++], coords[i++], coords[i++]));
    }

    canvas.width = canvas.height = 0;
    // document.body.appendChild(canvas);
    // canvas.style.position = "fixed";
    // canvas.style.top = "0";
    // canvas.style.left = "0";
    return sprites;
}

function createImages() {
    "💊,💔,❤️,🖤,💙,💛,💜,💗,💖,💕,♡,♥,💕,❤";
    "🔥,☁️,☠,🔨,⛏️,🗡,🔪,🔫,🚀,⭐,🌟";
    "★,☆,✢,✥,✦,✧,❂,❉,✯,✰,⋆,✪";

    const sprites = createAtlas();
    let idx = 0;
    img_box = sprites[idx++];
    img_cirle = sprites[idx++];
    for (let i = 0; i < 11 + 7; ++i) {
        img_players.push(sprites[idx++]);
    }
    img_barrels.push(sprites[idx++], sprites[idx++]);
    img_barrels[0].y = 0.95;
    img_barrels[1].y = 0.85;
    img_weapons.push(sprites[idx++], sprites[idx++], sprites[idx++], sprites[idx++], sprites[idx++]);
    img_weapons[0].x = 0.3;
    img_weapons[0].y = 0.3;

    img_weapons[1].x = 0.7;
    img_weapons[1].y = 0.7;
    img_weapons[2].x = 0.7;
    img_weapons[2].y = 0.7;

    img_weapons[3].x = 0.7;
    img_weapons[3].y = 0.3;

    img_weapons[4].x = 0.6;
    img_weapons[4].y = 0.5;

    img_items.push(sprites[idx++], sprites[idx++]);
    img_trees.push(sprites[idx++], sprites[idx++]);
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