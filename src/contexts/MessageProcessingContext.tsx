
import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { messageProcessor } from '@/services/messageProcessingService';
import type { ProcessingProgress } from '@/types/processingTypes';
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

  // Process a new message
  const processNewMessage = async (message: string): Promise<string> => {
    if (!clientsQuery.data || !productsQuery.data) {
      throw new Error('Clients and products data must be loaded before processing');
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
