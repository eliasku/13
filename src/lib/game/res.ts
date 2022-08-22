import {createTexture, getSubTexture, Texture} from "../graphics/draw2d";
import {createAudioBuffer} from "../audio/sfxr";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";

export let snd_blip: AudioBuffer | null = null;
export let snd_music: AudioBuffer | null = null;

export let img_atlas: Texture;
export let img_players: Texture[] = [];
export let img_barrels: Texture[] = [];
export let img_trees: Texture[] = [];
export let img_weapons: Texture[] = [];

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
    // let y1 = 1;
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
        ctx.font = emojiSize + "px sans";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, x + w_ / 2, y + h_ / 2);
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

    `💀,👹,😵,🌚,🛢️,📦,🗡,🔪,🔫`.split(",").map(createEmoji);
    emojiSize = 28;
    "🌳,🌲".split(",").map(createEmoji);

    let sprites: Texture[] = [];
    img_atlas = createTexture(canvas, 0, false, false);
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
    "💊,💔,❤️,💙,💛,💜,💗,💖,💕,♡,♥,💕,❤";
    "🔥,☁️,☠,🗡,🔪,🔫,🚀,⭐,🌟";
    "★,☆,✢,✥,✦,✧,❂,❉,✯,✰,⋆,✪";

    const sprites = createAtlas();
    let idx = 0;
    img_box = sprites[idx++];
    img_cirle = sprites[idx++];
    img_players.push(sprites[idx++], sprites[idx++], sprites[idx++], sprites[idx++]);
    img_barrels.push(sprites[idx++], sprites[idx++]);
    img_weapons.push(sprites[idx++], sprites[idx++], sprites[idx++]);
    img_trees.push(sprites[idx++], sprites[idx++]);
}

function createAudio() {
    snd_blip = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
    snd_music = createAudioBufferFromSong(song);
}

export function loadResources() {
    createImages();
    createAudio();
}