const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Configure resolver to handle packages with ESM exports
// Enable package exports support and ensure proper resolution
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  // Ensure node_modules resolution works correctly
  nodeModulesPaths: [
    ...(config.resolver.nodeModulesPaths || []),
    path.resolve(__dirname, '../../node_modules'),
  ],
};

module.exports = withNativeWind(config, { input: "./global.css" });
