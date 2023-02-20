import {dec1, hypot, max, min} from "@iioi/client/utils/math.js";
import {gl} from "@iioi/client/graphics/draw2d.js";
import {GAME_CFG} from "@iioi/client/game/config.js";
import {WORLD_SCALE} from "@iioi/client/assets/params.js";
import {WeaponConfig} from "../data/config.js";

export const getScreenScale = () => min(gl.drawingBufferWidth, gl.drawingBufferHeight) / GAME_CFG.camera.size;

export interface GameCamera {
    _x: number;
    _y: number;
    _scale: number;
    // 0...50
    _shake: number;
    // 0...5
    _feedback: number;
    _feedbackX: number;
    _feedbackY: number;
}

const newGameCamera = () => ({
    _x: 0,
    _y: 0,
    _scale: 1,
    _shake: 0,
    _feedback: 0,
    _feedbackX: 0,
    _feedbackY: 0,
});

const copyGameCamera = (dest: GameCamera, src: GameCamera) => {
    dest._x = src._x;
    dest._y = src._y;
    dest._scale = src._scale;
    dest._shake = src._shake;
    dest._feedback = src._feedback;
    dest._feedbackX = src._feedbackX;
    dest._feedbackY = src._feedbackY;
};

export const gameCamera = newGameCamera();
const camera0 = newGameCamera();

export const saveGameCamera = () => copyGameCamera(camera0, gameCamera);

export const restoreGameCamera = () => copyGameCamera(gameCamera, camera0);

export const decCameraEffects = () => {
    gameCamera._shake = dec1(gameCamera._shake);
    gameCamera._feedback = dec1(gameCamera._feedback);
};

export const feedbackCameraShot = (weapon: WeaponConfig, dx: number, dy: number) => {
    gameCamera._shake = max(gameCamera._shake, weapon.cameraShake);
    const feedback = 20 * weapon.cameraFeedback;
    gameCamera._feedbackX = feedback * dx;
    gameCamera._feedbackY = feedback * dy;
    gameCamera._feedback += 3;
};

export const feedbackCameraExplosion = (shake: number, x: number, y: number) => {
    shake *= 1 - hypot(gameCamera._x - x / WORLD_SCALE, gameCamera._y - y / WORLD_SCALE) / 256;
    gameCamera._shake = max(gameCamera._shake, shake | 0);
};
