import { Effect, Layer } from "effect";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { HttpServer, HttpRouter, HttpServerResponse, HttpMiddleware } from "@effect/platform";
import { Greeter, GreeterLive } from "@sitelink/domain";

const HttpLive = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.gen(function* () {
      const greeter = yield* Greeter;
      const message = yield* greeter.greet("World");
      return HttpServerResponse.text(message);
    }),
  ),
  HttpServer.serve(HttpMiddleware.logger),
  HttpServer.withLogAddress,
);

const MainLayer = HttpLive.pipe(
  Layer.provide(GreeterLive),
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
);

BunRuntime.runMain(Layer.launch(MainLayer));
