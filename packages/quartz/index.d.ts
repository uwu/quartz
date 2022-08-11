declare module "@uwu/quartz";

type MaybePromise<T> = T | Promise<T>

export type QuartzConfig = {
	plugins: QuartzPlugin[]
}

export type QuartzPlugin = {
	transform?(ctx: { code: string }): MaybePromise<string | undefined>

	resolve?(ctx: {
		config: QuartzConfig,
		acessor: string,
		store: object,
		name: string,
		imports: Record<string, string[]>
		moduleId: string
	}): MaybePromise<string | undefined>
}

declare const _default: (code: string, config: QuartzConfig, moduleId?: string) => Promise<object>;
export default _default;