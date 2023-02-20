import {Actor, ActorType, PlayerActor, StateData} from "./types.js";
import {draw} from "../graphics/draw2d.js";
import {img} from "../assets/gfx.js";
import {WORLD_BOUNDS_SIZE, OBJECT_RADIUS} from "../assets/params.js";
import {clientId} from "../net/messaging.js";
import {PI} from "../utils/math.js";
import {GAME_CFG} from "./config.js";
import {fnt} from "../graphics/font.js";
import {Img} from "../assets/img.js";

const getPlayerColor = (player: PlayerActor): number => {
    const config = GAME_CFG.minimap;
    if (!player._client) {
        return config.colors.npc;
    } else if (player._client === clientId) {
        return config.colors.me;
    }
    return config.colors.player;
};

const drawMiniMapList = (x: number, y: number, actors: Actor[] | undefined, color: number, r: number) => {
    if (actors) {
        const config = GAME_CFG.minimap;
        const s = (config.markerScale * r) / OBJECT_RADIUS;
        const scale = config.size / WORLD_BOUNDS_SIZE;
        for (const actor of actors) {
            let c = color;
            if (actor._type === ActorType.Player) {
                c = getPlayerColor(actor as PlayerActor);
            }
            draw(fnt[0]._textureBox, x + scale * actor._x, y + scale * actor._y, PI / 4, s, s, 1, c);
        }
    }
};

export const drawMiniMap = (state: StateData, staticTrees: Actor[], right: number, top: number) => {
    const config = GAME_CFG.minimap;
    const size = config.size;
    const colors = config.colors;
    const x = right - size - 1;
    const y = top + 1;
    draw(img[Img.box_lt], x, y, 0, size, size, colors.backgroundAlpha, colors.background);
    drawMiniMapList(x, y, staticTrees, colors.tree, GAME_CFG.actors[ActorType.Tree].radius);
    drawMiniMapList(x, y, state._actors[ActorType.Barrel], colors.barrel, GAME_CFG.actors[ActorType.Barrel].radius);
    drawMiniMapList(x, y, state._actors[ActorType.Item], colors.item, GAME_CFG.actors[ActorType.Item].radius);
    drawMiniMapList(x, y, state._actors[ActorType.Player], colors.player, GAME_CFG.actors[ActorType.Player].radius);
};
