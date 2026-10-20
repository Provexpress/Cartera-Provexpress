import { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Save,
  User,
  Users,
  X,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type { CustomerSummary, UserProfile } from '../types';
import { formatCurrency } from '../lib/carteraApi';
import { saveClientContact, type ClientContact } from '../lib/clientContactsStorage';

interface Props {
  customer: CustomerSummary;
  existingContact?: ClientContact | null;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onSaved: (contact: ClientContact) => void;
}

export function ClientContactModal({
  customer,
  existingContact,
  currentUser,
  onClose,
  onSaved,
}: Props) {
  const [correo, setCorreo] = useState(existingContact?.correoTesoreria || '');
  const [contacto, setContacto] = useState(existingContact?.contactoTesoreria || '');
  const [telefono, setTelefono] = useState(existingContact?.telefonoTesoreria || '');
  const [observaciones, setObservaciones] = useState(existingContact?.observaciones || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validación básica de correo si se ingresó algo
    if (correo.trim()) {
      const emailList = correo.split(/[,;\s]+/).filter(Boolean);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalid = emailList.find((em) => !emailRegex.test(em));
      if (invalid) {
        setErrorMsg(`El correo "${invalid}" no tiene un formato válido.`);
        return;
      }
    }

    setSaving(true);
    try {
      const saved = await saveClientContact({
        nit: customer.nit,
        dv: customer.dv,
        empresa: customer.empresa,
        correoTesoreria: correo.trim(),
        contactoTesoreria: contacto.trim(),
        telefonoTesoreria: telefono.trim(),
        observaciones: observaciones.trim(),
        actualizadoPor: currentUser?.name || 'Usuario Cartera',
      });

      setSavedSuccess(true);
      setTimeout(() => {
        onSaved(saved);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al guardar el contacto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 580,
          width: '94%',
          backgroundColor: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* ENCABEZADO */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Actualizar Contacto de Tesorería
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                {customer.empresa} · NIT: {customer.nit}{customer.dv ? `-${customer.dv}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn-minimal"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* RESUMEN FINANCIERO DEL CLIENTE */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Saldo Total
            </span>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              {formatCurrency(customer.totalSaldo)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Saldo Vencido
            </span>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: customer.totalVencido > 0 ? '#dc2626' : '#16a34a',
              }}
            >
              {formatCurrency(customer.totalVencido)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Facturas Vivas
            </span>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
              {customer.docCount} facturas
            </div>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Comercial
            </span>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#334155',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={customer.comercial}
            >
              {customer.comercial}
            </div>
          </div>
        </div>

        {/* FORMULARIO DE CONTACTO */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: 16,
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedSuccess && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: 16,
                borderRadius: 8,
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={16} />
              <span>Contacto guardado correctamente en la base institucional.</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* CORREO DE TESORERÍA */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 6,
                }}
              >
                <Mail size={15} color="#2563eb" />
                <span>Correo Electrónico de Tesorería / Pagos *</span>
              </label>
              <input
                type="text"
                placeholder="ej: tesoreria@cliente.com, pagos@cliente.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 14,
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
              <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 4, display: 'block' }}>
                Puede ingresar varios correos separándolos por coma (,) o punto y coma (;).
              </span>
            </div>

            {/* NOMBRE DE CONTACTO */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 6,
                }}
              >
                <User size={15} color="#475569" />
                <span>Nombre del Contacto en Tesorería / Contabilidad</span>
              </label>
              <input
                type="text"
                placeholder="ej: Marcela Pérez · Analista de Pagos"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* TELÉFONO O WHATSAPP */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 6,
                }}
              >
                <Phone size={15} color="#16a34a" />
                <span>Teléfono / Celular / WhatsApp de Contacto</span>
              </label>
              <input
                type="text"
                placeholder="ej: 310 123 4567 / (601) 745 0000 ext 102"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* OBSERVACIONES Y POLÍTICAS DE PAGO */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 6,
                }}
              >
                <FileText size={15} color="#64748b" />
                <span>Observaciones / Días de Pago / Instrucciones de Radicación</span>
              </label>
              <textarea
                rows={3}
                placeholder="ej: Radicación de facturas los primeros 5 días hábiles. Programan pagos quincenales los viernes."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 13.5,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {existingContact?.actualizadoEl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#94a3b8' }}>
                <Clock size={13} />
                <span>
                  Última actualización: {new Date(existingContact.actualizadoEl).toLocaleString('es-CO')}
                  {existingContact.actualizadoPor ? ` por ${existingContact.actualizadoPor}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 22,
              paddingTop: 16,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 160, justifyContent: 'center' }}
            >
              <Save size={15} />
              <span>{saving ? 'Guardando...' : 'Guardar Contacto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
