import { serve } from "bun";
import index from "./index.html";
import auth from "./auth.html";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8787";
const PORT = parseInt(process.env.PORT || "3000");

const server = serve({
  port: PORT,
  routes: {
    // HTML routes - Bun auto-bundles <script>/<link> tags!
    "/": index,
    "/auth.html": auth,

    // Handle favicon requests (avoid 500 errors)
    "/favicon.ico": () => new Response(null, { status: 204 }),

    // Proxy ALL /api/* routes to backend
    "/api/*": async (req) => {
      const url = new URL(req.url);
      const backendUrl = `${BACKEND}${url.pathname}${url.search}`;

      // Forward the request to the backend
      const response = await fetch(backendUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        // @ts-ignore - duplex is valid for fetch
        duplex: "half",
      });

      // Clone the response and add CORS headers
      // This ensures CORS headers are present even if backend doesn't set them
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", req.headers.get("origin") || "*");
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      // Remove content-encoding to prevent double-encoding issues
      headers.delete("Content-Encoding");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  },

  // Static assets (CSS, JS, etc.)
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Serve static files from current directory
    const file = Bun.file(`.${path}`);
    return new Response(file);
  },

  // Enable development mode for detailed errors and hot reloading
  development: true,
});

console.log(`\n🚀 Sitelink Demo Frontend`);
console.log(`   Frontend: http://localhost:${server.port}`);
console.log(`   Backend:  ${BACKEND}`);
console.log(`\n📝 Open http://localhost:${server.port} to start\n`);
