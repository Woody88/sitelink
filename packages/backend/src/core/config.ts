import {
	Config,
	ConfigError,
	ConfigProvider,
	Either,
	Layer,
	Predicate,
	pipe,
} from "effect"

/**
 * Creates a ConfigProvider Layer from an object containing both string and object values.
 * This is designed for Cloudflare Workers where env contains both primitive values
 * (like API keys) and complex bindings (like D1Database, R2Bucket, etc.).
 *
 * Based on the proof of concept from https://github.com/Effect-TS/effect/issues/4636
 *
 * @example
 * ```ts
 * const ConfigLive = fromObject(env)
 * const AppLayer = CoreLayer.pipe(Layer.provide(ConfigLive))
 * ```
 */
export const fromObject = <T extends { [K in keyof T]: string | object }>(
	object: T,
) =>
	pipe(
		object as unknown as Record<string, string>,
		Object.entries,
		(tuples) => new Map(tuples),
		ConfigProvider.fromMap,
		Layer.setConfigProvider,
	)

/**
 * Creates a Config that expects an object value instead of a string.
 * This allows accessing Cloudflare bindings (D1, R2, KV, etc.) through the Config system.
 *
 * **IMPORTANT**: This is a workaround until Effect-TS officially implements Config.object.
 * The implementation casts the string value to object, which works because ConfigProvider.fromMap
 * stores the actual object reference when created via fromObject().
 *
 * @param name - The key name in the environment/config object
 * @returns A Config<object> that can be further refined with mapOrFail
 *
 * @example
 * ```ts
 * const d1Config = object('SitelinkDB').pipe(
 *   Config.mapOrFail((value) =>
 *     Predicate.hasProperty(value, 'prepare')
 *       ? Either.right(value as D1Database)
 *       : Either.left(ConfigError.InvalidData([], 'Expected D1Database'))
 *   )
 * )
 * ```
 */
export const object = (name: string): Config.Config<object> =>
	Config.string(name).pipe(
		Config.mapOrFail((value) =>
			value !== null && typeof value === "object"
				? Either.right(value as object)
				: Either.left(
						ConfigError.InvalidData(
							[],
							`Expected an object but received ${value}`,
						),
					),
		),
	)

/**
 * Helper to create a typed Config for Cloudflare D1 databases.
 *
 * @param name - The binding name in wrangler.toml (e.g., 'SitelinkDB')
 * @returns A Config<D1Database> ready to be used in Effect.Service dependencies
 *
 * @example
 * ```ts
 * export class DatabaseService extends Effect.Service<DatabaseService>()("DatabaseService", {
 *   effect: Effect.gen(function* () {
 *     const d1 = yield* d1Database('SitelinkDB')
 *     const db = drizzle(d1, { schema })
 *     return { use: ... }
 *   })
 * }) {}
 * ```
 */
export const d1Database = (name: string): Config.Config<D1Database> =>
	object(name).pipe(
		Config.mapOrFail((value) =>
			Predicate.hasProperty(value, "prepare") &&
			typeof (value as any).prepare === "function"
				? Either.right(value as D1Database)
				: Either.left(
						ConfigError.InvalidData(
							[],
							`Expected D1Database but received ${value}`,
						),
					),
		),
	)
