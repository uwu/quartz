declare module "quartz-plugin-sucrase";
import { QuartzPlugin } from "@uwu/quartz";

declare const _default: (cfg: {
  ts?: boolean;
  jsx?: boolean;
  flow?: boolean;
  jsxPragma?: string;
  jsxFragmentPragma?: string;
}) => QuartzPlugin;

export default _default;
