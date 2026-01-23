/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable unicorn/prefer-module */

const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const { addLiveStoreDevtoolsMiddleware } = require("@livestore/devtools-expo");
const path = require("node:path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports for Better Auth
config.resolver.unstable_enablePackageExports = true;

// Needed for monorepo setup (can be removed in standalone projects)
if (process.env.MONOREPO_ROOT) {
	config.watchFolders = [path.resolve(process.env.MONOREPO_ROOT)];
}

if (process.env.ENABLE_LIVESTORE) {
	addLiveStoreDevtoolsMiddleware(config, {
		schemaPath: "../../packages/domain/src/schema.ts",
		viteConfig: (viteConfig) => {
			viteConfig.server.fs ??= {};
			viteConfig.server.fs.strict = false;
			viteConfig.optimizeDeps ??= {};
			viteConfig.optimizeDeps.force = true;
			return viteConfig;
		},
	});
}

module.exports = withUniwindConfig(config, {
	cssEntryFile: "./global.css",
	dtsFile: "./uniwind-types.d.ts",
});
