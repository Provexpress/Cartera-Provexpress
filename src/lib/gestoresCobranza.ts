/**
 * Módulo de Clasificación y Gestión de Cobranza de Cartera - Provexpress SAS (2026).
 * 
 * Distribución oficial según asignación corporativa:
 * - WILMER GUALTEROS (24 Asesores Comerciales)
 * - CAROLINA SÁNCHEZ (19 Asesores Comerciales)
 */

import type { ReciboCajaRecord } from '../types';

export type GestorCobranzaId = 'wilmer' | 'carolina' | 'otro';
export type GestorCobranzaNombre = 'Wilmer Gualteros' | 'Carolina Sánchez' | 'Sin Asignar / Otros';

export interface AsesorCobranzaConfig {
  nombre: string;
  aliases: string[];
}

export const ASESORES_WILMER: AsesorCobranzaConfig[] = [
  { nombre: 'ANGIE TATIANA PARRA', aliases: ['angie tatiana parra', 'tatiana parra', 'angie parra'] },
  { nombre: 'CLAUDIA TRIANA', aliases: ['claudia patricia triana', 'claudia triana', 'patricia triana'] },
  { nombre: 'DAFNE RUIZ', aliases: ['dafne lizeth ruiz', 'dafne ruiz', 'lizeth ruiz'] },
  { nombre: 'DANIEL GALINDO', aliases: ['daniel galindo giron', 'daniel galindo'] },
  { nombre: 'DILMA CUESTA', aliases: ['dilma constanza cuesta', 'dilma cuesta', 'constanza cuesta'] },
  { nombre: 'FERNANDO QUIÑONEZ', aliases: ['fernando alberto quinonez', 'fernando quinonez', 'alberto quinonez'] },
  { nombre: 'JASBLEIDY MOJICA', aliases: ['jasbleidy johana mojica', 'jasbleidy mojica', 'johana mojica'] },
  { nombre: 'JAVIER CORTES', aliases: ['javier antonio cortes', 'javier cortes', 'antonio cortes'] },
  { nombre: 'JENNY GONZALEZ', aliases: ['jenny alexandra gonzalez', 'jenny gonzalez', 'alexandra gonzalez'] },
  { nombre: 'JESSICA VALENCIA', aliases: ['jessica lorena valencia', 'jessica valencia', 'lorena valencia'] },
  { nombre: 'JHONATAN CAMILO HERNANDEZ', aliases: ['jhonatan camilo hernandez', 'camilo hernandez', 'jhonathan camilo hernandez'] },
  { nombre: 'JOHANNA JAIME', aliases: ['johanna jaime murcia', 'johanna jaime'] },
  { nombre: 'KARENT CARRILLO', aliases: ['karent carrillo marin', 'karent carrillo', 'karen carrillo'] },
  { nombre: 'ASTRID JIMENEZ', aliases: ['leidy astrid jimenez', 'astrid jimenez', 'leidy jimenez'] },
  { nombre: 'MARIO REYES', aliases: ['mario reyes gutierrez', 'mario reyes'] },
  { nombre: 'OSCAR BELTRAN', aliases: ['oscar alejandro beltran', 'oscar beltran', 'alejandro beltran'] },
  { nombre: 'ROSA MARIA MENDOZA', aliases: ['rosa maria mendoza', 'rosa mendoza'] },
  { nombre: 'ROSMIRA ROJAS', aliases: ['rosmira rojas puentes', 'rosmira rojas puente', 'rosmira rojas'] },
  { nombre: 'WILLSON SANCHEZ', aliases: ['wilson fernando sanchez', 'willson sanchez', 'wilson sanchez'] },
  { nombre: 'CESAR CESPEDES', aliases: ['cesar augusto cespedes', 'cesar cespedes', 'augusto cespedes'] },
  { nombre: 'YURANY VARGAS', aliases: ['yurany andrea vargas', 'yurany vargas', 'andrea vargas'] },
  { nombre: 'DAYANA CHALA', aliases: ['dayana marcela chala', 'dayana chala', 'marcela chala'] },
  { nombre: 'EDGAR ZAPATA', aliases: ['edgar zapata rodriguez', 'edgar zapata'] },
  { nombre: 'ADRIANA RAMIREZ', aliases: ['adriana cecilia ramirez', 'adriana ramirez', 'cecilia ramirez'] },
];

