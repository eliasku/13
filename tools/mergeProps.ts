import {readFileSync, writeFileSync} from "fs";
import {InterfaceDeclaration, Project, SyntaxKind} from "ts-morph";


export const mergeProps = (tsConfigFilePath: string, file: string, dest: string) => {
    const project = new Project({tsConfigFilePath});
    const getProps = (str: InterfaceDeclaration, out: string[]) => {
        str.getBaseDeclarations().map(base => {
            base.isKind(SyntaxKind.InterfaceDeclaration);
            getProps(base.asKind(SyntaxKind.InterfaceDeclaration), out);
        });
        out.push(...str.getStructure().properties.map(p => p.name));
    };
    let archetypes: string[][] = [];
    project.getSourceFiles().forEach(src => src.forEachDescendant(node => {
        if (node.getKind() === SyntaxKind.InterfaceDeclaration) {
            const p: string[] = [];
            getProps(node.asKind(SyntaxKind.InterfaceDeclaration), p);
            archetypes.push(p);
        }
    }));

    let src = readFileSync(file, "utf8");
    const getIDRegex = (from: string) => new RegExp("([^\\w_$]|^)(" + from + ")([^\\w_$]|$)", "gm");
    const _rename = new Map();
    let alphaSize = 0;

    const getAlphaID = (i: number) => `$${i}_`;
    const isRenamable = (id: string) => id.length > 1 && id.at(-1) === "_";

    function addType(fields: string[]) {

        const usedIds = new Set();
        for (const f of fields) {
            if (!isRenamable(f)) {
                usedIds.add(f);
            }
        }

        for (const f of fields) {
            if (isRenamable(f)) {
                const renamed = _rename.get(f);
                if (renamed) {
                    //console.info(f + " is used: " + renamed);
                    usedIds.add(renamed);
                }
            }
        }

        for (const f of fields) {
            if (isRenamable(f)) {
                let renamed = _rename.get(f);
                if (!renamed) {
                    let idx = 0;
                    while (usedIds.has(getAlphaID(idx))) {
                        idx++;
                        if (alphaSize < idx) {
                            alphaSize = idx;
                        }
                    }
                    const id = getAlphaID(idx);
                    _rename.set(f, id);
                    //console.info("replace: " + f + " to " + id);
                    usedIds.add(id);
                }
            }
        }
    }
    for (let i = 0; i < archetypes.length; ++i) {
        archetypes[i] = archetypes[i].filter(a => findIdCount(a) > 0);
        archetypes[i].sort((a, b) => findIdCount(b) - findIdCount(a));
    }
    archetypes = archetypes.filter(a => a.length > 0);
    // solve unique fields
    const unique = new Set();
    const ntype = [];
    for (let i = 0; i < archetypes.length; ++i) {
        for (let j = 0; j < archetypes[i].length; ++j) {
            const id = archetypes[i][j];
            if (unique.has(id)) {
                ntype.push(id);
            } else {
                unique.add(id);
            }
        }
    }
    archetypes.unshift(ntype);

    for (const arch of archetypes) {
        addType(arch);
    }

    function findIdCount(id: string) {
        return isRenamable(id) ? (getIDRegex(id).exec(src)?.length ?? 0) : 0;
    }

    for (const [from, to] of _rename) {
        src = src.replaceAll(getIDRegex(from), (a, c1, c2, c3) => {
            // console.info(a + " => " + c1 + to + c3);
            return c1 + to + c3;
        });
    }
    console.info("Total used dict: " + alphaSize);

    writeFileSync(dest, src, "utf8");
};
