import {M} from "./math";

const enum Hash {
    Seed = 48639327,
    Mod = 427,
}

const l3 = (i: number, a = "################################") => a[i % 32] + (i < 32 ? [] : a[i >> 5]);

const h2 = (str: string, seed = Hash.Seed, mod = Hash.Mod, _c?: string) => {
    for (_c of str) {
        seed = (M.imul(seed, 23131) + _c.charCodeAt(0)) >>> 0;
    }
    return seed % mod;
}

export const rehash = <T extends object>(obj: T): T => {
    // if (process.env.NODE_ENV === "development") {
    //     (window as any).REHASH_FIELDS ??= {};
    //     const name = obj.constructor.name;
    //     for (let i in obj) {
    //         if (i[4] && i[0] > "`") {
    //             (window as any).REHASH_FIELDS[name] ??= [];
    //             (window as any).REHASH_FIELDS[name].push(i);
    //         }
    //     }
    //     return;
    // }

    for (const i in obj) {
        if (i[4] && i[0] > "`") {
            Reflect.defineProperty(obj, l3(h2(i)), {
                get(): any {
                    return this[i];
                },
                set(v: any) {
                    this[i] = v;
                },
            });
        }
    }
    return obj;
}

if (0 && process.env.NODE_ENV === "development") {

    (window as any).getProps = () => {
        console.info(JSON.stringify((window as any).REHASH_FIELDS));
    };

    // const h2_ = (str: number[], seed: number, mod: number) => {
    //     for (let i = 0, n = str.length; i < n; ++i) {
    //         seed = (M.imul(seed, 23131) + str[i]) >>> 0;
    //     }
    //     return seed % mod;
    // }
    //
    // //"clientX", "clientY", "label","close", "open",
    // const filter: string[] = ["clear", "state", "flush", "delete", "get", "has", "set", "filter", "map", "fill", "length"];
    // let hasher_state: Record<string, number[][]> = {};
    // const addToHashGenerator = <T>(obj: T): T => {
    //     if (!hasher_state[obj.constructor.name]) {
    //         console.log("add instance to hash map " + obj.constructor.name);
    //         const props: number[][] = [];
    //         for (let i in obj) {
    //             if (i[0] > '`' && i[4]) {
    //                 props.push([...i].map(x => x.charCodeAt(0)));
    //                 console.log(obj.constructor.name + " : " + i);
    //             }
    //         }
    //         hasher_state[obj.constructor.name] = props;
    //     }
    //     return obj;
    // }
    // addToHashGenerator(AudioContext.prototype);
    // addToHashGenerator(WebGLRenderingContext.prototype);
    // addToHashGenerator(CanvasRenderingContext2D.prototype);
    // addToHashGenerator(CanvasGradient.prototype);
    // addToHashGenerator(KeyboardEvent.prototype);
    // addToHashGenerator(MouseEvent.prototype);
    // addToHashGenerator(TouchEvent.prototype);
    // addToHashGenerator(Touch.prototype);
    // addToHashGenerator(EventSource.prototype);
    // addToHashGenerator(RTCPeerConnection.prototype);
    // addToHashGenerator(RTCDataChannel.prototype);
    //
    // let seed = Hash.Seed;
    // // let mod = 513;//Hash.Mod;
    // let mod = Hash.Mod;
    // let st = new Set;
    //
    // const types = Object.values(hasher_state);
    // const seedHasCollisions = (seed: number, mod: number) => {
    //     for (const props of types) {
    //         st.clear();
    //         for (let i = 0, n = props.length; i < n; ++i) {
    //             const f = h2_(props[i], seed, mod);
    //             if (!st.has(f)) {
    //                 st.add(f);
    //                 //console.warn(typename + ": " + f + " vs " + i);
    //             } else {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }
    //
    // while (mod <= Hash.Mod) {
    //     console.info("Start mod: 0x" + mod.toString(16));
    //     let attempts = 0;
    //     let found = true;
    //     // _SEEDS[1] = +new Date >>> 0;
    //     // seed = nextInt(1);
    //     const maxIters = 0x80000;
    //     while (seedHasCollisions(seed, mod)) {
    //         seed = nextInt(1);
    //         if (++attempts > maxIters) {
    //             found = false;
    //             break;
    //         }
    //     }
    //     if (found) {
    //         const remap = {} as any;
    //         for (let props of types) {
    //             for (const prop of props) {
    //                 const f = String.fromCharCode(...prop);
    //                 if (filter.indexOf(f) < 0) {
    //                     remap[f] = l3(h2_(prop, seed, mod));
    //                 }
    //             }
    //         }
    //         console.info("Found on iteration: " + attempts);
    //         console.info("SEED = " + seed);
    //         console.info("MOD = " + mod);
    //         console.info(JSON.stringify(remap));
    //     }
    //
    //     ++mod;
    //     while (!(mod & 1)) {
    //         ++mod;
    //     }
    // }
}
