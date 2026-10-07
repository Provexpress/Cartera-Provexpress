import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import {
  TrendingUp,
  CalendarRange,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Filter,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import ExcelJSRuntime from 'exceljs';
import type { CarteraRecord, ReciboCajaRecord } from '../types';
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../lib/carteraApi';
import { LISTA_DIRECTORES } from '../lib/commercialDirectory';

interface Props {
  records: CarteraRecord[];
  recibos: ReciboCajaRecord[];
  fechaBase?: string;
  onSelectRecord?: (record: CarteraRecord) => void;
  onNavigateToGestion?: () => void;
}

interface CohortPoint {
  cutoff: string;
  initialPending: number;
  initialCount: number;
  stillOpenPending: number;
  stillOpenCount: number;
  withdrawnPending: number;
  withdrawnCount: number;
  recoveryPct: number;
  stillOpenPct: number;
  dailyWithdrawnPending: number;
  dailyWithdrawnCount: number;
  dailyDeltaPct: number;
}

function formatCutoffText(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const y = parts[0];
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} de ${months[m - 1] || m} de ${y}`;
}

function formatCutoffShort(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

export function EvolucionBaseView({
  records,
  recibos,
  fechaBase = '2026-10-06',
  onSelectRecord,
  onNavigateToGestion,
}: Props) {
  const [selectedCutoff, setSelectedCutoff] = useState<string>(fechaBase);
  const [chartMode, setChartMode] = useState<'both' | 'money' | 'docs'>('both');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Subfiltro de la tabla de la cohorte
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'killed'>('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDirector, setSelectedDirector] = useState<string>('Todos');

  // ─── 1. BASE INICIAL RECIBIDA AL CORTE DE CONTROL (<= 2026-10-06) ─────────
  const baseReceivedInvoices = useMemo(() => {
    return records.filter((r) => {
      const emision = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      return emision <= fechaBase;
    });
  }, [records, fechaBase]);

  // Recaudos de caja asociados a las facturas
  const recibosRelevantes = useMemo(() => {
    return recibos.filter((rc) => {
      const fecha = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      return fecha >= fechaBase;
    });
  }, [recibos, fechaBase]);

  // Identificar qué facturas de la base ya tienen recibos que las matan o abonan
  const invoiceRecibosMap = useMemo(() => {
    const map = new Map<string, ReciboCajaRecord[]>();
    recibos.forEach((rc) => {
      const key = `${rc.Prefijo_FacturaVenta}-${rc.Numero_FacturaVenta}`.trim().toLowerCase();
      const list = map.get(key) || [];
      list.push(rc);
      map.set(key, list);
    });
    return map;
  }, [recibos]);

  // Fechas únicas para la serie cronológica
  const cohortDates = useMemo(() => {
    const datesSet = new Set<string>();
    datesSet.add(fechaBase);

    recibosRelevantes.forEach((rc) => {
      const f = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      if (f && f >= fechaBase) datesSet.add(f);
    });

    return Array.from(datesSet).sort();
  }, [fechaBase, recibosRelevantes]);

  // Construcción de la Serie de Desmonte (Idéntico a Remisiones)
  const cohortSeries: CohortPoint[] = useMemo(() => {
    if (!cohortDates.length) return [];

    const totalRecaudadoBase = recibosRelevantes.reduce((sum, rc) => sum + rc.Valor_Pagado, 0);
    const totalOpenPendingInitialBase = baseReceivedInvoices.reduce((sum, r) => sum + r.Valor_Saldo, 0);

    const initialPending = totalOpenPendingInitialBase + totalRecaudadoBase;
    const initialCount = baseReceivedInvoices.length + recibosRelevantes.length;

    let accumulatedWithdrawn = 0;
    let accumulatedWithdrawnCount = 0;
    let prevStillOpenPending = initialPending;

    return cohortDates.map((cutoff) => {
      const dayRecibos = recibosRelevantes.filter((rc) => {
        const f = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
        return f === cutoff;
      });

      const dailyWithdrawnPending = dayRecibos.reduce((sum, rc) => sum + rc.Valor_Pagado, 0);
      const dailyWithdrawnCount = dayRecibos.length;

      accumulatedWithdrawn += dailyWithdrawnPending;
      accumulatedWithdrawnCount += dailyWithdrawnCount;

      const stillOpenPending = Math.max(0, initialPending - accumulatedWithdrawn);
      const stillOpenCount = Math.max(0, initialCount - accumulatedWithdrawnCount);
      const recoveryPct = initialPending > 0 ? accumulatedWithdrawn / initialPending : 0;
      const stillOpenPct = initialPending > 0 ? stillOpenPending / initialPending : 0;
      const dailyDeltaPct = prevStillOpenPending > 0 ? dailyWithdrawnPending / prevStillOpenPending : 0;

      prevStillOpenPending = stillOpenPending;

      return {
        cutoff,
        initialPending,
        initialCount,
        stillOpenPending,
        stillOpenCount,
        withdrawnPending: accumulatedWithdrawn,
        withdrawnCount: accumulatedWithdrawnCount,
        recoveryPct,
        stillOpenPct,
        dailyWithdrawnPending,
        dailyWithdrawnCount,
        dailyDeltaPct,
      };
    });
  }, [cohortDates, baseReceivedInvoices, recibosRelevantes]);

  const initialPoint = cohortSeries[0] || {
    cutoff: fechaBase,
    initialPending: 0,
    initialCount: 0,
    stillOpenPending: 0,
    stillOpenCount: 0,
    withdrawnPending: 0,
    withdrawnCount: 0,
    recoveryPct: 0,
    stillOpenPct: 1,
    dailyWithdrawnPending: 0,
    dailyWithdrawnCount: 0,
    dailyDeltaPct: 0,
  };

  const latestPoint = cohortSeries[cohortSeries.length - 1] || initialPoint;

  // Lista de facturas para la tabla de la cohorte
  const filteredBaseInvoices = useMemo(() => {
    let list = baseReceivedInvoices;

    if (selectedDirector !== 'Todos') {
      list = list.filter((r) => (r.directorNombre || '') === selectedDirector);
    }

    if (statusFilter === 'open') {
      list = list.filter((r) => r.Valor_Saldo > 0);
    } else if (statusFilter === 'killed') {
      list = list.filter((r) => {
        const key = `${r.Prefijo}-${r.Numero}`.trim().toLowerCase();
        const rcs = invoiceRecibosMap.get(key) || [];
        return rcs.some((rc) => rc.Valor_Pagado >= rc.Valor_Factura) || r.Valor_Saldo === 0;
      });
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();

    return list.filter(
      (r) =>
        r.Empresa?.toLowerCase().includes(q) ||
        r.Identificacion?.includes(q) ||
        String(r.Numero).includes(q) ||
        r.Prefijo?.toLowerCase().includes(q) ||
        r.Nombre_Empleado?.toLowerCase().includes(q) ||
        r.directorNombre?.toLowerCase().includes(q)
    );
  }, [baseReceivedInvoices, selectedDirector, statusFilter, searchTerm, invoiceRecibosMap]);

  // Exportar Colecta de Facturas a Excel
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const workbook = new ExcelJSRuntime.Workbook();
      workbook.creator = 'Provexpress SAS · Cartera';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Base Inicial 06-10');

      worksheet.columns = [
        { header: '#', key: 'rank', width: 6 },
        { header: 'No. Factura', key: 'factura', width: 16 },
        { header: 'Cliente / Empresa', key: 'empresa', width: 34 },
        { header: 'NIT', key: 'nit', width: 14 },
        { header: 'Comercial Asesor', key: 'comercial', width: 28 },
        { header: 'Director Comercial', key: 'director', width: 26 },
        { header: 'Saldo Cartera', key: 'saldo', width: 18 },
        { header: 'Estado Cobro', key: 'estado', width: 18 },
        { header: 'Categoría Edad', key: 'edad', width: 16 },
        { header: 'Días Vencimiento', key: 'dias', width: 16 },
        { header: 'Fecha Emisión', key: 'fechaEmision', width: 16 },
        { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 16 },
      ];

      filteredBaseInvoices.forEach((r, idx) => {
        const key = `${r.Prefijo}-${r.Numero}`.trim().toLowerCase();
        const rcs = invoiceRecibosMap.get(key) || [];
        const isKilled = rcs.some((rc) => rc.Valor_Pagado >= rc.Valor_Factura) || r.Valor_Saldo === 0;

        const row = worksheet.addRow({
          rank: idx + 1,
          factura: `${r.Prefijo} ${r.Numero}`.trim(),
          empresa: r.Empresa,
          nit: r.Identificacion,
          comercial: r.Nombre_Empleado,
          director: r.directorNombre,
          saldo: r.Valor_Saldo,
          estado: isKilled ? '100% MATADA' : 'PENDIENTE',
          edad: r.categoriaEdad,
          dias: r.Dias_Vencimiento,
          fechaEmision: r.Fecha_Emision?.split('T')[0] || '',
          fechaVencimiento: r.Fecha_Vencimiento?.split('T')[0] || '',
        });
        row.getCell('saldo').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
        row.getCell('saldo').font = { bold: true };
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B21A8' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartera-base-inicial-06-octubre-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="evolucion-view-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── BANNER SUPERIOR INFORMATIVO DE LA BASE INICIAL ENTREGADA ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 22px',
          background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
          border: '1.5px solid #D8B4FE',
          borderRadius: 16,
          boxShadow: '0 2px 10px rgba(126, 34, 206, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#9333EA',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.35)',
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="evolution-chip initial" style={{ fontSize: 11, padding: '2px 8px' }}>
                Base Inicial Fija
              </span>
              <strong style={{ fontSize: 16, color: '#581C87' }}>
                Cartera Recibida al Inicio de la Gestión (Corte {formatCutoffText(fechaBase)})
              </strong>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6B21A8' }}>
              Seguimiento exclusivo al desmonte de las <strong>{formatNumber(baseReceivedInvoices.length)} facturas</strong> entregadas para gestión de cobro ({formatCurrency(latestPoint.initialPending)}). No ingresa facturación nueva a esta base.
            </p>
          </div>
        </div>

        {onNavigateToGestion && (
          <button
            type="button"
            className="button button-sm button-primary"
            onClick={onNavigateToGestion}
            style={{
              backgroundColor: '#16A34A',
              borderColor: '#15803D',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
            }}
            title="Ver el proceso operativo diario desde el 07 de octubre"
          >
            <CalendarRange size={14} />
            <span>Ver Gestión del Proceso (Desde 07/10) →</span>
          </button>
        )}
      </div>

      {/* ─── SECCIÓN 1: TARJETAS DE RESUMEN DEL DESMONTE (ESTILO REMISIONES) ─── */}
      <div className="management-daily-history-card">
        <div className="management-table-header">
          <div>
            <div className="evolution-tag purple">
              <CalendarRange size={13} />
              <span>Desmonte de la Cohorte Inicial Día a Día</span>
            </div>
            <h3 style={{ margin: '4px 0 2px', fontSize: 18, fontWeight: 800 }}>
              Seguimiento Cronológico del Desmonte ({formatCutoffText(fechaBase)})
            </h3>
            <small style={{ color: '#6e6e73', fontSize: 12 }}>
              Evolución corte a corte de las facturas recibidas: saldo restante y facturas matadas por recibos de caja.
            </small>
          </div>

          <div className="mgmt-header-actions-row">
            <div className="mgmt-legend-row">
              <span className="mgmt-legend-item favorable-legend">▼ Saldo bajó ese día (Recaudado)</span>
              <span className="mgmt-legend-item blue-legend">Saldo restante</span>
            </div>

            <button
              type="button"
              className="btn-download-excel"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              title="Descargar Excel con el estado de la base inicial entregada"
            >
              <Download size={14} />
              <span>{isExportingExcel ? 'Generando...' : 'Descargar Excel de la Base'}</span>
            </button>
          </div>
        </div>

        {/* 1.1 Tarjetas de KPI del Desmonte */}
        <div className="timeline-summary-cards">
          {/* Tarjeta 1: Total Dinero que ha Bajado */}
          <div className="timeline-summary-card tone-green">
            <div className="timeline-summary-top">
              <span className="timeline-summary-label">Total Dinero que ha Bajado</span>
              <span className="cohort-kpi-badge green">Recaudado</span>
            </div>
            <strong className="timeline-summary-value text-green">
              ▼ -{formatCurrency(latestPoint.withdrawnPending)}
            </strong>
            <span className="timeline-summary-sub">
              <strong>{formatPercent(latestPoint.recoveryPct * 100)}</strong> recuperado de la base inicial recibida
            </span>
          </div>

          {/* Tarjeta 2: Total Facturas Matadas */}
          <div className="timeline-summary-card tone-green">
            <div className="timeline-summary-top">
              <span className="timeline-summary-label">Total Facturas Matadas</span>
              <span className="cohort-kpi-badge green">Cerradas</span>
            </div>
            <strong className="timeline-summary-value text-green">
              ▼ -{formatNumber(latestPoint.withdrawnCount)} facturas
            </strong>
            <span className="timeline-summary-sub">
              <strong>
                {formatPercent(
                  initialPoint.initialCount > 0
                    ? (latestPoint.withdrawnCount / initialPoint.initialCount) * 100
                    : 0
                )}
              </strong>{' '}
              saldadas con recibo de caja
            </span>
          </div>

          {/* Tarjeta 3: Saldo Restante de la Base */}
          <div className="timeline-summary-card tone-blue">
            <div className="timeline-summary-top">
              <span className="timeline-summary-label">Saldo Restante de la Base</span>
              <span className="cohort-kpi-badge purple">Por Cobrar</span>
            </div>
            <strong className="timeline-summary-value text-blue">
              {formatCurrency(latestPoint.stillOpenPending)}
            </strong>
            <span className="timeline-summary-sub">
              <strong>{formatNumber(latestPoint.stillOpenCount)} facturas</strong> aún abiertas de la base recibida
            </span>
          </div>
        </div>

        {/* 1.2 Gráfico Dual-Axis de Desmonte Corte a Corte */}
        <div style={{ marginTop: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1d1d1f' }}>
              Evolución Gráfica del Desmonte Corte a Corte
            </span>
            <div className="evolution-chart-type-pill">
              <button
                type="button"
                className={chartMode === 'both' ? 'active' : ''}
                onClick={() => setChartMode('both')}
              >
                Ambos
              </button>
              <button
                type="button"
                className={chartMode === 'money' ? 'active' : ''}
                onClick={() => setChartMode('money')}
              >
                Solo Dinero ($)
              </button>
              <button
                type="button"
                className={chartMode === 'docs' ? 'active' : ''}
                onClick={() => setChartMode('docs')}
              >
                Solo Facturas (#)
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={cohortSeries}
              margin={{ top: 20, right: 30, left: 10, bottom: 4 }}
              barGap={6}
            >
              <CartesianGrid stroke="#ededf0" vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="cutoff"
                tickFormatter={(val) => formatCutoffShort(val)}
                tickLine={false}
                axisLine={{ stroke: '#e5e5ea' }}
                tick={{ fontSize: 11, fill: '#636366' }}
              />

              {(chartMode === 'both' || chartMode === 'money') && (
                <YAxis
                  yAxisId="moneyAxis"
                  orientation="left"
                  tickFormatter={(val) => formatCompactCurrency(val)}
                  tickLine={false}
                  axisLine={false}
                  width={76}
                  tick={{ fontSize: 11, fill: '#0071e3', fontWeight: 650 }}
                />
              )}

              {(chartMode === 'both' || chartMode === 'docs') && (
                <YAxis
                  yAxisId="docsAxis"
                  orientation={chartMode === 'both' ? 'right' : 'left'}
                  tickFormatter={(val) => `${formatNumber(val)} f.`}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fontSize: 11, fill: '#7928ca', fontWeight: 650 }}
                />
              )}

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload as CohortPoint;
                  return (
                    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
                      <strong style={{ fontSize: 12.5, color: '#1d1d1f', display: 'block', marginBottom: 4 }}>
                        Corte al {formatCutoffText(pt.cutoff)}
                      </strong>
                      <div style={{ fontSize: 11, color: '#0071e3', fontWeight: 700 }}>
                        Saldo restante: {formatCurrency(pt.stillOpenPending)}
                      </div>
                      <div style={{ fontSize: 11, color: '#7928ca', fontWeight: 700 }}>
                        Facturas abiertas: {formatNumber(pt.stillOpenCount)}
                      </div>
                      <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700, marginTop: 4, borderTop: '1px solid #ededf0', paddingTop: 4 }}>
                        Recaudado total: -{formatCurrency(pt.withdrawnPending)} ({formatPercent(pt.recoveryPct * 100)})
                      </div>
                      <div style={{ fontSize: 11, color: '#15803d' }}>
                        Facturas matadas: -{formatNumber(pt.withdrawnCount)}
                      </div>
                    </div>
                  );
                }}
              />

              {(chartMode === 'both' || chartMode === 'money') && (
                <Bar
                  yAxisId="moneyAxis"
                  dataKey="stillOpenPending"
                  name="Saldo en Dinero ($)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                  cursor="pointer"
                >
                  <LabelList
                    dataKey="stillOpenPending"
                    position="top"
                    formatter={(val: any) => formatCompactCurrency(Number(val))}
                    style={{ fontSize: '10px', fontWeight: 700, fill: '#0071e3' }}
                  />
                  {cohortSeries.map((entry) => (
                    <Cell
                      key={`money-${entry.cutoff}`}
                      fill={entry.cutoff === selectedCutoff ? '#0071e3' : '#8ac2ff'}
                      onClick={() => setSelectedCutoff(entry.cutoff)}
                    />
                  ))}
                </Bar>
              )}

              {(chartMode === 'both' || chartMode === 'docs') && (
                <Bar
                  yAxisId="docsAxis"
                  dataKey="stillOpenCount"
                  name="Facturas Restantes (#)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                  cursor="pointer"
                >
                  <LabelList
                    dataKey="stillOpenCount"
                    position="top"
                    formatter={(val: any) => `${formatNumber(Number(val))} f.`}
                    style={{ fontSize: '10px', fontWeight: 750, fill: '#7928ca' }}
                  />
                  {cohortSeries.map((entry) => (
                    <Cell
                      key={`docs-${entry.cutoff}`}
                      fill={entry.cutoff === selectedCutoff ? '#7928ca' : '#cbb2f5'}
                      onClick={() => setSelectedCutoff(entry.cutoff)}
                    />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 1.3 Tarjetas Día a Día (Seguimiento Cronológico) */}
        <div className="mgmt-day-cards-list">
          {cohortSeries.map((pt, idx, arr) => {
            const isSelected = pt.cutoff === selectedCutoff;
            const isInitial = pt.cutoff === initialPoint.cutoff;
            const isLatest = idx === arr.length - 1 && arr.length > 1;
            const dailyWithdrawn = pt.dailyWithdrawnPending || 0;
            const dailyCount = pt.dailyWithdrawnCount || 0;
            const hasDailyWithdrawn = dailyWithdrawn > 0;

            return (
              <div
                key={pt.cutoff}
                className={`mgmt-day-card desmonte-card tone-${
                  isInitial ? 'base' : hasDailyWithdrawn ? 'favorable' : 'neutral'
                } ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedCutoff(pt.cutoff)}
                role="button"
                tabIndex={0}
                title={`Ver desmonte al ${formatCutoffText(pt.cutoff)}`}
              >
                <div className="mgmt-day-card-date">
                  <strong>{formatCutoffText(pt.cutoff)}</strong>
                  <div className="mgmt-day-chips">
                    {isSelected && <span className="evolution-chip active">Activo</span>}
                    {isInitial && <span className="evolution-chip initial">Base inicial</span>}
                    {isLatest && !isSelected && <span className="evolution-chip latest">Hoy</span>}
                  </div>
                </div>

                <div className="mgmt-day-card-saldo">
                  <small className="mgmt-day-card-sublabel">Saldo restante</small>
                  <strong className="mgmt-day-card-money">{formatCurrency(pt.stillOpenPending)}</strong>
                  <small className="text-muted">{formatNumber(pt.stillOpenCount)} facturas abiertas</small>
                </div>

                <div className="mgmt-day-card-flow out">
                  <small className="mgmt-day-card-sublabel">⬇ Salieron este día (Recaudos)</small>
                  {isInitial ? (
                    <span className="text-muted" style={{ fontSize: '11px' }}>Base de partida</span>
                  ) : dailyCount > 0 ? (
                    <>
                      <strong className="mgmt-flow-out">-{formatNumber(dailyCount)} facturas</strong>
                      <small style={{ color: '#15803d', fontSize: '10px', fontWeight: 650 }}>
                        -{formatCurrency(dailyWithdrawn)}
                      </small>
                    </>
                  ) : (
                    <span className="text-muted" style={{ fontSize: '11px' }}>0 facturas salieron</span>
                  )}
                </div>

                <div
                  className={`mgmt-day-card-balance tone-${
                    isInitial ? 'base' : hasDailyWithdrawn ? 'favorable' : 'neutral'
                  }`}
                >
                  {isInitial ? (
                    <div className="mgmt-balance-body">
                      <strong className="mgmt-balance-amount">$ 0</strong>
                      <small className="mgmt-balance-pct">Línea base</small>
                    </div>
                  ) : (
                    <>
                      <span className="mgmt-balance-icon down-icon">▼</span>
                      <div className="mgmt-balance-body">
                        <strong className="mgmt-balance-amount">
                          -{formatCurrency(dailyWithdrawn)}
                        </strong>
                        <small className="mgmt-balance-pct">
                          Bajó {formatPercent((pt.dailyDeltaPct || 0) * 100)} ese día
                        </small>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── SECCIÓN 2: AUDITORÍA DE FACTURAS DE LA BASE INICIAL ─── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          padding: 20,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 750, color: '#0F172A' }}>
              Facturas Entregadas en la Base Inicial ({formatNumber(filteredBaseInvoices.length)})
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748B' }}>
              Inventario de facturas con fecha de emisión hasta el {formatCutoffText(fechaBase)}.
            </p>
          </div>

          {/* Filtros: Sub-estado + Director + Buscador */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Toggle de Sub-estado */}
            <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 650,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'open' ? '#FFFFFF' : 'transparent',
                  color: statusFilter === 'open' ? '#0F172A' : '#64748B',
                  boxShadow: statusFilter === 'open' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                🔴 Abiertas ({baseReceivedInvoices.filter((r) => r.Valor_Saldo > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('killed')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 650,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'killed' ? '#FFFFFF' : 'transparent',
                  color: statusFilter === 'killed' ? '#15803D' : '#64748B',
                  boxShadow: statusFilter === 'killed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                🟢 Matadas con Recibo
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 650,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'all' ? '#FFFFFF' : 'transparent',
                  color: statusFilter === 'all' ? '#0F172A' : '#64748B',
                  boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Todas ({baseReceivedInvoices.length})
              </button>
            </div>

            {/* Director */}
            <select
              value={selectedDirector}
              onChange={(e) => setSelectedDirector(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                outline: 'none',
              }}
            >
              <option value="Todos">Todos los Directores</option>
              {LISTA_DIRECTORES.map((d) => (
                <option key={d.nombre} value={d.nombre}>
                  {d.nombre}
                </option>
              ))}
            </select>

            {/* Buscador */}
            <div style={{ position: 'relative', width: 220 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                }}
              />
              <input
                type="text"
                placeholder="Buscar cliente, NIT, factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: 12,
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>#</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>No. Factura</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Cliente / Empresa</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>NIT</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Comercial</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Director</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                  Saldo Cartera
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                  Estado
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Emisión</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {filteredBaseInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px 14px', color: '#94A3B8' }}>
                    No se encontraron facturas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredBaseInvoices.slice(0, 100).map((r, idx) => {
                  const key = `${r.Prefijo}-${r.Numero}`.trim().toLowerCase();
                  const rcs = invoiceRecibosMap.get(key) || [];
                  const isKilled = rcs.some((rc) => rc.Valor_Pagado >= rc.Valor_Factura) || r.Valor_Saldo === 0;

                  return (
                    <tr
                      key={r.id || `inv-${idx}`}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        cursor: onSelectRecord ? 'pointer' : 'default',
                      }}
                      onClick={() => onSelectRecord && onSelectRecord(r)}
                    >
                      <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0071e3' }}>
                        {r.Prefijo} {r.Numero}
                      </td>
                      <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1E293B' }}>{r.Empresa}</td>
                      <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{r.Identificacion}</td>
                      <td style={{ padding: '9px 14px', color: '#334155' }}>{r.Nombre_Empleado}</td>
                      <td style={{ padding: '9px 14px', color: '#475569' }}>{r.directorNombre}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 750, color: '#1E293B' }}>
                        {formatCurrency(r.Valor_Saldo)}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        <span
                          className={`badge ${isKilled ? 'badge-success' : r.estaVencida ? 'badge-danger' : 'badge-warning'}`}
                          style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px' }}
                        >
                          {isKilled ? '100% MATADA' : r.categoriaEdad === 'CORRIENTE' ? 'AL DÍA' : r.categoriaEdad.replace('_', '-')}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>
                        {r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>
                        {r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredBaseInvoices.length > 100 && (
          <div style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: '#64748B' }}>
            Mostrando las primeras 100 facturas de {formatNumber(filteredBaseInvoices.length)}. Usa el buscador o descarga el Excel completo para ver todas.
          </div>
        )}
      </div>
    </div>
  );
}
