// File: p2p-kids-marketplace/src/services/sp/expiration.ts
// MODULE-09 SP-004: SP Expiration Service
// Handles expiration date calculation, warning queries, and grace period logic

import { supabase } from '@/config/supabase';

export interface ExpirationWarning {
  warning_id: string;
  sp_amount: number;
  expires_at: string;
  days_until_expiry: number;
  warning_type: '30_day' | '14_day' | '7_day' | '1_day';
}

export interface ExpirationSummary {
  has_expiring_sp: boolean;
  total_expiring_sp: number;
  earliest_expiration: string | null;
  days_until_earliest: number | null;
  warnings: ExpirationWarning[];
}

/**
 * Get expiration warnings for current user
 * Returns batches expiring within 30 days
 */
export async function getExpirationWarnings(): Promise<ExpirationWarning[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.rpc('get_user_expiration_warnings', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Get expiration warnings error:', error);
      return [];
    }

    return (data || []) as ExpirationWarning[];
  } catch (error) {
    console.error('Get expiration warnings exception:', error);
    return [];
  }
}

/**
 * Get expiration summary for wallet screen
 * Includes total expiring SP and earliest expiration date
 * NOTE: Queries sp_batches table directly within 30-day window
 * Filters: remaining_sp > 0, is_expired = false, expires_at between NOW() and NOW()+30d
 */
export async function getExpirationSummary(userId: string): Promise<ExpirationSummary> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    console.log('[SP Expiration] Fetching summary for user:', userId);
    console.log('[SP Expiration] Now:', now.toISOString());
    console.log('[SP Expiration] 30 days from now:', thirtyDaysFromNow.toISOString());

    // Get expiring batches (remaining_sp > 0, not expired, expires within 30 days)
    const { data: batches, error } = await supabase
      .from('sp_batches')
      .select('id, user_id, remaining_sp, expires_at, is_expired')
      .eq('user_id', userId)
      .eq('is_expired', false)
      .gt('remaining_sp', 0)
      .lte('expires_at', thirtyDaysFromNow.toISOString())
      .gte('expires_at', now.toISOString())
      .order('expires_at', { ascending: true });

    if (error) {
      console.error('[SP Expiration] Query error:', error);
      return {
        has_expiring_sp: false,
        total_expiring_sp: 0,
        earliest_expiration: null,
        days_until_earliest: null,
        warnings: [],
      };
    }

    console.log('[SP Expiration] Found batches:', batches?.length || 0);
    if (batches) {
      batches.forEach((b: any, idx: number) => {
        console.log(`[SP Expiration] Batch ${idx}:`, {
          id: b.id,
          remaining_sp: b.remaining_sp,
          expires_at: b.expires_at,
        });
      });
    }

    if (!batches || batches.length === 0) {
      console.log('[SP Expiration] No expiring batches found');
      return {
        has_expiring_sp: false,
        total_expiring_sp: 0,
        earliest_expiration: null,
        days_until_earliest: null,
        warnings: [],
      };
    }

    // Calculate total from batches
    const totalExpiringSp = batches.reduce((sum: number, b: any) => sum + b.remaining_sp, 0);
    const earliest = batches[0] as any; // Already sorted by expiration date

    // Calculate days until earliest expiry
    const expiryTime = new Date(earliest.expires_at).getTime();
    const daysUntil = Math.max(0, Math.floor((expiryTime - now.getTime()) / (1000 * 60 * 60 * 24)));

    console.log('[SP Expiration] Summary result:', {
      totalExpiringSp,
      daysUntil,
      earliestExpiry: earliest.expires_at,
    });

    return {
      has_expiring_sp: true,
      total_expiring_sp: totalExpiringSp,
      earliest_expiration: earliest.expires_at,
      days_until_earliest: daysUntil,
      warnings: [], // Warnings not needed for summary display
    };
  } catch (error) {
    console.error('[SP Expiration] Get expiration summary exception:', error);
    return {
      has_expiring_sp: false,
      total_expiring_sp: 0,
      earliest_expiration: null,
      days_until_earliest: null,
      warnings: [],
    };
  }
}

const DEFAULT_EXPIRATION_DAYS = 365;

/**
 * Calculate expiration date based on a delta and an optional start date.
 */
export function calculateExpirationDate(daysUntilExpiry: number, startDate?: Date): Date {
  if (!Number.isFinite(daysUntilExpiry)) {
    throw new Error('daysUntilExpiry must be a finite number');
  }

  const baseDate = startDate ? new Date(startDate) : new Date();
  const expirationDate = new Date(baseDate);
  expirationDate.setUTCDate(expirationDate.getUTCDate() + daysUntilExpiry);
  return expirationDate;
}

/**
 * Calculate expiration date using the admin-configured period (from sp_config).
 */
export async function calculateExpirationDateFromConfig(startDate?: Date): Promise<Date> {
  try {
    const { data: periodData } = await supabase
      .from('sp_config')
      .select('config_value')
      .eq('config_key', 'expiration_period_days')
      .single();

    const expirationDays = periodData?.config_value
      ? parseInt(periodData.config_value, 10)
      : DEFAULT_EXPIRATION_DAYS;

    return calculateExpirationDate(expirationDays, startDate);
  } catch (error) {
    console.error('Calculate expiration date exception:', error);
    return calculateExpirationDate(DEFAULT_EXPIRATION_DAYS, startDate);
  }
}

/**
 * Check if expiration warnings exist (for UI conditional rendering)
 */
export async function hasExpirationWarnings(userId: string): Promise<boolean> {
  try {
    const warnings = await getExpirationWarnings();
    return warnings.length > 0;
  } catch (error) {
    console.error('Check expiration warnings exception:', error);
    return false;
  }
}

/**
 * Format days until expiry for UI display
 */
export function formatDaysUntilExpiry(days: number): string {
  if (days < 0) {
    const absDays = Math.abs(days);
    const unit = absDays === 1 ? 'day' : 'days';
    return `Expired ${absDays} ${unit} ago`;
  }

  if (days === 0) {
    return 'Expires today';
  }

  const unit = days === 1 ? 'day' : 'days';
  return `Expires in ${days} ${unit}`;
}

/**
 * Get color for expiration warning badge
 */
export function getExpirationWarningColor(days: number): string {
  if (days <= 7) {
    return '#EF4444'; // Red - urgent
  }

  if (days <= 30) {
    return '#F59E0B'; // Orange - warning
  }

  return '#10B981'; // Green - safe
}
