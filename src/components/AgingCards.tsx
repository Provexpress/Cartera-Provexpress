import { CalendarClock, AlertTriangle, ShieldCheck, Activity, Check } from 'lucide-react';
import type { AgeBucketKey, AgingSummaryItem } from '../types';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';

interface Props {
  totalSaldo: number;
  totalCorriente: number;
  totalVencido: number;
  porcentajeVencido: number;
  totalDocumentos: number;
  clientesUnicos: number;
  agingItems: AgingSummaryItem[];
  selectedAging: AgeBucketKey | 'CRITICO_30' | 'all';
  onSelectAging: (key: AgeBucketKey | 'CRITICO_30' | 'all') => void;
}

/**
 * Tacómetro Semicircular de Precisión en SVG (Estilo Power BI / Control de Cartera)
 */
function SemicircleGauge({
  percentage,
  color,
  size = 114,
  strokeWidth = 9.5,
  valueText,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  valueText?: string;
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const circumference = Math.PI * radius;
  const validPct = Math.min(100, Math.max(0, isNaN(percentage) ? 0 : percentage));
  const strokeDashoffset = circumference * (1 - validPct / 100);

  return (
    <svg
      width={size}
      height={size * 0.63}
      viewBox={`0 0 ${size} ${size * 0.65}`}
      style={{ overflow: 'visible', margin: '4px auto 2px', display: 'block' }}
    >
      {/* Pista de fondo */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#ececf2"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Arco de progreso de color */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
        }}
      />
      {/* Texto de porcentaje central */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize="13.5"
        fontWeight="800"
        fill="#1d1d1f"
        letterSpacing="-0.02em"
      >
        {valueText || `${validPct.toFixed(1)}%`}
      </text>
    </svg>
  );
}

export function AgingCards({
  totalSaldo,
  totalCorriente,
  totalVencido,
  porcentajeVencido,
  totalDocumentos,
  clientesUnicos,
  agingItems,
  selectedAging,
  onSelectAging,
}: Props) {
  return (
    <div className="aging-section">
      {/* 1. Header con Totales Globales y Tacómetro de Riesgo */}
      <div className="aging-global-row">
        {/* Tarjeta 1: Total Cartera Hoy */}
        <div
          className={`global-card main-balance ${selectedAging === 'all' ? 'active-ring' : ''}`}
          onClick={() => onSelectAging('all')}
          role="button"
          tabIndex={0}
          title="Toca para ver la cartera completa sin filtros de edad"
        >
          <div className="card-top">
            <span className="card-tag tag-blue">Total Cartera Activa</span>
            <span className="card-docs-pill">{formatNumber(totalDocumentos)} docs</span>
          </div>
          <div className="card-amount">{formatCurrency(totalSaldo)}</div>
          <div className="card-footer-info">
            <span>{formatNumber(clientesUnicos)} clientes con saldo pendiente</span>
            {selectedAging === 'all' && <span className="view-all-pill">Viendo todo</span>}
          </div>
        </div>

        {/* Tarjeta 2: Cartera Corriente (Al Día) */}
        <div
          className={`global-card current-balance ${selectedAging === 'CORRIENTE' ? 'active-ring' : ''}`}
          onClick={() => onSelectAging(selectedAging === 'CORRIENTE' ? 'all' : 'CORRIENTE')}
          role="button"
          tabIndex={0}
          title="Toca para filtrar solo cartera al día (no vencida)"
        >
          <div className="card-top">
            <span className="card-tag tag-green">
              <ShieldCheck size={14} /> Corriente (Sin Mora)
            </span>
            <span className="card-pct-pill green">
              {formatPercent(totalSaldo > 0 ? (totalCorriente / totalSaldo) * 100 : 0)}
            </span>
          </div>
          <div className="card-amount green">{formatCurrency(totalCorriente)}</div>
          <div className="card-footer-info">
            <span>Cartera sana al día (0 días de vencimiento)</span>
            {selectedAging === 'CORRIENTE' && <span className="view-all-pill green">Filtrando</span>}
          </div>
        </div>

        {/* Tarjeta 3: Total Cartera Vencida */}
        <div
          className={`global-card overdue-balance ${selectedAging !== 'all' && selectedAging !== 'CORRIENTE' ? 'active-ring' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (selectedAging !== 'all' && selectedAging !== 'CORRIENTE') {
              onSelectAging('all');
            } else {
              onSelectAging('1_30');
            }
          }}
          title="Toca para filtrar cartera vencida en mora"
        >
          <div className="card-top">
            <span className="card-tag tag-red">
              <AlertTriangle size={14} /> Total Cartera Vencida
            </span>
            <span className="card-pct-pill red">{formatPercent(porcentajeVencido)}</span>
          </div>
          <div className="card-amount red">{formatCurrency(totalVencido)}</div>
          <div className="card-footer-info">
            <span>Pendiente de recaudo posterior a fecha de pago</span>
          </div>
        </div>

        {/* Tarjeta 4: Semáforo de Riesgo / Tacómetro Central (Estilo Power BI Imagen 1) */}
        <div
          className={`global-card risk-gauge-card ${selectedAging === 'CRITICO_30' ? 'active-ring' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelectAging(selectedAging === 'CRITICO_30' ? 'all' : 'CRITICO_30')}
          title="Toca para filtrar facturas con mora crítica (>30 días)"
        >
          <div className="card-top">
            <span className="card-tag tag-purple">
              <Activity size={14} /> Índice de Mora
            </span>
            <span
              className={`card-pct-pill ${
                porcentajeVencido > 40 ? 'red' : porcentajeVencido > 20 ? 'orange' : 'green'
              }`}
            >
              {porcentajeVencido > 40
                ? 'Riesgo Crítico'
                : porcentajeVencido > 20
                ? 'Mora Moderada'
                : 'Saludable'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
            <SemicircleGauge
              percentage={porcentajeVencido}
              color={
                porcentajeVencido > 40
                  ? '#ef4444'
                  : porcentajeVencido > 20
                  ? '#ff9f0a'
                  : '#16a34a'
              }
              size={126}
              strokeWidth={10.5}
              valueText={`${porcentajeVencido.toFixed(1)}%`}
            />
          </div>
          <div className="card-footer-info" style={{ justifyContent: 'center', marginTop: 2 }}>
            <span>
              {selectedAging === 'CRITICO_30'
                ? 'Filtrando Crítico >30d (Clic para quitar)'
                : 'Toca para aislar mora >30 días'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Sección: Composición de las Cuentas por Cobrar (Tacómetros por Edades) */}
      <div className="aging-buckets-header">
        <div className="aging-title-wrap">
          <CalendarClock size={16} />
          <h3>Composición de las Cuentas por Cobrar (Por Antigüedad)</h3>
          <span className="aging-hint">
            Haz clic en cualquier velocímetro para filtrar todo el tablero en tiempo real
          </span>
        </div>
        {selectedAging !== 'all' && (
          <button
            type="button"
            className="clear-bucket-btn"
            onClick={() => onSelectAging('all')}
          >
            Quitar filtro ({selectedAging === 'CRITICO_30' ? 'Crítico >30d' : selectedAging}) ✕
          </button>
        )}
      </div>

      <div className="aging-grid">
        {agingItems.map((item) => {
          const isSelected = selectedAging === item.key;
          return (
            <div
              key={item.key}
              className={`bucket-card ${isSelected ? 'selected' : ''}`}
              style={{ borderTopColor: item.color }}
              onClick={() => onSelectAging(isSelected ? 'all' : item.key)}
              role="button"
              tabIndex={0}
              title={`Toca para filtrar facturas de ${item.label} (${formatCurrency(item.totalValor)})`}
            >
              <div className="bucket-header">
                <span className="bucket-short-name" style={{ color: item.color }}>
                  {item.shortLabel}
                </span>
                <span className="bucket-count">{formatNumber(item.count)} fact.</span>
              </div>

              {/* Tacómetro Semicircular Dinámico */}
              <SemicircleGauge
                percentage={item.percentage}
                color={item.color}
                size={108}
                strokeWidth={9}
                valueText={`${item.percentage.toFixed(1)}%`}
              />

              <div className="bucket-value" style={{ color: item.color, textAlign: 'center', marginTop: 6 }} title={formatCurrency(item.totalValor)}>
                {formatCompactCurrency(item.totalValor)}
              </div>

              <div className="bucket-name" style={{ textAlign: 'center', fontSize: 10.5, color: '#6e6e73' }}>
                {formatCurrency(item.totalValor)}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 750,
                  color: item.color,
                  marginTop: 6,
                  padding: '2px 0',
                  minHeight: 22,
                  background: isSelected ? `${item.color}15` : 'transparent',
                  borderRadius: 6,
                  visibility: isSelected ? 'visible' : 'hidden',
                  transition: 'background 0.2s ease',
                }}
              >
                <Check size={11} /> Activo en tablero
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
