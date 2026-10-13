import React, { useState, useMemo } from 'react';
import {
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  ChevronRight,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  Building2,
} from 'lucide-react';
import type { CarteraRecord, ReciboCajaRecord } from '../types';
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '../lib/carteraApi';

interface ActividadDelDiaWidgetProps {
  records: CarteraRecord[];
  recibos: ReciboCajaRecord[];
  fechaCorte: string;
  fechaBase?: string;
  onNavigateToGestion: () => void;
  onNavigateToRecibos?: () => void;
  onSelectRecord?: (record: CarteraRecord) => void;
}

export function ActividadDelDiaWidget({
  records,
  recibos,
  fechaCorte,
  fechaBase = '2026-10-06',
  onNavigateToGestion,
  onNavigateToRecibos,
  onSelectRecord,
}: ActividadDelDiaWidgetProps) {
  const [activeTab, setActiveTab] = useState<'recibos' | 'facturas'>('recibos');

  // Recaudos de caja registrados en el período activo
  const totalRecaudos = useMemo(
    () => recibos.reduce((sum, r) => sum + r.Valor_Pagado, 0),
    [recibos]
  );

  // Nuevas facturas emitidas desde la fecha base
  const facturasNuevas = useMemo(() => {
    return records.filter((r) => {
      const emision = r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '';
      return emision > fechaBase;
    });
  }, [records, fechaBase]);

  const totalFacturadoNuevas = useMemo(
    () => facturasNuevas.reduce((sum, r) => sum + r.Valor_Saldo, 0),
    [facturasNuevas]
  );

  // Impacto neto
  const balanceNeto = totalRecaudos - totalFacturadoNuevas;
  const isNetPositive = balanceNeto >= 0;

  // Top 5 recibos más recientes o de mayor valor
  const topRecibos = useMemo(() => {
    return [...recibos]
      .sort((a, b) => b.Valor_Pagado - a.Valor_Pagado)
      .slice(0, 5);
  }, [recibos]);

  // Top 5 nuevas facturas
  const topNuevas = useMemo(() => {
    return [...facturasNuevas]
      .sort((a, b) => b.Valor_Saldo - a.Valor_Saldo)
      .slice(0, 5);
  }, [facturasNuevas]);

  return (
    <section
      className="actividad-dia-widget"
      style={{
        background: '#FFFFFF',
        borderRadius: 20,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        padding: '24px 28px',
        marginBottom: 24,
      }}
      aria-label="Widget de actividad del día y movimientos"
    >
      {/* ─── ENCABEZADO DEL WIDGET ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Zap size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#111827' }}>
                Actividad y Movimientos Operativos
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                En Vivo ERP
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B7280' }}>
              Seguimiento a facturas nuevas generadas y recibos de caja aplicados (Corte al {fechaCorte})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToGestion}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            backgroundColor: '#F3F4F6',
            color: '#1F2937',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 650,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#E5E7EB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
          }}
          title="Ir a la pantalla de Gestión Día a Día con el cronograma y desmonte completo"
        >
          <span>Ir a Gestión Día a Día</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ─── 3 TARJETAS KPI RESUMEN DE ACTIVIDAD ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* KPI 1: RECIBOS DE CAJA HECHOS */}
        <div
          onClick={onNavigateToRecibos || onNavigateToGestion}
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)',
            border: '1.5px solid #BBF7D0',
            borderRadius: 16,
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.06)',
          }}
          title="Toca para ver el detalle de recibos de caja"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🟢 Recibos de Caja Hechos
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#DCFCE7',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#15803D', marginBottom: 4 }}>
            {formatCurrency(totalRecaudos)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 650, color: '#166534' }}>
            {formatNumber(recibos.length)} recibos aplicados
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
            Dinero recaudado y abonado a las facturas del período
          </div>
        </div>

        {/* KPI 2: FACTURAS NUEVAS EMITIDAS */}
        <div
          onClick={onNavigateToGestion}
          style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)',
            border: '1.5px solid #BFDBFE',
            borderRadius: 16,
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.06)',
          }}
          title="Toca para ver las nuevas facturas emitidas"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🔵 Nuevas Facturas Emitidas
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#DBEAFE',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1D4ED8', marginBottom: 4 }}>
            {formatCurrency(totalFacturadoNuevas)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 650, color: '#1E40AF' }}>
            {formatNumber(facturasNuevas.length)} facturas nuevas
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
            Emitidas posterior al corte base ({fechaBase})
          </div>
        </div>

        {/* KPI 3: IMPACTO NETO EN CARTERA */}
        <div
          style={{
            background: isNetPositive
              ? 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 100%)'
              : 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 100%)',
            border: `1.5px solid ${isNetPositive ? '#A7F3D0' : '#FECACA'}`,
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: isNetPositive ? '#065F46' : '#991B1B',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {isNetPositive ? '▼ Desmonte Neto Favorable' : '▲ Expansión de Cartera'}
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isNetPositive ? '#D1FAE5' : '#FEE2E2',
                color: isNetPositive ? '#059669' : '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isNetPositive ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: isNetPositive ? '#047857' : '#B91C1C',
              marginBottom: 4,
            }}
          >
            {isNetPositive ? '-' : '+'}{formatCurrency(Math.abs(balanceNeto))}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 650,
              color: isNetPositive ? '#065F46' : '#991B1B',
            }}
          >
            {isNetPositive ? 'Recaudos superan nueva facturación' : 'Nueva facturación supera recaudos'}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
            Efecto neto en el balance de cartera del período
          </div>
        </div>
      </div>

      {/* ─── SUBSECCIÓN: MINI TABS DE ACTIVIDAD RECIENTE ─── */}
      <div
        style={{
          borderTop: '1px solid #F3F4F6',
          paddingTop: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setActiveTab('recibos')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'recibos' ? '#16A34A' : '#F3F4F6',
                color: activeTab === 'recibos' ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.15s ease',
              }}
            >
              Últimos Recaudos ({recibos.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('facturas')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'facturas' ? '#2563EB' : '#F3F4F6',
                color: activeTab === 'facturas' ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.15s ease',
              }}
            >
              Nuevas Facturas ({facturasNuevas.length})
            </button>
          </div>

          <span style={{ fontSize: 12, color: '#6B7280' }}>
            {activeTab === 'recibos'
              ? 'Mostrando mayores pagos registrados'
              : 'Mostrando mayores facturas emitidas'}
          </span>
        </div>

        {/* LISTA RESUMEN DE LA PESTAÑA ACTIVA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeTab === 'recibos' ? (
            topRecibos.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                No hay recibos de caja registrados para los filtros seleccionados
              </div>
            ) : (
              topRecibos.map((rc, idx) => (
                <div
                  key={rc.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                      }}
                    >
                      RC-{rc.Numero_ReciboCaja}
                    </span>
                    <div>
                      <strong style={{ color: '#111827', display: 'block' }}>{rc.Empresa}</strong>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        Factura: {rc.Prefijo_FacturaVenta} {rc.Numero_FacturaVenta} · {rc.Nombre_Empleado}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#15803D', fontSize: 14 }}>
                      {formatCurrency(rc.Valor_Pagado)}
                    </strong>
                    <span style={{ display: 'block', fontSize: 11, color: '#9CA3AF' }}>
                      {rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : ''}
                    </span>
                  </div>
                </div>
              ))
            )
          ) : (
            topNuevas.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                No hay nuevas facturas emitidas desde la fecha base
              </div>
            ) : (
              topNuevas.map((inv, idx) => (
                <div
                  key={inv.id || idx}
                  onClick={() => onSelectRecord?.(inv)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: 10,
                    fontSize: 13,
                    cursor: onSelectRecord ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        backgroundColor: '#DBEAFE',
                        color: '#1D4ED8',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                      }}
                    >
                      {inv.Prefijo || 'FVE'} {inv.Numero}
                    </span>
                    <div>
                      <strong style={{ color: '#111827', display: 'block' }}>{inv.Empresa}</strong>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        {inv.Nombre_Empleado} · Emisión: {inv.Fecha_Emision ? inv.Fecha_Emision.split('T')[0] : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#1D4ED8', fontSize: 14 }}>
                      {formatCurrency(inv.Valor_Saldo)}
                    </strong>
                    <span style={{ display: 'block', fontSize: 11, color: '#9CA3AF' }}>
                      Plazo: {inv.Plazo_Pago}d
                    </span>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </section>
  );
}
