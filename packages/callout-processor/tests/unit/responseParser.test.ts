import { describe, it, expect } from "bun:test";
import { parseVisionResponse, extractTargetSheet, validateResponse } from "../../src/utils/responseParser";
import type { VisionLLMResponse } from "../../src/types/hyperlinks";

describe('parseVisionResponse', () => {
  it('should parse valid JSON response', () => {
    const raw = `{
      "sheetNumber": "A2",
      "sheetTitle": "FOUNDATION PLAN",
      "imageWidth": 5100,
      "imageHeight": 3300,
      "callouts": [
        {"ref": "A6", "targetSheet": "A6", "type": "section", "x": 4100, "y": 750}
      ]
    }`;
    
    const result = parseVisionResponse(raw);
    
    expect(result.sheetNumber).toBe('A2');
    expect(result.callouts).toHaveLength(1);
    expect(result.callouts[0].ref).toBe('A6');
  });

  it('should handle JSON wrapped in markdown code blocks', () => {
    const raw = `\`\`\`json
{
  "sheetNumber": "A1",
  "sheetTitle": "SITE PLAN",
  "imageWidth": 5100,
  "imageHeight": 3300,
  "callouts": []
}
\`\`\``;
    
    const result = parseVisionResponse(raw);
    
    expect(result.sheetNumber).toBe('A1');
  });

  it('should throw on invalid JSON', () => {
    const raw = 'This is not JSON';
    
    expect(() => parseVisionResponse(raw)).toThrow();
  });

  it('should normalize callout refs to uppercase', () => {
    const raw = `{
      "sheetNumber": "a2",
      "sheetTitle": null,
      "imageWidth": 5100,
      "imageHeight": 3300,
      "callouts": [
        {"ref": "a6", "targetSheet": "a6", "type": "section", "x": 100, "y": 100}
      ]
    }`;
    
    const result = parseVisionResponse(raw);
    
    expect(result.sheetNumber).toBe('A2');
    expect(result.callouts[0].ref).toBe('A6');
  });
});

describe('extractTargetSheet', () => {
  it('should return ref unchanged when no slash present', () => {
    expect(extractTargetSheet('A6')).toBe('A6');
    expect(extractTargetSheet('S-101')).toBe('S-101');
    expect(extractTargetSheet('M2.1')).toBe('M2.1');
  });

  it('should extract target sheet from detail reference format', () => {
    expect(extractTargetSheet('2/A5')).toBe('A5');
    expect(extractTargetSheet('1/S-101')).toBe('S-101');
    expect(extractTargetSheet('A/A3.01')).toBe('A3.01');
  });

  it('should handle multiple slashes by taking last part', () => {
    expect(extractTargetSheet('1/2/A5')).toBe('A5');
  });
});

describe('validateResponse', () => {
  it('should filter out callouts with invalid coordinates', () => {
    const response: VisionLLMResponse = {
      sheetNumber: "A2",
      sheetTitle: null,
      imageWidth: 5100,
      imageHeight: 3300,
      callouts: [
        { ref: "A6", targetSheet: "A6", type: "section", x: 4100, y: 750 },
        { ref: "A7", targetSheet: "A7", type: "detail", x: 6000, y: 750 }, // Invalid: x > width
        { ref: "A8", targetSheet: "A8", type: "detail", x: 100, y: -50 }  // Invalid: y < 0
      ]
    };
    
    const validated = validateResponse(response, 5100, 3300);
    
    expect(validated.callouts).toHaveLength(1);
    expect(validated.callouts[0].ref).toBe('A6');
  });

  it('should normalize and extract target sheets', () => {
    const response: VisionLLMResponse = {
      sheetNumber: "A2",
      sheetTitle: null,
      imageWidth: 5100,
      imageHeight: 3300,
      callouts: [
        { ref: "2/A5", targetSheet: "A5", type: "detail", x: 100, y: 100 }
      ]
    };
    
    const validated = validateResponse(response, 5100, 3300);
    
    expect(validated.callouts[0].ref).toBe('2/A5');
    expect(validated.callouts[0].targetSheet).toBe('A5');
  });
});

