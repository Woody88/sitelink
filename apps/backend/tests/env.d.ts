/// <reference types="@cloudflare/vitest-pool-workers" />
import type { TestEnv } from "../src/test-worker";

declare module "cloudflare:test" {
	interface ProvidedEnv extends TestEnv {}
}
