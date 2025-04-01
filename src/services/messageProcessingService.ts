import { Gemini } from '@/services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { Client } from '@/types/clients';
import { Product } from '@/types/products';
import { OrderItem } from '@/types/orders';

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
  confianza: number;
  producto_id?: string;
  variante_id?: string;
}

interface AIAnalysis {
  cliente: string;
  items: AIItem[];
}

// Define types for task management
export type ProcessingStage =
  | 'parsing'
  | 'analyzing'
  | 'ai_processing'
  | 'validating'
  | 'grouping'
  | 'completed'
  | 'failed';

export type ProcessingStatus = 'idle' | 'success' | 'error';

export type ProcessingProgress = {
  id: string;
  message: string;
  stage: ProcessingStage;
  status: ProcessingStatus;
  progress: number;
  startTime: Date;
  endTime?: Date;
  result?: OrderItem[];
  error?: string;
};

export type ProgressListener = (progress: ProcessingProgress) => void;

// MessageProcessor class
class MessageProcessor {
  private gemini: Gemini;
  private tasks: Map<string, ProcessingProgress> = new Map();
  private globalListeners: ProgressListener[] = [];
  private taskListeners: Map<string, ProgressListener[]> = new Map();
  private supabaseClient: SupabaseClient<Database>;
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;

  constructor() {
    this.gemini = new Gemini();
    this.supabaseClient = supabase;
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

  // Creates a new processing task
  private createTask(message: string): ProcessingProgress {
    const taskId = uuidv4();
    const task: ProcessingProgress = {
      id: taskId,
      message: message,
      stage: 'parsing',
      status: 'idle',
      progress: 0,
      startTime: new Date(),
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
    task.status = status || task.status; // Only update status if provided
    task.endTime = status === 'success' || status === 'error' ? new Date() : undefined;
    task.result = result;
    task.error = error;

    this.tasks.set(taskId, task);
    this.persistTask(task); // Persist the updated task to Supabase
    this.notifyListeners(task); // Notify listeners of the update

    return task;
  }

  // Persists a task to Supabase
  private async persistTask(task: ProcessingProgress): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from('processing_tasks')
        .upsert({
          id: task.id,
          message: task.message,
          stage: task.stage,
          status: task.status,
          progress: task.progress,
          start_time: task.startTime.toISOString(),
          end_time: task.endTime?.toISOString(),
          result: task.result ? JSON.stringify(task.result) : null,
          error: task.error,
        });

      if (error) {
        console.error('Error persisting task to Supabase:', error);
      }
    } catch (err) {
      console.error('Error persisting task to Supabase:', err);
    }
  }

  // Retrieves all tasks from Supabase
  private async retrieveTasksFromSupabase(): Promise<ProcessingProgress[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('processing_tasks')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error retrieving tasks from Supabase:', error);
        return [];
      }

      const tasks: ProcessingProgress[] = data.map((task) => ({
        id: task.id,
        message: task.message,
        stage: task.stage as ProcessingStage,
        status: task.status as ProcessingStatus,
        progress: task.progress,
        startTime: new Date(task.start_time),
        endTime: task.end_time ? new Date(task.end_time) : undefined,
        result: task.result ? JSON.parse(task.result) : undefined,
        error: task.error,
      }));

