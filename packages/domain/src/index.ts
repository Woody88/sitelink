import { Effect, Context, Layer } from "effect";

export class Greeter extends Context.Tag("Greeter")<
  Greeter,
  {
    readonly greet: (name: string) => Effect.Effect<string>;
  }
>() {}

export const GreeterLive = Layer.succeed(Greeter, {
  greet: (name) => Effect.succeed(`Hello, ${name}!`),
});
