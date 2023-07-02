// ignore if export anywhere, or import thats not dynamic (followed by not `(`)
const ignoreRegex = /export\s+|import\s*?[^(]/g;
const requireRegex = /(const|let|var)\s+([^;]*?)\s*=\s*require\("(.*?)"\)/gm;
const moduleExportsRegex = /module.exports\s*=/g;

let count = 0;

export default () => ({
  transform: ({ code }) =>
    code.match(ignoreRegex)
      ? undefined
      : code
          // replace requires to imports and then local copies
          .replaceAll(
            requireRegex,
            `import * as ___${count} from \"$3\"; $1 $2 = ___${count++}`
          )
          // replace module.exports to export default
          .replaceAll(moduleExportsRegex, "export default "),
});
