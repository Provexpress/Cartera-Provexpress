import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  FileText,
  DollarSign,
  User,
  Building,
  Filter,
} from 'lucide-react';
import type { CarteraRecord, ExecutiveSummary, GroupSummary } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';

interface Props {
  executive: ExecutiveSummary | null;
  records: CarteraRecord[];
  onClose: () => void;
  onSelectRecord?: (record: CarteraRecord) => void;
  onViewInFullTable?: (name: string, grupo: number, director: string) => void;
}

export function ExecutiveInvoicesModal({
  executive,
  records,
  onClose,
  onSelectRecord,
  onViewInFullTable,
}: Props) {
  if (!executive) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'current'>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Facturas de este comercial
  const executiveRecords = useMemo(() => {
    const execNameLower = executive.nombre.toLowerCase().trim();
    return records.filter(
      (r) => (r.Nombre_Empleado || '').toLowerCase().trim() === execNameLower
    );
  }, [records, executive]);

  // Facturas filtradas por buscador y estado
  const filteredInvoices = useMemo(() => {
    let list = executiveRecords;

    if (statusFilter === 'overdue') {
      list = list.filter((r) => r.estaVencida);
    } else if (statusFilter === 'current') {
      list = list.filter((r) => !r.estaVencida);
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();

    return list.filter(
      (r) =>
        r.Empresa.toLowerCase().includes(q) ||
        r.Identificacion.includes(q) ||
        String(r.Numero).includes(q) ||
        (r.Prefijo && r.Prefijo.toLowerCase().includes(q))
    );
  }, [executiveRecords, statusFilter, searchTerm]);

  // Métricas calculadas
  const totalSaldo = useMemo(
    () => executiveRecords.reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [executiveRecords]
  );
  const totalCorriente = useMemo(
    () => executiveRecords.filter((r) => !r.estaVencida).reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [executiveRecords]
  );
  const totalVencido = useMemo(
    () => executiveRecords.filter((r) => r.estaVencida).reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [executiveRecords]
  );
  const countVencidas = useMemo(
    () => executiveRecords.filter((r) => r.estaVencida).length,
    [executiveRecords]
  );
  const countCorrientes = useMemo(
    () => executiveRecords.filter((r) => !r.estaVencida).length,
    [executiveRecords]
  );

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const { generateCarteraExcel, downloadBufferAsFile } = await import('../lib/excelGenerator');
      const dummyDataState: any = {
        fechaCorte: new Date().toISOString().split('T')[0],
        totalSaldo,
        totalCorriente,
        totalVencido,
        porcentajeVencido: totalSaldo > 0 ? (totalVencido / totalSaldo) * 100 : 0,
        totalDocumentos: executiveRecords.length,
        clientesUnicos: new Set(executiveRecords.map((r) => r.Identificacion)).size,
        records: executiveRecords,
      };
      const { buffer, filename } = await generateCarteraExcel(dummyDataState, executiveRecords);
      const customFilename = `Cartera_${executive.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadBufferAsFile(buffer, customFilename);
    } catch (err) {
      console.error('Error al exportar facturas del ejecutivo:', err);
      alert('Error al generar Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-card modal-large"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1100px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {/* ─── HEADER DEL MODAL ─── */}
        <div
          className="modal-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#111827' }}>
                  {executive.nombre}
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    backgroundColor: '#E0E7FF',
                    color: '#4338CA',
                  }}
                >
                  {executive.grupoNombre}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    backgroundColor: executive.porcentajeVencido > 40 ? '#FEE2E2' : '#FEF3C7',
                    color: executive.porcentajeVencido > 40 ? '#B91C1C' : '#B45309',
                  }}
                >
                  {formatPercent(executive.porcentajeVencido)} mora
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                Director Comercial: <strong>{executive.directorNombre}</strong> · Total:{' '}
                <strong>{formatNumber(executiveRecords.length)} facturas abiertas</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={handleExportExcel}
              disabled={isExporting || executiveRecords.length === 0}
              title="Descargar las facturas de este comercial en Excel institucional"
            >
              <Download size={14} />
              <span>{isExporting ? 'Generando...' : 'Descargar Excel'}</span>
            </button>

            {onViewInFullTable && (
              <button
                type="button"
                className="button button-sm button-primary"
                onClick={() => {
                  onClose();
                  onViewInFullTable(executive.nombre, executive.grupo, executive.directorNombre);
                }}
                title="Ver y filtrar todas estas facturas en la tabla completa de cartera"
              >
                <span>Ver en Tabla Completa</span>
                <ExternalLink size={14} />
              </button>
            )}

            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              aria-label="Cerrar modal"
              style={{ marginLeft: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── 3 KPI CARDS DEL COMERCIAL ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            padding: '16px 24px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Saldo Total Abierto
            </span>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {formatCurrency(totalSaldo)}
            </div>
            <span style={{ fontSize: 11, color: '#64748B' }}>
              {formatNumber(executiveRecords.length)} facturas pendientes
            </span>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#F0FDF4',
              borderRadius: 12,
              border: '1px solid #BBF7D0',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              Corriente (Al día)
            </span>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
              {formatCurrency(totalCorriente)}
            </div>
            <span style={{ fontSize: 11, color: '#166534' }}>
              {formatNumber(countCorrientes)} facturas al día
            </span>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#FEF2F2',
              borderRadius: 12,
              border: '1px solid #FECACA',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
              Cartera en Mora
            </span>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#DC2626', marginTop: 2 }}>
              {formatCurrency(totalVencido)}
            </div>
            <span style={{ fontSize: 11, color: '#991B1B' }}>
              {formatNumber(countVencidas)} facturas vencidas ({formatPercent(executive.porcentajeVencido)})
            </span>
          </div>
        </div>

        {/* ─── BARRA DE HERRAMIENTAS Y BÚSQUEDA ─── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Input Buscador */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              backgroundColor: '#F3F4F6',
              borderRadius: 8,
              width: 'min(360px, 100%)',
            }}
          >
            <Search size={15} color="#6B7280" />
            <input
              type="text"
              placeholder="Buscar por cliente, NIT o factura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                width: '100%',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros de Estado */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === 'all' ? '#1F2937' : '#F3F4F6',
                color: statusFilter === 'all' ? '#FFFFFF' : '#4B5563',
              }}
            >
              Todas ({executiveRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === 'overdue' ? '#DC2626' : '#FEE2E2',
                color: statusFilter === 'overdue' ? '#FFFFFF' : '#B91C1C',
              }}
            >
              Vencidas ({countVencidas})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('current')}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === 'current' ? '#16A34A' : '#DCFCE7',
                color: statusFilter === 'current' ? '#FFFFFF' : '#15803D',
              }}
            >
              Al día ({countCorrientes})
            </button>
          </div>
        </div>

        {/* ─── TABLA DE FACTURAS PENDIENTES DEL COMERCIAL ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
          {filteredInvoices.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#6B7280' }}>
              <FileText size={36} color="#9CA3AF" style={{ margin: '0 auto 12px' }} />
              <strong style={{ fontSize: 15, display: 'block', color: '#374151' }}>
                No se encontraron facturas pendientes
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                {searchTerm
                  ? 'Intenta con otro término de búsqueda.'
                  : 'Este comercial no tiene facturas en este estado.'}
              </p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 3, backgroundColor: '#f8fafc' }}>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ width: '140px', backgroundColor: '#f8fafc' }}>Documento</th>
                  <th style={{ backgroundColor: '#f8fafc' }}>Cliente</th>
                  <th style={{ width: '130px', backgroundColor: '#f8fafc' }}>Vencimiento</th>
                  <th style={{ textAlign: 'center', width: '110px', backgroundColor: '#f8fafc' }}>Estado / Mora</th>
                  <th style={{ textAlign: 'right', width: '150px', backgroundColor: '#f8fafc' }}>Saldo Pendiente</th>
                  <th style={{ textAlign: 'center', width: '100px', backgroundColor: '#f8fafc' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="clickable-row"
                    onClick={() => onSelectRecord?.(inv)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="doc-num-cell">
                        <strong className="doc-badge">
                          {inv.Prefijo || 'FVE'} {inv.Numero}
                        </strong>
                        <span className="doc-sub-text">{inv.Tipo_Documento}</span>
                      </div>
                    </td>
                    <td>
                      <div className="client-cell">
                        <span className="client-name" title={inv.Empresa}>
                          {inv.Empresa}
                        </span>
                        <span className="client-nit">NIT: {inv.Identificacion}-{inv.Dv || '0'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="date-cell">
                        <span className="date-val">
                          {inv.Fecha_Vencimiento ? inv.Fecha_Vencimiento.split('T')[0] : 'N/A'}
                        </span>
                        <span className="date-sub">Plazo: {inv.Plazo_Pago}d</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          inv.estaVencida
                            ? inv.diasVencimientoCalc > 180
                              ? 'badge-critical'
                              : 'badge-danger'
                            : 'badge-success'
                        }`}
                      >
                        {inv.estaVencida ? `${inv.diasVencimientoCalc} d` : 'Al día'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="saldo-val">{formatCurrency(inv.Valor_Saldo)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button-icon-subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord?.(inv);
                        }}
                        title="Ver detalle completo de factura y productos"
                      >
                        Ver Detalle →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
