import {ActorType, ControlsFlag, ItemType, packDirByte, PlayerActor, StateData} from "../types";
import {hypot} from "../../utils/math";
import {rand} from "../../utils/rnd";
import {weapons} from "../data/weapons";
import {actorsConfig} from "../data/world";
import {itemContainsAmmo} from "../actors";
import {findClosestActor, hasAmmo} from "./common";


export const updateAI = (state: StateData, player: PlayerActor) => {
    let lowHP = !player._sp && player._hp < 5;
    let walking = false;
    if (lowHP) {
        const items = state._actors[ActorType.Item];
        const target = findClosestActor(player, items, (a) =>
            a._subtype === ItemType.Hp || a._subtype === ItemType.Hp2 || a._subtype === ItemType.Shield);
        if (target) {
            let dx = target._x - player._x;
            let dy = target._y - player._y;
            const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
            const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
            player._input = (ld << ControlsFlag.LookAngleBit) |
                (md << ControlsFlag.MoveAngleBit) |
                ControlsFlag.Move | ControlsFlag.Run;
        } else {
            walking = true;
        }
    } else {
        if (player._weapon) {
            if (hasAmmo(player)) {
                const players = state._actors[ActorType.Player];
                const target = findClosestActor(player, players, (a) => a !== player);
                if (target) {
                    let dx = target._x - player._x;
                    let dy = target._y - player._y;
                    let move = 0;
                    let shoot = 0;
                    let mx = 0;
                    let my = 0;
                    const weapon = weapons[player._weapon];
                    const dist = hypot(dx, dy);
                    if (dist < weapon._ai_shootDistanceMin) {
                        mx = -dx;
                        my = -dy;
                        move = ControlsFlag.Move | ControlsFlag.Run;
                    } else if (dist > weapon._ai_shootDistanceMax) {
                        mx = dx;
                        my = dy;
                        move = ControlsFlag.Move | ControlsFlag.Run;
                    } else {
                        shoot = ControlsFlag.Fire;
                    }
                    const md = packDirByte(mx, my, ControlsFlag.MoveAngleMax);
                    const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                    player._input = (ld << ControlsFlag.LookAngleBit) |
                        (md << ControlsFlag.MoveAngleBit) |
                        move | shoot;
                } else {
                    walking = true;
                }

            } else {
                const items = state._actors[ActorType.Item];
                const target = findClosestActor(player, items, itemContainsAmmo);
                if (target) {
                    let dx = target._x - player._x;
                    let dy = target._y - player._y;
                    const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
                    const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                    player._input = (ld << ControlsFlag.LookAngleBit) |
                        (md << ControlsFlag.MoveAngleBit) |
                        ControlsFlag.Move | ControlsFlag.Run;
                } else {
                    walking = true;
                }
            }
        } else {
            const items = state._actors[ActorType.Item];
            const target = findClosestActor(player, items, (a) =>
                !!(a._subtype & ItemType.Weapon));
            if (target) {
                let dx = target._x - player._x;
                let dy = target._y - player._y;
                const dist = hypot(dx, dy);
                const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
                const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                let drop = 0;
                if (dist < actorsConfig[ActorType.Item]._radius + actorsConfig[ActorType.Player]._radius &&
                    !(player._trig & ControlsFlag.DownEvent_Drop)) {
                    drop = ControlsFlag.Drop;
                }
                player._input = (ld << ControlsFlag.LookAngleBit) |
                    (md << ControlsFlag.MoveAngleBit) |
                    ControlsFlag.Move | ControlsFlag.Run | drop;
            } else {
                walking = true;
            }
        }
    }
    if (walking) {
        const md = rand(ControlsFlag.MoveAngleMax);
        player._input = (md << ControlsFlag.MoveAngleBit) | ControlsFlag.Move;
        if (!player._sp) {
            if (!rand(30) && player._hp < 7) {
                player._input |= ControlsFlag.Jump;
            }
            if (player._hp < 10) {
                player._input |= ControlsFlag.Run
            }
        }
    }
    if (lowHP) {
        player._input |= ControlsFlag.Drop | ControlsFlag.Run;
    }
}
