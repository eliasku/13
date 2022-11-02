import {Actor, ActorType, ItemType, packDirByte, StateData} from "./types";
import {hypot} from "../utils/math";
import {ControlsFlag} from "./controls";
import {rand} from "../utils/rnd";
import {weapons} from "./data/weapons";

const hasAmmo = (player: Actor) => {
    if (player.weapon_) {
        const weapon = weapons[player.weapon_];
        return !weapon.clipSize_ || player.clipAmmo_ || player.mags_;
    }
    return false;
}

export const updateAI = (state: StateData, player: Actor) => {
    let walking = false;
    if (hasAmmo(player)) {
        const players = state.actors_[ActorType.Player];
        let minDistActor: Actor | null = null;
        let minDist = 100000.0;
        for (const enemy of players) {
            if (enemy === player) {
                continue;
            }
            const dist = hypot(enemy.x_ - player.x_, enemy.y_ - player.y_);
            if (dist < minDist) {
                minDistActor = enemy;
                minDist = dist;
            }
        }
        if (minDistActor) {
            let dx = minDistActor.x_ - player.x_;
            let dy = minDistActor.y_ - player.y_;
            let move = 0;
            let shoot = 0;
            let mx = 0;
            let my = 0;
            const weapon = weapons[player.weapon_];
            if (minDist < weapon.ai_shootDistanceMin_) {
                mx = -dx;
                my = -dy;
                move = ControlsFlag.Move | ControlsFlag.Run;
            } else if (minDist > weapon.ai_shootDistanceMax_) {
                mx = dx;
                my = dy;
                move = ControlsFlag.Move | ControlsFlag.Run;
            } else {
                shoot = ControlsFlag.Shooting;
            }
            const md = packDirByte(mx, my, ControlsFlag.MoveAngleMax);
            const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
            player.btn_ = (ld << ControlsFlag.LookAngleBit) |
                (md << ControlsFlag.MoveAngleBit) |
                move | shoot;
        } else {
            walking = true;
        }
    } else {
        const items = state.actors_[ActorType.Item];
        let minDistActor: Actor | null = null;
        let minDist = 100000.0;
        for (const item of items) {
            if (item.btn_ === ItemType.Ammo || item.mags_) {
                const dist = hypot(item.x_ - player.x_, item.y_ - player.y_);
                if (dist < minDist) {
                    minDistActor = item;
                    minDist = dist;
                }
            }
        }
        if (minDistActor) {
            let dx = minDistActor.x_ - player.x_;
            let dy = minDistActor.y_ - player.y_;
            const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
            const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
            player.btn_ = (ld << ControlsFlag.LookAngleBit) |
                (md << ControlsFlag.MoveAngleBit) |
                ControlsFlag.Move | ControlsFlag.Run;
        } else {
            walking = true;
        }
    }
    if (walking) {
        const md = rand(ControlsFlag.MoveAngleMax);
        player.btn_ = (md << ControlsFlag.MoveAngleBit) | ControlsFlag.Move;
        if (!player.sp_) {
            if (!rand(30) && player.hp_ < 7) {
                player.btn_ |= ControlsFlag.Jump;
            }
            if (player.hp_ < 10) {
                player.btn_ |= ControlsFlag.Run
            }
        }
    }
    if (!player.sp_ && player.hp_ < 5) {
        player.btn_ |= ControlsFlag.Drop | ControlsFlag.Run;
    }
}