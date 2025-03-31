
import { OrderItem, ProcessedOrder } from "@/types/orders";
import { parseMessyOrderMessage, validateAndMatchOrders, groupOrdersByClient } from "@/utils/advancedOrderParser";
import { ProductWithVariants } from "@/services/productService";
import { Client } from "@/services/clientService";
import { geminiClient } from "@/services/gemini";
import { v4 as uuidv4 } from 'uuid';

// Process state types
export type ProcessingStage = 
  | 'not_started'
  | 'parsing'
  | 'fetching_data'
  | 'analyzing'
  | 'ai_processing'
  | 'validating'
  | 'completed'
  | 'failed';

export interface ProcessingProgress {
  id: string;
  message: string;
  stage: ProcessingStage;
  progress: number; // 0-100
  status: 'pending' | 'success' | 'error';
  error?: string;
  result?: OrderItem[];
  raw?: any;
  timestamp: number;
}

// Define listeners interface
type ProgressListener = (progress: ProcessingProgress) => void;

// Create a singleton class for message processing
class MessageProcessingService {
  private processingTasks: Record<string, ProcessingProgress> = {};
  private listeners: Record<string, ProgressListener[]> = {};
  private storageKey = 'ventascom_processing_tasks';
  
  constructor() {
    this.loadFromStorage();
    
    // Set up event listeners for background sync
    window.addEventListener('online', () => this.syncWithBackend());
    
    // Cleanup completed tasks older than 24 hours
    this.cleanupOldTasks();
  }
  
  /**
   * Process a new order message
   */
  public async processMessage(
    message: string, 
    clients: Client[], 
    products: ProductWithVariants[]
  ): Promise<string> {
    // Generate a unique ID for this processing task
    const taskId = uuidv4();
    
    // Initialize progress tracking
    const initialProgress: ProcessingProgress = {
      id: taskId,
      message,
      stage: 'not_started',
      progress: 0,
      status: 'pending',
      timestamp: Date.now()
    };
    
    this.processingTasks[taskId] = initialProgress;
    this.saveToStorage();
    this.notifyListeners(taskId);
    
    // Start processing in background
    this.processingLoop(taskId, message, clients, products)
      .catch(error => {
        console.error('Processing error:', error);
        this.updateProgress(taskId, {
          stage: 'failed',
          progress: 100,
          status: 'error',
          error: error.message || 'Unknown error occurred'
        });
      });
    
    return taskId;
  }
  
  /**
   * Main processing loop - runs in background
   */
  private async processingLoop(
    taskId: string,
    message: string,
    clients: Client[],
    products: ProductWithVariants[]
  ): Promise<void> {
    try {
      // Stage 1: Initial parsing
      this.updateProgress(taskId, {
        stage: 'parsing', 
        progress: 10,
        status: 'pending'
      });
      
      // Basic pattern matching
      const parsedItems = parseMessyOrderMessage(message);
      
      // Stage 2: Validate against database
      this.updateProgress(taskId, {
        stage: 'validating',
        progress: 40,
        status: 'pending'
      });
      
      // Match with clients and products
      const validatedItems = validateAndMatchOrders(parsedItems, clients, products);
      
      // Stage 3: AI enhancement (use Gemini if connected)
      this.updateProgress(taskId, {
        stage: 'ai_processing',
        progress: 70,
        status: 'pending'
      });
      
      // If we have Gemini connected, use it to improve analysis
      let enhancedItems = validatedItems;
      
      try {
        // Only use AI if we have some items already detected
        if (validatedItems.length > 0) {
          // Attempt to use Gemini to improve detection
          const aiContent = await geminiClient.generateContent(`
            Analiza este mensaje para un pedido de tienda: "${message}"
            
            Ya detecté estos posibles pedidos:
            ${validatedItems.map(item => 
              `- Cliente: ${item.clientName}, Producto: ${item.productName}, Cantidad: ${item.quantity}, Variante: ${item.variantDescription}`
            ).join('\n')}
            
            ¿Puedes ayudarme a mejorar esta detección? Por favor, solo dime si hay errores en la detección.
          `, { temperature: 0.2 });
          
          if (aiContent) {
            // Just store AI response for debugging purposes
            this.updateProgress(taskId, {
              raw: aiContent
            });
          }
        }
      } catch (aiError) {
        console.warn('AI enhancement failed, but continuing with basic detection:', aiError);
        // We can continue without AI enhancement
      }
      
      // Stage 4: Completed
      this.updateProgress(taskId, {
        stage: 'completed',
        progress: 100,
        status: 'success',
        result: enhancedItems
      });
      
    } catch (error) {
      console.error('Error in processing loop:', error);
      this.updateProgress(taskId, {
        stage: 'failed',
        progress: 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Get current progress for a task
   */
  public getTaskProgress(taskId: string): ProcessingProgress | null {
    return this.processingTasks[taskId] || null;
  }
  
  /**
   * Get all active processing tasks
   */
  public getAllTasks(): ProcessingProgress[] {
    return Object.values(this.processingTasks);
  }
  
  /**
   * Register a listener for progress updates
   */
  public addProgressListener(taskId: string, listener: ProgressListener): () => void {
    if (!this.listeners[taskId]) {
      this.listeners[taskId] = [];
    }
    
    this.listeners[taskId].push(listener);
    
    // Return cleanup function
    return () => {
      if (this.listeners[taskId]) {
        this.listeners[taskId] = this.listeners[taskId].filter(l => l !== listener);
      }
    };
  }
  
  /**
   * Update progress for a task
   */
  private updateProgress(taskId: string, update: Partial<ProcessingProgress>): void {
    if (this.processingTasks[taskId]) {
      this.processingTasks[taskId] = {
        ...this.processingTasks[taskId],
        ...update
      };
      
      this.saveToStorage();
      this.notifyListeners(taskId);
    }
  }
  
  /**
   * Notify all listeners for a task
   */
  private notifyListeners(taskId: string): void {
    const progress = this.processingTasks[taskId];
    if (progress && this.listeners[taskId]) {
      this.listeners[taskId].forEach(listener => {
        try {
          listener(progress);
        } catch (error) {
          console.error('Error in progress listener:', error);
        }
      });
    }
  }
  
  /**
   * Save processing state to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.processingTasks));
    } catch (error) {
      console.error('Error saving processing tasks to storage:', error);
    }
  }
  
  /**
   * Load processing state from localStorage
   */
  private loadFromStorage(): void {
    try {
      const storedData = localStorage.getItem(this.storageKey);
      if (storedData) {
        this.processingTasks = JSON.parse(storedData);
      }
    } catch (error) {
      console.error('Error loading processing tasks from storage:', error);
    }
  }
  
  /**
   * Clean up old completed tasks (older than 24 hours)
   */
  private cleanupOldTasks(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    let hasChanges = false;
    
    Object.entries(this.processingTasks).forEach(([taskId, task]) => {
      if (
        (task.stage === 'completed' || task.stage === 'failed') && 
        now - task.timestamp > oneDayMs
      ) {
        delete this.processingTasks[taskId];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.saveToStorage();
    }
  }
  
  /**
   * Sync pending tasks with backend when online
   */
  private async syncWithBackend(): Promise<void> {
    // Placeholder for future implementation
    // Could send pending tasks to Supabase when online
  }
}

// Export singleton instance
export const messageProcessor = new MessageProcessingService();
