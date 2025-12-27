import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const TEST_PORT = 8788

describe("Metadata extraction endpoint", () => {
  let serverProcess: Bun.Subprocess | null = null
  let samplePdf: Buffer

  beforeAll(async () => {
    // Load sample PDF
    const pdfPath = join(import.meta.dir, "../../sample-single-plan.pdf")
    samplePdf = readFileSync(pdfPath)

    // Start server
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

  // This test involves PDF conversion and LLM calls for title block analysis
  test("extracts sheet number from valid PDF", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/extract-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: samplePdf,
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty("sheet_number")
    expect(typeof data.sheet_number).toBe("string")
  }, 120000) // 2 minute timeout for LLM processing

  test("returns 400 for invalid content type", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/extract-metadata`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not a pdf",
    })
    expect(response.status).toBe(400)
  })

  test("returns 400 for empty body", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/extract-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
    })
    expect(response.status).toBe(400)
  })

  test("returns 405 for GET method", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/extract-metadata`)
    expect([404, 405]).toContain(response.status)
  })
})
