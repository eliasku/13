import {dec1, hypot, max, min} from "@iioi/client/utils/math.js";
import {gl} from "@iioi/client/graphics/draw2d.js";
import {GAME_CFG} from "@iioi/client/game/config.js";
import {WeaponConfig} from "@iioi/client/game/data/weapons.js";
import {WORLD_SCALE} from "@iioi/client/assets/params.js";

const camera0 = [0, 0, 1, 0, 0, 0, 0];

export const gameCamera: number[] = [0, 0, 1];

// 0...50
export let cameraShake = 0;

// 0...5
export let cameraFeedback = 0;
export let cameraFeedbackX = 0;
export let cameraFeedbackY = 0;

export const saveGameCamera = () => {
    camera0[0] = gameCamera[0];
    camera0[1] = gameCamera[1];
    camera0[2] = gameCamera[2];
    camera0[3] = cameraShake;
    camera0[4] = cameraFeedback;
    camera0[5] = cameraFeedbackX;
    camera0[6] = cameraFeedbackY;
};

export const restoreGameCamera = () => {
    gameCamera[0] = camera0[0];
    gameCamera[1] = camera0[1];
    gameCamera[2] = camera0[2];
    cameraShake = camera0[3];
    cameraFeedback = camera0[4];
    cameraFeedbackX = camera0[5];
    cameraFeedbackY = camera0[6];
};

export const decCameraEffects = () => {
    cameraShake = dec1(cameraShake);
    cameraFeedback = dec1(cameraFeedback);
};

export const feedbackCameraShot = (weapon: WeaponConfig, dx: number, dy: number) => {
    cameraShake = max(cameraShake, weapon._cameraShake);
    const feedback = 20 * weapon._cameraFeedback;
    cameraFeedbackX = feedback * dx;
    cameraFeedbackY = feedback * dy;
    cameraFeedback += 3;
};

export const feedbackCameraExplosion = (shake: number, x: number, y: number) => {
    shake *= 1 - hypot(gameCamera[0] - x / WORLD_SCALE, gameCamera[1] - y / WORLD_SCALE) / 256;
    console.log(shake);
    cameraShake = max(cameraShake, shake | 0);
};

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / GAME_CFG._camera._size;
