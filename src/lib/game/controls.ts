import {inputPointers, keyboardState, KeyCode, mousePointer, Pointer} from "../utils/input";
import {draw, gl} from "../graphics/draw2d";
import {Actor} from "./types";
import {img, Img} from "../assets/gfx";
import {
    PAD_FIRE_RADIUS_0,
    PAD_FIRE_RADIUS_1,
    PAD_MOVE_RADIUS_0,
    PAD_MOVE_RADIUS_1,
    WORLD_SCALE
} from "../assets/params";
import {COLOR_WHITE} from "./data/colors";
import {getScreenScale} from "./game";
import {hypot} from "../utils/math";

// TODO: positioning of controls
// ToDO: control zone padding should include max radius
// TODO: return mouse control
// TODO: combine pad + keyboard

/*
    First 19 bits
    [ ..... LA-LA-LA-LA-LA-LA-LA MA-MA-MA-MA-MA-MA Sp Dr Sh Ju Ru Mo ]

    Next high 13 bits not used
 */
export const enum ControlsFlag {
    Move = 0x1,
    Run = 0x2,
    Jump = 0x4,
    Shooting = 0x8,
    Drop = 0x10,
    Spawn = 0x20,

    // 6-bits for Move angle (64 directions)
    MoveAngleMax = 0x40,
    MoveAngleBit = 6,
    // 7-bits for Look angle (128 directions)
    LookAngleMax = 0x80,
    LookAngleBit = 12,
}

export const gameCamera: number[] = [0, 0, 1];
export let lookAtX = 0;
export let lookAtY = 0;
export let viewX = 0;
export let viewY = 0;
export let shootButtonDown = false;
export let jumpButtonDown = false;
export let moveX = 0;
export let moveY = 0;
export let moveFast = false;
export let dropButton = false;

export const updateControls = (player: Actor) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    const mouse = mousePointer;

    const px = (player.x_) / WORLD_SCALE;
    const py = (player.y_ - player.z_) / WORLD_SCALE - 10;

    if (mouse.x_ >= 0 && mouse.x_ < W && mouse.y_ >= 0 && mouse.y_ < H) {
        lookAtX = (mouse.x_ - W / 2) * gameCamera[2] + gameCamera[0];
        lookAtY = (mouse.y_ - H / 2) * gameCamera[2] + gameCamera[1];
        viewX = lookAtX - px;
        viewY = lookAtY - py;
    } else {
        viewX = 0;
        viewY = 0;
    }

    shootButtonDown = (viewX || viewY) && mouse.active_;

    moveX = (keyboardState[KeyCode.D] | keyboardState[KeyCode.Right])
        - (keyboardState[KeyCode.A] | keyboardState[KeyCode.Left]);
    moveY = (keyboardState[KeyCode.S] | keyboardState[KeyCode.Down])
        - (keyboardState[KeyCode.W] | keyboardState[KeyCode.Up]);

    //if (moveX || moveY) {
    moveFast = !keyboardState[KeyCode.Shift];
    //}

    jumpButtonDown = !!keyboardState[KeyCode.Space];
    dropButton = !!keyboardState[KeyCode.E];

    if (updateVirtualPad()) {
        const k = gameCamera[2];
        let control = vpad[0];
        let pp = control.pointer_;
        moveX = pp ? (pp.x_ - pp.startX_) * k : 0;
        moveY = pp ? (pp.y_ - pp.startY_) * k : 0;
        let len = hypot(moveX, moveY);
        moveFast = len > control.r1_;
        jumpButtonDown = len > control.r2_;

        control = vpad[1];
        pp = control.pointer_;
        viewX = pp ? (pp.x_ - pp.startX_) * k : 0;
        viewY = pp ? (pp.y_ - pp.startY_) * k : 0;
        len = hypot(viewX, viewY);
        lookAtX = px + viewX * 2;
        lookAtY = py + viewY * 2;
        shootButtonDown = len > control.r2_;

        dropButton = !!vpad[2].pointer_;
    }
}

interface VPadControl {
    l_: number;
    t_: number;
    r_: number;
    b_: number;
    isButton_?: number;
    pointer_?: Pointer | undefined;
    // any len > undefined = false (undefined is NaN)
    r1_?: number | undefined;
    r2_?: number | undefined;
}

const vpad: VPadControl[] = [
    {l_: 0, t_: 0.5, r_: 0.5, b_: 1, r1_: PAD_MOVE_RADIUS_0, r2_: PAD_MOVE_RADIUS_1},
    {l_: 0.5, t_: 0.5, r_: 1, b_: 1, r1_: PAD_FIRE_RADIUS_0, r2_: PAD_FIRE_RADIUS_1},
    {l_: 0.5, t_: 0, r_: 1, b_: 0.5, isButton_: 1},
];
let touchPadActive = false;

const checkPointerIsAvailableForCapturing = (pointer: Pointer) =>
    !vpad.some(c => c.pointer_ == pointer);

const testZone = (control: VPadControl, rx: number, ry: number) =>
    rx > control.l_ && rx < control.r_ && ry > control.t_ && ry < control.b_;

const updateVirtualPad = () => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    for (const control of vpad) {
        // if not captured
        if (!control.pointer_) {
            // capture
            for (const [, p] of inputPointers) {
                if (p.downEvent_ &&
                    testZone(control, p.startX_ / W, p.startY_ / H) &&
                    checkPointerIsAvailableForCapturing(p)) {
                    control.pointer_ = p;
                }
            }
        }
        // if captured
        if (control.pointer_) {
            const p = control.pointer_;
            let release = !p.active_;
            // out-of-zone mode
            if (control.isButton_) {
                release ||= !testZone(control, p.x_ / W, p.y_ / H);
            }
            if (release) {
                // release
                control.pointer_ = undefined;
            } else {
                touchPadActive = true;
            }
        }
    }

    if (mousePointer.downEvent_) {
        touchPadActive = [...inputPointers.values()].some(p => p.active_);
        // [...a.values()].some(p=>p.b);
        // for(let [,p] of a) r|=p.v;
    }
    return touchPadActive;
}

export const drawVirtualPad = () => {
    if (!touchPadActive) {
        return;
    }
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const k = 1 / getScreenScale();
    let i = Img.joy0;
    for (const control of vpad) {
        const w_ = W * (control.r_ - control.l_);
        const h_ = H * (control.b_ - control.t_);
        let cx = k * (W * control.l_ + w_ / 2);
        let cy = k * (H * control.t_ + h_ / 2);
        // draw(img[Img.box], cx, cy, 0, w_ * k, h_ * k, 0.1, 0);
        const pp = control.pointer_;
        if (!control.isButton_ && pp) {
            cx = pp.startX_ * k;
            cy = pp.startY_ * k;
            draw(img[Img.circle_16], pp.x_ * k, pp.y_ * k, 0, 1, 1, 0.5);
        }
        draw(img[i], cx, cy, 0, 1, 1, 0.5, pp ? COLOR_WHITE : 0);
        ++i;
    }
}
