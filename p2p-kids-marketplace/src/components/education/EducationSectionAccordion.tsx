// FILE: p2p-kids-marketplace/src/components/education/EducationSectionAccordion.tsx
// MODULE-18 EDU-005: Accordion component for education sections

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EducationSection } from '../../types/education';
import { trackEducationEvent } from '../../services/educationAnalyticsService';

// NOTE: setLayoutAnimationEnabledExperimental is a no-op in the New
// Architecture (Bridgeless/Fabric) and generates a LogBox warning that triggers
// heavy stack symbolication → Android ANR. LayoutAnimation works natively in
// New Architecture without this call.

interface EducationSectionAccordionProps {
  section: EducationSection;
  defaultExpanded?: boolean;
  onExpand?: (sectionType: string) => void;
  testID?: string;
}

export function EducationSectionAccordion({
  section,
  defaultExpanded = false,
  onExpand,
  testID,
}: EducationSectionAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  useEffect(() => {
    // Update animation when defaultExpanded changes (deep link case)
    if (defaultExpanded && !expanded) {
      setExpanded(true);
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [defaultExpanded]);

  const toggleExpanded = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const newExpanded = !expanded;
    setExpanded(newExpanded);

    // Animate chevron rotation
    Animated.timing(rotateAnim, {
      toValue: newExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Track analytics on expand
    if (newExpanded) {
      await trackEducationEvent('section_expand', {
        section_type: section.section_type,
      });
      onExpand?.(section.section_type);
    }
  };

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.container} testID={testID || `section-accordion-${section.section_type}`}>
      <TouchableOpacity
        accessible
        style={styles.header}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${section.title}. ${expanded ? 'Expanded' : 'Collapsed'}. Tap to ${expanded ? 'collapse' : 'expand'}.`}
        testID={`${testID || section.section_type}-header`}
      >
        <Text style={styles.title}>{section.title}</Text>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={20} color="#6B7280" />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <View
          style={styles.content}
          testID={`${testID || section.section_type}-content`}
          accessible={true}
          accessibilityLabel={section.body}
        >
          {section.image_url && (
            <View
              style={styles.imagePlaceholder}
              testID={`${testID || section.section_type}-image`}
            >
              <Text style={styles.imagePlaceholderText}>📚 Image</Text>
            </View>
          )}
          <Text style={styles.body}>{section.body}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 12,
  },
  content: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#F9FAFB',
  },
  imagePlaceholder: {
    height: 120,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
});
