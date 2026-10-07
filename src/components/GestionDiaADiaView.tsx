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
  CalendarRange,
  CalendarClock,
  Calendar,
  CheckCircle2,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Search,
  Building2,
  Download,
  Zap,
  RefreshCw,
  X,
  Layers,
  Filter,
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
  onSync?: () => Promise<void>;
  isLoading?: boolean;
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

export function GestionDiaADiaView({
  records,
  recibos,
  fechaBase = '2026-10-06',
  onSelectRecord,
  onSync,
  isLoading = false,
}: Props) {
  // Estado de controles de Desmonte y Gráfica
  const [selectedCutoff, setSelectedCutoff] = useState<string>(fechaBase);
  const [chartMode, setChartMode] = useState<'both' | 'money' | 'docs'>('both');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Estado del Monitor Operativo En Vivo (¿Qué Salió y Qué Entró?)
  const [activeTab, setActiveTab] = useState<'salientes' | 'entrantes' | 'vivas'>('salientes');
  const [selectedDirector, setSelectedDirector] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // ─── 1. CÁLCULO DE LA LÍNEA BASE INICIAL Y DESMONTE CORTE A CORTE ─────────
  // Todas las facturas cuya emisión fue <= fechaBase formaban la cartera al arrancar la gestión
  const initialBaseRecords = useMemo(() => {
    return records.filter((r) => {
      const emision = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      return emision <= fechaBase;
    });
  }, [records, fechaBase]);

  // Recaudos de caja registrados desde la fecha base
  const recibosDesdeBase = useMemo(() => {
    return recibos.filter((rc) => {
      const fecha = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      return fecha >= fechaBase;
    });
  }, [recibos, fechaBase]);

  // Facturas nuevas emitidas DESPUÉS de la fecha base
  const facturasNuevas = useMemo(() => {
    return records.filter((r) => {
      const emision = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      return emision > fechaBase;
    });
  }, [records, fechaBase]);

  // Fechas únicas de corte desde la base (ej. 2026-10-06, 2026-10-07)
  const cohortDates = useMemo(() => {
    const datesSet = new Set<string>();
    datesSet.add(fechaBase);

    // Agregar fechas de recaudos
    recibosDesdeBase.forEach((rc) => {
      const f = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      if (f && f >= fechaBase) datesSet.add(f);
    });

    // Agregar fechas de nuevas facturas
    facturasNuevas.forEach((r) => {
      const f = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      if (f && f >= fechaBase) datesSet.add(f);
    });

    return Array.from(datesSet).sort();
  }, [fechaBase, recibosDesdeBase, facturasNuevas]);

  // Construcción de la Serie Cronológica de Desmonte (Idéntico a Remisiones)
  const cohortSeries: CohortPoint[] = useMemo(() => {
    if (!cohortDates.length) return [];

    // Total de recaudos aplicados desde la base
    const totalRecaudadoBase = recibosDesdeBase.reduce((sum, rc) => sum + rc.Valor_Pagado, 0);
    const totalOpenPendingInitialBase = initialBaseRecords.reduce((sum, r) => sum + r.Valor_Saldo, 0);

    // Saldo inicial estimado al arranque del corte base
    const initialPending = totalOpenPendingInitialBase + totalRecaudadoBase;
    const initialCount = initialBaseRecords.length + recibosDesdeBase.length;

    let accumulatedWithdrawn = 0;
    let accumulatedWithdrawnCount = 0;
    let prevStillOpenPending = initialPending;
    let prevStillOpenCount = initialCount;

    return cohortDates.map((cutoff, idx) => {
      // Recaudos de este día específico
      const dayRecibos = recibosDesdeBase.filter((rc) => {
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
      prevStillOpenCount = stillOpenCount;

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
  }, [cohortDates, initialBaseRecords, recibosDesdeBase]);

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

  // ─── 2. MONITOR OPERATIVO EN VIVO: ¿QUÉ SALIÓ Y QUÉ ENTRÓ? ────────────────
  // Salientes: Recibos de caja que mataron/pagaron facturas
  const salientesList = recibosDesdeBase;
  // Entrantes: Nuevas facturas emitidas desde la fecha base
  const entrantesList = facturasNuevas;
  // Vivas: Todas las facturas actualmente pendientes en cartera
  const vivasList = records;

  const totalSalientesValor = useMemo(
    () => salientesList.reduce((sum, rc) => sum + rc.Valor_Pagado, 0),
    [salientesList]
  );
  const totalEntrantesValor = useMemo(
    () => entrantesList.reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [entrantesList]
  );
  const totalVivasValor = useMemo(
    () => vivasList.reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [vivasList]
  );

  // Lista de Directores para el filtro
  const directorsList = useMemo(() => {
    const set = new Set<string>();
    LISTA_DIRECTORES.forEach((d) => set.add(d.nombre));
    return ['Todos', ...Array.from(set).sort()];
  }, []);

  // Lista activa según pestaña y filtros
  const currentList = useMemo(() => {
    let list: any[] =
      activeTab === 'salientes'
        ? salientesList
        : activeTab === 'entrantes'
        ? entrantesList
        : vivasList;

    if (selectedDirector !== 'Todos') {
      list = list.filter((item) => (item.directorNombre || '') === selectedDirector);
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();

    if (activeTab === 'salientes') {
      return (list as ReciboCajaRecord[]).filter(
        (rc) =>
          rc.Empresa?.toLowerCase().includes(q) ||
          rc.Identificacion?.includes(q) ||
          String(rc.Numero_FacturaVenta).includes(q) ||
          String(rc.Numero_ReciboCaja).includes(q) ||
          rc.Nombre_Empleado?.toLowerCase().includes(q) ||
          rc.directorNombre?.toLowerCase().includes(q)
      );
    }

    return (list as CarteraRecord[]).filter(
      (r) =>
        r.Empresa?.toLowerCase().includes(q) ||
        r.Identificacion?.includes(q) ||
        String(r.Numero).includes(q) ||
        r.Prefijo?.toLowerCase().includes(q) ||
        r.Nombre_Empleado?.toLowerCase().includes(q) ||
        r.directorNombre?.toLowerCase().includes(q)
    );
  }, [activeTab, salientesList, entrantesList, vivasList, selectedDirector, searchTerm]);

  // Exportar a Excel con formato y estética de Remisiones
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const workbook = new ExcelJSRuntime.Workbook();
      workbook.creator = 'Provexpress SAS · Cartera';
      workbook.created = new Date();

      const sheetName =
        activeTab === 'salientes'
          ? 'Lo que Salió (Matadas)'
          : activeTab === 'entrantes'
          ? 'Lo que Entró (Nuevas)'
          : 'Total en Cartera';

      const headerColor =
        activeTab === 'salientes' ? 'FF166534' : activeTab === 'entrantes' ? 'FF1D4ED8' : 'FF0F172A';

      const worksheet = workbook.addWorksheet(sheetName);

      if (activeTab === 'salientes') {
        worksheet.columns = [
          { header: '#', key: 'rank', width: 6 },
          { header: 'No. Factura', key: 'factura', width: 16 },
          { header: 'No. Recibo Caja', key: 'recibo', width: 16 },
          { header: 'Cliente / Empresa', key: 'empresa', width: 34 },
          { header: 'NIT', key: 'nit', width: 14 },
          { header: 'Comercial Asesor', key: 'comercial', width: 28 },
          { header: 'Director Comercial', key: 'director', width: 26 },
          { header: 'Vr. Factura', key: 'vrFactura', width: 18 },
          { header: 'Vr. Pagado (Recaudo)', key: 'vrPagado', width: 20 },
          { header: 'Estado', key: 'estado', width: 20 },
          { header: 'Fecha Emisión', key: 'fechaEmision', width: 16 },
          { header: 'Fecha Recaudo', key: 'fechaRecaudo', width: 16 },
          { header: 'Días Pago', key: 'diasPago', width: 12 },
        ];

        (currentList as ReciboCajaRecord[]).forEach((rc, idx) => {
          const isKilled = rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0;
          const row = worksheet.addRow({
            rank: idx + 1,
            factura: `${rc.Prefijo_FacturaVenta} ${rc.Numero_FacturaVenta}`.trim(),
            recibo: `RC-${rc.Numero_ReciboCaja}`,
            empresa: rc.Empresa,
            nit: rc.Identificacion,
            comercial: rc.Nombre_Empleado,
            director: rc.directorNombre,
            vrFactura: rc.Valor_Factura,
            vrPagado: rc.Valor_Pagado,
            estado: isKilled ? '100% MATADA' : 'ABONO PARCIAL',
            fechaEmision: rc.Fecha_Emision?.split('T')[0] || '',
            fechaRecaudo: rc.Fecha_Recaudo?.split('T')[0] || '',
            diasPago: rc.Dias_Pago,
          });
          row.getCell('vrFactura').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
          row.getCell('vrPagado').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
          row.getCell('vrPagado').font = { bold: true, color: { argb: 'FF166534' } };
        });
      } else {
        worksheet.columns = [
          { header: '#', key: 'rank', width: 6 },
          { header: 'No. Factura', key: 'factura', width: 16 },
          { header: 'Cliente / Empresa', key: 'empresa', width: 34 },
          { header: 'NIT', key: 'nit', width: 14 },
          { header: 'Comercial Asesor', key: 'comercial', width: 28 },
          { header: 'Director Comercial', key: 'director', width: 26 },
          { header: 'Saldo Cartera', key: 'saldo', width: 18 },
          { header: 'Categoría Edad', key: 'edad', width: 16 },
          { header: 'Días Vencimiento', key: 'dias', width: 16 },
          { header: 'Fecha Emisión', key: 'fechaEmision', width: 16 },
          { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 16 },
        ];

        (currentList as CarteraRecord[]).forEach((r, idx) => {
          const row = worksheet.addRow({
            rank: idx + 1,
            factura: `${r.Prefijo} ${r.Numero}`.trim(),
            empresa: r.Empresa,
            nit: r.Identificacion,
            comercial: r.Nombre_Empleado,
            director: r.directorNombre,
            saldo: r.Valor_Saldo,
            edad: r.categoriaEdad,
            dias: r.Dias_Vencimiento,
            fechaEmision: r.Fecha_Emision?.split('T')[0] || '',
            fechaVencimiento: r.Fecha_Vencimiento?.split('T')[0] || '',
          });
          row.getCell('saldo').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
          row.getCell('saldo').font = { bold: true };
        });
      }

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartera-${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    <div className="gestion-view-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── SECCIÓN 1: SEGUIMIENTO CRONOLÓGICO DEL DESMONTE DE LA BASE INICIAL ─── */}
      <div className="management-daily-history-card">
        <div className="management-table-header">
          <div>
            <div className="evolution-tag purple">
              <CalendarRange size={13} />
              <span>Desmonte de la Base Inicial Día a Día</span>
            </div>
            <h3 style={{ margin: '4px 0 2px', fontSize: 18, fontWeight: 800 }}>
              Seguimiento Cronológico del Desmonte ({formatCutoffText(fechaBase)})
            </h3>
            <small style={{ color: '#6e6e73', fontSize: 12 }}>
              Evolución corte a corte de las facturas entregadas inicialmente: saldo restante y facturas matadas por recibos de caja.
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
              disabled={isExportingExcel || latestPoint.withdrawnCount === 0}
              title="Descargar Excel con detalle de facturas matadas y recaudos"
            >
              <Download size={14} />
              <span>
                {isExportingExcel
                  ? 'Generando...'
                  : `Descargar Excel de Salidas (${formatNumber(latestPoint.withdrawnCount)})`}
              </span>
            </button>
          </div>
        </div>

        {/* 1.1 Tarjetas de Resumen del Desmonte (Estilo Exacto Remisiones) */}
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
              <strong>{formatPercent(latestPoint.recoveryPct * 100)}</strong> recuperado de la base inicial
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
              de las facturas iniciales saldadas
            </span>
          </div>

          {/* Tarjeta 3: Saldo Restante de la Base */}
          <div className="timeline-summary-card tone-blue">
            <div className="timeline-summary-top">
              <span className="timeline-summary-label">Saldo Restante de la Base</span>
              <span className="cohort-kpi-badge purple">Pendiente</span>
            </div>
            <strong className="timeline-summary-value text-blue">
              {formatCurrency(latestPoint.stillOpenPending)}
            </strong>
            <span className="timeline-summary-sub">
              <strong>{formatNumber(latestPoint.stillOpenCount)} facturas</strong> aún abiertas de la base inicial
            </span>
          </div>
        </div>

        {/* 1.2 Gráfico de Barras Dual-Axis de Evolución del Desmonte */}
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

        {/* 1.3 Tarjetas Día a Día (Seguimiento Cronológico mgmt-day-cards-list) */}
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

      {/* ─── SECCIÓN 2: MONITOR OPERATIVO EN VIVO (¿QUÉ SALIÓ Y QUÉ ENTRÓ?) ─── */}
      <div className="live-monitor-container" style={{ padding: 0 }}>
        {/* 2.1 Header en Vivo */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 16,
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            borderRadius: 16,
            color: '#FFFFFF',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.25)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  boxShadow: '0 0 8px #22C55E',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#4ADE80',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                En Vivo ERP
              </span>
              <span style={{ fontSize: 13, color: '#94A3B8', marginLeft: 6 }}>
                Base de control activa: <strong style={{ color: '#F8FAFC' }}>{formatCutoffText(fechaBase)}</strong>
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
              Movimientos en Tiempo Real · ¿Qué Salió y Qué Entró?
            </h2>
          </div>

          {onSync && (
            <button
              onClick={onSync}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s ease',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <RefreshCw size={16} className={isLoading ? 'spin-animation' : ''} />
              {isLoading ? 'Consultando ERP...' : 'Consultar ERP en Vivo Ahora'}
            </button>
          )}
        </div>

        {/* 2.2 Tarjetas Operativas Directas (Lo que Salió, Lo que Entró, Total en Cartera) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Tarjeta 1: LO QUE SALIÓ (FACTURAS MATADAS POR RECIBOS DE CAJA) */}
          <div
            onClick={() => setActiveTab('salientes')}
            style={{
              backgroundColor: activeTab === 'salientes' ? '#F0FDF4' : '#FFFFFF',
              border: activeTab === 'salientes' ? '2px solid #22C55E' : '1px solid #E2E8F0',
              borderRadius: 14,
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === 'salientes' ? '0 4px 12px rgba(34, 197, 94, 0.15)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
                🟢 Lo que Salió (Matadas con Recibo)
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16A34A',
                }}
              >
                <ArrowUpRight size={20} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#166534', marginBottom: 4 }}>
              {formatCurrency(totalSalientesValor)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 750, color: '#15803D' }}>
              {salientesList.length} facturas saldadas
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              Ya no están pendientes (fueron matadas/pagadas con Recibo de Caja)
            </div>
          </div>

          {/* Tarjeta 2: LO QUE ENTRÓ (NUEVAS FACTURAS EMITIDAS) */}
          <div
            onClick={() => setActiveTab('entrantes')}
            style={{
              backgroundColor: activeTab === 'entrantes' ? '#EFF6FF' : '#FFFFFF',
              border: activeTab === 'entrantes' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
              borderRadius: 14,
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === 'entrantes' ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' }}>
                🔵 Lo que Entró (Nuevas)
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: '#DBEAFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                }}
              >
                <ArrowDownLeft size={20} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1E40AF', marginBottom: 4 }}>
              {formatCurrency(totalEntrantesValor)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 750, color: '#1D4ED8' }}>
              {entrantesList.length} facturas nuevas
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              Nuevas ventas emitidas después de la fecha base
            </div>
          </div>

          {/* Tarjeta 3: TODAS LAS ACTIVAS EN CARTERA */}
          <div
            onClick={() => setActiveTab('vivas')}
            style={{
              backgroundColor: activeTab === 'vivas' ? '#F8FAFC' : '#FFFFFF',
              border: activeTab === 'vivas' ? '2px solid #0F172A' : '1px solid #E2E8F0',
              borderRadius: 14,
              padding: '18px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === 'vivas' ? '0 4px 12px rgba(15, 23, 42, 0.08)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase' }}>
                📋 Todas las Activas en Cartera
              </span>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#334155',
                }}
              >
                <Package size={20} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
              {formatCurrency(totalVivasValor)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 750, color: '#475569' }}>
              {vivasList.length} facturas pendientes hoy
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              Total de cartera viva en este segundo en el ERP
            </div>
          </div>
        </div>

        {/* 2.3 Barra de Controles: Selector de Pestaña + Filtro Director + Buscador + Excel */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
            background: '#FFFFFF',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          {/* Selector de Pestañas */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('salientes')}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'salientes' ? '#16A34A' : '#F1F5F9',
                color: activeTab === 'salientes' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              🟢 Lo que Salió ({salientesList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('entrantes')}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'entrantes' ? '#2563EB' : '#F1F5F9',
                color: activeTab === 'entrantes' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              🔵 Lo que Entró ({entrantesList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vivas')}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'vivas' ? '#0F172A' : '#F1F5F9',
                color: activeTab === 'vivas' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              📋 Total en Cartera ({vivasList.length})
            </button>
          </div>

          {/* Filtros: Director Comercial + Buscador + Excel */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filtro Director */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={16} color="#64748B" />
              <select
                value={selectedDirector}
                onChange={(e) => setSelectedDirector(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  outline: 'none',
                }}
              >
                {directorsList.map((d) => (
                  <option key={d} value={d}>
                    {d === 'Todos' ? 'Todos los Directores' : d}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscador */}
            <div style={{ position: 'relative', width: 230 }}>
              <Search
                size={15}
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
                placeholder="Buscar cliente, NIT, factura, recibo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  fontSize: 12.5,
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  outline: 'none',
                }}
              />
            </div>

            {/* Botón Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: '#FFFFFF',
                color: '#0F172A',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: isExportingExcel ? 'not-allowed' : 'pointer',
              }}
              title="Descargar listado a Excel"
            >
              <Download size={14} color="#16A34A" />
              Excel ({currentList.length})
            </button>
          </div>
        </div>

        {/* 2.4 Tabla Directa y Detallada de Facturas */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              background:
                activeTab === 'salientes'
                  ? '#F0FDF4'
                  : activeTab === 'entrantes'
                  ? '#EFF6FF'
                  : '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: '#1E293B', fontWeight: 700 }}>
              {activeTab === 'salientes'
                ? `🟢 Listado de lo que Salió (Matadas / Cobradas): ${currentList.length} facturas`
                : activeTab === 'entrantes'
                ? `🔵 Listado de lo que Entró (Nuevas Facturas Emitidas): ${currentList.length} facturas`
                : `📋 Total de Facturas Activas en Cartera: ${currentList.length} facturas`}
            </span>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              Suma total:{' '}
              <strong
                style={{
                  color:
                    activeTab === 'salientes'
                      ? '#166534'
                      : activeTab === 'entrantes'
                      ? '#1E40AF'
                      : '#0F172A',
                  fontSize: 14,
                }}
              >
                {formatCurrency(
                  activeTab === 'salientes'
                    ? (currentList as ReciboCajaRecord[]).reduce((s, r) => s + r.Valor_Pagado, 0)
                    : (currentList as CarteraRecord[]).reduce((s, r) => s + r.Valor_Saldo, 0)
                )}
              </strong>
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>#</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>No. Factura</th>
                  {activeTab === 'salientes' && (
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>
                      Recibo de Caja
                    </th>
                  )}
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>
                    Cliente / Razón Social
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>NIT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>
                    Comercial Asesor
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>
                    Director Comercial
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                    {activeTab === 'salientes' ? 'Vr. Factura' : 'Saldo Cartera'}
                  </th>
                  {activeTab === 'salientes' && (
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                      Vr. Pagado
                    </th>
                  )}
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                    Estado
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>
                    {activeTab === 'salientes' ? 'Fecha Recaudo' : 'Fecha Emisión'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'salientes' ? 11 : 9} style={{ textAlign: 'center', padding: '36px 16px', color: '#94A3B8' }}>
                      No se encontraron registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  currentList.map((item, idx) => {
                    if (activeTab === 'salientes') {
                      const rc = item as ReciboCajaRecord;
                      const isKilled = rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0;
                      return (
                        <tr
                          key={rc.id || `rc-${idx}`}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                          }}
                        >
                          <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#1E293B' }}>
                            {rc.Prefijo_FacturaVenta} {rc.Numero_FacturaVenta}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 650, color: '#15803D' }}>
                            RC-{rc.Numero_ReciboCaja}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1E293B' }}>
                            {rc.Empresa}
                          </td>
                          <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                            {rc.Identificacion}
                          </td>
                          <td style={{ padding: '10px 16px', color: '#334155' }}>{rc.Nombre_Empleado}</td>
                          <td style={{ padding: '10px 16px', color: '#475569' }}>{rc.directorNombre}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#64748B' }}>
                            {formatCurrency(rc.Valor_Factura)}
                          </td>
                          <td
                            style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontWeight: 800,
                              color: '#166534',
                            }}
                          >
                            {formatCurrency(rc.Valor_Pagado)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span
                              className={`badge ${isKilled ? 'badge-success' : 'badge-warning'}`}
                              style={{ fontSize: 10.5, fontWeight: 750, padding: '3px 8px' }}
                            >
                              {isKilled ? '100% MATADA' : 'ABONO PARCIAL'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                            {rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '—'}
                          </td>
                        </tr>
                      );
                    }

                    const r = item as CarteraRecord;
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
                        <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0071e3' }}>
                          {r.Prefijo} {r.Numero}
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1E293B' }}>
                          {r.Empresa}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                          {r.Identificacion}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#334155' }}>{r.Nombre_Empleado}</td>
                        <td style={{ padding: '10px 16px', color: '#475569' }}>{r.directorNombre}</td>
                        <td
                          style={{
                            padding: '10px 16px',
                            textAlign: 'right',
                            fontWeight: 750,
                            color: '#1E293B',
                          }}
                        >
                          {formatCurrency(r.Valor_Saldo)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span
                            className={`badge ${
                              r.estaVencida
                                ? 'badge-danger'
                                : r.categoriaEdad === 'CORRIENTE'
                                ? 'badge-success'
                                : 'badge-warning'
                            }`}
                            style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px' }}
                          >
                            {r.categoriaEdad === 'CORRIENTE' ? 'AL DÍA' : r.categoriaEdad.replace('_', '-')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                          {r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
