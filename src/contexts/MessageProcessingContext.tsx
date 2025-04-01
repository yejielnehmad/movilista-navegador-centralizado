
import React, { createContext, useContext, useState, useEffect } from 'react';
import { messageProcessor } from '@/services/messageProcessingService';
import { ProcessingProgress, ProgressListener } from '@/types/processingTypes';
import { OrderItem } from '@/types/orders';
import { useQuery } from '@tanstack/react-query';
import { fetchClients } from '@/services/clientService';
import { fetchProducts } from '@/services/productService';

/* MessageProcessingContext manages background processing of order messages */

interface MessageProcessingContextType {
  // Process a new message and return the task ID
  processNewMessage: (message: string) => Promise<string>;
  
  // Get all processing tasks
  getAllTasks: () => ProcessingProgress[];
  
  // Get a specific task's progress
  getTaskProgress: (taskId: string) => ProcessingProgress | null;
  
  // Get a specific task's results (if available)
  getTaskResults: (taskId: string) => OrderItem[] | null;
  
  // The currently active task (most recent)
  activeTask: ProcessingProgress | null;
  
  // Whether any task is currently processing
  isProcessing: boolean;
  
  // Register a new progress listener for app-wide updates
  registerGlobalListener: (callback: ProgressListener) => () => void;
  
  // Manually trigger a sync with Supabase
  syncWithSupabase: () => Promise<void>;
  
  // Reset the current active task (used after saving)
  resetActiveTask: () => void;
}

const MessageProcessingContext = createContext<MessageProcessingContextType | undefined>(undefined);

export function MessageProcessingProvider({ children }: { children: React.ReactNode }) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTask, setActiveTask] = useState<ProcessingProgress | null>(null);

  // Fetch clients and products for processing
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // On mount, check for any active tasks and restore their state
  useEffect(() => {
    // First, sync with Supabase to ensure we have the latest data
    messageProcessor.syncWithSupabase().then(() => {
      // Get the current active task from the processor after sync
      const currentActiveTask = messageProcessor.getActiveTask();
      if (currentActiveTask) {
        setActiveTaskId(currentActiveTask.id);
        setActiveTask(currentActiveTask);
        
        // Update processing state
        setIsProcessing(
          currentActiveTask.stage !== 'completed' && 
          currentActiveTask.stage !== 'failed'
        );
      }
    });
    
    // Set up periodic sync
    const syncInterval = setInterval(() => {
      messageProcessor.syncWithSupabase();
    }, 60000); // Sync every minute
    
    return () => clearInterval(syncInterval);
  }, []);

  // Process a new message
  const processNewMessage = async (message: string): Promise<string> => {
    if (!clientsQuery.data || !productsQuery.data) {
      throw new Error('Clients and products data must be loaded before processing');
    }
    
    // First, check if we already have a completed analysis for this exact message
    const existingTask = messageProcessor.findTaskByMessage(message);
    if (existingTask && existingTask.stage === 'completed') {
      console.log('Using existing completed analysis for message:', message.substring(0, 50) + '...');
      setActiveTaskId(existingTask.id);
      setActiveTask(existingTask);
      setIsProcessing(false);
      return existingTask.id;
    }
    
    const taskId = await messageProcessor.processMessage(
      message, 
      clientsQuery.data, 
      productsQuery.data
    );
    
    setActiveTaskId(taskId);
    setIsProcessing(true);
    
    return taskId;
  };

  // Get all tasks
  const getAllTasks = (): ProcessingProgress[] => {
    return messageProcessor.getAllTasks();
  };

  // Get a specific task's progress
  const getTaskProgress = (taskId: string): ProcessingProgress | null => {
    return messageProcessor.getTaskProgress(taskId);
  };

  // Get the results of a task if available
  const getTaskResults = (taskId: string): OrderItem[] | null => {
    const task = messageProcessor.getTaskProgress(taskId);
    if (task?.stage === 'completed' && task?.status === 'success' && task?.result) {
      return task.result;
    }
    return null;
  };
  
  // Register a global listener for progress updates (app-wide)
  const registerGlobalListener = (callback: ProgressListener): () => void => {
    return messageProcessor.addGlobalProgressListener(callback);
  };
  
  // Manually trigger a sync with Supabase
  const syncWithSupabase = async (): Promise<void> => {
    return messageProcessor.syncWithSupabase();
  };
  
  // Reset the current active task (after saving an order)
  const resetActiveTask = (): void => {
    setActiveTaskId(null);
    setActiveTask(null);
    setIsProcessing(false);
  };

  // Monitor active task
  useEffect(() => {
    if (!activeTaskId) return;
    
    // Initial set
    setActiveTask(messageProcessor.getTaskProgress(activeTaskId));
    
    // Subscribe to updates
    const unsubscribe = messageProcessor.addProgressListener(
      activeTaskId,
      (progress) => {
        setActiveTask(progress);
        
        // Update processing status
        if (progress.stage === 'completed' || progress.stage === 'failed') {
          setIsProcessing(false);
        }
      }
    );
    
    return unsubscribe;
  }, [activeTaskId]);

  const value = {
    processNewMessage,
    getAllTasks,
    getTaskProgress,
    getTaskResults,
    activeTask,
    isProcessing,
    registerGlobalListener,
    syncWithSupabase,
    resetActiveTask
  };

  return (
    <MessageProcessingContext.Provider value={value}>
      {children}
    </MessageProcessingContext.Provider>
  );
}

export const useMessageProcessing = (): MessageProcessingContextType => {
  const context = useContext(MessageProcessingContext);
  if (context === undefined) {
    throw new Error('useMessageProcessing must be used within a MessageProcessingProvider');
  }
  return context;
};
