
import { toast } from "sonner";

// API configuration
const GEMINI_MODEL = "gemini-2.5-pro-exp-03-25";
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

// Gemini API Client class
class GeminiClient {
  private apiKey: string | null = null;
  private connectionStatus: GeminiConnectionStatus = GeminiConnectionStatus.DISCONNECTED;
  private connectionListeners: ((status: GeminiConnectionStatus) => void)[] = [];

  constructor() {
    // Use environment variable or hardcoded key (for development purposes only)
    this.apiKey = "AIzaSyAODux90Zf2iJnC8QGNuA-ab3BIbpwa2K0";
    
    // Check connection on initialization
    this.checkConnection();
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

  // Update connection status and notify listeners
  private setConnectionStatus(status: GeminiConnectionStatus): void {
    this.connectionStatus = status;
    this.connectionListeners.forEach(listener => listener(status));
  }

  // Check Gemini API connection
  public async checkConnection(): Promise<boolean> {
    if (!this.apiKey) {
      this.setConnectionStatus(GeminiConnectionStatus.DISCONNECTED);
      return false;
    }

    try {
      this.setConnectionStatus(GeminiConnectionStatus.CONNECTING);
      
      // Simple ping request to check connection
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Hello" }]
          }],
          generationConfig: {
            maxOutputTokens: 1
          }
        }),
      });

      if (response.ok) {
        this.setConnectionStatus(GeminiConnectionStatus.CONNECTED);
        return true;
      } else {
        const errorData: GeminiError = await response.json();
        console.error("Gemini API connection error:", errorData);
        this.setConnectionStatus(GeminiConnectionStatus.ERROR);
        return false;
      }
    } catch (error) {
      console.error("Gemini API connection check failed:", error);
      this.setConnectionStatus(GeminiConnectionStatus.ERROR);
      return false;
    }
  }

  // Generate content with Gemini API
  public async generateContent(
    prompt: string,
    options: {
      temperature?: number;
      topP?: number;
      maxOutputTokens?: number;
    } = {}
  ): Promise<string | null> {
    if (!this.apiKey) {
      toast.error("Gemini API key not configured");
      return null;
    }

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

    try {
      this.setConnectionStatus(GeminiConnectionStatus.CONNECTING);
      
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData: GeminiError = await response.json();
        toast.error(`Gemini API error: ${errorData.error.message}`);
        this.setConnectionStatus(GeminiConnectionStatus.ERROR);
        return null;
      }

      const data: GeminiResponse = await response.json();
      
      // Check for content filtering
      if (data.promptFeedback?.blockReason) {
        toast.error(`Content blocked: ${data.promptFeedback.blockReason}`);
        this.setConnectionStatus(GeminiConnectionStatus.CONNECTED);
        return null;
      }

      if (!data.candidates || data.candidates.length === 0) {
        toast.error("No response from Gemini API");
        this.setConnectionStatus(GeminiConnectionStatus.CONNECTED);
        return null;
      }

      this.setConnectionStatus(GeminiConnectionStatus.CONNECTED);
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini API request failed:", error);
      toast.error("Failed to communicate with Gemini API");
      this.setConnectionStatus(GeminiConnectionStatus.ERROR);
      return null;
    }
  }
}

// Export a singleton instance
export const geminiClient = new GeminiClient();
