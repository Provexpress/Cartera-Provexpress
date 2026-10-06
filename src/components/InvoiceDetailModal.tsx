import { Calendar, CheckCircle2, DollarSign, FileText, Package, User, Users, X } from 'lucide-react';
import type { CarteraRecord } from '../types';
import { formatCurrency, AGING_CONFIG } from '../lib/carteraApi';

interface Props {
  record: CarteraRecord | null;
  onClose: () => void;
}

export function InvoiceDetailModal({ record, onClose }: Props) {
  if (!record) return null;

  const ageConfig = AGING_CONFIG[record.categoriaEdad];

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

          {/* Tabla de Productos / Ítems de la Factura */}
          <div className="modal-section">
            <div className="modal-section-title">
              <Package size={16} />
              <span>Productos y Artículos Facturados ({record.Productos?.length || 0})</span>
            </div>

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
        </div>

        <div className="modal-footer">
          <div className="modal-footer-info">
            <CheckCircle2 size={15} style={{ color: '#18a957' }} />
            <span>Datos sincronizados directamente desde el ERP Provexpress</span>
          </div>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}
