import { describe, it, expect, beforeAll } from "bun:test";
import { analyzeSheet } from "../../src/services/visionAnalysis";
import { join } from "path";
import { readFile } from "fs/promises";

// Load environment variables
async function loadEnv() {
  const envPath = join(import.meta.dir, "..", "..", ".env");
  try {
    const envFile = await readFile(envPath, "utf-8");
    for (const line of envFile.split("\n")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        if (value && !value.startsWith("#")) {
          process.env[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch (error) {
    console.warn("Could not load .env file");
  }
}

describe('Sheet Reference Detection Integration', () => {
  const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
  const outputDir = join(import.meta.dir, "..", "..", "output");
  
  // Expected callouts: [1/A5, 1/A6, 3/A5, 2/A6, 2/A6, 2/A7, 3/A7, 1/A7, 1/A6, 2/A5]
  const expectedCallouts = [
    "1/A5", "1/A6", "1/A6", "1/A7",
    "2/A5", "2/A6", "2/A6", "2/A7",
    "3/A5", "3/A7"
  ];

  beforeAll(async () => {
    await loadEnv();
  });

  it('should successfully analyze the sample PDF', async () => {
    const result = await analyzeSheet(
      pdfPath,
      [],
      outputDir,
      200
    );

    expect(result.success).toBe(true);
    expect(result.calloutsFound).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for API call

  it('should detect all expected callouts', async () => {
    const result = await analyzeSheet(
      pdfPath,
      [],
      outputDir,
      200
    );

    expect(result.success).toBe(true);

    const detectedRefs = result.hyperlinks.map(h => h.calloutRef);
    
    // Count occurrences of each expected callout
    const expectedCounts = expectedCallouts.reduce((acc, ref) => {
      acc[ref] = (acc[ref] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const detectedCounts = detectedRefs.reduce((acc, ref) => {
      acc[ref] = (acc[ref] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check each expected callout
    for (const [ref, expectedCount] of Object.entries(expectedCounts)) {
      const detectedCount = detectedCounts[ref] || 0;
      expect(detectedCount).toBe(expectedCount);
    }
  }, 60000);

  it('should normalize coordinates correctly', async () => {
    const result = await analyzeSheet(
      pdfPath,
      [],
      outputDir,
      200
    );

    expect(result.success).toBe(true);

    for (const link of result.hyperlinks) {
      // Check normalized coordinates are in 0-1 range
      expect(link.x).toBeGreaterThanOrEqual(0);
      expect(link.x).toBeLessThanOrEqual(1);
      expect(link.y).toBeGreaterThanOrEqual(0);
      expect(link.y).toBeLessThanOrEqual(1);
      
      // Check pixel coordinates exist
      expect(link.pixelX).toBeGreaterThanOrEqual(0);
      expect(link.pixelY).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it('should extract target sheet correctly from callout refs', async () => {
    const result = await analyzeSheet(
      pdfPath,
      [],
      outputDir,
      200
    );

    expect(result.success).toBe(true);

    for (const link of result.hyperlinks) {
      // Target sheet should be extracted (e.g., "2/A5" -> "A5")
      expect(link.targetSheetRef).toBeTruthy();
      
      // If ref contains "/", target should be the part after "/"
      if (link.calloutRef.includes("/")) {
        const parts = link.calloutRef.split("/");
        expect(link.targetSheetRef).toBe(parts[parts.length - 1]);
      } else {
        // If no "/", target should equal ref
        expect(link.targetSheetRef).toBe(link.calloutRef);
      }
    }
  }, 60000);
});

