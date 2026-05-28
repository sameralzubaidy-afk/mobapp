import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShieldCheck, CheckCircle } from 'phosphor-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_PREFIX = 'safe_meetup_collapsed_';

const TIPS = [
  'Meet in a busy public place (library, mall, coffee shop)',
  'Bring a friend or family member if possible',
  'Inspect the item before tapping "I Got It"',
  'Never share your home address or personal contact info',
  'If something feels off, trust your instincts and leave',
];

interface Props {
  tradeId: string;
}

export function SafeMeetupCard({ tradeId }: Props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const storageKey = `${STORAGE_PREFIX}${tradeId}`;

  // Load persisted collapsed state
  React.useEffect(() => {
    AsyncStorage.getItem(storageKey).then(val => {
      if (val === 'true') setCollapsed(true);
    });
  }, [storageKey]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !collapsed;
    setCollapsed(next);
    AsyncStorage.setItem(storageKey, String(next));
  };

  return (
    <View style={styles.card}>
      {/* Header row */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
        testID="safe-meetup-toggle"
      >
        <View style={styles.headerLeft}>
          <ShieldCheck size={18} color="#16A34A" weight="fill" />
          <Text style={styles.headerText}>Safe meetup tips</Text>
        </View>
        <Text style={styles.chevron}>{collapsed ? '›' : '⌄'}</Text>
      </TouchableOpacity>

      {/* Tips */}
      {!collapsed && (
        <View style={styles.tipsContainer} testID="safe-meetup-tips">
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <CheckCircle size={14} color="#5DBB8E" weight="fill" style={styles.tipIcon} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F0FDF4',
    borderWidth:     1.5,
    borderColor:     '#BBF7D0',
    borderRadius:    12,
    overflow:        'hidden',
    marginBottom:    12,
  },
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingVertical:  12,
    paddingHorizontal: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  headerText: {
    fontSize:   14,
    fontFamily: 'Inter-SemiBold',
    color:      '#15803D',
  },
  chevron: {
    fontSize: 18,
    color:    '#6B7280',
  },
  tipsContainer: {
    paddingHorizontal: 14,
    paddingBottom:     14,
    gap:               8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex:       1,
    fontSize:   13,
    fontFamily: 'Inter-Regular',
    color:      '#166534',
    lineHeight: 20,
  },
});
