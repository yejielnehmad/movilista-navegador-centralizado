
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  // Verificar la conexión con Supabase al iniciar la aplicación
  React.useEffect(() => {
    const checkConnection = async () => {
      await checkSupabaseConnection();
    };
    
    checkConnection();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GeminiProvider>
        <MessageProcessingProvider>
          <ThemeProvider defaultTheme="light" storageKey="ventascom-theme">
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
                <Toaster />
                <Sonner />
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </MessageProcessingProvider>
      </GeminiProvider>
    </QueryClientProvider>
  );
}

export default App;
