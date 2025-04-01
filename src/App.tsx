
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import MainLayout from "@/layouts/MainLayout";
import Index from "@/pages/Index";
import Products from "@/pages/Products";
import Clients from "@/pages/Clients";
import AIOrders from "@/pages/AIOrders";
import Orders from "@/pages/Orders";
import NotFound from "@/pages/NotFound";
import { checkSupabaseConnection } from "@/lib/supabase";
import { GeminiProvider } from "@/contexts/GeminiContext";
import { MessageProcessingProvider } from "@/contexts/MessageProcessingContext";
import ProcessingStatusIndicator from "@/components/ProcessingStatusIndicator";

// Create a new QueryClient instance outside of component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function App() {
  // Use React.useEffect instead of useEffect directly
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        await checkSupabaseConnection();
      } catch (error) {
        console.error("Error al comprobar conexión:", error);
      }
    };
    
    checkConnection();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="ventascom-theme">
        <GeminiProvider>
          <MessageProcessingProvider>
            <TooltipProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Index />} />
                    <Route path="products" element={<Products />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="ai-orders" element={<AIOrders />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
                <ProcessingStatusIndicator />
                <Toaster />
                <Sonner />
              </BrowserRouter>
            </TooltipProvider>
          </MessageProcessingProvider>
        </GeminiProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
