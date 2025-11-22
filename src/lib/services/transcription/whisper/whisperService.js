/**
 * WhisperService - Simple offline speech transcription using @xenova/transformers
 * Uses tiny model only - auto-downloads on first visit, falls back to Gemini if needed
 */

import { writable } from 'svelte/store';
import { pipeline, env } from '@xenova/transformers';

// ============================================================================
// STEP 1: Configure Transformers.js Environment
// ============================================================================

// Configure for maximum stability and offline capability
env.allowRemoteModels = true;      // Allow CDN downloads
env.useBrowserCache = true;        // Enable browser cache
env.useIndexedDB = true;           // Persist models in IndexedDB

// WASM backend configuration
if (env.backends?.onnx?.wasm) {
  const hwThreads = navigator.hardwareConcurrency || 2;
  env.backends.onnx.wasm.numThreads = Math.min(4, hwThreads);
  env.backends.onnx.wasm.simd = true;  // Enable SIMD for speed
}

// Disable WebGPU for now (experimental, can cause issues)
if (env.backends?.onnx?.webgpu) {
  env.backends.onnx.webgpu = undefined;
}

// ============================================================================
// STEP 2: Tiny Model Configuration (Only Model We Use)
// ============================================================================

const WHISPER_TINY_MODEL = {
  id: 'Xenova/whisper-tiny.en',
  name: 'Whisper Tiny English',
  size: 117 * 1024 * 1024,  // ~117MB
  description: 'Fast, lightweight, perfect for list transcription'
};

const SAMPLE_RATE = 16000;

// ============================================================================
// STEP 3: Audio Conversion Pipeline
// ============================================================================

async function convertAudioForWhisper(audioBlob) {
  // Create AudioContext at 16kHz (Whisper requirement)
  const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

  try {
    // Decode blob to AudioBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Convert to mono Float32Array
    const monoAudio = convertToMono(audioBuffer);

    // Trim silence from edges
    const trimmed = trimSilence(monoAudio, SAMPLE_RATE);

    // Normalize to optimal level
    const normalized = normalizeAudio(trimmed);

    return normalized;
  } finally {
    await audioContext.close();
  }
}

function convertToMono(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;

  if (numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  // Average all channels
  const length = audioBuffer.length;
  const monoData = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let channel = 0; channel < numChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i];
    }
    monoData[i] = sum / numChannels;
  }

  return monoData;
}

function trimSilence(audioData, sampleRate) {
  const silenceThreshold = 0.01;  // Amplitude threshold
  const padding = Math.floor(sampleRate * 0.02);  // 20ms padding

  // Find first non-silent sample
  let start = 0;
  for (let i = 0; i < audioData.length; i++) {
    if (Math.abs(audioData[i]) > silenceThreshold) {
      start = Math.max(0, i - padding);
      break;
    }
  }

  // Find last non-silent sample
  let end = audioData.length - 1;
  for (let i = audioData.length - 1; i >= start; i--) {
    if (Math.abs(audioData[i]) > silenceThreshold) {
      end = Math.min(audioData.length - 1, i + padding);
      break;
    }
  }

  // Extract trimmed region
  const trimmedLength = end - start + 1;
  const trimmed = new Float32Array(trimmedLength);
  for (let i = 0; i < trimmedLength; i++) {
    trimmed[i] = audioData[start + i];
  }

  return trimmed;
}

function normalizeAudio(audioData) {
  // Find peak amplitude
  let maxAmplitude = 0;
  for (let i = 0; i < audioData.length; i++) {
    const amplitude = Math.abs(audioData[i]);
    if (amplitude > maxAmplitude) {
      maxAmplitude = amplitude;
    }
  }

  // Skip normalization if too quiet
  if (maxAmplitude < 0.001) {
    return audioData;
  }

  // Normalize to 70% of full scale (prevents clipping)
  const targetLevel = 0.7;
  const factor = targetLevel / maxAmplitude;

  const normalized = new Float32Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    normalized[i] = audioData[i] * factor;
  }

  return normalized;
}

// ============================================================================
// STEP 4: WhisperTranscriber Class
// ============================================================================

class WhisperTranscriber {
  constructor() {
    this.transcriber = null;
    this.isLoaded = false;
    this.isLoading = false;
  }

