// FILE: p2p-kids-marketplace/src/screens/help/HelpScreen.tsx
// MODULE-18 EDU-005: Help screen with accordion sections, calculator, and bonus categories

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChartLine, CurrencyCircleDollar } from 'phosphor-react-native';
import { getPublishedSections } from '../../services/educationContentService';
import { captureException } from '@/services/errorReporter';
import { trackEducationEvent } from '../../services/educationAnalyticsService';
import type { EducationSection } from '../../types/education';
import { EducationSectionAccordion } from '../../components/education/EducationSectionAccordion';
import { SPCalculator } from '../../components/education/SPCalculator';
import { BonusCategoriesList } from '../../components/education/BonusCategoriesList';
import ScreenLayout from '@/components/ScreenLayout';

interface HelpScreenProps {
  navigation: any;
  route: any;
}

export default function HelpScreen({ navigation: _navigation, route }: HelpScreenProps) {
  const [sections, setSections] = useState<EducationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('sp_definition');
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: View | null }>({});
  const hasTrackedView = useRef(false);

  // Incremented on screen focus / pull-to-refresh so the SP calculator and
  // bonus category list re-fetch (admin rate changes) without a full remount.
  const [dataVersion, setDataVersion] = useState(0);
  const hasFocusedRef = useRef(false);

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

  // Re-fetch calculator/bonus category data on screen focus so an admin rate
  // change is reflected without a full remount. QA: Group Q+S 2026-08-23
  // Item 3. Skip the initial focus (mount) — children already load then.
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      setDataVersion((v) => v + 1);
    }, [])
  );

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
      captureException(error, {
        tags: { screen: 'HelpScreen', action: 'load_sections' },
      });
      Alert.alert('Error', 'Failed to load help content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // Also refresh the SP calculator + bonus list, not just the sections,
      // so admin rate changes picked up by pull-to-refresh.
      setDataVersion((v) => v + 1);
      await loadSections();
    } catch (error) {
      captureException(error, {
        tags: { screen: 'HelpScreen', action: 'refresh' },
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSectionExpand = (sectionType: string) => {
    setExpandedSection(sectionType);
  };

  return (
    <ScreenLayout variant="detail" title="Help">
      <View style={styles.container}>
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
          {/* Hero Card */}
          <View style={styles.hero}>
            <View style={styles.heroIconBadge}>
              <ChartLine size={28} color="#5DBB8E" weight="bold" />
            </View>
            <Text style={styles.heroText}>
              Learn how to trade safely and earn Swap Points in the Kids P2P Marketplace!
            </Text>
          </View>

          {/* Section label */}
          <Text style={styles.sectionLabel}>Learn the basics</Text>

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
            <View style={styles.calculatorHeader}>
              <View style={styles.sectionIconBadge}>
                <CurrencyCircleDollar size={20} color="#5DBB8E" weight="bold" />
              </View>
              <Text style={styles.sectionTitle}>Try the SP Calculator</Text>
            </View>
            <SPCalculator mode="free" testID="help-sp-calculator" refreshKey={dataVersion} />
          </View>

          {/* Bonus Categories List */}
          <View style={styles.bonusSection}>
            <BonusCategoriesList testID="help-bonus-categories" refreshKey={dataVersion} />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Still have questions? Contact us at support@p2pkidsmarketplace.com
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: '#F0FAF5',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 28,
    gap: 12,
  },
  heroIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D6F0E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    fontSize: 14,
    color: '#444444',
    textAlign: 'center',
    lineHeight: 21,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#AAAAAA',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginVertical: 24,
  },
  calculatorSection: {
    marginTop: 32,
    marginBottom: 8,
  },
  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D6F0E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  bonusSection: {
    marginTop: 8,
  },
  footer: {
    marginTop: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#BBBBBB',
    textAlign: 'center',
    lineHeight: 18,
  },
});
