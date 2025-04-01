import { toast } from "sonner";

// API configuration
const GEMINI_MODEL = "gemini-1.5-pro"; // Updated to stable model version
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Types for Gemini API
export interface GeminiMessage {
  parts: { text: string }[];
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
    finishReason: string;
  }[];
  promptFeedback?: {
    blockReason?: string;
  };
}

// Error handling type
export interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

// Connection status enum
export enum GeminiConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error"
}

// Response cache to prevent duplicate API calls
interface CachedResponse {
  prompt: string;
  response: string;
  timestamp: number;
}

// Gemini API Client class
class GeminiClient {
  private apiKey: string | null = null;
  private connectionStatus: GeminiConnectionStatus = GeminiConnectionStatus.DISCONNECTED;
  private connectionListeners: ((status: GeminiConnectionStatus) => void)[] = [];
  private lastConnectionCheck: number = 0;
  private readonly CONNECTION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private lastError: string | null = null;
  private responseCache: Map<string, CachedResponse> = new Map();
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private pendingRequests: Map<string, Promise<string | null>> = new Map();

  constructor() {
    // Use updated API key
    this.apiKey = "AIzaSyAhuGJOdg3blS0GtFCKZVQLHzZcpVbjawo";
    
    // Load cache from localStorage
    this.loadCacheFromStorage();
    
    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCache(), this.CACHE_EXPIRY / 2);
  }

  // Register connection status listeners
  public onConnectionStatusChange(listener: (status: GeminiConnectionStatus) => void): () => void {
    this.connectionListeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  // Get current connection status
  public getConnectionStatus(): GeminiConnectionStatus {
    return this.connectionStatus;
  }

  // Get last error message
  public getLastError(): string | null {
    return this.lastError;
  }

  // Update connection status and notify listeners
  private setConnectionStatus(status: GeminiConnectionStatus, errorMessage?: string): void {
    this.connectionStatus = status;
    if (errorMessage) {
      this.lastError = errorMessage;
      console.error(`Gemini API error: ${errorMessage}`);
    } else if (status === GeminiConnectionStatus.CONNECTED) {
      this.lastError = null;
    }
    this.connectionListeners.forEach(listener => listener(status));
  }

  // Check Gemini API connection
  public async checkConnection(): Promise<boolean> {
    if (!this.apiKey) {
      const errorMsg = "Gemini API key not configured";
      console.error(errorMsg);
      this.setConnectionStatus(GeminiConnectionStatus.DISCONNECTED, errorMsg);
      return false;
    }

    const now = Date.now();
    console.log(`Checking Gemini API connection with model: ${GEMINI_MODEL}`);

    try {
      this.setConnectionStatus(GeminiConnectionStatus.CONNECTING);
      
      // Simple ping request to check connection
      const requestBody = {
        contents: [{
          parts: [{ text: "Hello" }]
        }],
        generationConfig: {
          maxOutputTokens: 1
        }
      };
      
      console.log("Sending connection test request to Gemini API:", JSON.stringify(requestBody));
      
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`Gemini API connection check response status: ${response.status}`);
      
      const responseData = await response.json();
      console.log("Gemini API response:", JSON.stringify(responseData, null, 2));

      if (response.ok) {
        console.log("Successfully connected to Gemini API");
        this.lastConnectionCheck = now;
        this.setConnectionStatus(GeminiConnectionStatus.CONNECTED);
        return true;
      } else {
        const errorData = responseData as GeminiError;
        const errorMessage = errorData.error?.message || "Unknown API error";
        console.error("Gemini API connection error:", errorData);
        this.lastConnectionCheck = now;
        this.setConnectionStatus(GeminiConnectionStatus.ERROR, errorMessage);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Gemini API connection check failed:", error);
      this.lastConnectionCheck = now;
      this.setConnectionStatus(GeminiConnectionStatus.ERROR, errorMessage);
      return false;
    }
  }
  
  // Create a cache key for a prompt + options
  private getCacheKey(prompt: string, options: any): string {
    return `${prompt}_${JSON.stringify(options)}`;
  }
  
  // Save cache to localStorage
  private saveCacheToStorage(): void {
    try {
      const cache: Record<string, CachedResponse> = {};
      this.responseCache.forEach((value, key) => {
        cache[key] = value;
      });
      
      localStorage.setItem('gemini_response_cache', JSON.stringify(cache));
      console.log(`Saved ${this.responseCache.size} cached responses to storage`);
    } catch (error) {
      console.error('Error saving cache to storage:', error);
    }
  }
  
  // Load cache from localStorage
  private loadCacheFromStorage(): void {
    try {
      const cacheString = localStorage.getItem('gemini_response_cache');
      if (cacheString) {
        const cache = JSON.parse(cacheString) as Record<string, CachedResponse>;
        
        for (const [key, value] of Object.entries(cache)) {
          this.responseCache.set(key, value);
        }
        
        console.log(`Loaded ${this.responseCache.size} cached responses from storage`);
        
        // Clean up expired items after loading
        this.cleanupCache();
      }
    } catch (error) {
      console.error('Error loading cache from storage:', error);
    }
  }
  
  // Clean up expired cache items
  private cleanupCache(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    this.responseCache.forEach((value, key) => {
      if (now - value.timestamp > this.CACHE_EXPIRY) {
        this.responseCache.delete(key);
        expiredCount++;
      }
    });
    
    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired cache items`);
      this.saveCacheToStorage();
    }
  }

  // Generate content with Gemini API with caching and deduplication
  public async generateContent(
    prompt: string,
    options: {
      temperature?: number;
      topP?: number;
      maxOutputTokens?: number;
    } = {}
  ): Promise<string | null> {
    if (!this.apiKey) {
      const errorMsg = "Gemini API key not configured";
      toast.error(errorMsg);
      this.setConnectionStatus(GeminiConnectionStatus.DISCONNECTED, errorMsg);
      return null;
    }
    
    // Generate unique cache key for this request
    const cacheKey = this.getCacheKey(prompt, options);
    
    // Check if we have a cached response
    const cachedItem = this.responseCache.get(cacheKey);
    if (cachedItem && Date.now() - cachedItem.timestamp < this.CACHE_EXPIRY) {
      console.log('Using cached Gemini response for prompt:', prompt.substring(0, 50) + '...');
      return cachedItem.response;
    }
    
    // Check if there's already a pending request for this prompt
    if (this.pendingRequests.has(cacheKey)) {
      console.log('Reusing pending request for prompt:', prompt.substring(0, 50) + '...');
      return this.pendingRequests.get(cacheKey);
    }

    // Check connection if we haven't done so recently
    const now = Date.now();
    if (this.connectionStatus === GeminiConnectionStatus.DISCONNECTED && 
       (now - this.lastConnectionCheck > this.CONNECTION_CHECK_INTERVAL)) {
      await this.checkConnection();
    }

    // Create the API request
    const request: GeminiRequest = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: options.temperature ?? 0.8,
        topP: options.topP ?? 1.0, 
        maxOutputTokens: options.maxOutputTokens ?? 65536,
      }
    };

    // Create the promise for this request
    const requestPromise = (async (): Promise<string | null> => {
      try {
        console.log(`Generating content with Gemini API (model: ${GEMINI_MODEL})`);
        
        const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        const data = await response.json();
        console.log("Gemini API response status:", response.status);
        
        if (!response.ok) {
          const errorData = data as GeminiError;
          const errorMessage = errorData.error?.message || "Unknown API error";
          console.error("Gemini API error:", errorData);
          toast.error(`Gemini API error: ${errorMessage}`);
          this.setConnectionStatus(GeminiConnectionStatus.ERROR, errorMessage);
          return null;
        }

        const responseData = data as GeminiResponse;
        
        // Check for content filtering
        if (responseData.promptFeedback?.blockReason) {
          const blockReason = responseData.promptFeedback.blockReason;
          console.error("Content blocked by Gemini API:", blockReason);
          toast.error(`Content blocked: ${blockReason}`);
          return null;
        }

        if (!responseData.candidates || responseData.candidates.length === 0) {
          const errorMsg = "No response from Gemini API";
          console.error(errorMsg);
          toast.error(errorMsg);
          return null;
        }

        // Mark as connected since we successfully communicated with the API
        this.setConnectionStatus(GeminiConnectionStatus.CONNECTED);
        
        // Get the response text
        const responseText = responseData.candidates[0].content.parts[0].text;
        
        // Cache the successful response
        this.responseCache.set(cacheKey, {
          prompt,
          response: responseText,
          timestamp: Date.now()
        });
        
        // Save updated cache to storage
        this.saveCacheToStorage();
        
        return responseText;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Gemini API request failed:", error);
        toast.error(`Failed to communicate with Gemini API: ${errorMessage}`);
        this.setConnectionStatus(GeminiConnectionStatus.ERROR, errorMessage);
        return null;
      } finally {
        // Remove this promise from pending requests
        this.pendingRequests.delete(cacheKey);
      }
    })();
    
    // Store the promise so we can reuse it for duplicate requests
    this.pendingRequests.set(cacheKey, requestPromise);
    
    return requestPromise;
  }
}

// Export a singleton instance
export const geminiClient = new GeminiClient();
