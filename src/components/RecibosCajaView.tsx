import { useState, useMemo } from 'react';
import { ArrowDownRight, CheckCircle, FileText, Search } from 'lucide-react';
import type { ReciboCajaRecord } from '../types';
import { formatCurrency, formatNumber } from '../lib/carteraApi';

interface Props {
  recibos: ReciboCajaRecord[];
}

export function RecibosCajaView({ recibos }: Props) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const filtered = useMemo(() => {
    if (!search.trim()) return recibos;
    const term = search.toLowerCase().trim();
    return recibos.filter(
      (r) =>
        r.Empresa.toLowerCase().includes(term) ||
        r.Identificacion.includes(term) ||
        String(r.Numero_ReciboCaja).includes(term) ||
        String(r.Numero_FacturaVenta).includes(term) ||
        r.Nombre_Empleado.toLowerCase().includes(term)
    );
  }, [recibos, search]);

  const totalRecaudado = useMemo(() => {
    return filtered.reduce((sum, r) => sum + r.Valor_Pagado, 0);
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  return (
    <div className="aux-view-container">
      <div className="aux-summary-strip">
        <div className="aux-strip-left">
          <div className="icon-badge green">
            <CheckCircle size={22} />
          </div>
          <div>
            <h2>Recibos de Caja / Recaudos del Período</h2>
            <p>Comprobantes de pago y recaudo aplicados a facturas de venta.</p>
          </div>
        </div>

        <div className="aux-strip-kpi">
          <span className="lbl">Total Recaudado</span>
          <strong className="val green">{formatCurrency(totalRecaudado)}</strong>
          <span className="sub">{formatNumber(filtered.length)} recibos procesados</span>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input-field"
              placeholder="Buscar por cliente, NIT, # recibo, # factura, ejecutivo..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="table-stats-pill">
            <span>{formatNumber(filtered.length)} documentos encontrados</span>
          </div>
        </div>

        <div className="data-table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Recibo Caja</th>
                <th>Fecha Recaudo</th>
                <th>Cliente / NIT</th>
                <th>Factura Aplicada</th>
                <th style={{ textAlign: 'center' }}>Días Pago</th>
                <th style={{ textAlign: 'right' }}>Valor Factura</th>
                <th style={{ textAlign: 'right' }}>Valor Recaudado</th>
                <th>Gestor Comercial</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length > 0 ? (
                paginated.map((rc) => (
                  <tr key={rc.id}>
                    <td>
                      <strong className="doc-badge blue">
                        {rc.Prefijo_ReciboCaja || 'RC'} {rc.Numero_ReciboCaja}
                      </strong>
                    </td>
                    <td>{rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : 'N/A'}</td>
                    <td>
                      <div className="client-cell">
                        <span className="client-name">{rc.Empresa}</span>
                        <span className="client-nit">NIT: {rc.Identificacion}</span>
                      </div>
                    </td>
                    <td>
                      <span className="code-font">
                        {rc.Prefijo_FacturaVenta || 'FVE'} {rc.Numero_FacturaVenta}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-neutral">{rc.Dias_Pago} d</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(rc.Valor_Factura)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      {formatCurrency(rc.Valor_Pagado)}
                    </td>
                    <td>
                      <span className="comm-name">{rc.Nombre_Empleado}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '35px 20px', color: '#6b7280' }}>
                    No se registran recibos de caja para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="table-pagination-bar">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="pagination-nav-btns">
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
