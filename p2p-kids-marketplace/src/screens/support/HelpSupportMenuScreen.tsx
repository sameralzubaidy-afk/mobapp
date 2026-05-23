// File: p2p-kids-marketplace/src/screens/support/HelpSupportMenuScreen.tsx
// MODULE-15.1 FLOW-19: Help & Support menu — two entry points

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Question,
  ChartLine,
  ChatCircle,
  CaretRight,
} from 'phosphor-react-native';

interface Props {
  navigation: any;
}

const MENU_ITEMS = [
  {
    id: 'faq',
    title: 'FAQ',
    subtitle: 'Browse frequently asked questions and contact support',
    icon: Question,
    route: 'Support',
    testID: 'help-menu-faq',
  },
  {
    id: 'earn-sp',
    title: 'How to Earn SP',
    subtitle: 'Learn about Swap Points, the SP calculator, and bonus categories',
    icon: ChartLine,
    route: 'Help',
    testID: 'help-menu-earn-sp',
  },
  {
    id: 'contact',
    title: 'Contact Us',
    subtitle: "Send us a message and we'll get back to you within 24 hours",
    icon: ChatCircle,
    route: 'ContactSupport',
    testID: 'help-menu-contact',
  },
];

export default function HelpSupportMenuScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="help-menu-back-button"
          >
            <ArrowLeft size={24} color="#1A1A1A" weight="bold" />
          </TouchableOpacity>
          <Text style={styles.title}>Help & Support</Text>
        </View>

        {/* Menu items */}
        <View style={styles.content}>
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuCard}
                onPress={() => navigation.navigate(item.route)}
                activeOpacity={0.75}
                testID={item.testID}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <View style={styles.iconContainer}>
                  <Icon size={24} color="#5DBB8E" weight="bold" />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <CaretRight size={18} color="#999999" weight="bold" />
              </TouchableOpacity>
            );
          })}
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 18,
  },
});
