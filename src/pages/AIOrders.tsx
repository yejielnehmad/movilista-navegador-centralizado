
import React, { useState } from 'react';
import { useGemini } from '@/contexts/GeminiContext';
import { GeminiConnectionStatus } from '@/services/gemini';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';

const AIOrders: React.FC = () => {
  const { generateContent, connectionStatus } = useGemini();
  const [prompt, setPrompt] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim() || processing) return;
    
    setProcessing(true);
    setResult(null);
    
    try {
      const response = await generateContent(prompt);
      setResult(response);
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Generar Pedidos con IA</h1>
      
      <p className="text-muted-foreground mb-6">
        Ingresa un mensaje de texto natural describiendo los productos que deseas pedir y la IA generará un pedido completo.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          placeholder="Ejemplo: Necesito 5 kilos de patatas, 2 botellas de aceite de oliva y una docena de huevos para el restaurante Buena Mesa..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-32 p-4 border-muted resize-y"
          disabled={processing || connectionStatus !== GeminiConnectionStatus.CONNECTED}
        />
        
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={!prompt.trim() || processing || connectionStatus !== GeminiConnectionStatus.CONNECTED}
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
                Generar Pedido
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
      
      {result && (
        <Card className="mt-6 border rounded-lg overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle>Resultado del Análisis</CardTitle>
            <CardDescription>La IA ha generado el siguiente pedido</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="result">
                <AccordionTrigger className="font-medium">Ver pedido completo</AccordionTrigger>
                <AccordionContent>
                  <pre className="whitespace-pre-wrap text-sm p-4 bg-muted/50 rounded-md">
                    {result}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline">Editar</Button>
            <Button>Confirmar Pedido</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default AIOrders;
