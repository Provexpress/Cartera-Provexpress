import { useState, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Boxes, FileText } from 'lucide-react';
import type {
  AgeBucketKey,
  AgingSummaryItem,
  CarteraRecord,
  CustomerSummary,
  ExecutiveSummary,
  GroupSummary,
} from '../types';
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from '../lib/carteraApi';

interface Props {
  records?: CarteraRecord[];
  agingItems?: AgingSummaryItem[];
  groups?: GroupSummary[];
  customers?: CustomerSummary[];
  executives?: ExecutiveSummary[];
  selectedAging?: AgeBucketKey | 'CRITICO_30' | 'all';
  onSelectAging?: (key: AgeBucketKey | 'CRITICO_30' | 'all') => void;
  selectedExecutive?: string | 'all';
  onSelectExecutive?: (exec: string | 'all') => void;
  selectedDirector?: string | 'all';
  onSelectDirector?: (dir: string | 'all') => void;
  onSelectRecord?: (record: CarteraRecord) => void;
  onViewFullTable?: () => void;
}

const DIRECTOR_COLOR_MAP: Record<string, string> = {
  'Miller Romero': '#0071e3',
  'Óscar Beltrán': '#16a34a',
  'Angélica Caballero': '#ff9f0a',
  'Rafael Novoa': '#7928ca',
  'Gerencia / Especiales': '#ef4444',
  'Otras Áreas / Especiales': '#ef4444',
};

const DEFAULT_PALETTE = ['#0071e3', '#16a34a', '#ff9f0a', '#7928ca', '#ef4444', '#06b6d4', '#8b5cf6'];

