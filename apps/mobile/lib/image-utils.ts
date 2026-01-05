/**
 * Image utilities for handling image loading in React Native
 *
 * These utilities fetch images from URLs and convert to base64 data URLs
 * for use in WebView/DOM components where CORS restrictions apply.
 */

/**
 * Fetch an image from a URL and convert to base64 data URL
 * This bypasses WebView CORS restrictions by fetching from React Native's network stack
 */
export async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const blob = await response.blob()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert image to base64'))
        }
      }
      reader.onerror = () => reject(new Error('FileReader error'))
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the MIME type from a URL based on extension
 */
export function getMimeTypeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg'
  }
}
