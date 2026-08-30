import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { Warning } from 'phosphor-react-native';
import { KEYBOARD_DONE_ACCESSORY_ID } from '@/components/shared/KeyboardDoneAccessory';

const REASONS = [
  { id: 'no_show',          label: 'Seller was a no-show',         description: 'The seller did not show up to the agreed meetup.' },
  { id: 'not_as_described', label: 'Item not as described',        description: 'The item looks different from the listing photos or description.' },
  { id: 'no_meetup',        label: 'Seller not responding',        description: 'The seller stopped responding and won\'t arrange a meetup.' },
  { id: 'no_agreement',     label: 'Couldn\'t agree on meetup',    description: 'The buyer and seller could not agree on a meetup time or place.' },
  { id: 'other',            label: 'Other issue',                  description: '' },
] as const;

type ReasonId = typeof REASONS[number]['id'];

interface Props {
  visible:   boolean;
  onClose:   () => void;
  onSubmit:  (reason: ReasonId, details: string) => Promise<void>;
}

export function IssueReportModal({ visible, onClose, onSubmit }: Props) {
  const [selected, setSelected]     = React.useState<ReasonId | null>(null);
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting]  = React.useState('');
  const [error, setError]            = React.useState('');

  // DEV-TASK-67 item 1: imperative screen-reader announcement when the modal
  // becomes visible. The passive `accessible` + `accessibilityRole="alert"` +
  // `accessibilityLabel` on the sheet wrapper is flattened by iOS — QA Task 10
  // FV2a showed the container never surfaces as a distinct AX element even with
  // those props present. Announce explicitly on visibility change (mirrors
  // SuccessToast's DT-63 announce pattern), IN ADDITION to the passive attrs.
  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility('Report an Issue dialog');
    }
  }, [visible]);

  const requiresDescription = selected === 'other';
  const canSubmit =
    !!selected &&
    (!requiresDescription || description.trim().length >= 20) &&
    !submitting;

  const handleSubmit = async () => {
    if (!selected) return;
    setError('');
    setSubmitting('Submitting…');
    try {
      await onSubmit(selected, description.trim());
      // Reset state after successful submit
      setSelected(null);
      setDescription('');
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting('');
    }
  };

  const handleClose = () => {
    setSelected(null);
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <View
          style={styles.sheet}
          testID="issue-report-modal"
          accessible
          accessibilityRole="alert"
          accessibilityLabel="Report an Issue dialog"
        >
          {/* Handle pill */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <Warning size={20} color="#D97706" weight="fill" />
            <Text style={styles.title} accessibilityRole="header">Report an Issue</Text>
          </View>

          <Text style={styles.subtitle}>
            What went wrong with this trade?
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {REASONS.map(reason => (
              <TouchableOpacity
                key={reason.id}
                style={[styles.option, selected === reason.id && styles.optionSelected]}
                // DEV-TASK-53 (E08): toggle-to-deselect — re-tapping the selected reason clears it
                // (and re-disables Submit), matching the guide's assertion (single-select w/ deselect).
                onPress={() => setSelected(prev => (prev === reason.id ? null : reason.id))}
                activeOpacity={0.7}
                testID={`issue-reason-${reason.id}`}
                accessible
                accessibilityRole="button"
                accessibilityLabel={reason.label}
              >
                <View style={[styles.radio, selected === reason.id && styles.radioSelected]}>
                  {selected === reason.id && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.optionLabel}>{reason.label}</Text>
              </TouchableOpacity>
            ))}

            {requiresDescription && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>Please describe the issue (min. 20 characters)</Text>
                <TextInput inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                  style={styles.textArea}
                  placeholder="Tell us what happened…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                  testID="issue-other-description-input"
                />
              </View>
            )}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
              testID="issue-submit-button"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Submit Report"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} testID="issue-cancel-button" accessible accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:   '#fff',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingHorizontal:    20,
    paddingBottom:        32,
    paddingTop:           12,
    maxHeight:            '85%',
  },
  handle: {
    width:           40,
    height:          4,
    backgroundColor: '#E5E7EB',
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    16,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    marginBottom:   8,
  },
  title: {
    fontSize:   18,
    fontFamily: 'Inter-SemiBold',
    color:      '#111827',
  },
  subtitle: {
    fontSize:     14,
    fontFamily:   'Inter-Regular',
    color:        '#6B7280',
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 320,
  },
  option: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:  14,
    paddingHorizontal: 16,
    borderRadius:     12,
    borderWidth:      1.5,
    borderColor:      '#E5E7EB',
    backgroundColor:  '#F9FAFB',
    marginBottom:     8,
    gap:              12,
  },
  optionSelected: {
    borderColor:     '#5DBB8E',
    backgroundColor: '#F0FDF4',
  },
  radio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     2,
    borderColor:     '#D1D5DB',
    alignItems:      'center',
    justifyContent:  'center',
  },
  radioSelected: {
    borderColor: '#5DBB8E',
  },
  radioDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: '#5DBB8E',
  },
  optionLabel: {
    fontSize:   15,
    fontFamily: 'Inter-Medium',
    color:      '#111827',
    flex:       1,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize:     13,
    fontFamily:   'Inter-Regular',
    color:        '#6B7280',
    marginBottom: 6,
  },
  textAreaWrapper: {
    borderWidth:      1.5,
    borderColor:      '#E5E7EB',
    borderRadius:     8,
    padding:          12,
    minHeight:        96,
  },
  textArea: {
    borderWidth:      1.5,
    borderColor:      '#E5E7EB',
    borderRadius:     8,
    padding:          12,
    minHeight:        96,
    fontSize:   14,
    fontFamily: 'Inter-Regular',
    color:      '#111827',
  },
  error: {
    fontSize:     13,
    fontFamily:   'Inter-Regular',
    color:        '#EF4444',
    marginTop:    8,
    marginBottom: 4,
  },
  actions: {
    marginTop: 16,
    gap:       8,
  },
  submitBtn: {
    backgroundColor: '#5DBB8E',
    borderRadius:    12,
    paddingVertical: 16,
    alignItems:      'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#A7D7BE',
  },
  submitText: {
    fontSize:   16,
    fontFamily: 'Inter-SemiBold',
    color:      '#fff',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems:      'center',
  },
  cancelText: {
    fontSize:   15,
    fontFamily: 'Inter-Regular',
    color:      '#6B7280',
  },
});
