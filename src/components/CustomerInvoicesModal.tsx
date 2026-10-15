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
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 940, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* ENCABEZADO */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {customer.empresa}
                </h2>
                <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                  NIT: {customer.nit}{customer.dv ? `-${customer.dv}` : ''}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                Comercial: <strong>{customer.comercial}</strong> · G{customer.grupo}: {customer.directorNombre}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={handleExportExcel}
              disabled={isExporting}
              title="Descargar facturas a Excel"
            >
              <Download size={13} />
              <span>{isExporting ? 'Descargando...' : 'Excel'}</span>
            </button>
            <button
              type="button"
              className="icon-btn-minimal"
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 8 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* STRIP DE CONTACTO DE TESORERÍA */}
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: contact?.correoTesoreria ? '#f0fdf4' : '#fff7ed',
            borderBottom: `1px solid ${contact?.correoTesoreria ? '#bbf7d0' : '#fed7aa'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={15} color={contact?.correoTesoreria ? '#16a34a' : '#c2410c'} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
              Correo de Tesorería:{' '}
              {contact?.correoTesoreria ? (
                <a
                  href={`mailto:${contact.correoTesoreria}`}
                  style={{ color: '#16a34a', fontWeight: 700, textDecoration: 'none' }}
                >
                  {contact.correoTesoreria}
                </a>
              ) : (
                <span style={{ color: '#c2410c', fontStyle: 'italic' }}>Sin registrar</span>
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
              }}
            >
              {contact?.correoTesoreria ? 'Editar Contacto' : '+ Registrar Correo'}
            </button>
          )}
        </div>

        {/* TARJETAS RESUMEN FINANCIERO */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Saldo Total
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              {formatCurrency(customer.totalSaldo)}
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>{invoices.length} facturas</span>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              Corriente (Al día)
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
              {formatCurrency(customer.totalCorriente)}
            </div>
            <span style={{ fontSize: 11, color: '#16a34a' }}>{countCorrientes} facturas</span>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              En Mora (Vencida)
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: customer.totalVencido > 0 ? '#dc2626' : '#64748b' }}>
              {formatCurrency(customer.totalVencido)}
            </div>
            <span style={{ fontSize: 11, color: '#dc2626' }}>{countVencidas} facturas</span>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Cupo & Plazo
            </span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              {formatCurrency(customer.cupoCredito)}
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>Plazo pago: {customer.plazoPago} días</span>
          </div>
        </div>

        {/* HERRAMIENTAS Y BÚSQUEDA */}
        <div
          style={{
            padding: '12px 24px',
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
              placeholder="Buscar por número de factura…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
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

        {/* TABLA DE FACTURAS */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 24px 20px' }}>
          <table className="cartera-table" style={{ width: '100%', marginTop: 12 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Documento</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Emisión</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Vencimiento</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Estado / Mora</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Saldo Pendiente</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
                    No hay facturas con el criterio seleccionado.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="client-row-hover"
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onClick={() => onSelectInvoice?.(inv)}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{ color: '#0f172a' }}>
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
                        style={{ fontSize: 11 }}
                      >
                        {inv.estaVencida ? `Vencida ${inv.diasVencimientoCalc}d` : 'Al día'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
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
      </div>
    </div>
  );
}
