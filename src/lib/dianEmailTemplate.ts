import type { CarteraRecord } from '../types';
import { LOGO_PROVEXPRESS_BASE64 } from './commercialEmailAssets';

export interface DianEmailSummary {
  recipientName: string;
  recipientCargo: string;
  recipientEmail: string;
  cutoffDate: string;
  totalCount: number;
  totalValue: number;
  // Métricas de los 5 estados DIAN
  totReclamos: number;
  valReclamos: number;
  totSinAcuse: number;
  valSinAcuse: number;
  totAcuse: number;
  valAcuse: number;
  totRecibo: number;
  valRecibo: number;
  totAceptadas: number;
  valAceptadas: number;
  // Detalle de las 8 rechazadas
  reclamosList: {
    factura: string;
    cliente: string;
    saldo: number;
    fechaReclamo: string;
    comercial: string;
  }[];
  // Desglose conciso por los 4 grupos comerciales
  groupsSummary: {
    grupo: number;
    nombreGrupo: string;
    director: string;
    totalCount: number;
    c031: number;
    cND: number;
    c033: number;
    saldo: number;
  }[];
  // Factura de mayor saldo y mayor mora
  topMayorValor: CarteraRecord | null;
  topMayorMora: CarteraRecord | null;
}

export function formatCOP(amount: number): string {
  if (amount == null || Number.isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount).replace('COP', '').replace(/\u00A0/g, ' ').trim();
}

export function formatNumber(num: number): string {
  if (num == null || Number.isNaN(num)) return '0';
  return new Intl.NumberFormat('es-CO').format(Math.round(num));
}

/**
 * Procesa las métricas de cartera y eventos DIAN para el consolidado gerencial
 */