export const ASESORES_CAROLINA: AsesorCobranzaConfig[] = [
  { nombre: 'ANGELA TORRES', aliases: ['angela rocio torres', 'angela torres', 'rocio torres'] },
  { nombre: 'CAROLINA SANCHEZ', aliases: ['carolina sanchez pachon', 'carolina sanchez'] },
  { nombre: 'DIANA CASTRO', aliases: ['diana catalina castro', 'diana castro', 'catalina castro'] },
  { nombre: 'FREDY PEÑA', aliases: ['freddy andres pena', 'fredy pena', 'andres pena', 'freddy pena'] },
  { nombre: 'GINA GARCIA', aliases: ['gina paola garcia', 'gina garcia', 'paola garcia'] },
  { nombre: 'JHONATHAN ACEVEDO', aliases: ['jhonatan steven acevedo', 'jhonathan acevedo', 'jhonatan acevedo', 'steven acevedo'] },
  { nombre: 'JULIETH GALINDO', aliases: ['julieth milena galindo', 'julieth galindo', 'milena galindo'] },
  { nombre: 'LINGTON LINARES', aliases: ['lington linares linares', 'lington linares'] },
  { nombre: 'MARIA ALEJANDRA VELASQUEZ', aliases: ['maria alejandra velasquez', 'alejandra velasquez'] },
  { nombre: 'MARIA ANGELICA ALVAREZ', aliases: ['maria angelica alvarez', 'angelica alvarez'] },
  { nombre: 'MARIA ANGELICA CABALLERO', aliases: ['maria angelica caballero', 'angelica caballero'] },
  { nombre: 'MARIA EUGENIA CRUZ', aliases: ['maria eugenia cruz herrera', 'maria eugenia cruz', 'eugenia cruz'] },
  { nombre: 'MARIA PAOLA BRICEÑO', aliases: ['maria paola briceno', 'paola briceno', 'maria briceno'] },
  { nombre: 'MARIELA RAMIREZ', aliases: ['mariela ramirez castro', 'mariela ramirez'] },
  { nombre: 'RAFAEL NOVOA', aliases: ['rafael francisco novoa', 'rafael novoa', 'francisco novoa'] },
  { nombre: 'YEISON URREGO', aliases: ['yeison alonso urrego', 'yeison urrego', 'alonso urrego'] },
  { nombre: 'GIOVANNY HERRERA', aliases: ['jair yovanny herrea', 'yovanny herrera', 'giovanny herrera', 'jair herrera', 'jair yovanny herrera'] },
  { nombre: 'ADRIANA CUCAITA', aliases: ['adriana cucaita bonilla', 'adriana cucaita'] },
  { nombre: 'OSCAR MORALES', aliases: ['oscar morales'] },
];

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAsesor(empName: string, list: AsesorCobranzaConfig[]): string | null {
  const normEmp = normalize(empName);
  if (!normEmp) return null;

  for (const item of list) {
    const normNombre = normalize(item.nombre);
    if (normEmp.includes(normNombre) || normNombre.includes(normEmp)) {
      return item.nombre;
    }
    for (const al of item.aliases) {
      const normAl = normalize(al);
      if (normEmp.includes(normAl) || normAl.includes(normEmp)) {
        return item.nombre;
      }
      const tokens = normAl.split(' ').filter((t) => t.length >= 3);
      if (tokens.length >= 2 && tokens.every((t) => normEmp.includes(t))) {
        return item.nombre;
      }
    }
  }

  return null;
}

