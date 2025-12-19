import { describe, it, expect } from "bun:test";
import { 
  normalizeCoordinates, 
  denormalizeCoordinates,
  isValidCoordinate 
} from "../../src/utils/coordinates";
import type { PixelCoordinate, NormalizedCoordinate } from "../../src/types/hyperlinks";

describe('normalizeCoordinates', () => {
  it('should convert pixel coordinates to normalized 0-1 range', () => {
    const result = normalizeCoordinates(
      { x: 2550, y: 1650 },
      5100,
      3300
    );
    
    expect(result.x).toBe(0.5);
    expect(result.y).toBe(0.5);
  });

  it('should handle coordinates at origin (0,0)', () => {
    const result = normalizeCoordinates(
      { x: 0, y: 0 },
      5100,
      3300
    );
    
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('should handle coordinates at max bounds', () => {
    const result = normalizeCoordinates(
      { x: 5100, y: 3300 },
      5100,
      3300
    );
    
    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
  });

  it('should round to 4 decimal places', () => {
    const result = normalizeCoordinates(
      { x: 1234, y: 5678 },
      5100,
      10000
    );
    
    expect(result.x).toBe(0.242);
    expect(result.y).toBe(0.5678);
  });
});

describe('denormalizeCoordinates', () => {
  it('should convert normalized coordinates back to pixels', () => {
    const result = denormalizeCoordinates(
      { x: 0.5, y: 0.5 },
      5100,
      3300
    );
    
    expect(result.x).toBe(2550);
    expect(result.y).toBe(1650);
  });

  it('should round pixel values to integers', () => {
    const result = denormalizeCoordinates(
      { x: 0.333, y: 0.666 },
      5100,
      3300
    );
    
    expect(Number.isInteger(result.x)).toBe(true);
    expect(Number.isInteger(result.y)).toBe(true);
  });
});

describe('isValidCoordinate', () => {
  it('should return true for valid coordinates', () => {
    expect(isValidCoordinate({ x: 0, y: 0 })).toBe(true);
    expect(isValidCoordinate({ x: 1, y: 1 })).toBe(true);
    expect(isValidCoordinate({ x: 0.5, y: 0.5 })).toBe(true);
  });

  it('should return false for out-of-bounds coordinates', () => {
    expect(isValidCoordinate({ x: -0.1, y: 0.5 })).toBe(false);
    expect(isValidCoordinate({ x: 0.5, y: 1.1 })).toBe(false);
    expect(isValidCoordinate({ x: 2, y: 0 })).toBe(false);
  });
});