export function buildDianEmailSummary(
  records: CarteraRecord[],
  cutoffDate = new Date().toISOString().split('T')[0],
  recipientOptions?: {
    name?: string;
    cargo?: string;
    email?: string;
  }
): DianEmailSummary {
  const recipientName = recipientOptions?.name || 'Dirección & Gerencia';
  const recipientCargo = recipientOptions?.cargo || 'Dirección Comercial & Gerencia General';
  const recipientEmail = recipientOptions?.email || 'rafael.novoa@provexpress.com.co';

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

  const reclamosList: DianEmailSummary['reclamosList'] = [];

  records.forEach((r) => {
    const cod = String(r.Codigo_Evento_DIAN || 'N/D').trim();
    const val = Number(r.Valor_Saldo) || 0;

    if (cod === '031') {
      totReclamos++;
      valReclamos += val;
      reclamosList.push({
        factura: `${r.Prefijo} ${r.Numero}`.trim(),
        cliente: r.Empresa,
        saldo: val,
        fechaReclamo: r.Fecha_Evento_DIAN?.split('T')[0] || 'Reciente',
        comercial: r.Nombre_Empleado,
      });
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

  // Ordenar reclamos por mayor valor
  reclamosList.sort((a, b) => b.saldo - a.saldo);

  // Agrupación por Grupos Comerciales (G1 a G4 y CE)
  const groupMap = new Map<number, { nombreGrupo: string; director: string; totalCount: number; c031: number; cND: number; c033: number; saldo: number }>();
  [1, 2, 3, 4, 0].forEach((g) => {
    const nombreGrupo = g === 1 ? 'Grupo Novoa' : g === 2 ? 'Grupo Caballero' : g === 3 ? 'Grupo Beltrán' : g === 4 ? 'Grupo Romero' : 'Cuentas Especiales';
    const director = g === 1 ? 'Adriana Ramírez' : g === 2 ? 'Angela Caballero' : g === 3 ? 'Óscar Beltrán' : g === 4 ? 'Miller Romero' : 'Gerencia / Especiales';
    groupMap.set(g, { nombreGrupo, director, totalCount: 0, c031: 0, cND: 0, c033: 0, saldo: 0 });
  });

  records.forEach((r) => {
    const gNum = r.grupoNumero || 0;
    const entry = groupMap.get(gNum) || groupMap.get(0)!;
    entry.totalCount++;
    entry.saldo += Number(r.Valor_Saldo) || 0;
    const cod = String(r.Codigo_Evento_DIAN || 'N/D').trim();
    if (cod === '031') entry.c031++;
    else if (cod === 'N/D' || !cod) entry.cND++;
    else if (cod === '033' || cod === '034') entry.c033++;
  });

  const groupsSummary = Array.from(groupMap.entries()).map(([grupo, data]) => ({
    grupo,
    ...data,
  }));

  // Factura de mayor saldo y mayor mora
  const sortedBySaldo = [...records].sort((a, b) => (Number(b.Valor_Saldo) || 0) - (Number(a.Valor_Saldo) || 0));
  const topMayorValor = sortedBySaldo[0] || null;

  const sortedByMora = [...records].sort((a, b) => (b.Dias_Vencimiento || 0) - (a.Dias_Vencimiento || 0));
  const topMayorMora = sortedByMora[0] || null;

  return {
    recipientName,
    recipientCargo,
    recipientEmail,
    cutoffDate,
    totalCount: records.length,
    totalValue: records.reduce((s, r) => s + (Number(r.Valor_Saldo) || 0), 0),
    totReclamos,
    valReclamos,
    totSinAcuse,
    valSinAcuse,
    totAcuse,
    valAcuse,
    totRecibo,
    valRecibo,
    totAceptadas,
    valAceptadas,
    reclamosList,
    groupsSummary,
    topMayorValor,
    topMayorMora,
  };
}

/**
 * Genera el HTML ejecutivo, conciso y de alto impacto para enviar por Microsoft 365
 */
export function generateDianEmailHtml(summary: DianEmailSummary): string {
  const logoDataUri = `data:image/png;base64,${LOGO_PROVEXPRESS_BASE64}`;

  // Formato legible de fecha
  let formattedCutoff = summary.cutoffDate;
  try {
    const [y, m, d] = summary.cutoffDate.split('-');
    if (y && m && d) {
      formattedCutoff = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  } catch {
    formattedCutoff = summary.cutoffDate;
  }

  // Filas de las 8 facturas en reclamo (Colores corporativos Provexpress: Navy Blue, Slate y Neutral)
  const rowsReclamosHtml = summary.reclamosList
    .map((rec, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      return `
      <tr style="background-color: ${bg}; border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px 10px; font-size: 11.5px; font-weight: 800; color: #003366; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
          ${rec.factura}
        </td>
        <td style="padding: 8px 10px; font-size: 11.5px; font-weight: 700; color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
          ${rec.cliente}
        </td>
        <td style="padding: 8px 10px; font-size: 11px; color: #475569; font-family: 'Segoe UI', Arial, sans-serif;">
          ${rec.comercial}
        </td>
        <td style="padding: 8px 10px; font-size: 11px; color: #64748B; text-align: center; font-family: 'Segoe UI', Arial, sans-serif;">
          ${rec.fechaReclamo}
        </td>
        <td style="padding: 8px 12px; font-size: 12px; font-weight: 850; color: #003366; text-align: right; font-family: 'Segoe UI', Arial, sans-serif;">
          ${formatCOP(rec.saldo)}
        </td>
      </tr>
      `;
    })
    .join('');

  // Filas de los 4 Grupos Comerciales
  const rowsGroupsHtml = summary.groupsSummary
    .map((g, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      return `
      <tr style="background-color: ${bg}; border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px 12px; font-size: 12px; font-weight: 800; color: #1E293B; font-family: 'Segoe UI', Arial, sans-serif;">
          <span style="display: inline-block; width: 22px; height: 20px; line-height: 20px; text-align: center; border-radius: 5px; background-color: #1E3A8A; color: #FFFFFF; font-size: 10px; margin-right: 6px;">
            ${g.grupo === 0 ? 'CE' : `G${g.grupo}`}
          </span>
          ${g.director}
        </td>
        <td style="padding: 8px 8px; text-align: center; font-size: 12px; font-weight: 800; color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
          ${formatNumber(g.totalCount)}
        </td>
        <td style="padding: 8px 8px; text-align: center; font-size: 12px; font-weight: 800; color: ${g.c031 > 0 ? '#003366' : '#94A3B8'}; font-family: 'Segoe UI', Arial, sans-serif; background-color: ${g.c031 > 0 ? '#F1F5F9' : 'transparent'}; border-radius: 4px;">
          ${g.c031 > 0 ? g.c031 : '0'}
        </td>
        <td style="padding: 8px 8px; text-align: center; font-size: 12px; font-weight: 700; color: #D97706; font-family: 'Segoe UI', Arial, sans-serif;">
          ${formatNumber(g.cND)}
        </td>
        <td style="padding: 8px 8px; text-align: center; font-size: 12px; font-weight: 700; color: #15803D; font-family: 'Segoe UI', Arial, sans-serif;">
          ${formatNumber(g.c033)}
        </td>
        <td style="padding: 8px 12px; text-align: right; font-size: 12.5px; font-weight: 900; color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
          ${formatCOP(g.saldo)}
        </td>
      </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe Gerencial DIAN & RADIAN · Provexpress SAS</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #F1F4F8; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 860px) {
      .main-card { width: 100% !important; border-radius: 0 !important; }
      .kpi-cell { display: inline-block !important; width: 48% !important; margin-bottom: 8px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #F1F4F8;">

  <!-- CONTENEDOR PRINCIPAL BLANCO RESUMIDO (900px) -->
  <table role="presentation" class="main-card" width="900" align="center" border="0" cellpadding="0" cellspacing="0" style="width: 900px; margin: 0 auto; background-color: #FFFFFF; border-radius: 14px; overflow: hidden; border: 1.5px solid #E2E8F0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
    <tr>
      <td style="padding: 22px 26px;">

        <!-- 1. ENCABEZADO: LOGO + SALUDO + TITULAR -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td width="140" valign="middle" align="left" style="padding-right: 14px;">
              <img src="${logoDataUri}" width="130" height="98" style="display: block; border: 0; width: 130px; height: 98px;" alt="Provexpress" />
            </td>
            <td valign="middle">
              <div style="font-size: 13.5px; color: #475569; font-weight: 600; font-family: 'Segoe UI', Arial, sans-serif;">
                Hola, <strong style="color: #0F172A; font-size: 15px;">${summary.recipientName}</strong>
                <span style="display: inline-block; margin-left: 6px; font-size: 10.5px; background-color: #EFF6FF; color: #1E3A8A; padding: 2px 7px; border-radius: 999px; font-weight: 700;">${summary.recipientCargo}</span>
              </div>
              <h1 style="margin: 2px 0 4px 0; font-size: 21px; font-weight: 900; color: #0F172A; line-height: 1.2; letter-spacing: -0.02em; font-family: 'Segoe UI', Arial, sans-serif;">
                Consolidado de Trazabilidad DIAN & RADIAN<br>
                <span style="color: #0284C7;">Estado Legal de Facturación</span> · Corte ${formattedCutoff}
              </h1>
              <p style="margin: 0; font-size: 11.5px; color: #475569; line-height: 1.35; font-family: 'Segoe UI', Arial, sans-serif;">
                Monitoreo ejecutivo de eventos DIAN (Acuse, Recibo de Mercancía, Reclamos y Aceptación de Títulos Valor) en la cartera activa de Provexpress SAS.
              </p>
            </td>
            <td width="115" valign="middle" align="right">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 10px 8px; width: 110px; text-align: center;">
                <tr>
                  <td align="center">
                    <div style="background-color: #0284C7; color: #FFFFFF; width: 24px; height: 24px; border-radius: 50%; font-size: 13px; font-weight: 900; line-height: 24px; margin: 0 auto 5px auto;">
                      ✓
                    </div>
                    <div style="font-size: 10.5px; font-weight: 700; color: #1E293B; line-height: 1.25; font-family: 'Segoe UI', Arial, sans-serif;">
                      Control Legal<br>
                      <strong style="color: #0284C7;">RADIAN</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- 2. 5 TARJETAS KPI CONCISAS DE EVENTOS DIAN -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
          <tr>
            <!-- KPI 1: 031 RECLAMOS (Colores corporativos Provexpress: Navy Blue) -->
            <td width="20%" valign="top" class="kpi-cell" style="padding-right: 6px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 10px; padding: 10px 8px; height: 86px;">
                <tr>
                  <td valign="top" style="font-size: 10px; color: #003366; font-weight: 800; text-transform: uppercase;">
                    📋 Reclamos (031)
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding-top: 4px;">
                    <div style="font-size: 18px; font-weight: 900; color: #003366; line-height: 1;">
                      ${summary.totReclamos} facturas
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-top: 3px;">
                      ${formatCOP(summary.valReclamos)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- KPI 2: N/D SIN ACUSE -->
            <td width="20%" valign="top" class="kpi-cell" style="padding-right: 6px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 10px 8px; height: 86px;">
                <tr>
                  <td valign="top" style="font-size: 10px; color: #92400E; font-weight: 800; text-transform: uppercase;">
                    ⚠️ Sin Acuse (N/D)
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding-top: 4px;">
                    <div style="font-size: 18px; font-weight: 900; color: #D97706; line-height: 1;">
                      ${formatNumber(summary.totSinAcuse)} fact.
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: #92400E; margin-top: 3px;">
                      ${formatCOP(summary.valSinAcuse)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- KPI 3: 030 ACUSE GENERADO -->
            <td width="20%" valign="top" class="kpi-cell" style="padding-right: 6px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 10px 8px; height: 86px;">
                <tr>
                  <td valign="top" style="font-size: 10px; color: #475569; font-weight: 800; text-transform: uppercase;">
                    ⏳ Con Acuse (030)
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding-top: 4px;">
                    <div style="font-size: 18px; font-weight: 900; color: #1E293B; line-height: 1;">
                      ${formatNumber(summary.totAcuse)} fact.
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-top: 3px;">
                      ${formatCOP(summary.valAcuse)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- KPI 4: 032 RECIBO BIEN -->
            <td width="20%" valign="top" class="kpi-cell" style="padding-right: 6px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 10px; padding: 10px 8px; height: 86px;">
                <tr>
                  <td valign="top" style="font-size: 10px; color: #166534; font-weight: 800; text-transform: uppercase;">
                    📦 Recibo Bien (032)
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding-top: 4px;">
                    <div style="font-size: 18px; font-weight: 900; color: #16A34A; line-height: 1;">
                      ${formatNumber(summary.totRecibo)} fact.
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: #166534; margin-top: 3px;">
                      ${formatCOP(summary.valRecibo)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- KPI 5: 033 ACEPTADAS -->
            <td width="20%" valign="top" class="kpi-cell">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 10px; padding: 10px 8px; height: 86px;">
                <tr>
                  <td valign="top" style="font-size: 10px; color: #065F46; font-weight: 800; text-transform: uppercase;">
                    ✅ Aceptadas (033)
                  </td>
                </tr>
                <tr>
                  <td valign="bottom" style="padding-top: 4px;">
                    <div style="font-size: 18px; font-weight: 900; color: #059669; line-height: 1;">
                      ${formatNumber(summary.totAceptadas)} fact.
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: #065F46; margin-top: 3px;">
                      ${formatCOP(summary.valAceptadas)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- 3. DETALLE DE LAS 8 FACTURAS EN RECLAMO (031) - FORMATO PROVEXPRESS -->
        ${summary.totReclamos > 0 ? `
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
          <tr>
            <td>
              <span style="font-size: 13.5px; font-weight: 850; color: #003366; font-family: 'Segoe UI', Arial, sans-serif;">
                📋 Facturas con Reclamo Comercial (Evento DIAN 031)
              </span>
              <span style="display: inline-block; background-color: #EFF6FF; border: 1px solid #BFDBFE; color: #003366; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; margin-left: 8px;">
                ${summary.totReclamos} facturas devueltas · ${formatCOP(summary.valReclamos)}
              </span>
              <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
                Facturas devueltas por el cliente ante la DIAN que requieren refacturación o nota crédito.
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden; border-collapse: separate; border-spacing: 0; margin-bottom: 18px;">
          <thead>
            <tr bgcolor="#003366" style="background-color: #003366; color: #FFFFFF;">
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 10px; text-align: center; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 85px;">Factura</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 10px; text-align: left; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif;">Cliente / Razón Social</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 10px; text-align: left; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 140px;">Ejecutivo Asignado</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 10px; text-align: center; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 95px;">Fecha Reclamo</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 12px; text-align: right; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 110px;">Saldo ($ COP)</th>
            </tr>
          </thead>
          <tbody style="background-color: #FFFFFF;">
            ${rowsReclamosHtml}
          </tbody>
        </table>
        ` : ''}

        <!-- 4. TABLA CONCISA POR DIRECCIONES COMERCIALES (GRUPOS 1 A 4) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
          <tr>
            <td>
              <span style="font-size: 13.5px; font-weight: 850; color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
                👔 Estado de Fases DIAN por Dirección Comercial
              </span>
              <span style="font-size: 11px; color: #64748B; margin-left: 10px;">
                Desglose ejecutivo de los 4 grupos de ventas de Provexpress.
              </span>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border: 1px solid #CBD5E1; border-radius: 8px; overflow: hidden; border-collapse: separate; border-spacing: 0; margin-bottom: 18px;">
          <thead>
            <tr bgcolor="#003366" style="background-color: #003366; color: #FFFFFF;">
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif;">Dirección & Grupo</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 8px; text-align: center; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 85px;">Facturas</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 8px; text-align: center; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 85px;">031 Reclamo</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 8px; text-align: center; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 90px;">N/D Sin Acuse</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 8px; text-align: center; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 85px;">033 Aceptada</th>
              <th bgcolor="#003366" style="background-color: #003366; color: #FFFFFF; padding: 9px 12px; text-align: right; font-size: 11px; font-weight: 700; font-family: 'Segoe UI', Arial, sans-serif; width: 140px;">Saldo Total COP</th>
            </tr>
          </thead>
          <tbody style="background-color: #FFFFFF;">
            ${rowsGroupsHtml}
            <tr style="background-color: #F1F5F9; border-top: 2px solid #CBD5E1;">
              <td style="padding: 9px 12px; font-size: 12px; font-weight: 900; color: #0F172A;">TOTAL COMPAÑÍA</td>
              <td style="padding: 9px 8px; text-align: center; font-size: 12.5px; font-weight: 900; color: #0F172A;">${formatNumber(summary.totalCount)}</td>
              <td style="padding: 9px 8px; text-align: center; font-size: 12px; font-weight: 900; color: #003366;">${summary.totReclamos}</td>
              <td style="padding: 9px 8px; text-align: center; font-size: 12px; font-weight: 900; color: #D97706;">${formatNumber(summary.totSinAcuse)}</td>
              <td style="padding: 9px 8px; text-align: center; font-size: 12px; font-weight: 900; color: #15803D;">${formatNumber(summary.totAceptadas)}</td>
              <td style="padding: 9px 12px; text-align: right; font-size: 13px; font-weight: 950; color: #0F172A;">${formatCOP(summary.totalValue)}</td>
            </tr>
          </tbody>
        </table>

        <!-- 5. BANNERS DE MAYOR IMPACTO (MAYOR VALOR Y MAYOR MORA) -->
        ${(summary.topMayorValor || summary.topMayorMora) ? `
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px;">
          ${summary.topMayorValor ? `
          <tr>
            <td width="30" valign="middle" align="center" style="font-size: 18px;">🏆</td>
            <td valign="middle">
              <span style="font-size: 10.5px; font-weight: 700; color: #15803D; text-transform: uppercase;">Mayor Valor:</span>
              <strong style="font-size: 12px; color: #0F172A; margin-left: 4px;">${summary.topMayorValor.Prefijo} ${summary.topMayorValor.Numero}</strong>
              <span style="font-size: 11.5px; color: #475569; margin-left: 6px;">${summary.topMayorValor.Empresa}</span>
              <span style="font-size: 11px; color: #64748B;">(${summary.topMayorValor.Nombre_Empleado})</span>
            </td>
            <td align="right" valign="middle">
              <span style="font-size: 13px; font-weight: 900; color: #15803D;">${formatCOP(summary.topMayorValor.Valor_Saldo)}</span>
            </td>
          </tr>
          ` : ''}
          ${summary.topMayorMora && summary.topMayorMora.Dias_Vencimiento > 0 ? `
          <tr>
            <td width="30" valign="middle" align="center" style="font-size: 18px; padding-top: 6px;">⏳</td>
            <td valign="middle" style="padding-top: 6px;">
              <span style="font-size: 10.5px; font-weight: 700; color: #003366; text-transform: uppercase;">Mayor Mora:</span>
              <strong style="font-size: 12px; color: #0F172A; margin-left: 4px;">${summary.topMayorMora.Prefijo} ${summary.topMayorMora.Numero}</strong>
              <span style="font-size: 11.5px; color: #475569; margin-left: 6px;">${summary.topMayorMora.Empresa}</span>
              <span style="font-size: 11px; color: #003366; font-weight: 700; margin-left: 6px;">${summary.topMayorMora.Dias_Vencimiento} días vencida</span>
            </td>
            <td align="right" valign="middle" style="padding-top: 6px;">
              <span style="font-size: 12.5px; font-weight: 800; color: #003366;">${formatCOP(summary.topMayorMora.Valor_Saldo)}</span>
            </td>
          </tr>
          ` : ''}
        </table>
        ` : ''}

        <!-- 6. BANNER VERDE EXCEL ADJUNTO (ESTILO REMISIONES) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px;">
          <tr>
            <td width="32" valign="middle" align="center" style="padding-right: 10px;">
              <div style="background-color: #107C41; color: #FFFFFF; width: 28px; height: 28px; border-radius: 6px; text-align: center; line-height: 28px; font-size: 14px; font-weight: 900;">
                📊
              </div>
            </td>
            <td valign="middle">
              <div style="font-size: 12px; font-weight: 800; color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
                📎 Archivo adjunto: Cartera_Trazabilidad_DIAN_${summary.cutoffDate}.xlsx
              </div>
              <div style="font-size: 10.5px; color: #475569; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 1px;">
                Hemos adjuntado el libro Excel con <strong>3 hojas de trabajo</strong>: (1) Resumen Estados DIAN y Grupos, (2) Reclamos 031 y Sin Acuse prioritarias, y (3) Detalle General de las <strong>${formatNumber(summary.totalCount)} facturas</strong> con CUFE, Códigos DIAN y Correos de Tesorería.
              </div>
            </td>
          </tr>
        </table>

        <!-- 7. PIE DE PÁGINA CORPORATIVO PROVEXPRESS -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 18px; margin-top: 10px;">
          <tr>
            <td width="30" valign="middle" align="center" style="padding-right: 10px;">
              <div style="font-size: 22px; line-height: 1; color: #1E3A8A;">💙</div>
            </td>
            <td valign="middle">
              <div style="font-size: 11px; color: #475569; font-family: 'Segoe UI', Arial, sans-serif;">
                Gestión jurídica de títulos valor, control de facturación y eficiencia en recaudo.
              </div>
              <div style="font-size: 12.5px; font-weight: 850; color: #1E3A8A; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 1px;">
                ¡Aseguremos la liquidez y el título valor de cada entrega juntos!
              </div>
            </td>
            <td width="40" align="right" valign="middle">
              <svg width="36" height="28" viewBox="0 0 52 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="2" width="36" height="26" rx="3" fill="#FFFFFF" stroke="#60A5FA" stroke-width="1.5"/>
                <line x1="13" y1="8" x2="31" y2="8" stroke="#93C5FD" stroke-width="2" stroke-linecap="round"/>
                <line x1="13" y1="13" x2="27" y2="13" stroke="#93C5FD" stroke-width="2" stroke-linecap="round"/>
                <path d="M4 14H48C49.1046 14 50 14.8954 50 16V36C50 37.1046 49.1046 38 48 38H4C2.89543 38 2 37.1046 2 36V16C2 14.8954 2.89543 14 4 14Z" fill="#2563EB"/>
                <path d="M3 15L26 29L49 15" stroke="#FFFFFF" stroke-width="1.5"/>
                <circle cx="41" cy="31" r="7" fill="#16A34A" stroke="#FFFFFF" stroke-width="1.5"/>
                <path d="M38 31L40 33L44 29" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
