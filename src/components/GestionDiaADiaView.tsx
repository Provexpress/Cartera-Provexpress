import { useState, useMemo } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Search,
  Filter,
  DollarSign,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Building,
  ArrowUpRight,
  Download,
  Calendar,
} from 'lucide-react';
import type { CarteraRecord, ReciboCajaRecord } from '../types';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';

interface Props {
  records: CarteraRecord[];
  recibos: ReciboCajaRecord[];
  fechaBase?: string;
  onSelectRecord?: (record: CarteraRecord) => void;
}

export function GestionDiaADiaView({
  records,
  recibos,
  fechaBase = '2026-10-06',
  onSelectRecord,
}: Props) {
  const [activeTab, setActiveTab] = useState<'matadas' | 'cronologico' | 'nuevas'>('matadas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | '100' | 'abono'>('all');

  // 1. Recibos de Caja desde la fecha base (Facturas Matadas)
  const recibosGestion = useMemo(() => {
    return recibos.filter((rc) => {
      const fecha = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '';
      return fecha >= fechaBase;
    });
  }, [recibos, fechaBase]);

  // 2. Facturas Nuevas Ingresadas desde la fecha base
  const facturasNuevas = useMemo(() => {
    return records.filter((r) => {
      const fecha = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      return fecha >= fechaBase;
    });
  }, [records, fechaBase]);

  // Totales
  const totalRecaudadoMatado = useMemo(() => {
    return recibosGestion.reduce((sum, rc) => sum + rc.Valor_Pagado, 0);
  }, [recibosGestion]);

  const totalNuevasIngresadas = useMemo(() => {
    return facturasNuevas.reduce((sum, r) => sum + r.Valor_Saldo, 0);
  }, [facturasNuevas]);

  const facturasMatadasTotal100 = useMemo(() => {
    return recibosGestion.filter((rc) => rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0).length;
  }, [recibosGestion]);

  const abonosParciales = useMemo(() => {
    return recibosGestion.filter((rc) => rc.Valor_Pagado < rc.Valor_Factura).length;
  }, [recibosGestion]);

  // Agrupación cronológica día a día
  const dailyTimeline = useMemo(() => {
    const daysMap = new Map<string, { fecha: string; count: number; totalRecaudado: number; recibos: ReciboCajaRecord[] }>();

    recibosGestion.forEach((rc) => {
      const f = rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : 'Sin fecha';
      const existing = daysMap.get(f) || { fecha: f, count: 0, totalRecaudado: 0, recibos: [] };
      existing.count += 1;
      existing.totalRecaudado += rc.Valor_Pagado;
      existing.recibos.push(rc);
      daysMap.set(f, existing);
    });

    return Array.from(daysMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [recibosGestion]);

  // Filtrado de la lista activa de Facturas Matadas
  const filteredRecibosMatadas = useMemo(() => {
    let list = recibosGestion;

    if (selectedGroup !== 'all') {
      list = list.filter((rc) => rc.grupoNumero === selectedGroup);
    }

    if (filterType === '100') {
      list = list.filter((rc) => rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0);
    } else if (filterType === 'abono') {
      list = list.filter((rc) => rc.Valor_Pagado < rc.Valor_Factura);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (rc) =>
          rc.Empresa.toLowerCase().includes(q) ||
          rc.Identificacion.includes(q) ||
          String(rc.Numero_FacturaVenta).includes(q) ||
          String(rc.Numero_ReciboCaja).includes(q) ||
          rc.Nombre_Empleado.toLowerCase().includes(q)
      );
    }

    return list;
  }, [recibosGestion, selectedGroup, filterType, searchTerm]);

  return (
    <div className="gestion-view-container">
      {/* 1. HERO BANNER DE GESTIÓN OPERATIVA */}
      <div className="gestion-hero-banner">
        <div className="gestion-hero-info">
          <div className="eyebrow green">
            <Zap size={14} /> Gestión de Cartera Día a Día · Base de Control {fechaBase}
          </div>
          <h2>Control Operativo de Cartera y Facturas Matadas</h2>
          <p>
            Monitoreo en tiempo real de facturas saldadas por <strong>Recibos de Caja</strong>, abonos recibidos e ingresos de nuevas facturas desde el <strong>{fechaBase}</strong>.
          </p>
        </div>

        <div className="gestion-hero-kpis">
          <div className="gestion-pill-kpi green">
            <span className="lbl">Facturas Matadas (Recaudadas)</span>
            <strong className="val">{formatCurrency(totalRecaudadoMatado)}</strong>
            <span className="sub">{recibosGestion.length} recibos procesados</span>
          </div>

          <div className="gestion-pill-kpi blue">
            <span className="lbl">Nuevas Facturas Emitidas</span>
            <strong className="val">{formatCurrency(totalNuevasIngresadas)}</strong>
            <span className="sub">{facturasNuevas.length} facturas nuevas</span>
          </div>

          <div className="gestion-pill-kpi neutral">
            <span className="lbl">Gestión Neta</span>
            <strong className="val" style={{ color: totalRecaudadoMatado >= totalNuevasIngresadas ? '#15803d' : '#b91c1c' }}>
              {formatCurrency(totalRecaudadoMatado - totalNuevasIngresadas)}
            </strong>
            <span className="sub">
              {totalRecaudadoMatado >= totalNuevasIngresadas ? 'Liberación neta de cartera' : 'Aumento de cartera'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE INDICADORES DE COBRO */}
      <div className="gestion-cards-grid">
        <div className="gestion-stat-card">
          <div className="stat-top">
            <span className="stat-label">Facturas Matadas al 100%</span>
            <span className="stat-badge green">Saldadas</span>
          </div>
          <div className="stat-number green">{facturasMatadasTotal100} facturas</div>
          <div className="stat-desc">Facturas completamente canceladas que salieron de cartera</div>
        </div>

        <div className="gestion-stat-card">
          <div className="stat-top">
            <span className="stat-label">Abonos Parciales</span>
            <span className="stat-badge orange">Abonos</span>
          </div>
          <div className="stat-number orange">{abonosParciales} pagos</div>
          <div className="stat-desc">Recaudos que redujeron el saldo sin cancelar el total</div>
        </div>

        <div className="gestion-stat-card">
          <div className="stat-top">
            <span className="stat-label">Días de Gestión Evaluados</span>
            <span className="stat-badge blue">{dailyTimeline.length} días activos</span>
          </div>
          <div className="stat-number blue">
            {dailyTimeline.length > 0 ? `${dailyTimeline[dailyTimeline.length - 1].fecha} al ${dailyTimeline[0].fecha}` : fechaBase}
          </div>
          <div className="stat-desc">Seguimiento continuo desde el corte base de inicio</div>
        </div>
      </div>

      {/* 3. SUBNAVEGACIÓN INTERNA */}
      <div className="gestion-subnav-row">
        <div className="segmented-nav" style={{ maxWidth: 'fit-content' }}>
          <button
            type="button"
            className={activeTab === 'matadas' ? 'active' : ''}
            onClick={() => setActiveTab('matadas')}
          >
            <CheckCircle2 size={15} />
            <span>Facturas Matadas por Recibos ({recibosGestion.length})</span>
          </button>
          <button
            type="button"
            className={activeTab === 'cronologico' ? 'active' : ''}
            onClick={() => setActiveTab('cronologico')}
          >
            <Calendar size={15} />
            <span>Desglose Cronológico Día a Día ({dailyTimeline.length})</span>
          </button>
          <button
            type="button"
            className={activeTab === 'nuevas' ? 'active' : ''}
            onClick={() => setActiveTab('nuevas')}
          >
            <TrendingUp size={15} />
            <span>Nuevas Facturas Ingresadas ({facturasNuevas.length})</span>
          </button>
        </div>

        {activeTab === 'matadas' && (
          <div className="gestion-filter-chips">
            <button
              type="button"
              className={`chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              Todos ({recibosGestion.length})
            </button>
            <button
              type="button"
              className={`chip green ${filterType === '100' ? 'active' : ''}`}
              onClick={() => setFilterType('100')}
            >
              Matadas al 100% ({facturasMatadasTotal100})
            </button>
            <button
              type="button"
              className={`chip orange ${filterType === 'abono' ? 'active' : ''}`}
              onClick={() => setFilterType('abono')}
            >
              Abonos ({abonosParciales})
            </button>
          </div>
        )}
      </div>

      {/* 4. TABLA: FACTURAS MATADAS POR RECIBOS DE CAJA */}
      {activeTab === 'matadas' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="table-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Buscar por cliente, NIT, # recibo, # factura o asesor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button type="button" className="clear-search-btn" onClick={() => setSearchTerm('')}>
                  ×
                </button>
              )}
            </div>

            <div className="table-toolbar-right">
              <select
                className="select-input"
                style={{ height: 38 }}
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Todos los Grupos</option>
                <option value="1">Grupo 1 (Rafael Novoa)</option>
                <option value="2">Grupo 2 (Angélica Caballero)</option>
                <option value="3">Grupo 3 (Óscar Beltrán)</option>
                <option value="4">Grupo 4 (Miller Romero)</option>
                <option value="0">Gerencia / Especiales</option>
              </select>

              <div className="table-stats-pill">
                <span>
                  <strong>{formatNumber(filteredRecibosMatadas.length)}</strong> recaudos · Total:{' '}
                  <strong className="green">
                    {formatCurrency(filteredRecibosMatadas.reduce((s, r) => s + r.Valor_Pagado, 0))}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="data-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Recibo de Caja</th>
                  <th>Fecha Recaudo</th>
                  <th>Factura que Mató</th>
                  <th>Cliente / Razón Social</th>
                  <th>Gestor Comercial</th>
                  <th style={{ textAlign: 'right' }}>Valor Factura</th>
                  <th style={{ textAlign: 'right' }}>Valor Recaudado</th>
                  <th style={{ textAlign: 'center' }}>Efecto en Cartera</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecibosMatadas.length > 0 ? (
                  filteredRecibosMatadas.map((rc) => {
                    const isTotalKill = rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0;
                    return (
                      <tr key={rc.id}>
                        <td>
                          <strong className="doc-badge blue">
                            {rc.Prefijo_ReciboCaja || 'RC'} {rc.Numero_ReciboCaja}
                          </strong>
                        </td>
                        <td>
                          <span className="date-val">
                            {rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : 'N/A'}
                          </span>
                          <span className="date-sub">Plazo: {rc.Dias_PlazoPago}d · Pago en {rc.Dias_Pago}d</span>
                        </td>
                        <td>
                          <span className="doc-badge" style={{ color: '#111827' }}>
                            {rc.Prefijo_FacturaVenta || 'FVE'} {rc.Numero_FacturaVenta}
                          </span>
                        </td>
                        <td>
                          <div className="client-cell">
                            <span className="client-name">{rc.Empresa}</span>
                            <span className="client-nit">NIT: {rc.Identificacion}</span>
                          </div>
                        </td>
                        <td>
                          <div className="commercial-cell">
                            <span className="comm-name">{rc.Nombre_Empleado}</span>
                            <span className="comm-group">{rc.directorNombre}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', color: '#6b7280' }}>
                          {formatCurrency(rc.Valor_Factura)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 750, color: '#15803d' }}>
                          {formatCurrency(rc.Valor_Pagado)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isTotalKill ? (
                            <span className="badge badge-success" title="Este recibo canceló la totalidad de la factura">
                              🎯 Mató Factura (100%)
                            </span>
                          ) : (
                            <span className="badge badge-warning" title="Este recibo fue un abono parcial">
                              ⚡ Abono Parcial
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      No se encontraron recibos de caja que cumplan los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VISTA CRONOLÓGICA DÍA A DÍA */}
      {activeTab === 'cronologico' && (
        <div className="daily-timeline-grid">
          {dailyTimeline.map((day) => (
            <div key={day.fecha} className="timeline-day-card">
              <div className="day-header">
                <div className="day-date-badge">
                  <Calendar size={16} />
                  <strong>{day.fecha}</strong>
                </div>
                <span className="day-count-badge green">
                  {day.count} facturas matadas / recaudos
                </span>
              </div>

              <div className="day-amount">
                <span className="lbl">Total Recaudado en el Día:</span>
                <strong className="val green">{formatCurrency(day.totalRecaudado)}</strong>
              </div>

              <div className="day-sample-list">
                <span className="sample-title">Principales pagos del día:</span>
                {day.recibos.slice(0, 4).map((r) => (
                  <div key={r.id} className="day-sample-item">
                    <span>
                      <strong>{r.Prefijo_FacturaVenta || 'FVE'} {r.Numero_FacturaVenta}</strong> · {r.Empresa.length > 25 ? `${r.Empresa.substring(0, 24)}…` : r.Empresa}
                    </span>
                    <strong className="green">{formatCurrency(r.Valor_Pagado)}</strong>
                  </div>
                ))}
                {day.recibos.length > 4 && (
                  <span className="more-hint">+{day.recibos.length - 4} recibos adicionales en este día</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. VISTA DE NUEVAS FACTURAS INGRESADAS */}
      {activeTab === 'nuevas' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div className="table-stats-pill">
              <span>
                <strong>{facturasNuevas.length}</strong> facturas emitidas desde el {fechaBase} · Total:{' '}
                <strong className="blue">{formatCurrency(totalNuevasIngresadas)}</strong>
              </span>
            </div>
          </div>

          <div className="data-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha Emisión</th>
                  <th>Cliente</th>
                  <th>Asesor Comercial</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'right' }}>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {facturasNuevas.length > 0 ? (
                  facturasNuevas.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong className="doc-badge blue">
                          {r.Prefijo} {r.Numero}
                        </strong>
                      </td>
                      <td>{r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : 'N/A'}</td>
                      <td>
                        <div className="client-cell">
                          <span className="client-name">{r.Empresa}</span>
                          <span className="client-nit">NIT: {r.Identificacion}</span>
                        </div>
                      </td>
                      <td>{r.Nombre_Empleado}</td>
                      <td>{r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : 'N/A'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 750 }}>
                        {formatCurrency(r.Valor_Saldo)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      No se registran nuevas facturas emitidas desde la fecha base.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
