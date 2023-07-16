import { parse } from "es-module-lexer";

const src = `
export { a as b, d as c, e, } from "c";
`;

async function betterParse(src) {
  let [imports] = await parse(src);
  let exports = [];

  imports = imports.filter((imp) => {
    imp.declaration = src
      .slice(imp.ss, imp.se)
      .replace(/\/\*[\w\W]*?\*\//g, "");
    imp.importClause = imp.declaration
      .slice(6, imp.declaration.lastIndexOf("from"))
      .trim();

    const namedImportOpener = imp.importClause.indexOf("{");
    const namedImportCloser = imp.importClause.indexOf("}") + 1;

    imp.namedImport = imp.importClause.slice(
      namedImportOpener,
      namedImportCloser
    );

    if (imp.namedImport != "") {
      imp.importClause =
        imp.importClause.slice(0, namedImportOpener) +
        imp.importClause.slice(namedImportCloser);

      imp.namedImports = imp.namedImport
        .slice(1, -1)
        .trim()
        .split(",")
        .filter((i) => i.trim() != "")
        .map((i) => {
          const split = i.trim().split(" as ");

          if (!split[1]) split[1] = split[0];
          return split;
        }).reduce((obj, c) => {
          obj[c[0]] = c[1];

          return obj
        }, {})
    }

    const commaIndex = imp.importClause.indexOf(",");

    if (imp.namedImport == "") {
      const namespace =
        commaIndex == -1
          ? imp.importClause
          : imp.importClause.slice(commaIndex + 1).trim();

      if (namespace[0] == "*")
        imp.namespace = namespace.slice(namespace.indexOf("as") + 2).trim();
    }

    // If there's no named imports and there's no namespaces, the default export *is* the importClause
    if (imp.namedImport == "" && !imp.namespace) {
      imp.default = imp.importClause;
    } else if (commaIndex != -1) {
      // Otherwise, the default export *must* come before the comma
      imp.default = imp.importClause.slice(0, commaIndex);
    }

    if (imp.declaration.slice(0, 6) == "import") return true;

    imp.isExport = true;
    exports.push(imp);
  });

  return [imports, exports];
}

for (const [imp] of (await betterParse(src))) {
  console.log(imp)
}