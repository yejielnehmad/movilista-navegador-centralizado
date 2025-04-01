import { geminiClient, GeminiConnectionStatus } from '@/services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { OrderItem } from '@/types/orders';
import { Client } from '@/types/orders';
import { ProductWithVariants, ProductVariant } from '@/services/productService';
import { 
  ProcessingProgress, 
  ProcessingStage, 
  ProcessingStatus, 
  ProgressListener 
} from '@/types/processingTypes';

/* Message Processing Service
 *
 * This service is responsible for processing messages and extracting order information.
 * It uses Gemini AI to analyze the message and extract relevant information.
 * It also manages a queue of messages to be processed and persists the results to Supabase.
 */

// Define types for AI processing
interface AIItem {
  producto: string;
  variante?: string;
  cantidad: number;
  confianza: string;
  producto_id?: string;
  variante_id?: string;
}

interface AIPedido {
  cliente: string;
  cliente_id?: string;
  items: AIItem[];
}

interface AIResponse {
  pedidos: AIPedido[];
}

// MessageProcessor class
class MessageProcessor {
  private tasks: Map<string, ProcessingProgress> = new Map();
  private globalListeners: ProgressListener[] = [];
  private taskListeners: Map<string, ProgressListener[]> = new Map();
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;

  constructor() {
    this.loadFromStorage();
  }

  // Adds a global progress listener
  addGlobalProgressListener(listener: ProgressListener): () => void {
    this.globalListeners.push(listener);
    return () => {
      this.globalListeners = this.globalListeners.filter((l) => l !== listener);
    };
  }

  // Adds a progress listener for a specific task
  addProgressListener(taskId: string, listener: ProgressListener): () => void {
    if (!this.taskListeners.has(taskId)) {
      this.taskListeners.set(taskId, []);
    }
    const listeners = this.taskListeners.get(taskId)!;
    listeners.push(listener);

    return () => {
      const updatedListeners = listeners.filter((l) => l !== listener);
      this.taskListeners.set(taskId, updatedListeners);
    };
  }

  // Notifies all listeners of a progress update
  private notifyListeners(progress: ProcessingProgress) {
    this.globalListeners.forEach((listener) => listener(progress));

    const taskListeners = this.taskListeners.get(progress.id);
    if (taskListeners) {
      taskListeners.forEach((listener) => listener(progress));
    }
  }

  // Finds a task by exact message
  public findTaskByMessage(message: string): ProcessingProgress | null {
    const normalizedMessage = message.trim();
    
    for (const task of this.tasks.values()) {
      if (task.message.trim() === normalizedMessage) {
        return task;
      }
    }
    
    return null;
  }

  // Creates a new processing task
  private createTask(message: string): ProcessingProgress {
    const taskId = uuidv4();
    const task: ProcessingProgress = {
      id: taskId,
      message: message,
      stage: 'parsing',
      status: 'processing',
      progress: 0,
      timestamp: Date.now(),
    };
    this.tasks.set(taskId, task);
    this.persistTask(task); // Persist the task to Supabase
    return task;
  }

  // Updates the progress of a task
  private updateTaskProgress(
    taskId: string,
    stage: ProcessingStage,
    progress: number,
    status?: ProcessingStatus,
    result?: OrderItem[],
    error?: string
  ): ProcessingProgress {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    task.stage = stage;
    task.progress = progress;
    if (status) task.status = status;
    if (result) task.result = result;
    if (error) task.error = error;
    
    this.tasks.set(taskId, task);
    this.persistTask(task); // Persist the updated task to Supabase
    this.notifyListeners(task); // Notify listeners of the update

    return task;
  }

  // Persists a task to Supabase
  private async persistTask(task: ProcessingProgress): Promise<void> {
    try {
      const { error } = await supabase
        .from('processing_tasks')
        .upsert({
          id: task.id,
          message: task.message,
          stage: task.stage,
          status: task.status,
          progress: task.progress,
          result: task.result ? JSON.stringify(task.result) : null,
          error: task.error || null,
        });

      if (error) {
        console.error('Error persisting task to Supabase:', error);
      }
    } catch (err) {
      console.error('Error persisting task to Supabase:', err);
    }
  }

