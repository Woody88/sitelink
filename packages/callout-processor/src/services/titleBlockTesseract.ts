import { $ } from "bun";
import { readFile } from "fs/promises";
import type { TitleBlockInfo } from "../types/hyperlinks";

/**
 * Run tesseract OCR on an image path and return raw text.
 */
async function runTesseract(imagePath: string): Promise<string> {
  // Use stdout for easier capture; restrict charset to reduce noise
  const { stdout } = await $`tesseract ${imagePath} stdout --psm 6 --oem 1 -l eng -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-`.quiet();
  return stdout.toString();
}

/**
 * Heuristic parsing of title block text for sheet number/title.
 * This keeps it generic for arbitrary user plans.
 */
function parseTitleBlockText(rawText: string): TitleBlockInfo {
  const text = rawText.replace(/\r/g, "").toUpperCase();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Sheet number: find candidates like A2 / A101
  const numberPattern = /\b[A-Z]\d{1,3}\b/g;
  let sheetNumber = null as string | null;
  const candidates = Array.from(text.match(numberPattern) || []);
  if (candidates.length > 0) {
    sheetNumber = candidates[0];
  } else {
    // Try a light normalization pass for common OCR confusions (E→A, O→0)
    const normalized = text.replace(/E(?=\d)/g, "A").replace(/O/g, "0");
    const normMatch = normalized.match(numberPattern);
    if (normMatch && normMatch.length > 0) {
      sheetNumber = normMatch[0];
    }
  }

  // Sheet title: pick the longest line that contains common plan words
  const titleKeywords = ["PLAN", "ELEVATION", "DETAIL", "SECTION", "FOUNDATION"];
  const candidateTitles = lines.filter(line =>
    titleKeywords.some(k => line.includes(k))
  );
  const sheetTitle = candidateTitles.length > 0
    ? candidateTitles.reduce((a, b) => (b.length > a.length ? b : a))
    : lines.reduce((a, b) => (b.length > a.length ? b : a), "") || null;

  return {
    sheetNumber,
    sheetTitle,
    notes: null,
    titleBlockLocation: null
  };
}

/**
 * OCR-based title block extraction using Tesseract (no LLM).
 */
export async function analyzeTitleBlockWithTesseract(imagePath: string): Promise<TitleBlockInfo> {
  const rawText = await runTesseract(imagePath);
  return parseTitleBlockText(rawText);
}

