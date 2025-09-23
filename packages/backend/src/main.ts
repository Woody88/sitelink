import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";

const program = Effect.gen(function* () {
	yield* Effect.log("Hello, from Effect!");
});

BunRuntime.runMain(program);
