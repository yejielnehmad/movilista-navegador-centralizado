
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { messageProcessor, ProcessingProgress, ProcessingStage } from '@/services/messageProcessingService';
import { OrderItem } from '@/types/orders';
import { useQuery } from '@tanstack/react-query';
import { fetchClients } from '@/services/clientService';
import { fetchProducts } from '@/services/productService';
import { toast } from 'sonner';

interface MessageProcessingContextType {
  processTasks: ProcessingProgress[];
  activeTask: ProcessingProgress | null;
  isProcessing: boolean;
  processNewMessage: (message: string) => Promise<string>;
  getTaskById: (id: string) => ProcessingProgress | null;
  getTaskResults: (id: string) => OrderItem[] | null;
  cancelTask: (id: string) => void;
}

const MessageProcessingContext = createContext<MessageProcessingContextType | undefined>(undefined);

export const MessageProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [processTasks, setProcessTasks] = useState<ProcessingProgress[]>([]);
  const [activeTask, setActiveTask] = useState<ProcessingProgress | null>(null);
  
  // Pre-fetch clients and products for background processing
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients
  });
  
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });
  
  // Load tasks on mount
  useEffect(() => {
    const allTasks = messageProcessor.getAllTasks();
    setProcessTasks(allTasks);
    
    // Set active task to the most recent non-completed task
    const pendingTasks = allTasks.filter(task => 
      task.status === 'pending' || 
      (task.status === 'success' && task.stage !== 'completed')
    );
    
    if (pendingTasks.length > 0) {
      // Sort by timestamp to get most recent
      const mostRecent = pendingTasks.sort((a, b) => b.timestamp - a.timestamp)[0];
      setActiveTask(mostRecent);
    }
  }, []);
  
  // Subscribe to progress updates for all tasks
  useEffect(() => {
    const unsubscribers = processTasks.map(task => {
      return messageProcessor.addProgressListener(task.id, (updatedProgress) => {
        // Update specific task
        setProcessTasks(current => 
          current.map(t => t.id === updatedProgress.id ? updatedProgress : t)
        );
        
        // Update active task if this is it
        if (activeTask?.id === updatedProgress.id) {
          setActiveTask(updatedProgress);
        }
        
        // Show toast notifications for important events
        if (updatedProgress.stage === 'completed' && updatedProgress.status === 'success') {
          const itemCount = updatedProgress.result?.length || 0;
          toast.success(`Análisis completado: ${itemCount} pedidos detectados`);
        } else if (updatedProgress.status === 'error') {
          toast.error(`Error en el análisis: ${updatedProgress.error || 'Error desconocido'}`);
        }
      });
    });
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [processTasks, activeTask]);
  
  // Process a new message
  const processNewMessage = useCallback(async (message: string): Promise<string> => {
    if (!clientsQuery.data || !productsQuery.data) {
      throw new Error('No se pueden procesar pedidos sin datos de clientes y productos');
    }
    
    const taskId = await messageProcessor.processMessage(
      message,
      clientsQuery.data,
      productsQuery.data
    );
    
    // Add new task to state
    const newTask = messageProcessor.getTaskProgress(taskId);
    if (newTask) {
      setProcessTasks(current => [...current, newTask]);
      setActiveTask(newTask);
    }
    
    return taskId;
  }, [clientsQuery.data, productsQuery.data]);
  
  // Get a specific task by ID
  const getTaskById = useCallback((id: string): ProcessingProgress | null => {
    return messageProcessor.getTaskProgress(id);
  }, []);
  
  // Get results for a specific task
  const getTaskResults = useCallback((id: string): OrderItem[] | null => {
    const task = messageProcessor.getTaskProgress(id);
    return task?.result || null;
  }, []);
  
  // Cancel a processing task (not currently implemented in service)
  const cancelTask = useCallback((id: string): void => {
    // Future implementation could cancel the task
    console.log('Task cancellation not implemented yet:', id);
  }, []);
  
  // Determine if any processing is happening
  const isProcessing = processTasks.some(task => 
    task.status === 'pending' && task.stage !== 'completed' && task.stage !== 'failed'
  );
  
  const contextValue = {
    processTasks,
    activeTask,
    isProcessing,
    processNewMessage,
    getTaskById,
    getTaskResults,
    cancelTask
  };
  
  return (
    <MessageProcessingContext.Provider value={contextValue}>
      {children}
    </MessageProcessingContext.Provider>
  );
};

export const useMessageProcessing = () => {
  const context = useContext(MessageProcessingContext);
  
  if (context === undefined) {
    throw new Error('useMessageProcessing must be used within a MessageProcessingProvider');
  }
  
  return context;
};
