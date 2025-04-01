import { OrderItem } from "@/types/orders";
import { ProcessingProgress, ProcessingStage, ProgressListener, ProcessingTaskRecord } from "@/types/processingTypes";
import { parseMessyOrderMessage, validateAndMatchOrders, findSimilarClients, findSimilarProducts } from "@/utils/advancedOrderParser";
import { ProductWithVariants } from "@/services/productService";
import { Client } from "@/services/clientService";
import { geminiClient, GeminiConnectionStatus } from "@/services/gemini";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { toast } from "sonner";

// Define interfaces for the AI response structure
interface AIItem {
  producto: string;
  producto_id: string;
  cantidad: number;
  variante?: string;
  variante_id?: string;
  confianza?: string;
}

interface AIPedido {
  cliente: string;
  cliente_id: string;
  items: AIItem[];
}

interface AIResponse {
  pedidos: AIPedido[];
}

// Create a singleton class for message processing
class MessageProcessingService {
  private processingTasks: Record<string, ProcessingProgress> = {};
  private listeners: Record<string, ProgressListener[]> = {};
  private globalListeners: Set<ProgressListener> = new Set();
  private storageKey = 'ventascom_processing_tasks';
  private activeTaskId: string | null = null;
  private pendingApiCalls: Map<string, Promise<any>> = new Map();
  private isSyncingWithSupabase: boolean = false;
  private messageToTaskIdMap: Map<string, string> = new Map();
  
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

    // Build message to task ID map for quick lookups
    this.buildMessageToTaskIdMap();
    
