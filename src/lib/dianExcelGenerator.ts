import type { CarteraRecord, CarteraDataState } from '../types';
import { getAllClientContacts, parseAndNormalizeEmails } from './clientContactsStorage';

const CURRENCY_FMT = '"$"#,##0;[Red]-"$"#,##0;"$0"';
const NUMBER_FMT = '#,##0';
const PERCENT_FMT = '0.0%';

const BORDER_THIN = {
  top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

/**
 * Genera el libro Excel maestro de Eventos DIAN con 3 hojas:
 * 1. Resumen Estados DIAN & Matriz por Grupo
 * 2. Reclamos (031) y Alertas Críticas sin Acuse
 * 3. Detalle General de Facturas con CUFE y Códigos DIAN
 */
export async function generateDianReportExcel(
  records: CarteraRecord[],
  fechaCorte = new Date().toISOString().split('T')[0]
): Promise<{ buffer: ArrayBuffer; base64: string; filename: string }> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Provexpress S.A.S. - Sistema de Cartera ERP';
  workbook.created = new Date();

  const contacts = getAllClientContacts();

  // ─── CLASIFICACIÓN Y MÉTRICAS DIAN ───
  let totReclamos = 0;
  let totSinAcuse = 0;
  let totAcuse = 0;
  let totRecibo = 0;
  let totAceptadas = 0;

  let valReclamos = 0;
  let valSinAcuse = 0;
  let valAcuse = 0;
  let valRecibo = 0;
  let valAceptadas = 0;

  const totalFacturas = records.length;
  const totalSaldo = records.reduce((s, r) => s + (Number(r.Valor_Saldo) || 0), 0);

  records.forEach((r) => {
    const cod = String(r.Codigo_Evento_DIAN || 'N/D').trim();
    const val = Number(r.Valor_Saldo) || 0;
    if (cod === '031') {
      totReclamos++;
      valReclamos += val;
    } else if (cod === 'N/D' || !cod || cod === 'null') {
      totSinAcuse++;
      valSinAcuse += val;
    } else if (cod === '030') {
      totAcuse++;
      valAcuse += val;
    } else if (cod === '032') {
      totRecibo++;
      valRecibo += val;
    } else if (cod === '033' || cod === '034') {
      totAceptadas++;
      valAceptadas += val;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 1: RESUMEN ESTADOS DIAN & MATRIZ POR GRUPO
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = workbook.addWorksheet('Resumen Estados DIAN', {
    properties: { defaultRowHeight: 20 },
    views: [{ showGridLines: true }],
  });

  // Banner institucional superior
  ws1.mergeCells('B2:H2');
  const t1 = ws1.getCell('B2');
  t1.value = 'PROVEXPRESS S.A.S.  —  INFORME CONSOLIDADO EVENTOS DIAN';
  t1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 32;

  ws1.mergeCells('B3:H3');
  const sub1 = ws1.getCell('B3');
  sub1.value = `Fecha de Corte: ${fechaCorte}  ·  Facturas Vivas: ${totalFacturas.toLocaleString('es-CO')}  ·  Total Cartera: $ ${totalSaldo.toLocaleString('es-CO')}  ·  Generado: ${new Date().toLocaleString('es-CO')}`;
  sub1.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  sub1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sub1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(3).height = 20;

  // TABLA DE INDICADORES DE EVENTOS DIAN
  let rIdx = 5;
  ws1.getCell(`B${rIdx}`).value = '1. DISTRIBUCIÓN GENERAL DE EVENTOS ANTE LA DIAN';
  ws1.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
  rIdx++;

  const dianHeaders = ['Evento / Fase DIAN', 'Código', 'Facturas', 'Saldo Total ($ COP)', '% Participación', 'Estado Operativo'];
  dianHeaders.forEach((h, i) => {
    const col = String.fromCharCode(66 + i);
    const cell = ws1.getCell(`${col}${rIdx}`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: i === 1 || i === 2 || i === 4 ? 'center' : i === 3 ? 'right' : 'left', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });
  ws1.getRow(rIdx).height = 24;
  rIdx++;

  const dianRows = [
    ['🚨 Reclamo Comercial (Devuelta / Rechazo)', '031', totReclamos, valReclamos, totalSaldo > 0 ? valReclamos / totalSaldo : 0, 'Crítico: Requiere nota crédito o refacturación'],
    ['⚠️ Sin Acuse de Recibo Registrado', 'N/D', totSinAcuse, valSinAcuse, totalSaldo > 0 ? valSinAcuse / totalSaldo : 0, 'Prioritario: Cliente no ha registrado acuse'],
    ['⏳ Acuse de Recibo de Factura Electrónica', '030', totAcuse, valAcuse, totalSaldo > 0 ? valAcuse / totalSaldo : 0, 'En trámite: Pendiente recibo de bienes'],
    ['📦 Recibo del Bien y/o Prestación del Servicio', '032', totRecibo, valRecibo, totalSaldo > 0 ? valRecibo / totalSaldo : 0, 'Pre-aceptación: Mercancía/servicio recibido'],
    ['✅ Aceptación Expresa / Tácita', '033 / 034', totAceptadas, valAceptadas, totalSaldo > 0 ? valAceptadas / totalSaldo : 0, 'Factura Aceptada ante la DIAN'],
  ];

  dianRows.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    const bgArgb = idx === 0 ? 'FFFEE2E2' : isEven ? 'FFFFFFFF' : 'FFF8FAFC';
    ws1.getRow(rIdx).height = 22;

    ws1.getCell(`B${rIdx}`).value = row[0];
    ws1.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 10, bold: idx === 0 };
    ws1.getCell(`B${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    ws1.getCell(`B${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`C${rIdx}`).value = row[1];
    ws1.getCell(`C${rIdx}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: idx === 0 ? 'FFDC2626' : 'FF0F172A' } };
    ws1.getCell(`C${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`C${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    ws1.getCell(`C${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`D${rIdx}`).value = row[2];
    ws1.getCell(`D${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`D${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    ws1.getCell(`D${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`E${rIdx}`).value = row[3];
    ws1.getCell(`E${rIdx}`).numFmt = CURRENCY_FMT;
    ws1.getCell(`E${rIdx}`).alignment = { horizontal: 'right' };
    ws1.getCell(`E${rIdx}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: idx === 0 ? 'FFDC2626' : 'FF0F172A' } };
    ws1.getCell(`E${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    ws1.getCell(`E${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`F${rIdx}`).value = row[4];
    ws1.getCell(`F${rIdx}`).numFmt = PERCENT_FMT;
    ws1.getCell(`F${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`F${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    ws1.getCell(`F${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`G${rIdx}`).value = row[5];
    ws1.getCell(`G${rIdx}`).font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: idx === 0 ? 'FFB91C1C' : 'FF475569' } };
    ws1.getCell(`G${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    ws1.getCell(`G${rIdx}`).border = BORDER_THIN;

    rIdx++;
  });

  // Fila Total
  ws1.getRow(rIdx).height = 24;
  ws1.getCell(`B${rIdx}`).value = 'TOTAL CARTERA FACTURACIÓN';
  ws1.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 10, bold: true };
  ws1.getCell(`B${rIdx}`).border = BORDER_THIN;
  ws1.getCell(`C${rIdx}`).value = '—';
  ws1.getCell(`C${rIdx}`).alignment = { horizontal: 'center' };
  ws1.getCell(`C${rIdx}`).border = BORDER_THIN;
  ws1.getCell(`D${rIdx}`).value = totalFacturas;
  ws1.getCell(`D${rIdx}`).numFmt = NUMBER_FMT;
  ws1.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
  ws1.getCell(`D${rIdx}`).font = { name: 'Calibri', size: 10, bold: true };
  ws1.getCell(`D${rIdx}`).border = BORDER_THIN;
  ws1.getCell(`E${rIdx}`).value = totalSaldo;
  ws1.getCell(`E${rIdx}`).numFmt = CURRENCY_FMT;
  ws1.getCell(`E${rIdx}`).alignment = { horizontal: 'right' };
  ws1.getCell(`E${rIdx}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF15803D' } };
  ws1.getCell(`E${rIdx}`).border = BORDER_THIN;
  ws1.getCell(`F${rIdx}`).value = 1;
  ws1.getCell(`F${rIdx}`).numFmt = PERCENT_FMT;
  ws1.getCell(`F${rIdx}`).alignment = { horizontal: 'center' };
  ws1.getCell(`F${rIdx}`).font = { name: 'Calibri', size: 10, bold: true };
  ws1.getCell(`F${rIdx}`).border = BORDER_THIN;
  ws1.getCell(`G${rIdx}`).value = '100% Base Cartera Viva';
  ws1.getCell(`G${rIdx}`).border = BORDER_THIN;
  rIdx += 3;

  // TABLA 2: MATRIZ POR DIRECCIÓN COMERCIAL
  ws1.getCell(`B${rIdx}`).value = '2. RESUMEN DE FASES DIAN POR DIRECCIÓN COMERCIAL';
  ws1.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF003366' } };
  rIdx++;

  const groupHeaders = ['Grupo Comercial', 'Director Comercial', 'Total Fac', '031 Reclamo', 'N/D Sin Acuse', '030 Acuse', '032 Recibo', '033 Aceptada', 'Saldo Total ($ COP)'];
  groupHeaders.forEach((h, i) => {
    const col = String.fromCharCode(66 + i);
    const cell = ws1.getCell(`${col}${rIdx}`);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: i >= 2 && i <= 7 ? 'center' : i === 8 ? 'right' : 'left', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });
  ws1.getRow(rIdx).height = 24;
  rIdx++;

  // Agrupar registros por grupo
  const groupMap = new Map<number, { name: string; director: string; totalCount: number; c031: number; cND: number; c030: number; c032: number; c033: number; saldo: number }>();
  [1, 2, 3, 4, 0].forEach((g) => {
    const name = g === 1 ? 'Grupo Novoa' : g === 2 ? 'Grupo Caballero' : g === 3 ? 'Grupo Beltrán' : g === 4 ? 'Grupo Romero' : 'Cuentas Especiales';
    const director = g === 1 ? 'Adriana Ramírez' : g === 2 ? 'Angela Caballero' : g === 3 ? 'Óscar Beltrán' : g === 4 ? 'Miller Romero' : 'Gerencia / Especiales';
    groupMap.set(g, { name, director, totalCount: 0, c031: 0, cND: 0, c030: 0, c032: 0, c033: 0, saldo: 0 });
  });

  records.forEach((r) => {
    const gNum = r.grupoNumero || 0;
    const entry = groupMap.get(gNum) || groupMap.get(0)!;
    entry.totalCount++;
    entry.saldo += Number(r.Valor_Saldo) || 0;
    const cod = String(r.Codigo_Evento_DIAN || 'N/D').trim();
    if (cod === '031') entry.c031++;
    else if (cod === 'N/D' || !cod) entry.cND++;
    else if (cod === '030') entry.c030++;
    else if (cod === '032') entry.c032++;
    else if (cod === '033' || cod === '034') entry.c033++;
  });

  Array.from(groupMap.entries()).forEach(([gNum, data], idx) => {
    const isEven = idx % 2 === 0;
    const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
    ws1.getRow(rIdx).height = 22;

    ws1.getCell(`B${rIdx}`).value = `G${gNum === 0 ? 'E' : gNum}: ${data.name}`;
    ws1.getCell(`B${rIdx}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    ws1.getCell(`B${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`B${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`C${rIdx}`).value = data.director;
    ws1.getCell(`C${rIdx}`).font = { name: 'Calibri', size: 10 };
    ws1.getCell(`C${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`C${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`D${rIdx}`).value = data.totalCount;
    ws1.getCell(`D${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`D${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`D${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`D${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`E${rIdx}`).value = data.c031;
    ws1.getCell(`E${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`E${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`E${rIdx}`).font = { bold: data.c031 > 0, color: { argb: data.c031 > 0 ? 'FFDC2626' : 'FF64748B' } };
    ws1.getCell(`E${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: data.c031 > 0 ? 'FFFEE2E2' : bg } };
    ws1.getCell(`E${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`F${rIdx}`).value = data.cND;
    ws1.getCell(`F${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`F${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`F${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`F${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`G${rIdx}`).value = data.c030;
    ws1.getCell(`G${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`G${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`G${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`G${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`H${rIdx}`).value = data.c032;
    ws1.getCell(`H${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`H${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`H${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`H${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`I${rIdx}`).value = data.c033;
    ws1.getCell(`I${rIdx}`).numFmt = NUMBER_FMT;
    ws1.getCell(`I${rIdx}`).alignment = { horizontal: 'center' };
    ws1.getCell(`I${rIdx}`).font = { bold: true, color: { argb: 'FF15803D' } };
    ws1.getCell(`I${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`I${rIdx}`).border = BORDER_THIN;

    ws1.getCell(`J${rIdx}`).value = data.saldo;
    ws1.getCell(`J${rIdx}`).numFmt = CURRENCY_FMT;
    ws1.getCell(`J${rIdx}`).alignment = { horizontal: 'right' };
    ws1.getCell(`J${rIdx}`).font = { bold: true };
    ws1.getCell(`J${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ws1.getCell(`J${rIdx}`).border = BORDER_THIN;

    rIdx++;
  });

  // Configurar anchos Hoja 1
  ws1.columns = [
    { width: 3 },
    { width: 36 },
    { width: 24 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 22 },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 2: RECLAMOS (031) Y ALERTAS CRÍTICAS SIN ACUSE
  // ═══════════════════════════════════════════════════════════════════════════
  const ws2 = workbook.addWorksheet('Reclamos y Alertas DIAN', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }],
  });

  ws2.mergeCells('B2:K2');
  const t2 = ws2.getCell('B2');
  t2.value = 'PROVEXPRESS S.A.S.  —  FACTURAS CON RECLAMO (031) Y SIN ACUSE PRIORITARIAS';
  t2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 30;

  ws2.mergeCells('B3:K3');
  const sub2 = ws2.getCell('B3');
  sub2.value = `Atención Prioritaria Cartera: Facturas rechazadas por clientes ante la DIAN o con mora sin acuse de recibo.`;
  sub2.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  sub2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  sub2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(3).height = 20;

  const alertCols = [
    { header: '#', width: 6 },
    { header: 'Tipo Alerta', width: 18 },
    { header: 'No. Factura', width: 14 },
    { header: 'Cliente / Empresa', width: 36 },
    { header: 'NIT', width: 14 },
    { header: 'Ejecutivo Comercial', width: 26 },
    { header: 'Grupo', width: 16 },
    { header: 'Saldo ($ COP)', width: 18 },
    { header: 'Fecha Emisión', width: 14 },
    { header: 'Fecha Evento DIAN', width: 16 },
    { header: 'Correo Tesorería', width: 34 },
  ];

  const hRow2 = ws2.getRow(5);
  hRow2.height = 24;
  alertCols.forEach((col, i) => {
    const cell = hRow2.getCell(i + 2);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: i === 0 || i === 1 || i === 2 || i === 4 || i === 6 || i === 8 || i === 9 ? 'center' : i === 7 ? 'right' : 'left', vertical: 'middle' };
    cell.border = BORDER_THIN;
    ws2.getColumn(i + 2).width = col.width;
  });

  // Filtrar facturas con reclamo 031 y sin acuse con mora > 0
  const priorityRecords = records.filter(
    (r) => r.Codigo_Evento_DIAN === '031' || ((!r.Codigo_Evento_DIAN || r.Codigo_Evento_DIAN === 'N/D') && r.Dias_Vencimiento > 10)
  ).sort((a, b) => {
    if (a.Codigo_Evento_DIAN === '031' && b.Codigo_Evento_DIAN !== '031') return -1;
    if (b.Codigo_Evento_DIAN === '031' && a.Codigo_Evento_DIAN !== '031') return 1;
    return (Number(b.Valor_Saldo) || 0) - (Number(a.Valor_Saldo) || 0);
  });

  priorityRecords.forEach((r, idx) => {
    const row = ws2.getRow(6 + idx);
    row.height = 22;
    const isReclamo = r.Codigo_Evento_DIAN === '031';
    const bg = isReclamo ? 'FFFEE2E2' : idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    const ct = contacts[r.Identificacion];
    const emails = parseAndNormalizeEmails(ct?.correoTesoreria || r.Correo_Cliente).join('; ');

    row.getCell(2).value = idx + 1;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = isReclamo ? '🚨 RECLAMO (031)' : '⚠️ SIN ACUSE (>10d)';
    row.getCell(3).font = { bold: true, color: { argb: isReclamo ? 'FFDC2626' : 'FFD97706' } };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = `${r.Prefijo} ${r.Numero}`.trim();
    row.getCell(4).font = { bold: true };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).value = r.Empresa;
    row.getCell(6).value = `${r.Identificacion}${r.Dv ? `-${r.Dv}` : ''}`;
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).value = r.Nombre_Empleado;
    row.getCell(8).value = `Grupo ${r.grupoNumero}`;
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).value = Number(r.Valor_Saldo) || 0;
    row.getCell(9).numFmt = CURRENCY_FMT;
    row.getCell(9).font = { bold: true };
    row.getCell(10).value = r.Fecha_Emision?.split('T')[0] || '';
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).value = r.Fecha_Evento_DIAN?.split('T')[0] || 'Sin evento';
    row.getCell(11).alignment = { horizontal: 'center' };
    row.getCell(12).value = emails;

    for (let c = 2; c <= 12; c++) {
      row.getCell(c).border = BORDER_THIN;
      if (!isReclamo || c !== 3) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJA 3: DETALLE GENERAL DE TODAS LAS FACTURAS CON CUFE
  // ═══════════════════════════════════════════════════════════════════════════
  const ws3 = workbook.addWorksheet('Detalle Facturas DIAN', {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }],
  });

  ws3.mergeCells('B2:O2');
  const t3 = ws3.getCell('B2');
  t3.value = 'PROVEXPRESS S.A.S.  —  BASE MAESTRA DE FACTURAS CON CUFE Y TRAZABILIDAD DIAN';
  t3.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  t3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(2).height = 30;

  ws3.mergeCells('B3:O3');
  const sub3 = ws3.getCell('B3');
  sub3.value = `Detalle granular de las ${totalFacturas.toLocaleString('es-CO')} facturas vivas con CUFE SHA-384, códigos de eventos DIAN y contactos.`;
  sub3.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  sub3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sub3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(3).height = 20;

  const detailCols = [
    { header: '#', width: 6 },
    { header: 'No. Factura', width: 14 },
    { header: 'CUFE (Código Único Factura Electrónica)', width: 44 },
    { header: 'NIT', width: 14 },
    { header: 'Cliente / Empresa', width: 36 },
    { header: 'Correo(s) Tesorería', width: 34 },
    { header: 'Asesor Comercial', width: 26 },
    { header: 'Director y Grupo', width: 22 },
    { header: 'Fecha Emisión', width: 13 },
    { header: 'Fecha Vencimiento', width: 13 },
    { header: 'Días Vencido', width: 12 },
    { header: 'Saldo ($ COP)', width: 18 },
    { header: 'Cód. DIAN', width: 12 },
    { header: 'Fase Legal DIAN', width: 24 },
    { header: 'Fecha Evento DIAN', width: 14 },
  ];

  const hRow3 = ws3.getRow(5);
  hRow3.height = 24;
  detailCols.forEach((col, i) => {
    const cell = hRow3.getCell(i + 2);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: i === 0 || i === 1 || i === 3 || i === 8 || i === 9 || i === 10 || i === 12 || i === 14 ? 'center' : i === 11 ? 'right' : 'left', vertical: 'middle' };
    cell.border = BORDER_THIN;
    ws3.getColumn(i + 2).width = col.width;
  });

  records.forEach((r, idx) => {
    const row = ws3.getRow(6 + idx);
    row.height = 20;
    const isEven = idx % 2 === 0;
    const cod = String(r.Codigo_Evento_DIAN || 'N/D').trim();
    const isReclamo = cod === '031';
    const bg = isReclamo ? 'FFFEE2E2' : isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    const ct = contacts[r.Identificacion];
    const emails = parseAndNormalizeEmails(ct?.correoTesoreria || r.Correo_Cliente).join('; ');

    row.getCell(2).value = idx + 1;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).value = `${r.Prefijo} ${r.Numero}`.trim();
    row.getCell(3).font = { bold: true };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).value = r.CUFE || 'Pendiente ERP';
    row.getCell(5).value = `${r.Identificacion}${r.Dv ? `-${r.Dv}` : ''}`;
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).value = r.Empresa;
    row.getCell(7).value = emails;
    row.getCell(8).value = r.Nombre_Empleado;
    row.getCell(9).value = `G${r.grupoNumero}: ${r.directorNombre}`;
    row.getCell(10).value = r.Fecha_Emision?.split('T')[0] || '';
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).value = r.Fecha_Vencimiento?.split('T')[0] || '';
    row.getCell(11).alignment = { horizontal: 'center' };
    row.getCell(12).value = r.Dias_Vencimiento;
    row.getCell(12).alignment = { horizontal: 'center' };
    row.getCell(12).font = { bold: r.Dias_Vencimiento > 0, color: { argb: r.Dias_Vencimiento > 0 ? 'FFDC2626' : 'FF15803D' } };
    row.getCell(13).value = Number(r.Valor_Saldo) || 0;
    row.getCell(13).numFmt = CURRENCY_FMT;
    row.getCell(13).font = { bold: true };
    row.getCell(14).value = cod;
    row.getCell(14).alignment = { horizontal: 'center' };
    row.getCell(14).font = { bold: true, color: { argb: isReclamo ? 'FFDC2626' : cod === '033' ? 'FF15803D' : 'FF0F172A' } };
    row.getCell(15).value = r.dianStatus?.descripcion || (cod === 'N/D' ? 'Sin eventos registrados' : cod);
    row.getCell(16).value = r.Fecha_Evento_DIAN?.split('T')[0] || '';
    row.getCell(16).alignment = { horizontal: 'center' };

    for (let c = 2; c <= 16; c++) {
      row.getCell(c).border = BORDER_THIN;
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

  // Conversión segura de ArrayBuffer a Base64 en navegador
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB por trozo para evitar límites de pila
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, bytes.length)) as unknown as number[]
    );
  }
  const base64 = btoa(binary);
  const filename = `Cartera_Trazabilidad_DIAN_${fechaCorte}.xlsx`;

  return { buffer, base64, filename };
}
