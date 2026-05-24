// File: p2p-kids-marketplace/src/components/__tests__/EmptySearchState.test.tsx
// FLOW-26 Unit Tests: EmptySearchState

import React from 'react';
import { render } from '@testing-library/react-native';
import EmptySearchState from '../EmptySearchState';

describe('EmptySearchState', () => {
  it('renders correctly with default props', () => {
    const { getByTestId } = render(<EmptySearchState />);
    
    expect(getByTestId('empty-search-state')).toBeTruthy();
    expect(getByTestId('empty-search-icon')).toBeTruthy();
    expect(getByTestId('empty-search-title')).toBeTruthy();
    expect(getByTestId('empty-search-subtitle')).toBeTruthy();
  });

  it('displays "No results found" when no query provided', () => {
    const { getByTestId } = render(<EmptySearchState />);
    const title = getByTestId('empty-search-title');
    
    expect(title.props.children).toBe('No results found');
  });

  it('displays query in title when provided', () => {
    const query = 'toy car';
    const { getByTestId } = render(<EmptySearchState query={query} />);
    const title = getByTestId('empty-search-title');
    
    expect(title.props.children).toBe('No results for "toy car"');
  });

  it('displays correct subtitle', () => {
    const { getByTestId } = render(<EmptySearchState />);
    const subtitle = getByTestId('empty-search-subtitle');
    
    expect(subtitle.props.children).toBe('Try different keywords or filters');
  });

  it('handles empty string query', () => {
    const { getByTestId } = render(<EmptySearchState query="" />);
    const title = getByTestId('empty-search-title');
    
    expect(title.props.children).toBe('No results found');
  });

  it('handles special characters in query', () => {
    const query = 'Barbie™ & Ken®';
    const { getByTestId } = render(<EmptySearchState query={query} />);
    const title = getByTestId('empty-search-title');
    
    expect(title.props.children).toContain(query);
  });
});
