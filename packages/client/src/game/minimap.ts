import {Actor, ActorType, StateData} from "./types";
import {draw} from "../graphics/draw2d";
import {Img, img} from "../assets/gfx";
import {WORLD_BOUNDS_SIZE} from "../assets/params";
import {clientId} from "../net/messaging";
import {PI} from "../utils/math";
import {actorsConfig, OBJECT_RADIUS} from "./data/world";
import {GAME_CFG} from "./config";
import {fnt} from "../graphics/font";

const getPlayerColor = (player: Actor): number => {
    const config = GAME_CFG._minimap;
    if (!player._client) {
        return config._colors._npc;
    } else if (player._client === clientId) {
        return config._colors._me;
    }
    return config._colors._player;
}

const drawMiniMapList = (x: number, y: number, actors: Actor[] | undefined, color: number, r: number) => {
    if (actors) {
        const config = GAME_CFG._minimap;
        const s = config._markerScale * r / OBJECT_RADIUS;
        const scale = config._size / WORLD_BOUNDS_SIZE;
        for (const actor of actors) {
            let c = color;
            if (actor._type === ActorType.Player) {
                c = getPlayerColor(actor);
            }
            draw(fnt[0]._textureBox,
                x + scale * actor._x,
                y + scale * actor._y,
                PI / 4, s, s, 1, c);
        }
    }
};

export const drawMiniMap = (state: StateData, staticTrees: Actor[], right: number, top: number) => {
    const config = GAME_CFG._minimap;
    const size = config._size;
    const colors = config._colors;
    const x = right - size - 1;
    const y = top + 1;
    draw(img[Img.box_lt], x, y, 0, size, size, colors._backgroundAlpha, colors._background);
    drawMiniMapList(x, y, staticTrees, colors._tree, actorsConfig[ActorType.Tree]._radius);
    drawMiniMapList(x, y, state._actors[ActorType.Barrel], colors._barrel, actorsConfig[ActorType.Barrel]._radius);
    drawMiniMapList(x, y, state._actors[ActorType.Item], colors._item, actorsConfig[ActorType.Item]._radius);
    drawMiniMapList(x, y, state._actors[ActorType.Player], colors._player, actorsConfig[ActorType.Player]._radius);
};