  // Processes a message
  async processMessage(message: string, clients: Client[], products: ProductWithVariants[]): Promise<string> {
    const task = this.createTask(message);
    const taskId = task.id;

    console.log(`Processing message: ${message.substring(0, 50)}... (Task ID: ${taskId})`);

    try {
      // Simulate parsing stage
      this.updateTaskProgress(taskId, 'parsing', 10);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate analyzing stage
      this.updateTaskProgress(taskId, 'analyzing', 25);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Process message with Gemini AI
      this.updateTaskProgress(taskId, 'ai_processing', 40);
      const aiResponse = await geminiClient.generateContent(
        `Extrae el cliente y los productos con cantidad del siguiente pedido: ${message}. 
         El formato de respuesta debe ser JSON y seguir este ejemplo:
         \`\`\`json
         {
           "pedidos": [
             {
               "cliente": "Nombre del cliente",
               "cliente_id": "ID del cliente si existe",
               "items": [
                 {
                   "producto": "Nombre del producto",
                   "producto_id": "ID del producto si existe",
                   "variante": "Descripción de la variante si existe",
                   "variante_id": "ID de la variante si existe",
                   "cantidad": 5,
                   "confianza": "alta"
                 }
               ]
             }
           ]
         }
         \`\`\``
      );

      if (!aiResponse) {
        throw new Error('AI response is null');
      }

      // Parse AI response
      let aiResult: AIResponse;
      try {
        // Clean the response before parsing
        let cleanedResponse = aiResponse.trim();
        
        // If the response is wrapped in backticks, remove them
        if (cleanedResponse.startsWith("```json")) {
          cleanedResponse = cleanedResponse.substring(7);
        }
        if (cleanedResponse.endsWith("```")) {
          cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
        }
        
        cleanedResponse = cleanedResponse.trim();
        
        aiResult = JSON.parse(cleanedResponse) as AIResponse;
        this.updateTaskProgress(taskId, 'ai_processing', 60);
      } catch (error) {
        console.error('Error parsing AI response:', error);
        throw new Error('Failed to parse AI response');
      }

      // Validate AI response
      this.updateTaskProgress(taskId, 'validating', 70);
      if (!aiResult || !aiResult.pedidos || !Array.isArray(aiResult.pedidos)) {
        throw new Error('Invalid AI response format');
      }

      // Simulate grouping stage
      this.updateTaskProgress(taskId, 'grouping', 80);

      // Map AI response to order items
      const aiProcessedItems: OrderItem[] = [];
      
      for (const pedido of aiResult.pedidos) {
        // Find matching client
        const clientMatch = clients.find((c) =>
          (pedido.cliente_id && c.id === pedido.cliente_id) || 
          c.name.toLowerCase().includes(pedido.cliente.toLowerCase())
        );

        for (const item of pedido.items) {
          // Find matching product
          const productMatch = products.find(p => 
            (item.producto_id && p.id === item.producto_id) || 
            p.name.toLowerCase() === item.producto.toLowerCase()
          );
          
          // Find variant match
          let variantMatch: ProductVariant | null = null;
          if (productMatch) {
            if (item.variante_id) {
              variantMatch = productMatch.variants.find(v => v.id === item.variante_id) || null;
            } else if (item.variante) {
              variantMatch = productMatch.variants.find(v =>
                v.name.toLowerCase() === item.variante?.toLowerCase()
              ) || null;
            }
          }
          
          // Create enhanced order item
          aiProcessedItems.push({
            clientName: pedido.cliente,
            productName: item.producto,
            variantDescription: item.variante || "",
            quantity: item.cantidad,
            clientMatch: clientMatch || null,
            productMatch: productMatch || null,
            variantMatch: variantMatch || null,
            status: this.getItemStatus(item.confianza, !!clientMatch, !!productMatch),
            issues: []
          });
        }
      }

      // Update task progress to completed
      this.updateTaskProgress(taskId, 'completed', 100, 'success', aiProcessedItems);
      console.log(`Message processed successfully. (Task ID: ${taskId})`);
      return taskId;
    } catch (error: any) {
      // Update task progress to failed
      this.updateTaskProgress(taskId, 'failed', 100, 'error', undefined, error.message);
      console.error(`Error processing message: ${error}`);
      return taskId;
    }
  }

  // Get item status based on confidence and matches
  private getItemStatus(
    confidence: string | undefined,
    hasClientMatch: boolean,
    hasProductMatch: boolean
  ): 'valid' | 'warning' | 'error' {
    if (!hasClientMatch || !hasProductMatch) {
      return 'error';
    }
    
    if (confidence === 'baja') {
      return 'warning';
    }
    
    return 'valid';
  }

  // Gets all tasks
  getAllTasks(): ProcessingProgress[] {
    return Array.from(this.tasks.values());
  }

  // Gets a task's progress
  getTaskProgress(taskId: string): ProcessingProgress | null {
    return this.tasks.get(taskId) || null;
  }

  // Gets the active task (most recent)
  getActiveTask(): ProcessingProgress | null {
    const tasks = Array.from(this.tasks.values());
    if (tasks.length === 0) {
      return null;
    }
    
    // Sort tasks by timestamp in descending order
    tasks.sort((a, b) => b.timestamp - a.timestamp);
    
    return tasks[0];
  }

  // Save processing state to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem('ventascom_processing_tasks', JSON.stringify(Array.from(this.tasks.entries())));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // Load processing state from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('ventascom_processing_tasks');
      if (stored) {
        const entries = JSON.parse(stored) as [string, ProcessingProgress][];
        this.tasks = new Map(entries);
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }

  // Syncs tasks with Supabase
  async syncWithSupabase(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    console.log('Starting sync with Supabase...');

    try {
      // Retrieve tasks from Supabase
      const { data, error } = await supabase
        .from('processing_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error retrieving tasks from Supabase:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('No tasks found in Supabase');
        return;
      }

      // Convert database records to ProcessingProgress objects
      for (const record of data) {
        try {
          const task: ProcessingProgress = {
            id: record.id,
            message: record.message,
            stage: record.stage as ProcessingStage,
            status: record.status as ProcessingStatus,
            progress: record.progress,
            timestamp: new Date(record.created_at).getTime(),
            error: record.error,
            result: record.result ? JSON.parse(record.result) : undefined,
            synced: true
          };

          // Only update local task if it doesn't exist or is older
          const existingTask = this.tasks.get(task.id);
          if (!existingTask || existingTask.timestamp < task.timestamp) {
            this.tasks.set(task.id, task);
          }
        } catch (parseError) {
          console.error('Error parsing task from Supabase:', parseError);
        }
      }

      this.saveToStorage();
      this.lastSyncTime = new Date();
      console.log(`Successfully synced ${data.length} tasks from Supabase.`);
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const messageProcessor = new MessageProcessor();
