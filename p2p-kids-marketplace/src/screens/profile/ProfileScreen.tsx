// File: p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx
// Profile screen with Edit and Logout functionality (AUTH-006, AUTH-007)
// TASK NOTIF-V2-004: Badge celebration modal integration
// TASK FLOW-15: UI Redesign - Phosphor icons, green theme, updated layout

import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  Camera,
  ShieldCheck,
  MapPin,
  PencilSimple,
  Storefront,
  Package,
  Coins,
  Crown,
  UsersThree,
  CaretRight,
  IdentificationCard,
  Gear,
  Receipt,
  Question,
  SignOut,
  Buildings,
} from 'phosphor-react-native';
import {
  getProfileStats,
  getUserProfile,
  ProfileStats,
  resolveAvatarUrl,
} from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import { AuthContext } from '@/contexts/AuthContext';
import { BadgeShowcase } from '@/components/BadgeShowcase';
import { idBadgeService } from '@/services/idBadge';
import { getTrialStatus, TrialStatus } from '@/services/subscriptions/trialConversion';
import { getUserReviews, getReviewStats, Review, ReviewStats } from '@/services/review';
import { ReviewCard } from '@/components/ReviewCard';
import { StarRating } from '@/components/StarRating';
import { LoadingSpinner } from '@/components/ui';
import { ReferralCodeServiceV2 } from '@/services/referralCodeV2';
import BadgeCelebrationModal from '@/components/badges/BadgeCelebrationModal';
import { useUserBadges } from '@/hooks/useUserBadges';
// generated `Database` types may be missing locally; use a permissive fallback
// to avoid type errors until DB types are generated.
import ScreenLayout from '@/components/ScreenLayout';

type UserProfile = any;

const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
};

