// FILE: p2p-kids-marketplace/src/screens/help/HelpScreen.tsx
// MODULE-18 EDU-005: Help screen with accordion sections, calculator, and bonus categories

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPublishedSections } from '../../services/educationContentService';
import { trackEducationEvent } from '../../services/educationAnalyticsService';
import type { EducationSection } from '../../types/education';
import { EducationSectionAccordion } from '../../components/education/EducationSectionAccordion';
import { SPCalculator } from '../../components/education/SPCalculator';
import { BonusCategoriesList } from '../../components/education/BonusCategoriesList';

interface HelpScreenProps {
  navigation: any;
  route: any;
}

export default function HelpScreen({ navigation, route }: HelpScreenProps) {
  const [sections, setSections] = useState<EducationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('sp_definition');
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: View | null }>({});
  const hasTrackedView = useRef(false);

  // Handle deep link section parameter
  const deepLinkSection = route.params?.section;

  useEffect(() => {
    loadSections();
  }, []);

  useEffect(() => {
    // Track help_view on mount (once per mount)
    if (!hasTrackedView.current) {
      trackEducationEvent('help_view', {});
      hasTrackedView.current = true;
    }
  }, []);

  useEffect(() => {
    // Handle deep link - expand specific section and scroll to it
    if (deepLinkSection && sections.length > 0) {
      setExpandedSection(deepLinkSection);

      // Scroll to section after layout
      setTimeout(() => {
        const sectionRef = sectionRefs.current[deepLinkSection];
        if (sectionRef && scrollViewRef.current) {
          sectionRef.measureLayout(
            // @ts-expect-error - ScrollView native ref supports measureLayout target at runtime
            scrollViewRef.current,
            (x, y) => {
              scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
            },
            () => {
              console.warn('[HelpScreen] Failed to measure section layout');
            }
          );
        }
      }, 300);
    }
  }, [deepLinkSection, sections]);

  const loadSections = async () => {
    try {
      setLoading(true);
      const data = await getPublishedSections();
      setSections(data);
    } catch (error) {
      console.error('[HelpScreen] Load sections error:', error);
      Alert.alert('Error', 'Failed to load help content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadSections();
    } catch (error) {
      console.error('[HelpScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSectionExpand = (sectionType: string) => {
    setExpandedSection(sectionType);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']} testID="help-screen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="help-back-button"
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>How Trading Works</Text>
          <View style={styles.backButton} />
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              testID="help-refresh-control"
            />
          }
          testID="help-scroll-view"
        >
          {/* Intro Text */}
          <Text style={styles.introText}>
            Learn how to trade safely and earn Swap Points in the Kids P2P Marketplace!
          </Text>

          {/* Sections Accordion */}
          {sections.map((section) => (
            <View
              key={section.id}
              ref={(ref) => {
                sectionRefs.current[section.section_type] = ref;
              }}
              collapsable={false}
            >
              <EducationSectionAccordion
                section={section}
                defaultExpanded={section.section_type === expandedSection}
                onExpand={handleSectionExpand}
                testID={`help-section-${section.section_type}`}
              />
            </View>
          ))}

          {loading && sections.length === 0 && (
            <Text style={styles.loadingText}>Loading help content...</Text>
          )}

          {/* SP Calculator */}
          <View style={styles.calculatorSection}>
            <Text style={styles.sectionTitle}>Try the SP Calculator</Text>
            <SPCalculator
              mode="sell"
              testID="help-sp-calculator"
            />
          </View>

          {/* Bonus Categories List */}
          <BonusCategoriesList testID="help-bonus-categories" />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Still have questions? Contact us at support@p2pkidsmarketplace.com
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    padding: 16,
  },
  introText: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 24,
  },
  calculatorSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  footer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  footerText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
  },
});
