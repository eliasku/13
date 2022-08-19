import {createTexture, Texture} from "../graphics/draw2d";
import {createAudioBuffer} from "../audio/sfxr";
import {createAudioBufferFromSong} from "../audio/soundbox";
import {song} from "../songs/0bit";

export let snd_blip: AudioBuffer | null = null;
export let snd_music: AudioBuffer | null = null;
export let img_players: Texture[] = [];
export let img_box: Texture = null;
export let img_cirle: Texture = null;

function createEmoji(emoji: string) {
    const canvas = document.createElement("canvas");
    const w = 16;
    const h = 20;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", {alpha: true});
    // ctx.strokeStyle = "black";
    // ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = "white";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(emoji, w / 2, 4);
    const img = createTexture(canvas, 0, false, false);
    img.x = 0.5;
    img.y = 0.5;
    canvas.width = canvas.height = 0;
    return img;
}
function createCircle() {
    const canvas = document.createElement("canvas");
    const w = 8;
    const h = 8;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", {alpha: true});
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(4, 4, 3.7, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    const img = createTexture(canvas, 0, false, false);
    img.x = 0.5;
    img.y = 0.5;
    canvas.width = canvas.height = 0;
    return img;
}


export async function loadResources():Promise<any> {
    {
        img_players[0] = createEmoji("💀");
        img_players[1] = createEmoji("👻");
        img_players[2] = createEmoji("😱");
        img_players[3] = createEmoji("👹");
        img_players[4] = createEmoji("😵");
        img_players[5] = createEmoji("🌚");
    }
    snd_blip = createAudioBuffer([2, 0, 0.032, 0.099, 0.0816678, 0.818264, 0, -0.241811, 0, 0.541487, 0.418269, 0, 0, 0, 0, 0, 0.175963, -0.27499, 1, 0, 0, 0.900178, 0]);
    snd_music = createAudioBufferFromSong(song);

    const boxImage = new ImageData(1, 1);
    boxImage.data.fill(0xFF);
    img_box = createTexture(boxImage, 0.5, false, false);
    img_box.x = 0.5;
    img_box.y = 0.5;

    img_cirle = createCircle();

    //return Promise.all(tasks);
}