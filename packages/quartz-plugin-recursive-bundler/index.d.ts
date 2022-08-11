declare module "quartz-plugin-recursive-bundler";
import quartz, { QuartzConfig } from "@uwu/quartz";

type MaybePromise<T> = T | Promise<T>;

declare const _default: (cfg: {
  quartz: typeof quartz;
  urlImport?: (url: string) => MaybePromise<string | undefined>;
  localImport?: (path: string) => MaybePromise<string | undefined>;
}) => QuartzConfig;

export default _default;

export function fetchUrlImport(code: string): Promise<string>;
