// File: p2p-kids-marketplace/src/screens/profile/SellerProfileScreen.tsx
// TASK FLOW-15: Public Seller Profile View
// Displays another user's public profile with ratings, badges (collapsible), and active listings
// NOTE: Follow button has been intentionally removed. Do NOT re-add it.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Star, ShieldCheck, MapPin, IdentificationCard, CaretDown, CaretUp } from 'phosphor-react-native';
import Avatar from '@/components/atoms/Avatar';
import { LoadingSpinner } from '@/components/ui';
import { getUserProfile } from '@/services/profile';
import { getUserBadges } from '@/services/badges';
import { idBadgeService, IDVerificationStatus } from '@/services/idBadge';
import { supabase } from '@/services/supabase/client';
import { UserBadge } from '@/types/badge';
import { getReviewStats, ReviewStats } from '@/services/review';
import { PersistentTabBar } from '@/components/organisms/PersistentTabBar';
import ScreenLayout from '@/components/ScreenLayout';

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default function SellerProfileScreen({ navigation: _navigation, route }: any) {
  const userId = route?.params?.userId;
  const routeVerificationStatus = String(route?.params?.sellerVerificationStatus ?? '').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [completedTradesCount, setCompletedTradesCount] = useState(0);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [idVerificationStatus, setIdVerificationStatus] = useState<IDVerificationStatus['status']>('none');
  const [badgesExpanded, setBadgesExpanded] = useState(false);

  const profileVerificationStatus = String(
    profile?.verification_status ?? profile?.id_verification_status ?? ''
  ).toLowerCase();
  const hasVerificationBadge = badges.some((userBadge) => {
    const badgeName = String(userBadge?.badge?.name ?? '').toLowerCase();
    return badgeName.includes('verified') || badgeName.includes('identity') || badgeName.includes('id');
  });
  const isIdentityVerified =
    routeVerificationStatus === 'approved' ||
    routeVerificationStatus === 'verified' ||
    routeVerificationStatus === 'completed' ||
    routeVerificationStatus === 'complete' ||
    idVerificationStatus === 'approved' ||
    profileVerificationStatus === 'approved' ||
    profileVerificationStatus === 'verified' ||
    profileVerificationStatus === 'completed' ||
    profileVerificationStatus === 'complete' ||
    profile?.is_verified === true ||
    profile?.identity_verified === true ||
    profile?.kyc_verified === true ||
    hasVerificationBadge;

  const loadSellerProfile = useCallback(async () => {
    setLoading(true);
    try {
      if (!userId) {
        throw new Error('Missing seller user id');
      }

      let resolvedProfile: any | null = null;
      const { user: profileByUserId } = await getUserProfile(userId);
      if (profileByUserId) {
        resolvedProfile = profileByUserId;
      } else if (isUuid(String(userId || ''))) {
        // Fallback: some navigation contexts may pass a profile row id instead of auth user_id.
        const { data: profileByRowId } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        resolvedProfile = profileByRowId;
      }

      if (!resolvedProfile) {
        throw new Error('Unable to load seller profile');
      }

      setProfile(resolvedProfile);
      setLoading(false);

      const candidateIds = Array.from(
        new Set([
          userId,
          String(resolvedProfile.user_id || ''),
          String(resolvedProfile.id || ''),
        ].filter(Boolean))
      );

      const reviewBundles = await Promise.all(
        candidateIds.map(async (candidateId) => {
          try {
            const statsResult = await getReviewStats(candidateId);
            return {
              candidateId,
              statsResult,
            };
          } catch {
            return {
              candidateId,
              statsResult: { success: false, stats: null },
            };
          }
        })
      );

      const bestReviewBundle = reviewBundles
        .filter((bundle) => bundle.statsResult.success && bundle.statsResult.stats)
        .sort((a, b) => {
          const aCount = a.statsResult.stats?.total_reviews ?? 0;
          const bCount = b.statsResult.stats?.total_reviews ?? 0;
          return bCount - aCount;
        })[0];

      if (bestReviewBundle?.statsResult.success && bestReviewBundle.statsResult.stats) {
        setReviewStats(bestReviewBundle.statsResult.stats);
      }

      const candidateUuids = candidateIds.filter((candidateId) => isUuid(String(candidateId)));
      if (candidateUuids.length === 0) {
        return;
      }

      void (async () => {
        try {
          const [
            badgeResult,
            verificationStatuses,
            completedTradeCounts,
            approvedVerificationMatches,
          ] = await Promise.all([
            getUserBadges(String(resolvedProfile.user_id || userId)).catch(() => []),
            Promise.all(
              candidateUuids.map(async (candidateId) => ({
                candidateId,
                status: await idBadgeService.getVerificationStatus(candidateId).catch(() => ({
                  status: 'none' as IDVerificationStatus['status'],
                })),
              }))
            ),
            Promise.all(
              candidateUuids.map(async (candidateId) => {
                const { count, error } = await supabase
                  .from('trades')
                  .select('id', { count: 'exact', head: true })
                  .eq('seller_id', candidateId)
                  .eq('status', 'completed');

                return {
                  candidateId,
                  count: count ?? 0,
                  error,
                };
              })
            ),
            Promise.all(
              candidateUuids.map(async (candidateId) => {
                const { data, error } = await supabase
                  .from('id_badge_verification_requests')
                  .select('id')
                  .eq('user_id', candidateId)
                  .eq('status', 'approved')
                  .limit(1);

                return {
                  candidateId,
                  hasApproved: !error && Boolean(data && data.length > 0),
                };
              })
            ),
          ]);

          const completedTradesMax = completedTradeCounts.reduce((maxValue, entry) => {
            return entry.count > maxValue ? entry.count : maxValue;
          }, 0);
          setCompletedTradesCount(completedTradesMax);

          const hasApprovedFromPolicyRead = approvedVerificationMatches.some(
            (entry) => entry.hasApproved
          );

          const approvedStatus = verificationStatuses.find(
            (entry) => entry.status?.status === 'approved'
          );
          const preferredStatus =
            (hasApprovedFromPolicyRead ? 'approved' : null) ||
            approvedStatus?.status?.status ||
            verificationStatuses.find((entry) => entry.status?.status !== 'none')?.status?.status ||
            'none';
          setIdVerificationStatus(preferredStatus);

          setBadges(badgeResult);
        } catch (secondaryLoadError) {
          console.error('Load seller profile secondary data error:', secondaryLoadError);
        }
      })();
    } catch (error) {
      console.error('Load seller profile error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSellerProfile();
  }, [loadSellerProfile]);

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Seller Profile">
        <LoadingSpinner fullScreen text="Loading profile..." />
      </ScreenLayout>
    );
  }

  if (!profile) {
    return (
      <ScreenLayout variant="detail" title="Seller Profile">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSellerProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="detail" title="Seller Profile">
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {/* Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Avatar
                imageUrl={profile.avatar_url}
                size={96}
                verificationStatus={profile.verification_status}
                name={profile.name}
              />
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{profile.name || 'Anonymous'}</Text>
              {isIdentityVerified && (
                <ShieldCheck size={16} color="#5DBB8E" weight="fill" style={{ marginLeft: 6 }} />
              )}
            </View>
            {profile.node_name && (
              <View style={styles.locationRow}>
                <MapPin size={14} color="#6B6B6B" weight="regular" />
                <Text style={styles.locationText}>{profile.node_name}</Text>
              </View>
            )}
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          {/* Rating Summary - FLOW-15 */}
            <View style={styles.ratingRow}>
              {reviewStats && reviewStats.total_reviews > 0 ? (
                <>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        color={star <= Math.round(reviewStats.average_rating) ? '#F59E0B' : '#E0E0E0'}
                        weight={star <= Math.round(reviewStats.average_rating) ? 'fill' : 'regular'}
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingNumber}>{reviewStats.average_rating.toFixed(1)}</Text>
                  <Text style={styles.reviewCount}>({reviewStats.total_reviews} reviews)</Text>
                </>
              ) : (
                <Text style={styles.noReviewsText}>No ratings yet</Text>
              )}
            </View>

          {/* Trust Indicators Section */}
          <View style={styles.trustSection}>
            <View style={[styles.promoCard, isIdentityVerified ? styles.verifiedCard : styles.unverifiedCard]}>
              <View
                style={[
                  styles.promoIconContainer,
                  { backgroundColor: isIdentityVerified ? '#ECFDF5' : '#FFFBEB' },
                ]}
              >
                <IdentificationCard
                  size={24}
                  color={isIdentityVerified ? '#10B981' : '#F59E0B'}
                  weight="bold"
                />
              </View>
              <View style={styles.promoContent}>
                <Text style={[styles.promoTitle, { color: isIdentityVerified ? '#10B981' : '#B45309' }]}>
                  {isIdentityVerified ? 'Identity Verified' : 'Identity Not Verified'}
                </Text>
                <Text style={styles.promoSubtitle}>
                  {isIdentityVerified
                    ? 'Trust level: Ultimate'
                    : idVerificationStatus === 'pending'
                      ? 'Verification pending'
                      : 'Verification required'}
                </Text>
              </View>
            </View>

            {(badges.length > 0) && (
              <View style={styles.badgesWrapper}>
                <TouchableOpacity
                  style={styles.badgesToggleRow}
                  onPress={() => setBadgesExpanded((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={badgesExpanded ? 'Collapse badges' : 'Expand badges'}
                >
                  <Text style={styles.badgesTitle}>Badges ({badges.length})</Text>
                  {badgesExpanded ? (
                    <CaretUp size={18} color="#1A1A1A" weight="bold" />
                  ) : (
                    <CaretDown size={18} color="#1A1A1A" weight="bold" />
                  )}
                </TouchableOpacity>
                {badgesExpanded && (
                  <View style={styles.badgesList}>
                    {badges.map((userBadge) => (
                      <View key={userBadge.id} style={styles.trustBadgeRow}>
                        <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
                        <Text style={styles.trustBadgeText}>{userBadge.badge?.name || 'Earned Badge'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            
            {!isIdentityVerified && badges.length === 0 && (
              <Text style={styles.noTrustText}>No trust indicators yet</Text>
            )}
          </View>

          {/* Completed Trades Section */}
          <View style={styles.tradesSection}>
            <Text style={styles.sectionTitle}>Completed Trades</Text>
            <View style={styles.tradesCountCard}>
              <Text style={styles.tradesCountValue}>{completedTradesCount}</Text>
              <Text style={styles.tradesCountLabel}>Total completed trades</Text>
            </View>
          </View>
        </ScrollView>
        <PersistentTabBar />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B6B6B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#E85D75',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#5DBB8E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 26,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  bio: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  // Follow button styles removed intentionally — do NOT re-add.
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  noReviewsText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
  },
  trustSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 2,
    width: '100%',
    marginBottom: 20,
  },
  verifiedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  unverifiedCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  badgesWrapper: {
    width: '100%',
  },
  badgesToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  badgesList: {
    width: '100%',
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  trustBadgeText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  noTrustText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
  },
  tradesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  tradesCountCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  tradesCountValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  tradesCountLabel: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});
