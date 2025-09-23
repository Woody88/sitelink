import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"

// Define the router with a single route for the root URL
const router = HttpRouter.empty.pipe(
	HttpRouter.get("/", HttpServerResponse.text("Hello World")),
	HttpRouter.get("/foo", HttpServerResponse.text("Hello, foo!")),
)

// Set up the application server with logging
const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress)

// Specify the port
const port = 3000

// Create a server layer with the specified port
const ServerLive = BunHttpServer.layer({ port, hostname: "0.0.0.0" })

// Run the application
BunRuntime.runMain(Layer.launch(Layer.provide(app, ServerLive)))
