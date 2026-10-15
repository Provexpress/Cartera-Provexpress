import type { Fill, Font } from 'exceljs';
import type {
  CarteraDataState,
  CarteraRecord,
  CustomerSummary,
  ExecutiveSummary,
  GroupSummary,
  NotaCreditoRecord,
  ReciboCajaRecord,
} from '../types';
import type { ClientContact } from './clientContactsStorage';

// ─── PALETAS Y ESTILOS CORPORATIVOS PROVEXPRESS SAS ─────────────────────────
const CURRENCY_FMT = '"$"#,##0;[Red]-"$"#,##0;"$0"';
const NUMBER_FMT = '#,##0';
const PERCENT_FMT = '0.0%';

const BORDER_THIN = {
  top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

const BORDER_TOTAL = {
  top: { style: 'thin' as const, color: { argb: 'FF0F172A' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'double' as const, color: { argb: 'FF0F172A' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

const THEMES = {
  navy: {
    primary: 'FF003366',
    accent: 'FF0071E3',
    headerFont: 'Calibri',
  },
  green: {
    primary: 'FF14532D',
    accent: 'FF15803D',
    headerFont: 'Calibri',
  },
  purple: {
    primary: 'FF581C87',
    accent: 'FF7E22CE',
    headerFont: 'Calibri',
  },
  slate: {
    primary: 'FF0F172A',
    accent: 'FF334155',
    headerFont: 'Calibri',
  },
};

/**
 * Aplica banner institucional superior con metadatos del informe
 */
function applyHeaderBanner(
  ws: any,
  config: {
    title: string;
    subtitle: string;
    lastColLetter: string;
    theme?: keyof typeof THEMES;
    statsText?: string;
  }
) {
  const theme = THEMES[config.theme || 'navy'];

  // Fila 2: Título institucional
  ws.mergeCells(`B2:${config.lastColLetter}2`);
  const titleCell = ws.getCell('B2');
  titleCell.value = `PROVEXPRESS S.A.S.  —  ${config.title.toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.primary } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 32;

  // Fila 3: Subtítulo con fecha y hora
  ws.mergeCells(`B3:${config.lastColLetter}3`);
  const subCell = ws.getCell('B3');
  const genDate = new Date().toLocaleString('es-CO');
  subCell.value = `${config.subtitle}  ·  Generado: ${genDate}${config.statsText ? `  ·  ${config.statsText}` : ''}`;
  subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(3).height = 20;

  ws.getRow(4).height = 10;
}

/**
 * Estiliza encabezados de tabla, filas con cebra, bordes y fijación de paneles
 */
function formatTableWorksheet(
  ws: any,
  config: {
    headerRow: number;
    dataStartRow: number;
    dataEndRow: number;
    colKeys: { key: string; isCurrency?: boolean; isNumber?: boolean; isPercent?: boolean; isDate?: boolean; isCenter?: boolean; isBold?: boolean }[];
    theme?: keyof typeof THEMES;
  }
) {
  const theme = THEMES[config.theme || 'navy'];

  // Congelar encabezados para scroll cómodo
  ws.views = [
    { state: 'frozen', xSplit: 0, ySplit: config.headerRow, showGridLines: true },
  ];

  // Encabezado
  const hRow = ws.getRow(config.headerRow);
  hRow.height = 26;
  hRow.eachCell((cell: any) => {
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.accent } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  // Datos con cebra y formato
  for (let r = config.dataStartRow; r <= config.dataEndRow; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    const isOdd = (r - config.dataStartRow) % 2 === 1;
    const rowBg = isOdd ? 'FFF8FAFC' : 'FFFFFFFF';

    config.colKeys.forEach(({ key, isCurrency, isNumber, isPercent, isDate, isCenter, isBold }) => {
      const cell = row.getCell(key);
      cell.border = BORDER_THIN;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Calibri', size: 10, bold: !!isBold };

      if (isCurrency) {
        cell.numFmt = CURRENCY_FMT;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (isNumber) {
        cell.numFmt = NUMBER_FMT;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (isPercent) {
        cell.numFmt = PERCENT_FMT;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (isDate || isCenter) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }
}

/**
 * Agrega fila de totales con doble subrayado
 */
function addTotalRow(
  ws: any,
  rowIndex: number,
  values: Record<string, number | string>,
  colKeys: string[],
  firstColLetter = 'B'
) {
  const row = ws.getRow(rowIndex);
  row.height = 24;

  colKeys.forEach((key, idx) => {
    const cell = row.getCell(key);
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };

    if (values[key] !== undefined) {
      cell.value = values[key];
      if (typeof values[key] === 'number') {
        cell.numFmt = CURRENCY_FMT;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    } else if (idx === 0) {
      cell.value = 'TOTALES';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });
}

// ─── 1. INFORME GENERAL DE CARTERA (4 HOJAS) ────────────────────────────────
export async function generateCarteraExcel(
  carteraData: CarteraDataState,
  records: CarteraRecord[],
  reportTitle = 'Informe_Cartera_Provexpress'
): Promise<{ buffer: ArrayBuffer; base64: string; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  // HOJA 1: RESUMEN EJECUTIVO
  const wsSummary = workbook.addWorksheet('Resumen Ejecutivo');
  wsSummary.views = [{ showGridLines: true }];

  applyHeaderBanner(wsSummary, {
    title: 'Tablero General de Cartera y Edades',
    subtitle: `Fecha de Corte ERP: ${carteraData.fechaCorte}`,
    lastColLetter: 'H',
    theme: 'navy',
  });

  const kpis = [
    ['Total Cartera General', carteraData.totalSaldo, CURRENCY_FMT],
    ['Cartera Corriente (Al día)', carteraData.totalCorriente, CURRENCY_FMT],
    ['Cartera Vencida', carteraData.totalVencido, CURRENCY_FMT],
    ['% Cartera Vencida', carteraData.porcentajeVencido / 100, PERCENT_FMT],
    ['Recaudos del Período', carteraData.totalRecaudosPeriodo, CURRENCY_FMT],
    ['Clientes Únicos con Saldo', carteraData.clientesUnicos, NUMBER_FMT],
    ['Total Documentos / Facturas', carteraData.totalDocumentos, NUMBER_FMT],
  ];

  let rIdx = 6;
  wsSummary.getCell(`B${rIdx}`).value = 'INDICADORES CLAVE DE GESTIÓN (KPIs)';
  wsSummary.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
  rIdx++;

  kpis.forEach(([lbl, val, fmt]) => {
    wsSummary.getCell(`B${rIdx}`).value = lbl;
    wsSummary.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 10 };
    wsSummary.getCell(`B${rIdx}`).border = BORDER_THIN;
    wsSummary.getCell(`C${rIdx}`).value = val;
    wsSummary.getCell(`C${rIdx}`).numFmt = fmt as string;
    wsSummary.getCell(`C${rIdx}`).font = { name: 'Calibri', size: 10, bold: true };
    wsSummary.getCell(`C${rIdx}`).border = BORDER_THIN;
    wsSummary.getCell(`C${rIdx}`).alignment = { horizontal: 'right' };
    rIdx++;
  });

  rIdx += 2;
  wsSummary.getCell(`B${rIdx}`).value = 'DISTRIBUCIÓN POR EDADES DE VENCIMIENTO';
  wsSummary.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
  rIdx++;

  const agingHeaders = ['Rango Antigüedad', 'Facturas', 'Saldo Total ($ COP)', '% Participación'];
  agingHeaders.forEach((h, i) => {
    const col = String.fromCharCode(66 + i);
    const c = wsSummary.getCell(`${col}${rIdx}`);
    c.value = h;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0071E3' } };
    c.alignment = { horizontal: i > 0 ? 'right' : 'left', vertical: 'middle' };
    c.border = BORDER_THIN;
  });
  rIdx++;

  carteraData.agingBreakdown.forEach((item) => {
    wsSummary.getCell(`B${rIdx}`).value = item.label;
    wsSummary.getCell(`B${rIdx}`).border = BORDER_THIN;
    wsSummary.getCell(`C${rIdx}`).value = item.count;
    wsSummary.getCell(`C${rIdx}`).numFmt = NUMBER_FMT;
    wsSummary.getCell(`C${rIdx}`).border = BORDER_THIN;
    wsSummary.getCell(`D${rIdx}`).value = item.totalValor;
    wsSummary.getCell(`D${rIdx}`).numFmt = CURRENCY_FMT;
    wsSummary.getCell(`D${rIdx}`).border = BORDER_THIN;
    wsSummary.getCell(`E${rIdx}`).value = item.percentage / 100;
    wsSummary.getCell(`E${rIdx}`).numFmt = PERCENT_FMT;
    wsSummary.getCell(`E${rIdx}`).border = BORDER_THIN;
    rIdx++;
  });

  wsSummary.columns = [
    { width: 4 },
    { width: 34 },
    { width: 22 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  // HOJA 2: DETALLE FACTURAS
  const wsDetail = workbook.addWorksheet('Detalle Facturas');
  const detailCols = [
    { header: 'Grupo', key: 'grupoNombre', width: 18 },
    { header: 'Director', key: 'directorNombre', width: 24 },
    { header: 'Ejecutivo Comercial', key: 'comercial', width: 28 },
    { header: 'NIT', key: 'nit', width: 15, isCenter: true },
    { header: 'Razón Social / Cliente', key: 'empresa', width: 34 },
    { header: 'Cupo Crédito', key: 'cupo', width: 16, isCurrency: true },
    { header: 'Estado', key: 'estado', width: 12, isCenter: true },
    { header: 'Plazo (Días)', key: 'plazo', width: 12, isNumber: true },
    { header: 'Tipo Doc', key: 'tipoDoc', width: 16, isCenter: true },
    { header: 'Prefijo', key: 'prefijo', width: 10, isCenter: true },
    { header: 'Número', key: 'numero', width: 12, isCenter: true },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14, isDate: true },
    { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 14, isDate: true },
    { header: 'Días Emisión', key: 'diasEmision', width: 12, isNumber: true },
    { header: 'Días Vencido', key: 'diasVencido', width: 12, isNumber: true },
    { header: 'Rango Antigüedad', key: 'rango', width: 18, isCenter: true },
    { header: 'Saldo Pendiente', key: 'saldo', width: 18, isCurrency: true, isBold: true },
  ];
  wsDetail.columns = detailCols;

  records.forEach((r) => {
    wsDetail.addRow({
      grupoNombre: r.grupoNombre,
      directorNombre: r.directorNombre,
      comercial: r.Nombre_Empleado,
      nit: r.Identificacion,
      empresa: r.Empresa,
      cupo: r.Cupo_Credito,
      estado: r.Estado_Cliente,
      plazo: r.Plazo_Pago,
      tipoDoc: r.Tipo_Documento,
      prefijo: r.Prefijo,
      numero: r.Numero,
      fechaEmision: r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '',
      fechaVencimiento: r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '',
      diasEmision: r.Dias_Emision,
      diasVencido: r.Dias_Vencimiento,
      rango: r.categoriaEdad === 'CORRIENTE' ? 'Corriente (0 d)' : r.Rango_Cartera || 'Vencido',
      saldo: r.Valor_Saldo,
    });
  });

  formatTableWorksheet(wsDetail, {
    headerRow: 1,
    dataStartRow: 2,
    dataEndRow: records.length + 1,
    colKeys: detailCols,
    theme: 'navy',
  });

  // Fila de Total
  const totalSaldoFac = records.reduce((sum, r) => sum + r.Valor_Saldo, 0);
  addTotalRow(
    wsDetail,
    records.length + 2,
    { saldo: totalSaldoFac },
    detailCols.map((c) => c.key)
  );

  // HOJA 3: RECIBOS DE CAJA
  const wsRecibos = workbook.addWorksheet('Recibos de Caja');
  const reciboCols = [
    { header: 'No. Recibo', key: 'recibo', width: 14, isCenter: true },
    { header: 'Fecha Recaudo', key: 'fechaRecaudo', width: 14, isDate: true },
    { header: 'NIT', key: 'nit', width: 15, isCenter: true },
    { header: 'Empresa / Cliente', key: 'empresa', width: 34 },
    { header: 'Factura Venta', key: 'factura', width: 16, isCenter: true },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14, isDate: true },
    { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 14, isDate: true },
    { header: 'Días Pago', key: 'diasPago', width: 12, isNumber: true },
    { header: 'Valor Factura', key: 'valorFactura', width: 18, isCurrency: true },
    { header: 'Valor Recaudado', key: 'valorPagado', width: 18, isCurrency: true, isBold: true },
    { header: 'Comercial', key: 'comercial', width: 28 },
    { header: 'Director', key: 'director', width: 24 },
  ];
  wsRecibos.columns = reciboCols;

  carteraData.recibos.forEach((rc) => {
    wsRecibos.addRow({
      recibo: `${rc.Prefijo_ReciboCaja} ${rc.Numero_ReciboCaja}`.trim(),
      fechaRecaudo: rc.Fecha_Recaudo ? rc.Fecha_Recaudo.split('T')[0] : '',
      nit: rc.Identificacion,
      empresa: rc.Empresa,
      factura: `${rc.Prefijo_FacturaVenta} ${rc.Numero_FacturaVenta}`.trim(),
      fechaEmision: rc.Fecha_Emision ? rc.Fecha_Emision.split('T')[0] : '',
      fechaVencimiento: rc.Fecha_Vencimiento ? rc.Fecha_Vencimiento.split('T')[0] : '',
      diasPago: rc.Dias_Pago,
      valorFactura: rc.Valor_Factura,
      valorPagado: rc.Valor_Pagado,
      comercial: rc.Nombre_Empleado,
      director: rc.directorNombre,
    });
  });

  formatTableWorksheet(wsRecibos, {
    headerRow: 1,
    dataStartRow: 2,
    dataEndRow: carteraData.recibos.length + 1,
    colKeys: reciboCols,
    theme: 'green',
  });

  const totalRecibosSum = carteraData.recibos.reduce((sum, r) => sum + r.Valor_Pagado, 0);
  const totalFacturasRecibos = carteraData.recibos.reduce((sum, r) => sum + r.Valor_Factura, 0);
  addTotalRow(
    wsRecibos,
    carteraData.recibos.length + 2,
    { valorFactura: totalFacturasRecibos, valorPagado: totalRecibosSum },
    reciboCols.map((c) => c.key)
  );

  // HOJA 4: NOTAS CRÉDITO
  const wsNotas = workbook.addWorksheet('Notas Crédito');
  const notasCols = [
    { header: 'Nota Crédito', key: 'nota', width: 16, isCenter: true },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14, isDate: true },
    { header: 'NIT', key: 'nit', width: 15, isCenter: true },
    { header: 'Empresa / Cliente', key: 'empresa', width: 34 },
    { header: 'Valor Nota Crédito', key: 'valor', width: 20, isCurrency: true, isBold: true },
    { header: 'Factura Afectada', key: 'factura', width: 16, isCenter: true },
    { header: 'Comercial', key: 'comercial', width: 28 },
    { header: 'Director', key: 'director', width: 24 },
  ];
  wsNotas.columns = notasCols;

  carteraData.notas.forEach((nc) => {
    wsNotas.addRow({
      nota: `${nc.Prefijo} ${nc.Numero}`.trim(),
      fechaEmision: nc.Fecha_Emision ? nc.Fecha_Emision.split('T')[0] : '',
      nit: nc.Identificacion,
      empresa: nc.Empresa,
      valor: nc.Valor_NotaCredito,
      factura: nc.Numero_Factura > 0 ? `${nc.Prefijo_Factura} ${nc.Numero_Factura}`.trim() : 'General',
      comercial: nc.Nombre_Empleado,
      director: nc.directorNombre,
    });
  });

  formatTableWorksheet(wsNotas, {
    headerRow: 1,
    dataStartRow: 2,
    dataEndRow: carteraData.notas.length + 1,
    colKeys: notasCols,
    theme: 'purple',
  });

  const totalNotasSum = carteraData.notas.reduce((sum, n) => sum + n.Valor_NotaCredito, 0);
  addTotalRow(
    wsNotas,
    carteraData.notas.length + 2,
    { valor: totalNotasSum },
    notasCols.map((c) => c.key)
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
  const cleanDate = carteraData.fechaCorte.replace(/-/g, '');
  const filename = `${reportTitle}_${cleanDate}.xlsx`;

  return { buffer, base64, filename };
}

// ─── 2. INFORME OFICIAL DE RECIBOS DE CAJA ──────────────────────────────────
export async function generateRecibosCajaExcel(
  recibos: ReciboCajaRecord[],
  breakdownByDirector: { director: string; total: number; count: number; pct: number }[] = [],
  preset = 'mes'
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  const totalRecaudado = recibos.reduce((sum, r) => sum + r.Valor_Pagado, 0);
  const totalFacturado = recibos.reduce((sum, r) => sum + r.Valor_Factura, 0);

  // HOJA 1: DETALLE DE RECIBOS
  const ws = workbook.addWorksheet('Recibos de Caja');
  applyHeaderBanner(ws, {
    title: 'Informe Oficial de Recibos de Caja y Recaudos',
    subtitle: `Período: ${preset.toUpperCase()} · Total Recibos: ${recibos.length}`,
    statsText: `Recaudado: $ ${totalRecaudado.toLocaleString('es-CO')}`,
    lastColLetter: 'N',
    theme: 'green',
  });

  const cols = [
    { header: 'No. Recibo', key: 'rc', width: 14, isCenter: true },
    { header: 'Fecha Recaudo', key: 'fechaRecaudo', width: 14, isDate: true },
    { header: 'Factura Aplicada', key: 'factura', width: 16, isCenter: true },
    { header: 'Fecha Emisión Fac', key: 'fechaEmision', width: 14, isDate: true },
    { header: 'Fecha Venc Fac', key: 'fechaVenc', width: 14, isDate: true },
    { header: 'NIT / CC', key: 'nit', width: 16, isCenter: true },
    { header: 'Cliente / Razón Social', key: 'cliente', width: 34 },
    { header: 'Asesor Comercial', key: 'comercial', width: 26 },
    { header: 'Gestor Cartera', key: 'gestorCartera', width: 22, isCenter: true },
    { header: 'Director Comercial', key: 'director', width: 26 },
    { header: 'Días Pago', key: 'diasPago', width: 12, isNumber: true },
    { header: 'Valor Factura', key: 'valorFactura', width: 18, isCurrency: true },
    { header: 'Valor Recaudado', key: 'valorPagado', width: 18, isCurrency: true, isBold: true },
    { header: 'Estado Recaudo', key: 'estado', width: 18, isCenter: true },
  ];

  // Inserción en fila 5
  const headerRowIdx = 5;
  const hRow = ws.getRow(headerRowIdx);
  cols.forEach((col, idx) => {
    const cell = hRow.getCell(idx + 1);
    cell.value = col.header;
  });
  cols.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width;
    ws.getColumn(idx + 1).key = col.key;
  });

  recibos.forEach((r) => {
    const isSaldada = r.Valor_Pagado >= r.Valor_Factura && r.Valor_Factura > 0;
    ws.addRow({
      rc: `RC-${r.Numero_ReciboCaja}`,
      fechaRecaudo: r.Fecha_Recaudo ? r.Fecha_Recaudo.split('T')[0] : '',
      factura: `${r.Prefijo_FacturaVenta || 'FVE'} ${r.Numero_FacturaVenta}`,
      fechaEmision: r.Fecha_Emision ? r.Fecha_Emision.split('T')[0] : '',
      fechaVenc: r.Fecha_Vencimiento ? r.Fecha_Vencimiento.split('T')[0] : '',
      nit: r.Identificacion,
      cliente: r.Empresa,
      comercial: r.Nombre_Empleado,
      gestorCartera: r.gestorCartera || 'Sin Asignar',
      director: r.directorNombre || 'Sin Asignar',
      diasPago: r.Dias_Pago,
      valorFactura: r.Valor_Factura,
      valorPagado: r.Valor_Pagado,
      estado: isSaldada ? '100% RECAUDADA' : 'ABONO PARCIAL',
    });
  });

  const dataStart = headerRowIdx + 1;
  const dataEnd = headerRowIdx + recibos.length;
  formatTableWorksheet(ws, {
    headerRow: headerRowIdx,
    dataStartRow: dataStart,
    dataEndRow: dataEnd,
    colKeys: cols,
    theme: 'green',
  });

  addTotalRow(
    ws,
    dataEnd + 1,
    { valorFactura: totalFacturado, valorPagado: totalRecaudado },
    cols.map((c) => c.key),
    'A'
  );

  // HOJA 2: DESGLOSE POR DIRECTOR COMERCIAL
  if (breakdownByDirector.length > 0) {
    const wsDir = workbook.addWorksheet('Desglose por Director');
    applyHeaderBanner(wsDir, {
      title: 'Recaudo por Director Comercial',
      subtitle: `Consolidado de Gestión de Cobro · Total: $ ${totalRecaudado.toLocaleString('es-CO')}`,
      lastColLetter: 'E',
      theme: 'green',
    });

    const dirCols = [
      { header: 'Director Comercial', key: 'director', width: 32 },
      { header: 'No. Recibos', key: 'count', width: 16, isNumber: true },
      { header: 'Total Recaudado', key: 'total', width: 22, isCurrency: true, isBold: true },
      { header: '% Participación', key: 'pct', width: 18, isPercent: true },
    ];

    const dHRow = wsDir.getRow(5);
    dirCols.forEach((col, idx) => {
      dHRow.getCell(idx + 1).value = col.header;
      wsDir.getColumn(idx + 1).width = col.width;
      wsDir.getColumn(idx + 1).key = col.key;
    });

    breakdownByDirector.forEach((d) => {
      wsDir.addRow({
        director: d.director,
        count: d.count,
        total: d.total,
        pct: d.pct / 100,
      });
    });

    formatTableWorksheet(wsDir, {
      headerRow: 5,
      dataStartRow: 6,
      dataEndRow: 5 + breakdownByDirector.length,
      colKeys: dirCols,
      theme: 'green',
    });

    addTotalRow(
      wsDir,
      6 + breakdownByDirector.length,
      {
        director: 'TOTAL GENERAL',
        count: breakdownByDirector.reduce((s, d) => s + d.count, 0),
        total: totalRecaudado,
      },
      dirCols.map((c) => c.key),
      'A'
    );
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Recibos_Caja_Provexpress_${preset}_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── 3. INFORME DE NOTAS CRÉDITO ────────────────────────────────────────────
export async function generateNotasCreditoExcel(
  notas: NotaCreditoRecord[],
  preset = 'general'
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  const totalNotas = notas.reduce((sum, n) => sum + n.Valor_NotaCredito, 0);

  const ws = workbook.addWorksheet('Notas Crédito');
  applyHeaderBanner(ws, {
    title: 'Informe Oficial de Notas Crédito y Descuentos',
    subtitle: `Total Registros: ${notas.length}`,
    statsText: `Valor Total Notas: $ ${totalNotas.toLocaleString('es-CO')}`,
    lastColLetter: 'I',
    theme: 'purple',
  });

  const cols = [
    { header: '#', key: 'rank', width: 6, isCenter: true },
    { header: 'No. Nota Crédito', key: 'nota', width: 18, isCenter: true },
    { header: 'Factura Afectada', key: 'factura', width: 18, isCenter: true },
    { header: 'Fecha Emisión', key: 'fecha', width: 16, isDate: true },
    { header: 'Cliente / Razón Social', key: 'empresa', width: 36 },
    { header: 'NIT', key: 'nit', width: 15, isCenter: true },
    { header: 'Director Comercial', key: 'director', width: 28 },
    { header: 'Asesor Comercial', key: 'asesor', width: 30 },
    { header: 'Valor Nota Crédito', key: 'valor', width: 20, isCurrency: true, isBold: true },
  ];

  const headerRowIdx = 5;
  const hRow = ws.getRow(headerRowIdx);
  cols.forEach((col, idx) => {
    hRow.getCell(idx + 1).value = col.header;
    ws.getColumn(idx + 1).width = col.width;
    ws.getColumn(idx + 1).key = col.key;
  });

  notas.forEach((nc, idx) => {
    ws.addRow({
      rank: idx + 1,
      nota: `${nc.Prefijo || 'NCE'} ${nc.Numero}`.trim(),
      factura: nc.Numero_Factura > 0 ? `${nc.Prefijo_Factura || 'FVE'} ${nc.Numero_Factura}`.trim() : 'Ajuste General',
      fecha: nc.Fecha_Emision ? nc.Fecha_Emision.split('T')[0] : '',
      empresa: nc.Empresa,
      nit: nc.Identificacion,
      director: nc.directorNombre || 'Sin Asignar',
      asesor: nc.Nombre_Empleado,
      valor: nc.Valor_NotaCredito,
    });
  });

  const dataStart = headerRowIdx + 1;
  const dataEnd = headerRowIdx + notas.length;
  formatTableWorksheet(ws, {
    headerRow: headerRowIdx,
    dataStartRow: dataStart,
    dataEndRow: dataEnd,
    colKeys: cols,
    theme: 'purple',
  });

  addTotalRow(
    ws,
    dataEnd + 1,
    { valor: totalNotas },
    cols.map((c) => c.key),
    'A'
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Notas_Credito_Provexpress_${preset}_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── 4. INFORME DE EVOLUCIÓN BASE 06/10 ──────────────────────────────────────
export async function generateEvolucionBaseExcel(
  records: CarteraRecord[],
  invoiceRecibosMap: Map<string, ReciboCajaRecord[]>,
  fechaBase = '2026-10-06'
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  const totalSaldo = records.reduce((sum, r) => sum + r.Valor_Saldo, 0);

  const ws = workbook.addWorksheet('Base Inicial 06-10');
  applyHeaderBanner(ws, {
    title: 'Evolución de Cartera - Base Inicial Fija (06/10)',
    subtitle: `Fecha de Corte Base: ${fechaBase} · Universo Total: ${records.length} Facturas`,
    statsText: `Saldo Base: $ ${totalSaldo.toLocaleString('es-CO')}`,
    lastColLetter: 'L',
    theme: 'purple',
  });

  const cols = [
    { header: '#', key: 'rank', width: 6, isCenter: true },
    { header: 'No. Factura', key: 'factura', width: 16, isCenter: true },
    { header: 'Cliente / Empresa', key: 'empresa', width: 34 },
    { header: 'NIT', key: 'nit', width: 14, isCenter: true },
    { header: 'Comercial Asesor', key: 'comercial', width: 28 },
    { header: 'Director Comercial', key: 'director', width: 26 },
    { header: 'Saldo Cartera', key: 'saldo', width: 18, isCurrency: true, isBold: true },
    { header: 'Estado Cobro', key: 'estado', width: 18, isCenter: true },
    { header: 'Categoría Edad', key: 'edad', width: 16, isCenter: true },
    { header: 'Días Vencido', key: 'dias', width: 14, isNumber: true },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14, isDate: true },
    { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 14, isDate: true },
  ];

  const headerRowIdx = 5;
  const hRow = ws.getRow(headerRowIdx);
  cols.forEach((col, idx) => {
    hRow.getCell(idx + 1).value = col.header;
    ws.getColumn(idx + 1).width = col.width;
    ws.getColumn(idx + 1).key = col.key;
  });

  records.forEach((r, idx) => {
    const key = `${r.Prefijo}-${r.Numero}`.trim().toLowerCase();
    const rcs = invoiceRecibosMap.get(key) || [];
    const isKilled = rcs.some((rc) => rc.Valor_Pagado >= rc.Valor_Factura) || r.Valor_Saldo === 0;

    ws.addRow({
      rank: idx + 1,
      factura: `${r.Prefijo} ${r.Numero}`.trim(),
      empresa: r.Empresa,
      nit: r.Identificacion,
      comercial: r.Nombre_Empleado,
      director: r.directorNombre,
      saldo: r.Valor_Saldo,
      estado: isKilled ? '100% RECAUDADA' : 'PENDIENTE',
      edad: r.categoriaEdad,
      dias: r.Dias_Vencimiento,
      fechaEmision: r.Fecha_Emision?.split('T')[0] || '',
      fechaVencimiento: r.Fecha_Vencimiento?.split('T')[0] || '',
    });
  });

  const dataStart = headerRowIdx + 1;
  const dataEnd = headerRowIdx + records.length;
  formatTableWorksheet(ws, {
    headerRow: headerRowIdx,
    dataStartRow: dataStart,
    dataEndRow: dataEnd,
    colKeys: cols,
    theme: 'purple',
  });

  addTotalRow(
    ws,
    dataEnd + 1,
    { saldo: totalSaldo },
    cols.map((c) => c.key),
    'A'
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Cartera_Base_Inicial_06_Octubre_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── 5. INFORME DE GESTIÓN DÍA A DÍA ────────────────────────────────────────
export async function generateGestionDiaADiaExcel(
  activeTab: 'salientes' | 'entrantes' | 'vivas',
  currentList: any[]
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  const isSalientes = activeTab === 'salientes';
  const sheetName = isSalientes ? 'Facturas Recaudadas' : activeTab === 'entrantes' ? 'Nuevas Facturas' : 'Total Cartera Viva';
  const themeKey = isSalientes ? 'green' : activeTab === 'entrantes' ? 'navy' : 'slate';

  const ws = workbook.addWorksheet(sheetName);
  applyHeaderBanner(ws, {
    title: `Gestión Operativa Día a Día — ${sheetName}`,
    subtitle: `Registros: ${currentList.length}`,
    lastColLetter: isSalientes ? 'M' : 'K',
    theme: themeKey as any,
  });

  const cols = isSalientes
    ? [
        { header: '#', key: 'rank', width: 6, isCenter: true },
        { header: 'No. Factura', key: 'factura', width: 16, isCenter: true },
        { header: 'No. Recibo Caja', key: 'recibo', width: 16, isCenter: true },
        { header: 'Cliente / Empresa', key: 'empresa', width: 34 },
        { header: 'NIT', key: 'nit', width: 14, isCenter: true },
        { header: 'Comercial Asesor', key: 'comercial', width: 28 },
        { header: 'Director Comercial', key: 'director', width: 26 },
        { header: 'Vr. Factura', key: 'vrFactura', width: 18, isCurrency: true },
        { header: 'Vr. Pagado (Recaudo)', key: 'vrPagado', width: 20, isCurrency: true, isBold: true },
        { header: 'Estado', key: 'estado', width: 20, isCenter: true },
        { header: 'Fecha Emisión', key: 'fechaEmision', width: 14, isDate: true },
        { header: 'Fecha Recaudo', key: 'fechaRecaudo', width: 14, isDate: true },
        { header: 'Días Pago', key: 'diasPago', width: 12, isNumber: true },
      ]
    : [
        { header: '#', key: 'rank', width: 6, isCenter: true },
        { header: 'No. Factura', key: 'factura', width: 16, isCenter: true },
        { header: 'Cliente / Empresa', key: 'empresa', width: 34 },
        { header: 'NIT', key: 'nit', width: 14, isCenter: true },
        { header: 'Comercial Asesor', key: 'comercial', width: 28 },
        { header: 'Director Comercial', key: 'director', width: 26 },
        { header: 'Saldo Cartera', key: 'saldo', width: 18, isCurrency: true, isBold: true },
        { header: 'Categoría Edad', key: 'edad', width: 16, isCenter: true },
        { header: 'Días Vencido', key: 'dias', width: 14, isNumber: true },
        { header: 'Fecha Emisión', key: 'fechaEmision', width: 14, isDate: true },
        { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 14, isDate: true },
      ];

  const headerRowIdx = 5;
  const hRow = ws.getRow(headerRowIdx);
  cols.forEach((col, idx) => {
    hRow.getCell(idx + 1).value = col.header;
    ws.getColumn(idx + 1).width = col.width;
    ws.getColumn(idx + 1).key = col.key;
  });

  if (isSalientes) {
    (currentList as ReciboCajaRecord[]).forEach((rc, idx) => {
      const isKilled = rc.Valor_Pagado >= rc.Valor_Factura && rc.Valor_Factura > 0;
      ws.addRow({
        rank: idx + 1,
        factura: `${rc.Prefijo_FacturaVenta} ${rc.Numero_FacturaVenta}`.trim(),
        recibo: `RC-${rc.Numero_ReciboCaja}`,
        empresa: rc.Empresa,
        nit: rc.Identificacion,
        comercial: rc.Nombre_Empleado,
        director: rc.directorNombre,
        vrFactura: rc.Valor_Factura,
        vrPagado: rc.Valor_Pagado,
        estado: isKilled ? '100% RECAUDADA' : 'ABONO PARCIAL',
        fechaEmision: rc.Fecha_Emision?.split('T')[0] || '',
        fechaRecaudo: rc.Fecha_Recaudo?.split('T')[0] || '',
        diasPago: rc.Dias_Pago,
      });
    });
  } else {
    (currentList as CarteraRecord[]).forEach((r, idx) => {
      ws.addRow({
        rank: idx + 1,
        factura: `${r.Prefijo} ${r.Numero}`.trim(),
        empresa: r.Empresa,
        nit: r.Identificacion,
        comercial: r.Nombre_Empleado,
        director: r.directorNombre,
        saldo: r.Valor_Saldo,
        edad: r.categoriaEdad,
        dias: r.Dias_Vencimiento,
        fechaEmision: r.Fecha_Emision?.split('T')[0] || '',
        fechaVencimiento: r.Fecha_Vencimiento?.split('T')[0] || '',
      });
    });
  }

  const dataStart = headerRowIdx + 1;
  const dataEnd = headerRowIdx + currentList.length;
  formatTableWorksheet(ws, {
    headerRow: headerRowIdx,
    dataStartRow: dataStart,
    dataEndRow: dataEnd,
    colKeys: cols,
    theme: themeKey as any,
  });

  if (isSalientes) {
    const totRec = (currentList as ReciboCajaRecord[]).reduce((s, r) => s + r.Valor_Pagado, 0);
    const totFac = (currentList as ReciboCajaRecord[]).reduce((s, r) => s + r.Valor_Factura, 0);
    addTotalRow(ws, dataEnd + 1, { vrFactura: totFac, vrPagado: totRec }, cols.map((c) => c.key), 'A');
  } else {
    const totSal = (currentList as CarteraRecord[]).reduce((s, r) => s + r.Valor_Saldo, 0);
    addTotalRow(ws, dataEnd + 1, { saldo: totSal }, cols.map((c) => c.key), 'A');
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Gestion_Dia_a_Dia_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── 6. INFORME DE ESTRUCTURA COMERCIAL Y GRUPOS ────────────────────────────
export async function generateGroupsExcel(
  groups: GroupSummary[],
  executives: ExecutiveSummary[],
  specificGroup?: GroupSummary
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  const groupsToExport = specificGroup ? [specificGroup] : groups;
  const execsToExport = specificGroup
    ? executives.filter((e) => e.grupo === specificGroup.grupo)
    : executives;

  // HOJA 1: RESUMEN DE GRUPOS
  const wsGroups = workbook.addWorksheet('Resumen Grupos');
  applyHeaderBanner(wsGroups, {
    title: specificGroup ? `Estructura Comercial — ${specificGroup.grupoNombre}` : 'Estructura Comercial y Grupos de Cartera',
    subtitle: specificGroup ? `Director: ${specificGroup.directorNombre}` : 'Supervisión Consolidada por Directores Comerciales',
    lastColLetter: 'H',
    theme: 'navy',
  });

  const grpCols = [
    { header: 'Grupo Comercial', key: 'grupoNombre', width: 24 },
    { header: 'Director Responsable', key: 'directorNombre', width: 28 },
    { header: 'Clientes Únicos', key: 'clientes', width: 16, isNumber: true },
    { header: 'Total Facturas', key: 'docs', width: 16, isNumber: true },
    { header: 'Saldo Total', key: 'totalSaldo', width: 20, isCurrency: true, isBold: true },
    { header: 'Saldo Corriente', key: 'corriente', width: 18, isCurrency: true },
    { header: 'Saldo Vencido', key: 'vencido', width: 18, isCurrency: true },
    { header: '% Vencido', key: 'pctVencido', width: 16, isPercent: true },
  ];

  const gHRow = wsGroups.getRow(5);
  grpCols.forEach((col, idx) => {
    gHRow.getCell(idx + 1).value = col.header;
    wsGroups.getColumn(idx + 1).width = col.width;
    wsGroups.getColumn(idx + 1).key = col.key;
  });

  groupsToExport.forEach((g) => {
    wsGroups.addRow({
      grupoNombre: g.grupoNombre,
      directorNombre: g.directorNombre,
      clientes: g.clientesCount,
      docs: g.docCount,
      totalSaldo: g.totalSaldo,
      corriente: g.totalCorriente,
      vencido: g.totalVencido,
      pctVencido: g.porcentajeVencido / 100,
    });
  });

  formatTableWorksheet(wsGroups, {
    headerRow: 5,
    dataStartRow: 6,
    dataEndRow: 5 + groupsToExport.length,
    colKeys: grpCols,
    theme: 'navy',
  });

  const totGrpSaldo = groupsToExport.reduce((s, g) => s + g.totalSaldo, 0);
  const totGrpCorr = groupsToExport.reduce((s, g) => s + g.totalCorriente, 0);
  const totGrpVenc = groupsToExport.reduce((s, g) => s + g.totalVencido, 0);
  addTotalRow(
    wsGroups,
    6 + groupsToExport.length,
    {
      grupoNombre: 'TOTAL CONSOLIDADO',
      clientes: groupsToExport.reduce((s, g) => s + g.clientesCount, 0),
      docs: groupsToExport.reduce((s, g) => s + g.docCount, 0),
      totalSaldo: totGrpSaldo,
      corriente: totGrpCorr,
      vencido: totGrpVenc,
    },
    grpCols.map((c) => c.key),
    'A'
  );

  // HOJA 2: FUERZA DE VENTAS (EJECUTIVOS)
  const wsExecs = workbook.addWorksheet('Fuerza de Ventas');
  applyHeaderBanner(wsExecs, {
    title: 'Desglose por Ejecutivo Comercial',
    subtitle: `Total Asesores: ${execsToExport.length}`,
    lastColLetter: 'H',
    theme: 'navy',
  });

  const execCols = [
    { header: 'Grupo', key: 'grupoNombre', width: 22 },
    { header: 'Director', key: 'directorNombre', width: 26 },
    { header: 'Ejecutivo Comercial', key: 'nombre', width: 30 },
    { header: 'Facturas', key: 'docCount', width: 14, isNumber: true },
    { header: 'Saldo Total', key: 'totalSaldo', width: 20, isCurrency: true, isBold: true },
    { header: 'Saldo Corriente', key: 'corriente', width: 18, isCurrency: true },
    { header: 'Saldo Vencido', key: 'vencido', width: 18, isCurrency: true },
    { header: '% Vencido', key: 'pctVencido', width: 16, isPercent: true },
  ];

  const eHRow = wsExecs.getRow(5);
  execCols.forEach((col, idx) => {
    eHRow.getCell(idx + 1).value = col.header;
    wsExecs.getColumn(idx + 1).width = col.width;
    wsExecs.getColumn(idx + 1).key = col.key;
  });

  execsToExport.forEach((e) => {
    wsExecs.addRow({
      grupoNombre: e.grupoNombre,
      directorNombre: e.directorNombre,
      nombre: e.nombre,
      docCount: e.docCount,
      totalSaldo: e.totalSaldo,
      corriente: e.totalCorriente,
      vencido: e.totalVencido,
      pctVencido: e.porcentajeVencido / 100,
    });
  });

  formatTableWorksheet(wsExecs, {
    headerRow: 5,
    dataStartRow: 6,
    dataEndRow: 5 + execsToExport.length,
    colKeys: execCols,
    theme: 'navy',
  });

  const totExecSaldo = execsToExport.reduce((s, e) => s + e.totalSaldo, 0);
  const totExecCorr = execsToExport.reduce((s, e) => s + e.totalCorriente, 0);
  const totExecVenc = execsToExport.reduce((s, e) => s + e.totalVencido, 0);
  addTotalRow(
    wsExecs,
    6 + execsToExport.length,
    {
      grupoNombre: 'TOTAL FUERZA VENTAS',
      docCount: execsToExport.reduce((s, e) => s + e.docCount, 0),
      totalSaldo: totExecSaldo,
      corriente: totExecCorr,
      vencido: totExecVenc,
    },
    execCols.map((c) => c.key),
    'A'
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = specificGroup
    ? `Grupo_${specificGroup.grupoNombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
    : `Estructura_Comercial_Provexpress_${new Date().toISOString().split('T')[0]}.xlsx`;

  return { buffer, filename };
}

// ─── 7. INFORME DE GESTORES DE COBRANZA (WILMER VS CAROLINA) ───────────────
export async function generateGestoresCobranzaExcel(
  wilmer: any,
  carolina: any
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  // HOJA 1: RESUMEN COMPARATIVO
  const wsResumen = workbook.addWorksheet('Resumen Gestores');
  applyHeaderBanner(wsResumen, {
    title: 'Gestión y Recaudos por Gestor de Cartera',
    subtitle: 'Comparativo Wilmer Gualteros vs. Carolina Sánchez',
    lastColLetter: 'F',
    theme: 'slate',
  });

  const resCols = [
    { header: 'Gestor de Cartera', key: 'gestor', width: 28 },
    { header: 'Total Asesores Asignados', key: 'asesores', width: 24, isNumber: true },
    { header: 'Asesores con Recaudo', key: 'activos', width: 22, isNumber: true },
    { header: 'Total Recibos Caja', key: 'recibos', width: 20, isNumber: true },
    { header: 'Facturas Aplicadas', key: 'facturas', width: 20, isNumber: true },
    { header: 'Total Recaudado ($ COP)', key: 'recaudado', width: 24, isCurrency: true, isBold: true },
  ];

  const rHRow = wsResumen.getRow(5);
  resCols.forEach((col, idx) => {
    rHRow.getCell(idx + 1).value = col.header;
    wsResumen.getColumn(idx + 1).width = col.width;
    wsResumen.getColumn(idx + 1).key = col.key;
  });

  wsResumen.addRow({
    gestor: 'Wilmer Gualteros',
    asesores: wilmer.totalAsesores,
    activos: wilmer.asesoresActivos,
    recibos: wilmer.totalRecibos,
    facturas: wilmer.totalFacturas,
    recaudado: wilmer.totalRecaudado,
  });

  wsResumen.addRow({
    gestor: 'Carolina Sánchez',
    asesores: carolina.totalAsesores,
    activos: carolina.asesoresActivos,
    recibos: carolina.totalRecibos,
    facturas: carolina.totalFacturas,
    recaudado: carolina.totalRecaudado,
  });

  formatTableWorksheet(wsResumen, {
    headerRow: 5,
    dataStartRow: 6,
    dataEndRow: 7,
    colKeys: resCols,
    theme: 'slate',
  });

  const totGestRec = wilmer.totalRecaudado + carolina.totalRecaudado;
  addTotalRow(
    wsResumen,
    8,
    {
      gestor: 'TOTAL GENERAL',
      recibos: wilmer.totalRecibos + carolina.totalRecibos,
      facturas: wilmer.totalFacturas + carolina.totalFacturas,
      recaudado: totGestRec,
    },
    resCols.map((c) => c.key),
    'A'
  );

  // HOJA 2: ASESORES WILMER
  const wsWilmer = workbook.addWorksheet('Equipo Wilmer');
  applyHeaderBanner(wsWilmer, {
    title: 'Equipo Asignado — Wilmer Gualteros',
    subtitle: `Total Asesores: ${wilmer.asesores.length} · Recaudado: $ ${wilmer.totalRecaudado.toLocaleString('es-CO')}`,
    lastColLetter: 'E',
    theme: 'navy',
  });

  const asCols = [
    { header: '#', key: 'rank', width: 6, isCenter: true },
    { header: 'Asesor Comercial', key: 'nombre', width: 34 },
    { header: 'Total Recaudado', key: 'recaudado', width: 22, isCurrency: true, isBold: true },
    { header: 'Recibos Caja', key: 'recibos', width: 16, isNumber: true },
    { header: '% Aporte al Gestor', key: 'pct', width: 20, isPercent: true },
  ];

  const wHRow = wsWilmer.getRow(5);
  asCols.forEach((col, idx) => {
    wHRow.getCell(idx + 1).value = col.header;
    wsWilmer.getColumn(idx + 1).width = col.width;
    wsWilmer.getColumn(idx + 1).key = col.key;
  });

  wilmer.asesores.forEach((a: any, idx: number) => {
    wsWilmer.addRow({
      rank: idx + 1,
      nombre: a.nombre,
      recaudado: a.totalRecaudado,
      recibos: a.totalRecibos,
      pct: a.porcentajeGestor / 100,
    });
  });

  formatTableWorksheet(wsWilmer, {
    headerRow: 5,
    dataStartRow: 6,
    dataEndRow: 5 + wilmer.asesores.length,
    colKeys: asCols,
    theme: 'navy',
  });

  addTotalRow(
    wsWilmer,
    6 + wilmer.asesores.length,
    {
      nombre: 'TOTAL EQUIPO WILMER',
      recaudado: wilmer.totalRecaudado,
      recibos: wilmer.totalRecibos,
    },
    asCols.map((c) => c.key),
    'A'
  );

  // HOJA 3: ASESORES CAROLINA
  const wsCarolina = workbook.addWorksheet('Equipo Carolina');
  applyHeaderBanner(wsCarolina, {
    title: 'Equipo Asignado — Carolina Sánchez',
    subtitle: `Total Asesores: ${carolina.asesores.length} · Recaudado: $ ${carolina.totalRecaudado.toLocaleString('es-CO')}`,
    lastColLetter: 'E',
    theme: 'navy',
  });

  const cHRow = wsCarolina.getRow(5);
  asCols.forEach((col, idx) => {
    cHRow.getCell(idx + 1).value = col.header;
    wsCarolina.getColumn(idx + 1).width = col.width;
    wsCarolina.getColumn(idx + 1).key = col.key;
  });

  carolina.asesores.forEach((a: any, idx: number) => {
    wsCarolina.addRow({
      rank: idx + 1,
      nombre: a.nombre,
      recaudado: a.totalRecaudado,
      recibos: a.totalRecibos,
      pct: a.porcentajeGestor / 100,
    });
  });

  formatTableWorksheet(wsCarolina, {
    headerRow: 5,
    dataStartRow: 6,
    dataEndRow: 5 + carolina.asesores.length,
    colKeys: asCols,
    theme: 'navy',
  });

  addTotalRow(
    wsCarolina,
    6 + carolina.asesores.length,
    {
      nombre: 'TOTAL EQUIPO CAROLINA',
      recaudado: carolina.totalRecaudado,
      recibos: carolina.totalRecibos,
    },
    asCols.map((c) => c.key),
    'A'
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Gestion_Cobranzas_Gestores_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── 8. INFORME DE PRODUCTOS DE FACTURA ESPECÍFICA ──────────────────────────
export async function generateInvoiceProductsExcel(
  record: CarteraRecord
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS · Sistema de Cartera ERP';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Detalle Factura');
  applyHeaderBanner(ws, {
    title: `Factura ${record.Prefijo} ${record.Numero}`,
    subtitle: `Cliente: ${record.Empresa} (NIT: ${record.Identificacion}) · Emisión: ${record.Fecha_Emision?.split('T')[0] || ''} · Vencimiento: ${record.Fecha_Vencimiento?.split('T')[0] || ''}`,
    statsText: `Saldo Pendiente: $ ${record.Valor_Saldo.toLocaleString('es-CO')}`,
    lastColLetter: 'F',
    theme: 'navy',
  });

  const cols = [
    { header: '#', key: 'rank', width: 6, isCenter: true },
    { header: 'Código Producto', key: 'codigo', width: 18, isCenter: true },
    { header: 'Descripción del Producto', key: 'desc', width: 44 },
    { header: 'Cantidad', key: 'cantidad', width: 14, isNumber: true },
    { header: 'Valor Unitario ($)', key: 'vrUnit', width: 18, isCurrency: true },
    { header: 'Valor Total ($)', key: 'vrTotal', width: 20, isCurrency: true, isBold: true },
  ];

  const headerRowIdx = 5;
  const hRow = ws.getRow(headerRowIdx);
  cols.forEach((col, idx) => {
    hRow.getCell(idx + 1).value = col.header;
    ws.getColumn(idx + 1).width = col.width;
    ws.getColumn(idx + 1).key = col.key;
  });

  const productos = record.Productos || [];
  productos.forEach((p, idx) => {
    ws.addRow({
      rank: idx + 1,
      codigo: p.Codigo,
      desc: p.Descripcion,
      cantidad: p.Cantidad,
      vrUnit: p.Valor_Producto,
      vrTotal: p.Valor_Total,
    });
  });

  const dataStart = headerRowIdx + 1;
  const dataEnd = headerRowIdx + productos.length;
  formatTableWorksheet(ws, {
    headerRow: headerRowIdx,
    dataStartRow: dataStart,
    dataEndRow: dataEnd,
    colKeys: cols,
    theme: 'navy',
  });

  const totCant = productos.reduce((s, p) => s + p.Cantidad, 0);
  const totVal = productos.reduce((s, p) => s + p.Valor_Total, 0);
  addTotalRow(
    ws,
    dataEnd + 1,
    {
      desc: 'TOTAL FACTURADO',
      cantidad: totCant,
      vrTotal: totVal,
    },
    cols.map((c) => c.key),
    'A'
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Factura_${record.Prefijo}_${record.Numero}_Detalle_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── 8. DIRECTORIO DE CLIENTES Y CONTACTOS DE TESORERÍA ───────────────────────
export async function generateCustomerDirectoryExcel(
  customers: CustomerSummary[],
  contacts: Record<string, ClientContact>,
  filterLabel = 'General'
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule.default || ExcelJSModule) as any;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress S.A.S. - Sistema de Cartera';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Directorio Clientes');

  const totalSaldo = customers.reduce((s, c) => s + c.totalSaldo, 0);
  const totalVencido = customers.reduce((s, c) => s + c.totalVencido, 0);
  const totalCorriente = customers.reduce((s, c) => s + c.totalCorriente, 0);
  const totalDocs = customers.reduce((s, c) => s + c.docCount, 0);
  const clientesConCorreo = customers.filter((c) => {
    const ct = contacts[c.nit];
    return Boolean(ct && ct.correoTesoreria && ct.correoTesoreria.trim().length > 0);
  }).length;
  const pctCobertura = customers.length > 0 ? (clientesConCorreo / customers.length) * 100 : 0;

  applyHeaderBanner(ws, {
    title: 'Directorio de Clientes y Tesorería',
    subtitle: `Base de Clientes Activos · Cobertura de Correo: ${clientesConCorreo} de ${customers.length} (${pctCobertura.toFixed(1)}%)`,
    lastColLetter: 'Q',
    theme: 'navy',
    statsText: `Total Cartera: $ ${totalSaldo.toLocaleString('es-CO')}  ·  ${totalDocs.toLocaleString('es-CO')} facturas`,
  });

  const cols = [
    { header: '#', key: 'rank', width: 7, isCenter: true },
    { header: 'NIT', key: 'nit', width: 14, isCenter: true, isBold: true },
    { header: 'DV', key: 'dv', width: 6, isCenter: true },
    { header: 'Razón Social / Empresa', key: 'empresa', width: 38, isBold: true },
    { header: 'Estado', key: 'estado', width: 12, isCenter: true },
    { header: 'Comercial Asignado', key: 'comercial', width: 26 },
    { header: 'Grupo Comercial', key: 'grupo', width: 18 },
    { header: 'Director Comercial', key: 'director', width: 24 },
    { header: 'Saldo Total', key: 'saldoTotal', width: 20, isCurrency: true, isBold: true },
    { header: 'Saldo Corriente', key: 'saldoCorriente', width: 18, isCurrency: true },
    { header: 'Saldo Vencido', key: 'saldoVencido', width: 18, isCurrency: true },
    { header: '% Vencido', key: 'pctVencido', width: 13, isPercent: true },
    { header: 'Facturas', key: 'docCount', width: 11, isNumber: true, isCenter: true },
    { header: 'Correo Tesorería / Pagos', key: 'correoTesoreria', width: 34 },
    { header: 'Contacto Tesorería', key: 'contactoTesoreria', width: 26 },
    { header: 'Teléfono / WhatsApp', key: 'telefonoTesoreria', width: 20 },
    { header: 'Observaciones / Días Pago', key: 'observaciones', width: 36 },
  ];

  const headerRowIdx = 5;
  const hRow = ws.getRow(headerRowIdx);
  cols.forEach((col, idx) => {
    hRow.getCell(idx + 1).value = col.header;
    ws.getColumn(idx + 1).width = col.width;
    ws.getColumn(idx + 1).key = col.key;
  });

  customers.forEach((c, idx) => {
    const contact = contacts[c.nit];
    const pctVenc = c.totalSaldo > 0 ? c.totalVencido / c.totalSaldo : 0;
    ws.addRow({
      rank: idx + 1,
      nit: c.nit,
      dv: c.dv || '',
      empresa: c.empresa,
      estado: c.estadoCliente || 'Activo',
      comercial: c.comercial,
      grupo:
        c.grupo === 1
          ? 'Grupo Novoa'
          : c.grupo === 2
          ? 'Grupo Caballero'
          : c.grupo === 3
          ? 'Grupo Beltrán'
          : c.grupo === 4
          ? 'Grupo Romero'
          : 'Gerencia / Especiales',
      director: c.directorNombre,
      saldoTotal: c.totalSaldo,
      saldoCorriente: c.totalCorriente,
      saldoVencido: c.totalVencido,
      pctVencido: pctVenc,
      docCount: c.docCount,
      correoTesoreria: contact?.correoTesoreria || '',
      contactoTesoreria: contact?.contactoTesoreria || '',
      telefonoTesoreria: contact?.telefonoTesoreria || '',
      observaciones: contact?.observaciones || '',
    });
  });

  const dataStart = headerRowIdx + 1;
  const dataEnd = headerRowIdx + customers.length;
  formatTableWorksheet(ws, {
    headerRow: headerRowIdx,
    dataStartRow: dataStart,
    dataEndRow: dataEnd,
    colKeys: cols,
    theme: 'navy',
  });

  addTotalRow(
    ws,
    dataEnd + 1,
    {
      empresa: 'TOTAL CARTERA CLIENTES',
      saldoTotal: totalSaldo,
      saldoCorriente: totalCorriente,
      saldoVencido: totalVencido,
      docCount: totalDocs,
    },
    cols.map((c) => c.key),
    'A'
  );

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  const filename = `Directorio_Clientes_Provexpress_${filterLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
  return { buffer, filename };
}

// ─── FUNCIÓN AUXILIAR DE DESCARGA EN NAVEGADOR ──────────────────────────────
export function downloadBufferAsFile(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
