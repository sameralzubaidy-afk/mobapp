/**
 * File: p2p-kids-marketplace/src/components/molecules/ResumeDraftBanner.tsx
 * MODULE-04 LISTING-V3: Resume Draft Banner
 * Task: LISTING-V3-007 - Draft Resume Banner + Navigation Wiring
 * 
 * Shows banner on HomeScreen when user has unfinished listings
 * - Displays count of active drafts
 * - Tapping navigates to ItemCreate or BulkListingCreate
 * - Dismiss is session-level (reappears next app open)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ItemDraft } from '../../types/listing';

interface DraftDataWithItems {
  items?: {
    includeInPublish?: boolean;
  }[];
}

function getUnfinishedItemCountForDraft(draft: ItemDraft): number {
  const draftData = draft.draft_data as DraftDataWithItems;
  const draftItems = Array.isArray(draftData?.items) ? draftData.items : [];

  if (draftItems.length > 0) {
    const includedItems = draftItems.filter((item) => item?.includeInPublish !== false);
    return includedItems.length;
  }

  if (draft.bulk_upload_id) {
    // Fallback for older bulk drafts without item-level payload: infer from photos.
    if (Array.isArray(draft.photo_urls) && draft.photo_urls.length > 0) {
      return draft.photo_urls.length;
    }
    return 1;
  }

  return 1;
}

export interface ResumeDraftBannerProps {
  drafts: ItemDraft[];
  onResume: (draftId: string, isBulk: boolean) => void;
  onDismiss: () => void;
  testID?: string;
}

/**
 * Banner component showing unfinished listing drafts
 * @param drafts - Array of active drafts
 * @param onResume - Callback when user taps to resume
 * @param onDismiss - Callback when user dismisses banner
 * @param testID - Test identifier for automation
 */
export function ResumeDraftBanner({ 
  drafts, 
  onResume, 
  onDismiss,
  testID = 'resume-draft-banner'
}: ResumeDraftBannerProps) {
  if (!drafts || drafts.length === 0) {
    return null;
  }

  // Use the most recent draft (first in array, assumed sorted by updated_at DESC)
  const mostRecentDraft = drafts[0];
  const isBulk = !!mostRecentDraft.bulk_upload_id;
  const unfinishedItemCount = drafts.reduce(
    (total, draft) => total + getUnfinishedItemCountForDraft(draft),
    0
  );

  const handleResume = () => {
    onResume(mostRecentDraft.id, isBulk);
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title} testID={`${testID}-title`}>
            📝 You have {unfinishedItemCount} unfinished listing{unfinishedItemCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.subtitle} testID={`${testID}-subtitle`}>
            Continue where you left off
          </Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.resumeButton}
            onPress={handleResume}
            accessibilityLabel={`Resume ${isBulk ? 'bulk listing' : 'listing'}`}
            accessibilityHint="Opens your draft to continue editing"
            testID={`${testID}-resume-button`}
          >
            <Text style={styles.resumeButtonText}>Continue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            accessibilityLabel="Dismiss banner"
            accessibilityHint="Hides the banner until next app launch"
            testID={`${testID}-dismiss-button`}
          >
            <Text style={styles.dismissButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
});