  async loadModel(onProgress = null) {
    if (this.transcriber) return this.transcriber;
    if (this.isLoading) return null;

    this.isLoading = true;

    try {
      console.log(`🎯 Loading ${WHISPER_TINY_MODEL.name} (${Math.round(WHISPER_TINY_MODEL.size / 1024 / 1024)}MB)...`);

      // Create pipeline with progress tracking
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        WHISPER_TINY_MODEL.id,
        {
          device: 'wasm',           // Force WASM backend
          dtype: 'q8',              // 8-bit quantization (smaller, faster)
          progress_callback: (progress) => {
            if (progress.status === 'downloading') {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              console.log(`📥 Downloading: ${percent}%`);
              onProgress?.(percent);
            }
          }
        }
      );

      // Warmup: Run silent audio to JIT-compile WASM kernels
      await this.warmup();

      this.isLoaded = true;
      this.isLoading = false;

      console.log(`✅ ${WHISPER_TINY_MODEL.name} loaded and ready`);
      return this.transcriber;

    } catch (error) {
      this.isLoading = false;
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  async warmup() {
    if (!this.transcriber) return;

    // Create 0.25s of silence
    const warmupSamples = Math.floor(SAMPLE_RATE * 0.25);
    const silence = new Float32Array(warmupSamples);

    try {
      // Run inference to warm up WASM kernels
      await this.transcriber(silence, {
        task: 'transcribe',
        return_timestamps: false,
        temperature: 0,
        do_sample: false
      });
      console.log('🔥 Model warmed up');
    } catch (error) {
      console.warn('Warmup failed (continuing):', error?.message);
    }
  }

  async transcribe(audioBlob) {
    // Ensure model is loaded
    if (!this.isLoaded) {
      await this.loadModel();
    }

    // Convert audio to proper format
    const audioData = await convertAudioForWhisper(audioBlob);

    // Validate audio has content
    const hasSignal = audioData.some(sample => Math.abs(sample) > 0.001);
    if (!hasSignal) {
      throw new Error('No speech detected in audio');
    }

    console.log(`🎤 Transcribing ${audioData.length} samples...`);

    // Run inference
    const result = await this.transcriber(audioData, {
      task: 'transcribe',          // 'transcribe' or 'translate'
      return_timestamps: false,     // Set true for word-level timing
      temperature: 0,               // Deterministic output
      do_sample: false              // Greedy decoding (fastest)
    });

    // Extract text
    const text = (typeof result === 'string' ? result : result?.text || '').trim();

    if (!text) {
      throw new Error('Whisper returned empty text');
    }

    // Clean repetitions (Whisper artifact)
    const cleaned = this.cleanRepetitions(text);
    console.log(`✨ Transcribed: "${cleaned}"`);
    
    return cleaned;
  }

  cleanRepetitions(text) {
    // Remove stuttering repetitions like "the the the"
    return text.replace(/(\b.+?\b)(\s+\1)+/gi, '$1').trim();
  }

  async unload() {
    if (this.transcriber?.dispose) {
      await this.transcriber.dispose();
    }
    this.transcriber = null;
    this.isLoaded = false;
    this.isLoading = false;
  }
}

// ============================================================================
// STEP 5: Persistent Storage
// ============================================================================

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;

  try {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log('💾 Persistent storage:', granted ? 'granted' : 'denied');
      return granted;
    }
    return true;
  } catch (error) {
    console.warn('Persistent storage failed:', error);
    return false;
  }
}

// ============================================================================
// Service Instance & Store
// ============================================================================

// Service status store for reactive UI
export const whisperStatus = writable({
  isLoaded: false,
  isLoading: false,
  progress: 0,
  error: null,
  supportsWhisper: typeof window !== 'undefined'
});

class WhisperService {
  constructor() {
    this.transcriber = new WhisperTranscriber();
    this.modelLoadPromise = null;
    
    // Auto-start download on initialization (browser only)
    if (typeof window !== 'undefined') {
      // Request persistent storage
      requestPersistentStorage();
      
      // Start downloading tiny model in background immediately
      console.log('🚀 ZipList: Auto-starting Whisper Tiny model download...');
      this.preloadModel();
    }
  }

  async preloadModel() {
    // Return existing promise if already loading
    if (this.modelLoadPromise) {
      return this.modelLoadPromise;
    }

    // Already loaded
    if (this.transcriber.isLoaded) {
      return { success: true };
    }

    whisperStatus.update(s => ({ ...s, isLoading: true, progress: 0, error: null }));

    this.modelLoadPromise = this.transcriber.loadModel((progress) => {
      whisperStatus.update(s => ({ ...s, progress }));
    })
      .then(() => {
        whisperStatus.update(s => ({ 
          ...s, 
          isLoaded: true, 
          isLoading: false, 
          progress: 100
        }));
        return { success: true };
      })
      .catch((error) => {
        whisperStatus.update(s => ({ 
          ...s, 
          isLoading: false, 
          error: error.message 
        }));
        this.modelLoadPromise = null;
        return { success: false, error };
      });

    return this.modelLoadPromise;
  }

  async transcribeAudio(audioBlob) {
    try {
      const text = await this.transcriber.transcribe(audioBlob);
      return text;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  async unloadModel() {
    await this.transcriber.unload();
    whisperStatus.update(s => ({ 
      ...s, 
      isLoaded: false, 
      isLoading: false, 
      progress: 0 
    }));
    this.modelLoadPromise = null;
  }
}

// Export singleton instance
export const whisperService = new WhisperService();
