// SUPERVISOR REACT HOOKS
// Manages client-side supervisor state and operations

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFetcher } from '@remix-run/react';
import type { UIState, ImplementedState, CollectionState } from '../utils/supervisor.client';
import { 
  detectStateDifferences, 
  isTagValid,
  normalizeCollectionState 
} from '../utils/supervisor.client';
import type { OperationStatusMap } from '../utils/operation-manager.client';
import {
  createTaggedFormData,
  initializeOperationStatus,
  updateOperationStatus,
  isOperationTimedOut,
  shouldCleanupStatus,
  getFetcherKey
} from '../utils/operation-manager.client';

/**
 * Main supervisor hook - manages all state reconciliation
 */
export function useSupervisor(initialCollections: any[], existingSettings: any[]) {
  // Core states
  const [uiState, setUIState] = useState<UIState>({});
  const [implementedState, setImplementedState] = useState<ImplementedState>({});
  const [operationStatus, setOperationStatus] = useState<OperationStatusMap>({});
  
  // Dynamic fetcher management
  const fetchersRef = useRef<Map<string, any>>(new Map());
  const mainFetcher = useFetcher();
  
  // Pending operations tracking
  const pendingOperationsRef = useRef<Map<string, any>>(new Map());
  
  // Get or create fetcher for collection
  const getFetcher = useCallback((collectionId: string) => {
    const key = getFetcherKey(collectionId);
    if (!fetchersRef.current.has(key)) {
      // For now, use main fetcher - we'll optimize with multiple fetchers later
      fetchersRef.current.set(key, mainFetcher);
    }
    return fetchersRef.current.get(key);
  }, [mainFetcher]);

  // Initialize states from existing data
  useEffect(() => {
    const initialUIState: UIState = {};
    const initialImplementedState: ImplementedState = {};
    
    // Build state from existing settings
    existingSettings.forEach((setting: any) => {
      const normalizedState = normalizeCollectionState(setting);
      initialUIState[setting.collectionId] = normalizedState;
      initialImplementedState[setting.collectionId] = { ...normalizedState };
    });
    
    // Add collections without settings
    initialCollections.forEach((collection: any) => {
      if (!initialUIState[collection.id]) {
        const defaultState = normalizeCollectionState({});
        initialUIState[collection.id] = defaultState;
        initialImplementedState[collection.id] = { ...defaultState };
      }
    });
    
    setUIState(initialUIState);
    setImplementedState(initialImplementedState);
  }, [initialCollections, existingSettings]);

  // Core supervisor function
  const runSupervisor = useCallback(() => {
    const differences = detectStateDifferences(uiState, implementedState);
    
    console.log('🔍 Supervisor check:', {
      differences: differences.length,
      details: differences.map(d => `${d.collectionId}: ${d.operationType}`)
    });
    
    // Trigger operations for each difference
    differences.forEach(({ collectionId, targetState }) => {
      // Skip if already processing
      if (operationStatus[collectionId]?.status === 'processing') {
        console.log('⏭️ Skipping - already processing:', collectionId);
        return;
      }
      
      console.log('🎯 Supervisor triggering operation:', collectionId, targetState);
      
      // Create tagged operation
      const { formData, tag } = createTaggedFormData(collectionId, targetState);
      
      // Store pending operation
      pendingOperationsRef.current.set(collectionId, { tag, targetState });
      
      // Set processing status
      setOperationStatus(prev => ({
        ...prev,
        [collectionId]: initializeOperationStatus(collectionId)
      }));
      
      // Submit operation
      const fetcher = getFetcher(collectionId);
      fetcher.submit(formData, { method: 'POST' });
    });
  }, [uiState, implementedState, operationStatus, getFetcher]);

  // Handle fetcher responses
  useEffect(() => {
    if (mainFetcher.state === 'idle' && mainFetcher.data) {
      console.log('📨 Fetcher response received:', mainFetcher.data);
      
      // Extract operation tag from response
      const responseTag = mainFetcher.data.operationTag;
      
      if (responseTag && isTagValid(responseTag, uiState)) {
        const { collectionId } = responseTag;
        
        console.log('✅ Valid response tag for:', collectionId);
        
        // Update implemented state to match UI state
        setImplementedState(prev => ({
          ...prev,
          [collectionId]: { ...uiState[collectionId] }
        }));
        
        // Update operation status
        setOperationStatus(prev => ({
          ...prev,
          [collectionId]: updateOperationStatus(
            prev[collectionId] || initializeOperationStatus(collectionId),
            mainFetcher.data.success,
            mainFetcher.data.error
          )
        }));
        
        // Clean up pending operation
        pendingOperationsRef.current.delete(collectionId);
      } else {
        console.log('⚠️ Invalid or outdated response tag, ignoring');
      }
    }
  }, [mainFetcher.state, mainFetcher.data, uiState]);

  // Timeout and cleanup management
  useEffect(() => {
    const interval = setInterval(() => {
      setOperationStatus(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        
        Object.entries(updated).forEach(([collectionId, status]) => {
          // Handle timeouts
          if (isOperationTimedOut(status)) {
            console.log('⏰ Operation timeout:', collectionId);
            updated[collectionId] = updateOperationStatus(status, false, 'Operation timed out');
            pendingOperationsRef.current.delete(collectionId);
            hasChanges = true;
          }
          // Handle cleanup
          else if (shouldCleanupStatus(status)) {
            console.log('🧹 Cleaning up completed status:', collectionId);
            delete updated[collectionId];
            hasChanges = true;
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, []);

  // Auto-run supervisor when UI state changes
  useEffect(() => {
    if (Object.keys(uiState).length > 0) {
      runSupervisor();
    }
  }, [uiState, runSupervisor]);

  // Public API
  const updateCollectionState = useCallback((collectionId: string, updates: Partial<CollectionState>) => {
    setUIState(prev => ({
      ...prev,
      [collectionId]: {
        ...prev[collectionId],
        ...updates
      }
    }));
  }, []);

  const retryOperation = useCallback((collectionId: string) => {
    console.log('🔄 Manual retry triggered for:', collectionId);
    runSupervisor();
  }, [runSupervisor]);

  return {
    uiState,
    implementedState,
    operationStatus,
    updateCollectionState,
    retryOperation,
    runSupervisor
  };
}