import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const TEST_PORT = 8789

describe("Marker detection endpoint", () => {
  let serverProcess: Bun.Subprocess | null = null
  let samplePdf: Buffer

  beforeAll(async () => {
    const pdfPath = join(import.meta.dir, "../../sample-single-plan.pdf")
    samplePdf = readFileSync(pdfPath)

    try {
      serverProcess = Bun.spawn(["bun", "run", "src/api/server.ts"], {
        cwd: import.meta.dir.replace("/tests/unit", ""),
        env: { ...process.env, PORT: TEST_PORT.toString() },
        stdout: "pipe",
        stderr: "pipe",
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error("Failed to start server:", error)
    }
  })

  afterAll(() => {
    if (serverProcess) serverProcess.kill()
  })

  // These tests involve LLM calls and need longer timeouts (120 seconds)
  // In CI, these should be run as integration tests with proper API keys
  test("detects callout markers from PDF", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/detect-markers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Valid-Sheets": "A5,A6,A7",
        "X-Sheet-Number": "1",
      },
      body: samplePdf,
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("markers")
    expect(Array.isArray(data.markers)).toBe(true)
  }, 120000) // 2 minute timeout for LLM processing

  test("markers have required fields", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/detect-markers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-Valid-Sheets": "A5,A6,A7",
      },
      body: samplePdf,
    })

    expect(response.status).toBe(200) // Verify request succeeded
    const data = await response.json()
    if (data.markers && data.markers.length > 0) {
      const marker = data.markers[0]
      expect(marker).toHaveProperty("text")
      expect(marker).toHaveProperty("sheet")
      expect(marker).toHaveProperty("confidence")
      expect(marker).toHaveProperty("is_valid")
    }
  }, 120000) // 2 minute timeout for LLM processing

  test("returns 400 for missing content type", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/detect-markers`, {
      method: "POST",
      body: samplePdf,
    })
    expect(response.status).toBe(400)
  })

  test("returns 400 for empty body", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/detect-markers`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
    })
    expect(response.status).toBe(400)
  })
})
