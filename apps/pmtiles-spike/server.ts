import index from "./index.html"

const server = Bun.serve({
  port: 3003,
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  },
})

console.log(`Server running at http://localhost:${server.port}`)
