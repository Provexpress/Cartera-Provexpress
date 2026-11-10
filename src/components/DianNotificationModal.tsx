import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  Users,
  X,
  Lock,
} from 'lucide-react';
import type { CarteraDataState } from '../types';
import { acquireMailToken } from '../lib/auth';
import { sendMailViaGraph, OFFICIAL_SENDER_EMAIL, OFFICIAL_SENDER_NAME } from '../lib/emailSender';
import { generateDianReportExcel } from '../lib/dianExcelGenerator';
import {
  buildDianEmailSummary,
  generateDianEmailHtml,
  formatCOP,
  formatNumber,
} from '../lib/dianEmailTemplate';
import { useModalScrollLock } from '../lib/useModalScrollLock';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  carteraData: CarteraDataState;
  currentUserEmail?: string;
}

export interface DianDispatchLogEntry {
  id: string;
  time: string;
  httpStatus: number;
  success: boolean;
  recipientEmail: string;
  recipientName: string;
  role: 'Prueba' | 'Oficial';
  detail: string;
  error?: string;
}

export interface DianAuthorizedRecipient {
  id: string;
  name: string;
  email: string;
  cargo: string;
  departamento: string;
}

/**
 * Los ÚNICOS 5 destinatarios autorizados para recibir este informe (a NADIE más).
 */
export const DIAN_EXCLUSIVE_RECIPIENTS: DianAuthorizedRecipient[] = [
  {
    id: 'gestion',
    name: 'Gestión Cartera',
    email: 'gestion@provexpress.com.co',
    cargo: 'Gestión & Cartera',
    departamento: 'Cartera y Cobranza',
  },
  {
    id: 'facturacionpac',
    name: 'Facturación PAC',
    email: 'facturacionpac@provexpress.com.co',
    cargo: 'Facturación Electrónica',
    departamento: 'Facturación y DIAN',
  },
  {
    id: 'rafael',
    name: 'Rafael Novoa',
    email: 'rafael.novoa@provexpress.com.co',
    cargo: 'Dirección Comercial',
    departamento: 'Dirección Comercial y General',
  },
  {
    id: 'juan',
    name: 'Juan Novoa',
    email: 'juannovoa@provexpress.com.co',
    cargo: 'Gerencia General',
    departamento: 'Gerencia General',
  },
  {
    id: 'estrategica',
    name: 'Cuentas Estratégicas',
    email: 'c.estrategica@provexpress.com.co',
    cargo: 'Cuentas Estratégicas',
    departamento: 'Gerencia Financiera y Estratégica',
  },
];

