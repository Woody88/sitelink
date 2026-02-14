import type { Env } from "../types/env"
import type {
  CalloutDetectionJob,
  DocLayoutDetectionJob,
  ImageGenerationJob,
  MetadataExtractionJob,
  TileGenerationJob,
} from "./types"
import { getR2Path } from "./types"

async function emitProgressEvent(
  env: Env,
  organizationId: string,
  planId: string,
  stage: string,
  progress: number,
  message: string,
): Promise<void> {
  try {
    const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
      env.LIVESTORE_CLIENT_DO.idFromName(organizationId),
    )

    await liveStoreStub.fetch("http://internal/commit?storeId=" + organizationId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "planProcessingProgress",
        data: {
          planId,
          stage,
          progress,
          message,
          updatedAt: Date.now(),
        },
      }),
    })
  } catch (error) {
    console.warn(`[Progress] LiveStore emit failed:`, error)
  }
}

export async function handleImageGenerationQueue(
  batch: MessageBatch<ImageGenerationJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body
    console.log(`[ImageGeneration] Processing plan ${job.planId}`)

    try {
      await emitProgressEvent(
        env,
        job.organizationId,
        job.planId,
        "image_generation",
        0,
        "Starting image generation...",
      )

      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)

      // Call the container to generate images from PDF
      const pdfR2Path = job.pdfPath
      const pdfData = await env.R2_BUCKET.get(pdfR2Path)

      if (!pdfData) {
        throw new Error(`PDF not found at ${pdfR2Path}`)
      }

      // Read PDF data once and reuse
      const pdfBuffer = await pdfData.arrayBuffer()

      // Send PDF to container for image generation
      // Get a Container DO instance (Cloudflare Containers are Durable Objects)
      const containerId = env.PDF_PROCESSOR.idFromName(job.planId)
      const container = env.PDF_PROCESSOR.get(containerId)

      // Start container with environment variables injected from worker env
      // This ensures LLM API keys are available for later metadata extraction
      await container.startAndWaitForPorts({
        startOptions: {
          envVars: {
            ...(env.OPENROUTER_API_KEY && {
              OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
            }),
            ...(env.OPENROUTER_MODEL && {
              OPENROUTER_MODEL: env.OPENROUTER_MODEL,
            }),
          },
        },
      })

      const response = await container.fetch("http://container/generate-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          "X-Plan-Id": job.planId,
          "X-Project-Id": job.projectId,
          "X-Organization-Id": job.organizationId,
          "X-Total-Pages": job.totalPages.toString(),
        },
        body: pdfBuffer,
      })

      if (!response.ok) {
        throw new Error(`Container returned ${response.status}: ${await response.text()}`)
      }

      // Container returns JSON with sheet metadata
      const result = (await response.json()) as {
        sheets: Array<{
          sheetId: string
          width: number
          height: number
          pageNumber: number
        }>
        totalPages: number
      }

      // Initialize coordinator with ACTUAL page count from container
      await coordinator.initialize({
        planId: job.planId,
        projectId: job.projectId,
        organizationId: job.organizationId,
        totalSheets: result.totalPages,
      })

      await emitProgressEvent(
        env,
        job.organizationId,
        job.planId,
        "image_generation",
        10,
        `Rendering ${result.totalPages} pages...`,
      )

      for (let i = 0; i < result.sheets.length; i++) {
        const sheet = result.sheets[i]
        const pageProgress = Math.round(10 + (i / result.sheets.length) * 15)
        // Call container to render this specific page as PNG
        const renderResponse = await container.fetch("http://container/render-page", {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-Plan-Id": job.planId,
            "X-Page-Number": sheet.pageNumber.toString(),
          },
          body: pdfBuffer,
        })

        if (!renderResponse.ok) {
          throw new Error(
            `Failed to render page ${sheet.pageNumber}: ${await renderResponse.text()}`,
          )
        }

        // Get PNG data from response
        const pngData = await renderResponse.arrayBuffer()

        // Upload to R2
        const r2Path = getR2Path(
          job.organizationId,
          job.projectId,
          job.planId,
          sheet.sheetId,
          "source.png",
        )

        await env.R2_BUCKET.put(r2Path, pngData, {
          httpMetadata: { contentType: "image/png" },
        })

        console.log(`[ImageGeneration] Uploaded ${r2Path} (${pngData.byteLength} bytes)`)

        // Notify coordinator
        await coordinator.sheetImageGenerated(sheet.sheetId)

        // Emit LiveStore event (non-critical)
        try {
          const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
            env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
          )

          await liveStoreStub.fetch("http://internal/commit?storeId=" + job.organizationId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventName: "sheetImageGenerated",
              data: {
                sheetId: sheet.sheetId,
                projectId: job.projectId,
                planId: job.planId,
                planName: job.planName,
                pageNumber: sheet.pageNumber,
                localImagePath: r2Path,
                remoteImagePath: `/api/r2/${r2Path}`,
                width: sheet.width,
                height: sheet.height,
                generatedAt: Date.now(),
              },
            }),
          })
        } catch (liveStoreError) {
          console.warn(
            `[ImageGeneration] LiveStore emit failed for ${sheet.sheetId}:`,
            liveStoreError,
          )
        }
      }

      message.ack()
      console.log(`[ImageGeneration] Completed plan ${job.planId}`)
    } catch (error) {
      console.error(`[ImageGeneration] Failed for plan ${job.planId}:`, error)
      message.retry()
    }
  }
}

