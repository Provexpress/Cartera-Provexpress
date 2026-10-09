import { useState, useMemo } from 'react';
import {
  CheckCircle,
  Search,
  Building2,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Info,
  Clock,
  DollarSign,
} from 'lucide-react';
import ExcelJSRuntime from 'exceljs';
import type { ReciboCajaRecord } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../lib/carteraApi';
import { LISTA_DIRECTORES } from '../lib/commercialDirectory';

interface Props {
  recibos: ReciboCajaRecord[];
}

type DatePreset = 'current_month' | 'today' | 'last_month' | 'all';

export function RecibosCajaView({ recibos }: Props) {
  // Preset por defecto: Mes Actual (01/10 al 07/10), exactamente la consulta activa de Postman
  const [datePreset, setDatePreset] = useState<DatePreset>('current_month');
  const [selectedDirector, setSelectedDirector] = useState<string>('Todos');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const pageSize = 25;

  // 1. Filtrado por período de fecha según Fecha_Recaudo
  const dateFilteredRecibos = useMemo(() => {
    if (datePreset === 'all') return recibos;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (datePreset === 'today') {
      return recibos.filter((r) => {
        const rec = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
        return rec === todayStr;
      });
    }

    if (datePreset === 'current_month') {
      const startCurrentMonth = `${y}-${m}-01`;
      return recibos.filter((r) => {
        const rec = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
        return rec >= startCurrentMonth && rec <= todayStr;
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

      return recibos.filter((r) => {
        const rec = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
        return rec >= startLm && rec <= endLm;
      });
    }

    return recibos;
  }, [recibos, datePreset]);

  // 2. Conteo rápido para insignias de botones
  const presetCounts = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const startCurrentMonth = `${y}-${m}-01`;

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    const lmYear = lastMonthDate.getFullYear();
    const lmM = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const lmLastD = String(lastMonthLastDay.getDate()).padStart(2, '0');
    const startLm = `${lmYear}-${lmM}-01`;
    const endLm = `${lmYear}-${lmM}-${lmLastD}`;

    let todayCount = 0;
    let currentMonthCount = 0;
    let lastMonthCount = 0;

    recibos.forEach((r) => {
      const rec = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
      if (rec === todayStr) todayCount++;
      if (rec >= startCurrentMonth && rec <= todayStr) currentMonthCount++;
      if (rec >= startLm && rec <= endLm) lastMonthCount++;
    });

    return {
      all: recibos.length,
      today: todayCount,
      current_month: currentMonthCount,
      last_month: lastMonthCount,
    };
  }, [recibos]);

  // 3. Filtrado por Director Comercial y Buscador
  const filtered = useMemo(() => {
    let list = dateFilteredRecibos;

    if (selectedDirector !== 'Todos') {
      list = list.filter((r) => (r.directorNombre || '') === selectedDirector);
    }

    if (!search.trim()) return list;
    const term = search.toLowerCase().trim();

    return list.filter(
      (r) =>
        r.Empresa.toLowerCase().includes(term) ||
        r.Identificacion.includes(term) ||
        String(r.Numero_ReciboCaja).includes(term) ||
        String(r.Numero_FacturaVenta).includes(term) ||
        (r.Prefijo_FacturaVenta || '').toLowerCase().includes(term) ||
        (r.Nombre_Empleado || '').toLowerCase().includes(term) ||
        (r.directorNombre || '').toLowerCase().includes(term)
    );
  }, [dateFilteredRecibos, selectedDirector, search]);

  // Último recibo registrado para notas dinámicas
  const latestReciboInfo = useMemo(() => {
    if (!recibos || recibos.length === 0) return null;
    let latest = recibos[0];
    for (const r of recibos) {
      const fLatest = latest.Fecha_Recaudo ? latest.Fecha_Recaudo.split('T')[0] : '';
      const fCur = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
      if (fCur > fLatest || (fCur === fLatest && r.Numero_ReciboCaja > latest.Numero_ReciboCaja)) {
        latest = r;
      }
    }
    const fStr = latest.Fecha_Recaudo ? latest.Fecha_Recaudo.split('T')[0] : '';
    const parts = fStr.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : fStr;
    return {
      numero: latest.Numero_ReciboCaja,
      fechaCorte: formattedDate,
    };
  }, [recibos]);

  // 4. Métricas y KPIs globales del dashboard
  const metrics = useMemo(() => {
    const totalRecibos = filtered.length;
    const totalRecaudado = filtered.reduce((sum, r) => sum + r.Valor_Pagado, 0);

    const facturasSet = new Set<string>();
    filtered.forEach((r) => {
      if (r.Numero_FacturaVenta > 0) {
        facturasSet.add(`${r.Prefijo_FacturaVenta || 'FVE'}-${r.Numero_FacturaVenta}`);
      }
    });

    const clientesSet = new Set<string>();
    filtered.forEach((r) => clientesSet.add(r.Identificacion));

    const totalFacturadoAfectado = filtered.reduce((sum, r) => sum + r.Valor_Factura, 0);
    const promedioRecibo = totalRecibos > 0 ? totalRecaudado / totalRecibos : 0;
    const promedioDiasPago =
      totalRecibos > 0
        ? Math.round(filtered.reduce((sum, r) => sum + (r.Dias_Pago || 0), 0) / totalRecibos)
        : 0;

    return {
      totalRecibos,
      totalRecaudado,
      totalFacturadoAfectado,
      totalFacturas: facturasSet.size,
      totalClientes: clientesSet.size,
      promedioRecibo,
      promedioDiasPago,
    };
  }, [filtered]);

  // 5. Desglose por Director Comercial
  const breakdownByDirector = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    filtered.forEach((r) => {
      const dir = r.directorNombre || 'Sin Director Asignado';
      const cur = map.get(dir) || { total: 0, count: 0 };
      cur.total += r.Valor_Pagado;
      cur.count += 1;
      map.set(dir, cur);
    });

    return Array.from(map.entries())
      .map(([director, data]) => ({
        director,
        total: data.total,
        count: data.count,
        pct: metrics.totalRecaudado > 0 ? (data.total / metrics.totalRecaudado) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, metrics.totalRecaudado]);

  // Paginación
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const workbook = new ExcelJSRuntime.Workbook();
      workbook.creator = 'Provexpress Cartera ERP';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Recibos de Caja', {
        views: [{ showGridLines: true }],
      });

      worksheet.columns = [
        { header: 'No. Recibo', key: 'rc', width: 14 },
        { header: 'Fecha Recaudo', key: 'fechaRecaudo', width: 14 },
        { header: 'Factura Aplicada', key: 'factura', width: 16 },
        { header: 'Fecha Emisión Fac', key: 'fechaEmision', width: 14 },
        { header: 'Fecha Venc Fac', key: 'fechaVenc', width: 14 },
        { header: 'NIT / CC', key: 'nit', width: 16 },
        { header: 'Cliente / Razón Social', key: 'cliente', width: 34 },
        { header: 'Asesor Comercial', key: 'comercial', width: 26 },
        { header: 'Director Comercial', key: 'director', width: 26 },
        { header: 'Días Pago', key: 'diasPago', width: 12 },
        { header: 'Valor Factura', key: 'valorFactura', width: 18 },
        { header: 'Valor Recaudado', key: 'valorPagado', width: 18 },
        { header: 'Estado Recaudo', key: 'estado', width: 18 },
      ];

      filtered.forEach((r) => {
        const isSaldada = r.Valor_Pagado >= r.Valor_Factura && r.Valor_Factura > 0;
        const row = worksheet.addRow({
          rc: `RC-${r.Numero_ReciboCaja}`,
          fechaRecaudo: r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '',
          factura: `${r.Prefijo_FacturaVenta || 'FVE'} ${r.Numero_FacturaVenta}`,
          fechaEmision: r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '',
          fechaVenc: r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '',
          nit: r.Identificacion,
          cliente: r.Empresa,
          comercial: r.Nombre_Empleado,
          director: r.directorNombre || 'Sin Asignar',
          diasPago: r.Dias_Pago,
          valorFactura: r.Valor_Factura,
          valorPagado: r.Valor_Pagado,
          estado: isSaldada ? '100% RECAUDADA' : 'ABONO PARCIAL',
        });

        row.getCell('valorFactura').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
        row.getCell('valorPagado').numFmt = '"$"#,##0;[Red]-"$"#,##0;"$0"';
        row.getCell('valorPagado').font = { bold: true, color: { argb: 'FF15803D' } };
      });

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF15803D' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Recibos_Caja_Provexpress_${datePreset}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al generar Excel de Recibos:', err);
      alert('Ocurrió un error al generar el archivo Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── 1. CABECERA EJECUTIVA DEL DASHBOARD ─── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #14532D 0%, #166534 60%, #15803D 100%)',
          color: '#FFFFFF',
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 8px 24px rgba(22, 101, 52, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ maxWidth: 650 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            <Sparkles size={13} />
            Módulo Oficial de Recaudos y Pagos
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', letterSpacing: -0.5 }}>
            Tablero Ejecutivo de Recibos de Caja
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: '#DCFCE7', lineHeight: 1.5 }}>
            Monitoreo en vivo de los pagos y recaudos aplicados a las facturas de venta. Permite auditar qué facturas han sido recaudadas y su efectividad por director y asesor comercial.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={isExportingExcel || filtered.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FFFFFF',
            color: '#166534',
            border: 'none',
            borderRadius: 10,
            padding: '11px 18px',
            fontSize: 13,
            fontWeight: 750,
            cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
            transition: 'all 0.15s ease',
            opacity: filtered.length === 0 ? 0.6 : 1,
          }}
        >
          <Download size={16} />
          {isExportingExcel ? 'Exportando...' : `Descargar Excel (${formatNumber(filtered.length)})`}
        </button>
      </div>

      {/* ─── 2. BARRA DE PRESETS DE FECHAS (IDENTICA A POSTMAN / ERP) ─── */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '12px 18px',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 750, color: '#334155', marginRight: 4 }}>
          Período de Consulta:
        </span>

        <button
          type="button"
          onClick={() => {
            setDatePreset('current_month');
            setCurrentPage(1);
          }}
          style={{
            padding: '7px 15px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: datePreset === 'current_month' ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
            backgroundColor: datePreset === 'current_month' ? '#F0FDF4' : '#FFFFFF',
            color: datePreset === 'current_month' ? '#15803D' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Calendar size={13} />
          Mes Actual
          <span
            style={{
              backgroundColor: datePreset === 'current_month' ? '#16A34A' : '#E2E8F0',
              color: datePreset === 'current_month' ? '#FFFFFF' : '#475569',
              fontSize: 10.5,
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            {formatNumber(presetCounts.current_month)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDatePreset('today');
            setCurrentPage(1);
          }}
          style={{
            padding: '7px 15px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: datePreset === 'today' ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
            backgroundColor: datePreset === 'today' ? '#F0FDF4' : '#FFFFFF',
            color: datePreset === 'today' ? '#15803D' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Clock size={13} />
          Hoy
          <span
            style={{
              backgroundColor: datePreset === 'today' ? '#16A34A' : '#E2E8F0',
              color: datePreset === 'today' ? '#FFFFFF' : '#475569',
              fontSize: 10.5,
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            {presetCounts.today}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDatePreset('last_month');
            setCurrentPage(1);
          }}
          style={{
            padding: '7px 15px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: datePreset === 'last_month' ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
            backgroundColor: datePreset === 'last_month' ? '#F0FDF4' : '#FFFFFF',
            color: datePreset === 'last_month' ? '#15803D' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Mes Anterior (Septiembre)
          <span
            style={{
              backgroundColor: datePreset === 'last_month' ? '#16A34A' : '#E2E8F0',
              color: datePreset === 'last_month' ? '#FFFFFF' : '#475569',
              fontSize: 10.5,
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            {formatNumber(presetCounts.last_month)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDatePreset('all');
            setCurrentPage(1);
          }}
          style={{
            padding: '7px 15px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: datePreset === 'all' ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
            backgroundColor: datePreset === 'all' ? '#F0FDF4' : '#FFFFFF',
            color: datePreset === 'all' ? '#15803D' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Todos los Recaudos
          <span
            style={{
              backgroundColor: datePreset === 'all' ? '#16A34A' : '#E2E8F0',
              color: datePreset === 'all' ? '#FFFFFF' : '#475569',
              fontSize: 10.5,
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 800,
            }}
          >
            {formatNumber(presetCounts.all)}
          </span>
        </button>
      </div>

      {/* Nota informativa en caso de seleccionar 'Hoy' */}
      {datePreset === 'today' && presetCounts.today === 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: '14px 18px',
            backgroundColor: '#FEF3C7',
            borderRadius: 12,
            border: '1px solid #FCD34D',
            color: '#92400E',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <Info size={18} style={{ flexShrink: 0, marginTop: 2, color: '#D97706' }} />
          <div>
            <strong>Situación del día de hoy en ERP Siesa:</strong> {latestReciboInfo ? (
              <>El último consecutivo de recibo de caja asentado en la vista contable es el <strong>RC-{latestReciboInfo.numero}</strong> al corte del {latestReciboInfo.fechaCorte}. </>
            ) : null}
            Los recibos emitidos hoy en la operación se encuentran en lote provisional/borrador en tesorería y se sincronizarán al realizarse el cierre del día. Para ver los <strong>{formatNumber(presetCounts.current_month)} recibos de este mes</strong>, selecciona la pestaña <strong>«Mes Actual»</strong>.
          </div>
        </div>
      )}

      {/* ─── 3. TARJETAS DE KPIS PRINCIPALES ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Total Recaudado
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#166534', letterSpacing: -0.5 }}>
            {formatCurrency(metrics.totalRecaudado)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            Monto total recuperado en el período
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Recibos Procesados
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#1E293B', letterSpacing: -0.5 }}>
            {formatNumber(metrics.totalRecibos)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            Comprobantes de pago registrados
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Facturas Saldadas
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#F3E8FF',
                color: '#7E22CE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#1E293B', letterSpacing: -0.5 }}>
            {formatNumber(metrics.totalFacturas)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            Documentos impactados por recaudo
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Clientes con Pago
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 850, color: '#1E293B', letterSpacing: -0.5 }}>
            {formatNumber(metrics.totalClientes)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            Razones sociales que pagaron
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 750, color: '#64748B', textTransform: 'uppercase' }}>
              Promedio por Recibo
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 850, color: '#1E293B', letterSpacing: -0.5 }}>
            {formatCurrency(metrics.promedioRecibo)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            Ticket medio por comprobante
          </div>
        </div>
      </div>

      {/* ─── 4. DESGLOSE POR DIRECTOR COMERCIAL ─── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#1E293B' }}>
            Distribución del Recaudo por Director Comercial
          </h3>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            {breakdownByDirector.length} direcciones comerciales con pagos
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {breakdownByDirector.map((b) => (
            <div
              key={b.director}
              onClick={() => {
                setSelectedDirector(selectedDirector === b.director ? 'Todos' : b.director);
                setCurrentPage(1);
              }}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: selectedDirector === b.director ? '1.5px solid #16A34A' : '1px solid #F1F5F9',
                backgroundColor: selectedDirector === b.director ? '#F0FDF4' : '#F8FAFC',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: '#1E293B' }}>{b.director}</strong>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>
                  {formatPercent(b.pct)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                <span>{b.count} recibos</span>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>{formatCurrency(b.total)}</span>
              </div>
              <div style={{ width: '100%', height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${b.pct}%`,
                    height: '100%',
                    backgroundColor: '#16A34A',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. TABLA DETALLADA DE RECIBOS DE CAJA ─── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Barra de filtros de la tabla */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            {/* Buscador */}
            <div style={{ position: 'relative', width: 280 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                }}
              />
              <input
                type="text"
                placeholder="Buscar cliente, NIT, # recibo, factura..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  fontSize: 12.5,
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </div>

            {/* Filtro Director */}
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
                borderRadius: 8,
                border: '1px solid #CBD5E1',
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
          </div>

          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
            {formatNumber(filtered.length)} recibos encontrados ({formatCurrency(metrics.totalRecaudado)})
          </span>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>#</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Recibo de Caja</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Factura Asociada</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Fecha Recaudo</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Cliente / Empresa</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>NIT</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Asesor Comercial</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Director</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                  Vr. Factura
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                  Vr. Recaudado
                </th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px 16px', color: '#94A3B8' }}>
                    No se encontraron recibos de caja para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                paginated.map((rc, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isSaldada = rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0;
                  return (
                    <tr
                      key={rc.id || `rc-${idx}`}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                      }}
                    >
                      <td style={{ padding: '11px 16px', color: '#64748B', fontSize: 12 }}>{globalIdx}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 750, color: '#166534' }}>
                        RC-{rc.Numero_ReciboCaja}
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#0071e3' }}>
                        {rc.Prefijo_FacturaVenta || 'FVE'} {rc.Numero_FacturaVenta}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#475569', fontSize: 12 }}>
                        {rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: '#1E293B' }}>{rc.Empresa}</td>
                      <td style={{ padding: '11px 16px', color: '#64748B', fontSize: 12 }}>{rc.Identificacion}</td>
                      <td style={{ padding: '11px 16px', color: '#334155' }}>{rc.Nombre_Empleado}</td>
                      <td style={{ padding: '11px 16px', color: '#475569' }}>
                        {rc.directorNombre || 'Sin Asignar'}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748B' }}>
                        {formatCurrency(rc.Valor_Factura)}
                      </td>
                      <td
                        style={{
                          padding: '11px 16px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: '#166534',
                        }}
                      >
                        {formatCurrency(rc.Valor_Pagado)}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                        <span
                          className={`badge ${isSaldada ? 'badge-success' : 'badge-warning'}`}
                          style={{ fontSize: 10.5, fontWeight: 750, padding: '3px 8px' }}
                        >
                          {isSaldada ? '100% RECAUDADA' : 'ABONO PARCIAL'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Mostrando {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)} -{' '}
              {Math.min(filtered.length, currentPage * pageSize)} de {formatNumber(filtered.length)} recibos
            </span>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                }}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '0 8px' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
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
