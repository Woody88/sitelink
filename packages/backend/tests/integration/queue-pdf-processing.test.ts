import { env, createMessageBatch, getQueueResult, createExecutionContext } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import type { R2Notification } from "../../src/core/queues/types"
import worker from "../../src/index"
import { loadSamplePDF } from "../helpers"
import { waitOnExecutionContext } from "cloudflare:test"

const TEST_R2_ACCOUNT = "test-account"
const TEST_ORGANIZATION_ID = "1"
const TEST_PROJECT_ID = "1"
const TEST_PLAN_ID = "1"
const TEST_UPLOAD_ID = "1"
const TEST_PDF_KEY = `organizations/${TEST_ORGANIZATION_ID}/projects/${TEST_PROJECT_ID}/plans/${TEST_PLAN_ID}/uploads/${TEST_UPLOAD_ID}/original.pdf`

beforeAll(async () => {
  const pdf = await loadSamplePDF()
  await env.SitelinkStorage.put(TEST_PDF_KEY, pdf)
})


describe("PDF Processing Queue", () => {
  it("should process R2 event notifications and split the PDF into sheets", async () => {

    const r2Events =[
      {
        account: TEST_R2_ACCOUNT,
        action: "PutObject",
        bucket: "sitelink-storage",
        object: { key: TEST_PDF_KEY },
        eventTime: new Date().toISOString(),
      },
    ]

    const batch = createMessageBatch<R2Notification>("pdf-processing-queue", [
      {id: "msg-1", timestamp: new Date(), body: r2Events[0], attempts: 1},
    ])

    const r2Objects = await env.SitelinkStorage.list()
    expect(r2Objects.objects).toHaveLength(1)

    const ctx = createExecutionContext()
    await worker.queue(batch as any, env, ctx)
    await waitOnExecutionContext(ctx)

    const result = await getQueueResult(batch, ctx)

    expect(result.explicitAcks).toEqual(["msg-1"])

    const keySheetPrefix = `${TEST_PDF_KEY.slice(0, TEST_PDF_KEY.lastIndexOf("/"))}/sheet-`
    const updatedR2Objects = await env.SitelinkStorage.list({ prefix: `${TEST_PDF_KEY.slice(0, TEST_PDF_KEY.lastIndexOf("/"))}` })

    expect(updatedR2Objects.objects.length).toBe(8)

    const sheets = updatedR2Objects.objects.filter(o => o.key.startsWith(keySheetPrefix))
    const expectedKeysCount = 7

    expect(sheets.length).toBe(expectedKeysCount)
  })
})