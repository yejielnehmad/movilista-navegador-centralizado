
import { OrderItem } from "@/types/orders";
import { ProcessingProgress, ProcessingStage, ProgressListener, ProcessingTaskRecord } from "@/types/processingTypes";
import { parseMessyOrderMessage, validateAndMatchOrders, findSimilarClients, findSimilarProducts } from "@/utils/advancedOrderParser";
import { ProductWithVariants } from "@/services/productService";
import { Client } from "@/services/clientService";
import { geminiClient, GeminiConnectionStatus } from "@/services/gemini";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";

// Create a singleton class for message processing
class MessageProcessingService {
  private processingTasks: Record<string, ProcessingProgress> = {};
  private listeners: Record<string, ProgressListener[]> = {};
  private globalListeners: Set<ProgressListener> = new Set();
  private storageKey = 'ventascom_processing_tasks';
  private activeTaskId: string | null = null;
  private pendingApiCalls: Map<string, Promise<any>> = new Map();
  private isSyncingWithSupabase: boolean = false;
  
  constructor() {
    this.loadFromStorage();
    
    // Set up event listeners for background sync
    window.addEventListener('online', () => this.syncWithSupabase());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncWithSupabase();
      }
    });
    
    // Cleanup completed tasks older than 24 hours
    this.cleanupOldTasks();
    
    // Get the most recent active task if any
    this.resumeActiveTask();

    // Initial sync with Supabase
    this.syncWithSupabase();
  }
  
  /**
   * Process a new order message
   */
  public async processMessage(
    message: string, 
    clients: Client[], 
    products: ProductWithVariants[]
  ): Promise<string> {
    // Check if we already have a task for this exact message
    const existingTask = Object.values(this.processingTasks).find(task => 
      task.message === message && 
      (task.stage === 'completed' || task.stage === 'ai_processing')
    );

    if (existingTask) {
      console.log('Using existing task for message:', message);
      this.activeTaskId = existingTask.id;
      this.notifyListeners(existingTask.id);
      return existingTask.id;
    }
    
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
      timestamp: Date.now(),
      synced: false
    };
    
    this.processingTasks[taskId] = initialProgress;
    this.saveToStorage();
    this.notifyListeners(taskId);
    
    // Start processing in background, but avoid creating multiple overlapping API calls
    if (!this.pendingApiCalls.has(taskId)) {
      const processingPromise = this.processingLoop(taskId, message, clients, products)
        .catch(error => {
          console.error('Processing error:', error);
          this.updateProgress(taskId, {
            stage: 'failed',
            progress: 100,
            status: 'error',
            error: error.message || 'Unknown error occurred'
          });
        })
        .finally(() => {
          this.pendingApiCalls.delete(taskId);
        });
        
      this.pendingApiCalls.set(taskId, processingPromise);
    }
    
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
      
      // Save the basic matching results immediately so we have something to show
      this.updateProgress(taskId, {
        stage: 'ai_processing',
        progress: 70,
        status: 'pending',
        result: validatedItems
      });
      
      // Stage 4: AI enhancement (use Gemini if connected)
      let enhancedItems = validatedItems;
      
      try {
        // Only use AI if we have some items already detected and Gemini is available
        if (validatedItems.length > 0 && geminiClient.getConnectionStatus() === GeminiConnectionStatus.CONNECTED) {
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
            
            // In a real implementation, we'd parse the AI's response 
            // and update the items accordingly
            // For now, just use the validated items
          }
        } else {
          console.log('Skipping AI enhancement:', 
            validatedItems.length === 0 ? 'No valid items detected' : 'Gemini not connected');
        }
      } catch (aiError) {
        console.warn('AI enhancement failed, but continuing with basic detection:', aiError);
        // Continue with basic detection without AI enhancement
        // Don't mark the whole process as failed
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
      
      // Save to Supabase
      this.saveTaskToSupabase(this.processingTasks[taskId]);
      
    } catch (error) {
      console.error('Error in processing loop:', error);
      this.updateProgress(taskId, {
        stage: 'failed',
        progress: 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Save the error state to Supabase
      this.saveTaskToSupabase(this.processingTasks[taskId]);
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
    // Add to global listeners set
    this.globalListeners.add(listener);
    
    // Immediately notify with current active task if available
    if (this.activeTaskId && this.processingTasks[this.activeTaskId]) {
      try {
        listener(this.processingTasks[this.activeTaskId]);
      } catch (error) {
        console.error('Error in global progress listener:', error);
      }
    }
    
    // Return cleanup function
    return () => {
      this.globalListeners.delete(listener);
    };
  }
  
  /**
   * Update progress for a task
   */
  private updateProgress(taskId: string, update: Partial<ProcessingProgress>): void {
    if (this.processingTasks[taskId]) {
      this.processingTasks[taskId] = {
        ...this.processingTasks[taskId],
        ...update,
        synced: false // Mark as needing sync
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
    if (!progress) return;
    
    // Notify task-specific listeners
    if (this.listeners[taskId]) {
      this.listeners[taskId].forEach(listener => {
        try {
          listener(progress);
        } catch (error) {
          console.error('Error in task progress listener:', error);
        }
      });
    }
    
    // Notify global listeners
    this.globalListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        console.error('Error in global progress listener:', error);
      }
    });
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
   * Save a task to Supabase
   */
  private async saveTaskToSupabase(task: ProcessingProgress): Promise<void> {
    if (task.synced) return; // Skip if already synced

    try {
      // Use the RPC function to upsert a task
      const { data, error } = await supabase.rpc('upsert_processing_task', {
        p_id: task.id,
        p_message: task.message,
        p_stage: task.stage,
        p_progress: task.progress,
        p_status: task.status,
        p_error: task.error || null,
        p_result: task.result ? JSON.stringify(task.result) : null,
        p_raw_response: task.raw ? JSON.stringify(task.raw) : null
      });
      
      if (error) {
        console.error('Error saving task to Supabase:', error);
      } else {
        // Mark as synced in local storage
        this.processingTasks[task.id].synced = true;
        this.saveToStorage();
      }
    } catch (err) {
      console.error('Exception saving task to Supabase:', err);
    }
  }
  
  /**
   * Load tasks from Supabase
   */
  private async loadTasksFromSupabase(): Promise<void> {
    try {
      // Use the RPC function to get tasks
      const { data, error } = await supabase.rpc('get_processing_tasks', {
        limit_count: 20
      });
        
      if (error) {
        console.error('Error loading tasks from Supabase:', error);
        return;
      }
      
      if (!data || data.length === 0) return;
      
      // Convert to our internal format
      const loadedTasks: Record<string, ProcessingProgress> = {};
      
      data.forEach((record: any) => {
        loadedTasks[record.id] = {
          id: record.id,
          message: record.message,
          stage: record.stage as ProcessingStage,
          progress: record.progress,
          status: record.status as 'pending' | 'success' | 'error',
          error: record.error,
          result: record.result ? JSON.parse(record.result) : undefined,
          raw: record.raw_response ? JSON.parse(record.raw_response) : undefined,
          timestamp: new Date(record.created_at).getTime(),
          synced: true
        };
      });
      
      // Merge with local tasks, preferring newer data
      const mergedTasks: Record<string, ProcessingProgress> = { ...this.processingTasks };
      
      Object.entries(loadedTasks).forEach(([id, task]) => {
        // If we don't have this task locally, or the server version is newer
        if (!mergedTasks[id] || mergedTasks[id].timestamp < task.timestamp) {
          mergedTasks[id] = task;
        }
      });
      
      // Update our state
      this.processingTasks = mergedTasks;
      this.saveToStorage();
      
      // Update active task if needed
      if (this.activeTaskId && loadedTasks[this.activeTaskId]) {
        this.notifyListeners(this.activeTaskId);
      }
    } catch (err) {
      console.error('Exception loading tasks from Supabase:', err);
    }
  }
  
  /**
   * Sync with Supabase (push local changes, pull remote changes)
   */
  public async syncWithSupabase(): Promise<void> {
    if (this.isSyncingWithSupabase) return;
    this.isSyncingWithSupabase = true;
    
    try {
      // First check if the RPC functions exist
      const { data: functionExists, error: functionCheckError } = await supabase
        .rpc('check_processing_functions_exist');
        
      if (functionCheckError || !functionExists) {
        console.log('Processing task functions do not exist yet, skipping sync');
        return;
      }
      
      // First push any unsaved tasks
      const unsyncedTasks = Object.values(this.processingTasks).filter(task => !task.synced);
      
      if (unsyncedTasks.length > 0) {
        for (const task of unsyncedTasks) {
          await this.saveTaskToSupabase(task);
        }
      }
      
      // Then pull latest data
      await this.loadTasksFromSupabase();
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
    } finally {
      this.isSyncingWithSupabase = false;
    }
  }
}

// Export singleton instance
export const messageProcessor = new MessageProcessingService();
