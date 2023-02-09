import {dec1, max, min} from "@iioi/client/utils/math.js";
import {gl} from "@iioi/client/graphics/draw2d.js";
import {GAME_CFG} from "@iioi/client/game/config.js";

const camera0 = [0, 0, 1, 0, 0];

export const gameCamera: number[] = [0, 0, 1];

// 0...50
export let cameraShake = 0;

// 0...5
export let cameraFeedback = 0;

export const saveGameCamera = () => {
    camera0[0] = gameCamera[0];
    camera0[1] = gameCamera[1];
    camera0[2] = gameCamera[2];
    camera0[3] = cameraShake;
    camera0[4] = cameraFeedback;
};

export const restoreGameCamera = () => {
    gameCamera[0] = camera0[0];
    gameCamera[1] = camera0[1];
    gameCamera[2] = camera0[2];
    cameraShake = camera0[3];
    cameraFeedback = camera0[4];
};

export const decCameraEffects = () => {
    cameraShake = dec1(cameraShake);
    cameraFeedback = dec1(cameraFeedback);
};

export const setCameraEffects = (shake: number, feedback: number) => {
    cameraShake = max(cameraShake, shake);
    cameraFeedback += feedback;
};

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / GAME_CFG._camera._size;
