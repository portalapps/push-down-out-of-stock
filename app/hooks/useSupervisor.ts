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
  shouldCleanupStatus
} from '../utils/operation-manager.client';

type Operation = {
  collectionId: string;
  targetState: CollectionState;
};

/**
 * Main supervisor hook - manages all state reconciliation
 */
export function useSupervisor(initialCollections: any[], existingSettings: any[]) {
  // Core states
  const [uiState, setUIState] = useState<UIState>({});
  const [implementedState, setImplementedState] = useState<ImplementedState>({});
  const [operationStatus, setOperationStatus] = useState<OperationStatusMap>({});
  
  // Single fetcher for serialized operations
  const mainFetcher = useFetcher();
  
  // Operation queue for serialization
  const operationQueueRef = useRef<Operation[]>([]);
  const isProcessingRef = useRef(false);

  // Initialize states from existing data
  useEffect(() => {
    try {
      const initialUIState: UIState = {};
      const initialImplementedState: ImplementedState = {};
      
      if (Array.isArray(existingSettings)) {
        existingSettings.forEach((setting: any) => {
          if (setting && setting.collectionId) {
            const normalizedState = normalizeCollectionState(setting);
            initialUIState[setting.collectionId] = normalizedState;
            initialImplementedState[setting.collectionId] = { ...normalizedState };
          }
        });
      }
      
      if (Array.isArray(initialCollections)) {
        initialCollections.forEach((collection: any) => {
          if (collection && collection.id && !initialUIState[collection.id]) {
            const defaultState = normalizeCollectionState({});
            initialUIState[collection.id] = defaultState;
            initialImplementedState[collection.id] = { ...defaultState };
          }
        });
      }
      
      console.log('🏗️ SUPERVISOR Initializing states');
      setUIState(initialUIState);
      setImplementedState(initialImplementedState);
    } catch (error) {
      console.error('❌ SUPERVISOR Error initializing states:', error);
    }
  }, [initialCollections, existingSettings]);

  // Function to process the next operation in the queue
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || operationQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    const operation = operationQueueRef.current.shift();
    
    if (!operation) {
      isProcessingRef.current = false;
      return;
    }

    const { collectionId, targetState } = operation;
    console.log('🎯 Supervisor triggering operation from queue:', collectionId, targetState);

    const { formData } = createTaggedFormData(collectionId, targetState);

    setOperationStatus(prev => ({
      ...prev,
      [collectionId]: initializeOperationStatus(collectionId)
    }));

    mainFetcher.submit(formData, { method: 'POST' });
  }, [mainFetcher]);

  // Core supervisor function to detect differences and queue operations
  const runSupervisor = useCallback(() => {
    try {
      const differences = detectStateDifferences(uiState, implementedState);
      
      if (differences.length > 0) {
        console.log('🔍 SUPERVISOR check: Found differences', differences.map(d => d.collectionId));
      }

      differences.forEach(({ collectionId, targetState }) => {
        const isAlreadyProcessing = operationStatus[collectionId]?.status === 'processing';
        const isAlreadyInQueue = operationQueueRef.current.some(op => op.collectionId === collectionId);

        if (!isAlreadyProcessing && !isAlreadyInQueue) {
          console.log('➕ Adding to queue:', collectionId);
          operationQueueRef.current.push({ collectionId, targetState });
        }
      });

      processQueue();
    } catch (error) {
      console.error('❌ SUPERVISOR Error in runSupervisor:', error);
    }
  }, [uiState, implementedState, operationStatus, processQueue]);

  // Handle fetcher responses
  useEffect(() => {
    try {
      if (mainFetcher.state === 'idle' && mainFetcher.data) {
        console.log('📨 SUPERVISOR Fetcher response received:', mainFetcher.data);
        
        const responseTag = mainFetcher.data.operationTag;
        
        if (!responseTag || !responseTag.collectionId) {
          console.warn('⚠️ SUPERVISOR Response missing tag, cannot process.');
          isProcessingRef.current = false;
          processQueue();
          return;
        }

        const { collectionId } = responseTag;

        if (isTagValid(responseTag, uiState)) {
          setImplementedState(prev => ({
            ...prev,
            [collectionId]: { ...uiState[collectionId] }
          }));
          
          const updatedStatus = updateOperationStatus(
            operationStatus[collectionId] || initializeOperationStatus(collectionId),
            mainFetcher.data.success,
            mainFetcher.data.error
          );
          
          if (mainFetcher.data.success && mainFetcher.data.stats) {
            updatedStatus.serverResponseData = mainFetcher.data.stats;
          }
          
          setOperationStatus(prev => ({ ...prev, [collectionId]: updatedStatus }));
        } else {
          console.log('⚠️ SUPERVISOR Invalid or outdated response tag, ignoring:', { responseTag });
          // Don't update implementedState, supervisor will re-queue if needed.
        }

        // Operation finished, process the next one.
        isProcessingRef.current = false;
        processQueue();
      }
    } catch (error) {
      console.error('❌ SUPERVISOR Error in fetcher response handler:', error);
      isProcessingRef.current = false;
      processQueue();
    }
  }, [mainFetcher.state, mainFetcher.data, uiState, operationStatus, processQueue]);

  // Timeout and cleanup management
  useEffect(() => {
    const interval = setInterval(() => {
      let hasChanges = false;
      const updated = { ...operationStatus };

      Object.entries(updated).forEach(([collectionId, status]) => {
        if (status.status === 'processing' && isOperationTimedOut(status)) {
          console.log('⏰ Operation timeout:', collectionId);
          updated[collectionId] = updateOperationStatus(status, false, 'Operation timed out');
          hasChanges = true;
          
          // If the timed-out operation was the one being processed, unlock the queue
          if (isProcessingRef.current) {
             const isCurrentOp = operationQueueRef.current.length === 0; // Approximation
             if(isCurrentOp) {
                isProcessingRef.current = false;
                processQueue();
             }
          }
        } else if (shouldCleanupStatus(status)) {
          console.log('🧹 Cleaning up completed status:', collectionId);
          delete updated[collectionId];
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setOperationStatus(updated);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [operationStatus, processQueue]);

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
    }
  }, []);

  const retryOperation = useCallback((collectionId: string) => {
    try {
      console.log('🔄 SUPERVISOR Manual retry triggered for:', collectionId);
      // Clear error status and let supervisor re-queue the operation
      setOperationStatus(prev => {
        const next = { ...prev };
        delete next[collectionId];
        return next;
      });
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
