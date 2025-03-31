
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Usar el cliente de Supabase ya configurado
export const supabase = supabaseClient;

// Función para verificar la conexión con Supabase
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('count')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error al conectar con Supabase:', error);
      return false;
    }
    
    console.log('Conexión con Supabase establecida correctamente');
    return true;
  } catch (err) {
    console.error('Error al verificar la conexión con Supabase:', err);
    return false;
  }
}
