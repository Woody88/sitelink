/**
 * Development server for OpenSeadragon demo
 *
 * Usage: bun run demo/server.ts
 */

import { join, dirname } from "path";

const DEMO_DIR = dirname(import.meta.path);
const PROJECT_DIR = dirname(DEMO_DIR);
const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Serve viewer.html at root
    if (path === "/" || path === "/index.html") {
      const file = Bun.file(join(DEMO_DIR, "viewer.html"));
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("viewer.html not found", { status: 404 });
    }

    // Serve detection results
    if (path === "/results.json") {
      const file = Bun.file(join(PROJECT_DIR, "output", "results.json"));
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("results.json not found", { status: 404 });
    }

    // Serve tiles (DZI and image files)
    if (path.startsWith("/tiles/")) {
      const tilePath = path.replace("/tiles/", "");
      const file = Bun.file(join(DEMO_DIR, "tiles", tilePath));

      if (await file.exists()) {
        // Determine content type
        let contentType = "application/octet-stream";
        if (tilePath.endsWith(".dzi")) {
          contentType = "application/xml";
        } else if (tilePath.endsWith(".jpg") || tilePath.endsWith(".jpeg")) {
          contentType = "image/jpeg";
        } else if (tilePath.endsWith(".png")) {
          contentType = "image/png";
        }

        return new Response(file, {
          headers: { "Content-Type": contentType },
        });
      }
      return new Response(`Tile not found: ${tilePath}`, { status: 404 });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`
  OpenSeadragon Demo Server

  Open: http://localhost:${PORT}

  Routes:
    /               → viewer.html
    /results.json   → detection results
    /tiles/*        → DZI tiles

  Press Ctrl+C to stop
`);
