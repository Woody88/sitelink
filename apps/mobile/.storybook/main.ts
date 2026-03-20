import type { StorybookConfig } from "@storybook/react-native-web-vite"
import type { Plugin } from "vite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const uniwindWebPath = path.resolve(
  __dirname,
  "../node_modules/uniwind/dist/module/components/web/index.js",
)

function uniwindRewritePlugin(): Plugin {
  const appRoot = path.resolve(__dirname, "..")
  return {
    name: "uniwind-rewrite",
    enforce: "pre",
    transform(code, id) {
      // Only transform app source files (not node_modules, except @rn-primitives)
      const isAppFile = id.startsWith(appRoot) && !id.includes("node_modules")
      const isRnPrimitives = id.includes("@rn-primitives")
      if (!isAppFile && !isRnPrimitives) return null
      if (!code.includes("react-native")) return null

      // Rewrite react-native imports to Uniwind web components
      const rewritten = code.replace(/(from\s+["'])react-native(["'])/g, `$1${uniwindWebPath}$2`)
      if (rewritten === code) return null
      return { code: rewritten, map: null }
    },
  }
}

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.tsx", "../app/**/*.stories.tsx"],
  staticDirs: ["./assets"],
  framework: "@storybook/react-native-web-vite",
  async viteFinal(config) {
    const tailwindcss = (await import("@tailwindcss/vite")).default

    config.plugins = config.plugins || []
    config.plugins.unshift(uniwindRewritePlugin())
    config.plugins.push(tailwindcss())

    // Add @ alias
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    if (!Array.isArray(config.resolve.alias)) {
      ;(config.resolve.alias as Record<string, string>)["@"] = path.resolve(__dirname, "..")
    }

    return config
  },
}

export default config