export function DianNotificationModal({
  isOpen,
  onClose,
  carteraData,
  currentUserEmail,
}: Props) {
  useModalScrollLock(isOpen, onClose);

  // Destinatarios autorizados seleccionados (por defecto los 5)
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([
    'gestion',
    'facturacionpac',
    'rafael',
    'juan',
    'estrategica',
  ]);

  // Modo de asunto: con prefijo [PRUEBA] o definitivo
  const [isTestMode, setIsTestMode] = useState<boolean>(true);

  // Estados de ejecución
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [logs, setLogs] = useState<DianDispatchLogEntry[]>([]);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Cálculos de métricas DIAN en vivo
  const dianStats = useMemo(() => {
    const records = carteraData.records || [];
    let totReclamos = 0;
    let valReclamos = 0;
    let totSinAcuse = 0;
    let valSinAcuse = 0;
    let totAcuse = 0;
    let valAcuse = 0;
    let totRecibo = 0;
    let valRecibo = 0;
    let totAceptadas = 0;
    let valAceptadas = 0;

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

    return {
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
      totalCount: records.length,
      totalSaldo: records.reduce((s, r) => s + (Number(r.Valor_Saldo) || 0), 0),
    };
  }, [carteraData.records]);

  // Destinatarios filtrados activos
  const activeRecipients = useMemo(() => {
    return DIAN_EXCLUSIVE_RECIPIENTS.filter((r) => selectedRecipientIds.includes(r.id));
  }, [selectedRecipientIds]);

  const toggleRecipient = (id: string) => {
    if (isSending) return;
    setSelectedRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (isSending) return;
    if (selectedRecipientIds.length === DIAN_EXCLUSIVE_RECIPIENTS.length) {
      setSelectedRecipientIds([]);
    } else {
      setSelectedRecipientIds(DIAN_EXCLUSIVE_RECIPIENTS.map((r) => r.id));
    }
  };

  // Construcción del asunto oficial
  const baseSubject = `Consolidado Estado Facturación Eventos DIAN - Corte ${carteraData.fechaCorte}`;
  const currentSubject = isTestMode ? `[PRUEBA] ${baseSubject}` : baseSubject;

  if (!isOpen) return null;

  // ══════════════════════════════════════════════════════════════════════════
  // DESCARGAR EXCEL LOCAL DIRECTAMENTE
  // ══════════════════════════════════════════════════════════════════════════
  const handleDownloadExcelLocal = async () => {
    try {
      setIsDownloadingExcel(true);
      const { buffer, filename } = await generateDianReportExcel(
        carteraData.records,
        carteraData.fechaCorte
      );
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
    } catch (err: any) {
      setAlertMessage({
        type: 'error',
        text: `Error al generar Excel: ${err?.message || 'Error inesperado'}`,
      });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ENVIAR PRUEBA EXCLUSIVA A ESPECIALISTA Y CUENTAS ESTRATÉGICAS
  // ══════════════════════════════════════════════════════════════════════════
  const handleSendTest = async () => {
    const defaultEmail = currentUserEmail || 'especialista.preventa@provexpress.com.co';

    const testList: { email: string; name: string; cargo: string }[] = [
      {
        email: defaultEmail,
        name: 'Especialista Preventa',
        cargo: 'Prueba Auditoría DIAN',
      },
      {
        email: 'c.estrategica@provexpress.com.co',
        name: 'Cuentas Estratégicas',
        cargo: 'Prueba Gerencia DIAN',
      },
    ];

    const uniqueTestRecipients = testList.filter(
      (item, idx, self) => idx === self.findIndex((t) => t.email.toLowerCase() === item.email.toLowerCase())
    );

    const testSubject = `[PRUEBA] ${baseSubject}`;

    try {
      setIsSendingTest(true);
      setAlertMessage(null);
      const token = await acquireMailToken();

      let excelAttachment;
      try {
        const { filename, base64 } = await generateDianReportExcel(
          carteraData.records,
          carteraData.fechaCorte
        );
        excelAttachment = { filename, base64 };
      } catch (e) {
        console.warn('Error generando Excel de prueba DIAN:', e);
      }

      let testSuccessCount = 0;

      for (const target of uniqueTestRecipients) {
        const summary = buildDianEmailSummary(carteraData.records, carteraData.fechaCorte, {
          name: target.name,
          cargo: target.cargo,
          email: target.email,
        });

        const res = await sendMailViaGraph(token, {
          toEmail: target.email,
          toName: `${target.name} (Prueba DIAN)`,
          subject: testSubject,
          htmlBody: generateDianEmailHtml(summary),
          excelAttachment,
          senderEmail: OFFICIAL_SENDER_EMAIL,
          senderName: OFFICIAL_SENDER_NAME,
          category: 'prueba',
        });

        const entry: DianDispatchLogEntry = {
          id: `test-${target.email}-${Date.now()}`,
          time: res.timestamp || new Date().toLocaleTimeString('es-CO', { hour12: false }),
          httpStatus: res.httpStatus || (res.success ? 202 : 500),
          success: res.success,
          recipientEmail: target.email,
          recipientName: target.name,
          role: 'Prueba',
          detail: `Prueba despachada: "${testSubject}" · Excel adjunto`,
          error: res.error,
        };

        setLogs((prev) => [...prev, entry]);

        if (res.success) {
          testSuccessCount++;
        }

        await new Promise((r) => setTimeout(r, 600));
      }

      if (testSuccessCount > 0) {
        setAlertMessage({
          type: 'success',
          text: `¡Prueba despachada con éxito a Especialista (${defaultEmail}) y Cuentas Estratégicas (c.estrategica@provexpress.com.co) con el asunto: "${testSubject}"!`,
        });
      } else {
        setAlertMessage({
          type: 'error',
          text: 'No se pudo enviar el correo de prueba. Revisa la consola o la sesión de Microsoft 365.',
        });
      }
    } catch (err: any) {
      setAlertMessage({
        type: 'error',
        text: `Error de conexión con Microsoft 365: ${err?.message || 'Error desconocido'}`,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // INICIAR DESPACHO A LOS 5 DESTINATARIOS EXCLUSIVOS
  // ══════════════════════════════════════════════════════════════════════════
  const handleStartDispatch = async () => {
    if (activeRecipients.length === 0) {
      setAlertMessage({
        type: 'error',
        text: 'Selecciona al menos un destinatario autorizado para iniciar el despacho.',
      });
      return;
    }

    try {
      setIsSending(true);
      setAlertMessage(null);
      setProgress({ current: 0, total: activeRecipients.length });

      const token = await acquireMailToken();

      let excelAttachment: { filename: string; base64: string } | undefined;
      try {
        const { filename, base64 } = await generateDianReportExcel(
          carteraData.records,
          carteraData.fechaCorte
        );
        excelAttachment = { filename, base64 };
      } catch (e) {
        console.warn('Error generando Excel maestro DIAN:', e);
      }

      const startLog: DianDispatchLogEntry = {
        id: `start-${Date.now()}`,
        time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
        httpStatus: 200,
        success: true,
        recipientEmail: OFFICIAL_SENDER_EMAIL,
        recipientName: OFFICIAL_SENDER_NAME,
        role: 'Oficial',
        detail: `🚀 Iniciando despacho: "${currentSubject}" · Total: ${activeRecipients.length} destinatarios autorizados`,
      };
      setLogs((prev) => [...prev, startLog]);

      let processed = 0;

      for (const target of activeRecipients) {
        const summary = buildDianEmailSummary(carteraData.records, carteraData.fechaCorte, {
          name: target.name,
          cargo: target.cargo,
          email: target.email,
        });

        const res = await sendMailViaGraph(token, {
          toEmail: target.email,
          toName: target.name,
          subject: currentSubject,
          htmlBody: generateDianEmailHtml(summary),
          excelAttachment,
          senderEmail: OFFICIAL_SENDER_EMAIL,
          senderName: OFFICIAL_SENDER_NAME,
          category: isTestMode ? 'prueba' : 'gerencia',
        });

        processed++;
        setProgress({ current: processed, total: activeRecipients.length });

        const logItem: DianDispatchLogEntry = {
          id: `disp-${target.email}-${Date.now()}`,
          time: res.timestamp || new Date().toLocaleTimeString('es-CO', { hour12: false }),
          httpStatus: res.httpStatus || (res.success ? 202 : 500),
          success: res.success,
          recipientEmail: target.email,
          recipientName: target.name,
          role: 'Oficial',
          detail: `Enviado a ${target.name} · "${currentSubject}" · Excel 3 Hojas adjunto`,
          error: res.error,
        };
        setLogs((prev) => [...prev, logItem]);

        await new Promise((r) => setTimeout(r, 600));
      }

      const endLog: DianDispatchLogEntry = {
        id: `end-${Date.now()}`,
        time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
        httpStatus: 200,
        success: true,
        recipientEmail: OFFICIAL_SENDER_EMAIL,
        recipientName: OFFICIAL_SENDER_NAME,
        role: 'Oficial',
        detail: `✅ DESPACHO DIAN FINALIZADO: ${processed} correos enviados con éxito a la lista autorizada.`,
      };
      setLogs((prev) => [...prev, endLog]);

      setAlertMessage({
        type: 'success',
        text: `¡Despacho finalizado con éxito! Se enviaron ${processed} correos a los destinatarios autorizados con el asunto "${currentSubject}".`,
      });
    } catch (err: any) {
      setAlertMessage({
        type: 'error',
        text: `Error durante el despacho: ${err?.message || 'Error desconocido'}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Copiar y descargar logs
  const copyLogText = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.time}] HTTP ${l.httpStatus} ${l.success ? 'OK' : 'ERROR'} | [${l.role}] ${l.recipientName} <${l.recipientEmail}> - ${l.detail}${
            l.error ? ` :: ${l.error}` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadLogFile = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.time}] HTTP ${l.httpStatus} ${l.success ? 'OK' : 'ERROR'} | [${l.role}] ${l.recipientName} <${l.recipientEmail}> - ${l.detail}${
            l.error ? ` :: ${l.error}` : ''
          }`
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log_Despacho_DIAN_${carteraData.fechaCorte}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="email-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="dispatch-console-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 980 }}
      >
        {/* ENCABEZADO */}
        <div className="dispatch-header">
          <div className="dispatch-header-title">
            <div
              className="dispatch-icon-badge"
              style={{
                background: 'linear-gradient(135deg, #003366, #1E3A8A)',
                color: '#ffffff',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3>Consola de Notificación · Eventos DIAN</h3>
              <div className="dispatch-header-meta">
                <span className="badge-cutoff">Corte: {carteraData.fechaCorte}</span>
                <span className="meta-divider">•</span>
                <span>
                  Remitente Oficial: <strong>{OFFICIAL_SENDER_EMAIL}</strong>
                </span>
                <span className="meta-divider">•</span>
                <span>
                  Total Cartera: <strong>{formatCOP(dianStats.totalSaldo)}</strong> ({formatNumber(dianStats.totalCount)} facturas)
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="email-modal-close"
            onClick={onClose}
            aria-label="Cerrar modal"
            disabled={isSending}
          >
            <X size={20} />
          </button>
        </div>

        {/* FEEDBACK ALERT */}
        {alertMessage && (
          <div className={`email-modal-alert ${alertMessage.type}`}>
            {alertMessage.type === 'success' && <CheckCircle2 size={16} />}
            {alertMessage.type === 'error' && <AlertCircle size={16} />}
            {alertMessage.type === 'info' && <AlertTriangle size={16} />}
            <span>{alertMessage.text}</span>
          </div>
        )}

        <div style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 170px)' }}>
          {/* CINTA DE 5 MÉTRICAS DIAN */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 10,
              padding: '14px 24px 6px',
            }}
          >
            {/* 1. 031 Reclamo */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1.5px solid #CBD5E1',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#003366', textTransform: 'uppercase' }}>
                📋 Reclamo (031)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#003366', marginTop: 3 }}>
                {dianStats.totReclamos} facturas
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                {formatCOP(dianStats.valReclamos)}
              </div>
            </div>

            {/* 2. N/D Sin Acuse */}
            <div
              style={{
                background: '#FFFBEB',
                border: '1.5px solid #FDE68A',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#92400E', textTransform: 'uppercase' }}>
                ⚠️ Sin Acuse (N/D)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#D97706', marginTop: 3 }}>
                {formatNumber(dianStats.totSinAcuse)} fact.
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E' }}>
                {formatCOP(dianStats.valSinAcuse)}
              </div>
            </div>

            {/* 3. 030 Con Acuse */}
            <div
              style={{
                background: '#EFF6FF',
                border: '1.5px solid #BFDBFE',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>
                ⏱️ Con Acuse (030)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#2563EB', marginTop: 3 }}>
                {formatNumber(dianStats.totAcuse)} fact.
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF' }}>
                {formatCOP(dianStats.valAcuse)}
              </div>
            </div>

            {/* 4. 032 Recibo Bien/Servicio */}
            <div
              style={{
                background: '#F0FDFA',
                border: '1.5px solid #99F6E4',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#0F766E', textTransform: 'uppercase' }}>
                📦 Recibo Bien (032)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0D9488', marginTop: 3 }}>
                {formatNumber(dianStats.totRecibo)} fact.
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0F766E' }}>
                {formatCOP(dianStats.valRecibo)}
              </div>
            </div>

            {/* 5. 033 Aceptada */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1.5px solid #BBF7D0',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                ✅ Aceptadas (033/034)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#15803D', marginTop: 3 }}>
                {formatNumber(dianStats.totAceptadas)} fact.
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#166534' }}>
                {formatCOP(dianStats.valAceptadas)}
              </div>
            </div>
          </div>

          {/* LISTA EXCLUSIVA DE 5 DESTINATARIOS AUTORIZADOS */}
          <div style={{ margin: '10px 24px 6px' }}>
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #CBD5E1',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {/* Header de la tarjeta de destinatarios */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={15} color="#003366" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#003366' }}>
                    Destinatarios Oficiales Autorizados (Únicos 5 destinatarios · A nadie más)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={isSending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  {selectedRecipientIds.length === DIAN_EXCLUSIVE_RECIPIENTS.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos (5)'}
                </button>
              </div>

              {/* Lista de los 5 destinatarios con checkboxes */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 8,
                  padding: '12px 16px',
                }}
              >
                {DIAN_EXCLUSIVE_RECIPIENTS.map((rec) => {
                  const isChecked = selectedRecipientIds.includes(rec.id);
                  return (
                    <label
                      key={rec.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: isChecked ? '1.5px solid #003366' : '1px solid #E2E8F0',
                        background: isChecked ? '#F0F7FF' : '#FAFAFA',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRecipient(rec.id)}
                        disabled={isSending}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 750, color: isChecked ? '#003366' : '#475569' }}>
                          {rec.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'Consolas, monospace' }}>
                          {rec.email}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: isChecked ? '#DBEAFE' : '#E2E8F0',
                          color: isChecked ? '#1E40AF' : '#64748B',
                          padding: '2px 6px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rec.cargo}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BARRA DE CONFIGURACIÓN DE ASUNTO Y MODO PRUEBA */}
          <div
            style={{
              margin: '8px 24px',
              padding: '10px 16px',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Asunto del correo:
              </span>
              <code
                style={{
                  background: '#ffffff',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: isTestMode ? '#B45309' : '#003366',
                }}
              >
                {currentSubject}
              </code>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                fontWeight: 700,
                color: isTestMode ? '#B45309' : '#475569',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                disabled={isSending}
                style={{ width: 15, height: 15, cursor: 'pointer' }}
              />
              <span>Incluir prefijo <strong>[PRUEBA]</strong> en el asunto para este envío</span>
            </label>
          </div>

          {/* BANNER INFORMATIVO DEL EXCEL ADJUNTO DE 3 HOJAS & DESCARGA LOCAL */}
          <div
            style={{
              margin: '8px 24px',
              padding: '12px 16px',
              background: '#F0FDF4',
              border: '1.5px solid #86EFAC',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#15803D',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>
                  Archivo Adjunto: Cartera_Trazabilidad_DIAN_{carteraData.fechaCorte}.xlsx
                </div>
                <div style={{ fontSize: 11.5, color: '#15803D', marginTop: 2 }}>
                  Incluye 3 hojas: <strong>Hoja 1</strong> (Resumen Estados DIAN & Matriz Grupos) · <strong>Hoja 2</strong> (Reclamos 031 y Alertas Críticas) · <strong>Hoja 3</strong> (Detalle vivo de 3.102 facturas con CUFE y contactos).
                </div>
              </div>
            </div>

            <button
              type="button"
              className="button button-sm button-secondary"
              onClick={handleDownloadExcelLocal}
              disabled={isDownloadingExcel || isSending}
              style={{
                background: '#ffffff',
                borderColor: '#86EFAC',
                color: '#166534',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              {isDownloadingExcel ? (
                <>
                  <Loader2 size={14} className="spinner" />
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Descargar Excel Local</span>
                </>
              )}
            </button>
          </div>

          {/* BARRA DE ACCIÓN: BOTÓN PRUEBA + BOTÓN DESPACHO */}
          <div className="dispatch-action-bar">
            <div className="dispatch-action-info">
              <Mail size={16} />
              <span>
                Total a despachar:{' '}
                <strong>
                  {activeRecipients.length} {activeRecipients.length === 1 ? 'destinatario' : 'destinatarios'}
                </strong>
              </span>
            </div>

            <div className="dispatch-action-buttons">
              {/* Botón de Envío de Prueba a Especialista y Cuentas Estratégicas */}
              <button
                type="button"
                className="button button-secondary"
                onClick={handleSendTest}
                disabled={isSending || isSendingTest}
                title="Envía una prueba a especialista.preventa@provexpress.com.co y c.estrategica@provexpress.com.co"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: '8px 14px',
                  borderColor: '#F59E0B',
                  background: '#FFFBEB',
                  color: '#B45309',
                }}
              >
                {isSendingTest ? (
                  <>
                    <Loader2 size={15} className="spinner" />
                    <span>Enviando prueba a 2 correos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} color="#D97706" />
                    <span>Enviar Prueba (Especialista & Cuentas Estratégicas)</span>
                  </>
                )}
              </button>

              {/* Botón de Despacho Oficial a los 5 Destinatarios */}
              <button
                type="button"
                className="button button-primary"
                onClick={handleStartDispatch}
                disabled={isSending || isSendingTest || activeRecipients.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 750,
                  fontSize: 13,
                  padding: '8px 18px',
                  background: 'linear-gradient(135deg, #003366, #1E3A8A)',
                }}
              >
                {isSending ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>Despachando ({progress?.current || 0}/{progress?.total || activeRecipients.length})...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>
                      {isTestMode ? 'Enviar como Prueba' : 'Iniciar Despacho Oficial'} ({activeRecipients.length})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TERMINAL DE LOGS DE DESPACHO */}
          <div className="dispatch-log-panel">
            <div className="dispatch-log-header">
              <div className="dispatch-log-title">
                <Terminal size={15} />
                <span>Consola de Ejecución Microsoft Graph (HTTP /me/sendMail)</span>
              </div>
              <div className="dispatch-log-actions">
                <button
                  type="button"
                  onClick={copyLogText}
                  disabled={logs.length === 0}
                  className="dispatch-log-btn"
                  title="Copiar log al portapapeles"
                >
                  <Copy size={12} />
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadLogFile}
                  disabled={logs.length === 0}
                  className="dispatch-log-btn"
                  title="Descargar archivo .txt del log"
                >
                  <Download size={12} />
                  <span>Descargar .txt</span>
                </button>
              </div>
            </div>

            {/* Barra de Progreso */}
            {progress && (
              <div className="dispatch-progress-track">
                <div
                  className="dispatch-progress-bar"
                  style={{
                    width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}

            {/* Consola de Logs */}
            <div className="dispatch-terminal">
              {logs.length === 0 ? (
                <div className="dispatch-terminal-empty">
                  <Terminal size={24} style={{ opacity: 0.3 }} />
                  <p>
                    Listo para despachar. Haz clic en <strong>"Enviar Prueba (Especialista & Cuentas Estratégicas)"</strong> o en <strong>"Enviar como Prueba ({activeRecipients.length})"</strong> para la lista autorizada.
                  </p>
                </div>
              ) : (
                <div className="dispatch-terminal-feed">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: 11.5,
                        lineHeight: 1.5,
                        color: log.success ? '#34D399' : '#F87171',
                        padding: '2px 0',
                      }}
                    >
                      <span style={{ color: '#94A3B8' }}>[{log.time}]</span>{' '}
                      <span
                        style={{
                          fontWeight: 700,
                          color: log.httpStatus === 202 || log.httpStatus === 200 ? '#38BDF8' : '#F87171',
                        }}
                      >
                        HTTP {log.httpStatus}
                      </span>{' '}
                      <span
                        style={{
                          background: '#1E293B',
                          padding: '1px 5px',
                          borderRadius: 3,
                          color: '#E2E8F0',
                          fontSize: 10.5,
                        }}
                      >
                        {log.role}
                      </span>{' '}
                      <strong style={{ color: '#F1F5F9' }}>{log.recipientName}</strong>{' '}
                      <span style={{ color: '#64748B' }}>&lt;{log.recipientEmail}&gt;</span>{' '}
                      — <span>{log.detail}</span>
                      {log.error && (
                        <div style={{ color: '#FCA5A5', paddingLeft: 18 }}>
                          ⚠️ Error: {log.error}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="dispatch-footer">
          <div className="dispatch-footer-note">
            <span>
              🔒 Envío seguro autenticado mediante Azure AD / Entra ID con alcance <code>Mail.Send</code>.
            </span>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isSending}
          >
            Cerrar Consola
          </button>
        </div>
      </div>
    </div>
  );
}
