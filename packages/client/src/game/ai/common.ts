import {Actor, PlayerActor} from "../types";
import {WORLD_BOUNDS_SIZE} from "../../assets/params";
import {sqrDistXY} from "../phy";
import {weapons} from "../data/weapons";

export const hasAmmo = (player: PlayerActor) => {
    if (player._weapon) {
        const weapon = weapons[player._weapon];
        return !weapon._clipSize || player._clipAmmo || player._mags;
    }
    return false;
}

export const findClosestActor = <T extends Actor>(player: PlayerActor, actors: T[], pred: (item: T) => boolean): T | undefined => {
    let minDistActor: T | undefined;
    let minDistSqr = WORLD_BOUNDS_SIZE * WORLD_BOUNDS_SIZE;
    for (const a of actors) {
        if (pred(a)) {
            const distSqr = sqrDistXY(player, a);
            if (distSqr < minDistSqr) {
                minDistActor = a;
                minDistSqr = distSqr;
            }
        }
    }
    return minDistActor;
}