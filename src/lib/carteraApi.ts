import type {
  AgeBucketKey,
  AgingSummaryItem,
  CarteraDataState,
  CarteraRecord,
  CustomerSummary,
  ExecutiveSummary,
  GroupSummary,
  NotaCreditoRecord,
  ReciboCajaRecord,
} from '../types';
import {
  ESTRUCTURA_COMERCIAL_2026,
  LISTA_DIRECTORES,
  normalizeName,
  resolveCommercialOrDirector,
} from './commercialDirectory';

export const AGING_CONFIG: Record<
  AgeBucketKey,
  { label: string; shortLabel: string; min: number; max: number; color: string; badgeClass: string }
> = {
  CORRIENTE: {
    label: 'No Vencido / Corriente (0 días)',
    shortLabel: 'Corriente',
    min: -9999,
    max: 0,
    color: '#18a957',
    badgeClass: 'badge-success',
  },
  '1_30': {
    label: '1 a 30 días',
    shortLabel: '1-30 d',
    min: 1,
    max: 30,
    color: '#0071e3',
    badgeClass: 'badge-primary',
  },
  '31_60': {
    label: '31 a 60 días',
    shortLabel: '31-60 d',
    min: 31,
    max: 60,
    color: '#f59e0b',
    badgeClass: 'badge-warning',
  },
  '61_90': {
    label: '61 a 90 días',
    shortLabel: '61-90 d',
    min: 61,
    max: 90,
    color: '#ea580c',
    badgeClass: 'badge-orange',
  },
  '91_120': {
    label: '91 a 120 días',
    shortLabel: '91-120 d',
    min: 91,
    max: 120,
    color: '#dc2626',
    badgeClass: 'badge-danger',
  },
  '121_180': {
    label: '121 a 180 días',
    shortLabel: '121-180 d',
    min: 121,
    max: 180,
    color: '#9333ea',
    badgeClass: 'badge-purple',
  },
  MAS_180: {
    label: 'Más de 180 días (Crítica)',
    shortLabel: '> 180 d',
    min: 181,
    max: 999999,
    color: '#7f1d1d',
    badgeClass: 'badge-critical',
  },
};

const AGING_ORDER: AgeBucketKey[] = [
  'CORRIENTE',
  '1_30',
  '31_60',
  '61_90',
  '91_120',
  '121_180',
  'MAS_180',
];

function getErpEndpointUrl(endpoint: string, queryParams?: Record<string, string>): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let base = typeof window !== 'undefined' ? `/erp-api${cleanEndpoint}` : `http://152.200.146.226:50010${cleanEndpoint}`;

  if (queryParams) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null) sp.append(k, String(v));
    }
    const qs = sp.toString();
    if (qs) {
      base += (base.includes('?') ? '&' : '?') + qs;
    }
  }

  return base;
}

let cachedToken: string | null = null;
let tokenExpiryTime = 0;

/**
 * Autentica contra el backend ERP de Provexpress y retorna el Bearer Token.
 */
