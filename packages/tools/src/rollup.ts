import {nodeResolve} from "@rollup/plugin-node-resolve";
import sourcemaps from "rollup-plugin-sourcemaps";
import terser from "@rollup/plugin-terser";
import {Options} from "rollup-plugin-esbuild";
import esbuild from "rollup-plugin-esbuild";
import alias from "@rollup/plugin-alias";
import dts from "rollup-plugin-dts";
import {typescriptPaths} from "rollup-plugin-typescript-paths";
import {
    OutputOptions,
    rollup,
    RollupBuild,
    RollupOptions,
    RollupWatcherEvent,
    RollupWatchOptions,
    watch as rollupWatch,
} from "rollup";
import {getCompileDefines} from "./common.js";

interface BuildOptions {
    input: string;
    output: string;

    // esbuild
    tsconfig: string;
    platform?: "node" | "browser";
    target?: "node16" | "es2020";

    debug?: boolean; // false
    keepConsole?: boolean; // false
    keepProps?: boolean; // false (!debug also)
    skipTerser?: boolean;
    disableAnalytics?: boolean;

    serverUrl?: string;

    dts?: boolean;
}

const esbuild_ = (options: BuildOptions) => {
    const config: Options = {
        minify: !options.debug,
        define: getCompileDefines(options.debug ?? false, options.serverUrl ?? ""),
        target: options.target ?? "es2020",
        platform: options.platform ?? "browser",
        format: "esm",
        tsconfig: options.tsconfig,
        sourceMap: true,
        drop: [],
    };
    if (!options.debug) {
        config.drop = ["debugger"];
        if (!options.keepConsole) {
            config.drop.push("console");
        }
    }
    return esbuild(config);
};

const getRollupInput = (options: BuildOptions): RollupOptions => {
    return {
        input: options.input,
        plugins: [
            sourcemaps(),
            nodeResolve(),
            typescriptPaths({
                tsConfigPath: "tsconfig.base.json",
                preserveExtensions: true,
            }),
            options.disableAnalytics ? alias({
                entries: [{find: /^(.*)analytics\.js$/, replacement: '$1analytics-poki.js'}]
            }) : undefined,
            esbuild_(options),
            options.debug || options.skipTerser
                ? undefined
                : terser({
                    toplevel: true,
                    module: false,
                    ecma: 2020,
                    compress: {
                        booleans_as_integers: true,
                        unsafe_arrows: true,
                        passes: 10000,
                        keep_fargs: false,
                        hoist_funs: true,
                        // hoist_vars: true,
                        pure_getters: true,
                        dead_code: true,
                        // pure_funcs: pureFunc,
                        unsafe_methods: true,
                        inline: 3,
                        expression: true,
                        unsafe_math: true,
                        unsafe: true,
                    },
                    format: {
                        wrap_func_args: false,
                        inline_script: false,
                        comments: false,
                    },
                    mangle: options.keepProps
                        ? undefined
                        : {
                            properties: {
                                regex: /^_[a-z]/,
                            },
                        },
                }),
        ],
    };
};

const getRollupOutput = (options: BuildOptions): OutputOptions => ({
    file: options.output,
    format: "es",
    sourcemap: true,
});

export const build = async (options: BuildOptions) => {
    const inputOptions = getRollupInput(options);
    const outputOptions = getRollupOutput(options);
    const bundle = await rollup(inputOptions);
    // an array of file names this bundle depends on
    // console.log(bundle.watchFiles);
    await generateOutputs(bundle, outputOptions);
    if (bundle) {
        // closes the bundle
        await bundle.close();
    }

    if (options.dts) {
        const bundle = await rollup({
            input: options.input,
            plugins: [
                dts({
                    tsconfig: "tsconfig.base.json",
                }),
            ],
        });
        if (bundle) {
            const filename = options.output.replace(".js", ".d.ts");
            await bundle.write({
                file: filename,
                format: "es",
            });
            console.info(filename);
            await bundle.close();
        }
    }
};

export const watch = (options: BuildOptions): Promise<void> => {
    const inputOptions = getRollupInput(options);
    const outputOptions = getRollupOutput(options);
    const watchOptions: RollupWatchOptions = {
        ...inputOptions,
        output: [outputOptions],
    };
    let isReady = false;
    return new Promise((resolve, reject) => {
        const watcher = rollupWatch(watchOptions);
        watcher.on("event", async (ev: RollupWatcherEvent) => {
            // console.log("watcher " + ev.code.toLocaleLowerCase().replaceAll("_", " "));
            switch (ev.code) {
                case "START":
                    if (isReady) {
                        console.info("👀Rebuild: " + outputOptions.file);
                    }
                    break;
                case "ERROR":
                    if (ev.result) {
                        await ev.result.close();
                    }
                    console.info("ERROR", ev.error);
                    reject(ev.error);
                    break;
                case "BUNDLE_END":
                    if (ev.result) {
                        await ev.result.write(outputOptions);
                        console.info("💾Saved: " + outputOptions.file);
                        await ev.result.close();
                    }
                    break;
                case "END":
                    if (!isReady) {
                        isReady = true;
                        resolve();
                    }
                    console.info("👍Updated: " + outputOptions.file);
                    break;
            }
        });
        watcher.on("close", () => {
            resolve();
        });
    });
};

const generateOutputs = async (bundle: RollupBuild, outputOptions: OutputOptions) => {
    // generate output specific code in-memory
    // you can call this function multiple times on the same bundle object
    // replace bundle.generate with bundle.write to directly write to disk
    // const {output} = await bundle.generate(outputOptions);
    const {output} = await bundle.write(outputOptions);

    for (const chunkOrAsset of output) {
        if (chunkOrAsset.type === "asset") {
            // For assets, this contains
            // {
            //   fileName: string,              // the asset file name
            //   source: string | Uint8Array    // the asset source
            //   type: 'asset'                  // signifies that this is an asset
            // }
            console.log("Asset", chunkOrAsset.fileName);
        } else {
            // For chunks, this contains
            // {
            //   code: string,                  // the generated JS code
            //   dynamicImports: string[],      // external modules imported dynamically by the chunk
            //   exports: string[],             // exported variable names
            //   facadeModuleId: string | null, // the id of a module that this chunk corresponds to
            //   fileName: string,              // the chunk file name
            //   implicitlyLoadedBefore: string[]; // entries that should only be loaded after this chunk
            //   imports: string[],             // external modules imported statically by the chunk
            //   importedBindings: {[imported: string]: string[]} // imported bindings per dependency
            //   isDynamicEntry: boolean,       // is this chunk a dynamic entry point
            //   isEntry: boolean,              // is this chunk a static entry point
            //   isImplicitEntry: boolean,      // should this chunk only be loaded after other chunks
            //   map: string | null,            // sourcemaps if present
            //   modules: {                     // information about the modules in this chunk
            //     [id: string]: {
            //       renderedExports: string[]; // exported variable names that were included
            //       removedExports: string[];  // exported variable names that were removed
            //       renderedLength: number;    // the length of the remaining code in this module
            //       originalLength: number;    // the original length of the code in this module
            //       code: string | null;       // remaining code in this module
            //     };
            //   },
            //   name: string                   // the name of this chunk as used in naming patterns
            //   referencedFiles: string[]      // files referenced via import.meta.ROLLUP_FILE_URL_<id>
            //   type: 'chunk',                 // signifies that this is a chunk
            // }
            console.log("Chunk", chunkOrAsset.fileName);
        }
    }
};
