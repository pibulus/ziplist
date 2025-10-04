/**
 * Simple Hybrid Transcription Service
 * Uses Gemini API for instant results while Whisper loads in background
 */

import { get } from 'svelte/store';
import { whisperService, whisperStatus } from './whisper/whisperService';
import { userPreferences } from '../infrastructure/stores';
import { geminiService } from '../geminiService';
import { browser } from '$app/environment';

class SimpleHybridService {
	constructor() {
		this.whisperReady = false;
		this.whisperLoadPromise = null;

		// Subscribe to whisper status
		if (browser) {
			whisperStatus.subscribe((status) => {
				this.whisperReady = status.isLoaded;
			});
		}
	}

	/**
	 * Start loading Whisper in the background
	 */
	async startBackgroundLoad() {
		if (this.whisperLoadPromise || this.whisperReady) {
			return; // Already loading or loaded
		}

		console.log('🔄 Starting background Whisper model download...');
		this.whisperLoadPromise = whisperService
			.preloadModel()
			.then((result) => {
				if (result.success) {
					console.log('✅ Whisper model ready for offline use!');
				}
				return result;
			})
			.catch((err) => {
				console.warn('Whisper load failed, will continue with API:', err);
				return { success: false, error: err };
			});
	}

	/**
	 * Transcribe audio using best available method
	 */
	async transcribeAudio(audioBlob) {
		// Check privacy mode preference
		const privacyMode = localStorage.getItem('ziplist_privacy_mode') === 'true';

		// Start loading Whisper in background if not already
		this.startBackgroundLoad();

		// If privacy mode is on, wait for Whisper or fail
		if (privacyMode) {
			if (this.whisperReady) {
				console.log('🔒 Privacy Mode: Using offline Whisper');
				localStorage.setItem('last_transcription_method', 'whisper');
				return await whisperService.transcribeAudio(audioBlob);
			} else if (this.whisperLoadPromise) {
				console.log('🔒 Privacy Mode: Waiting for Whisper to load...');
				const result = await this.whisperLoadPromise;
				if (result.success) {
					localStorage.setItem('last_transcription_method', 'whisper');
					return await whisperService.transcribeAudio(audioBlob);
				}
				throw new Error('Privacy mode enabled but offline model failed to load');
			} else {
				throw new Error('Privacy mode enabled but offline model not available');
			}
		}

		// Normal mode: If Whisper is ready, use it (offline, fast, free)
		if (this.whisperReady) {
			console.log('🎯 Using offline Whisper transcription');
			localStorage.setItem('last_transcription_method', 'whisper');
			return await whisperService.transcribeAudio(audioBlob);
		}

		// Otherwise use Gemini API for instant results
		console.log('☁️ Using Gemini API while Whisper loads...');
		localStorage.setItem('last_transcription_method', 'gemini');
		return await this.transcribeWithGemini(audioBlob);
	}

	/**
	 * Transcribe using Gemini service (ZipList's direct integration)
	 */
	async transcribeWithGemini(audioBlob) {
		try {
			// Use ZipList's geminiService which handles blob conversion internally
			const transcription = await geminiService.transcribeAudio(audioBlob);

			// Check if Whisper finished loading while we were transcribing
			if (this.whisperReady) {
				console.log('💡 Whisper is now ready for next transcription!');
			}

			return transcription;
		} catch (error) {
			console.error('Gemini transcription error:', error);

			// If Gemini fails and Whisper is still loading, wait for it
			if (this.whisperLoadPromise && !this.whisperReady) {
				console.log('⏳ Gemini failed, waiting for Whisper to load...');
				const result = await this.whisperLoadPromise;
				if (result.success) {
					return await whisperService.transcribeAudio(audioBlob);
				}
			}

			throw error;
		}
	}

	/**
	 * Check current status
	 */
	getStatus() {
		return {
			whisperReady: this.whisperReady,
			usingAPI: !this.whisperReady,
			method: this.whisperReady ? 'Offline (Whisper)' : 'Online (Gemini API)'
		};
	}
}

// Export singleton instance
export const simpleHybridService = new SimpleHybridService();
