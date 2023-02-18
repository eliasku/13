import {Actor} from "@iioi/client/game/types.js";
import {snd, Snd} from "@iioi/client/assets/sfx.js";
import {GAME_CFG} from "@iioi/client/game/config.js";
import {WORLD_SCALE} from "@iioi/client/assets/params.js";
import {gameCamera} from "@iioi/client/game/camera.js";
import {clamp, hypot} from "@iioi/client/utils/math.js";
import {play} from "@iioi/client/audio/context.js";
import {game} from "@iioi/client/game/gameState.js";

export const playAt = (actor: Actor, id: Snd) => {
    if (game._gameTic > game._lastAudioTic) {
        const r = GAME_CFG._camera._listenerRadius;
        const dx = (actor._x / WORLD_SCALE - gameCamera._x) / r;
        const dy = (actor._y / WORLD_SCALE - gameCamera._y) / r;
        const v = 1 - hypot(dx, dy);
        if (v > 0) {
            play(snd[id], v, clamp(dx, -1, 1));
        }
    }
};
