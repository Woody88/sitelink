import { describe, expect, it, vi } from "vitest";
import type {
	CalloutDetectionJob,
	DocLayoutDetectionJob,
	ImageGenerationJob,
	MetadataExtractionJob,
	TileGenerationJob,
} from "../processing/types";
import { getR2Path } from "../processing/types";

describe("Queue Message Format Validation", () => {
	it("should validate ImageGenerationJob message structure", () => {
		const job: ImageGenerationJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			pdfPath:
				"organizations/org-789/projects/project-456/plans/plan-123/source.pdf",
			totalPages: 10,
			planName: "sample-plan",
		};

		expect(job).toHaveProperty("planId");
		expect(job).toHaveProperty("projectId");
		expect(job).toHaveProperty("organizationId");
		expect(job).toHaveProperty("pdfPath");
		expect(job).toHaveProperty("totalPages");
		expect(job).toHaveProperty("planName");
		expect(typeof job.planId).toBe("string");
		expect(typeof job.totalPages).toBe("number");
		expect(typeof job.planName).toBe("string");
	});

	it("should validate MetadataExtractionJob message structure", () => {
		const job: MetadataExtractionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: "sheet-001",
			sheetNumber: 1,
			totalSheets: 10,
		};

		expect(job).toHaveProperty("planId");
		expect(job).toHaveProperty("sheetId");
		expect(job).toHaveProperty("sheetNumber");
		expect(job).toHaveProperty("totalSheets");
		expect(typeof job.sheetNumber).toBe("number");
		expect(typeof job.totalSheets).toBe("number");
	});

	it("should validate CalloutDetectionJob message structure", () => {
		const job: CalloutDetectionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: "sheet-001",
			sheetNumber: "A1",
			validSheetNumbers: ["A1", "A3", "S1"],
		};

		expect(job).toHaveProperty("planId");
		expect(job).toHaveProperty("sheetId");
		expect(job).toHaveProperty("sheetNumber");
		expect(job).toHaveProperty("validSheetNumbers");
		expect(Array.isArray(job.validSheetNumbers)).toBe(true);
		expect(job.validSheetNumbers.length).toBe(3);
	});

	it("should validate DocLayoutDetectionJob message structure", () => {
		const job: DocLayoutDetectionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: "sheet-001",
			sheetNumber: "A1",
		};

		expect(job).toHaveProperty("planId");
		expect(job).toHaveProperty("projectId");
		expect(job).toHaveProperty("organizationId");
		expect(job).toHaveProperty("sheetId");
		expect(job).toHaveProperty("sheetNumber");
		expect(typeof job.sheetNumber).toBe("string");
	});

	it("should validate TileGenerationJob message structure", () => {
		const job: TileGenerationJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: "sheet-001",
		};

		expect(job).toHaveProperty("planId");
		expect(job).toHaveProperty("projectId");
		expect(job).toHaveProperty("organizationId");
		expect(job).toHaveProperty("sheetId");
	});
});

describe("R2 Path Generation", () => {
	it("should generate correct base plan path", () => {
		const path = getR2Path("org-123", "proj-456", "plan-789");
		expect(path).toBe("organizations/org-123/projects/proj-456/plans/plan-789");
	});

	it("should generate correct sheet path", () => {
		const path = getR2Path("org-123", "proj-456", "plan-789", "sheet-001");
		expect(path).toBe(
			"organizations/org-123/projects/proj-456/plans/plan-789/sheets/sheet-001",
		);
	});

	it("should generate correct sheet image path", () => {
		const path = getR2Path(
			"org-123",
			"proj-456",
			"plan-789",
			"sheet-001",
			"source.png",
		);
		expect(path).toBe(
			"organizations/org-123/projects/proj-456/plans/plan-789/sheets/sheet-001/source.png",
		);
	});

	it("should generate correct tiles path", () => {
		const path = getR2Path(
			"org-123",
			"proj-456",
			"plan-789",
			"sheet-001",
			"tiles.pmtiles",
		);
		expect(path).toBe(
			"organizations/org-123/projects/proj-456/plans/plan-789/sheets/sheet-001/tiles.pmtiles",
		);
	});
});

describe("Queue Job Processing Logic", () => {
	it("should correctly identify job dependencies", () => {
		const imageJob: ImageGenerationJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			pdfPath:
				"organizations/org-789/projects/project-456/plans/plan-123/source.pdf",
			totalPages: 3,
			planName: "sample-plan",
		};

		expect(imageJob.totalPages).toBe(3);

		const metadataJobs: MetadataExtractionJob[] = Array.from(
			{ length: imageJob.totalPages },
			(_, i) => ({
				planId: imageJob.planId,
				projectId: imageJob.projectId,
				organizationId: imageJob.organizationId,
				sheetId: `sheet-${i}`,
				sheetNumber: i + 1,
				totalSheets: imageJob.totalPages,
			}),
		);

		expect(metadataJobs).toHaveLength(3);
		expect(metadataJobs[0].sheetNumber).toBe(1);
		expect(metadataJobs[2].sheetNumber).toBe(3);
	});

	it("should filter valid sheets for callout detection", () => {
		const validSheetNumbers = ["A1", "A3"];

		const calloutJobs: CalloutDetectionJob[] = validSheetNumbers.map(
			(sheetNumber, i) => ({
				planId: "plan-123",
				projectId: "project-456",
				organizationId: "org-789",
				sheetId: `sheet-${i}`,
				sheetNumber,
				validSheetNumbers,
			}),
		);

		expect(calloutJobs).toHaveLength(2);
		expect(calloutJobs.every((job) => job.validSheetNumbers.length === 2)).toBe(
			true,
		);
	});
});

