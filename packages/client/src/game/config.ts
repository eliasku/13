import {parseRGB} from "../utils/utils.js";

export const Const = {
    NetFq: 60,
    InputDelay: 8,
    PredictionMax: 8,
    Prediction: 1,
} as const;
export type Const = (typeof Const)[keyof typeof Const];

export let _debugLagK = 0;

export const setDebugLagK = (a: number) => (_debugLagK = a);

export const GAME_CFG = {
    _npc: [
        {
            _initWeaponLen: 1,
            _period: 12,
            _max: 0,
        },
        {
            _initWeaponLen: 3,
            _period: 11,
            _max: 4,
        },
        {
            _initWeaponLen: 4,
            _period: 10,
            _max: 8,
        },
        {
            // allow all weapons?
            // initWeaponLen: 10,
            _initWeaponLen: 4,
            _period: 8,
            _max: 16,
        },
    ],
    _items: {
        // should be < (2 ** 8)
        // div by 3
        // (10 * Const.NetFq) / 3 => 200
        _lifetime: 200,
    },
    _barrels: {
        _initCount: 32,
        _hp: [3, 7],
        _dropWeapon: {
            _chance: 70,
            _min: 4,
        },
    },
    _walls: {
        _initCount: 64,
    },
    _trees: {
        _initCount: 64,
    },
    _camera: {
        // base resolution
        _size: 256,
        _listenerRadius: 256,
        _baseScale: 1.1,
        _inGameMenuScale: 0.5,
    },
    _player: {
        // initial values for player's spawn
        _hp: 10,
        _sp: 0,
        _mags: 1,
        _jumpVel: 80,
        _runVel: 120,
        _walkVel: 60,
    },
    _world: {
        _gravity: 5,
        _gravityWeak: 3,
    },
    _minimap: {
        _size: 48,
        _markerScale: 1,
        _colors: {
            _me: parseRGB("#fff"),
            _player: parseRGB("#f00"),
            _npc: parseRGB("#d06"),
            _tree: parseRGB("#888"),
            _barrel: parseRGB("#07f"),
            _item: parseRGB("#0f0"),
            _background: parseRGB("#010"),
            _backgroundAlpha: 0.6,
        },
    },
    _bodyColor: [
        parseRGB("#FF99DD"),
        parseRGB("#FFCC99"),
        parseRGB("#CCFF99"),
        parseRGB("#222222"),
        parseRGB("#8855FF"),
        parseRGB("#CCCCCC"),
    ],
    _voice: {
        _killAB: ["{0} CRUSHED {1}", "{0} destroyed {1}", "{0} killed {1}", "{0} took {1} life"],
        _killNPC: ["warm-up for {0}", "{0} killed someone", "death by {0}", "{0} sows DEATH"],
    },
};
