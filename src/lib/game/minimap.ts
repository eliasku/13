import {Actor, ActorType, StateData} from "./types";
import {draw} from "../graphics/draw2d";
import {Img, img} from "../assets/gfx";
import {WORLD_BOUNDS_SIZE} from "../assets/params";
import {clientId} from "../net/messaging";
import {PI} from "../utils/math";
import {parseRGB} from "../utils/utils";
import {OBJECT_RADIUS, OBJECT_RADIUS_BY_TYPE} from "./data/world";

const config = {
    size: 48,
    markerScale: 1,
    colors: {
        me: parseRGB("#fff"),
        player: parseRGB("#f00"),
        npc: parseRGB("#d06"),
        tree: parseRGB("#888"),
        barrel: parseRGB("#07f"),
        item: parseRGB("#0f0"),
        background: parseRGB("#010"),
        backgroundAlpha: 0.6,
    }
};

const getPlayerColor = (player: Actor): number => {
    if (!player.client_) {
        return config.colors.npc;
    } else if (player.client_ === clientId) {
        return config.colors.me;
    }
    return config.colors.player;
}

const drawMiniMapList = (x: number, y: number, actors: Actor[] | undefined, color: number, r: number) => {
    if (actors) {
        const s = config.markerScale * r / OBJECT_RADIUS;
        const scale = config.size / WORLD_BOUNDS_SIZE;
        for (const actor of actors) {
            let c = color;
            if (actor.type_ === ActorType.Player) {
                c = getPlayerColor(actor);
            }
            draw(img[Img.box],
                x + scale * actor.x_,
                y + scale * actor.y_,
                PI / 4, s, s, 1, c);
        }
    }
};

export const drawMiniMap = (state: StateData, staticTrees: Actor[], right: number, top: number) => {
    const size = config.size;
    const colors = config.colors;
    const x = right - size - 1;
    const y = top + 1;
    draw(img[Img.box_lt], x, y, 0, size, size, colors.backgroundAlpha, colors.background);
    drawMiniMapList(x, y, staticTrees, colors.tree, OBJECT_RADIUS_BY_TYPE[ActorType.Tree]);
    drawMiniMapList(x, y, state.actors_[ActorType.Barrel], colors.barrel, OBJECT_RADIUS_BY_TYPE[ActorType.Barrel]);
    drawMiniMapList(x, y, state.actors_[ActorType.Item], colors.item, OBJECT_RADIUS_BY_TYPE[ActorType.Item]);
    drawMiniMapList(x, y, state.actors_[ActorType.Player], colors.player, OBJECT_RADIUS_BY_TYPE[ActorType.Player]);
};