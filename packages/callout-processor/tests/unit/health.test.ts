import { describe, test, expect, beforeAll, afterAll } from "bun:test"

// We'll test the health endpoint by starting the server
// These tests should FAIL initially (TDD RED phase)

const TEST_PORT = 8787

describe("Health endpoint", () => {
  let serverProcess: Bun.Subprocess | null = null

  beforeAll(async () => {
    // Start the server in a subprocess
    // This will fail until src/api/server.ts exists
    try {
      serverProcess = Bun.spawn(["bun", "run", "src/api/server.ts"], {
        cwd: import.meta.dir.replace("/tests/unit", ""),
        env: { ...process.env, PORT: TEST_PORT.toString() },
        stdout: "pipe",
        stderr: "pipe",
      })
      // Give server time to start
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error("Failed to start server:", error)
    }
  })

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill()
    }
  })

  test("returns ready status when service is initialized", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/health`)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toEqual({
      status: "ready",
      service: "callout-processor",
    })
  })

  test("returns correct content-type header", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/health`)

    expect(response.headers.get("content-type")).toContain("application/json")
  })

  test("handles GET method only", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/health`, {
      method: "POST",
    })

    // Should either return 405 Method Not Allowed or 404
    expect([404, 405]).toContain(response.status)
  })
})
