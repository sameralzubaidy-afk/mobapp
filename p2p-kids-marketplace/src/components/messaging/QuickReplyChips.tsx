import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Chip {
  id: string;
  label: string;
  message: string;
  isPrefill: boolean;
}

const CHIPS: Chip[] = [
  {
    id: 'today',
    label: '📅 Available today',
    message: "Hey! I'm available to meet today. What time works for you?",
    isPrefill: false,
  },
  {
    id: 'tomorrow',
    label: '📆 Available tomorrow',
    message: 'Hi! I can meet tomorrow. Does that work for you?',
    isPrefill: false,
  },
  {
    id: 'suggest',
    label: '🗓 Suggest times',
    message: "I'm available on [DATE] at [TIME] or [DATE] at [TIME]. Does either work for you?",
    isPrefill: true,
  },
  {
    id: 'public_place',
    label: '📍 Public place only',
    message:
      "Just a reminder — I'd prefer to meet at a public place like a library, mall, or coffee shop.",
    isPrefill: false,
  },
  {
    id: 'running_late',
    label: '⏰ Running late',
    message: "Hey, I'm running a few minutes late. I'll be there soon, sorry!",
    isPrefill: false,
  },
];

const INITIAL_VISIBLE = 3;

interface Props {
  onChipPress: (message: string, isPrefill?: boolean) => void;
}

export function QuickReplyChips({ onChipPress }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const visibleChips = expanded ? CHIPS : CHIPS.slice(0, INITIAL_VISIBLE);

  return (
    <View style={styles.row} testID="quick-reply-chips-row">
      {visibleChips.map((chip) => (
        <TouchableOpacity
          key={chip.id}
          style={styles.chip}
          onPress={() => onChipPress(chip.message, chip.isPrefill)}
          activeOpacity={0.7}
          testID={`quick-reply-chip-${chip.id}`}
          accessible
          accessibilityRole="button"
        >
          <Text style={styles.chipLabel}>{chip.label}</Text>
        </TouchableOpacity>
      ))}

      {!expanded && (
        <TouchableOpacity
          style={styles.moreChip}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
          testID="quick-reply-chip-more"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Quick reply chip more"
        >
          <Text style={styles.moreLabel}>+ More</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // FIX-Task-67 item 3 (MSG Round 3 finding N2): this was a horizontal ScrollView,
  // which let the chips overflow the Android viewport — the 3rd label was clipped
  // and `quick-reply-chip-more` sat off-screen with no scroll affordance, so half
  // the chip set was unreachable. The row now WRAPS instead of scrolling: every
  // chip and the expander stay on screen (2 short rows collapsed, 2–3 expanded).
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
  moreChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  moreLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#5DBB8E',
  },
});
