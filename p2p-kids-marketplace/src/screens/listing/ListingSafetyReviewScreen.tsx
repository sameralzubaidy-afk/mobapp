import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import {
  getListingById,
  submitListingAppeal,
  submitListingNeedsEditsReReview,
} from '@/services/listing';
import { Listing } from '@/types/listing';

type ListingSafetyRoute = RouteProp<RootStackParamList, 'ListingSafetyReview'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ListingSafetyReviewScreen() {
  const route = useRoute<ListingSafetyRoute>();
  const navigation = useNavigation<NavigationProp>();
  const { listing_id } = route.params;
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState('');

  const loadListing = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getListingById(listing_id);
      if (!data) {
        setError('Listing not found');
        return;
      }

      if (session?.user?.id && data.seller_id !== session.user.id) {
        setError('You can only review your own listing safety status.');
        return;
      }

      setListing(data);
      setAppealReason(data.appeal_reason?.trim() || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load listing';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [listing_id, session?.user?.id]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  useFocusEffect(
    useCallback(() => {
      loadListing();
    }, [loadListing])
  );

  const handleAppeal = async () => {
    if (!listing || !session?.user?.id) {
      Alert.alert('Error', 'Unable to submit appeal right now.');
      return;
    }

    const trimmedReason = appealReason.trim();
    if (!trimmedReason) {
      Alert.alert('Appeal Reason Required', 'Please explain why you are appealing this decision.');
      return;
    }

    if (trimmedReason.length < 10) {
      Alert.alert('Appeal Reason Too Short', 'Please provide at least 10 characters so admin can review context.');
      return;
    }

    Alert.alert(
      'Submit Appeal',
      'This will send your listing back for admin review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Appeal',
          onPress: async () => {
            try {
              setSubmitting(true);
              const updated = await submitListingAppeal(listing.id, session.user.id, trimmedReason);
              setListing(updated);
              setAppealReason(updated.appeal_reason || '');
              Alert.alert('Appeal Submitted', 'Your listing is back under review.');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to submit appeal';
              Alert.alert('Error', message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleNeedsEditsResubmit = async () => {
    if (!listing || !session?.user?.id) {
      Alert.alert('Error', 'Unable to submit for re-review right now.');
      return;
    }

    Alert.alert(
      'Submit for Re-Review',
      'After submitting, your listing will return to admin review queue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setSubmitting(true);
              const updated = await submitListingNeedsEditsReReview(
                listing.id,
                session.user.id
              );
              setListing(updated);
              Alert.alert('Submitted', 'Your listing is back under review.', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('MyListings'),
                },
              ]);
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Failed to submit for re-review';
              Alert.alert('Error', message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.helperText}>Loading safety review...</Text>
      </SafeAreaView>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Unable to open safety review</Text>
        <Text style={styles.errorText}>{error || 'Listing not found'}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const firstImage = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const firstImageUrl = firstImage ? firstImage.thumbnail_url || firstImage.url : null;
  const isRejected = listing.status === 'rejected';
  const isFlagged = listing.status === 'flagged';
  const needsEdits = listing.status === 'needs_edits';
  const appealsSubmitted = Number.isFinite(Number(listing.appeal_count))
    ? Number(listing.appeal_count)
    : 0;
  const lastFlaggedAt = listing.flagged_at ?? (needsEdits ? listing.updated_at : null);
  const lastRejectedAt =
    listing.rejected_at ?? (needsEdits ? listing.flagged_at ?? listing.updated_at : null);
  const adminNeedsEditsNote =
    listing.moderation_note?.trim() || listing.rejection_reason?.trim() || null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Listing Safety Review</Text>

        <View style={styles.card}>
          {firstImageUrl ? (
            <Image source={{ uri: firstImageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}

          <Text style={styles.itemTitle}>{listing.title}</Text>
          <Text style={styles.itemPrice}>${listing.price.toFixed(2)}</Text>

          <View style={[styles.statusBadge, isRejected ? styles.statusRejected : needsEdits ? styles.statusNeedsEdits : styles.statusFlagged]}>
            <Text style={[styles.statusText, isRejected ? styles.statusTextRejected : needsEdits ? styles.statusTextNeedsEdits : styles.statusTextFlagged]}>
              {listing.status === 'needs_edits' ? 'NEEDS EDITS' : listing.status.toUpperCase()}
            </Text>
          </View>

          {isRejected && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonTitle}>Rejection Reason</Text>
              <Text style={styles.reasonText}>
                {listing.rejection_reason || 'No rejection reason provided by admin.'}
              </Text>
            </View>
          )}

          {needsEdits && (
            <View style={styles.needsEditsBox}>
              <Text style={styles.needsEditsTitle}>Admin's Edit Request</Text>
              <Text style={styles.needsEditsText}>
                {adminNeedsEditsNote || 'No edit request details provided by admin.'}
              </Text>
            </View>
          )}

          {isRejected && (
            <View style={styles.appealBox}>
              <Text style={styles.appealTitle}>Appeal Reason for Admin Review</Text>
              <TextInput
                value={appealReason}
                onChangeText={setAppealReason}
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!submitting}
                style={styles.appealInput}
                placeholder="Explain why this listing should be reviewed again..."
                placeholderTextColor="#6B7280"
                textAlignVertical="top"
              />
              <Text style={styles.appealHelperText}>{appealReason.trim().length}/500 characters</Text>
            </View>
          )}

          {isFlagged && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Your listing is currently under admin review. You can edit details if needed while waiting.
              </Text>
            </View>
          )}

          {needsEdits && (
            <View style={styles.infoBoxNeedsEdits}>
              <Text style={styles.infoTextNeedsEdits}>
                Please address the admin's edit request above and update your listing. Once you make the edits, your listing will be re-reviewed.
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Appeals submitted</Text>
            <Text style={styles.metaValue}>{appealsSubmitted}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last flagged at</Text>
            <Text style={styles.metaValue}>
              {lastFlaggedAt ? new Date(lastFlaggedAt).toLocaleString() : 'N/A'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last rejected at</Text>
            <Text style={styles.metaValue}>
              {lastRejectedAt ? new Date(lastRejectedAt).toLocaleString() : 'N/A'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.secondaryButton, submitting && styles.disabledButton]}
          onPress={() => navigation.navigate('EditListing', { listing_id: listing.id })}
          disabled={submitting}
        >
          <Text style={styles.secondaryButtonText}>
            {needsEdits ? 'Make Edits Now' : 'Edit Listing'}
          </Text>
        </TouchableOpacity>

        {needsEdits && (
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={handleNeedsEditsResubmit}
            disabled={submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Submitting...' : 'Submit for Re-Review'}
            </Text>
          </TouchableOpacity>
        )}

        {isRejected && (
          <TouchableOpacity
            style={[styles.primaryButton, (submitting || !appealReason.trim()) && styles.disabledButton]}
            onPress={handleAppeal}
            disabled={submitting || !appealReason.trim()}
          >
            <Text style={styles.primaryButtonText}>{submitting ? 'Submitting...' : 'Appeal Decision'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.ghostButton, submitting && styles.disabledButton]}
          onPress={() => navigation.navigate('MyListings')}
          disabled={submitting}
        >
          <Text style={styles.ghostButtonText}>Back to My Listings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  helperText: {
    marginTop: 12,
    color: '#4B5563',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  itemPrice: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '600',
    color: '#2563EB',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusFlagged: {
    backgroundColor: '#FEF3C7',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusNeedsEdits: {
    backgroundColor: '#FED7AA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextFlagged: {
    color: '#92400E',
  },
  statusTextRejected: {
    color: '#991B1B',
  },
  statusTextNeedsEdits: {
    color: '#9A3412',
  },
  reasonBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  reasonText: {
    color: '#7F1D1D',
    lineHeight: 20,
  },
  needsEditsBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE047',
    padding: 10,
  },
  needsEditsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 4,
  },
  needsEditsText: {
    color: '#92400E',
    lineHeight: 20,
  },
  appealBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
  },
  appealTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  appealInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  appealHelperText: {
    marginTop: 6,
    color: '#475569',
    fontSize: 12,
    textAlign: 'right',
  },
  infoBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 10,
  },
  infoText: {
    color: '#1E40AF',
    lineHeight: 20,
  },
  infoBoxNeedsEdits: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FBBF24',
    padding: 10,
  },
  infoTextNeedsEdits: {
    color: '#92400E',
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  metaLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  metaValue: {
    color: '#111827',
    fontSize: 13,
    maxWidth: '55%',
    textAlign: 'right',
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  ghostButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  ghostButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  errorText: {
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
});
