/**
 * File: p2p-kids-marketplace/src/components/listing/AIAnalysisCard.tsx
 * MODULE-04 LISTING-V3-008: AI Analysis Card
 * Task: LISTING-V3-008 - Sliding card with AI suggestions
 *
 * Features:
 * - Apply All button (skips filled fields)
 * - Per-field Use buttons
 * - Confidence indicators
 * - Entrance animation
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { AIAnalysisResult } from '../../types/listing';

export interface AIAnalysisCardProps {
  analysis: AIAnalysisResult;
  isFieldFilled: (field: keyof AIAnalysisResult) => boolean;
  onApplyAll: () => void;
  onApplyField: (field: keyof AIAnalysisResult, value: any) => void;
  onDismiss: () => void;
  testID?: string;
}

export function AIAnalysisCard({
  analysis,
  isFieldFilled,
  onApplyAll,
  onApplyField,
  onDismiss,
  testID = 'ai-analysis-card',
}: AIAnalysisCardProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, []);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return '#4CAF50';
    if (confidence >= 0.4) return '#FF9800';
    return '#F44336';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.4) return 'Medium';
    return 'Low';
  };

  const renderField = (label: string, field: keyof AIAnalysisResult, value: any) => {
    const fieldData = analysis[field];
    if (!fieldData || typeof fieldData !== 'object' || !('value' in fieldData)) {
      return null;
    }

    const isFilled = isFieldFilled(field);
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
    const confidence = (fieldData as any).confidence || 0;

    return (
      <View key={field} style={styles.fieldRow}>
        <View style={styles.fieldInfo}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {displayValue}
          </Text>
          <View style={styles.confidenceBadge}>
            <View
              style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(confidence) }]}
            />
            <Text style={styles.confidenceText}>
              {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          accessible
          accessibilityRole="button"
          style={[styles.useButton, isFilled && styles.useButtonDisabled]}
          onPress={() => onApplyField(field, value)}
          accessibilityLabel={`Use AI suggestion for ${label}`}
          accessibilityHint={isFilled ? 'Field already filled' : 'Apply this suggestion'}
          testID={`use-${field}`}
        >
          <Text style={[styles.useButtonText, isFilled && styles.useButtonTextDisabled]}>
            {isFilled ? 'Filled' : 'Use'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      testID={testID}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🤖 AI Suggestions</Text>
          <Text style={styles.subtitle}>Apply to auto-fill fields</Text>
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          accessibilityLabel="Dismiss AI suggestions"
          accessibilityRole="button"
          testID="dismiss-ai-card"
          accessible
        >
          <Text style={styles.dismissButton}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.fieldsContainer} showsVerticalScrollIndicator={false}>
        {analysis.title && renderField('Title', 'title', analysis.title.value)}
        {analysis.category && renderField('Category', 'category', analysis.category.value.label)}
        {analysis.condition && renderField('Condition', 'condition', analysis.condition.value)}
        {analysis.brand && renderField('Brand', 'brand', analysis.brand.value)}
        {analysis.color && renderField('Colors', 'color', analysis.color.value)}
        {analysis.age_group && renderField('Age Group', 'age_group', analysis.age_group.value)}
        {analysis.gender && renderField('Gender', 'gender', analysis.gender.value)}
      </ScrollView>

      <TouchableOpacity
        style={styles.applyAllButton}
        onPress={onApplyAll}
        accessibilityLabel="Apply all AI suggestions to empty fields"
        accessibilityRole="button"
        testID="apply-all-button"
        accessible
      >
        <Text style={styles.applyAllButtonText}>Apply All (Empty Fields Only)</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  dismissButton: {
    fontSize: 32,
    color: '#999999',
    lineHeight: 32,
    width: 32,
    textAlign: 'center',
  },
  fieldsContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fieldInfo: {
    flex: 1,
    marginRight: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  confidenceText: {
    fontSize: 12,
    color: '#999999',
  },
  useButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    backgroundColor: '#5DBB8E',
    borderRadius: 22,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  useButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  useButtonTextDisabled: {
    color: '#6B7280',
  },
  applyAllButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 26,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
