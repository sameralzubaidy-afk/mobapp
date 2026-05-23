// FILE: p2p-kids-marketplace/src/screens/support/FAQDetailScreen.tsx
// MODULE-15.1 FLOW-19: FAQ Detail Screen (Visual Redesign)

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Question } from 'phosphor-react-native';
import { recordFaqVote } from '../../services/faqService';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface FAQDetailScreenProps {
  navigation: any;
  route: {
    params: {
      faq: FAQ;
    };
  };
}

export default function FAQDetailScreen({ navigation, route }: FAQDetailScreenProps) {
  const { faq } = route.params;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']} testID="faq-detail-screen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="back-button"
          >
            <ArrowLeft size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>FAQ</Text>
          <View style={styles.backButton} />
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={styles.content} testID="content-scroll">
          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{faq.category}</Text>
          </View>

          {/* Question */}
          <View style={styles.questionContainer}>
            <Question size={24} color="#5DBB8E" />
            <Text style={styles.question}>{faq.question}</Text>
          </View>

          {/* Answer */}
          <Text style={styles.answer}>{faq.answer}</Text>

          {/* Helpful Section */}
          <View style={styles.helpfulSection}>
            <Text style={styles.helpfulTitle}>Was this helpful?</Text>
            <View style={styles.helpfulButtons}>
              <TouchableOpacity
                style={styles.helpfulBtn}
                onPress={() => {
                  recordFaqVote(faq.id, 'yes'); // fire-and-forget
                  navigation.goBack();
                }}
                testID="helpful-yes-button"
                accessibilityRole="button"
                accessibilityLabel="Yes, this was helpful"
              >
                <Text style={styles.helpfulBtnText}>👍 Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.helpfulBtn}
                onPress={() => {
                  recordFaqVote(faq.id, 'no'); // fire-and-forget
                  navigation.navigate('ContactSupport');
                }}
                testID="helpful-no-button"
                accessibilityRole="button"
                accessibilityLabel="No, this was not helpful"
              >
                <Text style={styles.helpfulBtnText}>👎 No</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Still Need Help */}
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => navigation.navigate('ContactSupport')}
              testID="contact-support-button"
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <Text style={styles.contactBtnText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5DBB8E',
    textTransform: 'uppercase',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  question: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 28,
  },
  answer: {
    fontSize: 16,
    color: '#6B6B6B',
    lineHeight: 24,
    marginBottom: 32,
  },
  helpfulSection: {
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  helpfulTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  helpfulButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  helpfulBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  helpfulBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  contactSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  contactBtn: {
    backgroundColor: '#5DBB8E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  contactBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