export async function handleMetadataExtractionQueue(
  batch: MessageBatch<MetadataExtractionJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body
    console.log(`[MetadataExtraction] Processing sheet ${job.sheetId}`)

    try {
      const metadataProgress = Math.round(25 + ((job.sheetNumber - 1) / job.totalSheets) * 25)
      await emitProgressEvent(
        env,
        job.organizationId,
        job.planId,
        "metadata_extraction",
        metadataProgress,
        `Extracting metadata from sheet ${job.sheetNumber}/${job.totalSheets}...`,
      )

      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)

      // Get the sheet image from R2
      const imagePath = getR2Path(
        job.organizationId,
        job.projectId,
        job.planId,
        job.sheetId,
        "source.png",
      )
      const imageData = await env.R2_BUCKET.get(imagePath)

      if (!imageData) {
        throw new Error(`Image not found at ${imagePath}`)
      }

      // Send image to container for OCR/LLM extraction
      const containerId = env.PDF_PROCESSOR.idFromName(job.planId)
      const container = env.PDF_PROCESSOR.get(containerId)

      // Start container with environment variables injected from worker env
      // This is the Cloudflare Containers way to pass secrets to the container
      await container.startAndWaitForPorts({
        startOptions: {
          envVars: {
            ...(env.OPENROUTER_API_KEY && {
              OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
            }),
            ...(env.OPENROUTER_MODEL && {
              OPENROUTER_MODEL: env.OPENROUTER_MODEL,
            }),
          },
        },
      })

      const response = await container.fetch("http://container/extract-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Sheet-Id": job.sheetId,
          "X-Plan-Id": job.planId,
        },
        body: await imageData.arrayBuffer(),
      })

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
        `[MetadataExtraction] Sheet ${job.sheetId} result: sheetNumber=${result.sheetNumber}, isValid=${result.isValid}`,
      )

      // Notify coordinator with sheet number for callout detection
      // CRITICAL: sheetNumber is required for callout detection to match targets
      const sheetNumber = result.sheetNumber ?? undefined
      if (result.isValid && !sheetNumber) {
        console.warn(`[MetadataExtraction] Sheet ${job.sheetId} is valid but has NO sheet number!`)
      }
      await coordinator.sheetMetadataExtracted(job.sheetId, result.isValid, sheetNumber)

      // Emit LiveStore event (non-critical, don't fail pipeline if this fails)
      try {
        const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
          env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
        )

        await liveStoreStub.fetch("http://internal/commit?storeId=" + job.organizationId, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: "sheetMetadataExtracted",
            data: {
              sheetId: job.sheetId,
              planId: job.planId,
              sheetNumber: result.sheetNumber ?? "unknown",
              // Convert null to undefined for Schema.optional compatibility
              sheetTitle: result.title ?? undefined,
              discipline: result.discipline ?? undefined,
              extractedAt: Date.now(),
            },
          }),
        })
      } catch (liveStoreError) {
        console.warn(
          `[MetadataExtraction] LiveStore emit failed for ${job.sheetId}:`,
          liveStoreError,
        )
      }

      message.ack()
      console.log(`[MetadataExtraction] Completed sheet ${job.sheetId}`)
    } catch (error) {
      console.error(`[MetadataExtraction] Failed for sheet ${job.sheetId}:`, error)
      message.retry()
    }
  }
}