export default function ProfileScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { logout: contextLogout, session } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    listingsCount: 0,
    tradesCount: 0,
    completedTradesCount: 0,
  });
  const [showProfileSavedBanner, setShowProfileSavedBanner] = useState(false);
  const hasFocusedOnceRef = useRef(false);
  const skipNextFocusRefreshRef = useRef(false);

  // TASK NOTIF-V2-004: Badge celebration integration
  const { newBadgeAwarded, clearNewBadge, showCelebration, setShowCelebration } = useUserBadges(
    user?.id
  );

  // Auto-show celebration modal when new badge awarded
  useEffect(() => {
    if (newBadgeAwarded && !showCelebration) {
      setShowCelebration(true);
    }
  }, [newBadgeAwarded, showCelebration, setShowCelebration]);

  const handleCelebrationClose = () => {
    setShowCelebration(false);
    clearNewBadge();
  };

  // Apply optimistic updates coming back from EditProfile for instant UX.
  useEffect(() => {
    const profilePatch = route?.params?.optimisticProfilePatch;
    const userPatch = route?.params?.optimisticUserPatch;
    const updatedAt = route?.params?.profileUpdatedAt;

    if (!updatedAt || (!profilePatch && !userPatch)) {
      return;
    }

    if (profilePatch) {
      setProfile((prev: UserProfile | null) => (prev ? { ...prev, ...profilePatch } : prev));
    }

    if (userPatch) {
      setUser((prev: any | null) => (prev ? { ...prev, ...userPatch } : prev));
    }

    setShowProfileSavedBanner(true);
    setTimeout(() => {
      setShowProfileSavedBanner(false);
    }, 1800);

    // Avoid one immediate focus refresh overwriting optimistic data with stale backend response.
    skipNextFocusRefreshRef.current = true;

    navigation.setParams({
      optimisticProfilePatch: undefined,
      optimisticUserPatch: undefined,
      profileUpdatedAt: undefined,
    });
  }, [
    route?.params?.profileUpdatedAt,
    route?.params?.optimisticProfilePatch,
    route?.params?.optimisticUserPatch,
    navigation,
  ]);

  const loadReviewsData = useCallback(async (userId: string) => {
    try {
      setLoadingReviews(true);
      const [reviewsResult, statsResult] = await Promise.all([
        getUserReviews(userId),
        getReviewStats(userId),
      ]);

      if (reviewsResult.success) {
        setReviews(reviewsResult.reviews);
      }

      if (statsResult.success && statsResult.stats) {
        setReviewStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Load reviews error:', error);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const loadProfile = useCallback(
    async ({ showFullScreenLoader = false }: { showFullScreenLoader?: boolean }) => {
      if (showFullScreenLoader) {
        setLoading(true);
      }

      try {
        const { user: authUser, error: authError } = await getCurrentUser();
        if (authError || !authUser) {
          throw new Error('Unable to get current user');
        }

        const { user: profileData, error: profileError } = await getUserProfile(authUser.id);
        if (profileError || !profileData) {
          throw new Error('Unable to load profile');
        }

        const metadataAvatar = (authUser as any).user_metadata?.avatar_url;
        const profileAvatar = (profileData as any)?.avatar_url;
        const immediateAvatar =
          typeof profileAvatar === 'string' && /^https?:\/\//i.test(profileAvatar)
            ? profileAvatar
            : metadataAvatar || null;

        // Render critical profile content first for a fast perceived load.
        setUser({
          ...authUser,
          swap_points_balance: (profileData as any).swap_points_balance ?? 0,
        });
        setProfile({
          ...(profileData as UserProfile),
          avatar_url: immediateAvatar,
        });

        if (showFullScreenLoader) {
          setLoading(false);
        }

        // Load secondary sections in parallel without blocking first paint.
        await Promise.allSettled([
          (async () => {
            if (!profileData.avatar_url) return;
            const resolvedAvatar = await resolveAvatarUrl(profileData.avatar_url);
            if (resolvedAvatar) {
              setProfile((prev: UserProfile | null) =>
                prev ? { ...prev, avatar_url: resolvedAvatar } : prev
              );
            }
          })(),
          (async () => {
            try {
              const vStatus = await idBadgeService.getVerificationStatus(authUser.id);
              setVerificationStatus(vStatus);
            } catch (error) {
              console.warn('Error loading verification status:', error);
            }
          })(),
          (async () => {
            try {
              const code = await ReferralCodeServiceV2.getReferralCode(authUser.id);
              setReferralCode(code || null);
            } catch (error) {
              console.warn('Error loading referral code:', error);
              setReferralCode(null);
            }
          })(),
          loadReviewsData(authUser.id),
          (async () => {
            try {
              const tStatus = await getTrialStatus();
              setTrialStatus(tStatus);
            } catch (error) {
              console.warn('Error loading trial status:', error);
            }
          })(),
          (async () => {
            const { stats, error } = await getProfileStats(authUser.id);
            if (stats) {
              setProfileStats(stats);
            }
            if (error) {
              console.warn('Error loading profile stats:', error);
            }
          })(),
        ]);
      } catch (error: any) {
        console.error('Load profile error:', error);
        if (showFullScreenLoader) {
          Alert.alert('Error', 'Failed to load profile. Please try again.');
        } else {
          console.warn('Background profile refresh failed:', error?.message || error);
        }
      } finally {
        if (showFullScreenLoader) {
          setLoading(false);
        }
      }
    },
    [loadReviewsData]
  );

  // Reload profile when screen gains focus (e.g., after editing).
  // Keep first load fast and avoid duplicate mount fetches.
  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;
        return;
      }

      const isFirstFocus = !hasFocusedOnceRef.current;
      hasFocusedOnceRef.current = true;
      void loadProfile({ showFullScreenLoader: isFirstFocus });
    }, [loadProfile])
  );

  const handleEditProfile = () => {
    navigation.navigate('EditProfile', {
      preloadedUser: user,
      preloadedProfile: profile,
    });
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: performLogout,
      },
    ]);
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      // Use AuthContext logout which properly clears session and updates context
      await contextLogout();
    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
      setLoggingOut(false);
    }
  };

  const handleToggleViewAll = () => {
    setShowAllReviews(!showAllReviews);
  };

  // Keep Profile SP in sync with canonical wallet session summary.
  const profileSpBalance = session?.available_points ?? user?.swap_points_balance ?? 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <LoadingSpinner fullScreen text="Loading profile..." />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadProfile({ showFullScreenLoader: true })}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScreenLayout variant="detail" title="My Profile">
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {showProfileSavedBanner && (
            <View style={styles.savedBanner}>
              <Text style={styles.savedBannerText}>Profile updated successfully</Text>
            </View>
          )}

          {/* Avatar and Name - FLOW-15 */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{getInitials(profile.name)}</Text>
                </View>
              )}
              {/* Camera overlay - FLOW-15 */}
              <View style={styles.cameraOverlay}>
                <Camera size={14} color="#FFFFFF" weight="regular" />
              </View>
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{profile.name || 'Anonymous User'}</Text>
              {verificationStatus?.status === 'approved' && (
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

            {/* Edit Profile Action Label (moved up for intuition) */}
            <TouchableOpacity style={styles.editLink} onPress={handleEditProfile} testID="avatar-upload-button">
              <PencilSimple size={14} color="#5DBB8E" weight="bold" />
              <Text style={styles.editLinkText}>Edit basic info</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Row - FLOW-15 */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statChip}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('MyListings')}
              testID="profile-listings-stat"
            >
              <Storefront size={18} color="#5DBB8E" weight="regular" />
              <Text style={styles.statValue}>{profileStats.listingsCount}</Text>
              <Text style={styles.statLabel}>Listings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statChip}
              activeOpacity={0.8}
              onPress={() => navigation.getParent()?.navigate('TradeList')}
              testID="profile-trades-stat"
            >
              <Package size={18} color="#5DBB8E" weight="regular" />
              <Text style={styles.statValue}>{profileStats.tradesCount}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statChip}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SpWallet')}
              testID="profile-sp-balance-stat"
            >
              <Coins size={18} color="#F59E0B" weight="regular" />
              <Text style={styles.statValue}>{profileSpBalance}</Text>
              <Text style={styles.statLabel}>SP Balance</Text>
            </TouchableOpacity>
          </View>

          {/* HI-VALUE PROMOTION SECTION (Dashboard Style) */}
          <View style={styles.promoSection}>
            {/* 1. Subscription Tier Promo */}
            <TouchableOpacity
              style={[
                styles.promoCard,
                trialStatus?.status === 'active' || trialStatus?.status === 'trial'
                  ? styles.clubActiveCard
                  : styles.clubPromoCard,
              ]}
              onPress={() =>
                navigation.navigate(
                  trialStatus?.status === 'active' || trialStatus?.status === 'trial'
                    ? 'MySubscription'
                    : 'JoinKidsClub'
                )
              }
            >
              <View style={styles.promoIconContainer}>
                <Crown
                  size={24}
                  color={
                    trialStatus?.status === 'active' || trialStatus?.status === 'trial'
                      ? '#F59E0B'
                      : '#5DBB8E'
                  }
                  weight="fill"
                />
              </View>
              <View style={styles.promoContent}>
                <Text style={styles.promoTitle}>
                  {trialStatus?.status === 'active' || trialStatus?.status === 'trial'
                    ? "Kid's Club Member"
                    : "Join Kid's Club"}
                </Text>
                <Text style={styles.promoSubtitle}>
                  {trialStatus?.status === 'active' || trialStatus?.status === 'trial'
                    ? 'Exclusive perks active'
                    : 'Unlock Swap Points & free listings'}
                </Text>
              </View>
              <CaretRight size={18} color="#9CA3AF" weight="bold" />
            </TouchableOpacity>

            {/* 2. Referral / Share & Earn Promo */}
            <TouchableOpacity
              style={styles.promoCard}
              onPress={() => navigation.navigate('ReferralDashboard')}
            >
              <View style={[styles.promoIconContainer, { backgroundColor: '#F0F7FF' }]}>
                <UsersThree size={24} color="#3B82F6" weight="bold" />
              </View>
              <View style={styles.promoContent}>
                <Text style={styles.promoTitle}>Share & Earn</Text>
                <Text style={styles.promoSubtitle}>
                  Get bonus SP for inviting friends
                  {referralCode ? ` (${referralCode})` : ''}
                </Text>
              </View>
              <CaretRight size={18} color="#9CA3AF" weight="bold" />
            </TouchableOpacity>

            {/* 3. ID Verification Promo */}
            <TouchableOpacity
              style={[
                styles.promoCard,
                verificationStatus?.status === 'approved' && styles.verifiedCard,
                verificationStatus?.status === 'pending' && styles.pendingCard,
              ]}
              testID="id-verification-menu-item"
              onPress={() => navigation.navigate('IDVerificationUpload')}
            >
              <View
                style={[
                  styles.promoIconContainer,
                  verificationStatus?.status === 'approved'
                    ? { backgroundColor: '#ECFDF5' }
                    : { backgroundColor: '#F3F4F6' },
                ]}
              >
                <IdentificationCard
                  size={24}
                  color={verificationStatus?.status === 'approved' ? '#10B981' : '#6B6B6B'}
                  weight="bold"
                />
              </View>
              <View style={styles.promoContent}>
                <Text
                  style={[
                    styles.promoTitle,
                    verificationStatus?.status === 'approved' && { color: '#10B981' },
                  ]}
                >
                  {verificationStatus?.status === 'approved'
                    ? 'Identity Verified'
                    : verificationStatus?.status === 'pending'
                      ? 'Verification Pending'
                      : 'Verify Identity'}
                </Text>
                <Text style={styles.promoSubtitle}>
                  {verificationStatus?.status === 'approved'
                    ? 'Trust level: Ultimate'
                    : verificationStatus?.status === 'pending'
                      ? 'We are reviewing your ID'
                      : 'Increase trust & safety'}
                </Text>
              </View>
              <CaretRight size={18} color="#9CA3AF" weight="bold" />
            </TouchableOpacity>
          </View>

          {/* Badges Section */}
          <BadgeShowcase userId={user.id} />

          {/* Secondary Utilities Section (List style) */}
          <View style={styles.utilitySection}>
            <TouchableOpacity
              style={styles.utilityRow}
              onPress={() => navigation.navigate('TransactionHistory')}
              testID="profile-billing-history"
            >
              <Receipt size={20} color="#6B6B6B" weight="regular" />
              <Text style={styles.utilityText}>Billing History</Text>
              <CaretRight size={16} color="#CCCCCC" weight="bold" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.utilityRow}
              onPress={() => navigation.navigate('Settings')}
              testID="profile-settings"
            >
              <Gear size={20} color="#6B6B6B" weight="regular" />
              <Text style={styles.utilityText}>App Settings</Text>
              <CaretRight size={16} color="#CCCCCC" weight="bold" />
            </TouchableOpacity>

            {/* Admin Dashboard - visible if user has role or in dev */}
            <TouchableOpacity
              style={styles.utilityRow}
              onPress={() => navigation.navigate('AdminDashboard')}
              testID="profile-admin-dashboard"
            >
              <Buildings size={20} color="#92400E" weight="regular" />
              <Text style={[styles.utilityText, { color: '#92400E' }]}>Admin Dashboard</Text>
              <CaretRight size={16} color="#CCCCCC" weight="bold" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.utilityRow}
              onPress={() => navigation.navigate('HelpSupport')}
              testID="profile-help-support"
            >
              <Question size={20} color="#6B6B6B" weight="regular" />
              <Text style={styles.utilityText}>Help & Support</Text>
              <CaretRight size={16} color="#CCCCCC" weight="bold" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.utilityRow, { borderBottomWidth: 0 }]}
              onPress={handleLogout}
              disabled={loggingOut}
              testID="profile-logout"
            >
              <SignOut size={20} color="#EF4444" weight="regular" />
              <Text style={[styles.utilityText, { color: '#EF4444' }]}>Logout</Text>
              {loggingOut ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <CaretRight size={16} color="#CCCCCC" weight="bold" />
              )}
            </TouchableOpacity>
          </View>

          {/* Reviews Section */}
          {reviewStats && reviewStats.total_reviews > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionTitle}>Reviews ({reviewStats.total_reviews})</Text>

              {/* Rating Summary */}
              <View style={styles.ratingSection}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.averageRating}>{reviewStats.average_rating.toFixed(1)}</Text>
                  <View style={styles.ratingDetails}>
                    <StarRating rating={Math.round(reviewStats.average_rating)} size={24} />
                    <Text style={styles.totalReviews}>
                      Based on {reviewStats.total_reviews}{' '}
                      {reviewStats.total_reviews === 1 ? 'review' : 'reviews'}
                    </Text>
                  </View>
                </View>

                {/* Rating Breakdown */}
                <View style={styles.breakdown}>
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count =
                      reviewStats.rating_breakdown[
                        stars as keyof typeof reviewStats.rating_breakdown
                      ];
                    const percentage =
                      reviewStats.total_reviews > 0 ? (count / reviewStats.total_reviews) * 100 : 0;

                    return (
                      <View key={stars} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>{stars} ★</Text>
                        <View style={styles.breakdownBar}>
                          <View style={[styles.breakdownFill, { width: `${percentage}%` }]} />
                        </View>
                        <Text style={styles.breakdownCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Recent Reviews */}
              <View style={styles.reviewsList}>
                <View style={styles.reviewsListHeader}>
                  <Text style={styles.reviewsListTitle}>
                    {showAllReviews ? 'All Reviews' : 'Recent Reviews'}
                  </Text>
                  {reviews.length > 5 && (
                    <TouchableOpacity
                      style={styles.viewAllButtonContainer}
                      onPress={handleToggleViewAll}
                    >
                      <Text style={styles.viewAllButtonText}>
                        {showAllReviews ? 'Show Less' : `View All (${reviews.length})`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {loadingReviews ? (
                  <ActivityIndicator size="small" color="#5DBB8E" style={{ marginVertical: 20 }} />
                ) : reviews.length > 0 ? (
                  (showAllReviews ? reviews : reviews.slice(0, 5)).map((review) => (
                    <ReviewCard key={review.id} review={review} currentUserId={user.id} />
                  ))
                ) : (
                  <Text style={styles.noReviewsText}>No reviews yet</Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* TASK NOTIF-V2-004: Badge Celebration Modal */}
        <BadgeCelebrationModal
          visible={showCelebration}
          badge={newBadgeAwarded}
          onClose={handleCelebrationClose}
        />
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
    padding: 20,
  },
  savedBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  savedBannerText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#5DBB8E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5DBB8E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bio: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
    backgroundColor: '#F0F7F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editLinkText: {
    fontSize: 12,
    color: '#5DBB8E',
    fontWeight: '700',
  },
  promoSection: {
    gap: 12,
    marginBottom: 24,
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
  },
  clubPromoCard: {
    borderColor: '#5DBB8E',
    backgroundColor: '#F0F7F3',
  },
  clubActiveCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBE6',
  },
  verifiedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  pendingCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
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
    color: '#1A1A1A',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  utilitySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  utilityText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    marginLeft: 12,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  actionsSection: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B6B6B',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#5DBB8E',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  editButtonText: {
    color: '#5DBB8E',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsButtonText: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
  },
  clubButton: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  clubButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  billingButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billingButtonText: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
  },
  adminDashboardButton: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  adminDashboardButtonText: {
    color: '#92400E',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '600',
  },
  reviewsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewDashboardButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F7F3',
  },
  viewDashboardButtonText: {
    color: '#5DBB8E',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  averageRating: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
    marginRight: 16,
  },
  ratingDetails: {
    flex: 1,
  },
  totalReviews: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  breakdown: {
    marginTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownLabel: {
    width: 40,
    fontSize: 14,
    color: '#374151',
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: '#FBBF24',
  },
  breakdownCount: {
    width: 30,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'right',
  },
  reviewsList: {
    marginTop: 8,
  },
  reviewsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewsListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  viewAllButtonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  viewAllButtonText: {
    color: '#5DBB8E',
    fontSize: 14,
    fontWeight: '600',
  },
  noReviewsText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 20,
  },
  referralSection: {
    marginBottom: 24,
  },
  pendingReferralBadge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pendingReferralText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  referralCodeContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referralCodeWrapper: {
    flex: 1,
    marginRight: 12,
  },
  referralCodeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  referralCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5DBB8E',
    marginBottom: 8,
    letterSpacing: 2,
  },
  referralCodeHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  copyButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  copyButtonSuccess: {
    backgroundColor: '#10B981',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  verificationSection: {
    marginBottom: 24,
  },
  statusIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeButton: {
    flexDirection: 'row',
    backgroundColor: '#F0F7F3',
    borderWidth: 1,
    borderColor: '#5DBB8E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#5DBB8E',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  upgradeButtonSubtext: {
    color: '#6B6B6B',
    fontSize: 12,
  },
  verifiedContainer: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  verifiedSubtext: {
    color: '#34D399',
    fontSize: 12,
  },
  pendingContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pendingText: {
    color: '#D97706',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingSubtext: {
    color: '#FBBF24',
    fontSize: 12,
  },
  rejectedContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  rejectedText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  rejectedSubtext: {
    color: '#F87171',
    fontSize: 12,
  },
});
