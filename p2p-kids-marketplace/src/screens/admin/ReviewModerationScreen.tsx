// File: p2p-kids-marketplace/src/screens/admin/ReviewModerationScreen.tsx
// Admin review moderation panel for MODULE-08-REVIEWS-RATINGS (TASK REVIEW-006/007)

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getReportedReviews,
  approveReview,
  deleteReview,
  ReportedReview,
} from '@/services/admin/reviewModeration';
import { ReviewCard } from '@/components/ReviewCard';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner } from '@/components/ui';

export function ReviewModerationScreen() {
  const [reportedReviews, setReportedReviews] = useState<ReportedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadReportedReviews();
  }, []);

  const loadReportedReviews = async () => {
    setLoading(true);
    try {
      const result = await getReportedReviews();
      if (result.success) {
        setReportedReviews(result.reviews);
      } else {
        Alert.alert('Error', result.error || 'Failed to load reported reviews');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReportedReviews();
    setRefreshing(false);
  }, []);

  const handleApprove = async (reviewId: string) => {
    Alert.alert(
      'Approve Review',
      'This will unhide the review and delete all reports. The review will be visible again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            const result = await approveReview(reviewId);
            if (result.success) {
              Alert.alert('Success', 'Review approved and unhidden');
              loadReportedReviews();
            } else {
              Alert.alert('Error', result.error || 'Failed to approve review');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'This action cannot be undone. The review will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteReview(reviewId);
            if (result.success) {
              Alert.alert('Success', 'Review permanently deleted');
              loadReportedReviews();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const renderReportedReview = ({ item }: { item: ReportedReview }) => {
    const reasonLabels: Record<string, string> = {
      spam: 'Spam',
      offensive: 'Offensive Content',
      false_info: 'False Information',
      other: 'Other',
    };

    return (
      <View style={styles.reportedItem}>
        <ReviewCard review={item.review} showReportMenu={false} />

        <View style={styles.reportInfo}>
          <View style={styles.reportHeader}>
            <Ionicons name="flag" size={16} color="#EF4444" />
            <Text style={styles.reportCount}>
              {item.report_count} {item.report_count === 1 ? 'report' : 'reports'}
            </Text>
          </View>

          {item.reports.map((report, index) => (
            <View key={index} style={styles.reportDetail}>
              <Text style={styles.reportReason}>
                • {reasonLabels[report.reason] || report.reason}
              </Text>
              {report.description && (
                <Text style={styles.reportDescription}>{report.description}</Text>
              )}
              <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item.review.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.review.id)}
          >
            <Ionicons name="trash" size={20} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading reported reviews...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Review Moderation</Text>
        <Text style={styles.subtitle}>
          {reportedReviews.length} {reportedReviews.length === 1 ? 'review' : 'reviews'} flagged
        </Text>
      </View>

      <FlatList
        data={reportedReviews}
        keyExtractor={(item) => item.review.id}
        renderItem={renderReportedReview}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
            <Text style={styles.emptyText}>No reported reviews</Text>
            <Text style={styles.emptySubtext}>All reviews are in good standing</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
  },
  reportedItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FEE2E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reportInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 6,
  },
  reportDetail: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  reportReason: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  reportDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 12,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 12,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
