// CLIENT-SIDE SUPERVISOR PATTERN
// Declarative State Management for Collections

export interface CollectionState {
  enabled: boolean;
  sortType: string;
  exclusionTags: string[];
}

export interface UIState {
  [collectionId: string]: CollectionState;
}

export interface ImplementedState {
  [collectionId: string]: CollectionState;
}

export interface StateDifference {
  collectionId: string;
  currentState: CollectionState;
  targetState: CollectionState;
  operationType: 'save' | 'save-and-sort';
}

/**
 * Core Supervisor: Compare UI state vs Implemented state
 * Returns differences that need to be reconciled
 */
export function detectStateDifferences(
  uiState: UIState,
  implementedState: ImplementedState
): StateDifference[] {
  const differences: StateDifference[] = [];

  // Check each collection in UI state
  Object.entries(uiState).forEach(([collectionId, targetState]) => {
    const currentState = implementedState[collectionId];
    
    // If no implemented state exists, everything is different
    if (!currentState) {
      differences.push({
        collectionId,
        currentState: { enabled: false, sortType: 'bestsellers', exclusionTags: [] },
        targetState,
        operationType: targetState.enabled ? 'save-and-sort' : 'save'
      });
      return;
    }

    // Deep comparison of states
    if (!areStatesEqual(currentState, targetState)) {
      differences.push({
        collectionId,
        currentState,
        targetState,
        operationType: targetState.enabled ? 'save-and-sort' : 'save'
      });
    }
  });

  return differences;
}

/**
 * Deep equality check for collection states
 */
export function areStatesEqual(state1: CollectionState, state2: CollectionState): boolean {
  if (state1.enabled !== state2.enabled) return false;
  if (state1.sortType !== state2.sortType) return false;
  
  // Compare exclusion tags (order-independent)
  const tags1 = [...state1.exclusionTags].sort();
  const tags2 = [...state2.exclusionTags].sort();
  
  if (tags1.length !== tags2.length) return false;
  return tags1.every((tag, index) => tag === tags2[index]);
}

/**
 * Create operation tag for tracking responses
 */
export function createOperationTag(collectionId: string, targetState: CollectionState) {
  return {
    collectionId,
    targetState: { ...targetState },
    timestamp: Date.now()
  };
}

/**
 * Validate if response tag matches current UI state
 */
export function isTagValid(
  responseTag: any,
  currentUIState: UIState
): boolean {
  if (!responseTag || !responseTag.collectionId || !responseTag.targetState) {
    return false;
  }

  const { collectionId, targetState } = responseTag;
  const currentState = currentUIState[collectionId];
  
  if (!currentState) return false;
  
  return areStatesEqual(currentState, targetState);
}

/**
 * Normalize collection settings for consistent comparison
 */
export function normalizeCollectionState(settings: any): CollectionState {
  return {
    enabled: Boolean(settings?.enabled),
    sortType: settings?.sortType || 'bestsellers',
    exclusionTags: Array.isArray(settings?.exclusionTags) ? [...settings.exclusionTags] : []
  };
}