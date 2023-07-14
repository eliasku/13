import {inputPointers, keyboardState, KeyCode, mousePointer, Pointer} from "../utils/input.js";
import {fillCircle, strokeCircle, gl} from "../graphics/draw2d.js";
import {PlayerActor} from "./types.js";
import {
    PAD_FIRE_RADIUS_0,
    PAD_FIRE_RADIUS_1,
    PAD_MOVE_RADIUS_0,
    PAD_MOVE_RADIUS_1,
    WORLD_SCALE,
} from "../assets/params.js";
import {gameCamera, getScreenScale} from "./camera.js";
import {hypot} from "../utils/math.js";
import {drawTextAligned, fnt} from "../graphics/font.js";
import {GAME_CFG} from "./config.js";

// TODO: positioning of controls
// ToDO: control zone padding should include max radius
// TODO: return mouse control
// TODO: combine pad + keyboard
export let lookAtX = 0;
export let lookAtY = 0;
export let viewX = 0;
export let viewY = 0;
export let moveX = 0;
export let moveY = 0;
export let shootButtonDown = false;
export let jumpButtonDown = false;
export let moveFast = false;
export let dropButton = false;
export let reloadButton = false;
export let swapButton = false;

export const resetPlayerControls = () => {
    moveX = 0;
    moveY = 0;
    shootButtonDown = false;
    jumpButtonDown = false;
    moveFast = false;
    dropButton = false;
    reloadButton = false;
    swapButton = false;
};

export const couldBeReloadedManually = (player: PlayerActor): boolean => {
    const weapons = GAME_CFG.weapons;
    const weapon = weapons[player._weapon];
    return weapon && !player._clipReload && weapon.clipSize && player._clipAmmo < weapon.clipSize;
};

export const couldSwapWeaponSlot = (player: PlayerActor): boolean => {
    return !!player._weapon2;
};

export const updateControls = (player: PlayerActor) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    const mouse = mousePointer;

    const px = player._x / WORLD_SCALE;
    const py = (player._y - player._z) / WORLD_SCALE - 10;

    if (mouse._x >= 0 && mouse._x < W && mouse._y >= 0 && mouse._y < H) {
        lookAtX = (mouse._x - W / 2) * gameCamera._scale + gameCamera._x;
        lookAtY = (mouse._y - H / 2) * gameCamera._scale + gameCamera._y;
        viewX = lookAtX - px;
        viewY = lookAtY - py;
    } else {
        viewX = 0;
        viewY = 0;
    }

    shootButtonDown = (viewX || viewY) && mouse._active;

    moveX =
        (keyboardState[KeyCode.D] | keyboardState[KeyCode.Right]) -
        (keyboardState[KeyCode.A] | keyboardState[KeyCode.Left]);
    moveY =
        (keyboardState[KeyCode.S] | keyboardState[KeyCode.Down]) -
        (keyboardState[KeyCode.W] | keyboardState[KeyCode.Up]);

    //if (moveX || moveY) {
    moveFast = !keyboardState[KeyCode.Shift];
    //}

    jumpButtonDown = !!keyboardState[KeyCode.Space];
    dropButton = !!keyboardState[KeyCode.E];
    reloadButton = !!keyboardState[KeyCode.R];
    swapButton = !!keyboardState[KeyCode.Q];

    vpad[3]._hidden = !couldBeReloadedManually(player);
    vpad[4]._hidden = !couldSwapWeaponSlot(player);
    if (updateVirtualPad()) {
        const k = gameCamera._scale;
        let control = vpad[0];
        let pp = control._pointer;
        moveX = pp ? (pp._x - pp._startX) * k : 0;
        moveY = pp ? (pp._y - pp._startY) * k : 0;
        let len = hypot(moveX, moveY);
        moveFast = len > control._r1;
        jumpButtonDown = len > control._r2;

        control = vpad[1];
        pp = control._pointer;
        viewX = pp ? (pp._x - pp._startX) * k : 0;
        viewY = pp ? (pp._y - pp._startY) * k : 0;
        len = hypot(viewX, viewY);
        lookAtX = px + viewX * 2;
        lookAtY = py + viewY * 2;
        shootButtonDown = len > control._r2;

        dropButton = !!vpad[2]._pointer;
        reloadButton = !!vpad[3]._pointer;
        swapButton = !!vpad[4]._pointer;
    }
};