      return tasks;
    } catch (err) {
      console.error('Error retrieving tasks from Supabase:', err);
      return [];
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
      const supabaseTasks = await this.retrieveTasksFromSupabase();

      // Clear local tasks
      this.tasks.clear();

      // Load tasks from Supabase into local storage
      supabaseTasks.forEach((task) => {
        this.tasks.set(task.id, task);
      });

      console.log(`Successfully synced ${supabaseTasks.length} tasks from Supabase.`);
      this.lastSyncTime = new Date();
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
    } finally {
      this.isSyncing = false;
      console.log('Sync completed.');
    }
  }

  // Processes a message
  async processMessage(message: string, clients: Client[], products: Product[]): Promise<string> {
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
      const aiResponse = await this.gemini.generateContent(
        `Extrae el cliente y los productos con cantidad del siguiente pedido: ${message}. 
         El formato de respuesta debe ser JSON y seguir este ejemplo:
         \`\`\`json
         {
           "cliente": "Nombre del cliente",
           "items": [
             {
               "producto": "Nombre del producto",
               "variante": "Descripción de la variante si existe",
               "cantidad": Cantidad solicitada,
               "confianza": Nivel de confianza en la extracción (0-1)
             }
           ]
         }
         \`\`\``
      );

      if (!aiResponse) {
        throw new Error('AI response is null');
      }

      // Parse AI response
      let analysis: AIAnalysis;
      try {
        analysis = JSON.parse(aiResponse) as AIAnalysis;
        this.updateTaskProgress(taskId, 'ai_processing', 60);
      } catch (error) {
        console.error('Error parsing AI response:', error);
        throw new Error('Failed to parse AI response');
      }

      // Validate AI response
      this.updateTaskProgress(taskId, 'validating', 70);
      if (!analysis || !analysis.cliente || !analysis.items) {
        throw new Error('Invalid AI response format');
      }

      // Simulate grouping stage
      this.updateTaskProgress(taskId, 'grouping', 80);

      // Map AI response to order items
      const pedido = analysis;
      const clientMatch = clients.find((c) =>
        c.name.toLowerCase().includes(pedido.cliente.toLowerCase())
      );

      const aiProcessedItems: OrderItem[] = [];

                  (pedido.items || []).forEach((item) => {
                    // Type assertion to prevent TypeScript errors
                    const typedItem = item as AIItem;
                    
                    // Find matching product with proper type handling
                    const productMatch = products.find(p => 
                      p.id === typedItem.producto_id
                    ) || products.find(p => 
                      p.name.toLowerCase() === typedItem.producto.toLowerCase()
                    );
                    
                    // Find variant match with proper type handling
                    let variantMatch = null;
                    if (productMatch && typedItem.variante_id) {
                      variantMatch = productMatch.variants.find(v => v.id === typedItem.variante_id);
                    } else if (productMatch && typedItem.variante) {
                      variantMatch = productMatch.variants.find(v =>
                        v.name.toLowerCase() === typedItem.variante.toLowerCase()
                      );
                    }
                    
                    // Create enhanced order item
                    aiProcessedItems.push({
                      clientName: pedido.cliente,
                      productName: typedItem.producto,
                      variantDescription: typedItem.variante || "",
                      quantity: typedItem.cantidad,
                      clientMatch: clientMatch || null,
                      productMatch: productMatch || null,
                      variantMatch: variantMatch || null,
                      status: this.getItemStatus(typedItem.confianza, !!clientMatch, !!productMatch),
                      issues: []
                    });
                  });

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
    confidence: number,
    hasClientMatch: boolean,
    hasProductMatch: boolean
  ): 'pending' | 'confirmed' | 'unconfirmed' {
    if (confidence > 0.8 && hasClientMatch && hasProductMatch) {
      return 'confirmed';
    } else if (confidence > 0.5) {
      return 'pending';
    } else {
      return 'unconfirmed';
    }
  }

  // Gets all tasks
  getAllTasks(): ProcessingProgress[] {
    return Array.from(this.tasks.values());
  }

  // Gets a task's progress
  getTaskProgress(taskId: string): ProcessingProgress | null {
    return this.tasks.get(taskId) || null;
  }
  
  // Finds a task by message
  findTaskByMessage(message: string): ProcessingProgress | null {
    for (const task of this.tasks.values()) {
      if (task.message === message) {
        return task;
      }
    }
    return null;
  }

  // Gets the active task (most recent)
  getActiveTask(): ProcessingProgress | null {
    const tasks = Array.from(this.tasks.values());
    if (tasks.length === 0) {
      return null;
    }
    
    // Sort tasks by start time in descending order
    tasks.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    return tasks[0];
  }

  // Gets the sync status
  getSyncStatus(): { isSyncing: boolean; lastSyncTime: Date | null } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
    };
  }
}

export const messageProcessor = new MessageProcessor();
