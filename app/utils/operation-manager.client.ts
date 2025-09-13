// CLIENT-SIDE OPERATION MANAGER
// Handles tagged operations with retry logic

import type { CollectionState } from './supervisor.client';
import { createOperationTag } from './supervisor.client';

export interface OperationRequest {
  collectionId: string;
  targetState: CollectionState;
  tag: any;
}

export interface OperationStatus {
  status: 'idle' | 'processing' | 'ready' | 'error' | 'retry';
  timestamp: number;
  retryCount: number;
  lastError?: string;
  serverResponseData?: {
    inStockCount: number;
    outOfStockCount: number;
    totalProducts: number;
  };
}

export type OperationStatusMap = Record<string, OperationStatus>;

/**
 * Create tagged form data for server request
 */
export function createTaggedFormData(
  collectionId: string,
  targetState: CollectionState
): { formData: FormData; tag: any } {
  const tag = createOperationTag(collectionId, targetState);
  
  const formData = new FormData();
  formData.append('action', 'updateSetting');
  formData.append('collectionId', collectionId);
  formData.append('enabled', targetState.enabled.toString());
  formData.append('sortType', targetState.sortType);
  formData.append('exclusionTags', JSON.stringify(targetState.exclusionTags));
  formData.append('operationTag', JSON.stringify(tag));
  
  return { formData, tag };
}

/**
 * Initialize operation status for a collection
 */
export function initializeOperationStatus(collectionId: string): OperationStatus {
  return {
    status: 'processing',
    timestamp: Date.now(),
    retryCount: 0
  };
}

/**
 * Update operation status based on response
 */
export function updateOperationStatus(
  currentStatus: OperationStatus,
  success: boolean,
  error?: string
): OperationStatus {
  if (success) {
    return {
      ...currentStatus,
      status: 'ready',
      timestamp: Date.now(),
      lastError: undefined
    };
  } else {
    // Determine if we should retry
    const shouldRetry = currentStatus.retryCount < 2; // Max 2 retries
    
    return {
      ...currentStatus,
      status: shouldRetry ? 'retry' : 'error',
      timestamp: Date.now(),
      retryCount: currentStatus.retryCount + 1,
      lastError: error
    };
  }
}

/**
 * Check if operation has timed out (10 seconds)
 */
export function isOperationTimedOut(status: OperationStatus): boolean {
  const now = Date.now();
  const timeoutMs = 10000; // 10 seconds
  
  return (
    status.status === 'processing' &&
    (now - status.timestamp) > timeoutMs
  );
}

/**
 * Clean up completed operations (after 3 seconds)
 */
export function shouldCleanupStatus(status: OperationStatus): boolean {
  const now = Date.now();
  const cleanupDelayMs = 3000; // 3 seconds
  
  return (
    (status.status === 'ready' || status.status === 'error') &&
    (now - status.timestamp) > cleanupDelayMs
  );
}

/**
 * Get fetcher key for dynamic fetcher management
 */
export function getFetcherKey(collectionId: string): string {
  return `collection-${collectionId}`;
}

/**
 * Determine if collection needs sorting after settings save
 */
export function needsAutoSort(targetState: CollectionState): boolean {
  return targetState.enabled;
}

/**
 * Create operation summary for debugging
 */
export function getOperationSummary(
  collectionId: string,
  targetState: CollectionState,
  status: OperationStatus
): string {
  const operation = needsAutoSort(targetState) ? 'save-and-sort' : 'save-only';
  return `${collectionId}: ${operation} (${status.status}) - retry: ${status.retryCount}`;
}