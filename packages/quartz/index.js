import { parse } from "es-module-lexer";

// This needs support for 2 things to be "complete":
// 1. `import "./module.js"`
// 2. `export * from "module"`
// For now, it's fine.

async function betterParse(src) {
  let [imports] = await parse(src);
  let exports = [];

  imports = imports.filter((imp) => {
    imp.declaration = src
      .slice(imp.ss, imp.se)
      .replace(/\/\*[\w\W]*?\*\//g, ""); // this removes the comments from the import
    imp.importClause = imp.declaration
      .slice(6, imp.declaration.lastIndexOf("from"))
      .trim();

    if (imp.importClause[0] == "(") imp.isDynamic = true;
    if (imp.importClause[0] == '"') imp.isSideEffectful = true;

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
        })
        .reduce((obj, c) => {
          obj[c[0]] = c[1];

          return obj;
        }, {});
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

const destructurifyImp = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${k}:${v}`)
    .join();

const removeFromString = (string, start, end) =>
  string.slice(0, start) + string.slice(end);

const insertIntoString = (string, start, newString) =>
  string.slice(0, start) + newString + string.slice(start);

export default async function quartz(
  code,
  config = { plugins: [] },
  moduleId = false
) {
  let generatedImports = "";

  for (const plugin of config.plugins)
    if (plugin.transform) code = plugin.transform({ code });

  const [imports, exports] = await betterParse(code);

  // I don't want to have to parse any of this shit more than once.
  let offset = 0;

  for (const exp of exports) {
    imports.push(exp);

    const startIndex = exp.ss + offset;
    const endIndex = exp.se + offset;

    const namespace = exp.namespace;
    if (namespace != undefined) {
      // Because of how `export * from "module"` works, we can't dynamically export things.
      // My proposal is that we have a $$$QUARTZ_DYNAMIC_EXPORTS object passed through,
      // we add a randomly generated namespace, and then we convert the export into reassigning $$$QUARTZ_DYNAMIC_EXPORTS.
      // We then spread the exports and the dynamic exports together and return that as the exports.

      if (namespace != "") {
        code = removeFromString(code, startIndex, endIndex);
        const newExport = `export { ${namespace} };`;
        code = insertIntoString(code, startIndex, newExport);

        offset -= endIndex - startIndex + newExport.length;
      }

      continue;
    }

    const fromIndex =
      startIndex + code.slice(startIndex, endIndex).lastIndexOf("from");
    code = removeFromString(code, fromIndex, endIndex);
    offset -= endIndex - fromIndex;
  }

  let quartzStore = {
    async dynamicResolver(path) {
      for (const plugin of config.plugins) {
        if (!plugin.dynamicResolve) continue;

        const res = await plugin.dynamicResolve({
          config,
          accessor,
          store,
          name: path,
          moduleId,
        });

        if (res) return res;
      }
    },
  };

  for (const imp of imports) {
    if (imp.isDynamic) {
      // remove import line
      code = removeFromString(code, imp.ss + offset, imp.ss + 6 + offset);
      code =
        code.slice(0, imp.ss + offset) +
        "$$$QUARTZ_DYNAMIC_RESOLVE" +
        code.slice(imp.ss + offset);
      offset += 19; // changing to $$$QUARTZ_DYNAMIC_RESOLVE adds 19 chars

      continue;
    }

    if (!imp.isExport) {
      code = removeFromString(code, imp.ss + offset, imp.se + offset);

      offset -= imp.se + offset - (imp.ss + offset);
    }

    let id = (Math.random() + 1).toString(36).substring(7);

    let store = (quartzStore[id] = {});
    let accessor = `$$$QUARTZ_STORE["${id}"]`;

    for (const plugin of config.plugins) {
      if (!plugin.resolve) continue;

      const generatedImport = await plugin.resolve({
        config,
        accessor,
        store,
        name: imp.n,
        moduleId,
      });

      if (!generatedImport) continue;

      const addImport = (name) =>
        (generatedImports += `const ${name} = ${generatedImport};`);

      if (imp.default) addImport(`{default:${imp.default}}`);
      if (imp.namespace) addImport(imp.namespace);
      if (imp.namedImports) {
        addImport("{" + destructurifyImp(imp.namedImports) + "}");
      }

      break;
    }
  }

  // This appears to be the only way to share things between realms.
  const globalStoreID = (Math.random() + 1).toString(36).substring(7);
  globalThis[globalStoreID] = quartzStore;

  const mod = await import(
    `data:text/javascript;base64,${btoa(
      `const $$$QUARTZ_STORE = globalThis["${globalStoreID}"];const $$$QUARTZ_DYNAMIC_RESOLVE = $$$QUARTZ_STORE.dynamicResolver;` +
        generatedImports +
        code
    )}`
  );
  delete globalThis[globalStoreID];

  return mod;
}