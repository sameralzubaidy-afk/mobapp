// File: p2p-kids-marketplace/src/screens/profile/ProfileScreen.tsx
// Profile screen with Edit and Logout functionality (AUTH-006, AUTH-007)

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { getUserProfile } from '@/services/profile';
import { getCurrentUser } from '@/services/supabase/auth';
import { supabase } from '@/services/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import { BadgeShowcase } from '@/components/BadgeShowcase';
import { getUserReviews, getReviewStats, Review, ReviewStats } from '@/services/review';
import { ReviewCard } from '@/components/ReviewCard';
import { StarRating } from '@/components/StarRating';
// generated `Database` types may be missing locally; use a permissive fallback
// to avoid type errors until DB types are generated.
import BottomNavBar from '@/components/organisms/BottomNavBar';

type UserProfile = any;

export default function ProfileScreen({ navigation }: any) {
  const { logout: contextLogout } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Reload profile when screen gains focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const { user: authUser, error: authError } = await getCurrentUser();
      if (authError || !authUser) {
        throw new Error('Unable to get current user');
      }

      const { user: profileData, error: profileError } = await getUserProfile(authUser.id);
      if (profileError || !profileData) {
        throw new Error('Unable to load profile');
      }

      // Resolve phone with fallbacks
      let phoneFromAuth = (authUser as any).phone || 
        ((authUser as any).user_metadata?.phone) || '';
      if (!phoneFromAuth) {
        try {
          const { data: phoneData, error: phoneError } = await supabase
            .from('phone_verification_codes')
            .select('phone')
            .eq('user_id', authUser.id)
            .eq('verified', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!phoneError && phoneData?.phone) phoneFromAuth = phoneData.phone;
        } catch (e) {
          console.warn('Error fetching verified phone:', e);
        }
      }

      // Resolve avatar URL
      let resolvedAvatar: string | null = null;
      if (profileData.avatar_url) {
        if (profileData.avatar_url.startsWith('http')) resolvedAvatar = profileData.avatar_url;
        else {
          const { data: urlData } = supabase.storage.from('user-avatars').getPublicUrl(profileData.avatar_url);
          resolvedAvatar = urlData.publicUrl || null;
        }
      } else if ((authUser as any).user_metadata?.avatar_url) {
        resolvedAvatar = (authUser as any).user_metadata.avatar_url;
      }

      setUser({ ...authUser, phone: phoneFromAuth });
      setProfile(profileData as UserProfile);
      
      // Load reviews and stats
      await loadReviewsData(authUser.id);
    } catch (error: any) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadReviewsData = async (userId: string) => {
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
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      // Use AuthContext logout which properly clears session and updates context
      await contextLogout();
      console.log('[LOGOUT] Context logout successful, session cleared');
    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Avatar and Name */}
      <View style={styles.profileHeader}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {profile.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.displayName}>{profile.name || 'Anonymous User'}</Text>
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {/* Profile Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{user.email || 'Not provided'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone:</Text>
          <Text style={styles.infoValue}>{user.phone || 'Not provided'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Swap Points:</Text>
          <Text style={styles.infoValue}>{user.swap_points_balance || 0} SP</Text>
        </View>
      </View>

      {/* Badges Section */}
      <BadgeShowcase userId={user.id} />

      {/* Reviews Section */}
      {reviewStats && reviewStats.total_reviews > 0 && (
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Reviews ({reviewStats.total_reviews})</Text>
          
          {/* Rating Summary */}
          <View style={styles.ratingSection}>
            <View style={styles.ratingHeader}>
              <Text style={styles.averageRating}>
                {reviewStats.average_rating.toFixed(1)}
              </Text>
              <View style={styles.ratingDetails}>
                <StarRating rating={Math.round(reviewStats.average_rating)} size={24} />
                <Text style={styles.totalReviews}>
                  Based on {reviewStats.total_reviews} {reviewStats.total_reviews === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            </View>

            {/* Rating Breakdown */}
            <View style={styles.breakdown}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviewStats.rating_breakdown[stars as keyof typeof reviewStats.rating_breakdown];
                const percentage = reviewStats.total_reviews > 0
                  ? (count / reviewStats.total_reviews) * 100
                  : 0;

                return (
                  <View key={stars} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{stars} ★</Text>
                    <View style={styles.breakdownBar}>
                      <View
                        style={[styles.breakdownFill, { width: `${percentage}%` }]}
                      />
                    </View>
                    <Text style={styles.breakdownCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Recent Reviews */}
          <View style={styles.reviewsList}>
            <Text style={styles.reviewsListTitle}>Recent Reviews</Text>
            {loadingReviews ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 20 }} />
            ) : reviews.length > 0 ? (
              reviews.slice(0, 5).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet</Text>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text style={styles.logoutButtonText}>🚪 Logout</Text>
          )}
        </TouchableOpacity>
      </View>
        </ScrollView>
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 20,
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
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholderText: {
    fontSize: 40,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
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
  editButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
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
  reviewsListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  noReviewsText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 20,
  },
});
