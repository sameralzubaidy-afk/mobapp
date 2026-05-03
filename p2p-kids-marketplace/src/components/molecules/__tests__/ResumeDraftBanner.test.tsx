/**
 * File: p2p-kids-marketplace/src/components/molecules/__tests__/ResumeDraftBanner.test.tsx
 * MODULE-04 LISTING-V3-007: Unit tests for ResumeDraftBanner component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ResumeDraftBanner } from '../ResumeDraftBanner';
import { ItemDraft } from '../../../types/listing';

const mockDraft: ItemDraft = {
  id: 'draft-1',
  seller_id: 'seller-1',
  bulk_upload_id: null,
  draft_data: {
    title: 'Test Draft',
    description: 'Test description',
    price: 50,
    photo_urls: ['https://example.com/photo1.jpg'],
  },
  photo_urls: ['https://example.com/photo1.jpg'],
  ai_suggestions: null,
  step: 'photos',
  created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  updated_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
  expires_at: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
};

const mockBulkDraft: ItemDraft = {
  ...mockDraft,
  id: 'draft-2',
  bulk_upload_id: 'bulk-1',
};

const mockBulkDraftWithTwoItems = {
  ...mockBulkDraft,
  draft_data: {
    ...mockBulkDraft.draft_data,
    items: [{ groupId: 'group-1' }, { groupId: 'group-2' }],
  },
} as unknown as ItemDraft;

describe('ResumeDraftBanner', () => {
  const mockOnResume = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no drafts provided', () => {
    const { queryByTestId } = render(
      <ResumeDraftBanner drafts={[]} onResume={mockOnResume} onDismiss={mockOnDismiss} />
    );

    expect(queryByTestId('resume-draft-banner')).toBeNull();
  });

  it('renders banner with unfinished listing count when drafts exist', () => {
    const { getByTestId } = render(
      <ResumeDraftBanner
        drafts={[mockDraft, mockBulkDraft]}
        onResume={mockOnResume}
        onDismiss={mockOnDismiss}
      />
    );

    expect(getByTestId('resume-draft-banner')).toBeTruthy();
    expect(getByTestId('resume-draft-banner-title')).toHaveTextContent('2 unfinished listings');
  });

  it('counts bulk draft items (groups) in the banner title', () => {
    const { getByTestId } = render(
      <ResumeDraftBanner
        drafts={[mockBulkDraftWithTwoItems]}
        onResume={mockOnResume}
        onDismiss={mockOnDismiss}
      />
    );

    expect(getByTestId('resume-draft-banner-title')).toHaveTextContent('2 unfinished listings');
  });

  it('shows singular text when only one draft', () => {
    const { getByTestId } = render(
      <ResumeDraftBanner drafts={[mockDraft]} onResume={mockOnResume} onDismiss={mockOnDismiss} />
    );

    expect(getByTestId('resume-draft-banner-title')).toHaveTextContent('1 unfinished listing');
  });

  it('calls onResume with correct params for single item draft when Continue pressed', () => {
    const { getByTestId } = render(
      <ResumeDraftBanner drafts={[mockDraft]} onResume={mockOnResume} onDismiss={mockOnDismiss} />
    );

    fireEvent.press(getByTestId('resume-draft-banner-resume-button'));

    expect(mockOnResume).toHaveBeenCalledWith('draft-1', false);
  });

  it('calls onResume with correct params for bulk draft when Continue pressed', () => {
    const { getByTestId } = render(
      <ResumeDraftBanner
        drafts={[mockBulkDraft]}
        onResume={mockOnResume}
        onDismiss={mockOnDismiss}
      />
    );

    fireEvent.press(getByTestId('resume-draft-banner-resume-button'));

    expect(mockOnResume).toHaveBeenCalledWith('draft-2', true);
  });

  it('calls onDismiss when dismiss button pressed', () => {
    const { getByTestId } = render(
      <ResumeDraftBanner drafts={[mockDraft]} onResume={mockOnResume} onDismiss={mockOnDismiss} />
    );

    fireEvent.press(getByTestId('resume-draft-banner-dismiss-button'));

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('uses most recent draft when multiple drafts exist', () => {
    const olderDraft: ItemDraft = {
      ...mockDraft,
      id: 'draft-old',
      updated_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    };

    const { getByTestId } = render(
      <ResumeDraftBanner
        drafts={[mockDraft, olderDraft]}
        onResume={mockOnResume}
        onDismiss={mockOnDismiss}
      />
    );

    fireEvent.press(getByTestId('resume-draft-banner-resume-button'));

    // Should use the first draft in the array (most recent)
    expect(mockOnResume).toHaveBeenCalledWith('draft-1', false);
  });

  it('has correct accessibility labels', () => {
    const { getByLabelText } = render(
      <ResumeDraftBanner drafts={[mockDraft]} onResume={mockOnResume} onDismiss={mockOnDismiss} />
    );

    expect(getByLabelText('Resume listing')).toBeTruthy();
    expect(getByLabelText('Dismiss banner')).toBeTruthy();
  });
});
