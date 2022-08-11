const funnyEvalCopy = eval;

const importRegex = /import\s+(.*?)\s+from\s+['"](.*?)['"]/g;
const javaScriptVarNameRegex =
  /^[\p{L}\p{Nl}$_][\p{L}\p{Nl}$\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*$/gu;

function mapImports(code) {
  const dependencies = {};

  for (const [_, unmappedImports, moduleName] of [
    ...code.matchAll(importRegex),
  ]) {
    let mappedImports = unmappedImports.split(/,(?=[^}]*(?:{|$))/g).map((i) => {
      const imp = i.trim();

      const allImport = imp.split("* as");
      if (allImport.length > 1)
        return `{ ...${allImport[1].split("}")[0].trim()} }`;

      if (imp.includes(" as ")) return imp.replaceAll(" as ", ": ");

      if (javaScriptVarNameRegex.test(imp)) return `{ default: ${imp} }`;

      return imp;
    });

    if (!dependencies[moduleName]) dependencies[moduleName] = [];

    dependencies[moduleName].push(...mappedImports);
  }

  return dependencies;
}

const processExports = (code) =>
  code
    .replaceAll("export default", "$$$$$$exp.default=")
    .replaceAll(/export const (.*?)\s*=/g, "$$$$$$exp['$1']=")
    .replaceAll(/export let (.*?)\s*=/g, "$$$$$$exp['$1']=")
    .replaceAll(/export function (.*?)\(/g, "$$$$$$exp['$1']=function(");

export default async function quartz(code, config = { plugins: [] }, moduleId = false) {
  if (!code) return;

  let userCode = code;

  if (config?.plugins)
    for (const plugin of config.plugins)
      if (plugin?.transform) {
        let transformed = await plugin.transform({ code: userCode, moduleId });

        if (!transformed) break;

        userCode = transformed;
      }

  const mappedImports = mapImports(userCode);

  userCode = processExports(
    userCode.replaceAll(/import\s+(.*)\s+from\s+['"](.*)['"][;]?[\n]?/g, "")
  );

  let quartzStore = {};
  let generatedCode = "";

  if (config?.plugins)
    for (const plugin of config.plugins) {
      let id = (Math.random() + 1).toString(36).substring(7);
      const accessor = `$$$QUARTZSTORE["${id}"]`;
      quartzStore[id] = {};

      if (plugin?.resolve)
        for (const name in mappedImports) {
          const generated = await plugin.resolve({
            config,
            accessor,
            store: quartzStore[id],
            name,
            imports: mappedImports[name],
            moduleId,
          });

          if (!generated) break;
          generatedCode += mappedImports[name]
            .map((i) => `const ${i} = ${generated};`)
            .join("");
          delete mappedImports[name];
        }
    }

  let finalCode = `
(async ($$$QUARTZSTORE) => {
  let $$$exp = {};
  ${generatedCode}
  ${userCode}
  return $$$exp;
})
`.trim();

  return funnyEvalCopy(finalCode)(quartzStore);
}