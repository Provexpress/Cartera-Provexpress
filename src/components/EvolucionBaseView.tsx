import React, { useState, useMemo, useEffect } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import type { CarteraRecord, ReciboCajaRecord, AgeBucketKey } from '../types';
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
  isReciboSaldado,
  buildInvoiceTotalPaidMap,
  computeCarteraMetrics,
} from '../lib/carteraApi';
import { LISTA_DIRECTORES } from '../lib/commercialDirectory';
import { AgingCards } from './AgingCards';
import { CarteraCharts } from './CarteraCharts';

interface Props {
  records: CarteraRecord[];
  recibos: ReciboCajaRecord[];
  fechaBase?: string;
  selectedDirectorProp?: string;
  onSelectRecord?: (record: CarteraRecord) => void;
  onNavigateToGestion?: () => void;
  onViewFullTable?: () => void;
  onSelectDirector?: (dir: string | 'all') => void;
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
  selectedDirectorProp,
  onSelectRecord,
  onNavigateToGestion,
  onViewFullTable,
  onSelectDirector,
}: Props) {
  // Estado de filtros y perspectiva
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'killed'>('open');
  const [recaudoScope, setRecaudoScope] = useState<'acumulado' | 'dia'>('acumulado');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDirector, setSelectedDirector] = useState<string>(
    selectedDirectorProp && selectedDirectorProp !== 'all' ? selectedDirectorProp : 'Todos'
  );
  const [selectedBaseAging, setSelectedBaseAging] = useState<AgeBucketKey | 'CRITICO_30' | 'all'>('all');
  const [reciboDateCriterion, setReciboDateCriterion] = useState<'fecha_recibo' | 'fecha_recaudo'>('fecha_recibo');
  const [chartMode, setChartMode] = useState<'both' | 'money' | 'docs'>('both');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    if (selectedDirectorProp) {
      setSelectedDirector(selectedDirectorProp !== 'all' ? selectedDirectorProp : 'Todos');
    }
  }, [selectedDirectorProp]);

  // ─── 1. BASE INICIAL RECIBIDA AL CORTE DE CONTROL (<= 2026-10-06) ─────────
  const baseReceivedInvoices = useMemo(() => {
    return records.filter((r) => {
      const emision = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      return emision <= fechaBase;
    });
  }, [records, fechaBase]);

  // ─── 2. RECAUDOS DE CAJA ASOCIADOS A LA BASE INICIAL ───────────────────────
  const baseRecaudos = useMemo(() => {
    return recibos.filter((rc) => {
      const fechaRec = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      const fechaEmis = rc.Fecha_Emision ? rc.Fecha_Emision.split('T')[0] : '';
      if (fechaRec && fechaRec < fechaBase) return false;
      if (fechaEmis && fechaEmis > fechaBase) return false;
      return true;
    });
  }, [recibos, fechaBase]);

  const recibosRelevantes = baseRecaudos;

  // Fecha de hoy formateada
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Última fecha en que Tesorería registró al menos un recibo de caja
  const lastReciboDate = useMemo(() => {
    let latest = '';
    recibosRelevantes.forEach((rc) => {
      const f = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      if (f > latest) latest = f;
    });
    return latest;
  }, [recibosRelevantes]);

  // Fechas únicas para la serie cronológica (incluye base, días con recaudos y corte de hoy)
  const cohortDates = useMemo(() => {
    const datesSet = new Set<string>();
    datesSet.add(fechaBase);
    datesSet.add(todayStr); // Mantener el corte de hoy presente en el seguimiento activo

    recibosRelevantes.forEach((rc) => {
      const f = reciboDateCriterion === 'fecha_recibo'
        ? (rc.Fecha_Recibo || (rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : ''))
        : (rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '');
      if (f && f >= fechaBase) datesSet.add(f);
    });

    return Array.from(datesSet).sort();
  }, [fechaBase, todayStr, recibosRelevantes, reciboDateCriterion]);

  // Corte más reciente (idéntico a Remisiones: por defecto hoy o último día)
  const latestCutoffDate = cohortDates.length ? cohortDates[cohortDates.length - 1] : todayStr;
  const [selectedCutoff, setSelectedCutoff] = useState<string>(latestCutoffDate);

  // Mantener actualizado al corte más reciente al iniciar o si cohortDates cambia
  useEffect(() => {
    if (latestCutoffDate && selectedCutoff === fechaBase && latestCutoffDate !== fechaBase) {
      setSelectedCutoff(latestCutoffDate);
    }
  }, [latestCutoffDate, selectedCutoff, fechaBase]);

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
        const f = reciboDateCriterion === 'fecha_recibo'
          ? (rc.Fecha_Recibo || (rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : ''))
          : (rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '');
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
  }, [cohortDates, baseReceivedInvoices, recibosRelevantes, reciboDateCriterion]);

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
  const currentCohortPoint = cohortSeries.find((c) => c.cutoff === selectedCutoff) || latestPoint;

  // ─── 3. FACTURAS ABIERTAS FILTRADAS DE LA BASE ──────────────────────────────
  const filteredOpenInvoices = useMemo(() => {
    let list = baseReceivedInvoices;
    if (selectedDirector !== 'Todos') {
      list = list.filter((r) => (r.directorNombre || '') === selectedDirector);
    }
    if (selectedBaseAging !== 'all') {
      if (selectedBaseAging === 'CRITICO_30') {
        list = list.filter((r) => r.categoriaEdad !== 'CORRIENTE' && r.categoriaEdad !== '1_30');
      } else {
        list = list.filter((r) => r.categoriaEdad === selectedBaseAging);
      }
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
  }, [baseReceivedInvoices, selectedDirector, selectedBaseAging, searchTerm]);

  // Métricas completas de edades y concentración de la base inicial entregada (06/10)
  const baseMetrics = useMemo(() => {
    const listForMetrics = selectedDirector !== 'Todos'
      ? baseReceivedInvoices.filter((r) => (r.directorNombre || '') === selectedDirector)
      : baseReceivedInvoices;
    return computeCarteraMetrics(listForMetrics);
  }, [baseReceivedInvoices, selectedDirector]);

  // ─── 4. FACTURAS RECAUDADAS CON RECIBO FILTRADAS DE LA BASE ──────────────────
  const invoiceTotalPaidMap = useMemo(() => buildInvoiceTotalPaidMap(recibos || []), [recibos]);

  const filteredRecaudos = useMemo(() => {
    let list = baseRecaudos;
    if (recaudoScope === 'dia' && selectedCutoff !== fechaBase) {
      list = list.filter((rc) => {
        const f = reciboDateCriterion === 'fecha_recibo'
          ? (rc.Fecha_Recibo || (rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : ''))
          : (rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '');
        return f === selectedCutoff;
      });
    }
    if (selectedDirector !== 'Todos') {
      list = list.filter((rc) => (rc.directorNombre || '') === selectedDirector);
    }
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter(
      (rc) =>
        rc.Empresa?.toLowerCase().includes(q) ||
        rc.Identificacion?.includes(q) ||
        String(rc.Numero_FacturaVenta).includes(q) ||
        String(rc.Numero_ReciboCaja).includes(q) ||
        rc.Prefijo_FacturaVenta?.toLowerCase().includes(q) ||
        rc.Nombre_Empleado?.toLowerCase().includes(q) ||
        rc.directorNombre?.toLowerCase().includes(q)
    );
  }, [baseRecaudos, recaudoScope, selectedCutoff, fechaBase, reciboDateCriterion, selectedDirector, searchTerm]);

  // Totales de la selección actual
  const totalOpenSaldo = useMemo(
    () => filteredOpenInvoices.reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [filteredOpenInvoices]
  );
  const totalRecaudadoValor = useMemo(
    () => filteredRecaudos.reduce((sum, rc) => sum + rc.Valor_Pagado, 0),
    [filteredRecaudos]
  );

  // Exportar Colecta de Facturas a Excel
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const { generateEvolucionBaseExcel, downloadBufferAsFile } = await import('../lib/excelGenerator');
      const { buffer, filename } = await generateEvolucionBaseExcel(
        filteredOpenInvoices,
        filteredRecaudos,
        statusFilter,
        fechaBase
      );
      downloadBufferAsFile(buffer, filename);
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Error al generar Excel.');
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
              Seguimiento exclusivo al desmonte de las <strong>{formatNumber(baseReceivedInvoices.length)} facturas</strong> entregadas para gestión de cobro ({formatCurrency(initialPoint.initialPending)}). No ingresa facturación nueva a esta base.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="filter-date-badge">
            <span className="filter-date-label">Corte evaluado:</span>
            <strong className="filter-date-val">{formatCutoffText(selectedCutoff)}</strong>
            {selectedCutoff === latestCutoffDate ? (
              <span className="filter-status-tag current">Al día</span>
            ) : (
              <button
                type="button"
                className="filter-return-today-btn"
                onClick={() => setSelectedCutoff(latestCutoffDate)}
                title="Volver a la fecha actual más reciente"
              >
                <RotateCcw size={12} /> Volver a hoy ({formatCutoffShort(latestCutoffDate)})
              </button>
            )}
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
              title="Ver el proceso operativo diario día a día"
            >
              <CalendarRange size={14} />
              <span>Ver Gestión del Proceso (Día a Día) →</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── SECCIÓN 1: TARJETAS DE RESUMEN DEL DESMONTE (ESTILO EXACTO A REMISIONES) ─── */}
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
              Evolución corte a corte de las facturas recibidas: saldo restante y facturas recaudadas por recibos de caja.
            </small>
          </div>

          <div className="mgmt-header-actions-row">
            {/* Selector de Perspectiva de Recaudos */}
            <div style={{ display: 'inline-flex', backgroundColor: '#F1F5F9', padding: 3, borderRadius: 10, gap: 4 }}>
              <button
                type="button"
                onClick={() => setReciboDateCriterion('fecha_recibo')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 750,
                  cursor: 'pointer',
                  backgroundColor: reciboDateCriterion === 'fecha_recibo' ? '#2563EB' : 'transparent',
                  color: reciboDateCriterion === 'fecha_recibo' ? '#FFFFFF' : '#475569',
                  boxShadow: reciboDateCriterion === 'fecha_recibo' ? '0 2px 4px rgba(37,99,235,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Desmonte según el día en que Tesorería elaboró el recibo en SISGerente"
              >
                1. Día del Recibo (ERP)
              </button>
              <button
                type="button"
                onClick={() => setReciboDateCriterion('fecha_recaudo')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 750,
                  cursor: 'pointer',
                  backgroundColor: reciboDateCriterion === 'fecha_recaudo' ? '#16A34A' : 'transparent',
                  color: reciboDateCriterion === 'fecha_recaudo' ? '#FFFFFF' : '#475569',
                  boxShadow: reciboDateCriterion === 'fecha_recaudo' ? '0 2px 4px rgba(22,163,74,0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Desmonte según el día en que el dinero entró al banco"
              >
                2. Día que Entró el Dinero (Banco)
              </button>
            </div>

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

        {/* Métricas de Desmonte (4 Tarjetas idénticas a Remisiones) */}
        <div className="cohort-kpis-grid">
          {/* Tarjeta 1: Base Inicial Entregada */}
          <div
            className="cohort-kpi-card"
            role="button"
            tabIndex={0}
            onClick={() => {
              setStatusFilter('all');
              document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ cursor: 'pointer' }}
            title="Ver todo el inventario de la base entregada"
          >
            <div className="cohort-kpi-top">
              <span className="cohort-kpi-label">Base Inicial Entregada</span>
              <span className="cohort-kpi-badge blue">Base fija</span>
            </div>
            <strong className="cohort-kpi-value">{formatCurrency(initialPoint.initialPending)}</strong>
            <span className="cohort-kpi-sub">
              <strong>{formatNumber(initialPoint.initialCount)}</strong> facturas entregadas el {formatCutoffShort(initialPoint.cutoff)}
            </span>
          </div>

          {/* Tarjeta 2: Saldo Restante Base */}
          <div
            className="cohort-kpi-card"
            role="button"
            tabIndex={0}
            onClick={() => {
              setStatusFilter('open');
              document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ cursor: 'pointer' }}
            title="Ver facturas que aún están abiertas en la tabla"
          >
            <div className="cohort-kpi-top">
              <span className="cohort-kpi-label">Saldo Restante Base</span>
              <span className="cohort-kpi-badge purple">{selectedCutoff === initialPoint.cutoff ? 'Inicio' : 'Al Corte'}</span>
            </div>
            <strong className="cohort-kpi-value text-blue">
              {formatCurrency(currentCohortPoint.stillOpenPending)}
            </strong>
            <span className="cohort-kpi-sub">
              <strong>{formatNumber(currentCohortPoint.stillOpenCount)}</strong> facturas aún abiertas de la base
            </span>
          </div>

          {/* Tarjeta 3: ¿Cuánto Dinero Bajó? */}
          <div
            className="cohort-kpi-card highlight"
            role="button"
            tabIndex={0}
            onClick={() => {
              setStatusFilter('killed');
              setRecaudoScope('acumulado');
              document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ cursor: 'pointer' }}
            title="Ver facturas recaudadas en la tabla"
          >
            <div className="cohort-kpi-top">
              <span className="cohort-kpi-label">¿Cuánto Dinero Bajó?</span>
              <span className="cohort-kpi-badge green">Recaudado</span>
            </div>
            <strong className="cohort-kpi-value text-green">
              {currentCohortPoint.withdrawnPending > 0
                ? `▼ -${formatCurrency(currentCohortPoint.withdrawnPending)}`
                : '$ 0'}
            </strong>
            <span className="cohort-kpi-sub">
              {currentCohortPoint.withdrawnPending > 0
                ? `Bajó de las que estaban ahí (${formatPercent((currentCohortPoint.recoveryPct || 0) * 100)})`
                : 'Punto de partida de la entrega'}
            </span>
          </div>

          {/* Tarjeta 4: Facturas Salidas */}
          <div
            className="cohort-kpi-card highlight"
            role="button"
            tabIndex={0}
            onClick={() => {
              setStatusFilter('killed');
              setRecaudoScope('acumulado');
              document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ cursor: 'pointer' }}
            title="Ver facturas recaudadas en la tabla"
          >
            <div className="cohort-kpi-top">
              <span className="cohort-kpi-label">Facturas Salidas</span>
              <span className="cohort-kpi-badge green">Cerradas</span>
            </div>
            <strong className="cohort-kpi-value text-green">
              {currentCohortPoint.withdrawnCount > 0
                ? `▼ -${formatNumber(currentCohortPoint.withdrawnCount)} fact.`
                : '0 fact.'}
            </strong>
            <span className="cohort-kpi-sub">
              de las <strong>{formatNumber(initialPoint.initialCount)}</strong> entregadas
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
                        Facturas recaudadas: -{formatNumber(pt.withdrawnCount)}
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
          {cohortSeries.map((pt) => {
            const isSelected = pt.cutoff === selectedCutoff;
            const isInitial = pt.cutoff === initialPoint.cutoff;
            const isToday = pt.cutoff === todayStr;
            const isLastReciboDay = pt.cutoff === lastReciboDate && pt.cutoff !== todayStr;
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
                {/* Cabecera: Fecha a la izquierda y Balance / Desmonte del día a la derecha */}
                <div className="mgmt-day-card-header">
                  <div className="mgmt-day-card-date">
                    <strong>{formatCutoffText(pt.cutoff)}</strong>
                    <div className="mgmt-day-chips">
                      {isSelected && <span className="evolution-chip active">Seleccionado</span>}
                      {isInitial && <span className="evolution-chip initial">Base inicial</span>}
                      {isToday && <span className="evolution-chip latest" style={{ backgroundColor: '#0284c7', color: '#fff' }}>Hoy</span>}
                      {isLastReciboDay && <span className="evolution-chip" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Último recaudo</span>}
                    </div>
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

                {/* Métricas clave en rejilla responsiva auto-ajustable */}
                <div className="mgmt-day-card-metrics">
                  <div className="mgmt-day-card-metric-cell">
                    <small className="mgmt-day-card-sublabel">Saldo restante</small>
                    <strong className="mgmt-day-card-money">{formatCurrency(pt.stillOpenPending)}</strong>
                    <small className="text-muted">{formatNumber(pt.stillOpenCount)} facturas abiertas</small>
                  </div>

                  <div className="mgmt-day-card-metric-cell">
                    <small className="mgmt-day-card-sublabel">⬇ Salieron este día (Recaudos)</small>
                    {isInitial ? (
                      <span className="text-muted" style={{ fontSize: '11px' }}>Base de partida</span>
                    ) : dailyCount > 0 ? (
                      <>
                        <strong className="mgmt-flow-out">-{formatNumber(dailyCount)} facturas</strong>
                        <small style={{ color: '#15803d', fontSize: '10px', fontWeight: 650 }}>
                          -{formatCurrency(dailyWithdrawn)}
                        </small>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCutoff(pt.cutoff);
                            setStatusFilter('killed');
                            setRecaudoScope('dia');
                            document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          style={{
                            display: 'inline-block',
                            marginTop: 3,
                            color: '#15803d',
                            fontSize: '11px',
                            fontWeight: 700,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                          title={`Ver las ${dailyCount} facturas recaudadas el ${formatCutoffText(pt.cutoff)} en la tabla`}
                        >
                          Ver {dailyCount} en tabla ↓
                        </span>
                      </>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '11px' }}>0 facturas salieron</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── DIAGNÓSTICO DE EDADES Y GRÁFICAS DE LA BASE INICIAL (CORTE 06/10) ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <AgingCards
          totalSaldo={baseMetrics.totalSaldo}
          totalCorriente={baseMetrics.totalCorriente}
          totalVencido={baseMetrics.totalVencido}
          porcentajeVencido={baseMetrics.porcentajeVencido}
          totalDocumentos={baseMetrics.totalDocumentos}
          clientesUnicos={baseMetrics.clientesUnicos}
          agingItems={baseMetrics.agingBreakdown}
          selectedAging={selectedBaseAging}
          onSelectAging={(key) => {
            setSelectedBaseAging(key);
            setStatusFilter('open');
            document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <CarteraCharts
          records={baseReceivedInvoices}
          agingItems={baseMetrics.agingBreakdown}
          groups={baseMetrics.groupsSummary}
          customers={baseMetrics.customersSummary}
          executives={baseMetrics.executivesSummary}
          selectedAging={selectedBaseAging}
          onSelectAging={(key) => {
            setSelectedBaseAging(key);
            setStatusFilter('open');
            document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
          }}
          selectedDirector={selectedDirector}
          onSelectDirector={(dir) => {
            const newDir = dir || 'Todos';
            setSelectedDirector(newDir);
            if (onSelectDirector) onSelectDirector(dir || 'all');
          }}
          onSelectRecord={onSelectRecord}
          onViewFullTable={() => {
            setStatusFilter('open');
            document.getElementById('tabla-evolucion-base')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      {/* ─── SECCIÓN 2: AUDITORÍA DE FACTURAS DE LA BASE INICIAL ─── */}
      <div
        id="tabla-evolucion-base"
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
              {statusFilter === 'killed'
                ? `Facturas Recaudadas con Recibo de Caja (${formatNumber(filteredRecaudos.length)})`
                : statusFilter === 'open'
                ? `Facturas Abiertas en Cartera (${formatNumber(filteredOpenInvoices.length)})`
                : `Base Inicial de Partida (${formatNumber(filteredOpenInvoices.length + filteredRecaudos.length)})`}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748B' }}>
              {statusFilter === 'killed'
                ? `Recaudos aplicados a la base entregada al ${formatCutoffText(fechaBase)} · Suma: ${formatCurrency(totalRecaudadoValor)}`
                : statusFilter === 'open'
                ? `Facturas de la base entregada que aún tienen saldo por cobrar · Suma: ${formatCurrency(totalOpenSaldo)}`
                : `Inventario consolidado: facturas abiertas y recaudadas de la base al ${formatCutoffText(fechaBase)}.`}
            </p>
          </div>

          {/* Filtros: Sub-estado + Alcance Diario/Acumulado + Director + Buscador + Excel */}
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
                🔴 Abiertas ({formatNumber(baseReceivedInvoices.length)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('killed');
                  setRecaudoScope('acumulado');
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'killed' ? '#FFFFFF' : 'transparent',
                  color: statusFilter === 'killed' ? '#15803D' : '#64748B',
                  boxShadow: statusFilter === 'killed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                🟢 Recaudadas con Recibo ({formatNumber(baseRecaudos.length)})
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
                📋 Base Completa ({formatNumber(baseReceivedInvoices.length + baseRecaudos.length)})
              </button>
            </div>

            {/* Sub-selector de alcance para Recaudadas: Día seleccionado vs Todo Acumulado */}
            {statusFilter === 'killed' && selectedCutoff !== fechaBase && (
              <div style={{ display: 'inline-flex', gap: 3, background: '#E2E8F0', padding: 2, borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setRecaudoScope('dia')}
                  style={{
                    padding: '5px 9px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: recaudoScope === 'dia' ? '#FFFFFF' : 'transparent',
                    color: recaudoScope === 'dia' ? '#15803D' : '#475569',
                    boxShadow: recaudoScope === 'dia' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                  title={`Ver solo los recaudos del día ${formatCutoffText(selectedCutoff)}`}
                >
                  🗓️ Solo {formatCutoffText(selectedCutoff)}
                </button>
                <button
                  type="button"
                  onClick={() => setRecaudoScope('acumulado')}
                  style={{
                    padding: '5px 9px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: recaudoScope === 'acumulado' ? '#FFFFFF' : 'transparent',
                    color: recaudoScope === 'acumulado' ? '#15803D' : '#475569',
                    boxShadow: recaudoScope === 'acumulado' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                  title="Ver todos los recaudos acumulados de la base"
                >
                  📊 Acumulado Base ({formatNumber(baseRecaudos.length)})
                </button>
              </div>
            )}

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
            <div style={{ position: 'relative', width: 200 }}>
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

            {/* Botón Descargar Excel */}
            <button
              type="button"
              className="button button-outline"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: '#1E293B',
              }}
              title="Descargar datos actuales en Excel profesional"
            >
              <Download size={13} />
              <span>{isExportingExcel ? 'Generando...' : 'Descargar Excel'}</span>
            </button>
          </div>
        </div>

        {/* Tabla Dinámica según Sub-estado */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: 12 }}>
          {statusFilter === 'killed' ? (
            /* TABLA 1: FACTURAS RECAUDADAS CON RECIBO DE CAJA */
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#F0FDF4', borderBottom: '1px solid #BBF7D0' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>#</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>No. Factura</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Recibo de Caja</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Cliente / Razón Social</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>NIT</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Comercial</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Director</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534', textAlign: 'right' }}>Vr. Factura</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534', textAlign: 'right' }}>Vr. Recaudado</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Fecha Emisión</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>Fecha Recaudo</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecaudos.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748B' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <span>
                          {recaudoScope === 'dia'
                            ? `No se registraron recaudos específicamente el día ${formatCutoffText(selectedCutoff)}.`
                            : 'No se encontraron facturas recaudadas para los filtros seleccionados.'}
                        </span>
                        {recaudoScope === 'dia' && baseRecaudos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setRecaudoScope('acumulado')}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: '#16A34A',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Ver todos los {formatNumber(baseRecaudos.length)} recaudos acumulados de la base →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecaudos.slice(0, 100).map((rc, idx) => {
                    const isKilled = isReciboSaldado(rc, invoiceTotalPaidMap);
                    return (
                      <tr
                        key={rc.id || `rc-${idx}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                          cursor: onSelectRecord ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                          if (onSelectRecord) {
                            onSelectRecord({
                              id: `rc-${rc.Numero_ReciboCaja}`,
                              Grupo_Comercial: rc.Grupo_Personal || '',
                              Nombre_Empleado: rc.Nombre_Empleado,
                              Identificacion: rc.Identificacion,
                              Dv: '',
                              Empresa: rc.Empresa,
                              Cupo_Credito: 0,
                              Estado_Cliente: 'Activo',
                              Plazo_PagoCliente: rc.Dias_PlazoPago || 30,
                              Prefijo: rc.Prefijo_FacturaVenta,
                              Numero: Number(rc.Numero_FacturaVenta) || 0,
                              Tipo_Documento: 'Factura Venta',
                              Fecha_Emision: rc.Fecha_Emision,
                              Fecha_Vencimiento: rc.Fecha_Vencimiento || '',
                              Plazo_Pago: rc.Dias_PlazoPago || 30,
                              Dias_Emision: 0,
                              Dias_Vencimiento: rc.Dias_Pago || 0,
                              Rango_Cartera: 'CANCELADA',
                              Valor_Saldo: 0,
                              Productos: [],
                              grupoNumero: rc.grupoNumero || 0,
                              grupoNombre: `Grupo ${rc.grupoNumero || 0}`,
                              directorNombre: rc.directorNombre || '',
                              directorEmail: '',
                              categoriaEdad: 'CORRIENTE',
                              diasVencimientoCalc: rc.Dias_Pago || 0,
                              estaVencida: false,
                            });
                          }
                        }}
                      >
                        <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0071e3' }}>
                          {rc.Prefijo_FacturaVenta} {rc.Numero_FacturaVenta}
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: '#16a34a' }}>
                          RC-{rc.Numero_ReciboCaja}
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1E293B' }}>{rc.Empresa}</td>
                        <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{rc.Identificacion}</td>
                        <td style={{ padding: '9px 14px', color: '#334155' }}>{rc.Nombre_Empleado}</td>
                        <td style={{ padding: '9px 14px', color: '#475569' }}>{rc.directorNombre || '—'}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: '#64748B', fontSize: 12 }}>
                          {formatCurrency(rc.Valor_Factura)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                          {formatCurrency(rc.Valor_Pagado)}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                          <span
                            className={`badge ${isKilled ? 'badge-success' : 'badge-warning'}`}
                            style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px' }}
                          >
                            {isKilled ? '100% RECAUDADA' : 'ABONO RECIBO'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>
                          {rc.Fecha_Emision ? rc.Fecha_Emision.split('T')[0] : '—'}
                        </td>
                        <td style={{ padding: '9px 14px', color: '#166534', fontWeight: 650, fontSize: 12 }}>
                          {rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : (rc.Fecha_Recibo || '—')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : statusFilter === 'open' ? (
            /* TABLA 2: FACTURAS ABIERTAS EN CARTERA */
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
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
                {filteredOpenInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px 14px', color: '#94A3B8' }}>
                      No se encontraron facturas abiertas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredOpenInvoices.slice(0, 100).map((r, idx) => (
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
                          className={`badge ${r.estaVencida ? 'badge-danger' : 'badge-warning'}`}
                          style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px' }}
                        >
                          {r.categoriaEdad === 'CORRIENTE' ? 'AL DÍA' : r.categoriaEdad.replace('_', '-')}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>
                        {r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>
                        {r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* TABLA 3: BASE COMPLETA (ABIERTAS + RECAUDADAS) */
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>#</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>No. Factura</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Documento / Recibo</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Cliente / Empresa</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>NIT</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Comercial</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Director</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                    Saldo / Vr. Pagado
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                    Estado Base
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Emisión</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Vence / Recaudo</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpenInvoices.length + filteredRecaudos.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '36px 14px', color: '#94A3B8' }}>
                      No se encontraron registros en la base para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  [
                    ...filteredOpenInvoices.map((r, i) => ({ type: 'open' as const, data: r, key: `open-${i}` })),
                    ...filteredRecaudos.map((rc, i) => ({ type: 'killed' as const, data: rc, key: `rc-${i}` })),
                  ]
                    .slice(0, 100)
                    .map((item, idx) => {
                      if (item.type === 'open') {
                        const r = item.data as CarteraRecord;
                        return (
                          <tr
                            key={item.key}
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
                            <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>Factura Venta</td>
                            <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1E293B' }}>{r.Empresa}</td>
                            <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{r.Identificacion}</td>
                            <td style={{ padding: '9px 14px', color: '#334155' }}>{r.Nombre_Empleado}</td>
                            <td style={{ padding: '9px 14px', color: '#475569' }}>{r.directorNombre}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 750, color: '#DC2626' }}>
                              {formatCurrency(r.Valor_Saldo)}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                              <span className="badge badge-warning" style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>
                                🔴 PENDIENTE EN CARTERA
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
                      } else {
                        const rc = item.data as ReciboCajaRecord;
                        return (
                          <tr
                            key={item.key}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                            }}
                          >
                            <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{idx + 1}</td>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#166534' }}>
                              {rc.Prefijo_FacturaVenta} {rc.Numero_FacturaVenta}
                            </td>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#16a34a', fontSize: 12 }}>
                              RC-{rc.Numero_ReciboCaja}
                            </td>
                            <td style={{ padding: '9px 14px', fontWeight: 600, color: '#1E293B' }}>{rc.Empresa}</td>
                            <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>{rc.Identificacion}</td>
                            <td style={{ padding: '9px 14px', color: '#334155' }}>{rc.Nombre_Empleado}</td>
                            <td style={{ padding: '9px 14px', color: '#475569' }}>{rc.directorNombre || '—'}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 750, color: '#166534' }}>
                              {formatCurrency(rc.Valor_Pagado)}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                              {(() => {
                                const isRcKilled = isReciboSaldado(rc, invoiceTotalPaidMap);
                                return (
                                  <span
                                    className={`badge ${isRcKilled ? 'badge-success' : 'badge-warning'}`}
                                    style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px' }}
                                  >
                                    {isRcKilled ? '🟢 100% RECAUDADA' : '🟡 ABONO RECIBO'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '9px 14px', color: '#64748B', fontSize: 12 }}>
                              {rc.Fecha_Emision ? rc.Fecha_Emision.split('T')[0] : '—'}
                            </td>
                            <td style={{ padding: '9px 14px', color: '#166534', fontWeight: 650, fontSize: 12 }}>
                              {rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : (rc.Fecha_Recibo || '—')}
                            </td>
                          </tr>
                        );
                      }
                    })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación / Aviso */}
        {((statusFilter === 'killed' ? filteredRecaudos.length : statusFilter === 'open' ? filteredOpenInvoices.length : filteredOpenInvoices.length + filteredRecaudos.length) > 100) && (
          <div style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: '#64748B' }}>
            Mostrando las primeras 100 de {formatNumber(statusFilter === 'killed' ? filteredRecaudos.length : statusFilter === 'open' ? filteredOpenInvoices.length : filteredOpenInvoices.length + filteredRecaudos.length)} facturas. Usa el buscador o descarga el Excel completo para ver todas.
          </div>
        )}
      </div>
    </div>
  );
}
