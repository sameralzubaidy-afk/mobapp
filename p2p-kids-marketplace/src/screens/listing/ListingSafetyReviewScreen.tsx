import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
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
  deleteListing,
  submitListingAppeal,
  submitListingNeedsEditsReReview,
} from '@/services/listing';
import { Listing } from '@/types/listing';
import { ShieldWarning } from 'phosphor-react-native';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

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
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [showRemoveSuccessModal, setShowRemoveSuccessModal] = useState(false);

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
      Alert.alert(
        'Appeal Reason Too Short',
        'Please provide at least 10 characters so admin can review context.'
      );
      return;
    }

    Alert.alert('Submit Appeal', 'This will send your listing back for admin review.', [
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
    ]);
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
              const updated = await submitListingNeedsEditsReReview(listing.id, session.user.id);
              setListing(updated);
              Alert.alert('Submitted', 'Your listing is back under review.', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('MyListings'),
                },
              ]);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to submit for re-review';
              Alert.alert('Error', message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveListing = async () => {
    if (!listing || !session?.user?.id) {
      Alert.alert('Error', 'Unable to remove listing right now.');
      return;
    }

    setShowRemoveConfirmModal(true);
  };

  const handleConfirmRemoveListing = async () => {
    if (!listing || !session?.user?.id) {
      Alert.alert('Error', 'Unable to remove listing right now.');
      return;
    }

    try {
      setSubmitting(true);
      setShowRemoveConfirmModal(false);
      await deleteListing(listing.id, session.user.id);
      setShowRemoveSuccessModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove listing';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSuccessClose = () => {
    setShowRemoveSuccessModal(false);
    navigation.navigate('MyListings');
  };

  if (loading) {
    return (
      <ScreenLayout variant="detail" title="Safety Review">
        <LoadingSpinner />
        <Text style={styles.helperText}>Loading safety review...</Text>
      </ScreenLayout>
    );
  }

  if (error || !listing) {
    return (
      <ScreenLayout variant="detail" title="Safety Review">
        <Text style={styles.errorTitle}>Unable to open safety review</Text>
        <Text style={styles.errorText}>{error || 'Listing not found'}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </TouchableOpacity>
      </ScreenLayout>
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
    listing.rejected_at ?? (needsEdits ? (listing.flagged_at ?? listing.updated_at) : null);
  const adminNeedsEditsNote =
    listing.moderation_note?.trim() || listing.rejection_reason?.trim() || null;
  const alertMessage = isRejected
    ? 'This listing was rejected by our safety team.'
    : isFlagged
      ? 'This listing is currently under safety review.'
      : needsEdits
        ? 'This listing needs edits before it can be approved.'
        : null;

  return (
    <ScreenLayout variant="detail" title="Safety Review">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Listing Safety Review</Text>

        {alertMessage && (
          <View style={styles.alertBanner}>
            <ShieldWarning size={20} color="#E85D75" weight="regular" />
            <Text style={styles.alertText}>{alertMessage}</Text>
          </View>
        )}

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

          <View
            style={[
              styles.statusBadge,
              isRejected
                ? styles.statusRejected
                : needsEdits
                  ? styles.statusNeedsEdits
                  : styles.statusFlagged,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isRejected
                  ? styles.statusTextRejected
                  : needsEdits
                    ? styles.statusTextNeedsEdits
                    : styles.statusTextFlagged,
              ]}
            >
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
              <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
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
              <Text style={styles.appealHelperText}>
                {appealReason.trim().length}/500 characters
              </Text>
            </View>
          )}

          {isFlagged && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Your listing is currently under admin review. You can edit details if needed while
                waiting.
              </Text>
            </View>
          )}

          {needsEdits && (
            <View style={styles.infoBoxNeedsEdits}>
              <Text style={styles.infoTextNeedsEdits}>
                Please address the admin's edit request above and update your listing. Once you make
                the edits, your listing will be re-reviewed.
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
          style={[styles.primaryButton, submitting && styles.disabledButton]}
          onPress={() => navigation.navigate('EditListing', { listing_id: listing.id })}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
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
          <>
            <TouchableOpacity
              style={[styles.dangerButton, submitting && styles.disabledButton]}
              onPress={handleRemoveListing}
              disabled={submitting}
            >
              <Text style={styles.dangerButtonText}>Remove Listing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                (submitting || !appealReason.trim()) && styles.disabledButton,
              ]}
              onPress={handleAppeal}
              disabled={submitting || !appealReason.trim()}
            >
              <Text style={styles.secondaryButtonText}>
                {submitting ? 'Submitting...' : 'Appeal This Decision'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.ghostButton, submitting && styles.disabledButton]}
          onPress={() => navigation.navigate('MyListings')}
          disabled={submitting}
        >
          <Text style={styles.ghostButtonText}>Back to My Listings</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showRemoveConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemoveConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Remove Listing</Text>
            <Text style={styles.modalMessage}>Are you sure you want to remove this listing?</Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setShowRemoveConfirmModal(false)}
                disabled={submitting}
                testID="safety-remove-cancel"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Safety remove cancel"
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDangerButton, submitting && styles.disabledButton]}
                onPress={handleConfirmRemoveListing}
                disabled={submitting}
                testID="safety-remove-confirm"
                accessible
                accessibilityRole="button"
                accessibilityLabel="Safety remove confirm"
              >
                <Text style={styles.modalDangerButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRemoveSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleRemoveSuccessClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Removed</Text>
            <Text style={styles.modalMessage}>Listing removed successfully.</Text>

            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={handleRemoveSuccessClose}
              testID="safety-remove-success-ok"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Safety remove success ok"
            >
              <Text style={styles.modalPrimaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
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
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  alertBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#E85D75',
  },
  helperText: {
    marginTop: 12,
    color: '#6B6B6B',
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
    borderRadius: 8,
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
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
    color: '#1A1A1A',
  },
  itemPrice: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
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
    fontWeight: '500',
  },
  statusTextFlagged: {
    color: '#D97706',
  },
  statusTextRejected: {
    color: '#E85D75',
  },
  statusTextNeedsEdits: {
    color: '#D97706',
  },
  reasonBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 10,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E85D75',
    marginBottom: 4,
  },
  reasonText: {
    color: '#E85D75',
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
    fontWeight: '500',
    color: '#CA8A04',
    marginBottom: 4,
  },
  needsEditsText: {
    color: '#CA8A04',
    lineHeight: 20,
  },
  appealBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    borderWidth: 0,
    padding: 10,
  },
  appealTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
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
    color: '#6B6B6B',
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
    color: '#5DBB8E',
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
    color: '#D97706',
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
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButton: {
    marginTop: 6,
    backgroundColor: '#E85D75',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#6B6B6B',
    borderRadius: 24,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#6B6B6B',
    fontWeight: '500',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalMessage: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 18,
    lineHeight: 24,
    color: '#4B5563',
    textAlign: 'center',
  },
  modalActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#6B6B6B',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    color: '#6B6B6B',
    fontSize: 18,
    fontWeight: '500',
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#E85D75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  successIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successIconText: {
    fontSize: 28,
    color: '#14805E',
    fontWeight: '700',
  },
  modalPrimaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
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