export async function authenticateErp(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiryTime) {
    return cachedToken;
  }

  const url = getErpEndpointUrl('/api/getKey');
  const username = String(import.meta.env.VITE_REMISIONES_API_USER || 'powerbi').trim();
  let password = String(import.meta.env.VITE_REMISIONES_API_PASS || '3xpress#2025').trim();
  if (password === '3xpress' || !password.includes('#')) {
    password = '3xpress#2025';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`Error de autenticación ERP (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  const token = data.token || data.access;
  if (!token) {
    throw new Error('La respuesta de autenticación del ERP no contiene token válido.');
  }

  cachedToken = token;
  // Renovar cada 20 minutos
  tokenExpiryTime = now + 20 * 60 * 1000;
  return token;
}

/**
 * Clasifica la antigüedad de un saldo de cartera
 */
export function classifyAgeBucket(diasVencimiento: number, rangoCarteraRaw?: string): AgeBucketKey {
  const raw = (rangoCarteraRaw || '').trim().toLowerCase();

  if (raw === 'corriente' || diasVencimiento <= 0) {
    return 'CORRIENTE';
  }
  if (raw === '1 a 30' || (diasVencimiento >= 1 && diasVencimiento <= 30)) {
    return '1_30';
  }
  if (raw === '31 a 60' || (diasVencimiento >= 31 && diasVencimiento <= 60)) {
    return '31_60';
  }
  if (raw === '61 a 90' || (diasVencimiento >= 61 && diasVencimiento <= 90)) {
    return '61_90';
  }
  if (raw === '91 a 120' || (diasVencimiento >= 91 && diasVencimiento <= 120)) {
    return '91_120';
  }
  if (
    raw === '121 a 150' ||
    raw === '150 a 180' ||
    (diasVencimiento >= 121 && diasVencimiento <= 180)
  ) {
    return '121_180';
  }
  return 'MAS_180';
}

export function getGroupLabel(groupNumber: number): string {
  switch (groupNumber) {
    case 1:
      return 'Grupo Novoa';
    case 2:
      return 'Grupo Caballero';
    case 3:
      return 'Grupo Beltrán';
    case 4:
      return 'Grupo Romero';
    default:
      return 'Gerencia / Especiales';
  }
}

/**
 * Enriquecer los registros raw de cartera con grupos comerciales, directores y clasificación
 */
function enrichCarteraRecord(raw: any, index: number): CarteraRecord {
  const empName = String(raw.Nombre_Empleado || '').trim();
  const commercialResolution = resolveCommercialOrDirector(empName);

  const diasVencimiento = typeof raw.Dias_Vencimiento === 'number'
    ? raw.Dias_Vencimiento
    : parseInt(String(raw.Dias_Vencimiento || '0'), 10) || 0;

  const categoriaEdad = classifyAgeBucket(diasVencimiento, raw.Rango_Cartera);
  const estaVencida = categoriaEdad !== 'CORRIENTE' && diasVencimiento > 0;

  const prefijo = String(raw.Prefijo || '').trim();
  const numero = raw.Numero || 0;
  const nit = String(raw.Identificacion || '').trim();

  return {
    Grupo_Comercial: raw.Grupo_Comercial || null,
    Nombre_Empleado: empName,
    Identificacion: nit,
    Dv: String(raw.Dv || '').trim(),
    Empresa: String(raw.Empresa || '').trim(),
    Cupo_Credito: Number(raw.Cupo_Credito) || 0,
    Estado_Cliente: String(raw.Estado_Cliente || 'Activo').trim(),
    Plazo_PagoCliente: Number(raw.Plazo_PagoCliente) || 0,
    Prefijo: prefijo,
    Numero: numero,
    Tipo_Documento: String(raw.Tipo_Documento || 'Factura Venta').trim(),
    Fecha_Emision: raw.Fecha_Emision || '',
    Fecha_Vencimiento: raw.Fecha_Vencimiento || '',
    Plazo_Pago: Number(raw.Plazo_Pago) || 0,
    Dias_Emision: Number(raw.Dias_Emision) || 0,
    Dias_Vencimiento: diasVencimiento,
    Rango_Cartera: String(raw.Rango_Cartera || '').trim(),
    Valor_Saldo: Number(raw.Valor_Saldo) || 0,
    Productos: Array.isArray(raw.Productos)
      ? raw.Productos.map((p: any) => ({
          Codigo: String(p.Codigo || '').trim(),
          Descripcion: String(p.Descripcion || '').trim(),
          Cantidad: Number(p.Cantidad) || 0,
          Valor_Producto: Number(p.Valor_Producto) || 0,
          Valor_Total: Number(p.Valor_Total) || 0,
        }))
      : [],
    id: `${nit}-${prefijo}-${numero}-${index}`,
    grupoNumero: commercialResolution.grupo,
    grupoNombre: getGroupLabel(commercialResolution.grupo),
    directorNombre: commercialResolution.directorNombre,
    directorEmail: commercialResolution.directorEmail,
    ejecutivoEmail: commercialResolution.email,
    categoriaEdad,
    diasVencimientoCalc: diasVencimiento,
    estaVencida,
  };
}

export interface CarteraMetrics {
  totalSaldo: number;
  totalCorriente: number;
  totalVencido: number;
  porcentajeVencido: number;
  totalDocumentos: number;
  clientesUnicos: number;
  cupoTotalComprometido: number;
  agingBreakdown: AgingSummaryItem[];
  groupsSummary: GroupSummary[];
  executivesSummary: ExecutiveSummary[];
  customersSummary: CustomerSummary[];
}

/**
 * Calcula métricas, edades, agrupaciones comerciales y deudores para cualquier subconjunto de facturas
 */
export function computeCarteraMetrics(records: CarteraRecord[]): CarteraMetrics {
  let totalSaldo = 0;
  let totalCorriente = 0;
  let totalVencido = 0;
  const uniqueNits = new Set<string>();

  const agingBucketsMap: Record<AgeBucketKey, { totalValor: number; count: number }> = {
    CORRIENTE: { totalValor: 0, count: 0 },
    '1_30': { totalValor: 0, count: 0 },
    '31_60': { totalValor: 0, count: 0 },
    '61_90': { totalValor: 0, count: 0 },
    '91_120': { totalValor: 0, count: 0 },
    '121_180': { totalValor: 0, count: 0 },
    MAS_180: { totalValor: 0, count: 0 },
  };

  const groupMap = new Map<number, {
    grupo: number;
    totalSaldo: number;
    totalCorriente: number;
    totalVencido: number;
    docCount: number;
    nits: Set<string>;
    comerciales: Set<string>;
    aging: Record<AgeBucketKey, number>;
  }>();

  // Inicializar grupos 1, 2, 3, 4 y 0
  [1, 2, 3, 4, 0].forEach((g) => {
    groupMap.set(g, {
      grupo: g,
      totalSaldo: 0,
      totalCorriente: 0,
      totalVencido: 0,
      docCount: 0,
      nits: new Set<string>(),
      comerciales: new Set<string>(),
      aging: {
        CORRIENTE: 0,
        '1_30': 0,
        '31_60': 0,
        '61_90': 0,
        '91_120': 0,
        '121_180': 0,
        MAS_180: 0,
      },
    });
  });

  const execMap = new Map<string, {
    nombre: string;
    email: string;
    grupo: number;
    directorNombre: string;
    totalSaldo: number;
    totalCorriente: number;
    totalVencido: number;
    docCount: number;
    nits: Set<string>;
    aging: Record<AgeBucketKey, number>;
  }>();

  const custMap = new Map<string, CustomerSummary>();

  for (const r of records) {
    const val = r.Valor_Saldo;
    totalSaldo += val;
    uniqueNits.add(r.Identificacion);

    if (r.estaVencida) {
      totalVencido += val;
    } else {
      totalCorriente += val;
    }

    const ageKey = r.categoriaEdad;
    agingBucketsMap[ageKey].totalValor += val;
    agingBucketsMap[ageKey].count += 1;

    // Grupo
    const grp = groupMap.get(r.grupoNumero) || groupMap.get(0)!;
    grp.totalSaldo += val;
    if (r.estaVencida) grp.totalVencido += val;
    else grp.totalCorriente += val;
    grp.docCount += 1;
    grp.nits.add(r.Identificacion);
    grp.comerciales.add(r.Nombre_Empleado);
    grp.aging[ageKey] += val;
    groupMap.set(r.grupoNumero, grp);

    // Ejecutivo
    const execKey = (r.Nombre_Empleado || 'Sin Asignar').toLowerCase();
    const exec = execMap.get(execKey) || {
      nombre: r.Nombre_Empleado,
      email: r.ejecutivoEmail || '',
      grupo: r.grupoNumero,
      directorNombre: r.directorNombre,
      totalSaldo: 0,
      totalCorriente: 0,
      totalVencido: 0,
      docCount: 0,
      nits: new Set<string>(),
      aging: {
        CORRIENTE: 0,
        '1_30': 0,
        '31_60': 0,
        '61_90': 0,
        '91_120': 0,
        '121_180': 0,
        MAS_180: 0,
      },
    };
    exec.totalSaldo += val;
    if (r.estaVencida) exec.totalVencido += val;
    else exec.totalCorriente += val;
    exec.docCount += 1;
    exec.nits.add(r.Identificacion);
    exec.aging[ageKey] += val;
    execMap.set(execKey, exec);

    // Cliente
    const custKey = r.Identificacion;
    const cust = custMap.get(custKey) || {
      nit: r.Identificacion,
      dv: r.Dv,
      empresa: r.Empresa,
      cupoCredito: r.Cupo_Credito,
      estadoCliente: r.Estado_Cliente,
      plazoPago: r.Plazo_PagoCliente,
      totalSaldo: 0,
      totalCorriente: 0,
      totalVencido: 0,
      docCount: 0,
      comercial: r.Nombre_Empleado,
      grupo: r.grupoNumero,
      directorNombre: r.directorNombre,
      aging: {
        CORRIENTE: 0,
        '1_30': 0,
        '31_60': 0,
        '61_90': 0,
        '91_120': 0,
        '121_180': 0,
        MAS_180: 0,
      },
    };
    cust.totalSaldo += val;
    if (r.estaVencida) cust.totalVencido += val;
    else cust.totalCorriente += val;
    cust.docCount += 1;
    cust.aging[ageKey] += val;
    custMap.set(custKey, cust);
  }

  const agingBreakdown: AgingSummaryItem[] = AGING_ORDER.map((key) => {
    const config = AGING_CONFIG[key];
    const data = agingBucketsMap[key];
    const pct = totalSaldo > 0 ? (data.totalValor / totalSaldo) * 100 : 0;
    return {
      key,
      label: config.label,
      shortLabel: config.shortLabel,
      totalValor: data.totalValor,
      count: data.count,
      percentage: pct,
      color: config.color,
      badgeClass: config.badgeClass,
    };
  });

  const groupsSummary: GroupSummary[] = Array.from(groupMap.values())
    .map((g) => {
      const dir = LISTA_DIRECTORES.find((d) => d.grupo === g.grupo);
      return {
        grupo: g.grupo,
        grupoNombre: getGroupLabel(g.grupo),
        directorNombre: dir ? dir.nombre : g.grupo === 0 ? 'Gerencia / Especiales' : 'Sin Asignar',
        directorEmail: dir ? dir.email : '',
        totalSaldo: g.totalSaldo,
        totalCorriente: g.totalCorriente,
        totalVencido: g.totalVencido,
        porcentajeVencido: g.totalSaldo > 0 ? (g.totalVencido / g.totalSaldo) * 100 : 0,
        docCount: g.docCount,
        clientesCount: g.nits.size,
        ejecutivosCount: g.comerciales.size,
        aging: g.aging,
      };
    })
    .sort((a, b) => b.totalSaldo - a.totalSaldo);

  const executivesSummary: ExecutiveSummary[] = Array.from(execMap.values())
    .map((e) => ({
      nombre: e.nombre,
      email: e.email,
      grupo: e.grupo,
      grupoNombre: getGroupLabel(e.grupo),
      directorNombre: e.directorNombre,
      totalSaldo: e.totalSaldo,
      totalCorriente: e.totalCorriente,
      totalVencido: e.totalVencido,
      porcentajeVencido: e.totalSaldo > 0 ? (e.totalVencido / e.totalSaldo) * 100 : 0,
      docCount: e.docCount,
      clientesCount: e.nits.size,
      aging: e.aging,
    }))
    .sort((a, b) => b.totalSaldo - a.totalSaldo);

  const customersSummary: CustomerSummary[] = Array.from(custMap.values())
    .sort((a, b) => b.totalSaldo - a.totalSaldo);

  const cupoTotalComprometido = customersSummary.reduce((sum, c) => sum + c.cupoCredito, 0);

  return {
    totalSaldo,
    totalCorriente,
    totalVencido,
    porcentajeVencido: totalSaldo > 0 ? (totalVencido / totalSaldo) * 100 : 0,
    totalDocumentos: records.length,
    clientesUnicos: uniqueNits.size,
    cupoTotalComprometido,
    agingBreakdown,
    groupsSummary,
    executivesSummary,
    customersSummary,
  };
}

/**
 * Consulta las 3 APIs de Cartera, Recibos y Notas Crédito y procesa los tableros
 */
export async function fetchCarteraCompleta(
  fechaInicial: string,
  fechaFinal: string,
  tipoReporte = 'D'
): Promise<CarteraDataState> {
  const token = await authenticateErp();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const carteraUrl = getErpEndpointUrl('/consultas/api/consultaCarteraEdadesDashboardPBI', {
    Fecha_Inicial: fechaInicial,
    Fecha_Final: fechaFinal,
    Tipo_Reporte: tipoReporte,
  });
  const recibosUrl = getErpEndpointUrl('/consultas/api/consultaDocumentosRecibosCajaPBI', {
    Fecha_Inicial: fechaInicial,
    Fecha_Final: fechaFinal,
  });
  const notasUrl = getErpEndpointUrl('/consultas/api/consultaNotasCreditoPBI', {
    Fecha_Inicial: fechaInicial,
    Fecha_Final: fechaFinal,
  });

  const [resCartera, resRecibos, resNotas] = await Promise.all([
    fetch(carteraUrl, { headers }),
    fetch(recibosUrl, { headers }),
    fetch(notasUrl, { headers }),
  ]);

  if (!resCartera.ok) {
    throw new Error(`Error en API Cartera (${resCartera.status}): ${resCartera.statusText}`);
  }

  const jsonCartera = await resCartera.json();
  const jsonRecibos = resRecibos.ok ? await resRecibos.json() : { response: [] };
  const jsonNotas = resNotas.ok ? await resNotas.json() : { response: [] };

  const rawCarteraList: any[] = jsonCartera.response || [];
  const rawRecibosList: any[] = jsonRecibos.response || [];
  const rawNotasList: any[] = jsonNotas.response || [];

  // Enriquecer cartera
  const records: CarteraRecord[] = rawCarteraList.map((r, i) => enrichCarteraRecord(r, i));

  // Enriquecer recibos de caja
  const recibos: ReciboCajaRecord[] = rawRecibosList.map((r, i) => {
    const emp = String(r.Nombre_Empleado || '').trim();
    const resRole = resolveCommercialOrDirector(emp);
    return {
      Grupo_Personal: String(r.Grupo_Personal || ''),
      Nombre_Empleado: emp,
      Identificacion: String(r.Identificacion || '').trim(),
      Empresa: String(r.Empresa || '').trim(),
      Prefijo_ReciboCaja: String(r.Prefijo_ReciboCaja || '').trim(),
      Numero_ReciboCaja: Number(r.Numero_ReciboCaja) || 0,
      Fecha_Recaudo: r.Fecha_Recaudo || '',
      Prefijo_FacturaVenta: String(r.Prefijo_FacturaVenta || '').trim(),
      Numero_FacturaVenta: Number(r.Numero_FacturaVenta) || 0,
      Fecha_Emision: r.Fecha_Emision || '',
      Fecha_Vencimiento: r.Fecha_Vencimiento || '',
      Dias_PlazoPago: Number(r.Dias_PlazoPago) || 0,
      Dias_Pago: Number(r.Dias_Pago) || 0,
      Valor_Factura: Number(r.Valor_Factura) || 0,
      Valor_Pagado: Number(r.Valor_Pagado) || 0,
      id: `rc-${r.Numero_ReciboCaja}-${i}`,
      grupoNumero: resRole.grupo,
      directorNombre: resRole.directorNombre,
    };
  });

  // Enriquecer notas crédito
  const notas: NotaCreditoRecord[] = rawNotasList.map((n, i) => {
    const emp = String(n.Nombre_Empleado || '').trim();
    const resRole = resolveCommercialOrDirector(emp);
    return {
      Grupo_Personal: String(n.Grupo_Personal || ''),
      Nombre_Empleado: emp,
      Identificacion: String(n.Identificacion || '').trim(),
      Empresa: String(n.Empresa || '').trim(),
      Prefijo: String(n.Prefijo || '').trim(),
      Numero: Number(n.Numero) || 0,
      Fecha_Emision: n.Fecha_Emision || '',
      Valor_NotaCredito: Number(n.Valor_NotaCredito) || 0,
      Prefijo_Factura: String(n.Prefijo_Factura || '').trim(),
      Numero_Factura: Number(n.Numero_Factura) || 0,
      id: `nc-${n.Prefijo}-${n.Numero}-${i}`,
      grupoNumero: resRole.grupo,
      directorNombre: resRole.directorNombre,
    };
  });

  // Métricas e indicadores consolidados
  const metrics = computeCarteraMetrics(records);
  const totalRecaudosPeriodo = recibos.reduce((sum, r) => sum + r.Valor_Pagado, 0);
  const totalNotasPeriodo = notas.reduce((sum, n) => sum + n.Valor_NotaCredito, 0);

  return {
    records,
    recibos,
    notas,
    totalSaldo: metrics.totalSaldo,
    totalCorriente: metrics.totalCorriente,
    totalVencido: metrics.totalVencido,
    porcentajeVencido: metrics.porcentajeVencido,
    totalRecaudosPeriodo,
    totalNotasPeriodo,
    clientesUnicos: metrics.clientesUnicos,
    totalDocumentos: metrics.totalDocumentos,
    cupoTotalComprometido: metrics.cupoTotalComprometido,
    agingBreakdown: metrics.agingBreakdown,
    groupsSummary: metrics.groupsSummary,
    executivesSummary: metrics.executivesSummary,
    customersSummary: metrics.customersSummary,
    fechaCorte: fechaFinal,
    fechaConsulta: new Date().toISOString(),
  };
}

/**
 * Fechas por defecto para selector
 */
export function getDefaultDateRange(): { fechaInicial: string; fechaFinal: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // Primer día del mes actual como inicial
  const fechaInicial = `${y}-${m}-01`;
  const fechaFinal = `${y}-${m}-${day}`;
  return { fechaInicial, fechaFinal };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num);
}

export function formatPercent(pct: number): string {
  return `${pct.toFixed(1)}%`;
}
