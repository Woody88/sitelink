import { WorkflowEntrypoint } from "cloudflare:workers"
import { NonRetryableError } from "cloudflare:workflows"
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import type { Env } from "../types/env"
import type { events } from "@sitelink/domain"
import { getR2Path } from "../processing/types"

type EventName = keyof typeof events
type EventData<T extends EventName> = Parameters<(typeof events)[T]>[0]
type DOStub = { fetch: (url: string, init?: RequestInit) => Promise<Response> }

export interface PlanProcessingParams {
  planId: string
  projectId: string
  organizationId: string
  pdfPath: string
  totalPages: number
  planName: string
}

function getLiveStoreStub(env: Env, organizationId: string): DOStub {
  return env.LIVESTORE_CLIENT_DO.get(env.LIVESTORE_CLIENT_DO.idFromName(organizationId))
}

async function commitEvent<T extends EventName>(
  stub: DOStub,
  organizationId: string,
  eventName: T,
  data: EventData<T>,
): Promise<void> {
  const response = await stub.fetch("http://internal/commit?storeId=" + organizationId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, data }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LiveStore commit failed for ${eventName}: ${response.status} ${text}`)
  }
}

async function emitProgress(
  stub: DOStub,
  organizationId: string,
  planId: string,
  progress: number,
): Promise<void> {
  try {
    await commitEvent(stub, organizationId, "planProcessingProgress", { planId, progress })
  } catch (error) {
    console.warn(`[Workflow] Progress emit failed:`, error)
  }
}

async function containerFetch(
  container: { fetch: (url: string, init?: RequestInit) => Promise<Response> } | null,
  url: string,
  init: RequestInit,
  env: Env,
): Promise<Response> {
  if (env.LOCAL_CONTAINER_URL) {
    const localUrl = url.replace("http://container/", env.LOCAL_CONTAINER_URL + "/")
    const headers = new Headers(init.headers)
    headers.set("Connection", "close")
    const localInit = { ...init, headers }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetch(localUrl, localInit)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (
          attempt < 2 &&
          (msg.includes("Cannot assign requested address") ||
            msg.includes("ECONNREFUSED") ||
            msg.includes("ECONNRESET"))
        ) {
          console.warn(
            `[containerFetch] Attempt ${attempt + 1} failed (${msg}), retrying in ${(attempt + 1) * 500}ms...`,
          )
          await new Promise((r) => setTimeout(r, (attempt + 1) * 500))
          continue
        }
        throw err
      }
    }
    throw new Error("containerFetch: unreachable")
  }
  return container!.fetch(url, init)
}

function getContainer(env: Env, planId: string) {
  if (env.LOCAL_CONTAINER_URL) return null
  return env.PDF_PROCESSOR.get(env.PDF_PROCESSOR.idFromName(planId))
}

async function ensureContainer(
  container: {
    fetch: (url: string, init?: RequestInit) => Promise<Response>
    startAndWaitForPorts: (opts?: any) => Promise<void>
  } | null,
  env: Env,
): Promise<void> {
  if (!container) return
  await container.startAndWaitForPorts({
    startOptions: {
      envVars: {
        ...(env.OPENROUTER_API_KEY && { OPENROUTER_API_KEY: env.OPENROUTER_API_KEY }),
        ...(env.OPENROUTER_MODEL && { OPENROUTER_MODEL: env.OPENROUTER_MODEL }),
      },
    },
  })
}

export class PlanProcessingWorkflow extends WorkflowEntrypoint<Env, PlanProcessingParams> {
  async run(event: WorkflowEvent<PlanProcessingParams>, step: WorkflowStep) {
    const { planId, organizationId } = event.payload

    try {
      return await this.pipeline(event, step)
    } catch (error) {
      try {
        await step.do("emit-processing-failed", async () => {
          const stub = getLiveStoreStub(this.env, organizationId)
          await commitEvent(stub, organizationId, "planProcessingFailed", {
            planId,
            error: error instanceof Error ? error.message : String(error),
            failedAt: Date.now(),
          })
        })
      } catch (emitError) {
        console.error(`[Workflow] Failed to emit planProcessingFailed:`, emitError)
      }
      throw error
    }
  }

  private async pipeline(event: WorkflowEvent<PlanProcessingParams>, step: WorkflowStep) {
    const { planId, projectId, organizationId, pdfPath, planName } = event.payload

    // Step 0: Emit processing started
    await step.do("emit-processing-started", async () => {
      const stub = getLiveStoreStub(this.env, organizationId)
      await commitEvent(stub, organizationId, "planProcessingStarted", {
        planId,
        startedAt: Date.now(),
      })
      await emitProgress(stub, organizationId, planId, 0)
    })

    // Step 1: Get PDF page metadata from container
    const sheets = await step.do(
      "generate-images",
      {
        retries: { limit: 3, delay: "5 seconds", backoff: "linear" },
        timeout: "5 minutes",
      },
      async () => {
        const pdfData = await this.env.R2_BUCKET.get(pdfPath)
        if (!pdfData) throw new NonRetryableError(`PDF not found at ${pdfPath}`)
        const pdfBuffer = await pdfData.arrayBuffer()

        const container = getContainer(this.env, planId)
        await ensureContainer(container as any, this.env)

        const response = await containerFetch(
          container,
          "http://container/generate-images",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/pdf",
              "X-Plan-Id": planId,
              "X-Project-Id": projectId,
              "X-Organization-Id": organizationId,
              "X-Total-Pages": String(event.payload.totalPages),
            },
            body: pdfBuffer,
          },
          this.env,
        )

        if (!response.ok) {
          throw new Error(`Container returned ${response.status}: ${await response.text()}`)
        }

        const result = (await response.json()) as {
          sheets: Array<{ sheetId: string; width: number; height: number; pageNumber: number }>
          totalPages: number
        }

        console.log(`[Workflow] PDF has ${result.totalPages} pages`)
        return result.sheets.map((s) => ({
          sheetId: s.sheetId,
          width: s.width,
          height: s.height,
          pageNumber: s.pageNumber,
        }))
      },
    )

    // Emit progress after getting page metadata
    await step.do("emit-images-progress", async () => {
      const stub = getLiveStoreStub(this.env, organizationId)
      await emitProgress(stub, organizationId, planId, 10)
    })

    // Step 2: Render each page to PNG and upload to R2
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i]
      await step.do(
        `render-page-${sheet.sheetId}`,
        {
          retries: { limit: 3, delay: "5 seconds", backoff: "linear" },
          timeout: "5 minutes",
        },
        async () => {
          const pdfData = await this.env.R2_BUCKET.get(pdfPath)
          if (!pdfData) throw new NonRetryableError(`PDF not found at ${pdfPath}`)
          const pdfBuffer = await pdfData.arrayBuffer()

          const container = getContainer(this.env, planId)
          await ensureContainer(container as any, this.env)

          const renderResponse = await containerFetch(
            container,
            "http://container/render-page",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/pdf",
                "X-Plan-Id": planId,
                "X-Page-Number": sheet.pageNumber.toString(),
              },
              body: pdfBuffer,
            },
            this.env,
          )

          if (!renderResponse.ok) {
            throw new Error(
              `Failed to render page ${sheet.pageNumber}: ${await renderResponse.text()}`,
            )
          }

          const pngData = await renderResponse.arrayBuffer()
          const r2Path = getR2Path(organizationId, projectId, planId, sheet.sheetId, "source.png")

          await this.env.R2_BUCKET.put(r2Path, pngData, {
            httpMetadata: { contentType: "image/png" },
          })

          console.log(`[Workflow] Uploaded ${r2Path} (${pngData.byteLength} bytes)`)

          const stub = getLiveStoreStub(this.env, organizationId)
          try {
            await commitEvent(stub, organizationId, "sheetImageGenerated", {
              sheetId: sheet.sheetId,
              projectId,
              planId,
              planName,
              pageNumber: sheet.pageNumber,
              localImagePath: r2Path,
              remoteImagePath: `/api/r2/${r2Path}`,
              width: sheet.width,
              height: sheet.height,
              generatedAt: Date.now(),
            })
          } catch (liveStoreError) {
            console.warn(`[Workflow] LiveStore emit failed for ${sheet.sheetId}:`, liveStoreError)
          }

          const progress = Math.round(10 + ((i + 1) / sheets.length) * 15)
          await emitProgress(stub, organizationId, planId, progress)
        },
      )
    }

    // Step 3: Extract metadata per sheet
    const metadataResults: Array<{
      sheetId: string
      sheetNumber: string | null
      isValid: boolean
    }> = []

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i]
      const metadata = await step.do(
        `extract-metadata-${sheet.sheetId}`,
        {
          retries: { limit: 3, delay: "5 seconds", backoff: "linear" },
          timeout: "5 minutes",
        },
        async () => {
          const imagePath = getR2Path(
            organizationId,
            projectId,
            planId,
            sheet.sheetId,
            "source.png",
          )
          const imageData = await this.env.R2_BUCKET.get(imagePath)
          if (!imageData) throw new NonRetryableError(`Image not found at ${imagePath}`)

          const container = getContainer(this.env, planId)
          await ensureContainer(container as any, this.env)

          const response = await containerFetch(
            container,
            "http://container/extract-metadata",
            {
              method: "POST",
              headers: {
                "Content-Type": "image/png",
                "X-Sheet-Id": sheet.sheetId,
                "X-Plan-Id": planId,
              },
              body: await imageData.arrayBuffer(),
            },
            this.env,
          )

          if (!response.ok) {
            throw new Error(`Container returned ${response.status}: ${await response.text()}`)
          }

          const result = (await response.json()) as {
            sheetNumber: string | null
            title?: string | null
            discipline?: string | null
            isValid: boolean
          }

          console.log(
            `[Workflow] Sheet ${sheet.sheetId}: number=${result.sheetNumber}, valid=${result.isValid}`,
          )

          const stub = getLiveStoreStub(this.env, organizationId)
          try {
            await commitEvent(stub, organizationId, "sheetMetadataExtracted", {
              sheetId: sheet.sheetId,
              planId,
              sheetNumber: result.sheetNumber ?? "unknown",
              sheetTitle: result.title ?? undefined,
              discipline: result.discipline ?? undefined,
              extractedAt: Date.now(),
            })
          } catch (liveStoreError) {
            console.warn(`[Workflow] LiveStore emit failed for ${sheet.sheetId}:`, liveStoreError)
          }

          const progress = Math.round(25 + ((i + 1) / sheets.length) * 25)
          await emitProgress(stub, organizationId, planId, progress)

          return {
            sheetId: sheet.sheetId,
            sheetNumber: result.sheetNumber,
            isValid: result.isValid,
          }
        },
      )
      metadataResults.push(metadata)
    }

    // Build valid sheets list and sheet number map
    const validSheetIds: string[] = []
    const sheetNumberMap: Record<string, string> = {}
    for (const m of metadataResults) {
      if (m.isValid && m.sheetNumber) {
        validSheetIds.push(m.sheetId)
        sheetNumberMap[m.sheetId] = m.sheetNumber
      }
    }
    const validSheetNumbers = validSheetIds.map((id) => sheetNumberMap[id])

    console.log(
      `[Workflow] Valid sheets: ${validSheetIds.length}, numbers: ${validSheetNumbers.join(", ")}`,
    )

    // Emit metadata completed
    await step.do("emit-metadata-completed", async () => {
      const stub = getLiveStoreStub(this.env, organizationId)
      await commitEvent(stub, organizationId, "planMetadataCompleted", {
        planId,
        validSheets: validSheetIds,
        sheetNumberMap,
        completedAt: Date.now(),
      })
    })

    // Step 4: Detect callouts per valid sheet
    for (let ci = 0; ci < validSheetIds.length; ci++) {
      const sheetId = validSheetIds[ci]
      await step.do(
        `detect-callouts-${sheetId}`,
        {
          retries: { limit: 3, delay: "5 seconds", backoff: "linear" },
          timeout: "10 minutes",
        },
        async () => {
          const imagePath = getR2Path(organizationId, projectId, planId, sheetId, "source.png")
          const imageData = await this.env.R2_BUCKET.get(imagePath)
          if (!imageData) throw new NonRetryableError(`Image not found at ${imagePath}`)

          const container = getContainer(this.env, planId)
          await ensureContainer(container as any, this.env)

          const response = await containerFetch(
            container,
            "http://container/detect-callouts",
            {
              method: "POST",
              headers: {
                "Content-Type": "image/png",
                "X-Sheet-Id": sheetId,
                "X-Plan-Id": planId,
                "X-Sheet-Number": sheetNumberMap[sheetId] ?? "",
                "X-Valid-Sheet-Numbers": JSON.stringify(validSheetNumbers),
              },
              body: await imageData.arrayBuffer(),
            },
            this.env,
          )

          if (!response.ok) {
            throw new Error(`Container returned ${response.status}: ${await response.text()}`)
          }

          const result = (await response.json()) as {
            markers?: Array<{
              id: string
              label: string
              targetSheetRef?: string
              targetSheetId?: string
              x: number
              y: number
              width?: number
              height?: number
              confidence: number
              needsReview: boolean
            }>
            unmatchedCount?: number
            grid_bubbles?: Array<{
              class: string
              label: string
              x: number
              y: number
              width: number
              height: number
              confidence: number
            }>
          }

          const rawMarkers = result.markers ?? []
          const markers = rawMarkers.map((m) => ({
            id: m.id,
            label: m.label ?? "",
            targetSheetRef: m.targetSheetRef ?? undefined,
            targetSheetId: m.targetSheetId ?? undefined,
            x: m.x,
            y: m.y,
            width: m.width,
            height: m.height,
            confidence: m.confidence,
            needsReview: m.needsReview,
          }))

          const stub = getLiveStoreStub(this.env, organizationId)
          try {
            await commitEvent(stub, organizationId, "sheetCalloutsDetected", {
              sheetId,
              planId,
              markers,
              unmatchedCount: result.unmatchedCount ?? 0,
              detectedAt: Date.now(),
            })
          } catch (liveStoreError) {
            console.warn(`[Workflow] LiveStore callout emit failed for ${sheetId}:`, liveStoreError)
          }

          if (result.grid_bubbles && result.grid_bubbles.length > 0) {
            try {
              const bubbles = result.grid_bubbles.map((b, idx) => ({
                id: `bubble-${sheetId}-${idx}`,
                label: b.label || "",
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height,
                confidence: b.confidence,
                createdAt: Date.now(),
              }))
              await commitEvent(stub, organizationId, "sheetGridBubblesDetected", {
                sheetId,
                bubbles,
                detectedAt: Date.now(),
              })
              console.log(`[Workflow] Emitted ${bubbles.length} grid bubbles for ${sheetId}`)
            } catch (gridBubbleError) {
              console.warn(`[Workflow] Grid bubble event failed for ${sheetId}:`, gridBubbleError)
            }
          }

          const calloutProgress = Math.round(50 + ((ci + 1) / validSheetIds.length) * 5)
          await emitProgress(stub, organizationId, planId, calloutProgress)
          console.log(`[Workflow] Callouts detected for ${sheetId}: ${markers.length} markers`)
        },
      )
    }

    // Step 5: Detect layout per valid sheet (non-critical — catch errors and continue)
    const layoutRegionsMap: Record<
      string,
      Array<{
        id: string
        regionClass: string
        regionTitle?: string
        x: number
        y: number
        width: number
        height: number
        confidence: number
      }>
    > = {}

    for (let li = 0; li < validSheetIds.length; li++) {
      const sheetId = validSheetIds[li]
      try {
        const regions = await step.do(
          `detect-layout-${sheetId}`,
          {
            retries: { limit: 2, delay: "5 seconds", backoff: "linear" },
            timeout: "10 minutes",
          },
          async () => {
            const imagePath = getR2Path(organizationId, projectId, planId, sheetId, "source.png")
            const imageData = await this.env.R2_BUCKET.get(imagePath)
            if (!imageData) throw new NonRetryableError(`Image not found at ${imagePath}`)

            const container = getContainer(this.env, planId)
            await ensureContainer(container as any, this.env)

            const response = await containerFetch(
              container,
              "http://container/detect-layout",
              {
                method: "POST",
                headers: {
                  "Content-Type": "image/png",
                  "X-Sheet-Id": sheetId,
                  "X-Plan-Id": planId,
                },
                body: await imageData.arrayBuffer(),
              },
              this.env,
            )

            if (!response.ok) {
              throw new Error(`Container returned ${response.status}: ${await response.text()}`)
            }

            const result = (await response.json()) as {
              regions: Array<{
                class: string
                bbox: [number, number, number, number]
                confidence: number
              }>
            }

            const regions = (result.regions ?? []).map((r, idx) => ({
              id: `region-${sheetId}-${idx}`,
              regionClass: r.class,
              x: r.bbox[0],
              y: r.bbox[1],
              width: r.bbox[2],
              height: r.bbox[3],
              confidence: r.confidence,
              createdAt: Date.now(),
            }))

            const stub = getLiveStoreStub(this.env, organizationId)
            try {
              await commitEvent(stub, organizationId, "sheetLayoutRegionsDetected", {
                sheetId,
                regions,
                detectedAt: Date.now(),
              })
            } catch (liveStoreError) {
              console.warn(`[Workflow] Layout event emit failed for ${sheetId}:`, liveStoreError)
            }

            const layoutProgress = Math.round(55 + ((li + 1) / validSheetIds.length) * 15)
            await emitProgress(stub, organizationId, planId, layoutProgress)
            console.log(`[Workflow] Layout detected for ${sheetId}: ${regions.length} regions`)

            return regions
          },
        )
        if (regions && regions.length > 0) {
          layoutRegionsMap[sheetId] = regions
        }
      } catch (error) {
        console.warn(
          `[Workflow] Layout detection failed for ${sheetId}, continuing pipeline:`,
          error,
        )
      }
    }

    // Step 5a: Extract content from detected layout regions (non-critical)
    const sheetsWithRegions = Object.keys(layoutRegionsMap)
    if (sheetsWithRegions.length > 0) {
      console.log(
        `[Workflow] Step 5a: Extracting content from ${sheetsWithRegions.length} sheets with layout regions`,
      )

      for (let si = 0; si < sheetsWithRegions.length; si++) {
        const sheetId = sheetsWithRegions[si]
        const regions = layoutRegionsMap[sheetId]

        try {
          await step.do(
            `extract-regions-${sheetId}`,
            {
              retries: { limit: 1, delay: "5 seconds", backoff: "linear" },
              timeout: "10 minutes",
            },
            async () => {
              const imagePath = getR2Path(
                organizationId,
                projectId,
                planId,
                sheetId,
                "source.png",
              )
              const imageData = await this.env.R2_BUCKET.get(imagePath)
              if (!imageData) {
                console.warn(`[Workflow] Image not found at ${imagePath}, skipping extraction`)
                return
              }
              const imageBuffer = await imageData.arrayBuffer()

              const container = getContainer(this.env, planId)
              await ensureContainer(container as any, this.env)
              const stub = getLiveStoreStub(this.env, organizationId)

              for (const region of regions) {
                try {
                  const bboxJson = JSON.stringify([
                    region.x,
                    region.y,
                    region.width,
                    region.height,
                  ])

                  if (region.regionClass === "schedule") {
                    const response = await containerFetch(
                      container,
                      "http://container/extract-schedule",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "image/png",
                          "X-Bbox": bboxJson,
                          "X-Region-Title": region.regionTitle ?? "",
                        },
                        body: imageBuffer,
                      },
                      this.env,
                    )

                    if (response.ok) {
                      const result = (await response.json()) as {
                        scheduleType?: string
                        entries?: Array<{
                          mark?: string
                          properties?: Record<string, unknown>
                        }>
                        confidence?: number
                        error?: string
                      }

                      if (!result.error && result.entries && result.entries.length > 0) {
                        const now = Date.now()
                        await commitEvent(stub, organizationId, "sheetScheduleExtracted", {
                          sheetId,
                          regionId: region.id,
                          scheduleType: result.scheduleType ?? "generic",
                          entries: result.entries.map((e, idx) => ({
                            id: `entry-${sheetId}-${region.id}-${idx}`,
                            mark: e.mark ?? "",
                            properties: JSON.stringify(e.properties ?? {}),
                            confidence: result.confidence ?? 0.5,
                            createdAt: now,
                          })),
                          extractedAt: now,
                        })
                        console.log(
                          `[Workflow] Schedule extracted for ${sheetId}/${region.id}: ${result.entries.length} entries`,
                        )
                      }
                    } else {
                      console.warn(
                        `[Workflow] Schedule extraction returned ${response.status} for ${sheetId}/${region.id}`,
                      )
                    }
                  } else if (region.regionClass === "notes") {
                    const response = await containerFetch(
                      container,
                      "http://container/extract-notes",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "image/png",
                          "X-Bbox": bboxJson,
                        },
                        body: imageBuffer,
                      },
                      this.env,
                    )

                    if (response.ok) {
                      const result = (await response.json()) as {
                        noteType?: string
                        title?: string
                        items?: Array<Record<string, unknown>>
                        confidence?: number
                        error?: string
                      }

                      if (!result.error && result.items && result.items.length > 0) {
                        await commitEvent(stub, organizationId, "sheetNotesExtracted", {
                          sheetId,
                          regionId: region.id,
                          content: JSON.stringify({
                            title: result.title,
                            items: result.items,
                          }),
                          noteType: result.noteType ?? "other",
                          extractedAt: Date.now(),
                        })
                        console.log(
                          `[Workflow] Notes extracted for ${sheetId}/${region.id}: ${result.items.length} items`,
                        )
                      }
                    } else {
                      console.warn(
                        `[Workflow] Notes extraction returned ${response.status} for ${sheetId}/${region.id}`,
                      )
                    }
                  } else if (region.regionClass === "legend") {
                    const response = await containerFetch(
                      container,
                      "http://container/crop-region",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "image/png",
                          "X-Bbox": bboxJson,
                        },
                        body: imageBuffer,
                      },
                      this.env,
                    )

                    if (response.ok) {
                      const cropData = await response.arrayBuffer()
                      const cropPath = getR2Path(
                        organizationId,
                        projectId,
                        planId,
                        sheetId,
                        `legend-${region.id}.png`,
                      )
                      await this.env.R2_BUCKET.put(cropPath, cropData, {
                        httpMetadata: { contentType: "image/png" },
                      })

                      await commitEvent(stub, organizationId, "sheetLegendCropped", {
                        sheetId,
                        regionId: region.id,
                        cropImageUrl: `/api/r2/${cropPath}`,
                        croppedAt: Date.now(),
                      })
                      console.log(
                        `[Workflow] Legend cropped for ${sheetId}/${region.id}: ${cropData.byteLength} bytes`,
                      )
                    } else {
                      console.warn(
                        `[Workflow] Legend crop returned ${response.status} for ${sheetId}/${region.id}`,
                      )
                    }
                  }
                } catch (regionError) {
                  console.warn(
                    `[Workflow] Region extraction failed for ${sheetId}/${region.id}:`,
                    regionError,
                  )
                }
              }

              const extractionProgress = Math.round(
                70 + ((si + 1) / sheetsWithRegions.length) * 10,
              )
              await emitProgress(stub, organizationId, planId, extractionProgress)
            },
          )
        } catch (error) {
          console.warn(
            `[Workflow] Extraction step failed for ${sheetId}, continuing pipeline:`,
            error,
          )
        }
      }
    }

    // Step 6: Generate tiles per valid sheet
    for (let i = 0; i < validSheetIds.length; i++) {
      const sheetId = validSheetIds[i]
      await step.do(
        `generate-tiles-${sheetId}`,
        {
          retries: { limit: 3, delay: "5 seconds", backoff: "linear" },
          timeout: "10 minutes",
        },
        async () => {
          const imagePath = getR2Path(organizationId, projectId, planId, sheetId, "source.png")
          const imageData = await this.env.R2_BUCKET.get(imagePath)
          if (!imageData) throw new NonRetryableError(`Image not found at ${imagePath}`)

          const container = getContainer(this.env, planId)
          await ensureContainer(container as any, this.env)

          const response = await containerFetch(
            container,
            "http://container/generate-tiles",
            {
              method: "POST",
              headers: {
                "Content-Type": "image/png",
                "X-Sheet-Id": sheetId,
                "X-Plan-Id": planId,
                "X-Organization-Id": organizationId,
                "X-Project-Id": projectId,
              },
              body: await imageData.arrayBuffer(),
            },
            this.env,
          )

          if (!response.ok) {
            throw new Error(`Container returned ${response.status}: ${await response.text()}`)
          }

          const minZoom = parseInt(response.headers.get("X-Min-Zoom") ?? "0", 10)
          const maxZoom = parseInt(response.headers.get("X-Max-Zoom") ?? "5", 10)
          const pmtilesData = await response.arrayBuffer()

          const pmtilesPath = getR2Path(organizationId, projectId, planId, sheetId, "tiles.pmtiles")
          await this.env.R2_BUCKET.put(pmtilesPath, pmtilesData, {
            httpMetadata: { contentType: "application/x-pmtiles" },
          })

          console.log(
            `[Workflow] Generated tiles for ${sheetId}: ${pmtilesData.byteLength} bytes, zoom ${minZoom}-${maxZoom}`,
          )

          const stub = getLiveStoreStub(this.env, organizationId)
          try {
            await commitEvent(stub, organizationId, "sheetTilesGenerated", {
              sheetId,
              planId,
              localPmtilesPath: pmtilesPath,
              remotePmtilesPath: `/api/r2/${pmtilesPath}`,
              minZoom,
              maxZoom,
              generatedAt: Date.now(),
            })
          } catch (liveStoreError) {
            console.warn(`[Workflow] LiveStore tiles emit failed for ${sheetId}:`, liveStoreError)
          }

          const progress = Math.round(80 + ((i + 1) / validSheetIds.length) * 19)
          await emitProgress(stub, organizationId, planId, Math.min(progress, 99))
        },
      )
    }

    // Final step: Emit processing complete
    await step.do("emit-processing-complete", async () => {
      const stub = getLiveStoreStub(this.env, organizationId)
      await commitEvent(stub, organizationId, "planProcessingCompleted", {
        planId,
        sheetCount: validSheetIds.length,
        completedAt: Date.now(),
      })
      await emitProgress(stub, organizationId, planId, 100)
    })

    console.log(`[Workflow] Plan ${planId} processing complete: ${validSheetIds.length} sheets`)
    return { planId, sheetsProcessed: validSheetIds.length }
  }
}
