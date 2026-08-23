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
import { NotePencil } from 'phosphor-react-native';
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
  testID = 'resume-draft-banner',
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
      <View style={styles.iconCircle}>
        <NotePencil size={20} color="#5DBB8E" weight="fill" />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title} testID={`${testID}-title`}>
          accessible accessibilityRole="button" You have {unfinishedItemCount} unfinished listing
          {unfinishedItemCount > 1 ? 's' : ''}
        </Text>
        <Text style={styles.subtitle} testID={`${testID}-subtitle`}>
          Continue where you left off
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            accessible
            accessibilityRole="button"
            style={styles.resumeButton}
            onPress={handleResume}
            accessibilityLabel={`Resume ${isBulk ? 'bulk listing' : 'listing'}`}
            accessibilityHint="Opens your draft to continue editing"
            testID={`${testID}-resume-button`}
          >
            <Text style={styles.resumeButtonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessible
            accessibilityRole="button"
            onPress={onDismiss}
            accessibilityLabel="Dismiss banner"
            accessibilityHint="Hides the banner until next app launch"
            testID={`${testID}-dismiss-button`}
          >
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#5DBB8E',
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDF8F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  resumeButton: {
    backgroundColor: '#5DBB8E',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  resumeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dismissText: {
    fontSize: 13,
    color: '#6B6B6B',
  },
});
