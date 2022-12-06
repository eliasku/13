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
    const config = GAME_CFG.minimap;
    if (!player.client_) {
        return config.colors.npc;
    } else if (player.client_ === clientId) {
        return config.colors.me;
    }
    return config.colors.player;
}

const drawMiniMapList = (x: number, y: number, actors: Actor[] | undefined, color: number, r: number) => {
    if (actors) {
        const config = GAME_CFG.minimap;
        const s = config.markerScale * r / OBJECT_RADIUS;
        const scale = config.size / WORLD_BOUNDS_SIZE;
        for (const actor of actors) {
            let c = color;
            if (actor.type_ === ActorType.Player) {
                c = getPlayerColor(actor);
            }
            draw(fnt[0].textureBox,
                x + scale * actor.x_,
                y + scale * actor.y_,
                PI / 4, s, s, 1, c);
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
    drawMiniMapList(x, y, staticTrees, colors.tree, actorsConfig[ActorType.Tree].radius);
    drawMiniMapList(x, y, state.actors_[ActorType.Barrel], colors.barrel, actorsConfig[ActorType.Barrel].radius);
    drawMiniMapList(x, y, state.actors_[ActorType.Item], colors.item, actorsConfig[ActorType.Item].radius);
    drawMiniMapList(x, y, state.actors_[ActorType.Player], colors.player, actorsConfig[ActorType.Player].radius);
};