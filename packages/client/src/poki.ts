declare const PokiSDK: {
    init(): Promise<void>;
    setDebug(debugMode: boolean): void;
    gameLoadingStart(): void;
    gameLoadingFinished(): void;
} | undefined;

const sdk: any | undefined = typeof PokiSDK === "undefined" ? PokiSDK : undefined;
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
};