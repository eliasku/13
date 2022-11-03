import {Actor, ActorType, ItemType, packDirByte, StateData} from "./types";
import {hypot} from "../utils/math";
import {ControlsFlag} from "./controls";
import {rand} from "../utils/rnd";
import {weapons} from "./data/weapons";
import {sqrDistXY} from "./phy";
import {WORLD_BOUNDS_SIZE} from "../assets/params";
import {OBJECT_RADIUS_BY_TYPE} from "./data/world";

const hasAmmo = (player: Actor) => {
    if (player.weapon_) {
        const weapon = weapons[player.weapon_];
        return !weapon.clipSize_ || player.clipAmmo_ || player.mags_;
    }
    return false;
}

const findClosestActor = (player: Actor, actors: Actor[], pred: (item: Actor) => boolean): Actor | null => {
    let minDistActor: Actor | null = null;
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

export const updateAI = (state: StateData, player: Actor) => {
    let walking = false;
    if (player.weapon_) {
        if (hasAmmo(player)) {
            const players = state.actors_[ActorType.Player];
            const target = findClosestActor(player, players, (a) => a !== player);
            if (target) {
                let dx = target.x_ - player.x_;
                let dy = target.y_ - player.y_;
                let move = 0;
                let shoot = 0;
                let mx = 0;
                let my = 0;
                const weapon = weapons[player.weapon_];
                const dist = hypot(dx, dy);
                if (dist < weapon.ai_shootDistanceMin_) {
                    mx = -dx;
                    my = -dy;
                    move = ControlsFlag.Move | ControlsFlag.Run;
                } else if (dist > weapon.ai_shootDistanceMax_) {
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
            const target = findClosestActor(player, items, (a) =>
                a.btn_ === ItemType.Ammo || a.mags_ > 0);
            if (target) {
                let dx = target.x_ - player.x_;
                let dy = target.y_ - player.y_;
                const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
                const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                player.btn_ = (ld << ControlsFlag.LookAngleBit) |
                    (md << ControlsFlag.MoveAngleBit) |
                    ControlsFlag.Move | ControlsFlag.Run;
            } else {
                walking = true;
            }
        }
    } else {
        const items = state.actors_[ActorType.Item];
        const target = findClosestActor(player, items, (a) =>
            !!(a.btn_ & ItemType.Weapon));
        if (target) {
            let dx = target.x_ - player.x_;
            let dy = target.y_ - player.y_;
            const dist = hypot(dx, dy);
            const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
            const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
            let drop = 0;
            if(dist < OBJECT_RADIUS_BY_TYPE[ActorType.Item] + OBJECT_RADIUS_BY_TYPE[ActorType.Player] &&
                !(player.trig_ & ControlsFlag.DownEvent_Drop)) {
                drop = ControlsFlag.Drop;
            }
            player.btn_ = (ld << ControlsFlag.LookAngleBit) |
                (md << ControlsFlag.MoveAngleBit) |
                ControlsFlag.Move | ControlsFlag.Run | drop;
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