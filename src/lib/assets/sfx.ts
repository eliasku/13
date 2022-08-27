import {createAudioBuffer} from "../audio/sfxr";

export const enum Snd {
    blip = 0,
    heal = 0,
    med = 0,
    pick = 0,
    shoot = 1,
}

export const snd:AudioBuffer[] = [];

export function loadSounds() {
    snd.push(
        createAudioBuffer([1,0,1276,0,2327,2117.522705,2562.460205,0.999894,0,0,0,1,20032,0.337,0.000005,0,0,0,0.004071,1.000039,0.070354,0.007453,0.9997]),
        createAudioBuffer([3,0,1768,0.168,5712,179.36705,84165.90625,1.000782,0,0,0,1,20032,0.285285,0.000027,0,-109.735664,0.154449,0.037015,1.000015,0.158115,0.000688,1]),
    );
}
