import { useState, useMemo } from 'react';
import { FileSpreadsheet, Percent, Search } from 'lucide-react';
import type { NotaCreditoRecord } from '../types';
import { formatCurrency, formatNumber } from '../lib/carteraApi';

interface Props {
  notas: NotaCreditoRecord[];
}

export function NotasCreditoView({ notas }: Props) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const filtered = useMemo(() => {
    if (!search.trim()) return notas;
    const term = search.toLowerCase().trim();
    return notas.filter(
      (n) =>
        n.Empresa.toLowerCase().includes(term) ||
        n.Identificacion.includes(term) ||
        String(n.Numero).includes(term) ||
        String(n.Numero_Factura).includes(term) ||
        n.Nombre_Empleado.toLowerCase().includes(term)
    );
  }, [notas, search]);

  const totalNotas = useMemo(() => {
    return filtered.reduce((sum, n) => sum + n.Valor_NotaCredito, 0);
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
          <div className="icon-badge purple">
            <Percent size={22} />
          </div>
          <div>
            <h2>Notas Crédito del Período</h2>
            <p>Ajustes, descuentos y devoluciones que afectan la cartera bruta.</p>
          </div>
        </div>

        <div className="aux-strip-kpi">
          <span className="lbl">Total Notas Crédito</span>
          <strong className="val purple">{formatCurrency(totalNotas)}</strong>
          <span className="sub">{formatNumber(filtered.length)} notas procesadas</span>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input-field"
              placeholder="Buscar por cliente, NIT, # nota, # factura, ejecutivo..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="table-stats-pill">
            <span>{formatNumber(filtered.length)} notas encontradas</span>
          </div>
        </div>

        <div className="data-table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nota Crédito</th>
                <th>Fecha Emisión</th>
                <th>Cliente / NIT</th>
                <th>Factura Asociada</th>
                <th style={{ textAlign: 'right' }}>Valor Nota Crédito</th>
                <th>Gestor Comercial</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length > 0 ? (
                paginated.map((nc) => (
                  <tr key={nc.id}>
                    <td>
                      <strong className="doc-badge purple">
                        {nc.Prefijo || 'NCE'} {nc.Numero}
                      </strong>
                    </td>
                    <td>{nc.Fecha_Emision ? nc.Fecha_Emision.split('T')[0] : 'N/A'}</td>
                    <td>
                      <div className="client-cell">
                        <span className="client-name">{nc.Empresa}</span>
                        <span className="client-nit">NIT: {nc.Identificacion}</span>
                      </div>
                    </td>
                    <td>
                      <span className="code-font">
                        {nc.Numero_Factura > 0
                          ? `${nc.Prefijo_Factura || 'FVE'} ${nc.Numero_Factura}`
                          : 'General'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#9333ea' }}>
                      {formatCurrency(nc.Valor_NotaCredito)}
                    </td>
                    <td>
                      <span className="comm-name">{nc.Nombre_Empleado}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '35px 20px', color: '#6b7280' }}>
                    No se registran notas crédito para los filtros seleccionados.
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
