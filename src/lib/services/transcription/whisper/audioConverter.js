/**
 * Audio Format Converter for Whisper Compatibility
 * Simple wrapper - actual conversion is in whisperService.js
 */

/**
 * Check if audio format needs conversion for Whisper
 */
export function needsConversion(mimeType) {
  // All audio needs conversion to Float32Array for Whisper
  return true;
}

/**
 * Convert audio blob to Float32Array for Whisper
 * Note: Actual conversion is handled by whisperService.js
 * This is kept for backward compatibility with simpleHybridService
 */
export async function convertToWAV(audioBlob) {
  // This function is no longer needed as whisperService handles conversion internally
  // Kept for backward compatibility - just return the blob
  return audioBlob;
}
