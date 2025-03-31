
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchOrders, deleteOrder } from '@/services/orderService';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package, Trash2, User } from 'lucide-react';
import { OrderItemData } from '@/types/orders';

const Orders: React.FC = () => {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  // Fetch orders data
  const { 
    data: orders = [], 
    isLoading, 
    isError, 
    refetch 
  } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders
  });

  // Handle order deletion
  const handleDeleteOrder = async (orderId: string) => {
    const success = await deleteOrder(orderId);
    if (success) {
      refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>No se pudieron cargar los pedidos</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => refetch()}>Reintentar</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Badge variant="outline">{orders.length} pedidos</Badge>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay pedidos</CardTitle>
            <CardDescription>
              Los pedidos confirmados aparecerán aquí
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Genera pedidos usando el asistente de IA para que se guarden en esta sección
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            // Calculate total items
            const orderItems = order.items as OrderItemData[];
            const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
            const isExpanded = expandedOrder === order.id;

            return (
              <Card key={order.id} className={`transition-all ${isExpanded ? 'ring-1 ring-primary' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">
                      Pedido para {(order.clients as any)?.name}
                    </CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente este pedido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteOrder(order.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {(order.clients as any)?.name}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <Accordion 
                    type="single" 
                    collapsible
                    value={isExpanded ? "items" : undefined}
                    onValueChange={(value) => setExpandedOrder(value === "items" ? order.id : null)}
                  >
                    <AccordionItem value="items" className="border-b-0">
                      <AccordionTrigger className="py-2">
                        Detalles del pedido
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Producto</TableHead>
                              <TableHead>Variante</TableHead>
                              <TableHead className="text-right">Cantidad</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orderItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.product_name}</TableCell>
                                <TableCell>{item.variant_name}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
