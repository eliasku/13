import {Actor, ActorType, BulletActor, ItemActor, ItemType, PlayerActor} from "./types";
import {rand} from "../utils/rnd";
import {GAME_CFG} from "./config";
import {ANIM_HIT_OVER} from "./data/world";
import {ClientID} from "@eliasku/13-shared/src/types";

export const newActor = (type: ActorType): Actor =>
    ({
        _id: 0,

        _type: type,
        _subtype: 0,

        _x: 0,
        _y: 0,
        _z: 0,

        _u: 0,
        _v: 0,
        _w: 0,

        _s: 0,

        _anim0: rand(0x100),
        _animHit: 31,
        _hp: 1,
        _sp: 0,

        _fstate: 0,
    });

export const newPlayerActor = (): PlayerActor => Object.assign(newActor(ActorType.Player), {
    _client: 0,
    _input: 0,
    _trig: 0,
    _detune: 0,
    _weapon: 0,
    _weapon2: 0,
    _clipAmmo: 0,
    _clipAmmo2: 0,
    _clipReload: 0,
    _mags: 0,
});

export const newItemActor = (subtype: number): ItemActor => {
    const item = newActor(ActorType.Item) as ItemActor;
    item._subtype = subtype;
    item._s = GAME_CFG._items._lifetime;
    item._animHit = ANIM_HIT_OVER;
    item._itemWeapon = 0;
    item._itemWeaponAmmo = 0;
    return item;
}

export const itemContainsAmmo = (item:ItemActor) => (item._subtype & ItemType.SubTypeMask) === ItemType.Ammo;

export const newBulletActor = (ownerId: ClientID, subtype: number, damage: number): BulletActor => Object.assign(newActor(ActorType.Bullet), {
    _ownerId: ownerId,
    _damage: damage,
    _subtype: subtype,
});
