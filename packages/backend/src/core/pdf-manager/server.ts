const server = Bun.serve({
	port: 3000,
	routes: {
		"/health": () => Response.json({ health: "ok" }),
		"/processPdf": () => Response.json("processingPdf...")
	}
})

console.log(`Server running at ${server.url}`)
