import { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock,
  Filter,
  Info,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { formatNumber } from '../lib/carteraApi';

export type DatePreset =
  | 'all'
  | 'today'
  | 'today_vence'
  | 'today_emision'
  | 'current_month'
  | 'last_month'
  | 'custom';

export type DateCriterion = 'vencimiento' | 'emision';

interface Props {
  datePreset: DatePreset;
  dateCriterion: DateCriterion;
  fechaInicial: string;
  fechaFinal: string;
  totalRecordsCount: number;
  filteredCount: number;
  refreshing: boolean;
  onSelectPreset: (preset: DatePreset) => void;
  onSelectCriterion: (criterion: DateCriterion) => void;
  onChangeFechaInicial: (date: string) => void;
  onChangeFechaFinal: (date: string) => void;
  onRefreshERP: () => void;
}

export function DateControlBar({
  datePreset,
  dateCriterion,
  fechaInicial,
  fechaFinal,
  totalRecordsCount,
  filteredCount,
  refreshing,
  onSelectPreset,
  onSelectCriterion,
  onChangeFechaInicial,
  onChangeFechaFinal,
  onRefreshERP,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [todayDropdownOpen, setTodayDropdownOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  // Cerrar popovers al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
      if (todayRef.current && !todayRef.current.contains(event.target as Node)) {
        setTodayDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Formateo legible de fecha (ej: 15 Oct 2026)
  const formatPrettyDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getMonthName = (offset = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString('es-CO', { month: 'long' });
  };

  // Texto descriptivo del filtro activo
  const getFilterDescription = () => {
    if (datePreset === 'all') {
      return `Toda la Cartera Activa (${formatNumber(filteredCount)} facturas vivas)`;
    }
    if (datePreset === 'today') {
      return `Corte al Día de Hoy · Evaluando mora a la fecha actual (${formatNumber(filteredCount)} facturas)`;
    }
    if (datePreset === 'today_vence') {
      return `Facturas con vencimiento exactamente hoy ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
    }
    if (datePreset === 'today_emision') {
      return `Facturas emitidas hoy ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
    }
    if (datePreset === 'current_month') {
      return `Mes en Curso (${getMonthName(0)}) · ${formatPrettyDate(fechaInicial)} al ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
    }
    if (datePreset === 'last_month') {
      return `Mes Anterior (${getMonthName(-1)}) · ${formatPrettyDate(fechaInicial)} al ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
    }
    return `Rango Personalizado · Del ${formatPrettyDate(fechaInicial)} al ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
  };

  return (
    <section
      className="date-control-bar"
      aria-label="Filtro de período y calendario de cartera"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 18px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        marginBottom: 16,
      }}
    >
      {/* FILA 1: PRESETS Y CALENDARIO */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* LADO IZQUIERDO: PRESETS DE PERÍODO CON HOY MEJORADO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Calendar size={14} color="#0284c7" />
            <span>Período:</span>
          </span>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Toda la Cartera */}
            <button
              type="button"
              className={`preset-chip ${datePreset === 'all' ? 'active' : ''}`}
              onClick={() => onSelectPreset('all')}
              title="Toda la cartera viva sin restricción de fechas"
            >
              Toda la Cartera ({totalRecordsCount})
            </button>

            {/* BOTÓN "HOY" CON DROPDOWN DE ORIENTACIÓN */}
            <div style={{ position: 'relative' }} ref={todayRef}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 20,
                  backgroundColor:
                    datePreset === 'today' || datePreset === 'today_vence' || datePreset === 'today_emision'
                      ? '#0284c7'
                      : '#f1f5f9',
                  color:
                    datePreset === 'today' || datePreset === 'today_vence' || datePreset === 'today_emision'
                      ? '#ffffff'
                      : '#334155',
                  padding: '2px',
                  boxShadow:
                    datePreset === 'today' || datePreset === 'today_vence' || datePreset === 'today_emision'
                      ? '0 2px 8px rgba(2, 132, 199, 0.35)'
                      : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectPreset('today')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Corte al día de hoy: toda la cartera viva evaluada a la fecha de hoy"
                >
                  <Zap size={12} />
                  <span>
                    {datePreset === 'today_vence'
                      ? 'Vencen Hoy'
                      : datePreset === 'today_emision'
                      ? 'Emitidas Hoy'
                      : 'Hoy (Corte)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTodayDropdownOpen(!todayDropdownOpen)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'inherit',
                    padding: '5px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Opciones orientadas para Hoy"
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* DROPDOWN DE OPCIONES ORIENTADAS PARA HOY */}
              {todayDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    zIndex: 1000,
                    backgroundColor: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)',
                    padding: '6px',
                    minWidth: 260,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Opciones orientadas al día de Hoy
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectPreset('today');
                      setTodayDropdownOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: datePreset === 'today' ? '#f0f9ff' : 'transparent',
                      color: datePreset === 'today' ? '#0284c7' : '#1e293b',
                      fontSize: 12.5,
                      fontWeight: datePreset === 'today' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={13} color="#0284c7" />
                      <strong>Corte de Cartera a Hoy (Recomendado)</strong>
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', paddingLeft: 19 }}>
                      Muestra toda la cartera activa calculando mora a hoy.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectPreset('today_vence');
                      setTodayDropdownOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: datePreset === 'today_vence' ? '#fef2f2' : 'transparent',
                      color: datePreset === 'today_vence' ? '#dc2626' : '#1e293b',
                      fontSize: 12.5,
                      fontWeight: datePreset === 'today_vence' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} color="#dc2626" />
                      <strong>Vencimientos de Hoy</strong>
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', paddingLeft: 19 }}>
                      Facturas cuyo plazo vence exactamente en la fecha de hoy.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectPreset('today_emision');
                      setTodayDropdownOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: datePreset === 'today_emision' ? '#f0fdf4' : 'transparent',
                      color: datePreset === 'today_emision' ? '#16a34a' : '#1e293b',
                      fontSize: 12.5,
                      fontWeight: datePreset === 'today_emision' ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} color="#16a34a" />
                      <strong>Facturadas Hoy</strong>
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', paddingLeft: 19 }}>
                      Nuevas facturas emitidas en el día de hoy.
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Mes Actual */}
            <button
              type="button"
              className={`preset-chip ${datePreset === 'current_month' ? 'active' : ''}`}
              onClick={() => onSelectPreset('current_month')}
              title={`Facturas del mes en curso (${getMonthName(0)})`}
            >
              Mes Actual
            </button>

            {/* Mes Anterior */}
            <button
              type="button"
              className={`preset-chip ${datePreset === 'last_month' ? 'active' : ''}`}
              onClick={() => onSelectPreset('last_month')}
              title={`Facturas del mes anterior completo (${getMonthName(-1)})`}
            >
              Mes Anterior
            </button>

            {/* BOTÓN CALENDARIO INTERACTIVO */}
            <div style={{ position: 'relative' }} ref={popoverRef}>
              <button
                type="button"
                className={`preset-chip ${datePreset === 'custom' || calendarOpen ? 'active' : ''}`}
                onClick={() => setCalendarOpen(!calendarOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                }}
                title="Abrir selector de fechas y calendario"
              >
                <CalendarRange size={13} />
                <span>
                  {datePreset === 'custom'
                    ? `${formatPrettyDate(fechaInicial)} — ${formatPrettyDate(fechaFinal)}`
                    : 'Calendario'}
                </span>
                <ChevronDown size={12} />
              </button>

              {/* POPOVER DEL CALENDARIO */}
              {calendarOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 1100,
                    backgroundColor: '#ffffff',
                    borderRadius: 16,
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 16px 36px -8px rgba(0,0,0,0.18)',
                    padding: '18px 20px',
                    width: 380,
                    maxWidth: '92vw',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CalendarDays size={18} color="#0284c7" />
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>Selector de Fechas y Rango</strong>
                    </div>
                    <button
                      type="button"
                      className="icon-btn-minimal"
                      onClick={() => setCalendarOpen(false)}
                      style={{ width: 26, height: 26 }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Accesos Rápidos dentro del Calendario */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Atajos rápidos:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        className="button button-xs button-secondary"
                        onClick={() => {
                          onSelectPreset('today');
                          setCalendarOpen(false);
                        }}
                      >
                        ⚡ Hoy (Corte Cartera)
                      </button>
                      <button
                        type="button"
                        className="button button-xs button-secondary"
                        onClick={() => {
                          onSelectPreset('current_month');
                          setCalendarOpen(false);
                        }}
                      >
                        📆 Mes en Curso
                      </button>
                      <button
                        type="button"
                        className="button button-xs button-secondary"
                        onClick={() => {
                          onSelectPreset('last_month');
                          setCalendarOpen(false);
                        }}
                      >
                        🗓️ Mes Anterior
                      </button>
                      <button
                        type="button"
                        className="button button-xs button-secondary"
                        onClick={() => {
                          onSelectPreset('all');
                          setCalendarOpen(false);
                        }}
                      >
                        📊 Toda la Cartera
                      </button>
                    </div>
                  </div>

                  {/* Inputs de Rango */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                        Fecha Inicial (Desde):
                      </label>
                      <input
                        type="date"
                        className="date-input-field"
                        value={fechaInicial}
                        onChange={(e) => {
                          onChangeFechaInicial(e.target.value);
                          onSelectPreset('custom');
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                        Fecha Final (Hasta):
                      </label>
                      <input
                        type="date"
                        className="date-input-field"
                        value={fechaFinal}
                        onChange={(e) => {
                          onChangeFechaFinal(e.target.value);
                          onSelectPreset('custom');
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* Criterio dentro del popover */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                      Evaluar fechas por:
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => onSelectCriterion('vencimiento')}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: dateCriterion === 'vencimiento' ? '#0284c7' : '#ffffff',
                          color: dateCriterion === 'vencimiento' ? '#ffffff' : '#475569',
                          boxShadow: dateCriterion === 'vencimiento' ? '0 2px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        Vencimiento
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectCriterion('emision')}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: dateCriterion === 'emision' ? '#0284c7' : '#ffffff',
                          color: dateCriterion === 'emision' ? '#ffffff' : '#475569',
                          boxShadow: dateCriterion === 'emision' ? '0 2px 4px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        Emisión
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button button-sm button-primary"
                    onClick={() => setCalendarOpen(false)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Listo · Aplicar Rango
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LADO DERECHO: SELECTOR DE CRITERIO + INPUTS RÁPIDOS + BOTÓN ACTUALIZAR ERP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Criterio Segmentado */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              className={`preset-chip ${dateCriterion === 'vencimiento' ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, border: 'none' }}
              onClick={() => onSelectCriterion('vencimiento')}
              title="Filtrar por Fecha de Vencimiento (Recomendado para análisis de mora y edades)"
            >
              Vencimiento
            </button>
            <button
              type="button"
              className={`preset-chip ${dateCriterion === 'emision' ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, border: 'none' }}
              onClick={() => onSelectCriterion('emision')}
              title="Filtrar por Fecha de Emisión (Para ver facturación nueva)"
            >
              Emisión
            </button>
          </div>

          {/* Fechas visibles directas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="date-input-field"
              value={fechaInicial}
              onChange={(e) => {
                onChangeFechaInicial(e.target.value);
                onSelectPreset('custom');
              }}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
              title="Fecha Inicial"
            />
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>a</span>
            <input
              type="date"
              className="date-input-field"
              value={fechaFinal}
              onChange={(e) => {
                onChangeFechaFinal(e.target.value);
                onSelectPreset('custom');
              }}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
              title="Fecha Final"
            />
          </div>

          {/* Actualizar ERP */}
          <button
            type="button"
            className="button button-sm button-secondary"
            onClick={onRefreshERP}
            disabled={refreshing}
            title="Consultar ERP en tiempo real para traer últimas facturas y recaudos"
            style={{ fontWeight: 600 }}
          >
            <RefreshCw size={13} className={refreshing ? 'spinner' : ''} />
            <span>{refreshing ? 'Sincronizando…' : 'Actualizar ERP'}</span>
          </button>
        </div>
      </div>

      {/* FILA 2: LÍNEA INFORMATIVA Y DE ORIENTACIÓN OPERATIVA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid #f1f5f9',
          fontSize: 12,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} color="#0284c7" />
          <span style={{ fontWeight: 600, color: '#334155' }}>
            {getFilterDescription()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            Criterio activo: <strong>{dateCriterion === 'vencimiento' ? 'Fecha de Vencimiento' : 'Fecha de Emisión'}</strong>
          </span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span>
            Corte del Sistema: <strong>{formatPrettyDate(fechaFinal)}</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
