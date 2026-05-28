import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';

interface DateOfBirthPickerProps {
  value: string; // Expected format: YYYY-MM-DD
  onChangeText: (dob: string) => void;
  error?: boolean;
  editable?: boolean;
  testID?: string;
}

export const DateOfBirthPicker: React.FC<DateOfBirthPickerProps> = ({
  value,
  onChangeText,
  error = false,
  editable = true,
  testID,
}) => {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // Parse incoming value when it changes
  useEffect(() => {
    if (value && value.includes('-')) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setYear(parts[0]);
        setMonth(parts[1]);
        setDay(parts[2]);
      }
    }
  }, [value]);

  const updateDob = (newDay: string, newMonth: string, newYear: string) => {
    if (newDay && newMonth && newYear && newYear.length === 4) {
      const formattedMonth = newMonth.padStart(2, '0');
      const formattedDay = newDay.padStart(2, '0');
      onChangeText(`${newYear}-${formattedMonth}-${formattedDay}`);
    }
  };

  const handleDayChange = (text: string) => {
    // Only allow numbers, max 2 characters
    const sanitized = text.replace(/[^0-9]/g, '').slice(0, 2);
    setDay(sanitized);

    // Auto-focus to month if day is complete (2 digits)
    if (sanitized.length === 2) {
      monthRef.current?.focus();
    }

    updateDob(sanitized, month, year);
  };

  const handleMonthChange = (text: string) => {
    // Only allow numbers, max 2 characters
    const sanitized = text.replace(/[^0-9]/g, '').slice(0, 2);

    // Validate month range (01-12)
    if (sanitized && parseInt(sanitized) > 12) {
      return;
    }

    setMonth(sanitized);

    // Auto-focus to year if month is complete (2 digits)
    if (sanitized.length === 2) {
      yearRef.current?.focus();
    }

    updateDob(day, sanitized, year);
  };

  const handleYearChange = (text: string) => {
    // Only allow numbers, max 4 characters
    const sanitized = text.replace(/[^0-9]/g, '').slice(0, 4);
    setYear(sanitized);

    updateDob(day, month, sanitized);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dateContainer}>
        {/* Day Input */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Day</Text>
          <TextInput
            style={[styles.dateInput, error && styles.dateInputError]}
            placeholder="DD"
            placeholderTextColor="#999"
            value={day}
            onChangeText={handleDayChange}
            keyboardType="number-pad"
            maxLength={2}
            editable={editable}
            testID={testID ? `${testID}-day` : undefined}
          />
        </View>

        {/* Month Input */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Month</Text>
          <TextInput
            ref={monthRef}
            style={[styles.dateInput, error && styles.dateInputError]}
            placeholder="MM"
            placeholderTextColor="#999"
            value={month}
            onChangeText={handleMonthChange}
            keyboardType="number-pad"
            maxLength={2}
            editable={editable}
            testID={testID ? `${testID}-month` : undefined}
          />
        </View>

        {/* Year Input */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Year</Text>
          <TextInput
            ref={yearRef}
            style={[styles.dateInput, error && styles.dateInputError]}
            placeholder="YYYY"
            placeholderTextColor="#999"
            value={year}
            onChangeText={handleYearChange}
            keyboardType="number-pad"
            maxLength={4}
            editable={editable}
            testID={testID ? `${testID}-year` : undefined}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  dateInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  dateInputError: {
    borderColor: '#ff3b30',
  },
});
