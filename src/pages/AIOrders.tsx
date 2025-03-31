
import React, { useState, useEffect } from 'react';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, AlertTriangle, Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '@/services/productService';
import { fetchClients } from '@/services/clientService';
import { parseOrderMessage, validateOrderItems } from '@/utils/orderParser';
import { OrderItem, ProcessedOrder } from '@/types/orders';
import OrderCard from '@/components/orders/OrderCard';
import { toast } from 'sonner';

const AIOrders: React.FC = () => {
  const { generateContent, connectionStatus } = useGemini();
  const [message, setMessage] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [parsedOrders, setParsedOrders] = useState<OrderItem[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<OrderItem[]>([]);

  // Fetch products and clients data
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });
  
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients
  });

  // Process the message directly without AI when possible
  const processMessageDirectly = () => {
    if (!message.trim()) return false;
    
    // Only process direct orders if we have both products and clients data
    if (productsQuery.data && clientsQuery.data) {
      const parsedItems = parseOrderMessage(message);
      
      if (parsedItems.length > 0) {
        const validatedItems = validateOrderItems(
          parsedItems,
          clientsQuery.data,
          productsQuery.data
        );
        
        setParsedOrders(validatedItems);
        return true;
      }
    }
    
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || processing) return;
    
    setProcessing(true);
    setAiResponse(null);
    
    try {
      // First try to process the message directly without AI
      const directlyProcessed = processMessageDirectly();
      
      if (!directlyProcessed) {
        // If direct processing didn't work, use Gemini API
        const response = await generateContent(message);
        setAiResponse(response);
        
        // Try to extract structured data from the AI response
        try {
          // Simple extraction based on format patterns
          // This is a placeholder - you may need more sophisticated parsing
          const parsedItems = parseOrderMessage(message);
          if (parsedItems.length > 0 && productsQuery.data && clientsQuery.data) {
            const validatedItems = validateOrderItems(
              parsedItems,
              clientsQuery.data,
              productsQuery.data
            );
            setParsedOrders(validatedItems);
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError);
        }
      }
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Update a specific order item
  const handleUpdateOrder = (index: number, updatedItem: OrderItem) => {
    setParsedOrders(current => 
      current.map((item, i) => i === index ? updatedItem : item)
    );
  };

  // Remove an order item
  const handleRemoveOrder = (index: number) => {
    setParsedOrders(current => 
      current.filter((_, i) => i !== index)
    );
  };

  // Confirm an order
  const handleConfirmOrder = (index: number) => {
    const itemToConfirm = parsedOrders[index];
    
    if (itemToConfirm.status === 'error' || !itemToConfirm.variantMatch) {
      toast.error("Cannot confirm an order with errors");
      return;
    }
    
    // Add to confirmed orders
    setConfirmedOrders(current => [...current, itemToConfirm]);
    
    // Remove from parsed orders
    setParsedOrders(current => 
      current.filter((_, i) => i !== index)
    );
    
    toast.success("Order confirmed");
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Generar Pedidos con IA</h1>
      
      <p className="text-muted-foreground mb-6">
        Ingresa un mensaje con los pedidos de tus clientes y la IA generará un pedido para cada uno.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder="Ejemplo: Daniel 5 kilos de patatas, Ana 2 litros de leche, Restaurante Buena Mesa 10kg de arroz..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-32 p-4 border-muted resize-y"
          disabled={processing || connectionStatus !== GeminiConnectionStatus.CONNECTED}
        />
        
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={!message.trim() || processing || connectionStatus !== GeminiConnectionStatus.CONNECTED}
            className="flex items-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Procesar Pedido
              </>
            )}
          </Button>
        </div>
      </form>

      {connectionStatus === GeminiConnectionStatus.ERROR && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>No se puede conectar con la API de Gemini</AlertTitle>
          <AlertDescription>
            Por favor verifica tu conexión a internet o contacta al administrador del sistema.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Display extracted orders */}
      {parsedOrders.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pedidos detectados ({parsedOrders.length})</h2>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setParsedOrders([])}
                className="text-xs h-8"
              >
                Limpiar
              </Button>
              
              <Button 
                size="sm"
                className="text-xs h-8"
                disabled={parsedOrders.some(order => 
                  order.status === 'error' || !order.variantMatch
                )}
                onClick={() => {
                  const validOrders = parsedOrders.filter(
                    order => order.status !== 'error' && order.variantMatch
                  );
                  
                  if (validOrders.length === 0) {
                    toast.error("No hay pedidos válidos para confirmar");
                    return;
                  }
                  
                  setConfirmedOrders(current => [...current, ...validOrders]);
                  setParsedOrders([]);
                  toast.success(`${validOrders.length} pedidos confirmados`);
                }}
              >
                <Check className="h-3 w-3 mr-1" />
                Confirmar Todos
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {parsedOrders.map((item, index) => (
              <OrderCard 
                key={index}
                item={item}
                allProducts={productsQuery.data || []}
                onUpdate={(updatedItem) => handleUpdateOrder(index, updatedItem)}
                onRemove={() => handleRemoveOrder(index)}
                onConfirm={() => handleConfirmOrder(index)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Display confirmed orders */}
      {confirmedOrders.length > 0 && (
        <Card className="mt-6 border rounded-lg overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle>Pedidos Confirmados ({confirmedOrders.length})</CardTitle>
            <CardDescription>Los siguientes pedidos han sido confirmados</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="confirmed-orders">
                <AccordionTrigger className="font-medium">
                  Ver pedidos confirmados
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {confirmedOrders.map((order, idx) => (
                      <div 
                        key={idx}
                        className="flex justify-between items-center p-2 rounded border"
                      >
                        <div>
                          <div className="font-medium">{order.clientMatch?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.productMatch?.name} - {order.variantMatch?.name}
                          </div>
                        </div>
                        <div className="font-bold">{order.quantity}×</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmedOrders([])}
            >
              Limpiar
            </Button>
            <Button>
              Finalizar y Enviar Pedidos
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {/* Display raw AI response if available */}
      {aiResponse && (
        <Card className="mt-6 border rounded-lg overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle>Resultado del Análisis</CardTitle>
            <CardDescription>La IA ha analizado tu mensaje</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="result">
                <AccordionTrigger className="font-medium">Ver respuesta completa de la IA</AccordionTrigger>
                <AccordionContent>
                  <pre className="whitespace-pre-wrap text-sm p-4 bg-muted/50 rounded-md">
                    {aiResponse}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIOrders;
