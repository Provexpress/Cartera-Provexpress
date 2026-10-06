import ExcelJS from 'exceljs';
import type { CarteraDataState, CarteraRecord } from '../types';

export async function generateCarteraExcel(
  carteraData: CarteraDataState,
  records: CarteraRecord[],
  reportTitle = 'Informe_Cartera_Provexpress'
): Promise<{ buffer: ArrayBuffer; base64: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress SAS - Sistema de Cartera';
  workbook.created = new Date();

  const primaryFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF003366' },
  };

  const secondaryFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0071E3' },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  const currencyFormat = '$#,##0';
  const percentFormat = '0.0%';

  // 1. HOJA: RESUMEN EJECUTIVO
  const wsSummary = workbook.addWorksheet('Resumen Ejecutivo');
  wsSummary.views = [{ showGridLines: true }];

  // Título
  wsSummary.mergeCells('B2:H2');
  const titleCell = wsSummary.getCell('B2');
  titleCell.value = 'PROVEXPRESS S.A.S. - TABLERO GENERAL DE CARTERA Y EDADES';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = primaryFill;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(2).height = 32;

  // Fecha de corte
  wsSummary.getCell('B3').value = `Fecha de Corte: ${carteraData.fechaCorte} | Generado: ${new Date().toLocaleString('es-CO')}`;
  wsSummary.getCell('B3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } };

  // KPIs Generales
  const kpiLabels = [
    ['Total Cartera General', carteraData.totalSaldo, currencyFormat],
    ['Cartera Corriente (Al día)', carteraData.totalCorriente, currencyFormat],
    ['Cartera Vencida', carteraData.totalVencido, currencyFormat],
    ['% Cartera Vencida', carteraData.porcentajeVencido / 100, percentFormat],
    ['Recaudos del Período', carteraData.totalRecaudosPeriodo, currencyFormat],
    ['Total Clientes con Saldo', carteraData.clientesUnicos, '#,##0'],
    ['Total Facturas / Documentos', carteraData.totalDocumentos, '#,##0'],
  ];

  let rowIdx = 5;
  wsSummary.getCell(`B${rowIdx}`).value = 'INDICADORES CLAVE DE CARTERA';
  wsSummary.getCell(`B${rowIdx}`).font = { name: 'Calibri', size: 11, bold: true };
  rowIdx++;

  kpiLabels.forEach(([lbl, val, fmt]) => {
    wsSummary.getCell(`B${rowIdx}`).value = lbl;
    wsSummary.getCell(`B${rowIdx}`).font = { name: 'Calibri', size: 10 };
    wsSummary.getCell(`C${rowIdx}`).value = val;
    wsSummary.getCell(`C${rowIdx}`).numFmt = fmt as string;
    wsSummary.getCell(`C${rowIdx}`).font = { name: 'Calibri', size: 10, bold: true };
    wsSummary.getCell(`C${rowIdx}`).alignment = { horizontal: 'right' };
    rowIdx++;
  });

  // Tabla: Distribución por Edades de Vencimiento
  rowIdx += 2;
  wsSummary.getCell(`B${rowIdx}`).value = 'DISTRIBUCIÓN POR EDADES DE VENCIMIENTO';
  wsSummary.getCell(`B${rowIdx}`).font = { name: 'Calibri', size: 11, bold: true };
  rowIdx++;

  const agingHeaders = ['Rango de Antigüedad', 'Facturas', 'Saldo Total ($ COP)', '% Participación'];
  agingHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(66 + i);
    const cell = wsSummary.getCell(`${colLetter}${rowIdx}`);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = secondaryFill;
    cell.alignment = { horizontal: i > 0 ? 'right' : 'left', vertical: 'middle' };
  });
  rowIdx++;

  carteraData.agingBreakdown.forEach((item) => {
    wsSummary.getCell(`B${rowIdx}`).value = item.label;
    wsSummary.getCell(`C${rowIdx}`).value = item.count;
    wsSummary.getCell(`C${rowIdx}`).numFmt = '#,##0';
    wsSummary.getCell(`D${rowIdx}`).value = item.totalValor;
    wsSummary.getCell(`D${rowIdx}`).numFmt = currencyFormat;
    wsSummary.getCell(`E${rowIdx}`).value = item.percentage / 100;
    wsSummary.getCell(`E${rowIdx}`).numFmt = percentFormat;
    rowIdx++;
  });

  // Tabla: Resumen por Grupos Comerciales
  rowIdx += 2;
  wsSummary.getCell(`B${rowIdx}`).value = 'RESUMEN POR GRUPOS COMERCIALES';
  wsSummary.getCell(`B${rowIdx}`).font = { name: 'Calibri', size: 11, bold: true };
  rowIdx++;

  const groupHeaders = [
    'Grupo',
    'Director Responsable',
    'Clientes',
    'Docs',
    'Saldo Total',
    'Saldo Corriente',
    'Saldo Vencido',
    '% Vencido',
  ];
  groupHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(66 + i);
    const cell = wsSummary.getCell(`${colLetter}${rowIdx}`);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = primaryFill;
    cell.alignment = { horizontal: i >= 2 ? 'right' : 'left', vertical: 'middle' };
  });
  rowIdx++;

  carteraData.groupsSummary.forEach((g) => {
    wsSummary.getCell(`B${rowIdx}`).value = g.grupoNombre;
    wsSummary.getCell(`C${rowIdx}`).value = g.directorNombre;
    wsSummary.getCell(`D${rowIdx}`).value = g.clientesCount;
    wsSummary.getCell(`D${rowIdx}`).numFmt = '#,##0';
    wsSummary.getCell(`E${rowIdx}`).value = g.docCount;
    wsSummary.getCell(`E${rowIdx}`).numFmt = '#,##0';
    wsSummary.getCell(`F${rowIdx}`).value = g.totalSaldo;
    wsSummary.getCell(`F${rowIdx}`).numFmt = currencyFormat;
    wsSummary.getCell(`G${rowIdx}`).value = g.totalCorriente;
    wsSummary.getCell(`G${rowIdx}`).numFmt = currencyFormat;
    wsSummary.getCell(`H${rowIdx}`).value = g.totalVencido;
    wsSummary.getCell(`H${rowIdx}`).numFmt = currencyFormat;
    wsSummary.getCell(`I${rowIdx}`).value = g.porcentajeVencido / 100;
    wsSummary.getCell(`I${rowIdx}`).numFmt = percentFormat;
    rowIdx++;
  });

  wsSummary.columns = [
    { width: 4 },
    { width: 32 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 14 },
  ];

  // 2. HOJA: DETALLE DE FACTURAS Y SALDOS
  const wsDetail = workbook.addWorksheet('Detalle Facturas');
  wsDetail.views = [{ showGridLines: true }];

  const detailCols = [
    { header: 'Grupo', key: 'grupoNombre', width: 18 },
    { header: 'Director', key: 'directorNombre', width: 24 },
    { header: 'Ejecutivo Comercial', key: 'comercial', width: 28 },
    { header: 'NIT', key: 'nit', width: 15 },
    { header: 'Razón Social / Cliente', key: 'empresa', width: 34 },
    { header: 'Cupo Crédito', key: 'cupo', width: 16 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Plazo (Días)', key: 'plazo', width: 12 },
    { header: 'Tipo Doc', key: 'tipoDoc', width: 16 },
    { header: 'Prefijo', key: 'prefijo', width: 10 },
    { header: 'Número', key: 'numero', width: 12 },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14 },
    { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 14 },
    { header: 'Días Emisión', key: 'diasEmision', width: 12 },
    { header: 'Días Vencido', key: 'diasVencido', width: 12 },
    { header: 'Rango Antigüedad', key: 'rango', width: 18 },
    { header: 'Saldo Pendiente', key: 'saldo', width: 18 },
    { header: 'Ítems', key: 'items', width: 10 },
  ];

  wsDetail.columns = detailCols;

  const headerRowDetail = wsDetail.getRow(1);
  headerRowDetail.height = 24;
  headerRowDetail.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = primaryFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  records.forEach((r) => {
    const row = wsDetail.addRow({
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
      items: r.Productos ? r.Productos.length : 0,
    });

    row.getCell('cupo').numFmt = currencyFormat;
    row.getCell('saldo').numFmt = currencyFormat;
    row.getCell('saldo').font = { bold: true };
    row.getCell('diasVencido').alignment = { horizontal: 'right' };
    row.getCell('numero').alignment = { horizontal: 'center' };
    row.getCell('items').alignment = { horizontal: 'center' };
  });

  // 3. HOJA: RECIBOS DE CAJA
  const wsRecibos = workbook.addWorksheet('Recibos de Caja');
  wsRecibos.views = [{ showGridLines: true }];

  const reciboCols = [
    { header: 'Recibo Caja', key: 'recibo', width: 14 },
    { header: 'Fecha Recaudo', key: 'fechaRecaudo', width: 14 },
    { header: 'NIT', key: 'nit', width: 15 },
    { header: 'Empresa / Cliente', key: 'empresa', width: 34 },
    { header: 'Factura Venta', key: 'factura', width: 16 },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14 },
    { header: 'Fecha Vencimiento', key: 'fechaVencimiento', width: 14 },
    { header: 'Días Pago', key: 'diasPago', width: 12 },
    { header: 'Valor Factura', key: 'valorFactura', width: 18 },
    { header: 'Valor Recaudado', key: 'valorPagado', width: 18 },
    { header: 'Comercial', key: 'comercial', width: 28 },
    { header: 'Director', key: 'director', width: 24 },
  ];
  wsRecibos.columns = reciboCols;

  const headerRowRecibos = wsRecibos.getRow(1);
  headerRowRecibos.height = 24;
  headerRowRecibos.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = secondaryFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  carteraData.recibos.forEach((rc) => {
    const row = wsRecibos.addRow({
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
    row.getCell('valorFactura').numFmt = currencyFormat;
    row.getCell('valorPagado').numFmt = currencyFormat;
    row.getCell('valorPagado').font = { bold: true };
  });

  // 4. HOJA: NOTAS CRÉDITO
  const wsNotas = workbook.addWorksheet('Notas Crédito');
  wsNotas.views = [{ showGridLines: true }];

  const notasCols = [
    { header: 'Nota Crédito', key: 'nota', width: 16 },
    { header: 'Fecha Emisión', key: 'fechaEmision', width: 14 },
    { header: 'NIT', key: 'nit', width: 15 },
    { header: 'Empresa / Cliente', key: 'empresa', width: 34 },
    { header: 'Valor Nota Crédito', key: 'valor', width: 20 },
    { header: 'Factura Afectada', key: 'factura', width: 16 },
    { header: 'Comercial', key: 'comercial', width: 28 },
    { header: 'Director', key: 'director', width: 24 },
  ];
  wsNotas.columns = notasCols;

  const headerRowNotas = wsNotas.getRow(1);
  headerRowNotas.height = 24;
  headerRowNotas.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = primaryFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  carteraData.notas.forEach((nc) => {
    const row = wsNotas.addRow({
      nota: `${nc.Prefijo} ${nc.Numero}`.trim(),
      fechaEmision: nc.Fecha_Emision ? nc.Fecha_Emision.split('T')[0] : '',
      nit: nc.Identificacion,
      empresa: nc.Empresa,
      valor: nc.Valor_NotaCredito,
      factura: nc.Numero_Factura > 0 ? `${nc.Prefijo_Factura} ${nc.Numero_Factura}`.trim() : 'General',
      comercial: nc.Nombre_Empleado,
      director: nc.directorNombre,
    });
    row.getCell('valor').numFmt = currencyFormat;
    row.getCell('valor').font = { bold: true };
  });

  // Generar Buffer y Base64
  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const cleanDate = carteraData.fechaCorte.replace(/-/g, '');
  const filename = `${reportTitle}_${cleanDate}.xlsx`;

  return { buffer, base64, filename };
}

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
