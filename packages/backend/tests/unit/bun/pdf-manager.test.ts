import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import {
	executePlanTileGeneration,
	type TileGeneratorData,
} from "../../../src/core/pdf-manager/tile-processor"

const TMP_DIR = `${import.meta.dir}/../../fixtures/tmp`
const PDF_PATH = `${import.meta.dir}/../../fixtures/sample-plan.pdf`
const ORGANIZATION_ID = `1`
const PROJECT_ID = `1`
const PLAN_ID = `1`
const UPLOAD_ID = `1`

beforeEach(async () => {
	await fs.mkdir(TMP_DIR, { recursive: true })
})

afterEach(async () => {
	console.info("[INFO]: Cleaning up fixtures...")
	await Bun.$`rm -rf ${TMP_DIR}/*`.nothrow().quiet()
	console.info("[INFO]: Fixtures cleanup completed.")
})

describe("PDF Manager", () => {
	test("successfully generates multipage tiles using vips", async () => {
		const tilesGenData = {
			pdfPath: PDF_PATH,
			organizationId: ORGANIZATION_ID,
			projectId: PROJECT_ID,
			planId: PLAN_ID,
			uploadId: UPLOAD_ID,
			uploadCallback: () => Promise.resolve(),
			tempOutputDir: TMP_DIR,
			tempOutputCleanup: false,
		} satisfies TileGeneratorData

		const pageCount = await executePlanTileGeneration(tilesGenData)

		const pageExistArr: boolean[] = []
		for (let pageNum = 0; pageNum < pageCount; pageNum++) {
			const pageNumber = pageNum + 1
			const sheetId = `sheet-${pageNumber}`

			const dziFile = await Bun.file(`${TMP_DIR}/${sheetId}.dzi`).exists()
			const tileDir = await fs
				.access(`${TMP_DIR}/${sheetId}_files`)
				.then(() => true)
				.catch(() => false)

			pageExistArr.push(dziFile && tileDir)
		}

		console.debug("[DEBUG]: ", pageExistArr)
		const result = pageExistArr.filter((exist) => exist)
		expect(result).toBeArrayOfSize(pageCount)
	})
})
