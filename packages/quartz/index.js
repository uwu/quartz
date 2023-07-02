import { findStaticImports, parseStaticImport, findExports } from "mlly";

const destructurify = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${v}:${k}`)
    .reduce((p, c) => p + c + ",");

export default async function quartz(
  code,
  config = { plugins: [] },
  moduleId = false
) {
  let generatedImports = "";
  let generatedExports = "";
  let generatedCode = "";

  for (const plugin of plugins) {
    if (!plugin.transform) continue;

    generatedCode = plugin.transform({ generatedCode })
  }

  const imports = findStaticImports(code);
  const exports = findExports(code);

  let fakeImports = "";
  for (const exp of exports) {
    if (exp.type != "named" || !exp.specifier) continue;

    fakeImports += "import" + exp.code.slice(6) + ";";

    exp.code = exp.code.slice(0, exp.code.lastIndexOf("from")).trim();
    exp.specifier = undefined;
  }

  imports.push(...findStaticImports(fakeImports).map((f) => (f.fake = true)));

  let quartzStore = {};

  for (const imp of imports) {
    if (!imp.fake)
      generatedCode =
        generatedCode.slice(0, imp.start - 1) +
        " ".repeat(imp.end - imp.start) +
        generatedCode.slice(imp.end - 1);

    let id = (Math.random() + 1).toString(36).substring(7);

    let store = (quartzStore[id] = {});
    let accessor = `$$$QUARTZ_STORE["${id}"]`;

    const parsedImport = parseStaticImport(imp);

    for (const plugin of config.plugins) {
      if (!plugin.resolve) continue;

      const generatedImport = await plugin.resolve({
        config,
        accessor,
        store,
        name: parsedImport.specifier,
        moduleId,
      });

      if (!generatedImport) continue;

      const addImport = (name) =>
        (generatedImports += `const ${name} = ${generatedImport};`);

      if (parsedImport.defaultImport) addImport(parsedImport.defaultImport);
      if (parsedImport.namespacedImport)
        addImport(parsedImport.namespacedImport);
      if (Object.keys(parsedImport.namedImports).length)
        addImport("{" + destructurify(parsedImport.namedImports) + "}");

      // Once we've handled the resolves for this import, we stop.
      break;
    }
  }

  let offset = 0;
  for (const exp of exports) {
    let assigner = "";

    switch (exp.type) {
      case "default":
        assigner = "$$$QUARTZ_EXPORTS.default=";
        break;
      case "declaration":
        assigner =
          exp.declaration !== "function"
            ? `$$$QUARTZ_EXPORTS["${exp.name}"]`
            : `$$$QUARTZ_EXPORTS["${exp.name}"]=function ${exp.name}`;
        break;
      case "named":
        assigner += `$$$QUARTZ_EXPORTS = { ...$$$QUARTZ_EXPORTS, ${destructurify(
          parseStaticImport(
            findStaticImports(
              `import${exp.code.slice(6)} from "fake-module"`
            )[0]
          ).namedImports
        )}};`;
        break;
      default:
        break;
    }

    generatedCode =
      generatedCode.slice(0, exp.start + offset) +
      assigner +
      generatedCode.slice(exp.end + offset);

    offset -= exp.end - exp.start;
    offset += assigner.length;
  }

  return (0, eval)(
    `(async ($$$QUARTZ_STORE, $$$QUARTZ_EXPORTS) => {${generatedImports}${generatedCode};${generatedExports};return $$$QUARTZ_EXPORTS})`
  )(quartzStore, {});
}