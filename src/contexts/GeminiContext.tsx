
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { geminiClient, GeminiConnectionStatus } from '@/services/gemini';

interface GeminiContextType {
  generateContent: (prompt: string, options?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  }) => Promise<string | null>;
  connectionStatus: GeminiConnectionStatus;
  lastError: string | null;
  checkConnection: () => Promise<boolean>;
}

const GeminiContext = createContext<GeminiContextType | undefined>(undefined);

export function GeminiProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<GeminiConnectionStatus>(
    geminiClient.getConnectionStatus()
  );
  const [lastError, setLastError] = useState<string | null>(
    geminiClient.getLastError()
  );

  useEffect(() => {
    const unsubscribe = geminiClient.onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      setLastError(geminiClient.getLastError());
    });

    // Always check connection when component mounts to ensure API key change is reflected
    geminiClient.checkConnection();

    return unsubscribe;
  }, []);

  const checkConnection = useCallback(async () => {
    return geminiClient.checkConnection();
  }, []);

  const value = {
    generateContent: geminiClient.generateContent.bind(geminiClient),
    connectionStatus,
    lastError,
    checkConnection,
  };

  return <GeminiContext.Provider value={value}>{children}</GeminiContext.Provider>;
}

export const useGemini = (): GeminiContextType => {
  const context = useContext(GeminiContext);
  if (context === undefined) {
    throw new Error('useGemini must be used within a GeminiProvider');
  }
  return context;
};
