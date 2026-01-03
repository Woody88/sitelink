import { Effect, Layer } from "effect";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { HttpServer, HttpRouter, HttpServerResponse, HttpMiddleware } from "@effect/platform";

const HttpLive = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.succeed(HttpServerResponse.text("Sitelink API")),
  ),
  HttpRouter.get(
    "/health",
    HttpServerResponse.json({ status: "ok" }),
  ),
  HttpServer.serve(HttpMiddleware.logger),
  HttpServer.withLogAddress,
);

const MainLayer = HttpLive.pipe(
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
);

BunRuntime.runMain(Layer.launch(MainLayer));
