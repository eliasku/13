import {Actor, ActorType, StateData} from "./types";
import {draw} from "../graphics/draw2d";
import {Img, img} from "../assets/gfx";
import {WORLD_BOUNDS_SIZE} from "../assets/params";
import {clientId} from "../net/messaging";
import {PI} from "../utils/math";

const miniMapSize = 48;
const markerScale = 0.6;
const drawMiniMapList = (x: number, y: number, actors: Actor[] | undefined, color: number) => {
    if (actors) {
        const scale = miniMapSize / WORLD_BOUNDS_SIZE;
        for (const actor of actors) {
            let c = color;
            if (actor.type_ === ActorType.Player && actor.client_ === clientId) {
                c = 0xFFFFFF;
            }
            draw(img[Img.box],
                x + scale * actor.x_,
                y + scale * actor.y_,
                PI / 4, markerScale, markerScale, 1, c);
        }
    }
};

export const drawMiniMap = (state: StateData, staticTrees: Actor[], right: number, top: number) => {
    const x = right - miniMapSize - 1;
    const y = top + 1;
    draw(img[Img.box_lt], x, y, 0, miniMapSize, miniMapSize, 0.6, 0x001100);
    drawMiniMapList(x, y, staticTrees, 0x888888);
    drawMiniMapList(x, y, state.actors_[ActorType.Barrel], 0x0000FF);
    drawMiniMapList(x, y, state.actors_[ActorType.Item], 0x00FF00);
    drawMiniMapList(x, y, state.actors_[ActorType.Player], 0xFF0000);
};