interface VPadControl {
    _l: number;
    _t: number;
    _r: number;
    _b: number;
    _isButton?: number;
    _pointer?: Pointer | undefined;
    _hidden?: boolean;
    // any len > undefined = false (undefined is NaN)
    _r1?: number | undefined;
    _r2?: number | undefined;
    _text1?: string;
    _text2?: string;
}

const vpad: VPadControl[] = [
    {_l: 0, _t: 0.5, _r: 0.5, _b: 1, _r1: PAD_MOVE_RADIUS_0, _r2: PAD_MOVE_RADIUS_1, _text1: "RUN", _text2: "JUMP"},
    {_l: 0.5, _t: 0.5, _r: 1, _b: 1, _r1: PAD_FIRE_RADIUS_0, _r2: PAD_FIRE_RADIUS_1, _text1: "AIM", _text2: "FIRE"},
    {_l: 0.5, _t: 0.25, _r: 0.66, _b: 0.5, _isButton: 1, _r1: 16, _text1: "DROP"},
    {_l: 0.66, _t: 0.25, _r: 0.82, _b: 0.5, _isButton: 1, _r1: 16, _text1: "RELOAD"},
    {_l: 0.82, _t: 0.25, _r: 1, _b: 0.5, _isButton: 1, _r1: 16, _text1: "SWAP"},
];
let touchPadActive = false;

const checkPointerIsAvailableForCapturing = (pointer: Pointer) => !vpad.some(c => c._pointer == pointer);

const testZone = (control: VPadControl, rx: number, ry: number) =>
    rx > control._l && rx < control._r && ry > control._t && ry < control._b;

const updateVirtualPad = () => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    for (const control of vpad) {
        // if not captured
        if (!control._pointer) {
            // capture
            for (const [, p] of inputPointers) {
                if (
                    p._downEvent &&
                    testZone(control, p._startX / W, p._startY / H) &&
                    checkPointerIsAvailableForCapturing(p)
                ) {
                    control._pointer = p;
                }
            }
        }
        // if captured
        if (control._pointer) {
            const p = control._pointer;
            let release = !p._active;
            // out-of-zone mode
            if (control._isButton) {
                release ||= !testZone(control, p._x / W, p._y / H);
            }
            if (release) {
                // release
                control._pointer = undefined;
            } else {
                touchPadActive = true;
            }
        }
    }

    if (mousePointer._downEvent) {
        touchPadActive = [...inputPointers.values()].some(p => p._active);
        // [...a.values()].some(p=>p.b);
        // for(let [,p] of a) r|=p.v;
    }
    return touchPadActive;
};

export const drawVirtualPad = () => {
    if (!touchPadActive) {
        return;
    }
    const boxTexture = fnt[0]._textureBox;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const k = 1 / getScreenScale();
    const segments1 = 12;
    const segments2 = 16;
    for (const control of vpad) {
        if (!control._hidden) {
            const w_ = W * (control._r - control._l);
            const h_ = H * (control._b - control._t);
            let cx = k * (W * control._l + w_ / 2);
            let cy = k * (H * control._t + h_ / 2);
            const pp = control._pointer;
            if (!control._isButton && pp) {
                cx = pp._startX * k;
                cy = pp._startY * k;
                fillCircle(boxTexture, pp._x * k, pp._y * k, 16, segments1, 1, 1, 0.5);
            }
            if (control._r1 !== undefined) {
                drawTextAligned(fnt[0], control._text1, 8, cx, cy - control._r1 - 4, pp ? 0xffffff : 0x777777);
                strokeCircle(boxTexture, cx, cy, control._r1 - 2, 4, segments1, 1, 1, 0.5, pp ? 0xffffff : 0);
            }
            if (control._r2 !== undefined) {
                drawTextAligned(fnt[0], control._text2, 8, cx, cy - control._r2 - 4, pp ? 0xffffff : 0x777777);
                strokeCircle(boxTexture, cx, cy, control._r2 - 2, 4, segments2, 1, 1, 0.5, pp ? 0xffffff : 0);
            }
        }
    }
};
