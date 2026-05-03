// FILE: p2p-kids-marketplace/src/services/educationAnalyticsService.ts
// MODULE-18 V1 EDU-003: Education analytics service (mobile)

import { supabase } from '../config/supabase';
import type { EducationAnalyticsEventType } from '../types/education';

let hasLoggedMissingEducationSchema = false;

function isMissingEducationSchemaError(error: any): boolean {
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();

  if (code === '42P01' || code === '42703' || code === 'PGRST204') {
    return true;
  }

  return (
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('column')
  );
}

function warnMissingSchemaOnce(context: string, error: any): void {
  if (hasLoggedMissingEducationSchema) {
    return;
  }

  hasLoggedMissingEducationSchema = true;
  console.warn(
    `[educationAnalyticsService] ${context} skipped because education schema/migrations are unavailable`,
    error
  );
}

/**
 * Track education analytics event
 * Fire-and-forget: never throws, logs errors via console.warn
 * Returns Promise<void> that always resolves
 *
 * @param eventType - Event type
 * @param eventData - Optional event data (no PII)
 * @returns Promise that always resolves
 */
export async function trackEducationEvent(
  eventType: EducationAnalyticsEventType,
  eventData?: Record<string, unknown>
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('education_analytics').insert({
      user_id: user?.id || null,
      event_type: eventType,
      event_data: eventData || null,
    });

    if (error) {
      if (isMissingEducationSchemaError(error)) {
        warnMissingSchemaOnce('trackEducationEvent', error);
        return;
      }

      console.warn('[educationAnalyticsService] Track event failed:', error);
    }
  } catch (error: any) {
    if (isMissingEducationSchemaError(error)) {
      warnMissingSchemaOnce('trackEducationEvent', error);
      return;
    }

    // Swallow all errors — analytics must never block UX
    console.warn('[educationAnalyticsService] Track event error:', error);
  }
}

/**
 * Check if user should see onboarding
 * Returns true iff both onboarding_completed_at AND onboarding_skipped_at are NULL
 *
 * @param userId - User ID
 * @returns True if onboarding should be shown
 */
export async function shouldShowOnboarding(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed_at, onboarding_skipped_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return true; // Profile not found — show onboarding

    return data.onboarding_completed_at === null && data.onboarding_skipped_at === null;
  } catch (error: any) {
    if (isMissingEducationSchemaError(error)) {
      warnMissingSchemaOnce('shouldShowOnboarding', error);
      return false;
    }

    console.warn('[educationAnalyticsService] Should show onboarding error:', error);
    return false; // Fail open to avoid blocking users in onboarding loop
  }
}

/**
 * Mark onboarding as completed
 * Sets onboarding_completed_at timestamp
 *
 * @param userId - User ID
 * @returns Success status
 */
export async function markOnboardingComplete(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;

    return true;
  } catch (error: any) {
    if (isMissingEducationSchemaError(error)) {
      warnMissingSchemaOnce('markOnboardingComplete', error);
      return false;
    }

    console.warn('[educationAnalyticsService] Mark onboarding complete error:', error);
    return false;
  }
}

/**
 * Mark onboarding as skipped
 * Sets onboarding_skipped_at timestamp
 *
 * @param userId - User ID
 * @returns Success status
 */
export async function markOnboardingSkipped(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_skipped_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;

    return true;
  } catch (error: any) {
    if (isMissingEducationSchemaError(error)) {
      warnMissingSchemaOnce('markOnboardingSkipped', error);
      return false;
    }

    console.warn('[educationAnalyticsService] Mark onboarding skipped error:', error);
    return false;
  }
}

/**
 * Mark a prompt as seen
 * Appends key to education_prompts_seen JSONB array (idempotent)
 *
 * @param userId - User ID
 * @param key - Prompt key (e.g., 'seller_first_listing', 'buyer_first_purchase')
 * @returns Success status
 */
export async function markPromptSeen(userId: string, key: string): Promise<boolean> {
  try {
    // Get current seen prompts
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('education_prompts_seen')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!profile) throw new Error('Profile not found');

    const currentSeen = (profile.education_prompts_seen as string[]) || [];

    // Add key if not already present (idempotent)
    if (!currentSeen.includes(key)) {
      const updatedSeen = [...currentSeen, key];

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ education_prompts_seen: updatedSeen })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    }

    return true;
  } catch (error: any) {
    if (isMissingEducationSchemaError(error)) {
      warnMissingSchemaOnce('markPromptSeen', error);
      return false;
    }

    console.warn('[educationAnalyticsService] Mark prompt seen error:', error);
    return false;
  }
}

/**
 * Check if a prompt should be shown
 * Returns false if:
 * - Key is in education_prompts_seen array
 * - education_prompts_suppressed_at is set
 * - User skipped onboarding AND has seen 3+ prompts (auto-suppress)
 *
 * @param userId - User ID
 * @param key - Prompt key
 * @returns True if prompt should be shown
 */
export async function shouldShowPrompt(userId: string, key: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('education_prompts_seen, education_prompts_suppressed_at, onboarding_skipped_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) return true; // No profile — show prompt

    // Check if suppressed permanently
    if (profile.education_prompts_suppressed_at !== null) {
      return false;
    }

    const seenPrompts = (profile.education_prompts_seen as string[]) || [];

    // Check if already seen
    if (seenPrompts.includes(key)) {
      return false;
    }

    // Auto-suppress if skipped onboarding AND seen 3+ prompts
    if (profile.onboarding_skipped_at !== null && seenPrompts.length >= 3) {
      // Set suppression flag
      await supabase
        .from('profiles')
        .update({ education_prompts_suppressed_at: new Date().toISOString() })
        .eq('user_id', userId);

      return false;
    }

    return true;
  } catch (error: any) {
    if (isMissingEducationSchemaError(error)) {
      warnMissingSchemaOnce('shouldShowPrompt', error);
      return false;
    }

    console.warn('[educationAnalyticsService] Should show prompt error:', error);
    return true; // Default to showing prompt on error
  }
}
