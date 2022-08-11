declare module "quartz-plugin-recursive-bundler";

type ToAwait<T> = T | Promise<T>;

declare const _default: (cfg: {
	quartz: () => any, // TODO: typeof quartz
	urlImport?: (url: string) => ToAwait<string | undefined>,
	localImport?: (path: string) => ToAwait<string | undefined>
}) => any; // TODO: use real quartz types here

export default _default;

export function fetchUrlImport(code: string): Promise<string>;