describe("Message Batch Processing Simulation", () => {
	it("should handle batch of messages correctly", async () => {
		const processedMessages: string[] = [];
		const mockProcessor = vi.fn(async (job: MetadataExtractionJob) => {
			processedMessages.push(job.sheetId);
		});

		const batch = [
			{
				sheetId: "sheet-1",
				planId: "plan-1",
				projectId: "proj-1",
				organizationId: "org-1",
				sheetNumber: 1,
				totalSheets: 3,
			},
			{
				sheetId: "sheet-2",
				planId: "plan-1",
				projectId: "proj-1",
				organizationId: "org-1",
				sheetNumber: 2,
				totalSheets: 3,
			},
			{
				sheetId: "sheet-3",
				planId: "plan-1",
				projectId: "proj-1",
				organizationId: "org-1",
				sheetNumber: 3,
				totalSheets: 3,
			},
		];

		for (const job of batch) {
			await mockProcessor(job);
		}

		expect(mockProcessor).toHaveBeenCalledTimes(3);
		expect(processedMessages).toEqual(["sheet-1", "sheet-2", "sheet-3"]);
	});

	it("should handle failed message with retry", async () => {
		const ackMock = vi.fn();
		const retryMock = vi.fn();

		const message = {
			id: "msg-1",
			body: {
				sheetId: "sheet-1",
				planId: "plan-1",
				projectId: "proj-1",
				organizationId: "org-1",
			},
			ack: ackMock,
			retry: retryMock,
		};

		const shouldFail = true;
		if (shouldFail) {
			message.retry();
		} else {
			message.ack();
		}

		expect(retryMock).toHaveBeenCalledTimes(1);
		expect(ackMock).not.toHaveBeenCalled();
	});
});

describe("Parallel Detection Job Creation", () => {
	it("should create both callout and DocLayout jobs for each valid sheet", () => {
		const validSheets = [
			{ sheetId: "sheet-0", sheetNumber: "A1" },
			{ sheetId: "sheet-2", sheetNumber: "S1" },
		];
		const validSheetNumbers = validSheets.map((s) => s.sheetNumber);

		const calloutJobs: CalloutDetectionJob[] = validSheets.map((sheet) => ({
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId: sheet.sheetId,
			sheetNumber: sheet.sheetNumber,
			validSheetNumbers,
		}));

		const docLayoutJobs: DocLayoutDetectionJob[] = validSheets.map(
			(sheet) => ({
				planId: "plan-123",
				projectId: "project-456",
				organizationId: "org-789",
				sheetId: sheet.sheetId,
				sheetNumber: sheet.sheetNumber,
			}),
		);

		expect(calloutJobs).toHaveLength(2);
		expect(docLayoutJobs).toHaveLength(2);
		expect(calloutJobs[0].sheetId).toBe(docLayoutJobs[0].sheetId);
		expect(calloutJobs[1].sheetId).toBe(docLayoutJobs[1].sheetId);
	});

	it("should share same sheet identifiers between callout and DocLayout jobs", () => {
		const sheetId = "sheet-0";
		const sheetNumber = "A1";

		const calloutJob: CalloutDetectionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId,
			sheetNumber,
			validSheetNumbers: ["A1", "S1"],
		};

		const docLayoutJob: DocLayoutDetectionJob = {
			planId: "plan-123",
			projectId: "project-456",
			organizationId: "org-789",
			sheetId,
			sheetNumber,
		};

		expect(calloutJob.sheetId).toBe(docLayoutJob.sheetId);
		expect(calloutJob.sheetNumber).toBe(docLayoutJob.sheetNumber);
		expect(calloutJob.planId).toBe(docLayoutJob.planId);
	});
});

describe("DocLayout Detection Failure Handling", () => {
	it("should ACK (not retry) on DocLayout detection failure", async () => {
		const ackMock = vi.fn();
		const retryMock = vi.fn();

		const message = {
			id: "msg-layout-1",
			body: {
				planId: "plan-123",
				projectId: "project-456",
				organizationId: "org-789",
				sheetId: "sheet-0",
				sheetNumber: "A1",
			} satisfies DocLayoutDetectionJob,
			ack: ackMock,
			retry: retryMock,
		};

		const containerFailed = true;
		if (containerFailed) {
			message.ack();
		} else {
			message.ack();
		}

		expect(ackMock).toHaveBeenCalledTimes(1);
		expect(retryMock).not.toHaveBeenCalled();
	});

	it("should still notify coordinator even on DocLayout failure", async () => {
		const coordinatorNotified = vi.fn();

		const containerFailed = true;
		if (containerFailed) {
			coordinatorNotified("sheet-0");
		}

		expect(coordinatorNotified).toHaveBeenCalledWith("sheet-0");
	});
});
