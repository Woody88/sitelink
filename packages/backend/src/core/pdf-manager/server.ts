const server = Bun.serve({
	port: 3000,
	fetch(req) {
		if (server.upgrade(req)) {
			return
		}
		console.log("incoming request", req)

		return new Response("Hello from Bun server!")
	},
	websocket: {
		open(_ws) {
			console.log("WebSocket connection opened")
		},
		async message(ws, message) {
			console.log("Received message:", message)

			await Bun.sleep(3000) // Simulate processing delay

			ws.send("Job processed")
		},
		close(_ws, code, reason) {
			console.log(`WebSocket closed: ${code} - ${reason}`)
		},
	},
})

console.log(`Server running at ${server.url}`)
