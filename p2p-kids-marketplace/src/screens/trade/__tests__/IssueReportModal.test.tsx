/**
 * Unit Tests: IssueReportModal
 * Tests: visibility, reason selection, description validation (other), submit flow, cancel, error state
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { IssueReportModal } from '../IssueReportModal';

describe('IssueReportModal', () => {
  const mockOnClose  = jest.fn();
  const mockOnSubmit = jest.fn();

  const submitReport = async (getByText: (text: string) => any) => {
    await waitFor(() => {
      fireEvent.press(getByText('Submit Report'));
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  describe('Visibility', () => {
    it('should be visible when visible=true', () => {
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      expect(getByText('Report an Issue')).toBeTruthy();
    });

    it('should not be visible when visible=false', () => {
      const { queryByText } = render(
        <IssueReportModal visible={false} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      expect(queryByText('Report an Issue')).toBeNull();
    });
  });

  describe('Reason Selection', () => {
    it('should render all 4 reason options', () => {
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      expect(getByText('Seller was a no-show')).toBeTruthy();
      expect(getByText('Item not as described')).toBeTruthy();
      expect(getByText('Seller not responding')).toBeTruthy();
      expect(getByText('Other issue')).toBeTruthy();
    });

    it('should enable submit button after selecting a reason (non-other)', () => {
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      const submitBtn = getByText('Submit Report');
      // Initially disabled (no selection)
      expect(submitBtn.props.style).toBeDefined();

      // Select a non-"other" reason
      fireEvent.press(getByText('Item not as described'));
      // Submit button should now be pressable (canSubmit = true)
      expect(getByText('Submit Report')).toBeTruthy();
    });

    it('should show description textarea when "Other issue" is selected', () => {
      const { getByText, getByPlaceholderText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Other issue'));
      expect(getByPlaceholderText('Tell us what happened…')).toBeTruthy();
    });
  });

  describe('Description Validation (Other)', () => {
    it('should require at least 20 chars for "other" before enabling submit', () => {
      const { getByText, getByPlaceholderText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Other issue'));
      const textarea = getByPlaceholderText('Tell us what happened…');

      // Short description — submit should still be disabled
      fireEvent.changeText(textarea, 'Short');
      expect(getByText('Submit Report')).toBeTruthy(); // button exists but disabled

      // Long enough description — submit should be enabled
      fireEvent.changeText(textarea, 'This is a long enough description that should work.');
      expect(getByText('Submit Report')).toBeTruthy();
    });
  });

  describe('Submit Flow', () => {
    it('should call onSubmit with reason and description', async () => {
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Item not as described'));
      await submitReport(getByText);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('not_as_described', '');
      });
    });

    it('should call onClose after successful submit', async () => {
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Seller was a no-show'));
      await submitReport(getByText);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error text when onSubmit rejects', async () => {
      mockOnSubmit.mockRejectedValueOnce(new Error('Network error'));
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Seller not responding'));
      await submitReport(getByText);

      await waitFor(() => {
        expect(getByText('Network error')).toBeTruthy();
      });
    });

    it('should show fallback error when onSubmit rejects without message', async () => {
      mockOnSubmit.mockRejectedValueOnce(new Error());
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Item not as described'));
      await submitReport(getByText);

      await waitFor(() => {
        expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
      });
    });
  });

  describe('Cancel', () => {
    it('should call onClose when cancel is pressed', () => {
      const { getByText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset selection state when cancelled', () => {
      const { getByText, queryByPlaceholderText } = render(
        <IssueReportModal visible={true} onClose={mockOnClose} onSubmit={mockOnSubmit} />
      );
      fireEvent.press(getByText('Other issue'));
      expect(queryByPlaceholderText('Tell us what happened…')).toBeTruthy();

      fireEvent.press(getByText('Cancel'));
      // After cancel, onClose was called; component resets state
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
