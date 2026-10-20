import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock,
  Info,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { formatNumber, getAvailableMonths, type MonthOption } from '../lib/carteraApi';

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
  const [todayDropdownOpen, setTodayDropdownOpen] = useState(false);
  const todayRef = useRef<HTMLDivElement>(null);

  // Lista de meses disponibles para selección directa
  const monthOptions = useMemo<MonthOption[]>(() => getAvailableMonths(16), []);

  // Detectar si las fechas actuales corresponden exactamente a un mes específico
  const currentSelectedMonthKey = useMemo(() => {
    if (!fechaInicial || !fechaFinal) return '';
    const mInit = fechaInicial.slice(0, 7);
    const mFinal = fechaFinal.slice(0, 7);
    if (mInit === mFinal && fechaInicial.endsWith('-01')) {
      const match = monthOptions.find((m) => m.key === mInit);
      if (match && match.endDate === fechaFinal) {
        return mInit;
      }
      // O si es el mes en curso y fechaFinal es hoy
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (mInit === currentKey) {
        return currentKey;
      }
    }
    return '';
  }, [fechaInicial, fechaFinal, monthOptions]);

  // Cerrar dropdown de Hoy al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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

  // Manejo de selección de mes desde el dropdown
  const handleMonthSelect = (monthKey: string) => {
    if (!monthKey) return;
    const option = monthOptions.find((m) => m.key === monthKey);
    if (option) {
      onChangeFechaInicial(option.startDate);
      onChangeFechaFinal(option.endDate);
      onSelectPreset('custom');
    }
  };

  // Texto descriptivo del filtro activo
  const getFilterDescription = () => {
    if (datePreset === 'all') {
      return `Toda la Cartera Activa (${formatNumber(filteredCount)} facturas vivas sin límite de fechas)`;
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

    // Si coincide con un mes seleccionado
    if (currentSelectedMonthKey) {
      const monthObj = monthOptions.find((m) => m.key === currentSelectedMonthKey);
      const name = monthObj ? monthObj.label : currentSelectedMonthKey;
      return `Mes de ${name} · ${formatPrettyDate(fechaInicial)} al ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
    }

    return `Rango Personalizado · Del ${formatPrettyDate(fechaInicial)} al ${formatPrettyDate(fechaFinal)} (${formatNumber(filteredCount)} facturas)`;
  };

  return (
    <section
      className="date-control-bar"
      aria-label="Filtro de período y calendario de cartera"
      style={{
        position: 'relative',
        zIndex: 50,
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
      {/* FILA 1: PRESETS PRINCIPALES, SELECTOR DE MES Y RANGO DIRECTO */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* LADO IZQUIERDO: PRESETS ESENCIALES (TODA LA CARTERA, HOY Y SELECTOR DE MES) */}
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
            <span>Filtros:</span>
          </span>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 1. TODA LA CARTERA */}
            <button
              type="button"
              className={`preset-chip ${datePreset === 'all' ? 'active' : ''}`}
              onClick={() => onSelectPreset('all')}
              title="Toda la cartera viva sin restricción de fechas"
            >
              Toda la Cartera ({totalRecordsCount})
            </button>

            {/* 2. BOTÓN "HOY" CON MENÚ ORIENTADO */}
            <div style={{ position: 'relative', zIndex: 60 }} ref={todayRef}>
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
                  transition: 'all 0.15s ease',
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
                  <ChevronDown
                    size={13}
                    style={{
                      transform: todayDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>
              </div>

              {/* DROPDOWN DE OPCIONES ORIENTADAS PARA HOY */}
              {todayDropdownOpen && (
                <div
                  className="today-options-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 100,
                    backgroundColor: '#ffffff',
                    borderRadius: 14,
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.22), 0 6px 16px -2px rgba(15, 23, 42, 0.1)',
                    padding: '8px',
                    minWidth: 295,
                    maxWidth: 'calc(100vw - 32px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      padding: '6px 10px 8px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid #f1f5f9',
                      marginBottom: 2,
                    }}
                  >
                    Opciones orientadas al día de Hoy
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectPreset('today');
                      setTodayDropdownOpen(false);
                    }}
                    className={`today-dropdown-item ${datePreset === 'today' ? 'active-today' : ''}`}
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
                    className={`today-dropdown-item ${datePreset === 'today_vence' ? 'active-today_vence' : ''}`}
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
                    className={`today-dropdown-item ${datePreset === 'today_emision' ? 'active-today_emision' : ''}`}
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

            {/* 3. SELECTOR DE MES (DROPDOWN DIRECTO DE MESES) */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <CalendarDays
                size={13}
                style={{
                  position: 'absolute',
                  left: 10,
                  pointerEvents: 'none',
                  color: currentSelectedMonthKey ? '#0284c7' : '#64748b',
                }}
              />
              <select
                value={currentSelectedMonthKey}
                onChange={(e) => handleMonthSelect(e.target.value)}
                style={{
                  padding: '6px 28px 6px 28px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 20,
                  border: currentSelectedMonthKey ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: currentSelectedMonthKey ? '#f0f9ff' : '#ffffff',
                  color: currentSelectedMonthKey ? '#0284c7' : '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  boxShadow: currentSelectedMonthKey ? '0 1px 4px rgba(2, 132, 199, 0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Seleccionar un mes específico para consultar"
              >
                <option value="">🗓️ Escoger Mes...</option>
                {monthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                style={{
                  position: 'absolute',
                  right: 9,
                  pointerEvents: 'none',
                  color: currentSelectedMonthKey ? '#0284c7' : '#64748b',
                }}
              />
            </div>
          </div>
        </div>

        {/* LADO DERECHO: RANGO DE FECHAS (DE TAL A TAL) + CRITERIO + BOTÓN ACTUALIZAR ERP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* 4. RANGO DE FECHAS DIRECTO (DE TAL A TAL) */}
          <div
            className="date-range-picker-group"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              backgroundColor: datePreset === 'custom' && !currentSelectedMonthKey ? '#eff6ff' : '#f8fafc',
              border: datePreset === 'custom' && !currentSelectedMonthKey ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
              padding: '3px 8px',
              borderRadius: 10,
              transition: 'all 0.15s ease',
            }}
          >
            <CalendarRange size={13} color="#0284c7" />
            <span style={{ fontSize: 11, fontWeight: 750, color: '#475569', textTransform: 'uppercase' }}>
              Rango:
            </span>
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Desde</span>
            <input
              type="date"
              className="date-input-field"
              value={fechaInicial}
              onChange={(e) => {
                onChangeFechaInicial(e.target.value);
                onSelectPreset('custom');
              }}
              style={{
                padding: '4px 7px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
              }}
              title="Fecha Inicial (Desde)"
            />
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Hasta</span>
            <input
              type="date"
              className="date-input-field"
              value={fechaFinal}
              onChange={(e) => {
                onChangeFechaFinal(e.target.value);
                onSelectPreset('custom');
              }}
              style={{
                padding: '4px 7px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
              }}
              title="Fecha Final (Hasta)"
            />
          </div>

          {/* 5. CRITERIO SEGMENTADO (VENCIMIENTO VS EMISIÓN) */}
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

          {/* 6. BOTÓN ACTUALIZAR ERP */}
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
