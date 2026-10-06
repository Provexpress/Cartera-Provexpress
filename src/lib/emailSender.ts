export interface SendEmailPayload {
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
  excelAttachment?: {
    filename: string;
    base64: string;
  };
  senderEmail?: string;
  senderName?: string;
  category?: 'comercial' | 'director' | 'gerencia' | 'copia_validez' | 'prueba';
}

export interface SendResult {
  success: boolean;
  toEmail: string;
  toName: string;
  httpStatus?: number;
  timestamp?: string;
  category?: string;
  error?: string;
}

import {
  LOGO_PROVEXPRESS_BASE64,
  AVATAR_MAN_BASE64,
  AVATAR_WOMAN_BASE64,
} from './commercialEmailAssets';

export const OFFICIAL_SENDER_EMAIL = 'c.estrategica@provexpress.com.co';
export const OFFICIAL_SENDER_NAME = 'Cuentas Estratégicas · Provexpress SAS';

/**
 * Envía un correo electrónico a través de Microsoft Graph API (/me/sendMail).
 * Remitente oficial configurado: c.estrategica@provexpress.com.co
 * Utiliza el token de autenticación de Microsoft 365.
 */
export async function sendMailViaGraph(
  accessToken: string,
  payload: SendEmailPayload,
): Promise<SendResult> {
  const endpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';
  const senderEmail = payload.senderEmail || OFFICIAL_SENDER_EMAIL;
  const senderName = payload.senderName || OFFICIAL_SENDER_NAME;

  const attachments: any[] = [
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: 'logo_provexpress.png',
      contentType: 'image/png',
      contentBytes: LOGO_PROVEXPRESS_BASE64,
      isInline: true,
      contentId: 'logo_provexpress',
    },
  ];

  if (payload.htmlBody.includes('cid:avatar_woman')) {
    attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: 'avatar_woman.png',
      contentType: 'image/png',
      contentBytes: AVATAR_WOMAN_BASE64,
      isInline: true,
      contentId: 'avatar_woman',
    });
  }

  if (payload.htmlBody.includes('cid:avatar_man')) {
    attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: 'avatar_man.png',
      contentType: 'image/png',
      contentBytes: AVATAR_MAN_BASE64,
      isInline: true,
      contentId: 'avatar_man',
    });
  }

  if (payload.excelAttachment) {
    attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: payload.excelAttachment.filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentBytes: payload.excelAttachment.base64,
      isInline: false,
    });
  }

  const buildPayload = (includeFrom: boolean) => {
    const msg: any = {
      subject: payload.subject,
      body: {
        contentType: 'HTML',
        content: payload.htmlBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: payload.toEmail,
            name: payload.toName,
          },
        },
      ],
      replyTo: [
        {
          emailAddress: {
            address: senderEmail,
            name: senderName,
          },
        },
      ],
      attachments,
    };

    if (includeFrom) {
      msg.from = {
        emailAddress: {
          address: senderEmail,
          name: senderName,
        },
      };
      msg.sender = {
        emailAddress: {
          address: senderEmail,
          name: senderName,
        },
      };
    }

    return {
      message: msg,
      saveToSentItems: true,
    };
  };

  const timestamp = new Date().toLocaleTimeString('es-CO', { hour12: false });

  try {
    // 1. Intentar enviar con From explícito de c.estrategica
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload(true)),
    });

    // 2. Si Exchange rechaza el "SendAs" por falta de delegación en M365 (403 ErrorSendAsDenied),
    // enviar directamente con el usuario de sesión pero conservando Reply-To hacia c.estrategica
    if (!response.ok && response.status === 403) {
      const errClone = await response.clone().json().catch(() => ({}));
      const code = String(errClone?.error?.code || '');
      if (code.includes('SendAs') || code.includes('Denied') || code.includes('Forbidden')) {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPayload(false)),
        });
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `Error HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        toEmail: payload.toEmail,
        toName: payload.toName,
        httpStatus: response.status,
        timestamp,
        category: payload.category,
        error: msg,
      };
    }

    return {
      success: true,
      toEmail: payload.toEmail,
      toName: payload.toName,
      httpStatus: response.status || 202,
      timestamp,
      category: payload.category,
    };
  } catch (err: any) {
    return {
      success: false,
      toEmail: payload.toEmail,
      toName: payload.toName,
      httpStatus: 0,
      timestamp,
      category: payload.category,
      error: err?.message || 'Error de conexión de red al enviar el correo.',
    };
  }
}

/**
 * Envío masivo con control de tasa (rate limiting) para Microsoft 365 Exchange Online.
 * Incluye callback de progreso para la interfaz de usuario.
 */
export async function sendBatchEmails(
  accessToken: string,
  items: SendEmailPayload[],
  onProgress?: (current: number, total: number, lastResult: SendResult) => void,
  delayMs = 600,
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const res = await sendMailViaGraph(accessToken, item);
    results.push(res);

    if (onProgress) {
      onProgress(i + 1, items.length, res);
    }

    // Pausa preventiva entre correos para respetar las cuotas de Microsoft Graph
    if (i < items.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
