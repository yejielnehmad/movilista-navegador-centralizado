
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Definir el tipo para el cliente
interface Client {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

// Esquema de validación para el formulario de cliente
const clientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const { toast } = useToast();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  });

  // Cargar clientes al iniciar
  useEffect(() => {
    fetchClients();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        (payload) => {
          console.log('Cambio en tiempo real:', payload);
          fetchClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Función para obtener clientes desde Supabase
  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      setClients(data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los clientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para agregar un nuevo cliente
  const addClient = async (values: ClientFormValues) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([
          {
            name: values.name,
            phone: values.phone || null,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: 'Cliente agregado',
        description: `Se ha agregado "${values.name}" exitosamente`,
      });

      form.reset();
      setIsAddOpen(false);
    } catch (error) {
      console.error('Error al agregar cliente:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el cliente',
        variant: 'destructive',
      });
    }
  };

  // Función para actualizar un cliente
  const updateClient = async (values: ClientFormValues) => {
    if (!currentClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: values.name,
          phone: values.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentClient.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Cliente actualizado',
        description: `Se ha actualizado "${values.name}" exitosamente`,
      });

      editForm.reset();
      setIsEditOpen(false);
      setCurrentClient(null);
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el cliente',
        variant: 'destructive',
      });
    }
  };

  // Función para eliminar un cliente
  const deleteClient = async (client: Client) => {
    if (!confirm(`¿Estás seguro de eliminar a ${client.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Cliente eliminado',
        description: `Se ha eliminado "${client.name}" exitosamente`,
      });
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el cliente',
        variant: 'destructive',
      });
    }
  };

  // Preparar formulario para edición
  const handleEdit = (client: Client) => {
    setCurrentClient(client);
    editForm.reset({
      name: client.name,
      phone: client.phone || '',
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Clientes</h1>
        
        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              <span>Nuevo Cliente</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Agregar Nuevo Cliente</SheetTitle>
              <SheetDescription>
                Ingrese los datos del nuevo cliente a continuación.
              </SheetDescription>
            </SheetHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(addClient)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de teléfono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      form.reset();
                      setIsAddOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
        
        {/* Hoja para editar cliente */}
        <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Editar Cliente</SheetTitle>
              <SheetDescription>
                Modifique los datos del cliente a continuación.
              </SheetDescription>
            </SheetHeader>
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(updateClient)} className="space-y-4 pt-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Número de teléfono" 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      editForm.reset();
                      setIsEditOpen(false);
                      setCurrentClient(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Actualizar</Button>
                </div>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <p>Cargando clientes...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-gray-50">
          <p className="text-gray-500 mb-4">No hay clientes registrados</p>
          <Button 
            onClick={() => setIsAddOpen(true)} 
            variant="outline"
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar cliente</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{client.name}</CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-muted-foreground">
                  {client.phone ? `Tel: ${client.phone}` : 'Sin teléfono registrado'}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleEdit(client)}
                  className="h-8 px-2"
                >
                  <Edit className="h-4 w-4" />
                  <span className="ml-1">Editar</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => deleteClient(client)}
                  className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash className="h-4 w-4" />
                  <span className="ml-1">Eliminar</span>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Clients;
