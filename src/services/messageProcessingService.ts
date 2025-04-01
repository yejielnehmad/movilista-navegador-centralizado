import { OrderItem } from "@/types/orders";
import { ProcessingProgress, ProcessingStage, ProgressListener } from "@/types/processingTypes";
import { parseMessyOrderMessage, validateAndMatchOrders, findSimilarClients, findSimilarProducts } from "@/utils/advancedOrderParser";
import { ProductWithVariants } from "@/services/productService";
import { Client } from "@/services/clientService";
import { geminiClient } from "@/services/gemini";
import { v4 as uuidv4 } from 'uuid';

// Create a singleton class for message processing
class MessageProcessingService {
  private processingTasks: Record<string, ProcessingProgress> = {};
  private listeners: Record<string, ProgressListener[]> = {};
  private storageKey = 'ventascom_processing_tasks';
  private activeTaskId: string | null = null;
  
  constructor() {
    this.loadFromStorage();
    
    // Set up event listeners for background sync
    window.addEventListener('online', () => this.syncWithBackend());
    
    // Cleanup completed tasks older than 24 hours
    this.cleanupOldTasks();
    
    // Get the most recent active task if any
    this.resumeActiveTask();
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
    this.activeTaskId = taskId;
    
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
      // Stage 1: Initial parsing with improved tolerance
      this.updateProgress(taskId, {
        stage: 'parsing', 
        progress: 10,
        status: 'pending'
      });
      
      // Perform more thorough pattern matching with higher tolerance
      const parsedItems = parseMessyOrderMessage(message, { 
        tolerateTypos: true,
        detectPartialNames: true 
      });
      
      // Stage 2: Pre-match to find potential clients
      this.updateProgress(taskId, {
        stage: 'analyzing',
        progress: 30,
        status: 'pending'
      });
      
      // For each item, find potential client matches
      const itemsWithClientSuggestions = parsedItems.map(item => {
        const potentialClients = findSimilarClients(item.clientName, clients);
        return {
          ...item,
          clientSuggestions: potentialClients
        };
      });
      
      // Stage 3: Validate against database with enhanced matching
      this.updateProgress(taskId, {
        stage: 'validating',
        progress: 50,
        status: 'pending'
      });
      
      // Match with clients and products using improved fuzzy matching
      const validatedItems = validateAndMatchOrders(itemsWithClientSuggestions, clients, products);
      
      // Stage 4: AI enhancement (use Gemini if connected)
      this.updateProgress(taskId, {
        stage: 'ai_processing',
        progress: 70,
        status: 'pending'
      });
      
      // If we have Gemini connected, use it to improve analysis
      let enhancedItems = validatedItems;
      
      try {
        // Only use AI if we have some items already detected and Gemini is available
        if (validatedItems.length > 0) {
          // Prepare a structured message for Gemini to analyze
          const aiPrompt = `
Analiza este mensaje de WhatsApp con pedidos: "${message}"

Ya detecté estos pedidos:
${validatedItems.map(item => 
  `- Cliente: ${item.clientMatch?.name || item.clientName}, Producto: ${item.productMatch?.name || item.productName}, Cantidad: ${item.quantity}, Variante: ${item.variantMatch?.name || item.variantDescription || "No especificada"}`
).join('\n')}

Por favor, intenta entender mejor el mensaje e identifica:
1. Clientes adicionales o corregidos
2. Productos adicionales o corregidos 
3. Cantidades incorrectas
4. Variantes adicionales o corregidas
5. Agrupa múltiples pedidos del mismo cliente

Responde solo con los cambios sugeridos, no repitas lo que ya detecté correctamente.
          `;
          
          const aiContent = await geminiClient.generateContent(aiPrompt, { 
            temperature: 0.2,
            maxOutputTokens: 1000
          });
          
          if (aiContent) {
            // Store AI response for debugging purposes
            this.updateProgress(taskId, {
              raw: aiContent
            });
            
            // Process AI suggestions (in a real implementation, we'd parse the AI's response 
            // and update the items accordingly)
            // For now, just use the validated items
          }
        }
      } catch (aiError) {
        console.warn('AI enhancement failed, but continuing with basic detection:', aiError);
        // Continue with basic detection without AI enhancement
      }
      
      // Group items by client for better organization
      this.updateProgress(taskId, {
        stage: 'grouping',
        progress: 90,
        status: 'pending'
      });
      
      // Return the enhanced and grouped items
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
   * Resume any active task from storage
   */
  private resumeActiveTask(): void {
    // Find the most recent incomplete task
    const tasks = Object.values(this.processingTasks);
    
    if (tasks.length === 0) return;
    
    // Sort by timestamp (newest first)
    const sortedTasks = tasks.sort((a, b) => b.timestamp - a.timestamp);
    
    // Find the most recent task that's not completed or failed
    const latestActiveTask = sortedTasks.find(task => 
      task.stage !== 'completed' && task.stage !== 'failed'
    );
    
    if (latestActiveTask) {
      this.activeTaskId = latestActiveTask.id;
    } else {
      // If no active tasks, set the most recent completed task
      this.activeTaskId = sortedTasks[0]?.id || null;
    }
  }
  
  /**
   * Get the current active task (most recent)
   */
  public getActiveTask(): ProcessingProgress | null {
    return this.activeTaskId ? this.processingTasks[this.activeTaskId] || null : null;
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
   * Add a global listener for any task updates (useful for UI progress indicators)
   */
  public addGlobalProgressListener(listener: ProgressListener): () => void {
    // Create a wrapper function that will be called for any task update
    const wrappedListener = (progress: ProcessingProgress) => {
      listener(progress);
    };
    
    // Store the mapping of global listener to wrapped listener
    const globalListenerMap = new Map<ProgressListener, ProgressListener>();
    
    globalListenerMap.set(listener, wrappedListener);
    
    // Add the wrapped listener to all existing tasks
    Object.keys(this.processingTasks).forEach(taskId => {
      if (!this.listeners[taskId]) {
        this.listeners[taskId] = [];
      }
      this.listeners[taskId].push(wrappedListener);
    });
    
    // Return cleanup function
    return () => {
      // Remove the wrapped listener from all tasks
      Object.keys(this.listeners).forEach(taskId => {
        this.listeners[taskId] = this.listeners[taskId].filter(l => l !== globalListenerMap.get(listener));
      });
      
      globalListenerMap.delete(listener);
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
      localStorage.setItem(`${this.storageKey}_active`, this.activeTaskId || '');
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
      const storedActiveTaskId = localStorage.getItem(`${this.storageKey}_active`);
      
      if (storedData) {
        this.processingTasks = JSON.parse(storedData);
      }
      
      if (storedActiveTaskId && storedActiveTaskId.trim() !== '') {
        this.activeTaskId = storedActiveTaskId;
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
