import { bulkListingReducer, BulkFlowState } from '../bulkListingStateMachine';

describe('bulkListingReducer', () => {
  const cases: Array<{ from: BulkFlowState; action: any; expected: BulkFlowState }> = [
    { from: 'IDLE', action: { type: 'PHOTOS_ADDED' }, expected: 'ADDING_PHOTOS' },
    { from: 'ADDING_PHOTOS', action: { type: 'GROUPS_READY' }, expected: 'GROUPING' },
    { from: 'GROUPING', action: { type: 'AI_START' }, expected: 'AI_ANALYZING' },
    { from: 'AI_ANALYZING', action: { type: 'AI_DONE' }, expected: 'REVIEWING_ITEMS' },
    { from: 'REVIEWING_ITEMS', action: { type: 'PUBLISH_START' }, expected: 'PUBLISHING' },
    { from: 'PUBLISHING', action: { type: 'PUBLISH_SUCCESS' }, expected: 'SUCCESS' },
    { from: 'PUBLISHING', action: { type: 'PUBLISH_PARTIAL' }, expected: 'PARTIAL' },
    { from: 'PUBLISHING', action: { type: 'FAIL' }, expected: 'ERROR' },
  ];

  it.each(cases)(
    'transitions $from via $action.type -> $expected',
    ({ from, action, expected }) => {
      expect(bulkListingReducer(from, action)).toBe(expected);
    }
  );

  it('resets to IDLE', () => {
    expect(bulkListingReducer('ERROR', { type: 'RESET' })).toBe('IDLE');
  });
});
