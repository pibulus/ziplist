import posthog from "posthog-js";
import { browser } from "$app/environment";

/**
 * Privacy-Focused PostHog Analytics Service
 *
 * PRIVACY POLICY:
 * - NO personal data is tracked (no transcription content, list names, or user text)
 * - Only aggregate metrics are collected (durations, counts, success rates)
 * - Error messages are sanitized to remove potential personal data
 * - All data is anonymized and aggregated for product improvement only
 */
class PostHogService {
  constructor() {
    this.isInitialized = false;
    this.eventQueue = [];

    if (browser) {
      this.init();
    }
  }

  init() {
    if (this.isInitialized || !browser) return;

    const key = import.meta.env.VITE_POSTHOG_KEY;
    const host = import.meta.env.VITE_POSTHOG_HOST;

    if (!key) {
      console.warn("PostHog key not found in environment variables");
      return;
    }

    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only", // Only create profiles for identified users
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true, // Disable session recordings for privacy
      disable_survey_popups: true, // Disable survey popups
      property_blacklist: ["$current_url", "$referrer"], // Exclude potentially sensitive URL data
      loaded: () => {
        this.isInitialized = true;
        this.processQueue();
      },
    });
  }

  trackEvent(eventName, properties = {}) {
    if (!browser) return;

    const event = { eventName, properties };

    if (this.isInitialized) {
      posthog.capture(eventName, properties);
    } else {
      this.eventQueue.push(event);
    }
  }

  processQueue() {
    while (this.eventQueue.length > 0) {
      const { eventName, properties } = this.eventQueue.shift();
      posthog.capture(eventName, properties);
    }
  }

  // Voice recording events
  trackVoiceRecordingStarted() {
    this.trackEvent("voice_recording_started", {
      timestamp: Date.now(),
    });
  }

  trackVoiceRecordingCompleted(duration, success, audioSize = 0) {
    this.trackEvent("voice_recording_completed", {
      duration_ms: duration,
      success,
      audio_size_bytes: audioSize,
      timestamp: Date.now(),
    });
  }

  trackTranscriptionResult(success, wordCount = 0, processingTime = 0) {
    this.trackEvent(
      success ? "transcription_success" : "transcription_failed",
      {
        word_count: wordCount,
        processing_time_ms: processingTime,
        timestamp: Date.now(),
      },
    );
  }

  // List management events
  trackListCreated(itemCount, source = "voice") {
    this.trackEvent("list_created", {
      item_count: itemCount,
      source, // 'voice', 'manual', 'import'
      timestamp: Date.now(),
    });
  }

  trackListItemCompleted() {
    this.trackEvent("list_item_completed", {
      timestamp: Date.now(),
    });
  }

  trackListDeleted(itemCount, listAge) {
    this.trackEvent("list_deleted", {
      item_count: itemCount,
      list_age_ms: listAge,
      timestamp: Date.now(),
    });
  }

  // List sharing events
  trackListShared(itemCount, success = true) {
    this.trackEvent("list_shared", {
      item_count: itemCount,
      success,
      timestamp: Date.now(),
    });
  }

  trackListImported(itemCount, source = "share_link") {
    this.trackEvent("list_imported", {
      item_count: itemCount,
      source, // 'share_link', 'url', 'manual'
      timestamp: Date.now(),
    });
  }

  // Ghost interaction events
  trackGhostThemeChanged(fromTheme, toTheme) {
    this.trackEvent("ghost_theme_changed", {
      from_theme: fromTheme,
      to_theme: toTheme,
      timestamp: Date.now(),
    });
  }

  trackGhostInteraction(interactionType) {
    this.trackEvent("ghost_interaction", {
      type: interactionType, // 'eye_follow', 'click', 'animation_trigger', 'hover'
      timestamp: Date.now(),
    });
  }

  trackGhostAnimationTriggered(animationType, theme) {
    this.trackEvent("ghost_animation_triggered", {
      animation_type: animationType,
      current_theme: theme,
      timestamp: Date.now(),
    });
  }

  // App lifecycle events
  trackAppInstalled() {
    this.trackEvent("app_installed", {
      timestamp: Date.now(),
    });
  }

  trackFirstVisit() {
    this.trackEvent("first_visit", {
      timestamp: Date.now(),
    });
  }

  trackModalOpened(modalType) {
    this.trackEvent("modal_opened", {
      modal_type: modalType, // 'about', 'settings', 'intro', 'extension'
      timestamp: Date.now(),
    });
  }

  // Error tracking
  trackError(errorType, errorMessage = "Unknown error", context = {}) {
    // Sanitize error message to avoid leaking personal data
    const sanitizedMessage = this.sanitizeErrorMessage(errorMessage);

    this.trackEvent("error_occurred", {
      error_type: errorType,
      error_message: sanitizedMessage,
      context,
      timestamp: Date.now(),
    });
  }

  sanitizeErrorMessage(message) {
    if (!message || typeof message !== "string") return "Unknown error";

    // Remove any potential personal data patterns
    return message
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "[EMAIL_REDACTED]",
      )
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD_REDACTED]")
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
      .replace(/["']([^"']{10,})["']/g, "[TEXT_REDACTED]")
      .slice(0, 200); // Limit message length
  }

  // Feature usage
  trackFeatureUsed(featureName, context = {}) {
    this.trackEvent("feature_used", {
      feature_name: featureName,
      context,
      timestamp: Date.now(),
    });
  }

  // User identification (optional)
  identify(userId, properties = {}) {
    if (!browser || !this.isInitialized) return;
    posthog.identify(userId, properties);
  }

  // Reset user (for privacy)
  reset() {
    if (!browser || !this.isInitialized) return;
    posthog.reset();
  }
}

export const postHogService = new PostHogService();
