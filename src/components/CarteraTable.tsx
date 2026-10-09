import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye, Search, ArrowUpDown, Download, Filter } from 'lucide-react';
import type { CarteraRecord } from '../types';
import { formatCurrency, formatNumber, AGING_CONFIG } from '../lib/carteraApi';

interface Props {
  records: CarteraRecord[];
  onSelectRecord: (record: CarteraRecord) => void;
  onExportExcel: () => void;
}

type SortField = 'Numero' | 'Empresa' | 'Nombre_Empleado' | 'Fecha_Vencimiento' | 'diasVencimientoCalc' | 'Valor_Saldo';

export function CarteraTable({ records, onSelectRecord, onExportExcel }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('Valor_Saldo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = records;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.Empresa.toLowerCase().includes(term) ||
          r.Identificacion.includes(term) ||
          String(r.Numero).includes(term) ||
          r.Nombre_Empleado.toLowerCase().includes(term) ||
          r.Prefijo.toLowerCase().includes(term)
      );
    }

    return [...result].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, searchTerm, sortField, sortOrder]);

  const totalFilteredSaldo = useMemo(() => {
    return filtered.reduce((sum, r) => sum + r.Valor_Saldo, 0);
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginated = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  return (
    <div className="table-card">
      <div className="table-toolbar">
        <div className="table-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input-field"
            placeholder="Buscar por cliente, NIT, # factura, ejecutivo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
            >
              ×
            </button>
          )}
        </div>

        <div className="table-toolbar-right">
          <div className="table-stats-pill">
            <span>
              <strong>{formatNumber(filtered.length)}</strong> facturas · Total:{' '}
              <strong className="blue">{formatCurrency(totalFilteredSaldo)}</strong>
            </span>
          </div>

          <button
            type="button"
            className="button button-sm button-secondary"
            onClick={onExportExcel}
            title="Descargar libro Excel completo"
          >
            <Download size={14} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => handleSort('Numero')} className="sortable-th">
                <div className="th-content">
                  <span>Documento</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('Empresa')} className="sortable-th">
                <div className="th-content">
                  <span>Cliente / NIT</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('Nombre_Empleado')} className="sortable-th">
                <div className="th-content">
                  <span>Comercial & Grupo</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('Fecha_Vencimiento')} className="sortable-th">
                <div className="th-content">
                  <span>Vencimiento</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('diasVencimientoCalc')} className="sortable-th" style={{ textAlign: 'center' }}>
                <div className="th-content center">
                  <span>Estado / Días</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('Valor_Saldo')} className="sortable-th" style={{ textAlign: 'right' }}>
                <div className="th-content right">
                  <span>Saldo Pendiente</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th style={{ textAlign: 'center', width: '90px' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length > 0 ? (
              paginated.map((r) => {
                const ageConfig = AGING_CONFIG[r.categoriaEdad];
                return (
                  <tr
                    key={r.id}
                    className="clickable-row"
                    onClick={() => onSelectRecord(r)}
                  >
                    <td>
                      <div className="doc-num-cell">
                        <strong className="doc-badge">{r.Prefijo} {r.Numero}</strong>
                        <span className="doc-sub-text">{r.Tipo_Documento}</span>
                      </div>
                    </td>
                    <td>
                      <div className="client-cell">
                        <span className="client-name" title={r.Empresa}>{r.Empresa}</span>
                        <span className="client-nit">NIT: {r.Identificacion}</span>
                      </div>
                    </td>
                    <td>
                      <div className="commercial-cell">
                        <span className="comm-name">{r.Nombre_Empleado}</span>
                        <span className="comm-group">{r.grupoNombre}</span>
                      </div>
                    </td>
                    <td>
                      <div className="date-cell">
                        <span className="date-val">
                          {r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : 'N/A'}
                        </span>
                        <span className="date-sub">Plazo: {r.Plazo_Pago}d</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${ageConfig.badgeClass}`}>
                        {r.estaVencida ? `${r.diasVencimientoCalc} d` : 'Al día'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="saldo-val">{formatCurrency(r.Valor_Saldo)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button-icon-subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord(r);
                        }}
                        title="Ver detalle de factura y productos"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  No se encontraron facturas con los criterios de búsqueda actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="table-pagination-bar">
        <div className="pagination-info">
          <span>
            Mostrando {filtered.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} a{' '}
            {Math.min(safeCurrentPage * pageSize, filtered.length)} de {formatNumber(filtered.length)} facturas
          </span>
          <select
            className="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={25}>25 por pág.</option>
            <option value={50}>50 por pág.</option>
            <option value={100}>100 por pág.</option>
          </select>
        </div>

        <div className="pagination-nav-btns">
          <button
            type="button"
            className="pagination-btn"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
            <span>Anterior</span>
          </button>
          <span className="current-page-badge">
            Página {safeCurrentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="pagination-btn"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <span>Siguiente</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