export interface GestorCobranzaResult {
  gestor: GestorCobranzaNombre;
  gestorId: GestorCobranzaId;
  asesorCanonico: string;
  color: string;
  colorSecundario: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export function getGestorCobranza(empleado: string): GestorCobranzaResult {
  const matchedWilmer = matchAsesor(empleado, ASESORES_WILMER);
  if (matchedWilmer) {
    return {
      gestor: 'Wilmer Gualteros',
      gestorId: 'wilmer',
      asesorCanonico: matchedWilmer,
      color: '#E11D48', // Rose / Salmon corporativo
      colorSecundario: '#BE123C',
      badgeBg: '#FFE4E6',
      badgeText: '#9F1239',
      borderColor: '#FDA4AF',
    };
  }

  const matchedCarolina = matchAsesor(empleado, ASESORES_CAROLINA);
  if (matchedCarolina) {
    return {
      gestor: 'Carolina Sánchez',
      gestorId: 'carolina',
      asesorCanonico: matchedCarolina,
      color: '#0284C7', // Sky Blue corporativo
      colorSecundario: '#0369A1',
      badgeBg: '#E0F2FE',
      badgeText: '#0369A1',
      borderColor: '#7DD3FC',
    };
  }

  return {
    gestor: 'Sin Asignar / Otros',
    gestorId: 'otro',
    asesorCanonico: String(empleado || '').trim() || 'Sin Asignar',
    color: '#64748B',
    colorSecundario: '#475569',
    badgeBg: '#F1F5F9',
    badgeText: '#475569',
    borderColor: '#CBD5E1',
  };
}

export interface AsesorCobranzaStat {
  nombre: string;
  totalRecaudado: number;
  totalRecibos: number;
  totalFacturas: number;
  ultimaFechaRecaudo: string;
  porcentajeGestor: number;
  tieneRecaudo: boolean;
}

export interface GestorCobranzaStat {
  nombre: GestorCobranzaNombre;
  id: GestorCobranzaId;
  totalRecaudado: number;
  totalRecibos: number;
  totalFacturas: number;
  porcentajeGlobal: number;
  asesoresActivosCount: number;
  asesoresTotalCount: number;
  promedioRecibo: number;
  asesores: AsesorCobranzaStat[];
  color: string;
  colorSecundario: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export interface GestoresComparisonState {
  wilmer: GestorCobranzaStat;
  carolina: GestorCobranzaStat;
  otros: {
    totalRecaudado: number;
    totalRecibos: number;
    porcentajeGlobal: number;
  };
  totalGlobalRecaudado: number;
  totalGlobalRecibos: number;
  lider: 'wilmer' | 'carolina' | 'empate';
  diferenciaMonto: number;
  diferenciaPorcentaje: number;
  diferenciaRecibos: number;
}

/**
 * Calcula todas las métricas de gestión de cobranza comparativa
 * para una lista dada de ReciboCajaRecord.
 */
export function calculateGestoresComparison(recibos: ReciboCajaRecord[]): GestoresComparisonState {
  const totalGlobalRecaudado = recibos.reduce((s, r) => s + (r.Valor_Pagado || 0), 0);
  const totalGlobalRecibos = recibos.length;

  // Mapa de acumulación para Wilmer
  const wilmerMap = new Map<string, { total: number; recibos: number; facturas: Set<string>; ultimaFecha: string }>();
  ASESORES_WILMER.forEach((a) => {
    wilmerMap.set(a.nombre, { total: 0, recibos: 0, facturas: new Set(), ultimaFecha: '' });
  });

  // Mapa de acumulación para Carolina
  const carolinaMap = new Map<string, { total: number; recibos: number; facturas: Set<string>; ultimaFecha: string }>();
  ASESORES_CAROLINA.forEach((a) => {
    carolinaMap.set(a.nombre, { total: 0, recibos: 0, facturas: new Set(), ultimaFecha: '' });
  });

  let otrosTotal = 0;
  let otrosRecibos = 0;

  recibos.forEach((r) => {
    const val = r.Valor_Pagado || 0;
    const facturaKey = `${r.Prefijo_FacturaVenta || 'FVE'}-${r.Numero_FacturaVenta}`;
    const fecha = r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '';
    const res = getGestorCobranza(r.Nombre_Empleado);

    if (res.gestorId === 'wilmer') {
      const cur = wilmerMap.get(res.asesorCanonico) || { total: 0, recibos: 0, facturas: new Set(), ultimaFecha: '' };
      cur.total += val;
      cur.recibos += 1;
      if (r.Numero_FacturaVenta > 0) cur.facturas.add(facturaKey);
      if (fecha && (!cur.ultimaFecha || fecha > cur.ultimaFecha)) cur.ultimaFecha = fecha;
      wilmerMap.set(res.asesorCanonico, cur);
    } else if (res.gestorId === 'carolina') {
      const cur = carolinaMap.get(res.asesorCanonico) || { total: 0, recibos: 0, facturas: new Set(), ultimaFecha: '' };
      cur.total += val;
      cur.recibos += 1;
      if (r.Numero_FacturaVenta > 0) cur.facturas.add(facturaKey);
      if (fecha && (!cur.ultimaFecha || fecha > cur.ultimaFecha)) cur.ultimaFecha = fecha;
      carolinaMap.set(res.asesorCanonico, cur);
    } else {
      otrosTotal += val;
      otrosRecibos += 1;
    }
  });

  // Consolidar Wilmer
  let wilmerTotalRecaudado = 0;
  let wilmerTotalRecibos = 0;
  const wilmerFacturasSet = new Set<string>();

  const wilmerAsesoresList: AsesorCobranzaStat[] = [];
  wilmerMap.forEach((data, nombre) => {
    wilmerTotalRecaudado += data.total;
    wilmerTotalRecibos += data.recibos;
    data.facturas.forEach((f) => wilmerFacturasSet.add(f));

    wilmerAsesoresList.push({
      nombre,
      totalRecaudado: data.total,
      totalRecibos: data.recibos,
      totalFacturas: data.facturas.size,
      ultimaFechaRecaudo: data.ultimaFecha,
      porcentajeGestor: 0, // calculado abajo
      tieneRecaudo: data.recibos > 0,
    });
  });

  wilmerAsesoresList.forEach((a) => {
    a.porcentajeGestor = wilmerTotalRecaudado > 0 ? (a.totalRecaudado / wilmerTotalRecaudado) * 100 : 0;
  });
  // Ordenar por mayor recaudo
  wilmerAsesoresList.sort((a, b) => b.totalRecaudado - a.totalRecaudado);

  const wilmerActivosCount = wilmerAsesoresList.filter((a) => a.totalRecibos > 0).length;

  // Consolidar Carolina
  let carolinaTotalRecaudado = 0;
  let carolinaTotalRecibos = 0;
  const carolinaFacturasSet = new Set<string>();

  const carolinaAsesoresList: AsesorCobranzaStat[] = [];
  carolinaMap.forEach((data, nombre) => {
    carolinaTotalRecaudado += data.total;
    carolinaTotalRecibos += data.recibos;
    data.facturas.forEach((f) => carolinaFacturasSet.add(f));

    carolinaAsesoresList.push({
      nombre,
      totalRecaudado: data.total,
      totalRecibos: data.recibos,
      totalFacturas: data.facturas.size,
      ultimaFechaRecaudo: data.ultimaFecha,
      porcentajeGestor: 0, // calculado abajo
      tieneRecaudo: data.recibos > 0,
    });
  });

  carolinaAsesoresList.forEach((a) => {
    a.porcentajeGestor = carolinaTotalRecaudado > 0 ? (a.totalRecaudado / carolinaTotalRecaudado) * 100 : 0;
  });
  // Ordenar por mayor recaudo
  carolinaAsesoresList.sort((a, b) => b.totalRecaudado - a.totalRecaudado);

  const carolinaActivosCount = carolinaAsesoresList.filter((a) => a.totalRecibos > 0).length;

  // Participaciones globales
  const wilmerPctGlobal = totalGlobalRecaudado > 0 ? (wilmerTotalRecaudado / totalGlobalRecaudado) * 100 : 0;
  const carolinaPctGlobal = totalGlobalRecaudado > 0 ? (carolinaTotalRecaudado / totalGlobalRecaudado) * 100 : 0;
  const otrosPctGlobal = totalGlobalRecaudado > 0 ? (otrosTotal / totalGlobalRecaudado) * 100 : 0;

  // Determinar Líder
  let lider: 'wilmer' | 'carolina' | 'empate' = 'empate';
  let diffMonto = 0;
  let diffPct = 0;
  let diffRecibos = 0;

  if (wilmerTotalRecaudado > carolinaTotalRecaudado) {
    lider = 'wilmer';
    diffMonto = wilmerTotalRecaudado - carolinaTotalRecaudado;
    diffPct = carolinaTotalRecaudado > 0 ? ((diffMonto / carolinaTotalRecaudado) * 100) : 100;
    diffRecibos = wilmerTotalRecibos - carolinaTotalRecibos;
  } else if (carolinaTotalRecaudado > wilmerTotalRecaudado) {
    lider = 'carolina';
    diffMonto = carolinaTotalRecaudado - wilmerTotalRecaudado;
    diffPct = wilmerTotalRecaudado > 0 ? ((diffMonto / wilmerTotalRecaudado) * 100) : 100;
    diffRecibos = carolinaTotalRecibos - wilmerTotalRecibos;
  }

  const wilmerStat: GestorCobranzaStat = {
    nombre: 'Wilmer Gualteros',
    id: 'wilmer',
    totalRecaudado: wilmerTotalRecaudado,
    totalRecibos: wilmerTotalRecibos,
    totalFacturas: wilmerFacturasSet.size,
    porcentajeGlobal: wilmerPctGlobal,
    asesoresActivosCount: wilmerActivosCount,
    asesoresTotalCount: ASESORES_WILMER.length,
    promedioRecibo: wilmerTotalRecibos > 0 ? wilmerTotalRecaudado / wilmerTotalRecibos : 0,
    asesores: wilmerAsesoresList,
    color: '#E11D48',
    colorSecundario: '#BE123C',
    badgeBg: '#FFE4E6',
    badgeText: '#9F1239',
    borderColor: '#FDA4AF',
  };

  const carolinaStat: GestorCobranzaStat = {
    nombre: 'Carolina Sánchez',
    id: 'carolina',
    totalRecaudado: carolinaTotalRecaudado,
    totalRecibos: carolinaTotalRecibos,
    totalFacturas: carolinaFacturasSet.size,
    porcentajeGlobal: carolinaPctGlobal,
    asesoresActivosCount: carolinaActivosCount,
    asesoresTotalCount: ASESORES_CAROLINA.length,
    promedioRecibo: carolinaTotalRecibos > 0 ? carolinaTotalRecaudado / carolinaTotalRecibos : 0,
    asesores: carolinaAsesoresList,
    color: '#0284C7',
    colorSecundario: '#0369A1',
    badgeBg: '#E0F2FE',
    badgeText: '#0369A1',
    borderColor: '#7DD3FC',
  };

  return {
    wilmer: wilmerStat,
    carolina: carolinaStat,
    otros: {
      totalRecaudado: otrosTotal,
      totalRecibos: otrosRecibos,
      porcentajeGlobal: otrosPctGlobal,
    },
    totalGlobalRecaudado,
    totalGlobalRecibos,
    lider,
    diferenciaMonto: diffMonto,
    diferenciaPorcentaje: diffPct,
    diferenciaRecibos: diffRecibos,
  };
}
