import { useState, useMemo } from 'react';
import {
  Percent,
  Search,
  Building2,
  Download,
  Layers,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Calendar,
  Sparkles,
} from 'lucide-react';
import ExcelJSRuntime from 'exceljs';
import type { NotaCreditoRecord } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';
import { LISTA_DIRECTORES } from '../lib/commercialDirectory';

interface Props {
  notas: NotaCreditoRecord[];
}

type DatePreset = 'all' | 'today' | 'current_month' | 'last_month';

export function NotasCreditoView({ notas }: Props) {
  // Filtros interactivos del Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [selectedDirector, setSelectedDirector] = useState<string>('Todos');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const pageSize = 25;

  // 1. Filtrado por período de fecha
  const dateFilteredNotas = useMemo(() => {
    if (datePreset === 'all') return notas;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (datePreset === 'today') {
      return notas.filter((n) => {
        const em = n.Fecha_Emision ? n.Fecha_Emision.split('T')[0] : '';
        return em === todayStr;
      });
    }

    if (datePreset === 'current_month') {
      const startCurrentMonth = `${y}-${m}-01`;
      return notas.filter((n) => {
        const em = n.Fecha_Emision ? n.Fecha_Emision.split('T')[0] : '';
        return em >= startCurrentMonth && em <= todayStr;
      });
    }

    if (datePreset === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      const lmYear = lastMonthDate.getFullYear();
      const lmM = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      const lmLastD = String(lastMonthLastDay.getDate()).padStart(2, '0');
      const startLm = `${lmYear}-${lmM}-01`;
      const endLm = `${lmYear}-${lmM}-${lmLastD}`;

      return notas.filter((n) => {
        const em = n.Fecha_Emision ? n.Fecha_Emision.split('T')[0] : '';
        return em >= startLm && em <= endLm;
      });
    }

    return notas;
  }, [notas, datePreset]);

  // 2. Lista de directores únicos para el select
  const directorsList = useMemo(() => {
    const set = new Set<string>();
    LISTA_DIRECTORES.forEach((d) => set.add(d.nombre));
    return ['Todos', ...Array.from(set).sort()];
  }, []);

  // 3. Filtrado por Director y Buscador
  const filtered = useMemo(() => {
    let list = dateFilteredNotas;

    if (selectedDirector !== 'Todos') {
      list = list.filter((n) => (n.directorNombre || '') === selectedDirector);
    }

    if (!search.trim()) return list;
    const term = search.toLowerCase().trim();

    return list.filter(
      (n) =>
        n.Empresa.toLowerCase().includes(term) ||
        n.Identificacion.includes(term) ||
        String(n.Numero).includes(term) ||
        String(n.Numero_Factura).includes(term) ||
        (n.Prefijo || '').toLowerCase().includes(term) ||
        (n.Nombre_Empleado || '').toLowerCase().includes(term) ||
        (n.directorNombre || '').toLowerCase().includes(term)
    );
  }, [dateFilteredNotas, selectedDirector, search]);

  // 4. Métricas y KPIs globales del dashboard
  const metrics = useMemo(() => {
    const totalNotas = filtered.length;
    const totalValor = filtered.reduce((sum, n) => sum + n.Valor_NotaCredito, 0);

    const facturasSet = new Set<string>();
    filtered.forEach((n) => {
      if (n.Numero_Factura > 0) {
        facturasSet.add(`${n.Prefijo_Factura || 'FVE'}-${n.Numero_Factura}`);
      }
    });

    const clientesSet = new Set<string>();
    filtered.forEach((n) => clientesSet.add(n.Identificacion));

    const promedioPorNota = totalNotas > 0 ? totalValor / totalNotas : 0;

    return {
      totalNotas,
      totalValor,
      facturasAfectadas: facturasSet.size,
      clientesAfectados: clientesSet.size,
      promedioPorNota,
    };
  }, [filtered]);

  // 5. Distribución por Director Comercial
  const distributionByDirector = useMemo(() => {
    const map = new Map<string, { director: string; count: number; total: number }>();

    filtered.forEach((n) => {
      const dir = n.directorNombre || 'Sin Asignar';
      const cur = map.get(dir) || { director: dir, count: 0, total: 0 };
      cur.count += 1;
      cur.total += n.Valor_NotaCredito;
      map.set(dir, cur);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // 6. Paginación de la tabla
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  // 7. Exportar a Excel con formato institucional de Provexpress
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const workbook = new ExcelJSRuntime.Workbook();
      workbook.creator = 'Provexpress SAS · Cartera';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Notas Crédito');

      worksheet.columns = [
        { header: '#', key: 'rank', width: 6 },
        { header: 'No. Nota Crédito', key: 'nota', width: 18 },
        { header: 'Factura Afectada', key: 'factura', width: 18 },
        { header: 'Fecha Emisión', key: 'fecha', width: 16 },
        { header: 'Cliente / Razón Social', key: 'empresa', width: 36 },
        { header: 'NIT', key: 'nit', width: 15 },
        { header: 'Director Comercial', key: 'director', width: 28 },
        { header: 'Asesor Comercial', key: 'asesor', width: 30 },
        { header: 'Valor Nota Crédito', key: 'valor', width: 20 },
      ];

      filtered.forEach((nc, idx) => {
        const row = worksheet.addRow({
          rank: idx + 1,
          nota: `${nc.Prefijo || 'NCE'} ${nc.Numero}`.trim(),
          factura:
            nc.Numero_Factura > 0
              ? `${nc.Prefijo_Factura || 'FVE'} ${nc.Numero_Factura}`.trim()
              : 'Ajuste General',
          fecha: nc.Fecha_Emision ? nc.Fecha_Emision.split('T')[0] : '',
          empresa: nc.Empresa,
          nit: nc.Identificacion,
          director: nc.directorNombre || 'Sin Asignar',
          asesor: nc.Nombre_Empleado,
          valor: nc.Valor_NotaCredito,
        });

        row.getCell('valor').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
        row.getCell('valor').font = { bold: true, color: { argb: 'FF7E22CE' } };
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notas-credito-provexpress-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando notas crédito a Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="aux-view-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── 1. HEADER HERO DEL DASHBOARD DE NOTAS CRÉDITO ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '22px 26px',
          background: 'linear-gradient(135deg, #4C1D95 0%, #7E22CE 60%, #9333EA 100%)',
          borderRadius: 18,
          color: '#FFFFFF',
          boxShadow: '0 8px 24px -4px rgba(126, 34, 206, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)',
            }}
          >
            <Percent size={28} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                Módulo Independiente ERP
              </span>
              <span style={{ fontSize: 13, color: '#E9D5FF' }}>
                Ajustes, Devoluciones y Descuentos
              </span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              Dashboard de Notas Crédito
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel || filtered.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              backgroundColor: '#FFFFFF',
              color: '#6B21A8',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: isExportingExcel || filtered.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.15s ease',
            }}
            title="Descargar listado de notas crédito a Excel"
          >
            <Download size={15} color="#7E22CE" />
            <span>{isExportingExcel ? 'Generando...' : `Descargar Excel (${filtered.length})`}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. TARJETAS DE KPIS SUPERIORES ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {/* KPI 1: Total Notas Crédito */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Total Notas Emitidas
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#FAF5FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9333EA',
              }}
            >
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', marginBottom: 2 }}>
            {formatNumber(metrics.totalNotas)}
          </div>
          <span style={{ fontSize: 12, color: '#7E22CE', fontWeight: 650 }}>
            Documentos NCE registrados
          </span>
        </div>

        {/* KPI 2: Valor Total de Notas */}
        <div
          style={{
            backgroundColor: '#FAF5FF',
            borderRadius: 14,
            border: '1.5px solid #D8B4FE',
            padding: '18px 20px',
            boxShadow: '0 4px 14px rgba(147, 51, 234, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#7E22CE', textTransform: 'uppercase' }}>
              Valor Total Afectado
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#F3E8FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7E22CE',
              }}
            >
              <Percent size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6B21A8', marginBottom: 2 }}>
            {formatCurrency(metrics.totalValor)}
          </div>
          <span style={{ fontSize: 12, color: '#7E22CE', fontWeight: 650 }}>
            Descuentos y ajustes a cartera
          </span>
        </div>

        {/* KPI 3: Facturas Afectadas */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Facturas Afectadas
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB',
              }}
            >
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', marginBottom: 2 }}>
            {formatNumber(metrics.facturasAfectadas)}
          </div>
          <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 650 }}>
            Facturas de venta con NCE
          </span>
        </div>

        {/* KPI 4: Clientes Beneficiados */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Clientes con Ajustes
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#F0FDF4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16A34A',
              }}
            >
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1E293B', marginBottom: 2 }}>
            {formatNumber(metrics.clientesAfectados)}
          </div>
          <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 650 }}>
            Promedio: {formatCurrency(metrics.promedioPorNota)} / nota
          </span>
        </div>
      </div>

      {/* ─── 3. RESUMEN COMERCIAL POR DIRECTOR ─── */}
      {distributionByDirector.length > 0 && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '18px 22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>
              Distribución de Notas Crédito por Director Comercial
            </span>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              {distributionByDirector.length} directores con notas aplicadas
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {distributionByDirector.map((item) => {
              const pct = metrics.totalValor > 0 ? (item.total / metrics.totalValor) * 100 : 0;
              const isSelected = selectedDirector === item.director;
              return (
                <div
                  key={item.director}
                  onClick={() => setSelectedDirector(isSelected ? 'Todos' : item.director)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#FAF5FF' : '#F8FAFC',
                    border: isSelected ? '1.5px solid #9333EA' : '1px solid #E2E8F0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Filtrar por ${item.director}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: isSelected ? '#6B21A8' : '#1E293B' }}>
                      {item.director}
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7E22CE' }}>
                      {item.count} n.
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>
                    {formatCurrency(item.total)}
                  </div>
                  <div style={{ width: '100%', height: 5, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(3, pct))}%`,
                        height: '100%',
                        backgroundColor: '#9333EA',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 10.5, color: '#64748B', marginTop: 4, display: 'block' }}>
                    {formatPercent(pct)} del total de notas
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 4. BARRA DE CONTROLES: SELECTOR DE PERÍODO + SELECTOR DIRECTOR + BUSCADOR ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: '#FFFFFF',
          padding: '14px 18px',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}
      >
        {/* Presets de Período */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setDatePreset('all');
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: datePreset === 'all' ? '#7E22CE' : '#F1F5F9',
              color: datePreset === 'all' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Todas las Notas ({notas.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setDatePreset('today');
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: datePreset === 'today' ? '#7E22CE' : '#F1F5F9',
              color: datePreset === 'today' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={() => {
              setDatePreset('current_month');
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: datePreset === 'current_month' ? '#7E22CE' : '#F1F5F9',
              color: datePreset === 'current_month' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Mes Actual
          </button>

          <button
            type="button"
            onClick={() => {
              setDatePreset('last_month');
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: datePreset === 'last_month' ? '#7E22CE' : '#F1F5F9',
              color: datePreset === 'last_month' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Mes Anterior
          </button>
        </div>

        {/* Filtros: Director + Buscador */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Select Director */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Building2 size={16} color="#64748B" />
            <select
              value={selectedDirector}
              onChange={(e) => {
                setSelectedDirector(e.target.value);
                setCurrentPage(1);
              }}
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
          <div style={{ position: 'relative', width: 250 }}>
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
              placeholder="Buscar cliente, NIT, nota, factura..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
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
        </div>
      </div>

      {/* ─── 5. TABLA DETALLADA DE NOTAS CRÉDITO ─── */}
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
            background: '#FAF5FF',
            borderBottom: '1px solid #E9D5FF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, color: '#6B21A8', fontWeight: 800 }}>
            🟣 Detalle de Notas Crédito: {filtered.length} registros
          </span>
          <span style={{ fontSize: 13, color: '#64748B' }}>
            Valor Total Filtrado:{' '}
            <strong style={{ color: '#6B21A8', fontSize: 14 }}>
              {formatCurrency(metrics.totalValor)}
            </strong>
          </span>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>#</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>No. Nota Crédito</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Factura Afectada</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Fecha Emisión</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Cliente / Empresa</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>NIT</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Director Comercial</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Asesor Comercial</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                  Valor Nota Crédito
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length > 0 ? (
                paginated.map((nc, idx) => {
                  const itemIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={nc.id || `nc-${idx}`}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                      }}
                    >
                      <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                        {itemIndex}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <strong
                          style={{
                            color: '#7E22CE',
                            fontWeight: 800,
                            backgroundColor: '#F3E8FF',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          {nc.Prefijo || 'NCE'} {nc.Numero}
                        </strong>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {nc.Numero_Factura > 0 ? (
                          <span
                            style={{
                              color: '#2563EB',
                              fontWeight: 700,
                              backgroundColor: '#EFF6FF',
                              padding: '2px 7px',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            {nc.Prefijo_Factura || 'FVE'} {nc.Numero_Factura}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: 11.5 }}>Ajuste General</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                        {nc.Fecha_Emision ? nc.Fecha_Emision.split('T')[0] : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1E293B' }}>
                        {nc.Empresa}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 12 }}>
                        {nc.Identificacion}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#475569' }}>
                        {nc.directorNombre || 'Sin Asignar'}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#334155' }}>
                        {nc.Nombre_Empleado}
                      </td>
                      <td
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: '#7E22CE',
                          fontSize: 13.5,
                        }}
                      >
                        {formatCurrency(nc.Valor_NotaCredito)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: '#94A3B8' }}>
                    No se registran notas crédito para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FAFAFA',
            }}
          >
            <span style={{ fontSize: 12.5, color: '#64748B' }}>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filtered.length} notas)
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: currentPage <= 1 ? '#F1F5F9' : '#FFFFFF',
                  color: currentPage <= 1 ? '#94A3B8' : '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  background: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
                  color: currentPage >= totalPages ? '#94A3B8' : '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
