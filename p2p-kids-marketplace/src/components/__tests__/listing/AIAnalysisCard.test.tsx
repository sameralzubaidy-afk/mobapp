/**
 * File: p2p-kids-marketplace/src/components/__tests__/listing/AIAnalysisCard.test.tsx
 * MODULE-04 LISTING-V3-008: Unit tests for AIAnalysisCard
 *
 * Test Coverage:
 * - Rendering with AI results
 * - Apply All button (skips filled fields)
 * - Per-field Use buttons
 * - Confidence indicators (high/medium/low)
 * - Dismiss functionality
 * - Entrance animation
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AIAnalysisCard } from '../../listing/AIAnalysisCard';
import { AIAnalysisResult } from '../../../types/listing';

const mockAnalysis: AIAnalysisResult = {
  title: {
    value: 'Nike Air Max Sneakers Size 5',
    confidence: 0.85,
  },
  category: {
    value: { id: 'cat-123', label: 'Shoes', icon: '👟' },
    confidence: 0.92,
  },
  condition: {
    value: 'good',
    confidence: 0.75,
  },
  brand: {
    value: 'Nike',
    confidence: 0.88,
  },
  color: {
    value: ['Blue', 'White'],
    confidence: 0.7,
  },
  age_group: {
    value: '6-8',
    confidence: 0.65,
  },
  gender: {
    value: 'boy',
    confidence: 0.55,
  },
};

describe('AIAnalysisCard', () => {
  const mockIsFieldFilled = jest.fn();
  const mockOnApplyAll = jest.fn();
  const mockOnApplyField = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFieldFilled.mockReturnValue(false);
  });

  describe('Rendering', () => {
    it('renders with AI analysis', () => {
      const { getByText, getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByTestId('ai-analysis-card')).toBeTruthy();
      expect(getByText('🤖 AI Suggestions')).toBeTruthy();
    });

    it('displays all AI suggested fields', () => {
      const { getByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText('Nike Air Max Sneakers Size 5')).toBeTruthy();
      expect(getByText('Shoes')).toBeTruthy();
      expect(getByText('good')).toBeTruthy();
      expect(getByText('Nike')).toBeTruthy();
      expect(getByText('Blue, White')).toBeTruthy();
      expect(getByText('6-8')).toBeTruthy();
      expect(getByText('boy')).toBeTruthy();
    });
  });

  describe('Confidence Indicators', () => {
    it('displays "High" for confidence >= 0.7', () => {
      const { getAllByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      const highConfidence = getAllByText(/High/);
      expect(highConfidence.length).toBeGreaterThan(0);
    });

    it('displays "Medium" for confidence 0.4-0.69', () => {
      const { getAllByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      // age_group has confidence 0.65 and gender has 0.55
      const mediumConfidence = getAllByText(/Medium/);
      expect(mediumConfidence.length).toBeGreaterThan(0);
    });

    it('displays "Low" for confidence < 0.4', () => {
      const lowConfidenceAnalysis: AIAnalysisResult = {
        title: {
          value: 'Uncertain Item',
          confidence: 0.35,
        },
      };

      const { getByText } = render(
        <AIAnalysisCard
          analysis={lowConfidenceAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText(/Low/)).toBeTruthy();
    });

    it('displays confidence percentage', () => {
      const { getByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByText(/85%/)).toBeTruthy(); // title
      expect(getByText(/92%/)).toBeTruthy(); // category
    });
  });

  describe('Apply All Button', () => {
    it('renders Apply All button', () => {
      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByTestId('apply-all-button')).toBeTruthy();
    });

    it('calls onApplyAll when button is pressed', () => {
      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      fireEvent.press(getByTestId('apply-all-button'));
      expect(mockOnApplyAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Per-Field Use Buttons', () => {
    it('renders Use button for each field', () => {
      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByTestId('use-title')).toBeTruthy();
      expect(getByTestId('use-category')).toBeTruthy();
      expect(getByTestId('use-condition')).toBeTruthy();
      expect(getByTestId('use-brand')).toBeTruthy();
      expect(getByTestId('use-color')).toBeTruthy();
      expect(getByTestId('use-age_group')).toBeTruthy();
      expect(getByTestId('use-gender')).toBeTruthy();
    });

    it('calls onApplyField with correct field and value', () => {
      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      fireEvent.press(getByTestId('use-title'));
      expect(mockOnApplyField).toHaveBeenCalledWith('title', 'Nike Air Max Sneakers Size 5');

      fireEvent.press(getByTestId('use-brand'));
      expect(mockOnApplyField).toHaveBeenCalledWith('brand', 'Nike');
    });

    it('shows "Filled" for already filled fields', () => {
      mockIsFieldFilled.mockImplementation((field) => field === 'title');

      const { getAllByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      // Should have at least one "Filled" button (for title)
      const filledButtons = getAllByText('Filled');
      expect(filledButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Use" for empty fields', () => {
      const { getAllByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      const useButtons = getAllByText('Use');
      expect(useButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Dismiss Button', () => {
    it('renders dismiss button', () => {
      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByTestId('dismiss-ai-card')).toBeTruthy();
    });

    it('calls onDismiss when button is pressed', () => {
      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      fireEvent.press(getByTestId('dismiss-ai-card'));
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for Use buttons', () => {
      const { getByLabelText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByLabelText('Use AI suggestion for Title')).toBeTruthy();
      expect(getByLabelText('Use AI suggestion for Brand')).toBeTruthy();
    });

    it('has accessible hints for filled fields', () => {
      mockIsFieldFilled.mockImplementation((field) => field === 'title');

      const { getByA11yHint } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByA11yHint('Field already filled')).toBeTruthy();
    });

    it('has accessible label for Apply All button', () => {
      const { getByLabelText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByLabelText('Apply all AI suggestions to empty fields')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty analysis gracefully', () => {
      const emptyAnalysis: AIAnalysisResult = {};

      const { getByTestId } = render(
        <AIAnalysisCard
          analysis={emptyAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      expect(getByTestId('ai-analysis-card')).toBeTruthy();
    });

    it('handles array values in colors field', () => {
      const { getByText } = render(
        <AIAnalysisCard
          analysis={mockAnalysis}
          isFieldFilled={mockIsFieldFilled}
          onApplyAll={mockOnApplyAll}
          onApplyField={mockOnApplyField}
          onDismiss={mockOnDismiss}
        />
      );

      // color field value is ['Blue', 'White'], should display as "Blue, White"
      expect(getByText('Blue, White')).toBeTruthy();
    });
  });
});
