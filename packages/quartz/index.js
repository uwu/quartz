import parseImports from "parse-imports";

async function betterParseImports(code) {
  const exports = [];

  // This looks stupid but it's less iterations
  const imports = [...(await parseImports(code))].filter((i) => {
    if (i.isDynamicImport) return;
    if (code.slice(i.startIndex, i.startIndex + 6) == "import") return true;

    i.isExport = true;
    exports.push(i);
  });

  return [imports, exports];
}

const removeFromString = (string, start, end) =>
  string.slice(0, start) + string.slice(end);

const insertIntoString = (string, start, newString) =>
  string.slice(0, start) + newString + string.slice(start);

const destructurifyImp = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${k}:${v}`)
    .join();

const destructurifyExp = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${v}:${k}`)
    .join();

export default async function quartz(
  code,
  config = { plugins: [] },
  moduleId = false
) {
  let generatedImports = "";

  for (const plugin of config.plugins)
    if (plugin.transform) code = plugin.transform({ code });

  const [imports, exports] = await betterParseImports(code);

  // I don't want to have to parse any of this shit more than once.
  let offset = 0;

  for (const exp of exports) {
    imports.push(exp);

    const startIndex = exp.startIndex + offset;
    const endIndex = exp.endIndex + offset;

    const namespace = exp.importClause.namespace;
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

  let quartzStore = {};

  for (const imp of imports) {
    if (!imp.isExport) {
      code = removeFromString(
        code,
        imp.startIndex + offset,
        imp.endIndex + offset
      );

      offset -= imp.endIndex + offset - (imp.startIndex + offset);
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
        name: imp.moduleSpecifier.value,
        moduleId,
      });

      if (!generatedImport) continue;

      const addImport = (name) =>
        (generatedImports += `const ${name} = ${generatedImport};`);

      const { importClause } = imp;

      if (importClause.default) addImport(`{default:${importClause.default}}`);
      if (importClause.namespace) addImport(importClause.namespace);
      if (importClause.named.length > 0) {
        for (const name of importClause.named) {
          addImport(`{${name.specifier}:${name.binding}}`);
        }
      }
    }
  }

  // This appears to be the only way to share things between realms.
  const globalStoreID = (Math.random() + 1).toString(36).substring(7);
  globalThis[globalStoreID] = quartzStore;

  // console.log(generatedImports + code)

  const mod = await import(`data:text/javascript;base64,${btoa(`const $$$QUARTZ_STORE = globalThis["${globalStoreID}"];` + generatedImports + code)}`)
  delete globalThis[globalStoreID];

  return mod;
}