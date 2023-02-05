import {Setting, settings} from "../game/settings.js";

export function setupRAF(callback: (now: DOMHighResTimeStamp) => void) {
    let then = performance.now();
    const animateLoop = (now: DOMHighResTimeStamp) => {
        requestAnimationFrame(animateLoop);
        const frameRateCap = settings[Setting.FrameRateCap];
        if (frameRateCap > 0) {
            // https://gist.github.com/addyosmani/5434533
            const delta = now - then;
            const tolerance = 0.1;
            const interval = 1000 / frameRateCap;
            if (delta >= interval - tolerance) {
                then = now - (delta % interval);
                callback(now);
            }
        } else {
            then = now;
            callback(now);
        }
    };
    requestAnimationFrame(animateLoop);
}
