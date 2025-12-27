import { readFile } from "fs/promises";
import { callOpenRouter } from "../api/openrouter";
import { buildTitleBlockPrompt } from "../prompts/detectTitleBlock";
import type { TitleBlockInfo, ImageInfo } from "../types/hyperlinks";

/**
 * Convert PNG image to base64 data URL
 */
async function imageToBase64DataUrl(imagePath: string): Promise<string> {
  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Analyze title block to extract sheet number, title, and notes
 */
export async function analyzeTitleBlock(
  imageInfo: ImageInfo
): Promise<TitleBlockInfo> {
  try {
    // Convert PNG to base64 data URL
    const imageDataUrl = await imageToBase64DataUrl(imageInfo.path);
    
    // Build prompt
    const prompt = buildTitleBlockPrompt(
      imageInfo.width,
      imageInfo.height
    );
    
    // Call OpenRouter API
    const rawResponse = await callOpenRouter(
      prompt,
      [imageDataUrl],
      { model: "google/gemini-2.5-flash", temperature: 0 }
    );
    
    // Parse JSON from response
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const parsed = JSON.parse(cleaned) as TitleBlockInfo;
    
    // Validate and normalize
    return {
      sheetNumber: parsed.sheetNumber?.toUpperCase().trim() || null,
      sheetTitle: parsed.sheetTitle?.trim() || null,
      notes: parsed.notes?.trim() || null,
      titleBlockLocation: parsed.titleBlockLocation
    };
  } catch (error: any) {
    console.error("Title block analysis error:", error.message);
    return {
      sheetNumber: null,
      sheetTitle: null,
      notes: null
    };
  }
}

