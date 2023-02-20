import {
    Actor,
    ActorType,
    ControlsFlag,
    itemContainsAmmo,
    ItemType,
    packDirByte,
    PlayerActor,
    playerBot,
    sqrDistXY,
    StateData,
    WORLD_BOUNDS_SIZE,
} from "@iioi/bot-api";

const rand = (n: number) => (Math.random() * n) | 0;

const hasAmmo = (player: PlayerActor) => {
    const weapons = playerBot.config?.weapons;
    if (weapons && player._weapon) {
        const weapon = weapons[player._weapon];
        return !weapon.clipSize || player._clipAmmo || player._mags;
    }
    return false;
};

const findClosestActor = <T extends Actor>(
    player: PlayerActor,
    actors: T[],
    pred: (item: T) => boolean,
): T | undefined => {
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
};

playerBot.update = (state: StateData, player: PlayerActor): number => {
    let input = 0;
    const cfg = playerBot.config;
    if (!cfg) {
        return input;
    }
    const actorsConfig = cfg.actors;
    const lowHP = !player._sp && player._hp < 5;
    let nothingToDo = false;
    if (lowHP) {
        const items = state._actors[ActorType.Item];
        const target = findClosestActor(
            player,
            items,
            a => a._subtype === ItemType.Hp || a._subtype === ItemType.Hp2 || a._subtype === ItemType.Shield,
        );
        if (target) {
            const dx = target._x - player._x;
            const dy = target._y - player._y;
            const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
            const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
            input =
                (ld << ControlsFlag.LookAngleBit) |
                (md << ControlsFlag.MoveAngleBit) |
                ControlsFlag.Move |
                ControlsFlag.Run;
        } else {
            nothingToDo = true;
        }
    } else {
        nothingToDo = true;
    }
    if (nothingToDo) {
        nothingToDo = false;
        if (player._weapon) {
            if (hasAmmo(player)) {
                const players = state._actors[ActorType.Player];
                const target = findClosestActor(player, players, a => a !== player);
                if (target) {
                    const dx = target._x - player._x;
                    const dy = target._y - player._y;
                    let move = 0;
                    let shoot = 0;
                    let mx = 0;
                    let my = 0;
                    const weapons = cfg.weapons;
                    const weapon = weapons[player._weapon];
                    const dist = Math.hypot(dx, dy);
                    if (dist < weapon.ai_shootDistanceMin) {
                        mx = -dx;
                        my = -dy;
                        move = ControlsFlag.Move | ControlsFlag.Run;
                    } else if (dist > weapon.ai_shootDistanceMax) {
                        mx = dx;
                        my = dy;
                        move = ControlsFlag.Move | ControlsFlag.Run;
                    } else {
                        shoot = ControlsFlag.Fire;
                    }
                    const md = packDirByte(mx, my, ControlsFlag.MoveAngleMax);
                    const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                    input = (ld << ControlsFlag.LookAngleBit) | (md << ControlsFlag.MoveAngleBit) | move | shoot;
                } else {
                    nothingToDo = true;
                }
            } else {
                const items = state._actors[ActorType.Item];
                const target = findClosestActor(player, items, itemContainsAmmo);
                if (target) {
                    const dx = target._x - player._x;
                    const dy = target._y - player._y;
                    const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
                    const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                    input =
                        (ld << ControlsFlag.LookAngleBit) |
                        (md << ControlsFlag.MoveAngleBit) |
                        ControlsFlag.Move |
                        ControlsFlag.Run;
                } else {
                    nothingToDo = true;
                }
            }
        } else {
            const items = state._actors[ActorType.Item];
            const target = findClosestActor(player, items, a => !!(a._subtype & ItemType.Weapon));
            if (target) {
                const dx = target._x - player._x;
                const dy = target._y - player._y;
                const dist = Math.hypot(dx, dy);
                const md = packDirByte(dx, dy, ControlsFlag.MoveAngleMax);
                const ld = packDirByte(dx, dy, ControlsFlag.LookAngleMax);
                let drop = 0;
                if (
                    dist < actorsConfig[ActorType.Item].radius + actorsConfig[ActorType.Player].radius &&
                    (player._trig & ControlsFlag.DownEvent_Drop) === 0
                ) {
                    drop = ControlsFlag.Drop;
                }
                input =
                    (ld << ControlsFlag.LookAngleBit) |
                    (md << ControlsFlag.MoveAngleBit) |
                    ControlsFlag.Move |
                    ControlsFlag.Run |
                    drop;
            } else {
                nothingToDo = true;
            }
        }
    }
    if (nothingToDo) {
        const md = rand(ControlsFlag.MoveAngleMax);
        input = (md << ControlsFlag.MoveAngleBit) | ControlsFlag.Move;
        input |= ControlsFlag.Run;
        if (!rand(100)) {
            input |= ControlsFlag.Jump;
        }
    }
    return input;
};
