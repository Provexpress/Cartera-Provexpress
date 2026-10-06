import { useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Mail, Send, X, AlertCircle } from 'lucide-react';
import type { CarteraDataState, ExecutiveSummary, GroupSummary } from '../types';
import { LISTA_DIRECTORES } from '../lib/commercialDirectory';
import { acquireMailToken } from '../lib/auth';
import { sendMailViaGraph } from '../lib/emailSender';
import { generateCarteraExcel } from '../lib/excelGenerator';
import { buildCarteraEmailHtml } from '../lib/carteraEmailTemplate';

interface Props {
  carteraData: CarteraDataState;
  targetGroup?: GroupSummary;
  targetExecutive?: ExecutiveSummary;
  onClose: () => void;
}

export function EmailNotificationModal({
  carteraData,
  targetGroup,
  targetExecutive,
  onClose,
}: Props) {
  const [recipientEmail, setRecipientEmail] = useState<string>(() => {
    if (targetExecutive?.email) return targetExecutive.email;
    if (targetGroup?.directorEmail) return targetGroup.directorEmail;
    return 'c.estrategica@provexpress.com.co';
  });

  const [recipientName, setRecipientName] = useState<string>(() => {
    if (targetExecutive?.nombre) return targetExecutive.nombre;
    if (targetGroup?.directorNombre) return targetGroup.directorNombre;
    return 'Gerencia General';
  });

  const [roleType, setRoleType] = useState<'director' | 'executive' | 'gerencia'>(() => {
    if (targetExecutive) return 'executive';
    if (targetGroup) return 'director';
    return 'gerencia';
  });

  const [customNote, setCustomNote] = useState('');
  const [attachExcel, setAttachExcel] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSelectPredefined = (email: string, name: string, type: 'director' | 'executive' | 'gerencia') => {
    setRecipientEmail(email);
    setRecipientName(name);
    setRoleType(type);
  };

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setSendResult({ success: false, message: 'Por favor ingresa un correo electrónico válido.' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // 1. Obtener token con permiso Mail.Send
      const mailToken = await acquireMailToken();

      // 2. Construir plantilla HTML
      const { subject, html } = buildCarteraEmailHtml({
        recipientName,
        recipientEmail,
        role: roleType,
        groupSummary: targetGroup,
        executiveSummary: targetExecutive,
        carteraData,
        customNote,
      });

      // 3. Generar Excel si está seleccionado
      let excelAttachment: { filename: string; base64: string } | undefined;
      if (attachExcel) {
        const relevantRecords = targetExecutive
          ? carteraData.records.filter((r) => r.Nombre_Empleado.toLowerCase() === targetExecutive.nombre.toLowerCase())
          : targetGroup
          ? carteraData.records.filter((r) => r.grupoNumero === targetGroup.grupo)
          : carteraData.records;

        const excel = await generateCarteraExcel(
          carteraData,
          relevantRecords,
          `Cartera_${recipientName.replace(/\s+/g, '_')}`
        );
        excelAttachment = {
          filename: excel.filename,
          base64: excel.base64,
        };
      }

      // 4. Enviar mediante Microsoft Graph API
      const res = await sendMailViaGraph(mailToken, {
        toEmail: recipientEmail,
        toName: recipientName,
        subject,
        htmlBody: html,
        excelAttachment,
      });

      if (res.success) {
        setSendResult({
          success: true,
          message: `¡Notificación de cartera enviada exitosamente a ${recipientEmail}!`,
        });
      } else {
        setSendResult({
          success: false,
          message: res.error || 'Error al enviar el correo a través de Microsoft 365.',
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Error inesperado durante la autenticación o envío.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="modal-badge-row">
              <span className="badge badge-primary">Microsoft 365 Graph</span>
              <span className="badge badge-neutral">Corte: {carteraData.fechaCorte}</span>
            </div>
            <h2>Enviar Notificación de Cartera</h2>
            <p className="modal-subtitle">
              Envía el consolidado de vencimientos y archivo Excel oficial a los líderes comerciales.
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Destinatarios Rápidos */}
          <div className="modal-field">
            <label className="field-label">Destinatarios Frecuentes / Directores:</label>
            <div className="quick-tags-wrap">
              {LISTA_DIRECTORES.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  className={`quick-tag ${recipientEmail === d.email ? 'active' : ''}`}
                  onClick={() => handleSelectPredefined(d.email, d.nombre, 'director')}
                >
                  {d.nombre} (Grupo {d.grupo})
                </button>
              ))}
              <button
                type="button"
                className={`quick-tag ${recipientEmail === 'c.estrategica@provexpress.com.co' ? 'active' : ''}`}
                onClick={() =>
                  handleSelectPredefined('c.estrategica@provexpress.com.co', 'Cuentas Estratégicas', 'gerencia')
                }
              >
                Cuentas Estratégicas
              </button>
            </div>
          </div>

          {/* Formulario de Correo */}
          <div className="modal-fields-row">
            <div className="modal-field" style={{ flex: 1 }}>
              <label className="field-label">Nombre del Destinatario:</label>
              <input
                type="text"
                className="input-text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="modal-field" style={{ flex: 1.4 }}>
              <label className="field-label">Correo Electrónico (M365):</label>
              <input
                type="email"
                className="input-text"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Mensaje adicional */}
          <div className="modal-field">
            <label className="field-label">Nota o Instrucción Adicional (Opcional):</label>
            <textarea
              className="textarea-input"
              rows={3}
              placeholder="Ej: Estimado equipo, por favor priorizar la gestión de cobro de las facturas con más de 30 días de vencimiento..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          </div>

          {/* Checkbox Adjuntar Excel */}
          <div className="modal-checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={attachExcel}
                onChange={(e) => setAttachExcel(e.target.checked)}
              />
              <FileSpreadsheet size={16} className="excel-icon" />
              <span>Adjuntar libro Excel con el detalle completo de facturas, recibos y notas</span>
            </label>
          </div>

          {/* Feedback de Envío */}
          {sendResult && (
            <div
              className={`send-feedback-box ${sendResult.success ? 'success' : 'error'}`}
            >
              {sendResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{sendResult.message}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isSending}>
            Cancelar
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Enviando por Microsoft 365...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Enviar Notificación</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
