import { tokenizer } from "acorn";

function matchAll(regex, string, addition) {
  const matches = [];
  for (const match of string.matchAll(regex)) {
    matches.push({
      ...addition,
      ...match.groups,
      code: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return matches;
}

const ESM_STATIC_IMPORT_RE =
  /(?<=\s|^|;)import\s*([\s"']*(?<imports>[\p{L}\p{M}\w\t\n\r $*,/{}@.]+)from\s*)?["']\s*(?<specifier>(?<="\s*)[^"]*[^\s"](?=\s*")|(?<='\s*)[^']*[^\s'](?=\s*'))\s*["'][\s;]*/gmu;
const TYPE_RE = /^\s*?type\s/;

export const EXPORT_DECAL_RE =
  /\bexport\s+(?<declaration>(async function|function|let|const enum|const|enum|var|class))\s+(?<name>[\w$]+)/g;
export const EXPORT_DECAL_TYPE_RE =
  /\bexport\s+(?<declaration>(interface|type|declare (async function|function|let|const enum|const|enum|var|class)))\s+(?<name>[\w$]+)/g;
const EXPORT_NAMED_RE =
  /\bexport\s+{(?<exports>[^}]+?)[\s,]*}(\s*from\s*["']\s*(?<specifier>(?<="\s*)[^"]*[^\s"](?=\s*")|(?<='\s*)[^']*[^\s'](?=\s*'))\s*["'][^\n;]*)?/g;
const EXPORT_NAMED_TYPE_RE =
  /\bexport\s+type\s+{(?<exports>[^}]+?)[\s,]*}(\s*from\s*["']\s*(?<specifier>(?<="\s*)[^"]*[^\s"](?=\s*")|(?<='\s*)[^']*[^\s'](?=\s*'))\s*["'][^\n;]*)?/g;
const EXPORT_NAMED_DESTRUCT =
  /\bexport\s+(let|var|const)\s+(?:{(?<exports1>[^}]+?)[\s,]*}|\[(?<exports2>[^\]]+?)[\s,]*])\s+=/gm;
const EXPORT_STAR_RE =
  /\bexport\s*(\*)(\s*as\s+(?<name>[\w$]+)\s+)?\s*(\s*from\s*["']\s*(?<specifier>(?<="\s*)[^"]*[^\s"](?=\s*")|(?<='\s*)[^']*[^\s'](?=\s*'))\s*["'][^\n;]*)?/g;
const EXPORT_DEFAULT_RE = /\bexport\s+default\s+/g;

export function findStaticImports(code) {
  return matchAll(ESM_STATIC_IMPORT_RE, code, { type: "static" });
}

function clearImports(imports) {
  return (imports || "")
    .replace(/(\/\/[^\n]*\n|\/\*.*\*\/)/g, "")
    .replace(/\s+/g, " ");
}

export function getImportNames(cleanedImports) {
  const topLevelImports = cleanedImports.replace(/{([^}]*)}/, "");
  const namespacedImport = topLevelImports.match(/\* as \s*(\S*)/)?.[1];
  const defaultImport =
    topLevelImports
      .split(",")
      .find((index) => !/[*{}]/.test(index))
      ?.trim() || undefined;

  return {
    namespacedImport,
    defaultImport,
  };
}

export function parseStaticImport(matched) {
  const cleanedImports = clearImports(matched.imports);

  const namedImports = {};
  for (const namedImport of cleanedImports
    .match(/{([^}]*)}/)?.[1]
    ?.split(",") || []) {
    const [, source = namedImport.trim(), importName = source] =
      namedImport.match(/^\s*(\S*) as (\S*)\s*$/) || [];
    if (source && !TYPE_RE.test(source)) {
      namedImports[source] = importName;
    }
  }
  const { namespacedImport, defaultImport } = getImportNames(cleanedImports);

  return {
    ...matched,
    defaultImport,
    namespacedImport,
    namedImports,
  };
}

function normalizeExports(exports) {
  for (const exp of exports) {
    if (!exp.name && exp.names && exp.names.length === 1) {
      exp.name = exp.names[0];
    }
    if (exp.name === "default" && exp.type !== "default") {
      exp._type = exp.type;
      exp.type = "default";
    }
    if (!exp.names && exp.name) {
      exp.names = [exp.name];
    }
  }
  return exports;
}

function normalizeNamedExports(namedExports) {
  for (const namedExport of namedExports) {
    namedExport.names = namedExport.exports
      .replace(/^\r?\n?/, "")
      .split(/\s*,\s*/g)
      .filter((name) => !TYPE_RE.test(name))
      .map((name) => name.replace(/^.*?\sas\s/, "").trim());
  }
  return namedExports;
}

function _getExportLocations(code) {
  const tokens = tokenizer(code, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
  });

  const locations = [];
  for (const token of tokens) {
    if (token.type.label === "export") {
      locations.push({
        start: token.start,
        end: token.end,
      });
    }
  }
  return locations;
}

function _tryGetExportLocations(code) {
  try {
    return _getExportLocations(code);
  } catch {}
}

function _isExportStatement(exportsLocation, exp) {
  return exportsLocation.some((location) => {
    // AST token inside the regex match
    return exp.start <= location.start && exp.end >= location.end;
    // AST Token start or end is within the regex match
    // return (exp.start <= location.start && location.start <= exp.end) ||
    // (exp.start <= location.end && location.end <= exp.end)
  });
}

export function findExports(code) {
  // Find declarations like export const foo = 'bar'
  const declaredExports = matchAll(EXPORT_DECAL_RE, code, {
    type: "declaration",
  });

  // Find named exports
  const namedExports = normalizeNamedExports(
    matchAll(EXPORT_NAMED_RE, code, {
      type: "named",
    })
  );

  const destructuredExports = matchAll(EXPORT_NAMED_DESTRUCT, code, {
    type: "named",
  });
  for (const namedExport of destructuredExports) {
    // @ts-expect-error groups
    namedExport.exports = namedExport.exports1 || namedExport.exports2;
    namedExport.names = namedExport.exports
      .replace(/^\r?\n?/, "")
      .split(/\s*,\s*/g)
      .filter((name) => !TYPE_RE.test(name))
      .map((name) =>
        name
          .replace(/^.*?\s*:\s*/, "")
          .replace(/\s*=\s*.*$/, "")
          .trim()
      );
  }

  // Find export default
  const defaultExport = matchAll(EXPORT_DEFAULT_RE, code, {
    type: "default",
    name: "default",
  });

  // Find export star
  const starExports = matchAll(EXPORT_STAR_RE, code, {
    type: "star",
  });

  // Merge and normalize exports
  // eslint-disable-next-line unicorn/no-array-push-push
  const exports = normalizeExports([
    ...declaredExports,
    ...namedExports,
    ...destructuredExports,
    ...defaultExport,
    ...starExports,
  ]);

  // Return early when there is no  export statement
  if (exports.length === 0) {
    return [];
  }
  const exportLocations = _tryGetExportLocations(code);
  if (exportLocations && exportLocations.length === 0) {
    return [];
  }

  return (
    exports
      // Filter false positive export matches
      .filter(
        (exp) => !exportLocations || _isExportStatement(exportLocations, exp)
      )
      // Prevent multiple exports of same function, only keep latest iteration of signatures
      .filter((exp, index, exports) => {
        const nextExport = exports[index + 1];
        return (
          !nextExport ||
          exp.type !== nextExport.type ||
          !exp.name ||
          exp.name !== nextExport.name
        );
      })
  );
}