    // Initial sync with Supabase
    this.syncWithSupabase();
  }
  
  /**
   * Build a map of messages to task IDs for quick lookups
   */
  private buildMessageToTaskIdMap(): void {
    this.messageToTaskIdMap.clear();
    
    Object.values(this.processingTasks).forEach(task => {
      const normalizedMessage = task.message.trim();
      this.messageToTaskIdMap.set(normalizedMessage, task.id);
    });
  }
  
  /**
   * Find an existing task by message content
   */
  public findTaskByMessage(message: string): ProcessingProgress | null {
    const normalizedMessage = message.trim();
    const taskId = this.messageToTaskIdMap.get(normalizedMessage);
    
    if (taskId && this.processingTasks[taskId]) {
      return this.processingTasks[taskId];
    }
    
    return Object.values(this.processingTasks).find(task => 
      task.message.trim() === normalizedMessage
    ) || null;
  }
  
  /**
   * Process a new order message
   */
  public async processMessage(
    message: string, 
    clients: Client[], 
    products: ProductWithVariants[]
  ): Promise<string> {
    const existingTask = this.findTaskByMessage(message);

    if (existingTask) {
      console.log('Using existing task for message:', message.substring(0, 50) + '...');
      this.activeTaskId = existingTask.id;
      this.notifyListeners(existingTask.id);
      
      if (existingTask.stage !== 'completed' && existingTask.stage !== 'failed') {
        return existingTask.id;
      }
      
      if (existingTask.stage === 'completed') {
        console.log('Using existing completed task without reprocessing');
        return existingTask.id;
      }
    }
    
    const taskId = uuidv4();
    this.activeTaskId = taskId;
    
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
    this.messageToTaskIdMap.set(message.trim(), taskId);
    this.saveToStorage();
    this.notifyListeners(taskId);
    
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
      this.updateProgress(taskId, {
        stage: 'parsing', 
        progress: 10,
        status: 'pending'
      });
      
      const parsedItems = parseMessyOrderMessage(message, { 
        tolerateTypos: true,
        detectPartialNames: true 
      });
      
      this.updateProgress(taskId, {
        stage: 'analyzing',
        progress: 30,
        status: 'pending'
      });
      
      const itemsWithClientSuggestions = parsedItems.map(item => {
        const potentialClients = findSimilarClients(item.clientName, clients);
        return {
          ...item,
          clientSuggestions: potentialClients
        };
      });
      
      this.updateProgress(taskId, {
        stage: 'validating',
        progress: 50,
        status: 'pending'
      });
      
      const validatedItems = validateAndMatchOrders(itemsWithClientSuggestions, clients, products);
      
      this.updateProgress(taskId, {
        stage: 'ai_processing',
        progress: 70,
        status: 'pending',
        result: validatedItems
      });
      
      let enhancedItems = validatedItems;
      
      try {
        if (validatedItems.length > 0 && geminiClient.getConnectionStatus() === GeminiConnectionStatus.CONNECTED) {
          const clientContext = clients.map(client => 
            `${client.name} (ID: ${client.id})`
          ).join(', ');
          
          const productContext = products.map(product => {
            const variants = product.variants.map(v => 
              `${v.name} (ID: ${v.id})`
            ).join(', ');
            
            return `${product.name} (ID: ${product.id}) - Variantes: ${variants || "ninguna"}`;
          }).join('\n');
          
          const aiPrompt = `
Eres un asistente especializado en procesar pedidos de tiendas. Analiza este mensaje de WhatsApp y detecta TODOS los pedidos para DIFERENTES clientes:

"${message}"

CONTEXTO DE LA APLICACIÓN:
=========================
La aplicación tiene los siguientes clientes registrados:
${clientContext}

Y los siguientes productos disponibles:
${productContext}

PEDIDOS YA DETECTADOS:
====================
${validatedItems.map(item => 
  `- Cliente: ${item.clientMatch?.name || item.clientName} (ID: ${item.clientMatch?.id || "no encontrado"}), Producto: ${item.productMatch?.name || item.productName} (ID: ${item.productMatch?.id || "no encontrado"}), Cantidad: ${item.quantity}, Variante: ${item.variantMatch?.name || item.variantDescription || "No especificada"} (ID: ${item.variantMatch?.id || "no encontrada"})`
).join('\n')}

INSTRUCCIONES:
==============
1. IMPORTANTE: Identifica TODOS los clientes diferentes mencionados en el mensaje
2. Agrupa múltiples productos pedidos por el mismo cliente
3. Corrige nombres de clientes mal escritos o con typos, usando la lista de clientes disponibles
4. Identifica productos mencionados que coincidan con los productos disponibles
5. Detecta variantes de productos mencionadas o sugeridas en el contexto
6. Infiere cantidades precisas y unidades de medida

FORMATO DE RESPUESTA:
====================
Responde en formato JSON con este esquema EXACTO:
{
  "pedidos": [
    {
      "cliente": "nombre_corregido",
      "cliente_id": "id_del_cliente", 
      "items": [
        {
          "producto": "nombre_del_producto",
          "producto_id": "id_del_producto",
          "cantidad": número,
          "variante": "nombre_de_variante",
          "variante_id": "id_de_variante",
          "confianza": "alta|media|baja"
        }
      ]
    }
  ]
}

IMPORTANTE: 
1. Cada cliente debe tener su propio objeto en el array "pedidos"
2. Asegúrate de identificar TODOS los clientes mencionados en el mensaje
3. Responde SOLO con el JSON, sin texto introductorio ni conclusión
          `;
          
          const aiContent = await geminiClient.generateContent(aiPrompt, { 
            temperature: 0.2,
            maxOutputTokens: 1000
          });
          
          if (aiContent) {
            this.updateProgress(taskId, {
              raw: aiContent
            });
            
            try {
              let cleanedResponse = aiContent.trim();
              
              if (cleanedResponse.startsWith("```json")) {
                cleanedResponse = cleanedResponse.substring(7);
              }
              if (cleanedResponse.endsWith("```")) {
                cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
              }
              
              cleanedResponse = cleanedResponse.trim();
              
              const aiResponse = JSON.parse(cleanedResponse) as AIResponse;
              
              if (aiResponse.pedidos && Array.isArray(aiResponse.pedidos)) {
                const aiProcessedItems: OrderItem[] = [];
                
                aiResponse.pedidos.forEach((pedido) => {
                  const clientMatch = clients.find(c => 
                    c.id === pedido.cliente_id
                  ) || clients.find(c => 
                    c.name.toLowerCase() === pedido.cliente.toLowerCase()
                  );
                  
                  (pedido.items || []).forEach((item) => {
                    const productMatch = products.find(p => 
                      p.id === item.producto_id
                    ) || products.find(p => 
                      p.name.toLowerCase() === item.producto.toLowerCase()
                    );
                    
                    let variantMatch = null;
                    if (productMatch) {
                      if (item.variante_id) {
                        variantMatch = productMatch.variants.find(v => v.id === item.variante_id);
                      } else if (item.variante) {
                        variantMatch = productMatch.variants.find(v =>
                          v.name.toLowerCase() === item.variante!.toLowerCase()
                        );
                      }
                    }
                    
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
                  });
                });
                
                if (aiProcessedItems.length > 0) {
                  enhancedItems = aiProcessedItems;
                }
              }
            } catch (parseError) {
              console.warn('Error parsing AI response:', parseError);
            }
          }
        } else {
          console.log('Skipping AI enhancement:', 
            validatedItems.length === 0 ? 'No valid items detected' : 'Gemini not connected');
        }
      } catch (aiError) {
        console.warn('AI enhancement failed, but continuing with basic detection:', aiError);
      }
      
      this.updateProgress(taskId, {
        stage: 'grouping',
        progress: 90,
        status: 'pending'
      });
      
      this.updateProgress(taskId, {
        stage: 'completed',
        progress: 100,
        status: 'success',
        result: enhancedItems
      });
      
      this.saveTaskToSupabase(this.processingTasks[taskId])
        .catch(error => console.error('Error saving completed task to Supabase:', error));
      
    } catch (error) {
      console.error('Error in processing loop:', error);
      this.updateProgress(taskId, {
        stage: 'failed',
        progress: 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      this.saveTaskToSupabase(this.processingTasks[taskId])
        .catch(error => console.error('Error saving failed task to Supabase:', error));
    }
  }
  
  /**
   * Determine item status based on confidence and matches
   */
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
  
  /**
   * Resume any active task from storage
   */
  private resumeActiveTask(): void {
    const tasks = Object.values(this.processingTasks);
    
    if (tasks.length === 0) return;
    
    const sortedTasks = tasks.sort((a, b) => b.timestamp - a.timestamp);
    
    const latestActiveTask = sortedTasks.find(task => 
      task.stage !== 'completed' && task.stage !== 'failed'
    );
    
    if (latestActiveTask) {
      this.activeTaskId = latestActiveTask.id;
    } else {
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
    this.globalListeners.add(listener);
    
    if (this.activeTaskId && this.processingTasks[this.activeTaskId]) {
      try {
        listener(this.processingTasks[this.activeTaskId]);
      } catch (error) {
        console.error('Error in global progress listener:', error);
      }
    }
    
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
        synced: false
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
    
    if (this.listeners[taskId]) {
      this.listeners[taskId].forEach(listener => {
        try {
          listener(progress);
        } catch (error) {
          console.error('Error in task progress listener:', error);
        }
      });
    }
    
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
      this.buildMessageToTaskIdMap();
      this.saveToStorage();
    }
  }
  
  /**
   * Save a task to Supabase
   */
  private async saveTaskToSupabase(task: ProcessingProgress): Promise<void> {
    if (task.synced) return;
    
    try {
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
        this.processingTasks[task.id].synced = true;
        this.saveToStorage();
        console.log('Task saved to Supabase:', task.id);
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
      const { data: functionExists, error: functionCheckError } = await supabase
        .rpc('check_processing_functions_exist');
        
      if (functionCheckError || functionExists === null) {
        console.warn('Processing task functions do not exist yet, skipping sync');
        return;
      }
      
      const { data, error } = await supabase.rpc('get_processing_tasks', {
        limit_count: 20
      });
        
      if (error || !data) {
        console.error('Error loading tasks from Supabase:', error);
        return;
      }
      
      if (!Array.isArray(data) || data.length === 0) return;
      
      const loadedTasks: Record<string, ProcessingProgress> = {};
      
      data.forEach((record: any) => {
        if (!record) return;
        
        try {
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
        } catch (parseError) {
          console.error('Error parsing task from Supabase:', parseError);
        }
      });
      
      const mergedTasks: Record<string, ProcessingProgress> = { ...this.processingTasks };
      
      Object.entries(loadedTasks).forEach(([id, task]) => {
        if (!mergedTasks[id] || mergedTasks[id].timestamp < task.timestamp) {
          mergedTasks[id] = task;
        }
      });
      
      this.processingTasks = mergedTasks;
      this.buildMessageToTaskIdMap();
      this.saveToStorage();
      
      if (this.activeTaskId && loadedTasks[this.activeTaskId]) {
        this.notifyListeners(this.activeTaskId);
      }
      
      console.log(`Loaded ${Object.keys(loadedTasks).length} tasks from Supabase`);
    } catch (err) {
      console.error('Exception loading tasks from Supabase:', err);
    }
  }
  
  /**
   * Sync with Supabase (push local changes, pull remote changes)
   */
  public async syncWithSupabase(): Promise<void> {
    if (this.isSyncingWithSupabase) {
      console.log('Sync with Supabase already in progress, skipping');
      return;
    }
    
    this.isSyncingWithSupabase = true;
    
    try {
      const { data: functionExists, error: functionCheckError } = await supabase
        .rpc('check_processing_functions_exist');
        
      if (functionCheckError || functionExists === null) {
        console.log('Processing task functions do not exist yet, skipping sync');
        this.isSyncingWithSupabase = false;
        return;
      }
      
      const unsyncedTasks = Object.values(this.processingTasks).filter(task => !task.synced);
      
      if (unsyncedTasks.length > 0) {
        console.log(`Syncing ${unsyncedTasks.length} unsynced tasks to Supabase`);
        for (const task of unsyncedTasks) {
          await this.saveTaskToSupabase(task);
        }
      }
      
      await this.loadTasksFromSupabase();
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
    } finally {
      this.isSyncingWithSupabase = false;
    }
  }
  
  /**
   * Clear the task cache after saving orders
   */
  public clearTaskById(taskId: string): void {
    if (this.processingTasks[taskId]) {
      const message = this.processingTasks[taskId].message;
      delete this.processingTasks[taskId];
      this.messageToTaskIdMap.delete(message.trim());
      
      if (this.activeTaskId === taskId) {
        this.activeTaskId = null;
      }
      
      this.saveToStorage();
    }
  }
}

export const messageProcessor = new MessageProcessingService();
