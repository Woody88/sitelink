import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    globals: true,
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./vitest.wrangler.json",
        },
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "migrations/",
        "worker-configuration.d.ts",
      ],
    },
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      external: [
        "@opentelemetry/resources",
        "@opentelemetry/sdk-node",
        "@opentelemetry/api",
      ],
    },
  },
});
