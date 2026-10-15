/**
 * Servicio de almacenamiento y gestión del Directorio de Contactos de Tesorería de Clientes.
 * Persiste en localStorage de forma inmediata y se sincroniza con Supabase si está disponible.
 */
import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface ClientContact {
  nit: string;
  dv?: string;
  empresa: string;
  correoTesoreria: string;
  contactoTesoreria: string;
  telefonoTesoreria: string;
  observaciones?: string;
  actualizadoEl: string;
  actualizadoPor?: string;
}

const STORAGE_KEY = 'provexpress_directorio_clientes_v1';

/**
 * Obtiene todos los contactos guardados localmente
 */
export function getAllClientContacts(): Record<string, ClientContact> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error al leer directorio de contactos:', err);
    return {};
  }
}

/**
 * Obtiene el contacto guardado para un NIT específico
 */
export function getClientContact(nit: string): ClientContact | null {
  if (!nit) return null;
  const all = getAllClientContacts();
  const cleanNit = String(nit).trim();
  return all[cleanNit] || null;
}

/**
 * Guarda o actualiza un contacto de tesorería de cliente
 */
export async function saveClientContact(contact: Omit<ClientContact, 'actualizadoEl'> & { actualizadoEl?: string }): Promise<ClientContact> {
  const cleanNit = String(contact.nit).trim();
  const record: ClientContact = {
    ...contact,
    nit: cleanNit,
    correoTesoreria: (contact.correoTesoreria || '').trim(),
    contactoTesoreria: (contact.contactoTesoreria || '').trim(),
    telefonoTesoreria: (contact.telefonoTesoreria || '').trim(),
    observaciones: (contact.observaciones || '').trim(),
    actualizadoEl: new Date().toISOString(),
  };

  // 1. Guardar en localStorage
  try {
    const all = getAllClientContacts();
    all[cleanNit] = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Error guardando en localStorage:', err);
  }

  // 2. Intentar sincronizar con Supabase si está activo
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('cartera_contactos_clientes')
        .upsert({
          nit: record.nit,
          dv: record.dv || '',
          empresa: record.empresa,
          correo_tesoreria: record.correoTesoreria,
          contacto_tesoreria: record.contactoTesoreria,
          telefono_tesoreria: record.telefonoTesoreria,
          observaciones: record.observaciones,
          actualizado_el: record.actualizadoEl,
          actualizado_por: record.actualizadoPor || 'Usuario Cartera',
        }, { onConflict: 'nit' });
    } catch (err) {
      console.warn('Aviso: no se pudo sincronizar contacto con Supabase, queda en localStorage:', err);
    }
  }

  // 3. Emitir evento global para que componentes suscritos se actualicen de inmediato
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('client-contact-updated', { detail: record }));
  }

  return record;
}

/**
 * Carga contactos desde Supabase en segundo plano si está disponible
 */
export async function syncClientContactsFromSupabase(): Promise<Record<string, ClientContact>> {
  if (!isSupabaseConfigured || !supabase) {
    return getAllClientContacts();
  }

  try {
    const { data, error } = await supabase
      .from('cartera_contactos_clientes')
      .select('*');

    if (error || !data) {
      return getAllClientContacts();
    }

    const current = getAllClientContacts();
    for (const row of data) {
      const nit = String(row.nit).trim();
      current[nit] = {
        nit,
        dv: row.dv || '',
        empresa: row.empresa || '',
        correoTesoreria: row.correo_tesoreria || '',
        contactoTesoreria: row.contacto_tesoreria || '',
        telefonoTesoreria: row.telefono_tesoreria || '',
        observaciones: row.observaciones || '',
        actualizadoEl: row.actualizado_el || new Date().toISOString(),
        actualizadoPor: row.actualizado_por || '',
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch (err) {
    console.warn('Error sincronizando contactos desde Supabase:', err);
    return getAllClientContacts();
  }
}
