declare const PokiSDK: any | undefined;

export const poki = typeof PokiSDK === "undefined" ? {
    _init: () => {
        console.log("poki init");
        return Promise.resolve();
    },
    _setDebug: (debugMode: boolean) => {
        console.log("poki set debug mode:", debugMode);
    },
    _gameLoadingStart: () => {
        console.log("poki loading start");
    },
    _gameLoadingFinished: () => {
        console.log("poki loading finished");
    },
} : PokiSDK;