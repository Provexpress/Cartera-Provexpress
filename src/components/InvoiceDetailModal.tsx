import { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Package,
  User,
  Users,
  X,
  MessageSquare,
  PlusCircle,
  Clock,
  Send,
  Database,
  CalendarCheck,
} from 'lucide-react';
import type { CarteraRecord } from '../types';
import { formatCurrency, AGING_CONFIG } from '../lib/carteraApi';
import {
  getGestionesPorFactura,
  guardarGestion,
  isSupabaseConfigured,
  type CarteraGestion,
} from '../lib/supabaseClient';

interface Props {
  record: CarteraRecord | null;
  currentUser?: { name: string; email: string } | null;
  onClose: () => void;
}

export function InvoiceDetailModal({ record, currentUser, onClose }: Props) {
  if (!record) return null;

  const [activeTab, setActiveTab] = useState<'productos' | 'bitacora'>('productos');
  const [gestiones, setGestiones] = useState<CarteraGestion[]>([]);
  const [loadingGestiones, setLoadingGestiones] = useState(false);
  const [savingGestion, setSavingGestion] = useState(false);

  // Formulario de nueva gestión
  const [tipoGestion, setTipoGestion] = useState<CarteraGestion['tipo_gestion']>('Llamada');
  const [observacion, setObservacion] = useState('');
  const [fechaCompromiso, setFechaCompromiso] = useState('');
  const [montoCompromiso, setMontoCompromiso] = useState<string>('');

  const facturaKey = `${record.Prefijo || 'FVE'}-${record.Numero}`;
  const ageConfig = AGING_CONFIG[record.categoriaEdad];

  // Cargar gestiones al abrir el modal o cambiar a bitácora
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoadingGestiones(true);
      try {
        const list = await getGestionesPorFactura(facturaKey);
        if (isMounted) setGestiones(list);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingGestiones(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [facturaKey]);

  // Guardar nueva gestión
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observacion.trim()) return;

    setSavingGestion(true);
    try {
      const nueva = await guardarGestion({
        factura_numero: facturaKey,
        prefijo: record.Prefijo || '',
        numero: record.Numero,
        nit_cliente: record.Identificacion,
        empresa_cliente: record.Empresa,
        tipo_gestion: tipoGestion,
        observacion: observacion.trim(),
        fecha_compromiso: fechaCompromiso || null,
        monto_compromiso: montoCompromiso ? Number(montoCompromiso) : null,
        estado_compromiso: 'Pendiente',
        autor_nombre: currentUser?.name || record.Nombre_Empleado || 'Gestor Cartera',
        autor_email: currentUser?.email || '',
      });

      setGestiones((prev) => [nueva, ...prev]);
      setObservacion('');
      setFechaCompromiso('');
      setMontoCompromiso('');
    } catch (err: any) {
      alert(`Error al guardar gestión: ${err.message}`);
    } finally {
      setSavingGestion(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="modal-badge-row">
              <span className={`badge ${ageConfig.badgeClass}`}>{ageConfig.label}</span>
              <span className={`badge ${record.estaVencida ? 'badge-danger' : 'badge-success'}`}>
                {record.estaVencida ? `Vencida por ${record.diasVencimientoCalc} días` : 'Al día / Corriente'}
              </span>
              <span className="badge badge-neutral">{record.Tipo_Documento}</span>
            </div>
            <h2>
              {record.Prefijo} {record.Numero}
            </h2>
            <p className="modal-subtitle">
              <strong>{record.Empresa}</strong> · NIT: {record.Identificacion}-{record.Dv || '0'}
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Fila de Métricas Principales */}
          <div className="detail-kpi-grid">
            <div className="detail-kpi-card">
              <span className="kpi-icon-wrap blue"><DollarSign size={18} /></span>
              <div>
                <span className="kpi-sub-label">Saldo Pendiente</span>
                <strong className="kpi-main-val">{formatCurrency(record.Valor_Saldo)}</strong>
              </div>
            </div>

            <div className="detail-kpi-card">
              <span className="kpi-icon-wrap purple"><Calendar size={18} /></span>
              <div>
                <span className="kpi-sub-label">Vencimiento</span>
                <strong className="kpi-secondary-val">
                  {record.Fecha_Vencimiento ? record.Fecha_Vencimiento.split('T')[0] : 'N/A'}
                </strong>
                <span className="kpi-note">Emisión: {record.Fecha_Emision ? record.Fecha_Emision.split('T')[0] : 'N/A'}</span>
              </div>
            </div>

            <div className="detail-kpi-card">
              <span className="kpi-icon-wrap green"><Users size={18} /></span>
              <div>
                <span className="kpi-sub-label">Cupo del Cliente</span>
                <strong className="kpi-secondary-val">{formatCurrency(record.Cupo_Credito)}</strong>
                <span className="kpi-note">Estado: {record.Estado_Cliente} · Plazo: {record.Plazo_PagoCliente}d</span>
              </div>
            </div>

            <div className="detail-kpi-card">
              <span className="kpi-icon-wrap orange"><User size={18} /></span>
              <div>
                <span className="kpi-sub-label">Gestor Comercial</span>
                <strong className="kpi-secondary-val">{record.Nombre_Empleado}</strong>
                <span className="kpi-note">{record.grupoNombre} · {record.directorNombre}</span>
              </div>
            </div>
          </div>

          {/* Selector de Pestañas: Productos vs Bitácora de Cobro */}
          <div style={{ display: 'flex', gap: 10, margin: '20px 0 14px', borderBottom: '1px solid #e5e5ea', paddingBottom: 10 }}>
            <button
              type="button"
              className={`button button-sm ${activeTab === 'productos' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => setActiveTab('productos')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Package size={14} />
              <span>Productos Facturados ({record.Productos?.length || 0})</span>
            </button>

            <button
              type="button"
              className={`button button-sm ${activeTab === 'bitacora' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => setActiveTab('bitacora')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <MessageSquare size={14} />
              <span>Bitácora de Cobro ({gestiones.length})</span>
              {isSupabaseConfigured && (
                <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 99, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                  Supabase Live
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: PRODUCTOS */}
          {activeTab === 'productos' && (
            <div className="modal-section" style={{ marginTop: 0 }}>
              {record.Productos && record.Productos.length > 0 ? (
                <div className="data-table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Código</th>
                        <th style={{ width: '45%' }}>Descripción</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>Cant.</th>
                        <th style={{ width: '14%', textAlign: 'right' }}>Valor Unit.</th>
                        <th style={{ width: '14%', textAlign: 'right' }}>Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.Productos.map((prod, idx) => (
                        <tr key={`${prod.Codigo}-${idx}`}>
                          <td className="code-font">{prod.Codigo}</td>
                          <td>{prod.Descripcion}</td>
                          <td style={{ textAlign: 'center' }}>{prod.Cantidad}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(prod.Valor_Producto)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(prod.Valor_Total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#fafafa', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right' }}>Total Facturado:</td>
                        <td style={{ textAlign: 'center' }}>
                          {record.Productos.reduce((sum, p) => sum + p.Cantidad, 0)}
                        </td>
                        <td />
                        <td style={{ textAlign: 'right', color: 'var(--blue)' }}>
                          {formatCurrency(record.Productos.reduce((sum, p) => sum + p.Valor_Total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="empty-state-box">
                  <FileText size={32} />
                  <p>No se encontraron líneas de productos detalladas para esta factura.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BITÁCORA Y COMPROMISOS (SUPABASE) */}
          {activeTab === 'bitacora' && (
            <div className="modal-section" style={{ marginTop: 0 }}>
              {/* Formulario para registrar nueva gestión */}
              <form
                onSubmit={handleGuardar}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                    <PlusCircle size={15} color="#0071e3" />
                    <span>Registrar Nueva Gestión de Cartera</span>
                  </div>
                  <span style={{ fontSize: 11, color: isSupabaseConfigured ? '#16a34a' : '#64748b' }}>
                    {isSupabaseConfigured ? '🟢 Conectado a Supabase PostgreSQL' : '🟠 Modo Local (Configura Supabase en .env)'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Tipo de Gestión
                    </label>
                    <select
                      value={tipoGestion}
                      onChange={(e) => setTipoGestion(e.target.value as any)}
                      style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12.5 }}
                    >
                      <option value="Llamada">📞 Llamada Telefónica</option>
                      <option value="Correo">✉️ Correo Electrónico</option>
                      <option value="Compromiso de Pago">🤝 Compromiso de Pago</option>
                      <option value="Visita">🚗 Visita Comercial</option>
                      <option value="Abono Verificado">💰 Abono Verificado</option>
                      <option value="Cobro Jurídico">⚖️ Cobro Jurídico</option>
                      <option value="Nota Interna">📝 Nota Interna</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Fecha Compromiso (Opcional)
                    </label>
                    <input
                      type="date"
                      value={fechaCompromiso}
                      onChange={(e) => setFechaCompromiso(e.target.value)}
                      style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12.5 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Monto Prometido (Opcional)
                    </label>
                    <input
                      type="number"
                      placeholder="$ Monto a pagar"
                      value={montoCompromiso}
                      onChange={(e) => setMontoCompromiso(e.target.value)}
                      style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 8px', fontSize: 12.5 }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Observación / Resultado del Cobro *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Escribe lo conversado con el cliente, persona de contacto, promesa o acuerdo..."
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    required
                    style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: 12.5, resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={savingGestion || !observacion.trim()}
                    className="button button-sm button-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 650 }}
                  >
                    <Send size={13} />
                    <span>{savingGestion ? 'Guardando...' : 'Guardar Gestión'}</span>
                  </button>
                </div>
              </form>

              {/* Lista de gestiones anteriores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingGestiones ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 13 }}>
                    Consultando historial en Supabase...
                  </div>
                ) : gestiones.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                    <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No hay gestiones registradas aún para esta factura.</p>
                    <small style={{ fontSize: 11 }}>Utiliza el formulario de arriba para registrar acuerdos o llamadas.</small>
                  </div>
                ) : (
                  gestiones.map((g) => (
                    <div
                      key={g.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '12px 14px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            {g.tipo_gestion}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 650, color: '#334155' }}>
                            {g.autor_nombre}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} />
                          {g.created_at ? new Date(g.created_at).toLocaleString() : 'Reciente'}
                        </span>
                      </div>

                      <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                        {g.observacion}
                      </p>

                      {(g.fecha_compromiso || g.monto_compromiso) && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: '#fef3c7',
                            color: '#92400e',
                            fontSize: 11.5,
                            fontWeight: 650,
                          }}
                        >
                          <CalendarCheck size={13} />
                          {g.fecha_compromiso && <span>Promesa de pago: {g.fecha_compromiso}</span>}
                          {g.monto_compromiso && <span>Monto: {formatCurrency(g.monto_compromiso)}</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-info">
            <CheckCircle2 size={15} style={{ color: '#18a957' }} />
            <span>Factura sincronizada con ERP · Bitácora respaldada</span>
          </div>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}
