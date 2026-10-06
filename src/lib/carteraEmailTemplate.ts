import type { CarteraDataState, ExecutiveSummary, GroupSummary } from '../types';
import { formatCurrency, formatPercent } from './carteraApi';

export interface EmailTemplateOptions {
  recipientName: string;
  recipientEmail: string;
  role: 'director' | 'executive' | 'gerencia';
  groupSummary?: GroupSummary;
  executiveSummary?: ExecutiveSummary;
  carteraData: CarteraDataState;
  customNote?: string;
}

export function buildCarteraEmailHtml(options: EmailTemplateOptions): { subject: string; html: string } {
  const { recipientName, role, groupSummary, executiveSummary, carteraData, customNote } = options;

  let title = '';
  let totalCartera = carteraData.totalSaldo;
  let totalCorriente = carteraData.totalCorriente;
  let totalVencido = carteraData.totalVencido;
  let pctVencido = carteraData.porcentajeVencido;

  if (role === 'director' && groupSummary) {
    title = `Estado de Cartera - ${groupSummary.grupoNombre} (${groupSummary.directorNombre})`;
    totalCartera = groupSummary.totalSaldo;
    totalCorriente = groupSummary.totalCorriente;
    totalVencido = groupSummary.totalVencido;
    pctVencido = groupSummary.porcentajeVencido;
  } else if (role === 'executive' && executiveSummary) {
    title = `Estado de Cartera - ${executiveSummary.nombre}`;
    totalCartera = executiveSummary.totalSaldo;
    totalCorriente = executiveSummary.totalCorriente;
    totalVencido = executiveSummary.totalVencido;
    pctVencido = executiveSummary.porcentajeVencido;
  } else {
    title = 'Informe General de Cartera y Edades - Provexpress SAS';
  }

  const subject = `[Cartera Provexpress] ${title} - Corte ${carteraData.fechaCorte}`;

  // Tabla de desglose de edades
  const agingRows = carteraData.agingBreakdown
    .map(
      (a) => `
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #1f2937;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${a.color}; margin-right: 8px;"></span>
        ${a.label}
      </td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: center; color: #4b5563;">
        ${a.count}
      </td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; font-weight: 600; text-align: right; color: #111827;">
        ${formatCurrency(a.totalValor)}
      </td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right; color: #4b5563;">
        ${formatPercent(a.percentage)}
      </td>
    </tr>`
    )
    .join('');

  // Top deudores
  const topCustomers = carteraData.customersSummary
    .slice(0, 5)
    .map(
      (c) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #111827;">
        <strong>${c.empresa}</strong><br/>
        <span style="color: #6b7280; font-size: 11px;">NIT: ${c.nit} · Asesor: ${c.comercial}</span>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; text-align: right; font-weight: 600; color: #dc2626;">
        ${formatCurrency(c.totalVencido)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; text-align: right; font-weight: 700; color: #111827;">
        ${formatCurrency(c.totalSaldo)}
      </td>
    </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f;">
  <div style="max-width: 680px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e5e5ea;">
    
    <!-- Encabezado Provexpress -->
    <div style="background: linear-gradient(135deg, #003366 0%, #0071e3 100%); padding: 32px 36px; text-align: left; color: #ffffff;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: 700; margin-bottom: 6px;">
        PROVEXPRESS S.A.S. · GESTIÓN DE CARTERA
      </div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 750; line-height: 1.2; color: #ffffff;">
        ${title}
      </h1>
      <div style="margin-top: 10px; font-size: 13px; opacity: 0.9;">
        Corte al <strong>${carteraData.fechaCorte}</strong> · Generado automáticamente desde el ERP
      </div>
    </div>

    <!-- Saludo y Resumen -->
    <div style="padding: 32px 36px 16px;">
      <p style="font-size: 15px; line-height: 1.5; color: #374151; margin-top: 0;">
        Estimado(a) <strong>${recipientName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
        A continuación se presenta el consolidado actualizado de la cartera comercial y vencimientos según los registros del sistema contable.
      </p>

      ${
        customNote
          ? `<div style="background-color: #eff6ff; border-left: 4px solid #0071e3; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 18px 0; font-size: 13px; color: #1e40af;">
              <strong>Nota:</strong> ${customNote}
            </div>`
          : ''
      }

      <!-- KPI Grid -->
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="width: 33.33%; padding: 16px; background-color: #f8fafc; border-radius: 10px 0 0 10px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Total Cartera</div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatCurrency(totalCartera)}</div>
          </td>
          <td style="width: 33.33%; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; text-align: center;">
            <div style="font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Corriente (Al día)</div>
            <div style="font-size: 20px; font-weight: 800; color: #15803d; margin-top: 4px;">${formatCurrency(totalCorriente)}</div>
          </td>
          <td style="width: 33.33%; padding: 16px; background-color: #fef2f2; border-radius: 0 10px 10px 0; border: 1px solid #fecaca; text-align: center;">
            <div style="font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Vencida (${formatPercent(pctVencido)})</div>
            <div style="font-size: 20px; font-weight: 800; color: #b91c1c; margin-top: 4px;">${formatCurrency(totalVencido)}</div>
          </td>
        </tr>
      </table>

      <!-- Tabla de Edades -->
      <h3 style="font-size: 15px; font-weight: 700; color: #111827; margin: 26px 0 12px; border-bottom: 2px solid #0071e3; padding-bottom: 6px;">
        Distribución por Edades de Vencimiento
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Rango de Edad</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Docs</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Saldo ($ COP)</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">% Total</th>
          </tr>
        </thead>
        <tbody>
          ${agingRows}
        </tbody>
      </table>

      <!-- Top Clientes -->
      <h3 style="font-size: 15px; font-weight: 700; color: #111827; margin: 26px 0 12px; border-bottom: 2px solid #0071e3; padding-bottom: 6px;">
        Principales Clientes con Saldo Pendiente
      </h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 28px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Cliente / Asesor</th>
            <th style="padding: 8px 12px; text-align: right; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Saldo Vencido</th>
            <th style="padding: 8px 12px; text-align: right; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Saldo Total</th>
          </tr>
        </thead>
        <tbody>
          ${topCustomers}
        </tbody>
      </table>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; font-size: 13px; color: #4b5563; margin-top: 20px;">
        📎 Se adjunta el archivo Excel oficial con el detalle pormenorizado de todas las facturas, fechas de vencimiento, plazos, recibos de caja y notas crédito.
      </div>
    </div>

    <!-- Pie de página corporativo -->
    <div style="background-color: #f3f4f6; border-top: 1px solid #e5e7eb; padding: 24px 36px; text-align: center; color: #6b7280; font-size: 12px; line-height: 1.5;">
      <strong>Provexpress S.A.S.</strong> · Cuentas Estratégicas y Cartera<br/>
      Portal de Gestión y Seguimiento de Cartera en Tiempo Real<br/>
      <span style="color: #9ca3af; font-size: 11px;">Este correo ha sido generado desde la plataforma corporativa autorizada en Microsoft 365.</span>
    </div>

  </div>
</body>
</html>
`;

  return { subject, html };
}
