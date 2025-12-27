import type { PixelCoordinate, NormalizedCoordinate } from "../types/hyperlinks";

/**
 * Convert pixel coordinates to normalized coordinates (0-1 range)
 * for use with OpenSeadragon overlays
 */
export function normalizeCoordinates(
  pixel: PixelCoordinate,
  imageWidth: number,
  imageHeight: number
): NormalizedCoordinate {
  return {
    x: Math.round((pixel.x / imageWidth) * 10000) / 10000,
    y: Math.round((pixel.y / imageHeight) * 10000) / 10000
  };
}

/**
 * Convert normalized coordinates back to pixels
 * (useful for debugging or displaying to users)
 */
export function denormalizeCoordinates(
  normalized: NormalizedCoordinate,
  imageWidth: number,
  imageHeight: number
): PixelCoordinate {
  return {
    x: Math.round(normalized.x * imageWidth),
    y: Math.round(normalized.y * imageHeight)
  };
}

/**
 * Validate that coordinates are within bounds
 */
export function isValidCoordinate(coord: NormalizedCoordinate): boolean {
  return (
    coord.x >= 0 && coord.x <= 1 &&
    coord.y >= 0 && coord.y <= 1
  );
}

