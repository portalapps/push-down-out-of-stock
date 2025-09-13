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
    try {
      const initialUIState: UIState = {};
      const initialImplementedState: ImplementedState = {};
      
      // Build state from existing settings
      if (Array.isArray(existingSettings)) {
        existingSettings.forEach((setting: any) => {
          if (setting && setting.collectionId) {
            const normalizedState = normalizeCollectionState(setting);
            initialUIState[setting.collectionId] = normalizedState;
            initialImplementedState[setting.collectionId] = { ...normalizedState };
          }
        });
      }
      
      // Add collections without settings
      if (Array.isArray(initialCollections)) {
        initialCollections.forEach((collection: any) => {
          if (collection && collection.id && !initialUIState[collection.id]) {
            const defaultState = normalizeCollectionState({});
            initialUIState[collection.id] = defaultState;
            initialImplementedState[collection.id] = { ...defaultState };
          }
        });
      }
      
      console.log('🏗️ SUPERVISOR Initializing states:', {
        uiStateKeys: Object.keys(initialUIState),
        implementedStateKeys: Object.keys(initialImplementedState)
      });
      
      setUIState(initialUIState);
      setImplementedState(initialImplementedState);
    } catch (error) {
      console.error('❌ SUPERVISOR Error initializing states:', error);
      console.error('❌ Initial Collections:', initialCollections);
      console.error('❌ Existing Settings:', existingSettings);
    }
  }, [initialCollections, existingSettings]);

  // Core supervisor function
  const runSupervisor = useCallback(() => {
    try {
      const differences = detectStateDifferences(uiState, implementedState);
      
      console.log('🔍 SUPERVISOR check:', {
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
    } catch (error) {
      console.error('❌ SUPERVISOR Error in runSupervisor:', error);
      console.error('❌ UI State:', uiState);
      console.error('❌ Implemented State:', implementedState);
      console.error('❌ Operation Status:', operationStatus);
    }
  }, [uiState, implementedState, operationStatus, getFetcher]);

  // Handle fetcher responses
  useEffect(() => {
    try {
      if (mainFetcher.state === 'idle' && mainFetcher.data) {
        console.log('📨 SUPERVISOR Fetcher response received:', mainFetcher.data);
        
        // Extract operation tag from response
        const responseTag = mainFetcher.data.operationTag;
      
      if (responseTag && isTagValid(responseTag, uiState)) {
        const { collectionId } = responseTag;
        
        console.log('✅ SUPERVISOR Valid response tag for:', collectionId, {
          responseState: responseTag.targetState,
          currentUIState: uiState[collectionId]
        });
        
        // Update implemented state to match UI state
        setImplementedState(prev => ({
          ...prev,
          [collectionId]: { ...uiState[collectionId] }
        }));
        
        // Update operation status with server response data
        const updatedStatus = updateOperationStatus(
          prev[collectionId] || initializeOperationStatus(collectionId),
          mainFetcher.data.success,
          mainFetcher.data.error
        );
        
        // Add server response data for toast messages
        if (mainFetcher.data.success && mainFetcher.data.stats) {
          updatedStatus.serverResponseData = mainFetcher.data.stats;
        }
        
        setOperationStatus(prev => ({
          ...prev,
          [collectionId]: updatedStatus
        }));
        
        // Clean up pending operation
        pendingOperationsRef.current.delete(collectionId);
      } else {
        console.log('⚠️ SUPERVISOR Invalid or outdated response tag, ignoring:', {
          responseTag,
          hasTag: !!responseTag,
          uiStateKeys: Object.keys(uiState),
          tagValid: responseTag ? isTagValid(responseTag, uiState) : false
        });
        
        // If we have a response tag but it's invalid, it means the operation completed
        // but the UI state has changed since then. We should still clear any processing status
        // to prevent stuck spinners
        if (responseTag && responseTag.collectionId) {
          const collectionId = responseTag.collectionId;
          console.log('🧹 SUPERVISOR Clearing processing status for outdated response:', collectionId);
          
          setOperationStatus(prev => {
            const currentStatus = prev[collectionId];
            if (currentStatus && currentStatus.status === 'processing') {
              // Clear the processing status - supervisor will detect the difference and retry if needed
              const updated = { ...prev };
              delete updated[collectionId];
              return updated;
            }
            return prev;
          });
          
          // Remove from pending operations so supervisor can detect difference and retry
          pendingOperationsRef.current.delete(collectionId);
        }
      }
    }
    } catch (error) {
      console.error('❌ SUPERVISOR Error in fetcher response handler:', error);
      console.error('❌ Fetcher state:', mainFetcher.state);
      console.error('❌ Fetcher data:', mainFetcher.data);
      console.error('❌ UI State:', uiState);
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
    try {
      console.log('🔄 SUPERVISOR updateCollectionState:', collectionId, updates);
      
      setUIState(prev => {
        if (!prev[collectionId]) {
          console.warn('⚠️ SUPERVISOR Collection not found in UI state:', collectionId);
          return prev;
        }
        
        return {
          ...prev,
          [collectionId]: {
            ...prev[collectionId],
            ...updates
          }
        };
      });
    } catch (error) {
      console.error('❌ SUPERVISOR Error in updateCollectionState:', error);
      console.error('❌ Collection ID:', collectionId);
      console.error('❌ Updates:', updates);
    }
  }, []);

  const retryOperation = useCallback((collectionId: string) => {
    try {
      console.log('🔄 SUPERVISOR Manual retry triggered for:', collectionId);
      runSupervisor();
    } catch (error) {
      console.error('❌ SUPERVISOR Error in retryOperation:', error);
    }
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