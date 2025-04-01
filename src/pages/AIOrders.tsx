import React, { useState, useEffect } from 'react';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, AlertTriangle, Check, Save, ArrowRight } from 'lucide-react';
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
import { OrderItem, ProcessedOrder, GroupedOrderItems } from '@/types/orders';
import OrderCard from '@/components/orders/OrderCard';
import { toast } from 'sonner';
import { saveOrder } from '@/services/orderService';
import { useNavigate } from 'react-router-dom';
import { useMessageProcessing } from '@/contexts/MessageProcessingContext';
import MessageProcessingProgress from '@/components/orders/MessageProcessingProgress';
import { parseMessyOrderMessage, validateAndMatchOrders, groupOrdersByClient } from '@/utils/advancedOrderParser';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AIOrders: React.FC = () => {
  const { generateContent, connectionStatus } = useGemini();
  const { 
    processNewMessage, 
    activeTask, 
    isProcessing,
    getTaskResults
  } = useMessageProcessing();
  
  const [message, setMessage] = useState<string>('');
  const [localProcessing, setLocalProcessing] = useState<boolean>(false);
  const [parsedOrders, setParsedOrders] = useState<OrderItem[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrderItems[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<OrderItem[]>([]);
  const [savingOrders, setSavingOrders] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('itemized');
  const navigate = useNavigate();

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });
  
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients
  });

  useEffect(() => {
    if (activeTask?.stage === 'completed' && activeTask?.status === 'success') {
      const results = activeTask.result || [];
      if (results.length > 0) {
        setParsedOrders(results);
        
        const grouped = groupOrdersByClientName(results);
        setGroupedOrders(grouped);
      }
    }
  }, [activeTask]);

  const groupOrdersByClientName = (items: OrderItem[]): GroupedOrderItems[] => {
    const groupedByName: Record<string, OrderItem[]> = {};
    
    items.forEach(item => {
      const clientKey = item.clientMatch?.name.toLowerCase() || item.clientName.toLowerCase();
      
      if (!groupedByName[clientKey]) {
        groupedByName[clientKey] = [];
      }
      
      groupedByName[clientKey].push(item);
    });
    
    return Object.entries(groupedByName).map(([_, clientItems]) => {
      const firstItem = clientItems[0];
      
      let worstStatus: 'valid' | 'warning' | 'error' = 'valid';
      if (clientItems.some(item => item.status === 'error')) {
        worstStatus = 'error';
      } else if (clientItems.some(item => item.status === 'warning')) {
        worstStatus = 'warning';
      }
      
      return {
        clientName: firstItem.clientMatch?.name || firstItem.clientName,
        clientMatch: firstItem.clientMatch,
        items: clientItems,
        status: worstStatus
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || localProcessing || isProcessing) return;
    
    setParsedOrders([]);
    setGroupedOrders([]);
    
    setLocalProcessing(true);
    
    try {
      await processNewMessage(message);
      
      if (productsQuery.data && clientsQuery.data) {
        const quickParsedItems = parseMessyOrderMessage(message);
        const quickValidatedItems = validateAndMatchOrders(
          quickParsedItems,
          clientsQuery.data,
          productsQuery.data
        );
        
        setParsedOrders(quickValidatedItems);
        
        const quickGrouped = groupOrdersByClientName(quickValidatedItems);
        setGroupedOrders(quickGrouped);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      toast.error('Error al procesar el mensaje');
    } finally {
      setLocalProcessing(false);
    }
  };

  const handleUpdateOrder = (index: number, updatedItem: OrderItem) => {
    setParsedOrders(current => 
      current.map((item, i) => i === index ? updatedItem : item)
    );
    
    setGroupedOrders(current => {
      return current.map(group => {
        const updatedItems = group.items.map(item => {
          if (item.clientName === updatedItem.clientName && 
              item.productName === updatedItem.productName &&
              item.quantity === updatedItem.quantity) {
            return updatedItem;
          }
          return item;
        });
        
        let status: 'valid' | 'warning' | 'error' = 'valid';
        if (updatedItems.some(item => item.status === 'error')) {
          status = 'error';
        } else if (updatedItems.some(item => item.status === 'warning')) {
          status = 'warning';
        }
        
        return {
          ...group,
          items: updatedItems,
          status
        };
      });
    });
  };

  const handleRemoveOrder = (index: number) => {
    const itemToRemove = parsedOrders[index];
    
    setParsedOrders(current => 
      current.filter((_, i) => i !== index)
    );
    
    setGroupedOrders(current => {
      const newGroups = current.map(group => {
        const filteredItems = group.items.filter(item => 
          !(item.clientName === itemToRemove.clientName && 
            item.productName === itemToRemove.productName &&
            item.quantity === itemToRemove.quantity)
        );
        
        let status: 'valid' | 'warning' | 'error' = 'valid';
        if (filteredItems.some(item => item.status === 'error')) {
          status = 'error';
        } else if (filteredItems.some(item => item.status === 'warning')) {
          status = 'warning';
        }
        
        return {
          ...group,
          items: filteredItems,
          status
        };
      });
      
      return newGroups.filter(group => group.items.length > 0);
    });
  };

  const handleConfirmOrder = (index: number) => {
    const itemToConfirm = parsedOrders[index];
    
    if (itemToConfirm.status === 'error' || !itemToConfirm.variantMatch) {
      toast.error("No se puede confirmar un pedido con errores");
      return;
    }
    
    setConfirmedOrders(current => [...current, itemToConfirm]);
    
    handleRemoveOrder(index);
  };

  const handleConfirmGroup = (groupIndex: number) => {
    const group = groupedOrders[groupIndex];
    const validItems = group.items.filter(
      item => item.status !== 'error' && item.variantMatch
    );
    
    if (validItems.length === 0) {
      toast.error("No hay pedidos válidos para confirmar en este grupo");
      return;
    }
    
    setConfirmedOrders(current => [...current, ...validItems]);
    
    const itemsToRemove = new Set(validItems);
    
    setParsedOrders(current => 
      current.filter(item => !itemsToRemove.has(item))
    );
    
    setGroupedOrders(current => {
      const newGroups = [...current];
      const remainingItems = group.items.filter(item => !validItems.includes(item));
      
      if (remainingItems.length === 0) {
        newGroups.splice(groupIndex, 1);
      } else {
        let status: 'valid' | 'warning' | 'error' = 'valid';
        if (remainingItems.some(item => item.status === 'error')) {
          status = 'error';
        } else if (remainingItems.some(item => item.status === 'warning')) {
          status = 'warning';
        }
        
        newGroups[groupIndex] = {
          ...group,
          items: remainingItems,
          status
        };
      }
      
      return newGroups;
    });
    
    toast.success(`${validItems.length} pedidos confirmados`);
  };

  const handleSaveOrders = async () => {
    if (confirmedOrders.length === 0) {
      toast.error("No hay pedidos para guardar");
      return;
    }

    setSavingOrders(true);

    try {
      const ordersByClient = new Map<string, OrderItem[]>();
      
      confirmedOrders.forEach(order => {
        if (!order.clientMatch?.id) {
          toast.error(`Error: Cliente no disponible para ${order.clientMatch?.name || order.clientName}`);
          return;
        }

        const clientId = order.clientMatch.id;
        if (!ordersByClient.has(clientId)) {
          ordersByClient.set(clientId, []);
        }
        ordersByClient.get(clientId)?.push(order);
      });

      const savePromises: Promise<any>[] = [];
      
      ordersByClient.forEach((items, clientId) => {
        savePromises.push(saveOrder(clientId, items));
      });

      await Promise.all(savePromises);
      setConfirmedOrders([]);
      toast.success("Pedidos guardados con éxito");
      
      navigate('/orders');
    } catch (error) {
      console.error("Error saving orders:", error);
      toast.error("Error al guardar los pedidos");
    } finally {
      setSavingOrders(false);
    }
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
          disabled={localProcessing || isProcessing || connectionStatus !== GeminiConnectionStatus.CONNECTED}
        />
        
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={!message.trim() || localProcessing || isProcessing || connectionStatus !== GeminiConnectionStatus.CONNECTED}
            className="flex items-center gap-2"
          >
            {localProcessing || isProcessing ? (
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
      
      {activeTask && activeTask.stage !== 'completed' && (
        <div className="my-4">
          <MessageProcessingProgress progress={activeTask} />
        </div>
      )}
      
      {(parsedOrders.length > 0 || groupedOrders.length > 0) && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Pedidos detectados ({parsedOrders.length})
            </h2>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setParsedOrders([]);
                  setGroupedOrders([]);
                }}
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
                  setGroupedOrders([]);
                  toast.success(`${validOrders.length} pedidos confirmados`);
                }}
              >
                <Check className="h-3 w-3 mr-1" />
                Confirmar Todos
              </Button>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="itemized">Por Producto</TabsTrigger>
              <TabsTrigger value="grouped">Por Cliente</TabsTrigger>
            </TabsList>
            
            <TabsContent value="itemized" className="space-y-4 mt-4">
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
            </TabsContent>
            
            <TabsContent value="grouped" className="space-y-4 mt-4">
              {groupedOrders.map((group, groupIndex) => (
                <Card key={groupIndex} className="w-full overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {group.clientMatch?.name || group.clientName}
                      </CardTitle>
                      <CardDescription>
                        {group.items.length} {group.items.length === 1 ? 'producto' : 'productos'}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={
                        group.status === 'error' ? 'destructive' :
                        group.status === 'warning' ? 'default' : 'success'
                      }
                    >
                      {group.status === 'error' ? 'Con Errores' : 
                       group.status === 'warning' ? 'Revisar' : 'Listo'}
                    </Badge>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <div className="px-6 py-2 divide-y divide-gray-100">
                      {group.items.map((item, itemIndex) => (
                        <div 
                          key={itemIndex} 
                          className="py-2 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium">
                              {item.productMatch?.name || item.productName}
                              {item.status === 'error' && (
                                <AlertTriangle className="h-4 w-4 text-destructive inline ml-2" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.variantMatch?.name || item.variantDescription || 'Sin variante'}
                            </div>
                          </div>
                          <div className="font-bold">{item.quantity}×</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-end gap-2 pt-2 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveTab('itemized');
                      }}
                    >
                      Editar
                    </Button>
                    
                    <Button
                      size="sm"
                      disabled={group.status === 'error' || group.items.some(i => !i.variantMatch)}
                      onClick={() => handleConfirmGroup(groupIndex)}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Confirmar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      )}
      
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
            <Button 
              onClick={handleSaveOrders}
              disabled={savingOrders}
              className="flex items-center gap-2"
            >
              {savingOrders ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Pedidos
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default AIOrders;
