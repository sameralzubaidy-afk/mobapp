import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, ScrollView, Image } from 'react-native';
import { Condition } from '../../types/listing';
import { ConditionSelector } from '../listing/ConditionSelector';
import { ColorPicker } from '../listing/ColorPicker';
import { AgeGroupSelector } from '../listing/AgeGroupSelector';
import { GenderSelector } from '../listing/GenderSelector';
import { SPEarningsPreview } from '../listing/SPEarningsPreview';

/**
 * AI processing state for a single bulk item — drives the row status chip.
 * V3.1 UX overhaul (Decision 11): per-card retry on AI failure.
 */
export type BulkItemAIState = 'idle' | 'analyzing' | 'success' | 'failed';

export interface BulkEditableItem {
  groupId: string;
  title: string;
  description: string;
  price: string;
  category_name?: string;
  category_id?: string;
  requested_category_name?: string;
  condition: Condition | null;
  brand: string;
  color: string[];
  age_group?: '0-2' | '3-5' | '6-8' | '9-12' | '13+' | null;
  gender?: 'boy' | 'girl' | 'unisex' | null;
  accepts_swap_points?: boolean;
  includeInPublish: boolean;
  missingRequired: string[];
  // V3.1 UX overhaul
  aiState?: BulkItemAIState;
  aiFilledFields?: string[]; // fields populated by AI on the last successful run
  aiError?: string | null;
  coverPhotoUri?: string | null;
}

interface BulkItemCardProps {
  item: BulkEditableItem;
  index: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleInclude: (next: boolean) => void;
  onChange: (patch: Partial<BulkEditableItem>) => void;
  onOpenCategoryPicker: () => void;
  canAcceptSP?: boolean;
  checkingSubscription?: boolean;
  onUpgradePress?: () => void;
  /** V3.1 UX overhaul (Decision 11): retry AI for this item only */
  onRetryAI?: () => void;
}

function StatusChip({ item }: { item: BulkEditableItem }) {
  if (!item.includeInPublish) {
    return (
      <View style={[styles.chip, styles.chipExcluded]} testID="status-chip-excluded">
        <Text style={styles.chipText}>Excluded</Text>
      </View>
    );
  }
  if (item.aiState === 'analyzing') {
    return (
      <View style={[styles.chip, styles.chipAnalyzing]} testID="status-chip-analyzing">
        <Text style={styles.chipText}>Analyzing…</Text>
      </View>
    );
  }
  if (item.aiState === 'failed') {
    return (
      <View style={[styles.chip, styles.chipFailed]} testID="status-chip-ai-failed">
        <Text style={[styles.chipText, styles.chipTextDanger]}>AI failed</Text>
      </View>
    );
  }
  if (item.missingRequired.length > 0) {
    return (
      <View style={[styles.chip, styles.chipMissing]} testID="status-chip-missing">
        <Text style={[styles.chipText, styles.chipTextWarning]}>
          Missing: {item.missingRequired.join(', ')}
        </Text>
      </View>
    );
  }
  if (item.aiState === 'success' && (item.aiFilledFields?.length ?? 0) > 0) {
    return (
      <View style={[styles.chip, styles.chipSuccess]} testID="status-chip-ai-success">
        <Text style={[styles.chipText, styles.chipTextSuccess]}>
          ✨ AI filled {item.aiFilledFields?.length}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.chip, styles.chipReady]} testID="status-chip-ready">
      <Text style={[styles.chipText, styles.chipTextReady]}>Ready</Text>
    </View>
  );
}

