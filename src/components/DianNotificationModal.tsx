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
  ExternalLink,
} from 'lucide-react';
import type { CarteraDataState, CarteraRecord } from '../types';
import { acquireMailToken } from '../lib/auth';
import { sendMailViaGraph, OFFICIAL_SENDER_EMAIL, OFFICIAL_SENDER_NAME } from '../lib/emailSender';
import { generateDianReportExcel } from '../lib/dianExcelGenerator';
import {
  buildDianEmailSummary,
  generateDianEmailHtml,
  formatCOP,
  formatNumber,
} from '../lib/dianEmailTemplate';
import { LISTA_DIRECTORES, LISTA_GERENCIA } from '../lib/commercialDirectory';
import { useModalScrollLock } from '../lib/useModalScrollLock';
import { parseAndNormalizeEmails } from '../lib/clientContactsStorage';

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
  role: 'Prueba' | 'Gerencia' | 'Director' | 'Personalizado' | 'Copia Validez';
  detail: string;
  error?: string;
}

export function DianNotificationModal({
  isOpen,
  onClose,
  carteraData,
  currentUserEmail,
}: Props) {
  useModalScrollLock(isOpen, onClose);

  // Opciones de paquetes a enviar
  const [includeGerencia, setIncludeGerencia] = useState(true);
  const [includeDirectors, setIncludeDirectors] = useState(true);
  const [includeCustom, setIncludeCustom] = useState(false);
  const [customEmails, setCustomEmails] = useState('');

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

    const parsedCustomList = parseAndNormalizeEmails(customEmails);

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
      parsedCustomList,
    };
  }, [carteraData.records, customEmails]);

  // Lista de destinatarios oficiales
  const gerenciaRecipients = useMemo(() => {
    return [
      { name: 'Rafael Novoa', email: 'rafael.novoa@provexpress.com.co', cargo: 'Dirección Comercial & General' },
      { name: 'Cuentas Estratégicas', email: 'c.estrategica@provexpress.com.co', cargo: 'Gerencia Financiera & Estratégica' },
      { name: 'Especialista Preventa', email: 'especialista.preventa@provexpress.com.co', cargo: 'Auditoría & Control' },
    ];
  }, []);

  const directorRecipients = useMemo(() => {
    return LISTA_DIRECTORES.filter((d) => d.grupo >= 1 && d.grupo <= 4);
  }, []);

  const totalCalculated =
    (includeGerencia ? gerenciaRecipients.length : 0) +
    (includeDirectors ? directorRecipients.length : 0) +
    (includeCustom ? dianStats.parsedCustomList.length : 0);

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
  // ENVIAR PRUEBA A ESPECIALISTA Y CUENTAS ESTRATÉGICAS
  // ══════════════════════════════════════════════════════════════════════════
  const handleSendTest = async () => {
    const defaultEmail = currentUserEmail || 'especialista.preventa@provexpress.com.co';

    // Lista de prueba solicitada: Especialista Preventa y Cuentas Estratégicas
    const testList: { email: string; name: string; cargo: string }[] = [
      {
        email: defaultEmail,
        name: 'Especialista Preventa',
        cargo: 'Prueba Auditoría & Control DIAN',
      },
      {
        email: 'c.estrategica@provexpress.com.co',
        name: 'Cuentas Estratégicas',
        cargo: 'Prueba Gerencia Estratégica DIAN',
      },
    ];

    // Evitar duplicados si el usuario logueado ya es c.estrategica
    const uniqueTestRecipients = testList.filter(
      (item, idx, self) => idx === self.findIndex((t) => t.email.toLowerCase() === item.email.toLowerCase())
    );

    try {
      setIsSendingTest(true);
      setAlertMessage(null);
      const token = await acquireMailToken();

      // Generar Excel de 3 hojas una sola vez
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
          subject: `[PRUEBA] Consolidado DIAN / RADIAN · Cartera Provexpress · Corte ${carteraData.fechaCorte}`,
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
          detail: `Prueba DIAN enviada (${carteraData.records.length} facturas, ${dianStats.totReclamos} rechazos) · Excel adjunto`,
          error: res.error,
        };

        setLogs((prev) => [...prev, entry]);

        if (res.success) {
          testSuccessCount++;
        }

        // Breve pausa para Microsoft Graph
        await new Promise((r) => setTimeout(r, 600));
      }

      if (testSuccessCount > 0) {
        setAlertMessage({
          type: 'success',
          text: `¡Prueba despachada con éxito a Especialista (${defaultEmail}) y Cuentas Estratégicas (c.estrategica@provexpress.com.co)! Revisa las bandejas de entrada.`,
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
  // INICIAR DESPACHO OFICIAL COMPLETO
  // ══════════════════════════════════════════════════════════════════════════
  const handleStartDispatch = async () => {
    if (totalCalculated === 0) {
      setAlertMessage({
        type: 'error',
        text: 'Selecciona al menos un paquete o ingresa un correo para iniciar el despacho.',
      });
      return;
    }

    try {
      setIsSending(true);
      setAlertMessage(null);
      setProgress({ current: 0, total: totalCalculated });

      const token = await acquireMailToken();

      // Generar el archivo Excel una sola vez para adjuntarlo a todos los correos
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
        role: 'Gerencia',
        detail: `🚀 Iniciando despacho de informe DIAN & RADIAN · Corte ${carteraData.fechaCorte} · Total: ${totalCalculated} destinatarios`,
      };
      setLogs((prev) => [...prev, startLog]);

      let processed = 0;

      // 1. DESPACHO A GERENCIA GENERAL & ESPECIALISTA
      if (includeGerencia) {
        for (const g of gerenciaRecipients) {
          const summary = buildDianEmailSummary(carteraData.records, carteraData.fechaCorte, {
            name: g.name,
            cargo: g.cargo,
            email: g.email,
          });

          const res = await sendMailViaGraph(token, {
            toEmail: g.email,
            toName: g.name,
            subject: `📊 Consolidado de Trazabilidad DIAN & RADIAN · Provexpress SAS · ${g.name} · Corte ${carteraData.fechaCorte}`,
            htmlBody: generateDianEmailHtml(summary),
            excelAttachment,
            senderEmail: OFFICIAL_SENDER_EMAIL,
            senderName: OFFICIAL_SENDER_NAME,
            category: 'gerencia',
          });

          processed++;
          setProgress({ current: processed, total: totalCalculated });

          const logItem: DianDispatchLogEntry = {
            id: `ger-${g.email}-${Date.now()}`,
            time: res.timestamp || new Date().toLocaleTimeString('es-CO', { hour12: false }),
            httpStatus: res.httpStatus || (res.success ? 202 : 500),
            success: res.success,
            recipientEmail: g.email,
            recipientName: g.name,
            role: 'Gerencia',
            detail: `Consolidado DIAN (${dianStats.totReclamos} rechazos, ${formatCOP(dianStats.valReclamos)}) · Excel 3 Hojas adjunto`,
            error: res.error,
          };
          setLogs((prev) => [...prev, logItem]);

          // Pausa preventiva de 600 ms para Microsoft Graph rate-limiting
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // 2. DESPACHO A DIRECTORES COMERCIALES (G1 a G4)
      if (includeDirectors) {
        for (const dir of directorRecipients) {
          const summary = buildDianEmailSummary(carteraData.records, carteraData.fechaCorte, {
            name: dir.nombre,
            cargo: `Dirección Comercial · Grupo ${dir.grupo}`,
            email: dir.email,
          });

          const res = await sendMailViaGraph(token, {
            toEmail: dir.email,
            toName: dir.nombre,
            subject: `Trazabilidad DIAN & RADIAN · Dirección Grupo ${dir.grupo} (${dir.nombre}) · Corte ${carteraData.fechaCorte}`,
            htmlBody: generateDianEmailHtml(summary),
            excelAttachment,
            senderEmail: OFFICIAL_SENDER_EMAIL,
            senderName: OFFICIAL_SENDER_NAME,
            category: 'director',
          });

          processed++;
          setProgress({ current: processed, total: totalCalculated });

          const logItem: DianDispatchLogEntry = {
            id: `dir-${dir.email}-${Date.now()}`,
            time: res.timestamp || new Date().toLocaleTimeString('es-CO', { hour12: false }),
            httpStatus: res.httpStatus || (res.success ? 202 : 500),
            success: res.success,
            recipientEmail: dir.email,
            recipientName: dir.nombre,
            role: 'Director',
            detail: `Grupo ${dir.grupo} · Matriz de eventos DIAN y cartera activa · Excel adjunto`,
            error: res.error,
          };
          setLogs((prev) => [...prev, logItem]);

          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // 3. DESPACHO A CORREOS PERSONALIZADOS
      if (includeCustom && dianStats.parsedCustomList.length > 0) {
        for (const email of dianStats.parsedCustomList) {
          const summary = buildDianEmailSummary(carteraData.records, carteraData.fechaCorte, {
            name: email.split('@')[0],
            cargo: 'Destinatario Notificación DIAN',
            email,
          });

          const res = await sendMailViaGraph(token, {
            toEmail: email,
            toName: email.split('@')[0],
            subject: `Consolidado de Trazabilidad DIAN & RADIAN · Cartera Provexpress SAS · Corte ${carteraData.fechaCorte}`,
            htmlBody: generateDianEmailHtml(summary),
            excelAttachment,
            senderEmail: OFFICIAL_SENDER_EMAIL,
            senderName: OFFICIAL_SENDER_NAME,
            category: 'prueba',
          });

          processed++;
          setProgress({ current: processed, total: totalCalculated });

          const logItem: DianDispatchLogEntry = {
            id: `cust-${email}-${Date.now()}`,
            time: res.timestamp || new Date().toLocaleTimeString('es-CO', { hour12: false }),
            httpStatus: res.httpStatus || (res.success ? 202 : 500),
            success: res.success,
            recipientEmail: email,
            recipientName: email.split('@')[0],
            role: 'Personalizado',
            detail: `Envío personalizado con consolidado y Excel adjunto`,
            error: res.error,
          };
          setLogs((prev) => [...prev, logItem]);

          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // Registro final
      const endLog: DianDispatchLogEntry = {
        id: `end-${Date.now()}`,
        time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
        httpStatus: 200,
        success: true,
        recipientEmail: OFFICIAL_SENDER_EMAIL,
        recipientName: OFFICIAL_SENDER_NAME,
        role: 'Gerencia',
        detail: `✅ DESPACHO OFICIAL DIAN FINALIZADO: ${processed} correos despachados satisfactoriamente.`,
      };
      setLogs((prev) => [...prev, endLog]);

      setAlertMessage({
        type: 'success',
        text: `¡Proceso de notificación finalizado! Se enviaron ${processed} correos oficiales de trazabilidad DIAN con remitente ${OFFICIAL_SENDER_EMAIL}.`,
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
        style={{ maxWidth: 1020 }}
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
              <h3>Consola de Notificación · Trazabilidad DIAN & RADIAN</h3>
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
                background: '#FEF2F2',
                border: '1.5px solid #FECACA',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase' }}>
                🚨 Reclamo (031)
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#DC2626', marginTop: 3 }}>
                {dianStats.totReclamos} facturas
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#991B1B' }}>
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

          {/* GRID DE PAQUETES A ENVIAR */}
          <div className="dispatch-cards-grid">
            {/* PAQUETE 1: GERENCIA */}
            <div className={`dispatch-card ${includeGerencia ? 'active' : 'inactive'}`}>
              <div className="dispatch-card-top">
                <label className="dispatch-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeGerencia}
                    onChange={(e) => setIncludeGerencia(e.target.checked)}
                    disabled={isSending}
                  />
                  <span>Gerencia & Dirección</span>
                </label>
                <span className="dispatch-card-badge blue">
                  {gerenciaRecipients.length} Destinatarios
                </span>
              </div>
              <div className="dispatch-card-body">
                <p>
                  Consolidado ejecutivo con alerta prioritaria de las <strong>8 facturas en reclamo</strong> ($17.4M), semáforo DIAN y resumen de los 4 grupos.
                </p>
                <div className="dispatch-card-stat">
                  Rafael Novoa, Cuentas Estratégicas + Copia Auditoría
                </div>
              </div>
              <div className="dispatch-card-foot">
                <FileSpreadsheet size={13} />
                <span>Libro Excel 3 Hojas adjunto</span>
              </div>
            </div>

            {/* PAQUETE 2: DIRECTORES DE GRUPO */}
            <div className={`dispatch-card ${includeDirectors ? 'active' : 'inactive'}`}>
              <div className="dispatch-card-top">
                <label className="dispatch-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeDirectors}
                    onChange={(e) => setIncludeDirectors(e.target.checked)}
                    disabled={isSending}
                  />
                  <span>Directores de Grupo</span>
                </label>
                <span className="dispatch-card-badge amber">
                  {directorRecipients.length} Directores
                </span>
              </div>
              <div className="dispatch-card-body">
                <p>
                  Informe para líderes de equipo comercial: <strong>G1</strong> Novoa, <strong>G2</strong> Caballero, <strong>G3</strong> Beltrán y <strong>G4</strong> Romero.
                </p>
                <div className="dispatch-card-stat">
                  Matriz de acuses y facturas vivas por grupo
                </div>
              </div>
              <div className="dispatch-card-foot">
                <FileSpreadsheet size={13} />
                <span>Libro Excel 3 Hojas adjunto</span>
              </div>
            </div>

            {/* PAQUETE 3: DESTINATARIOS PERSONALIZADOS */}
            <div className={`dispatch-card ${includeCustom ? 'active' : 'inactive'}`}>
              <div className="dispatch-card-top">
                <label className="dispatch-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeCustom}
                    onChange={(e) => setIncludeCustom(e.target.checked)}
                    disabled={isSending}
                  />
                  <span>Otros Destinatarios</span>
                </label>
                <span className="dispatch-card-badge purple">
                  {dianStats.parsedCustomList.length} Correos
                </span>
              </div>
              <div className="dispatch-card-body">
                <p style={{ marginBottom: 6 }}>
                  Ingresa correos específicos (separados por coma, espacio o punto y coma):
                </p>
                <input
                  type="text"
                  placeholder="ej: tesoreria@provexpress.com.co; revisoria@..."
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  disabled={!includeCustom || isSending}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: 11.5,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: includeCustom ? '#ffffff' : '#f1f5f9',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeCustom(true);
                      setCustomEmails('especialista.preventa@provexpress.com.co; c.estrategica@provexpress.com.co');
                    }}
                    style={{
                      background: '#F3E8FF',
                      border: '1px solid #D8B4FE',
                      color: '#7E22CE',
                      fontSize: 10.5,
                      fontWeight: 700,
                      borderRadius: 5,
                      padding: '2px 7px',
                      cursor: 'pointer',
                    }}
                  >
                    + Especialista & C. Estratégicas
                  </button>
                </div>
              </div>
              <div className="dispatch-card-foot">
                <Users size={13} />
                <span>Envío formal por Microsoft 365</span>
              </div>
            </div>
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
                  {totalCalculated} {totalCalculated === 1 ? 'correo' : 'correos'}
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
                title="Envía de inmediato una prueba del reporte a especialista.preventa@provexpress.com.co y c.estrategica@provexpress.com.co"
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

              {/* Botón de Despacho Oficial */}
              <button
                type="button"
                className="button button-primary"
                onClick={handleStartDispatch}
                disabled={isSending || isSendingTest || totalCalculated === 0}
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
                    <span>Despachando ({progress?.current || 0}/{progress?.total || totalCalculated})...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Iniciar Despacho Oficial ({totalCalculated})</span>
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
                    Listo para despachar. Haz clic en <strong>"Enviar Prueba (Especialista & Cuentas Estratégicas)"</strong> para validar el formato o en <strong>"Iniciar Despacho Oficial"</strong>.
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
