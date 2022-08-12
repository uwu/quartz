import { transform } from "sucrase";

export default ({
  ts = true,
  jsx = true,
  flow = false,
  jsxPragma = "React.createElement",
  jsxFragmentPragma = "React.Fragment",
} = {}) => ({
  transform({ code }) {
    const transforms = [];
    if (flow && code.split("\n")[0].match(/^\/\/\s*@flow/))
      transforms.push("flow");
    else if (ts) transforms.push("typescript");
    if (jsx) transforms.push("jsx");

    return transform(code, {
      disableESTransforms: true,
      preserveDynamicImport: true,
      jsxPragma,
      jsxFragmentPragma,
      transforms,
    }).code;
  },
});
