// ignore if export anywhere, or import thats not dynamic (followed by not `(`)
const ignoreRegex = /export\s+|import\s*?[^(]/g;
const constRequireRegex = /const\s+([^;]*?)\s*=\s*require\(["'](.*?)["']\)/gm;
const lvRequireRegex = /(let|var)\s+([^;]*?)\s*=\s*require\(["'](.*?)["']\)/gm;
const moduleExportsRegex = /module.exports\s*=/g;

let count = 0;

export default () => ({
  transform: ({ code }) =>
    code.match(ignoreRegex)
      ? undefined
      : code = code
          .replaceAll(constRequireRegex, (_, decl, name) => `import { default: ${decl} } from "${name}";`)
          .replaceAll(lvRequireRegex, (_, type, decl, name) => `import ___${++count} from "${name}"; ${type} { default: ${decl} } = ___${count};`)
          .replaceAll(moduleExportsRegex, "$$$$$$exp.default"),
});
