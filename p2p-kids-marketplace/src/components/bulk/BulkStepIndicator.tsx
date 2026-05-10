/**
 * File: p2p-kids-marketplace/src/components/bulk/BulkStepIndicator.tsx
 * MODULE-04 V3.1 UX overhaul (Decision 3) — 4-step progress indicator
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type BulkStep = 'photos' | 'group' | 'review' | 'publish';

interface BulkStepIndicatorProps {
  currentStep: BulkStep;
  reachedSteps: Set<BulkStep>;
  onStepPress?: (step: BulkStep) => void;
}

const STEPS: { id: BulkStep; label: string }[] = [
  { id: 'photos', label: 'Photos' },
  { id: 'group', label: 'Group' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Publish' },
];

export function BulkStepIndicator({
  currentStep,
  reachedSteps,
  onStepPress,
}: BulkStepIndicatorProps) {
  return (
    <View style={styles.row} testID="bulk-step-indicator" accessibilityRole="tablist">
      {STEPS.map((step, index) => {
        const isCurrent = step.id === currentStep;
        const isReached = reachedSteps.has(step.id);
        const isTappable = Boolean(onStepPress) && isReached && !isCurrent;
        return (
          <React.Fragment key={step.id}>
            <TouchableOpacity
              style={styles.stepWrap}
              disabled={!isTappable}
              onPress={() => isTappable && onStepPress?.(step.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isCurrent, disabled: !isTappable }}
              accessibilityLabel={`Step ${index + 1}: ${step.label}${isCurrent ? ', current' : ''}`}
              testID={`bulk-step-${step.id}`}
            >
              <View
                style={[styles.dot, isReached && styles.dotReached, isCurrent && styles.dotCurrent]}
              >
                <Text style={[styles.dotText, isCurrent && styles.dotTextCurrent]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.label, isCurrent && styles.labelCurrent]}>{step.label}</Text>
            </TouchableOpacity>
            {index < STEPS.length - 1 && (
              <View
                style={[styles.line, reachedSteps.has(STEPS[index + 1].id) && styles.lineReached]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepWrap: {
    alignItems: 'center',
    width: 60,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dotReached: {
    borderColor: '#5DBB8E',
    backgroundColor: '#E8F5F0',
  },
  dotCurrent: {
    borderColor: '#5DBB8E',
    backgroundColor: '#5DBB8E',
  },
  dotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  dotTextCurrent: {
    color: '#fff',
  },
  label: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  labelCurrent: {
    color: '#1F2937',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    marginBottom: 18,
  },
  lineReached: {
    backgroundColor: '#5DBB8E',
  },
});
