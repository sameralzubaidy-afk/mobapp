export type BulkFlowState =
  | 'IDLE'
  | 'ADDING_PHOTOS'
  | 'GROUPING'
  | 'AI_ANALYZING'
  | 'REVIEWING_ITEMS'
  | 'PUBLISHING'
  | 'SUCCESS'
  | 'PARTIAL'
  | 'ERROR';

export type BulkFlowAction =
  | { type: 'PHOTOS_ADDED' }
  | { type: 'GROUPS_READY' }
  | { type: 'AI_START' }
  | { type: 'AI_DONE' }
  | { type: 'PUBLISH_START' }
  | { type: 'PUBLISH_SUCCESS' }
  | { type: 'PUBLISH_PARTIAL' }
  | { type: 'FAIL' }
  | { type: 'RESET' }
  // V3.1 UX overhaul actions
  | { type: 'EDIT_GROUPING' } // jump back to grouping from review (Decision 7)
  | { type: 'RESET_GROUPING' }; // reset every photo to its own item (Decision 7)

export function bulkListingReducer(state: BulkFlowState, action: BulkFlowAction): BulkFlowState {
  switch (action.type) {
    case 'PHOTOS_ADDED':
      return 'ADDING_PHOTOS';
    case 'GROUPS_READY':
      return 'GROUPING';
    case 'AI_START':
      return 'AI_ANALYZING';
    case 'AI_DONE':
      return 'REVIEWING_ITEMS';
    case 'PUBLISH_START':
      return 'PUBLISHING';
    case 'PUBLISH_SUCCESS':
      return 'SUCCESS';
    case 'PUBLISH_PARTIAL':
      return 'PARTIAL';
    case 'FAIL':
      return 'ERROR';
    case 'RESET':
      return 'IDLE';
    case 'EDIT_GROUPING':
    case 'RESET_GROUPING':
      return 'GROUPING';
    default:
      return state;
  }
}
