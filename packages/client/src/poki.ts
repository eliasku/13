import {audioContext, audioMaster} from "./audio/context";

declare const PokiSDK: {
    init(): Promise<void>;
    setDebug(debugMode: boolean): void;
    gameLoadingStart(): void;
    gameLoadingFinished(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    commercialBreak(): Promise<void>;
    rewardedBreak(): Promise<boolean>;
} | undefined;

const sdk: typeof PokiSDK | undefined = typeof PokiSDK !== "undefined" ? PokiSDK : undefined;
let adblock = false;
export const poki = {
    _init: async () => {
        console.log("poki init");
        if (sdk) {
            await sdk.init().then(() => {
                console.log("Poki SDK successfully initialized");
            }).catch(() => {
                adblock = true;
                console.log("Initialized, but the user likely has adblock");
            });
            sdk.setDebug(process.env.NODE_ENV === "development");
            sdk.gameLoadingStart();
        }
    },
    _gameLoadingFinished: () => {
        console.log("poki loading finished");
        sdk?.gameLoadingFinished();
    },
    _gameplayStart: () => {
        console.log("poki gameplay start");
        sdk?.gameplayStart();
    },
    _gameplayStop: () => {
        console.log("poki gameplay stop");
        sdk?.gameplayStop();
    },
    _commercialBreak: async () => {
        console.log("poki commercial break");
        if (adblock) {
            console.warn("skip commercial ads cuz user may has adblock");
            return;
        }
        if (sdk) {
            audioMaster.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.0);
            try {
                await sdk.commercialBreak();
            } catch (err) {
                console.warn("poki commercial break error: ", err);
            }
            audioMaster.gain.linearRampToValueAtTime(1, audioContext.currentTime + 1.0);
        }
    },
    _rewardedBreak: async () => {
        console.log("poki rewarded break");
        if (adblock) {
            console.warn("skip rewarded video cuz user may has adblock");
            return false;
        }
        let rewarded = false;
        if (sdk) {
            audioMaster.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.0);
            try {
                rewarded = await sdk.rewardedBreak();
            } catch (err) {
                console.warn("poki commercial break error: ", err);
            }
            audioMaster.gain.linearRampToValueAtTime(1, audioContext.currentTime + 1.0);
        }
        return rewarded;
    },
};