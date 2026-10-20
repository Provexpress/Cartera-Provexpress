import { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Mail,
  Search,
  ShieldAlert,
  User,
  X,
  ExternalLink,
} from 'lucide-react';
import type { CarteraRecord, CustomerSummary } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';
import { getClientContact } from '../lib/clientContactsStorage';

interface Props {
  customer: CustomerSummary;
  invoices: CarteraRecord[];
  onClose: () => void;
  onSelectInvoice?: (record: CarteraRecord) => void;
  onEditContact?: () => void;
}

export function CustomerInvoicesModal({
  customer,
  invoices,
  onClose,
  onSelectInvoice,
  onEditContact,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'current'>('all');
  const [isExporting, setIsExporting] = useState(false);

  const contact = useMemo(() => getClientContact(customer.nit), [customer.nit]);

  const countVencidas = invoices.filter((r) => r.estaVencida).length;
  const countCorrientes = invoices.filter((r) => !r.estaVencida).length;

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (statusFilter === 'overdue') {
      list = list.filter((r) => r.estaVencida);
    } else if (statusFilter === 'current') {
      list = list.filter((r) => !r.estaVencida);
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter(
      (r) =>
        String(r.Numero).includes(q) ||
        r.Prefijo.toLowerCase().includes(q) ||
        (r.Tipo_Documento && r.Tipo_Documento.toLowerCase().includes(q))
    );
  }, [invoices, statusFilter, searchTerm]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const { generateCarteraExcel, downloadBufferAsFile } = await import('../lib/excelGenerator');
      const dummyDataState: any = {
        fechaCorte: new Date().toISOString().split('T')[0],
        totalSaldo: customer.totalSaldo,
        totalCorriente: customer.totalCorriente,
        totalVencido: customer.totalVencido,
        records: filteredInvoices,
      };
      const { buffer } = await generateCarteraExcel(dummyDataState, filteredInvoices);
      const customFilename = `Facturas_${customer.empresa.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadBufferAsFile(buffer, customFilename);
    } catch (err) {
      console.error(err);
      alert('Error al exportar facturas del cliente.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-card modal-large"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 980,
          width: '95vw',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* ─── ENCABEZADO SÓLIDO ─── */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
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
                flexShrink: 0,
              }}
            >
              <Building2 size={24} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: 'clamp(16px, 2.2vw, 19px)',
                    fontWeight: 800,
                    margin: 0,
                    color: '#0f172a',
                    wordBreak: 'break-word',
                  }}
                >
                  {customer.empresa}
                </h2>
                <span
                  className="badge badge-neutral"
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                  }}
                >
                  NIT: {customer.nit}{customer.dv ? `-${customer.dv}` : ''}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                Comercial asignado: <strong>{customer.comercial}</strong> · G{customer.grupo}: {customer.directorNombre}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={handleExportExcel}
              disabled={isExporting}
              title="Descargar facturas a Excel"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 650 }}
            >
              <Download size={13} />
              <span>{isExporting ? 'Descargando...' : 'Exportar Excel'}</span>
            </button>
            <button
              type="button"
              className="icon-btn-minimal"
              onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center' }}
              aria-label="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── STRIP DE CONTACTO DE TESORERÍA ─── */}
        <div
          style={{
            padding: '11px 24px',
            backgroundColor: contact?.correoTesoreria ? '#f0fdf4' : '#fffbeb',
            borderBottom: `1px solid ${contact?.correoTesoreria ? '#bbf7d0' : '#fde68a'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <Mail size={15} color={contact?.correoTesoreria ? '#16a34a' : '#d97706'} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
              Correo de Tesorería:{' '}
              {contact?.correoTesoreria ? (
                <a
                  href={`mailto:${contact.correoTesoreria}`}
                  style={{ color: '#15803d', fontWeight: 700, textDecoration: 'none' }}
                >
                  {contact.correoTesoreria}
                </a>
              ) : (
                <span style={{ color: '#b45309', fontStyle: 'italic' }}>Sin registrar en la base</span>
              )}
            </span>
            {contact?.contactoTesoreria && (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                · {contact.contactoTesoreria}
              </span>
            )}
            {contact?.telefonoTesoreria && (
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                · Tel: {contact.telefonoTesoreria}
              </span>
            )}
          </div>

          {onEditContact && (
            <button
              type="button"
              onClick={onEditContact}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
                whiteSpace: 'nowrap',
              }}
            >
              {contact?.correoTesoreria ? 'Editar Contacto' : '+ Registrar Correo'}
            </button>
          )}
        </div>

        {/* ─── TARJETAS RESUMEN FINANCIERO ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
            gap: 12,
            padding: '14px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Saldo Total Abierto
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {formatCurrency(customer.totalSaldo)}
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>{invoices.length} facturas activas</span>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              Corriente (Al día)
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
              {formatCurrency(customer.totalCorriente)}
            </div>
            <span style={{ fontSize: 11, color: '#16a34a' }}>{countCorrientes} facturas al día</span>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              En Mora (Vencida)
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: customer.totalVencido > 0 ? '#dc2626' : '#64748b', marginTop: 2 }}>
              {formatCurrency(customer.totalVencido)}
            </div>
            <span style={{ fontSize: 11, color: '#dc2626' }}>{countVencidas} facturas vencidas</span>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Cupo & Plazo
            </span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {formatCurrency(customer.cupoCredito)}
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>Plazo pago: {customer.plazoPago} días</span>
          </div>
        </div>

        {/* ─── HERRAMIENTAS Y BÚSQUEDA ─── */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ position: 'relative', minWidth: 220, flex: '1 1 240px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Buscar por número o prefijo de factura…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                outline: 'none',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`preset-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
              style={{ fontSize: 11.5 }}
            >
              Todas ({invoices.length})
            </button>
            <button
              type="button"
              className={`preset-chip ${statusFilter === 'overdue' ? 'active' : ''}`}
              onClick={() => setStatusFilter('overdue')}
              style={{
                fontSize: 11.5,
                backgroundColor: statusFilter === 'overdue' ? '#dc2626' : undefined,
                color: statusFilter === 'overdue' ? '#ffffff' : undefined,
              }}
            >
              Vencidas ({countVencidas})
            </button>
            <button
              type="button"
              className={`preset-chip ${statusFilter === 'current' ? 'active' : ''}`}
              onClick={() => setStatusFilter('current')}
              style={{
                fontSize: 11.5,
                backgroundColor: statusFilter === 'current' ? '#16a34a' : undefined,
                color: statusFilter === 'current' ? '#ffffff' : undefined,
              }}
            >
              Al Día ({countCorrientes})
            </button>
          </div>
        </div>

        {/* ─── TABLA DE FACTURAS SÓLIDA CON STICKY HEADER ─── */}
        <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1, padding: '0 24px 16px', backgroundColor: '#ffffff' }}>
          <table className="cartera-table" style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: 140, backgroundColor: '#f8fafc' }}>Documento</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: 105, backgroundColor: '#f8fafc' }}>Emisión</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: 105, backgroundColor: '#f8fafc' }}>Vencimiento</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', minWidth: 130, backgroundColor: '#f8fafc' }}>Estado / Mora</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', minWidth: 140, backgroundColor: '#f8fafc' }}>Saldo Pendiente</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', minWidth: 110, backgroundColor: '#f8fafc' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', backgroundColor: '#ffffff' }}>
                    <FileText size={30} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No hay facturas con el criterio seleccionado.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="client-row-hover"
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', backgroundColor: '#ffffff' }}
                    onClick={() => onSelectInvoice?.(inv)}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ color: '#0f172a', fontSize: 13 }}>
                        {inv.Prefijo} {inv.Numero}
                      </strong>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{inv.Tipo_Documento}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#475569' }}>
                      {inv.Fecha_Emision ? inv.Fecha_Emision.split('T')[0] : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#475569' }}>
                      {inv.Fecha_Vencimiento ? inv.Fecha_Vencimiento.split('T')[0] : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          inv.estaVencida
                            ? inv.diasVencimientoCalc > 180
                              ? 'badge-critical'
                              : 'badge-danger'
                            : 'badge-success'
                        }`}
                        style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                      >
                        {inv.estaVencida ? `Vencida ${inv.diasVencimientoCalc}d` : 'Al día'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>
                      {formatCurrency(inv.Valor_Saldo)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button button-xs button-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInvoice?.(inv);
                        }}
                        style={{ padding: '4px 8px', fontSize: 11.5, whiteSpace: 'nowrap' }}
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── FOOTER DEL MODAL ─── */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Total en mora: <strong style={{ color: '#dc2626' }}>{formatCurrency(customer.totalVencido)}</strong> · {countVencidas} facturas vencidas
          </span>
          <button
            type="button"
            className="button button-sm button-secondary"
            onClick={onClose}
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