export function CarteraCharts({
  records = [],
  agingItems = [],
  groups = [],
  executives = [],
  selectedAging = 'all',
  onSelectAging,
  selectedExecutive = 'all',
  onSelectExecutive,
  selectedDirector = 'all',
  onSelectDirector,
  onSelectRecord,
  onViewFullTable,
}: Props) {
  // Pestaña activa en la tarjeta 4: 'pie' (Por dirección) o 'facturas' (Lista destacada)
  const [rightTab, setRightTab] = useState<'pie' | 'facturas'>('pie');

  // ─── 1. COMPOSICIÓN POR EDADES DE VENCIMIENTO ─────────────────────────────
  const totalAgingVal = useMemo(
    () => agingItems.reduce((sum, item) => sum + item.totalValor, 0),
    [agingItems]
  );

  const displayAgingItems = useMemo(() => {
    return agingItems.map((item) => {
      let tone: 'blue' | 'orange' | 'red' = 'blue';
      let badge = 'Al día';
      const isOverdue30 = ['31_60', '61_90', '91_120', '121_180', 'MAS_180'].includes(item.key);

      if (isOverdue30) {
        tone = 'red';
        badge = 'Crítico >30d';
      } else if (item.key === '1_30') {
        tone = 'orange';
        badge = 'Gestión comercial';
      } else {
        tone = 'blue';
        badge = 'Al día';
      }

      let displayName = item.shortLabel;
      if (item.key === 'CORRIENTE') displayName = 'Corriente';
      else if (item.key === '1_30') displayName = '1-30 días';
      else if (item.key === '31_60') displayName = '31-60 días';
      else if (item.key === '61_90') displayName = '61-90 días';
      else if (item.key === '91_120') displayName = '91-120 días';
      else if (item.key === '121_180') displayName = '121-180 días';
      else if (item.key === 'MAS_180') displayName = '> 180 días';

      return {
        key: item.key,
        name: displayName,
        value: item.totalValor,
        count: item.count,
        percent: totalAgingVal > 0 ? (item.totalValor / totalAgingVal) * 100 : 0,
        tone,
        badge,
        isOverdue30,
      };
    });
  }, [agingItems, totalAgingVal]);

  const maxAgingVal = useMemo(
    () => Math.max(...displayAgingItems.map((d) => d.value), 1),
    [displayAgingItems]
  );

  const criticalOverdueItems = useMemo(
    () => displayAgingItems.filter((i) => i.isOverdue30),
    [displayAgingItems]
  );
  const criticalOverdueTotal = useMemo(
    () => criticalOverdueItems.reduce((sum, i) => sum + i.value, 0),
    [criticalOverdueItems]
  );
  const criticalOverdueCount = useMemo(
    () => criticalOverdueItems.reduce((sum, i) => sum + i.count, 0),
    [criticalOverdueItems]
  );
  const criticalOverduePercent = totalAgingVal > 0 ? (criticalOverdueTotal / totalAgingVal) * 100 : 0;

  const activeAgingLabel = useMemo(() => {
    if (selectedAging === 'all') return 'Todos';
    if (selectedAging === 'CRITICO_30') return 'Crítico (>30 días)';
    const found = displayAgingItems.find((i) => i.key === selectedAging);
    return found ? found.name : String(selectedAging);
  }, [selectedAging, displayAgingItems]);

  // ─── 2. TOP 10 FACTURAS DE MAYOR SALDO ────────────────────────────────────
  const top10Invoices = useMemo(() => {
    return [...records]
      .filter((r) => r.Valor_Saldo > 0)
      .sort((a, b) => b.Valor_Saldo - a.Valor_Saldo)
      .slice(0, 10);
  }, [records]);

  // ─── 3. EJECUTIVOS COMERCIALES CON MAYOR SALDO PENDIENTE ──────────────────
  const sellerChartData = useMemo(() => {
    if (executives && executives.length > 0) {
      return [...executives]
        .filter((e) => e.totalSaldo > 0)
        .sort((a, b) => b.totalSaldo - a.totalSaldo)
        .slice(0, 12)
        .map((e) => ({
          name: e.nombre,
          shortName: e.nombre.split(' ').slice(0, 2).join(' '),
          value: e.totalSaldo,
          docs: e.docCount,
          director: e.directorNombre,
        }));
    }

    const map = new Map<string, { total: number; count: number; director: string }>();
    records.forEach((r) => {
      const emp = r.Nombre_Empleado || 'Sin Asignar';
      const cur = map.get(emp) || { total: 0, count: 0, director: r.directorNombre };
      cur.total += r.Valor_Saldo;
      cur.count += 1;
      map.set(emp, cur);
    });

    return Array.from(map.entries())
      .filter(([, data]) => data.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 12)
      .map(([name, data]) => ({
        name,
        shortName: name.split(' ').slice(0, 2).join(' '),
        value: data.total,
        docs: data.count,
        director: data.director,
      }));
  }, [executives, records]);

  // ─── 4. PENDIENTE POR DIRECCIÓN COMERCIAL (DONUT & LEGEND) ────────────────
  const directorData = useMemo(() => {
    return groups
      .filter((g) => g.totalSaldo > 0)
      .map((g, idx) => {
        const dirName = g.directorNombre || g.grupoNombre;
        const color = DIRECTOR_COLOR_MAP[dirName] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
        return {
          name: dirName,
          value: g.totalSaldo,
          count: g.docCount,
          color,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [groups]);

  // Lista para la pestaña 'facturas' en Card 4
  const topInvoicesTabList = useMemo(() => {
    return [...records]
      .filter((r) => r.Valor_Saldo > 0)
      .sort((a, b) => b.Valor_Saldo - a.Valor_Saldo)
      .slice(0, 25);
  }, [records]);

  return (
    <div className="chart-grid">
      {/* ─── CARD 1: COMPOSICIÓN POR EDADES DE VENCIMIENTO ─── */}
      <article className="chart-card age-composition-card">
        <header className="age-card-header">
          <div>
            <h2>Composición por antigüedad</h2>
            <p>
              {selectedAging !== 'all'
                ? `Filtrado por: ${activeAgingLabel} · Toca para quitar`
                : 'Toca un rango para filtrar todo el tablero'}
            </p>
          </div>
          <button
            type="button"
            className={`overdue-highlight-chip ${selectedAging === 'CRITICO_30' ? 'active' : ''}`}
            onClick={() => onSelectAging?.(selectedAging === 'CRITICO_30' ? 'all' : 'CRITICO_30')}
            title={
              selectedAging === 'CRITICO_30'
                ? 'Toca para quitar filtro de crítico'
                : 'Toca para filtrar facturas críticas (>30 días)'
            }
          >
            <AlertTriangle size={16} />
            <div>
              <strong>Crítico &gt;30d: {formatCurrency(criticalOverdueTotal)}</strong>
              <small>
                {formatNumber(criticalOverdueCount)} facturas · {criticalOverduePercent.toFixed(1)}%
              </small>
            </div>
          </button>
        </header>

        <div className="age-bars-container">
          {displayAgingItems.map((item) => {
            const isSelected =
              selectedAging === item.key ||
              (selectedAging === 'CRITICO_30' && item.isOverdue30);
            const isDimmed = selectedAging !== 'all' && !isSelected;
            const barWidthPercent =
              item.value > 0 ? Math.max(14, (item.value / maxAgingVal) * 100) : 0;

            return (
              <div
                key={item.key}
                className={`age-bar-row tone-${item.tone} ${isSelected ? 'active' : ''} ${
                  isDimmed ? 'dimmed' : ''
                }`}
                onClick={() => onSelectAging?.(selectedAging === item.key ? 'all' : item.key)}
                role="button"
                tabIndex={0}
                title={
                  isSelected
                    ? `Toca para quitar filtro de ${item.name}`
                    : `Toca para filtrar facturas de ${item.name}`
                }
              >
                <div className="age-bar-label">
                  <strong>{item.name}</strong>
                  <span className={`age-pill ${item.tone}`}>{item.badge}</span>
                </div>
                <div className="age-bar-track">
                  <div
                    className={`age-bar-fill ${item.tone}`}
                    style={{
                      width: `${barWidthPercent}%`,
                      minWidth: item.value > 0 ? 70 : 0,
                    }}
                  >
                    {item.value > 0 && (
                      <span className="age-bar-inline-val">
                        {formatCompactCurrency(item.value)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="age-bar-meta">
                  <strong>{formatCurrency(item.value)}</strong>
                  <span>
                    {formatNumber(item.count)} fact. · <b>{item.percent.toFixed(1)}%</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="age-card-footer">
          <span className="legend-item blue">
            <i /> Al día (Corriente)
          </span>
          <span className="legend-item orange">
            <i /> Gestión comercial (1 a 30 días)
          </span>
          <span className="legend-item red">
            <i /> Crítico (&gt;30 días)
          </span>
        </div>
      </article>

      {/* ─── CARD 2: TOP 10 FACTURAS DE MAYOR SALDO ─── */}
      <article className="chart-card">
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
          }}
        >
          <div>
            <h2>
              {selectedExecutive !== 'all'
                ? `Top facturas · ${selectedExecutive}`
                : selectedAging !== 'all'
                ? `Top facturas · ${activeAgingLabel}`
                : selectedDirector !== 'all'
                ? `Top facturas · ${selectedDirector}`
                : 'Top 10 facturas de mayor saldo'}
            </h2>
            <p>
              {selectedExecutive !== 'all'
                ? `Facturas abiertas de ${selectedExecutive} con mayor importe`
                : selectedAging !== 'all'
                ? `Facturas abiertas en el rango ${activeAgingLabel} con mayor importe pendiente`
                : selectedDirector !== 'all'
                ? `Facturas abiertas de la dirección ${selectedDirector}`
                : 'Facturas abiertas con mayor importe pendiente por cobrar'}
            </p>
          </div>
          {onViewFullTable && (
            <button
              type="button"
              className="top-remisiones-header-action"
              onClick={onViewFullTable}
              title="Ver todas las facturas en la tabla completa"
            >
              Ver todas en detalle →
            </button>
          )}
        </header>

        <div className="top-remisiones-list" style={{ minHeight: 300, maxHeight: 310 }}>
          {top10Invoices.length === 0 ? (
            <div
              style={{
                padding: '28px 12px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: 13,
              }}
            >
              No hay facturas abiertas para los filtros seleccionados
            </div>
          ) : (
            top10Invoices.map((inv, idx) => {
              const isCritical = inv.diasVencimientoCalc > 30;
              const isWarning = inv.diasVencimientoCalc > 0 && inv.diasVencimientoCalc <= 30;
              const ageClass = isCritical ? 'critical' : isWarning ? 'warning' : 'ok';
              const ageText =
                inv.diasVencimientoCalc <= 0
                  ? 'Al día'
                  : `${inv.diasVencimientoCalc} días`;

              return (
                <div
                  key={inv.id}
                  className="top-remision-item"
                  onClick={() => onSelectRecord?.(inv)}
                  role="button"
                  tabIndex={0}
                  title={`Ver detalle de la factura ${inv.Prefijo || 'FVE'} ${inv.Numero}`}
                >
                  <div className="top-remision-left">
                    <span className={`top-remision-rank rank-${idx + 1}`}>#{idx + 1}</span>
                    <div className="top-remision-info">
                      <div className="top-remision-primary">
                        <strong className="top-remision-doc">
                          {inv.Prefijo || 'FVE'} {inv.Numero}
                        </strong>
                        <span className="top-remision-company" title={inv.Empresa}>
                          {inv.Empresa}
                        </span>
                      </div>
                      <div className="top-remision-meta">
                        <span className="top-remision-seller" title={inv.Nombre_Empleado}>
                          {inv.Nombre_Empleado}
                        </span>
                        <span>·</span>
                        <span className={`top-remision-age ${ageClass}`}>{ageText}</span>
                      </div>
                    </div>
                  </div>
                  <div className="top-remision-right">
                    <strong className="top-remision-value">
                      {formatCurrency(inv.Valor_Saldo)}
                    </strong>
                    <span className="top-remision-action-hint">Ver detalle →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>

      {/* ─── CARD 3: EJECUTIVOS COMERCIALES CON MAYOR SALDO PENDIENTE ─── */}
      <article className="chart-card">
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
          }}
        >
          <div>
            <h2>
              {selectedDirector !== 'all'
                ? `Ejecutivos · ${selectedDirector}`
                : selectedAging !== 'all'
                ? `Ejecutivos con saldo · ${activeAgingLabel}`
                : 'Ejecutivos comerciales con mayor saldo pendiente'}
            </h2>
            <p>
              {selectedExecutive !== 'all'
                ? `Filtrado por: ${selectedExecutive} · Toca la barra para quitar`
                : selectedAging !== 'all'
                ? `Distribución por asesor comercial en el rango ${activeAgingLabel}`
                : 'Toca una barra para filtrar por comercial'}
            </p>
          </div>
          {selectedExecutive !== 'all' && (
            <button
              type="button"
              className="top-remisiones-header-action"
              onClick={() => onSelectExecutive?.('all')}
              title="Quitar filtro de comercial"
            >
              Quitar filtro ({selectedExecutive.split(' ').slice(0, 2).join(' ')}) ✕
            </button>
          )}
        </header>

        <div className="chart-body" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sellerChartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 45 }}
              onClick={(state: any) => {
                const name =
                  state?.activeLabel ||
                  (typeof state?.activeIndex === 'number'
                    ? sellerChartData[state.activeIndex]?.name
                    : undefined) ||
                  state?.activePayload?.[0]?.payload?.name;
                if (name) {
                  onSelectExecutive?.(
                    selectedExecutive === String(name) ? 'all' : String(name)
                  );
                }
              }}
            >
              <CartesianGrid stroke="#e8e8ed" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-32}
                textAnchor="end"
                height={80}
                tickLine={false}
                axisLine={false}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const fullName = String(payload?.value || '');
                  const isSelected = selectedExecutive === fullName;
                  const shortName = fullName.split(' ').slice(0, 2).join(' ');
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={14}
                        textAnchor="end"
                        transform="rotate(-32)"
                        fill={isSelected ? '#7928ca' : '#475569'}
                        fontWeight={isSelected ? 750 : 500}
                        fontSize={11}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectExecutive?.(
                            selectedExecutive === fullName ? 'all' : fullName
                          );
                        }}
                      >
                        {shortName}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis
                tickFormatter={(v) => formatCompactCurrency(v)}
                tickLine={false}
                axisLine={false}
                width={72}
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip
                formatter={(val: any) => [
                  formatCurrency(Number(val)),
                  'Saldo Pendiente',
                ]}
                labelFormatter={(label) => {
                  const found = sellerChartData.find((s) => s.name === label);
                  return found
                    ? `${found.name} (${found.docs} facturas)`
                    : String(label);
                }}
                contentStyle={{
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: 'none',
                }}
              />
              <Bar
                dataKey="value"
                name="Pendiente"
                radius={[7, 7, 0, 0]}
                maxBarSize={34}
                cursor="pointer"
                isAnimationActive={false}
              >
                {sellerChartData.map((entry) => {
                  const isSelected = selectedExecutive === entry.name;
                  return (
                    <Cell
                      key={entry.name}
                      fill={isSelected ? '#7928ca' : '#af52de'}
                      opacity={
                        selectedExecutive !== 'all' && !isSelected ? 0.35 : 1
                      }
                      style={{ cursor: 'pointer' }}
                      onClick={(e: any) => {
                        e?.stopPropagation?.();
                        onSelectExecutive?.(
                          selectedExecutive === entry.name ? 'all' : entry.name
                        );
                      }}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      {/* ─── CARD 4: PENDIENTE POR DIRECCIÓN COMERCIAL / FACTURAS ─── */}
      <article className="chart-card">
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <h2>
              {rightTab === 'facturas'
                ? 'Facturas destacadas'
                : selectedAging !== 'all'
                ? `Dirección comercial · ${activeAgingLabel}`
                : 'Pendiente por dirección'}
            </h2>
            <p>
              {rightTab === 'facturas'
                ? `${formatNumber(records.length)} facturas ordenadas por mayor importe`
                : selectedDirector !== 'all'
                ? `Filtrado por: ${selectedDirector} · Toca para quitar`
                : selectedAging !== 'all'
                ? `Distribución de saldo por dirección en el rango ${activeAgingLabel}`
                : 'Toca una dirección para filtrar todo el tablero'}
            </p>
          </div>
          <div className="chart-header-actions-group">
            <div className="chart-header-tabs">
              <button
                type="button"
                className={`chart-tab-btn ${rightTab === 'facturas' ? 'active' : ''}`}
                onClick={() => setRightTab('facturas')}
                title="Ver facturas destacadas"
              >
                <FileText size={12} />
                <span>Facturas ({formatNumber(records.length)})</span>
              </button>
              <button
                type="button"
                className={`chart-tab-btn ${rightTab === 'pie' ? 'active' : ''}`}
                onClick={() => setRightTab('pie')}
                title="Ver distribución por dirección comercial"
              >
                <Boxes size={12} />
                <span>Por dirección</span>
              </button>
            </div>
            {rightTab === 'facturas' && onViewFullTable && (
              <button
                type="button"
                className="top-remisiones-header-action"
                onClick={onViewFullTable}
              >
                Ver en tabla →
              </button>
            )}
            {rightTab === 'pie' && selectedDirector !== 'all' && (
              <button
                type="button"
                className="top-remisiones-header-action"
                onClick={() => onSelectDirector?.('all')}
                title="Quitar filtro de dirección comercial"
              >
                Quitar ({selectedDirector.split(' ')[0]}) ✕
              </button>
            )}
          </div>
        </header>

        {rightTab === 'facturas' ? (
          <div className="top-remisiones-list" style={{ minHeight: 280, maxHeight: 280 }}>
            {topInvoicesTabList.length === 0 ? (
              <div
                style={{
                  padding: '28px 12px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: 13,
                }}
              >
                No hay facturas para mostrar
              </div>
            ) : (
              topInvoicesTabList.map((inv, idx) => {
                const isCritical = inv.diasVencimientoCalc > 30;
                const isWarning = inv.diasVencimientoCalc > 0 && inv.diasVencimientoCalc <= 30;
                const ageClass = isCritical ? 'critical' : isWarning ? 'warning' : 'ok';
                const ageText =
                  inv.diasVencimientoCalc <= 0
                    ? 'Al día'
                    : `${inv.diasVencimientoCalc} días`;

                return (
                  <div
                    key={inv.id}
                    className="top-remision-item"
                    onClick={() => onSelectRecord?.(inv)}
                    role="button"
                    tabIndex={0}
                    title={`Ver factura ${inv.Prefijo || 'FVE'} ${inv.Numero}`}
                  >
                    <div className="top-remision-left">
                      <span className={`top-remision-rank rank-${idx + 1}`}>#{idx + 1}</span>
                      <div className="top-remision-info">
                        <div className="top-remision-primary">
                          <strong className="top-remision-doc">
                            {inv.Prefijo || 'FVE'} {inv.Numero}
                          </strong>
                          <span className="top-remision-company" title={inv.Empresa}>
                            {inv.Empresa}
                          </span>
                        </div>
                        <div className="top-remision-meta">
                          <span className="top-remision-seller">
                            {inv.Nombre_Empleado}
                          </span>
                          <span>·</span>
                          <span className={`top-remision-age ${ageClass}`}>{ageText}</span>
                        </div>
                      </div>
                    </div>
                    <div className="top-remision-right">
                      <strong className="top-remision-value">
                        {formatCurrency(inv.Valor_Saldo)}
                      </strong>
                      <span className="top-remision-action-hint">Ver detalle →</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="donut-layout" style={{ minHeight: 280, height: 280 }}>
            <ResponsiveContainer width="48%" height={260}>
              <PieChart>
                <Pie
                  data={directorData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={94}
                  paddingAngle={2}
                  stroke="none"
                  cursor="pointer"
                  isAnimationActive={false}
                  onClick={(entry: any) => {
                    if (entry?.name) {
                      onSelectDirector?.(
                        selectedDirector === String(entry.name) ? 'all' : String(entry.name)
                      );
                    }
                  }}
                >
                  {directorData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]}
                      opacity={
                        selectedDirector !== 'all' && selectedDirector !== entry.name
                          ? 0.35
                          : 1
                      }
                      stroke={selectedDirector === entry.name ? '#1d1d1f' : 'none'}
                      strokeWidth={selectedDirector === entry.name ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [
                    formatCurrency(Number(value)),
                    'Saldo',
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    border: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend-list">
              {directorData.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`legend-btn ${
                    selectedDirector === entry.name ? 'active' : ''
                  }`}
                  onClick={() =>
                    onSelectDirector?.(
                      selectedDirector === entry.name ? 'all' : entry.name
                    )
                  }
                >
                  <i style={{ background: entry.color }} />
                  <span>
                    {entry.name}
                    <small>{formatNumber(entry.count)} facturas</small>
                  </span>
                  <strong>{formatCompactCurrency(entry.value)}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
