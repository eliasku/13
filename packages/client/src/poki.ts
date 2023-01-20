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
export const poki = {
    _init: () => {
        console.log("poki init");
        return sdk?.init() ?? Promise.resolve();
    },
    _setDebug: (debugMode: boolean) => {
        console.log("poki set debug mode:", debugMode);
        sdk?.setDebug(debugMode);
    },
    _gameLoadingStart: () => {
        console.log("poki loading start");
        sdk?.gameLoadingStart();
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
    _commercialBreak: () => {
        console.log("poki commercial break");
        return sdk?.commercialBreak() ?? Promise.resolve();
    },
    _rewardedBreak: () => {
        console.log("poki rewarded break");
        return sdk?.rewardedBreak() ?? Promise.resolve(false);
    },
};