export async function handleCalloutDetectionQueue(
  batch: MessageBatch<CalloutDetectionJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body
    console.log(`[CalloutDetection] Processing sheet ${job.sheetId}`)

    try {
      await emitProgressEvent(
        env,
        job.organizationId,
        job.planId,
        "callout_detection",
        50,
        `Detecting callouts on sheet ${job.sheetNumber || job.sheetId}...`,
      )

      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)

      // Get the sheet image from R2
      const imagePath = getR2Path(
        job.organizationId,
        job.projectId,
        job.planId,
        job.sheetId,
        "source.png",
      )
      const imageData = await env.R2_BUCKET.get(imagePath)

      if (!imageData) {
        throw new Error(`Image not found at ${imagePath}`)
      }

      // Send image to container for callout detection (OpenCV + LLM)
      const containerId = env.PDF_PROCESSOR.idFromName(job.planId)
      const container = env.PDF_PROCESSOR.get(containerId)

      // Start container with LLM credentials for callout text recognition
      await container.startAndWaitForPorts({
        startOptions: {
          envVars: {
            ...(env.OPENROUTER_API_KEY && {
              OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
            }),
            ...(env.OPENROUTER_MODEL && {
              OPENROUTER_MODEL: env.OPENROUTER_MODEL,
            }),
          },
        },
      })

      const response = await container.fetch("http://container/detect-callouts", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Sheet-Id": job.sheetId,
          "X-Plan-Id": job.planId,
          "X-Sheet-Number": job.sheetNumber ?? "",
          "X-Valid-Sheet-Numbers": JSON.stringify(job.validSheetNumbers),
        },
        body: await imageData.arrayBuffer(),
      })

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
          confidence: number
          needsReview: boolean
        }>
        unmatchedCount?: number
      }

      // Ensure markers is always an array and convert null to undefined for Schema.optional
      const rawMarkers = result.markers ?? []
      const markers = rawMarkers.map((m) => ({
        id: m.id,
        label: m.label,
        targetSheetRef: m.targetSheetRef ?? undefined,
        targetSheetId: m.targetSheetId ?? undefined,
        x: m.x,
        y: m.y,
        confidence: m.confidence,
        needsReview: m.needsReview,
      }))
      const unmatchedCount = result.unmatchedCount ?? 0

      // Notify coordinator
      await coordinator.sheetCalloutsDetected(job.sheetId)

      // Emit LiveStore event (non-critical, don't fail pipeline if this fails)
      try {
        const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
          env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
        )

        await liveStoreStub.fetch("http://internal/commit?storeId=" + job.organizationId, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: "sheetCalloutsDetected",
            data: {
              sheetId: job.sheetId,
              planId: job.planId,
              markers,
              unmatchedCount,
              detectedAt: Date.now(),
            },
          }),
        })
      } catch (liveStoreError) {
        console.warn(`[CalloutDetection] LiveStore emit failed for ${job.sheetId}:`, liveStoreError)
      }

      message.ack()
      console.log(
        `[CalloutDetection] Completed sheet ${job.sheetId}, found ${markers.length} markers`,
      )
    } catch (error) {
      console.error(`[CalloutDetection] Failed for sheet ${job.sheetId}:`, error)
      message.retry()
    }
  }
}

export async function handleDocLayoutDetectionQueue(
  batch: MessageBatch<DocLayoutDetectionJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body
    console.log(`[DocLayout] Processing sheet ${job.sheetId}`)

    try {
      await emitProgressEvent(
        env,
        job.organizationId,
        job.planId,
        "layout_detection",
        55,
        `Detecting layout regions on sheet ${job.sheetNumber || job.sheetId}...`,
      )

      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)

      // Get the sheet image from R2
      const imagePath = getR2Path(
        job.organizationId,
        job.projectId,
        job.planId,
        job.sheetId,
        "source.png",
      )
      const imageData = await env.R2_BUCKET.get(imagePath)

      if (!imageData) {
        throw new Error(`Image not found at ${imagePath}`)
      }

      // Send image to container for DocLayout detection
      const containerId = env.PDF_PROCESSOR.idFromName(job.planId)
      const container = env.PDF_PROCESSOR.get(containerId)

      await container.startAndWaitForPorts()

      const response = await container.fetch("http://container/detect-layout", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Sheet-Id": job.sheetId,
          "X-Plan-Id": job.planId,
        },
        body: await imageData.arrayBuffer(),
      })

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

      const regions = (result.regions ?? []).map((r, i) => ({
        id: `region-${job.sheetId}-${i}-${Date.now()}`,
        regionClass: r.class,
        x: r.bbox[0],
        y: r.bbox[1],
        width: r.bbox[2],
        height: r.bbox[3],
        confidence: r.confidence,
        createdAt: Date.now(),
      }))

      // Notify coordinator that layout detection is done for this sheet
      await coordinator.fetch("http://internal/sheetLayoutDetected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId: job.sheetId }),
      })

      // Emit LiveStore event (non-critical)
      try {
        const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
          env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
        )

        await liveStoreStub.fetch("http://internal/commit?storeId=" + job.organizationId, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: "sheetLayoutRegionsDetected",
            data: {
              sheetId: job.sheetId,
              regions,
              detectedAt: Date.now(),
            },
          }),
        })
      } catch (liveStoreError) {
        console.warn(`[DocLayout] LiveStore emit failed for ${job.sheetId}:`, liveStoreError)
      }

      message.ack()
      console.log(`[DocLayout] Completed sheet ${job.sheetId}, found ${regions.length} regions`)
    } catch (error) {
      console.error(`[DocLayout] Failed for sheet ${job.sheetId}:`, error)
      // Layout detection is supplementary — ack the message to avoid blocking pipeline
      // Log the error but don't retry (don't call message.retry())
      message.ack()

      // Still notify coordinator so pipeline isn't stuck waiting
      try {
        const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
        const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)
        await coordinator.fetch("http://internal/sheetLayoutDetected", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetId: job.sheetId }),
        })
      } catch (coordError) {
        console.error(`[DocLayout] Failed to notify coordinator for ${job.sheetId}:`, coordError)
      }
    }
  }
}

