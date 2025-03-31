
import { createClient } from '@supabase/supabase-js';

// Estas URLs vienen de la configuración de Supabase
// En un entorno real, deberían venir de variables de entorno
const supabaseUrl = 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = 'your-anon-key';

// Crea el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función para verificar la conexión con Supabase
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('health_check').select('*').limit(1);
    
    if (error) {
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
