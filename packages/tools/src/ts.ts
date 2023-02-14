import {Project, SyntaxKind} from "ts-morph";

export const getConstMap = () => {
    const map: Record<string, string> = {};
    const project = new Project({
        tsConfigFilePath: "packages/client/tsconfig.json",
    });

    for (const src of project.getSourceFiles()) {
        const vars = src.getChildrenOfKind(SyntaxKind.VariableStatement);
        for (const v of vars) {
            const declList = v.getDeclarationList();
            if (declList) {
                for (const decl of declList.getDeclarations()) {
                    const id = decl.getFirstChildByKind(SyntaxKind.Identifier);
                    if (id) {
                        const idName = id.getText();
                        const asConst = decl.getFirstChildByKind(SyntaxKind.AsExpression);
                        if (asConst) {
                            const tr = asConst.getLastChildByKind(SyntaxKind.TypeReference);
                            if (tr && tr.getTypeName().getText() === "const") {
                                const objLit = asConst.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression);
                                if (objLit) {
                                    //console.info(idName);
                                    for (const prop of objLit.getChildrenOfKind(SyntaxKind.PropertyAssignment)) {
                                        const propName = prop.getFirstChildByKind(SyntaxKind.Identifier);
                                        const propValue = prop.getInitializer();
                                        if (propName && propValue) {
                                            //console.info(idName + "." + propName.getText() + " = " + propValue.getText());
                                            map[idName + "." + propName.getText()] = propValue.getText();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return map;
}