export function BulkItemCard({
  item,
  index,
  expanded,
  onToggleExpanded,
  onToggleInclude,
  onChange,
  onOpenCategoryPicker,
  canAcceptSP = false,
  checkingSubscription = false,
  onUpgradePress,
  onRetryAI,
}: BulkItemCardProps) {
  const cover = item.coverPhotoUri || null;
  const isOtherCategory =
    item.category_id === 'other' || item.category_name?.trim().toLowerCase() === 'other';

  return (
    <View
      style={[
        styles.card,
        item.missingRequired.length > 0 && styles.warningCard,
        !item.includeInPublish && styles.excludedCard,
      ]}
      testID={`bulk-item-card-${index}`}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={onToggleExpanded}
        accessibilityLabel={`Open item ${index + 1} details`}
        accessibilityHint="Expands or collapses this item editor"
        testID={`bulk-item-card-toggle-${index}`}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} testID={`bulk-item-cover-${index}`} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>No cover</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title?.trim() ? item.title : `Item ${index + 1}`}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.price?.trim() ? `$${item.price}` : 'No price set'}
            {item.condition ? ` • ${item.condition.replace('_', ' ')}` : ''}
          </Text>
          <View style={styles.chipRow}>
            <StatusChip item={item} />
            {item.aiState === 'failed' && onRetryAI && (
              <TouchableOpacity
                onPress={onRetryAI}
                style={styles.retryBtn}
                accessibilityLabel="Retry AI auto-fill for this item"
                testID={`bulk-item-retry-ai-${index}`}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <View style={styles.includeRow}>
        <Text style={styles.includeLabel}>Exclude from publish</Text>
        <Switch
          value={!item.includeInPublish}
          onValueChange={(value) => onToggleInclude(!value)}
          testID={`bulk-item-exclude-toggle-${index}`}
        />
      </View>

      {expanded && (
        <ScrollView style={styles.form} nestedScrollEnabled>
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            value={item.title}
            onChangeText={(title) => onChange({ title })}
            placeholder="Title *"
            style={styles.input}
            testID={`bulk-item-title-${index}`}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            value={item.description}
            onChangeText={(description) => onChange({ description })}
            placeholder="Description"
            multiline
            style={[styles.input, styles.textArea]}
            testID={`bulk-item-description-${index}`}
          />

          <Text style={styles.fieldLabel}>Category *</Text>
          <TouchableOpacity
            style={styles.select}
            onPress={onOpenCategoryPicker}
            testID={`bulk-item-category-${index}`}
          >
            <Text style={styles.selectText}>
              {item.category_name || item.requested_category_name || 'Select category *'}
            </Text>
          </TouchableOpacity>

          {isOtherCategory && (
            <>
              <Text style={styles.fieldLabel}>Custom Category Name *</Text>
              <TextInput
                value={item.requested_category_name || ''}
                onChangeText={(requested_category_name) => onChange({ requested_category_name })}
                placeholder="e.g., Board Games"
                style={styles.input}
                testID={`bulk-item-custom-category-name-${index}`}
              />
              <Text style={styles.helperText}>
                This custom category will be sent to admin for review.
              </Text>
            </>
          )}

          <ConditionSelector
            value={item.condition}
            onChange={(condition) => onChange({ condition })}
            onOpenGuide={() => undefined}
          />

          <Text style={styles.fieldLabel}>Price *</Text>
          <TextInput
            value={item.price}
            onChangeText={(price) => onChange({ price })}
            keyboardType="numeric"
            placeholder="Price *"
            style={styles.input}
            testID={`bulk-item-price-${index}`}
          />

          {/* SP Earnings Preview (LISTING-V3-011) */}
          <SPEarningsPreview
            categoryId={item.category_id || null}
            price={parseFloat(item.price) || 0}
            isSubscriber={canAcceptSP || false}
            onUpgradePress={onUpgradePress}
            testID={`bulk-item-sp-preview-${index}`}
          />

          <Text style={styles.fieldLabel}>Brand</Text>
          <TextInput
            value={item.brand}
            onChangeText={(brand) => onChange({ brand })}
            placeholder="Brand"
            style={styles.input}
            testID={`bulk-item-brand-${index}`}
          />

          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment Preference</Text>
            {checkingSubscription ? (
              <Text style={styles.paymentHint}>Checking subscription...</Text>
            ) : canAcceptSP ? (
              <>
                <View style={styles.paymentToggleRow}>
                  <View style={styles.paymentToggleTextWrap}>
                    <Text style={styles.paymentToggleLabel}>Accept Swap Points?</Text>
                    <Text style={styles.paymentHint}>Buyers can pay up to 50% with SP</Text>
                  </View>
                  <Switch
                    value={Boolean(item.accepts_swap_points)}
                    onValueChange={(accepts_swap_points) => onChange({ accepts_swap_points })}
                    trackColor={{ false: '#ccc', true: '#34C759' }}
                    thumbColor="#fff"
                    testID={`bulk-item-sp-toggle-${index}`}
                  />
                </View>
                {item.accepts_swap_points && (
                  <View style={styles.spEligibleBadge}>
                    <Text style={styles.spEligibleText}>SP Eligible</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.upgradePanel}>
                <Text style={styles.paymentHint}>
                  Subscribe to Kids Club+ to enable Accept SP.
                </Text>
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={onUpgradePress}
                  testID={`bulk-item-sp-upgrade-${index}`}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ColorPicker
            selectedColors={item.color}
            onChange={(color) => onChange({ color })}
            maxColors={3}
          />
          <AgeGroupSelector
            value={item.age_group || null}
            onChange={(age_group) => onChange({ age_group })}
          />
          <GenderSelector
            value={item.gender || null}
            onChange={(gender) => onChange({ gender: gender || null })}
          />

          {item.missingRequired.length > 0 && (
            <Text style={styles.warningText}>Missing: {item.missingRequired.join(', ')}</Text>
          )}
          {item.aiError && (
            <Text style={styles.warningText} testID={`bulk-item-ai-error-${index}`}>
              AI error: {item.aiError}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 10,
  },
  warningCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  excludedCard: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coverPlaceholderText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  chipRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandIcon: {
    fontSize: 14,
    color: '#4B5563',
  },
  includeRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  includeLabel: {
    fontSize: 13,
    color: '#374151',
  },
  form: {
    maxHeight: 480,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  select: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectText: {
    color: '#111827',
    fontSize: 13,
  },
  paymentSection: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 10,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  paymentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentToggleTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  paymentToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  paymentHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  spEligibleBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  spEligibleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  upgradePanel: {
    gap: 8,
  },
  upgradeButton: {
    backgroundColor: '#FF9800',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  warningText: {
    marginTop: 4,
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
  },
  helperText: {
    marginTop: -2,
    marginBottom: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  chipAnalyzing: {
    backgroundColor: '#DBEAFE',
  },
  chipFailed: {
    backgroundColor: '#FEE2E2',
  },
  chipMissing: {
    backgroundColor: '#FEF3C7',
  },
  chipSuccess: {
    backgroundColor: '#DCFCE7',
  },
  chipExcluded: {
    backgroundColor: '#E5E7EB',
  },
  chipReady: {
    backgroundColor: '#ECFDF5',
  },
  chipTextDanger: {
    color: '#991B1B',
  },
  chipTextWarning: {
    color: '#92400E',
  },
  chipTextSuccess: {
    color: '#065F46',
  },
  chipTextReady: {
    color: '#047857',
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#111827',
    borderRadius: 999,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
