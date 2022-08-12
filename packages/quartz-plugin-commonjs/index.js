// ignore if export anywhere, or import thats not dynamic (followed by not `(`)
const ignoreRegex = /export\s+|import\s*?[^(]/g;
const constRequireRegex = /const\s+(.*?)\s*=\s*require\("(.*?)"\)/g;
const lvRequireRegex = /(let|var)\s+(.*?)\s*=\s*require\("(.*?)"\)/g;
const moduleExportsRegex = /module.exports\s*=/g;

let count = 0;

export default () => ({
  transform: ({ code }) =>
    code.match(ignoreRegex)
      ? undefined
      : code
          // replace const requires to simple imports
          .replaceAll(constRequireRegex, 'import $1 from "$2";')
          // replace let/var requires to imports and then local copies
          .replaceAll(
            lvRequireRegex,
            `import ___${count++} from \"$3\"; $1 $2 = ___${count}`
          )
          // replace module.exports to export default
          .replaceAll(moduleExportsRegex, "export default "),
});
