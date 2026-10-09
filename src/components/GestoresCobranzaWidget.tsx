import { useState, useMemo } from 'react';
import {
  Trophy,
  Users,
  Award,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  DollarSign,
  Receipt,
  FileCheck,
  TrendingUp,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { ReciboCajaRecord } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';
import {
  calculateGestoresComparison,
  type GestorCobranzaId,
  type AsesorCobranzaStat,
} from '../lib/gestoresCobranza';

interface Props {
  recibos: ReciboCajaRecord[];
  selectedGestor: 'Todos' | GestorCobranzaId;
  onSelectGestor: (gestor: 'Todos' | GestorCobranzaId) => void;
  selectedAsesor: string | null;
  onSelectAsesor: (asesor: string | null) => void;
}

type TabDetalle = 'ambos' | 'wilmer' | 'carolina';

export function GestoresCobranzaWidget({
  recibos,
  selectedGestor,
  onSelectGestor,
  selectedAsesor,
  onSelectAsesor,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('ambos');

  // Cálculo integral de métricas según los recibos activos en el filtro de fecha actual
  const stats = useMemo(() => calculateGestoresComparison(recibos), [recibos]);

  const { wilmer, carolina, lider, diferenciaMonto, diferenciaPorcentaje, diferenciaRecibos } = stats;

  const handleGestorClick = (id: GestorCobranzaId) => {
    if (selectedGestor === id) {
      onSelectGestor('Todos');
    } else {
      onSelectGestor(id);
    }
  };

  const handleAsesorClick = (nombreAsesor: string) => {
    if (selectedAsesor === nombreAsesor) {
      onSelectAsesor(null);
    } else {
      onSelectAsesor(nombreAsesor);
      // Desplazarse suavemente a la tabla de recibos
      const tableElem = document.getElementById('tabla-recibos-caja');
      if (tableElem) {
        tableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        border: '1.5px solid #E2E8F0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* ─── CABECERA DEL APARATO DE MEDICIÓN ─── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
            }}
          >
            <Trophy size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>
                Gestión y Medición de Cobranza de Cartera
              </h3>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#F8FAFC',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 12,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                }}
              >
                Oficial 2026
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#94A3B8' }}>
              Monitoreo comparativo de efectividad de cobranza: Wilmer Gualteros (24 asesores) vs. Carolina Sánchez (19 asesores)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(selectedGestor !== 'Todos' || selectedAsesor) && (
            <button
              type="button"
              onClick={() => {
                onSelectGestor('Todos');
                onSelectAsesor(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #EF4444',
                color: '#FCA5A5',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <X size={13} />
              Quitar Filtro Activo
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: showDetails ? '#334155' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={14} />
            {showDetails ? 'Ocultar Detalle Asesores' : 'Ver Detalle por Asesor'}
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ─── BANNER DINÁMICO DE LIDERAZGO & DIFERENCIA DE RECAUDO ─── */}
      <div
        style={{
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          padding: '14px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: lider === 'empate' ? '#E2E8F0' : lider === 'carolina' ? '#E0F2FE' : '#FFE4E6',
                color: lider === 'empate' ? '#475569' : lider === 'carolina' ? '#0369A1' : '#9F1239',
                border: `1px solid ${lider === 'empate' ? '#CBD5E1' : lider === 'carolina' ? '#7DD3FC' : '#FDA4AF'}`,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <Award size={14} />
              {lider === 'empate'
                ? 'Empate Técnico en Recaudo'
                : `👑 Líder Actual: ${lider === 'carolina' ? 'Carolina Sánchez' : 'Wilmer Gualteros'}`}
            </span>

            {lider !== 'empate' && (
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                Ventaja de{' '}
                <strong style={{ color: lider === 'carolina' ? '#0284C7' : '#E11D48', fontWeight: 800 }}>
                  +{formatCurrency(diferenciaMonto)}
                </strong>{' '}
                ({formatPercent(diferenciaPorcentaje)} más recaudo vs.{' '}
                {lider === 'carolina' ? 'Wilmer Gualteros' : 'Carolina Sánchez'})
              </span>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span>
              🔴 <strong>Wilmer:</strong> {formatNumber(wilmer.totalRecibos)} recibos ({formatPercent(wilmer.porcentajeGlobal)})
            </span>
            <span>•</span>
            <span>
              🔵 <strong>Carolina:</strong> {formatNumber(carolina.totalRecibos)} recibos ({formatPercent(carolina.porcentajeGlobal)})
            </span>
            {stats.otros.totalRecaudado > 0 && (
              <>
                <span>•</span>
                <span>
                  ⚪ <strong>Otros:</strong> {formatPercent(stats.otros.porcentajeGlobal)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Barra de Confrontación Visual (Head to Head) */}
        <div
          style={{
            width: '100%',
            height: 12,
            backgroundColor: '#E2E8F0',
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
          }}
          title={`Wilmer Gualteros: ${formatPercent(wilmer.porcentajeGlobal)} | Carolina Sánchez: ${formatPercent(carolina.porcentajeGlobal)}`}
        >
          <div
            style={{
              width: `${wilmer.porcentajeGlobal}%`,
              height: '100%',
              backgroundColor: '#E11D48',
              transition: 'width 0.4s ease',
            }}
          />
          <div
            style={{
              width: `${carolina.porcentajeGlobal}%`,
              height: '100%',
              backgroundColor: '#0284C7',
              transition: 'width 0.4s ease',
            }}
          />
          {stats.otros.porcentajeGlobal > 0 && (
            <div
              style={{
                width: `${stats.otros.porcentajeGlobal}%`,
                height: '100%',
                backgroundColor: '#94A3B8',
                transition: 'width 0.4s ease',
              }}
            />
          )}
        </div>
      </div>

      {/* ─── TARJETAS PRINCIPALES: WILMER GUALTEROS vs. CAROLINA SÁNCHEZ ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          padding: 20,
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* TARJETA 1: WILMER GUALTEROS */}
        <div
          style={{
            borderRadius: 14,
            border: selectedGestor === 'wilmer' ? '2.5px solid #E11D48' : '1.5px solid #FFE4E6',
            backgroundColor: selectedGestor === 'wilmer' ? '#FFF1F2' : '#FFFFFF',
            boxShadow: selectedGestor === 'wilmer' ? '0 6px 20px rgba(225, 29, 72, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
            position: 'relative',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span
                  style={{
                    backgroundColor: '#FFE4E6',
                    color: '#9F1239',
                    border: '1px solid #FDA4AF',
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Gestor de Cartera
                </span>
                <h4 style={{ fontSize: 20, fontWeight: 850, margin: '6px 0 2px', color: '#881337' }}>
                  Wilmer Gualteros
                </h4>
                <div style={{ fontSize: 12, color: '#9F1239', fontWeight: 600 }}>
                  24 Asesores Comerciales a cargo
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#E11D48',
                    display: 'block',
                    lineHeight: 1,
                  }}
                >
                  {formatPercent(wilmer.porcentajeGlobal)}
                </span>
                <span style={{ fontSize: 11, color: '#9F1239', fontWeight: 700 }}>de cuota total</span>
              </div>
            </div>

            {/* Cifra estelar de dinero recaudado */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Recaudado Gestionado
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#BE123C', letterSpacing: -0.5 }}>
                {formatCurrency(wilmer.totalRecaudado)}
              </div>
            </div>

            {/* Mini KPIs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                backgroundColor: selectedGestor === 'wilmer' ? '#FFE4E6' : '#FFF5F6',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #FECDD3',
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: '#9F1239', fontWeight: 700 }}>Recibos</div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#881337' }}>
                  {formatNumber(wilmer.totalRecibos)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: '#9F1239', fontWeight: 700 }}>Facturas</div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#881337' }}>
                  {formatNumber(wilmer.totalFacturas)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: '#9F1239', fontWeight: 700 }}>Asesores Activos</div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#881337' }}>
                  {wilmer.asesoresActivosCount} / {wilmer.asesoresTotalCount}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 11.5, color: '#64748B' }}>
              Ticket Promedio: <strong>{formatCurrency(wilmer.promedioRecibo)}</strong> por recibo
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGestorClick('wilmer')}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: selectedGestor === 'wilmer' ? 'none' : '1.5px solid #E11D48',
              backgroundColor: selectedGestor === 'wilmer' ? '#BE123C' : '#FFFFFF',
              color: selectedGestor === 'wilmer' ? '#FFFFFF' : '#BE123C',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: selectedGestor === 'wilmer' ? '0 2px 8px rgba(190, 18, 60, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {selectedGestor === 'wilmer' ? (
              <>
                <CheckCircle2 size={16} />
                Filtrando por Wilmer Gualteros (Clic para ver todos)
              </>
            ) : (
              <>
                <Filter size={14} />
                Filtrar Recibos de Wilmer Gualteros
              </>
            )}
          </button>
        </div>

        {/* TARJETA 2: CAROLINA SÁNCHEZ */}
        <div
          style={{
            borderRadius: 14,
            border: selectedGestor === 'carolina' ? '2.5px solid #0284C7' : '1.5px solid #E0F2FE',
            backgroundColor: selectedGestor === 'carolina' ? '#F0F9FF' : '#FFFFFF',
            boxShadow: selectedGestor === 'carolina' ? '0 6px 20px rgba(2, 132, 199, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
            position: 'relative',
            transition: 'all 0.15s ease',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span
                  style={{
                    backgroundColor: '#E0F2FE',
                    color: '#0369A1',
                    border: '1px solid #7DD3FC',
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Gestora de Cartera
                </span>
                <h4 style={{ fontSize: 20, fontWeight: 850, margin: '6px 0 2px', color: '#075985' }}>
                  Carolina Sánchez
                </h4>
                <div style={{ fontSize: 12, color: '#0284C7', fontWeight: 600 }}>
                  19 Asesores Comerciales a cargo
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#0284C7',
                    display: 'block',
                    lineHeight: 1,
                  }}
                >
                  {formatPercent(carolina.porcentajeGlobal)}
                </span>
                <span style={{ fontSize: 11, color: '#0369A1', fontWeight: 700 }}>de cuota total</span>
              </div>
            </div>

            {/* Cifra estelar de dinero recaudado */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Recaudado Gestionado
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0369A1', letterSpacing: -0.5 }}>
                {formatCurrency(carolina.totalRecaudado)}
              </div>
            </div>

            {/* Mini KPIs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                backgroundColor: selectedGestor === 'carolina' ? '#E0F2FE' : '#F0F9FF',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #BAE6FD',
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: '#0369A1', fontWeight: 700 }}>Recibos</div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#075985' }}>
                  {formatNumber(carolina.totalRecibos)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: '#0369A1', fontWeight: 700 }}>Facturas</div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#075985' }}>
                  {formatNumber(carolina.totalFacturas)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: '#0369A1', fontWeight: 700 }}>Asesores Activos</div>
                <div style={{ fontSize: 16, fontWeight: 850, color: '#075985' }}>
                  {carolina.asesoresActivosCount} / {carolina.asesoresTotalCount}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 11.5, color: '#64748B' }}>
              Ticket Promedio: <strong>{formatCurrency(carolina.promedioRecibo)}</strong> por recibo
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGestorClick('carolina')}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: selectedGestor === 'carolina' ? 'none' : '1.5px solid #0284C7',
              backgroundColor: selectedGestor === 'carolina' ? '#0369A1' : '#FFFFFF',
              color: selectedGestor === 'carolina' ? '#FFFFFF' : '#0369A1',
              fontWeight: 800,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: selectedGestor === 'carolina' ? '0 2px 8px rgba(3, 105, 161, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {selectedGestor === 'carolina' ? (
              <>
                <CheckCircle2 size={16} />
                Filtrando por Carolina Sánchez (Clic para ver todos)
              </>
            ) : (
              <>
                <Filter size={14} />
                Filtrar Recibos de Carolina Sánchez
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── DESGLOSE Y RANKING POR ASESOR COMERCIAL (DESPLEGABLE) ─── */}
      {showDetails && (
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            padding: '20px 24px',
          }}
        >
          {/* Barra de pestañas para ver los equipos */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTabDetalle('ambos')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: tabDetalle === 'ambos' ? '1.5px solid #0F172A' : '1px solid #CBD5E1',
                  backgroundColor: tabDetalle === 'ambos' ? '#0F172A' : '#FFFFFF',
                  color: tabDetalle === 'ambos' ? '#FFFFFF' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Comparativa Ambos Equipos
              </button>

              <button
                type="button"
                onClick={() => setTabDetalle('wilmer')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: tabDetalle === 'wilmer' ? '1.5px solid #E11D48' : '1px solid #CBD5E1',
                  backgroundColor: tabDetalle === 'wilmer' ? '#FFE4E6' : '#FFFFFF',
                  color: tabDetalle === 'wilmer' ? '#9F1239' : '#475569',
                  cursor: 'pointer',
                }}
              >
                🔴 Equipo Wilmer Gualteros (24 Asesores)
              </button>

              <button
                type="button"
                onClick={() => setTabDetalle('carolina')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: tabDetalle === 'carolina' ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
                  backgroundColor: tabDetalle === 'carolina' ? '#E0F2FE' : '#FFFFFF',
                  color: tabDetalle === 'carolina' ? '#0369A1' : '#475569',
                  cursor: 'pointer',
                }}
              >
                🔵 Equipo Carolina Sánchez (19 Asesores)
              </button>
            </div>

            <span style={{ fontSize: 12, color: '#64748B' }}>
              💡 Haz clic sobre cualquier asesor comercial para filtrar sus recibos en la tabla inferior.
            </span>
          </div>

          {/* Grilla con las dos tablas de asesores */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                tabDetalle === 'ambos'
                  ? 'repeat(auto-fit, minmax(420px, 1fr))'
                  : '1fr',
              gap: 16,
            }}
          >
            {/* TABLA WILMER */}
            {(tabDetalle === 'ambos' || tabDetalle === 'wilmer') && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #FECDD3',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#FFF1F2',
                    padding: '12px 16px',
                    borderBottom: '1px solid #FECDD3',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: 13.5, color: '#9F1239' }}>
                    🔴 Equipo Wilmer Gualteros ({wilmer.asesores.length} asesores)
                  </strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#BE123C' }}>
                    Total: {formatCurrency(wilmer.totalRecaudado)}
                  </span>
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>#</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>Asesor Comercial</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>Recaudado</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#64748B' }}>Recibos</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>% Aporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wilmer.asesores.map((a, idx) => {
                        const isSelected = selectedAsesor === a.nombre;
                        return (
                          <tr
                            key={a.nombre}
                            onClick={() => handleAsesorClick(a.nombre)}
                            style={{
                              borderBottom: '1px solid #F8FAFC',
                              backgroundColor: isSelected
                                ? '#FFE4E6'
                                : a.tieneRecaudo
                                ? '#FFFFFF'
                                : '#F8FAFC',
                              cursor: 'pointer',
                              transition: 'background-color 0.1s ease',
                            }}
                            title="Clic para filtrar recibos de este asesor"
                          >
                            <td style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: 600 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: isSelected ? 800 : 650, color: isSelected ? '#9F1239' : '#1E293B' }}>
                                {a.nombre}
                              </div>
                              {!a.tieneRecaudo && (
                                <span style={{ fontSize: 10, color: '#94A3B8' }}>Sin recaudo en período</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: '8px 12px',
                                textAlign: 'right',
                                fontWeight: 750,
                                color: a.tieneRecaudo ? '#BE123C' : '#94A3B8',
                              }}
                            >
                              {formatCurrency(a.totalRecaudado)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>
                              {a.totalRecibos}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#64748B' }}>
                              {formatPercent(a.porcentajeGestor)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TABLA CAROLINA */}
            {(tabDetalle === 'ambos' || tabDetalle === 'carolina') && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #BAE6FD',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#F0F9FF',
                    padding: '12px 16px',
                    borderBottom: '1px solid #BAE6FD',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: 13.5, color: '#0369A1' }}>
                    🔵 Equipo Carolina Sánchez ({carolina.asesores.length} asesores)
                  </strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0284C7' }}>
                    Total: {formatCurrency(carolina.totalRecaudado)}
                  </span>
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>#</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748B' }}>Asesor Comercial</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>Recaudado</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#64748B' }}>Recibos</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748B' }}>% Aporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {carolina.asesores.map((a, idx) => {
                        const isSelected = selectedAsesor === a.nombre;
                        return (
                          <tr
                            key={a.nombre}
                            onClick={() => handleAsesorClick(a.nombre)}
                            style={{
                              borderBottom: '1px solid #F8FAFC',
                              backgroundColor: isSelected
                                ? '#E0F2FE'
                                : a.tieneRecaudo
                                ? '#FFFFFF'
                                : '#F8FAFC',
                              cursor: 'pointer',
                              transition: 'background-color 0.1s ease',
                            }}
                            title="Clic para filtrar recibos de este asesor"
                          >
                            <td style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: 600 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: isSelected ? 800 : 650, color: isSelected ? '#0369A1' : '#1E293B' }}>
                                {a.nombre}
                              </div>
                              {!a.tieneRecaudo && (
                                <span style={{ fontSize: 10, color: '#94A3B8' }}>Sin recaudo en período</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: '8px 12px',
                                textAlign: 'right',
                                fontWeight: 750,
                                color: a.tieneRecaudo ? '#0284C7' : '#94A3B8',
                              }}
                            >
                              {formatCurrency(a.totalRecaudado)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>
                              {a.totalRecibos}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#64748B' }}>
                              {formatPercent(a.porcentajeGestor)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