export async function handleTileGenerationQueue(
  batch: MessageBatch<TileGenerationJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body
    console.log(`[TileGeneration] Processing sheet ${job.sheetId}`)

    try {
      await emitProgressEvent(
        env,
        job.organizationId,
        job.planId,
        "tile_generation",
        75,
        `Generating tiles for sheet ${job.sheetId}...`,
      )

      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)

      // Get the sheet image from R2
      const imagePath = getR2Path(
        job.organizationId,
        job.projectId,
        job.planId,
        job.sheetId,
        "source.png",
      )
      const imageData = await env.R2_BUCKET.get(imagePath)

      if (!imageData) {
        throw new Error(`Image not found at ${imagePath}`)
      }

      // Send image to container for PMTiles generation (pyvips → MBTiles → PMTiles)
      const containerId = env.PDF_PROCESSOR.idFromName(job.planId)
      const container = env.PDF_PROCESSOR.get(containerId)

      await container.startAndWaitForPorts()

      const response = await container.fetch("http://container/generate-tiles", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Sheet-Id": job.sheetId,
          "X-Plan-Id": job.planId,
          "X-Organization-Id": job.organizationId,
          "X-Project-Id": job.projectId,
        },
        body: await imageData.arrayBuffer(),
      })

      if (!response.ok) {
        throw new Error(`Container returned ${response.status}: ${await response.text()}`)
      }

      // Read zoom levels from response headers (set by container based on image dimensions)
      const minZoom = parseInt(response.headers.get("X-Min-Zoom") ?? "0", 10)
      const maxZoom = parseInt(response.headers.get("X-Max-Zoom") ?? "5", 10)

      // Container returns PMTiles file as binary
      const pmtilesData = await response.arrayBuffer()

      console.log(
        `[TileGeneration] Received PMTiles: ${pmtilesData.byteLength} bytes, zoom ${minZoom}-${maxZoom}`,
      )

      // Upload to R2
      const pmtilesPath = getR2Path(
        job.organizationId,
        job.projectId,
        job.planId,
        job.sheetId,
        "tiles.pmtiles",
      )

      await env.R2_BUCKET.put(pmtilesPath, pmtilesData, {
        httpMetadata: { contentType: "application/x-pmtiles" },
      })

      // Notify coordinator
      await coordinator.sheetTilesGenerated(job.sheetId)

      // Emit LiveStore event (non-critical, don't fail pipeline if this fails)
      try {
        const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
          env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
        )

        await liveStoreStub.fetch("http://internal/commit?storeId=" + job.organizationId, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: "sheetTilesGenerated",
            data: {
              sheetId: job.sheetId,
              planId: job.planId,
              localPmtilesPath: pmtilesPath,
              remotePmtilesPath: `/api/r2/${pmtilesPath}`,
              minZoom,
              maxZoom,
              generatedAt: Date.now(),
            },
          }),
        })
      } catch (liveStoreError) {
        console.warn(`[TileGeneration] LiveStore emit failed for ${job.sheetId}:`, liveStoreError)
      }

      message.ack()
      console.log(
        `[TileGeneration] Completed sheet ${job.sheetId} (${pmtilesData.byteLength} bytes, zoom ${minZoom}-${maxZoom})`,
      )
    } catch (error) {
      console.error(`[TileGeneration] Failed for sheet ${job.sheetId}:`, error)
      message.retry()
    }
  }
}
