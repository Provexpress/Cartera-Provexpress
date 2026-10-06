import { CalendarClock, AlertTriangle, ShieldCheck, Layers, ArrowUpRight } from 'lucide-react';
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
  selectedAging: AgeBucketKey | 'all';
  onSelectAging: (key: AgeBucketKey | 'all') => void;
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
      {/* 1. Header con Totales Globales */}
      <div className="aging-global-row">
        <div
          className={`global-card main-balance ${selectedAging === 'all' ? 'active-ring' : ''}`}
          onClick={() => onSelectAging('all')}
          role="button"
          tabIndex={0}
        >
          <div className="card-top">
            <span className="card-tag tag-blue">Total Cartera Hoy</span>
            <span className="card-docs-pill">{formatNumber(totalDocumentos)} docs</span>
          </div>
          <div className="card-amount">{formatCurrency(totalSaldo)}</div>
          <div className="card-footer-info">
            <span>{formatNumber(clientesUnicos)} clientes con saldo pendiente</span>
            {selectedAging === 'all' && <span className="view-all-pill">Viendo todo</span>}
          </div>
        </div>

        <div
          className={`global-card current-balance ${selectedAging === 'CORRIENTE' ? 'active-ring' : ''}`}
          onClick={() => onSelectAging(selectedAging === 'CORRIENTE' ? 'all' : 'CORRIENTE')}
          role="button"
          tabIndex={0}
        >
          <div className="card-top">
            <span className="card-tag tag-green">
              <ShieldCheck size={14} /> Corriente (No Vencido)
            </span>
            <span className="card-pct-pill green">
              {formatPercent(totalSaldo > 0 ? (totalCorriente / totalSaldo) * 100 : 0)}
            </span>
          </div>
          <div className="card-amount green">{formatCurrency(totalCorriente)}</div>
          <div className="card-footer-info">
            <span>Cartera sana al día (0 días de vencimiento)</span>
          </div>
        </div>

        <div
          className="global-card overdue-balance"
          role="button"
          tabIndex={0}
          onClick={() => {
            // Si ya tiene un filtro vencido, limpia a 'all', sino selecciona el primer bucket de vencido
            if (selectedAging !== 'all' && selectedAging !== 'CORRIENTE') {
              onSelectAging('all');
            } else {
              onSelectAging('1_30');
            }
          }}
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
      </div>

      {/* 2. Fila de Tarjetas por Edades de Vencimiento (Aging Buckets) */}
      <div className="aging-buckets-header">
        <div className="aging-title-wrap">
          <CalendarClock size={16} />
          <h3>Desglose por Edades de Vencimiento</h3>
          <span className="aging-hint">Haz clic en cualquier tarjeta para filtrar la vista</span>
        </div>
        {selectedAging !== 'all' && (
          <button
            type="button"
            className="clear-bucket-btn"
            onClick={() => onSelectAging('all')}
          >
            Quitar filtro de edad
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
            >
              <div className="bucket-header">
                <span className="bucket-short-name" style={{ color: item.color }}>
                  {item.shortLabel}
                </span>
                <span className="bucket-count">{formatNumber(item.count)} docs</span>
              </div>

              <div className="bucket-name" title={item.label}>
                {item.label}
              </div>

              <div className="bucket-value" style={{ color: item.color }}>
                {formatCurrency(item.totalValor)}
              </div>

              <div className="bucket-progress-wrap">
                <div className="bucket-progress-bar">
                  <div
                    className="bucket-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <span className="bucket-pct">{formatPercent(item.percentage)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
