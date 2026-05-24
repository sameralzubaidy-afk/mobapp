// File: p2p-kids-marketplace/src/components/__tests__/EmptyState.test.tsx
// FLOW-26 Unit Tests: EmptyState

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders correctly with only title (minimal props)', () => {
    const { getByTestId } = render(<EmptyState title="No items" />);
    
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByTestId('empty-state-title')).toBeTruthy();
  });

  it('displays correct title', () => {
    const title = 'No items found';
    const { getByTestId } = render(<EmptyState title={title} />);
    const titleElement = getByTestId('empty-state-title');
    
    expect(titleElement.props.children).toBe(title);
  });

  it('displays subtitle when provided', () => {
    const subtitle = 'Try adding your first listing';
    const { getByTestId } = render(
      <EmptyState title="No items" subtitle={subtitle} />
    );
    const subtitleElement = getByTestId('empty-state-subtitle');
    
    expect(subtitleElement.props.children).toBe(subtitle);
  });

  it('does not render subtitle when not provided', () => {
    const { queryByTestId } = render(<EmptyState title="No items" />);
    
    expect(queryByTestId('empty-state-subtitle')).toBeNull();
  });

  it('renders custom icon when provided', () => {
    const CustomIcon = () => <Text testID="custom-icon">📦</Text>;
    const { getByTestId } = render(
      <EmptyState title="No items" icon={<CustomIcon />} />
    );
    
    expect(getByTestId('empty-state-icon')).toBeTruthy();
    expect(getByTestId('custom-icon')).toBeTruthy();
  });

  it('does not render icon container when icon not provided', () => {
    const { queryByTestId } = render(<EmptyState title="No items" />);
    
    expect(queryByTestId('empty-state-icon')).toBeNull();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const mockOnAction = jest.fn();
    const { getByTestId } = render(
      <EmptyState
        title="No items"
        actionLabel="Add Item"
        onAction={mockOnAction}
      />
    );
    
    expect(getByTestId('empty-state-action-button')).toBeTruthy();
  });

  it('does not render action button when actionLabel missing', () => {
    const mockOnAction = jest.fn();
    const { queryByTestId } = render(
      <EmptyState title="No items" onAction={mockOnAction} />
    );
    
    expect(queryByTestId('empty-state-action-button')).toBeNull();
  });

  it('does not render action button when onAction missing', () => {
    const { queryByTestId } = render(
      <EmptyState title="No items" actionLabel="Add Item" />
    );
    
    expect(queryByTestId('empty-state-action-button')).toBeNull();
  });

  it('calls onAction when action button pressed', () => {
    const mockOnAction = jest.fn();
    const { getByTestId } = render(
      <EmptyState
        title="No items"
        actionLabel="Add Item"
        onAction={mockOnAction}
      />
    );
    
    const actionButton = getByTestId('empty-state-action-button');
    fireEvent.press(actionButton);
    
    expect(mockOnAction).toHaveBeenCalledTimes(1);
  });

  it('has correct accessibility label on action button', () => {
    const mockOnAction = jest.fn();
    const actionLabel = 'Create Listing';
    const { getByTestId } = render(
      <EmptyState
        title="No items"
        actionLabel={actionLabel}
        onAction={mockOnAction}
      />
    );
    
    const actionButton = getByTestId('empty-state-action-button');
    expect(actionButton.props.accessibilityLabel).toBe(actionLabel);
    expect(actionButton.props.accessibilityRole).toBe('button');
  });

  it('uses custom testID when provided', () => {
    const customTestID = 'my-empty-state';
    const { getByTestId } = render(
      <EmptyState title="No items" testID={customTestID} />
    );
    
    expect(getByTestId(customTestID)).toBeTruthy();
    expect(getByTestId(`${customTestID}-title`)).toBeTruthy();
  });

  it('applies correct design system colors to action button', () => {
    const mockOnAction = jest.fn();
    const { getByTestId } = render(
      <EmptyState
        title="No items"
        actionLabel="Add"
        onAction={mockOnAction}
      />
    );
    
    const actionButton = getByTestId('empty-state-action-button');
    expect(actionButton.props.style).toMatchObject(
      expect.objectContaining({ backgroundColor: '#5DBB8E' })
    );
  });
});
