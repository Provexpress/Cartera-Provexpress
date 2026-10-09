import { createClient } from '@supabase/supabase-js';

// Variables de entorno de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verificar si Supabase está configurado con claves reales
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  supabaseUrl.startsWith('https://')
);

// Cliente Supabase singleton
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Tipos de datos para la bitácora de cobranza
export interface CarteraGestion {
  id?: string;
  factura_numero: string;
  prefijo?: string;
  numero: number;
  nit_cliente: string;
  empresa_cliente: string;
  tipo_gestion: 'Llamada' | 'Correo' | 'Compromiso de Pago' | 'Visita' | 'Cobro Jurídico' | 'Abono Verificado' | 'Nota Interna';
  observacion: string;
  fecha_compromiso?: string | null;
  monto_compromiso?: number | null;
  estado_compromiso?: 'Pendiente' | 'Cumplido' | 'Incumplido' | 'Cancelado';
  autor_nombre: string;
  autor_email?: string;
  created_at?: string;
}

export interface CarteraSnapshot {
  id?: string;
  fecha_corte: string;
  total_saldo: number;
  total_corriente: number;
  total_vencido: number;
  porcentaje_vencido: number;
  documentos_count: number;
  clientes_count: number;
  resumen_edades?: Record<string, any>;
  resumen_directores?: Record<string, any>;
  created_at?: string;
}

// ─── FUNCIONES DE API PARA GESTIÓN DE COBRO ─────────────────────────────────

// Obtener el historial de gestiones de una factura específica
export async function getGestionesPorFactura(facturaNumero: string): Promise<CarteraGestion[]> {
  if (!isSupabaseConfigured || !supabase) {
    // Si no está configurado, usamos almacenamiento local de respaldo para que la UI funcione de inmediato
    return getLocalGestiones(facturaNumero);
  }

  try {
    const { data, error } = await supabase
      .from('cartera_gestiones')
      .select('*')
      .eq('factura_numero', facturaNumero)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error al consultar gestiones en Supabase, usando respaldo local:', error.message);
      return getLocalGestiones(facturaNumero);
    }

    return (data as CarteraGestion[]) || [];
  } catch (err) {
    console.warn('Excepción al consultar Supabase:', err);
    return getLocalGestiones(facturaNumero);
  }
}

// Crear una nueva gestión / compromiso de pago
export async function guardarGestion(gestion: Omit<CarteraGestion, 'id' | 'created_at'>): Promise<CarteraGestion> {
  const nuevaGestion: CarteraGestion = {
    ...gestion,
    id: `loc-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('cartera_gestiones')
        .insert([gestion])
        .select()
        .single();

      if (!error && data) {
        saveLocalGestion(data as CarteraGestion);
        return data as CarteraGestion;
      }
      console.warn('Error guardando en Supabase, guardando localmente:', error?.message);
    } catch (err) {
      console.warn('Error en llamada a Supabase:', err);
    }
  }

  // Respaldo local
  saveLocalGestion(nuevaGestion);
  return nuevaGestion;
}

// ─── RESPALDO EN LOCALSTORAGE (Funciona aún antes de configurar las credenciales) ──
const LOCAL_STORAGE_KEY = 'cartera_provexpress_gestiones';

function getLocalGestiones(facturaNumero: string): CarteraGestion[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];
    const all: CarteraGestion[] = JSON.parse(stored);
    return all.filter((g) => g.factura_numero === facturaNumero);
  } catch {
    return [];
  }
}

function saveLocalGestion(gestion: CarteraGestion) {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const all: CarteraGestion[] = stored ? JSON.parse(stored) : [];
    all.unshift(gestion);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Error guardando en localStorage:', err);
  }
}
