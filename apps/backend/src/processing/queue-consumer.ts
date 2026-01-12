import type { Env } from "../types/env"
import type {
  ImageGenerationJob,
  MetadataExtractionJob,
  CalloutDetectionJob,
  TileGenerationJob,
} from "./types"
import { getR2Path } from "./types"

export async function handleImageGenerationQueue(
  batch: MessageBatch<ImageGenerationJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body
    console.log(`[ImageGeneration] Processing plan ${job.planId}`)

    try {
      // Get PlanCoordinator DO for this plan
      const coordinatorId = env.PLAN_COORDINATOR_DO.idFromName(job.planId)
      const coordinator = env.PLAN_COORDINATOR_DO.get(coordinatorId)

      // Initialize coordinator
      await coordinator.initialize({
        planId: job.planId,
        projectId: job.projectId,
        organizationId: job.organizationId,
        totalSheets: job.totalPages,
      })

      // Call the container to generate images from PDF
      const pdfR2Path = job.pdfPath
      const pdfData = await env.R2_BUCKET.get(pdfR2Path)

      if (!pdfData) {
        throw new Error(`PDF not found at ${pdfR2Path}`)
      }

      // Send PDF to container for image generation
      const response = await env.PDF_PROCESSOR_CONTAINER.fetch(
        "http://container/generate-images",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-Plan-Id": job.planId,
            "X-Project-Id": job.projectId,
            "X-Organization-Id": job.organizationId,
            "X-Total-Pages": job.totalPages.toString(),
          },
          body: await pdfData.arrayBuffer(),
        },
      )

      if (!response.ok) {
        throw new Error(`Container returned ${response.status}: ${await response.text()}`)
      }

      // Container returns JSON with generated sheet info
      const result = (await response.json()) as {
        sheets: Array<{ sheetId: string; imagePath: string; width: number; height: number }>
      }

      // Upload images to R2 and notify coordinator
      for (const sheet of result.sheets) {
        await coordinator.sheetImageGenerated(sheet.sheetId)
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

      // Send image to container for OCR
      const response = await env.PDF_PROCESSOR_CONTAINER.fetch(
        "http://container/extract-metadata",
        {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            "X-Sheet-Id": job.sheetId,
            "X-Plan-Id": job.planId,
          },
          body: await imageData.arrayBuffer(),
        },
      )

      if (!response.ok) {
        throw new Error(`Container returned ${response.status}: ${await response.text()}`)
      }

      const result = (await response.json()) as {
        sheetNumber: string
        title?: string
        discipline?: string
        isValid: boolean
      }

      // Notify coordinator
      await coordinator.sheetMetadataExtracted(job.sheetId, result.isValid)

      // Emit LiveStore event
      const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
        env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
      )

      await liveStoreStub.fetch("http://internal/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "sheetMetadataExtracted",
          data: {
            sheetId: job.sheetId,
            planId: job.planId,
            sheetNumber: result.sheetNumber,
            sheetTitle: result.title,
            discipline: result.discipline,
            extractedAt: Date.now(),
          },
        }),
      })

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
      const response = await env.PDF_PROCESSOR_CONTAINER.fetch(
        "http://container/detect-callouts",
        {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            "X-Sheet-Id": job.sheetId,
            "X-Plan-Id": job.planId,
            "X-Valid-Sheets": JSON.stringify(job.validSheets),
          },
          body: await imageData.arrayBuffer(),
        },
      )

      if (!response.ok) {
        throw new Error(`Container returned ${response.status}: ${await response.text()}`)
      }

      const result = (await response.json()) as {
        markers: Array<{
          id: string
          label: string
          targetSheetRef?: string
          targetSheetId?: string
          x: number
          y: number
          confidence: number
          needsReview: boolean
        }>
        unmatchedCount: number
      }

      // Notify coordinator
      await coordinator.sheetCalloutsDetected(job.sheetId)

      // Emit LiveStore event
      const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
        env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
      )

      await liveStoreStub.fetch("http://internal/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "sheetCalloutsDetected",
          data: {
            sheetId: job.sheetId,
            planId: job.planId,
            markers: result.markers,
            unmatchedCount: result.unmatchedCount,
            detectedAt: Date.now(),
          },
        }),
      })

      message.ack()
      console.log(`[CalloutDetection] Completed sheet ${job.sheetId}, found ${result.markers.length} markers`)
    } catch (error) {
      console.error(`[CalloutDetection] Failed for sheet ${job.sheetId}:`, error)
      message.retry()
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

      // Send image to container for PMTiles generation (VIPS)
      const response = await env.PDF_PROCESSOR_CONTAINER.fetch(
        "http://container/generate-tiles",
        {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            "X-Sheet-Id": job.sheetId,
            "X-Plan-Id": job.planId,
            "X-Organization-Id": job.organizationId,
            "X-Project-Id": job.projectId,
          },
          body: await imageData.arrayBuffer(),
        },
      )

      if (!response.ok) {
        throw new Error(`Container returned ${response.status}: ${await response.text()}`)
      }

      // Container returns PMTiles file as binary
      const pmtilesData = await response.arrayBuffer()

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

      // Emit LiveStore event
      const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
        env.LIVESTORE_CLIENT_DO.idFromName(job.organizationId),
      )

      await liveStoreStub.fetch("http://internal/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "sheetTilesGenerated",
          data: {
            sheetId: job.sheetId,
            planId: job.planId,
            localPmtilesPath: pmtilesPath,
            remotePmtilesPath: `https://r2.sitelink.dev/${pmtilesPath}`,
            minZoom: 0,
            maxZoom: 8,
            generatedAt: Date.now(),
          },
        }),
      })

      message.ack()
      console.log(`[TileGeneration] Completed sheet ${job.sheetId}`)
    } catch (error) {
      console.error(`[TileGeneration] Failed for sheet ${job.sheetId}:`, error)
      message.retry()
    }
  }
}
