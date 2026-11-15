import nodemailer from 'nodemailer';
import { logEvent } from './logger.js';

export class EmailDeliveryError extends Error {
  status: number;
  code: string;

  constructor(message: string, code = 'EMAIL_DELIVERY_FAILED', status = 502) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = code;
    this.status = status;
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!host || !user || !pass) {
    return null;
  }

  const parsedPort = Number(process.env.SMTP_PORT || '465');
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? Math.floor(parsedPort) : 465;
  const secureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv ? secureEnv === 'true' || secureEnv === '1' : port === 465;
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user).trim();
  const fromName = (process.env.SMTP_FROM_NAME || 'FieldShift').trim() || 'FieldShift';

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
  };
}

export function isSmtpConfigured(): boolean {
  return Boolean(getSmtpConfig());
}

export function getSmtpConfigSummary() {
  const cfg = getSmtpConfig();
  return {
    directSmtpConfigured: Boolean(cfg),
    host: cfg?.host || 'smtp.gmail.com (via Supabase Auth)',
    port: cfg?.port || 465,
    fromName: cfg?.fromName || 'FieldShift',
  };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildVerificationEmailContent(params: {
  code: string;
  ttlMinutes: number;
  fullName?: string;
}): { subject: string; html: string; text: string } {
  const ttlMinutes = Math.max(1, Math.round(params.ttlMinutes));
  const safeName = params.fullName?.trim() ? escapeHtml(params.fullName.trim()) : null;
  const greeting = safeName ? `Hello ${safeName},` : 'Hello,';

  const subject = 'Verify your FieldShift account — 6-digit code';

  const text = [
    'FieldShift — Verify your email address',
    '',
    greeting,
    '',
    `Your 6-digit verification code is: ${params.code}`,
    '',
    `This verification code expires in ${ttlMinutes} minutes and can only be used once.`,
    '',
    'Security Notice: Never share this code with anyone. FieldShift will never ask you for this code by phone, chat, or email.',
    'If you did not request this verification code, you can safely ignore this message.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#F8F7ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#102A24;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background-color:#FFFFFF;border:1px solid #D5E5CA;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="background-color:#073D2B;padding:24px 28px;color:#FFFFFF;">
          <h1 style="margin:0;font-size:20px;line-height:1.3;font-weight:700;">
            Field<span style="color:#76B93F;">Shift</span>
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#D5E5CA;">
            Agricultural Intelligence Powered by NASA Earth Observations
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#102A24;">
            ${greeting}
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#204033;">
            Use the 6-digit verification code below to verify your email address and activate your FieldShift workspace:
          </p>
          <div style="margin:20px 0;padding:16px 20px;background-color:#EAF5DF;border:1px solid #C2E0B0;border-radius:12px;text-align:center;">
            <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#073D2B;font-family:'Courier New',Courier,monospace;">
              ${escapeHtml(params.code)}
            </span>
          </div>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#204033;">
            This verification code <strong>expires in ${ttlMinutes} minutes</strong> and can only be used once.
          </p>
          <div style="margin:16px 0 0;padding:12px 14px;background-color:#FFF8EB;border:1px solid #F3D9A4;border-radius:10px;font-size:12px;line-height:1.5;color:#6E4B14;">
            <strong>Security Warning:</strong> Never share this verification code with anyone. FieldShift support will never ask you for this code. If you did not create a FieldShift account, you can safely ignore this email.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export interface EmailSendTransport {
  sendMail(mailOptions: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{
    accepted?: unknown[];
    rejected?: unknown[];
    messageId?: string;
    response?: string;
  }>;
}

export async function sendVerificationEmailSmtp(
  params: {
    to: string;
    code: string;
    ttlMinutes: number;
    fullName?: string;
  },
  customTransport?: EmailSendTransport
): Promise<{ messageId: string | null }> {
  const recipient = params.to.trim().toLowerCase();
  if (!/^\d{6}$/.test(params.code)) {
    throw new EmailDeliveryError('Verification code format error.', 'INVALID_OTP_GENERATION', 500);
  }

  let transport: EmailSendTransport;
  let fromHeader: string;

  if (customTransport) {
    transport = customTransport;
    fromHeader = 'FieldShift <no-reply@fieldshift.local>';
  } else {
    const cfg = getSmtpConfig();
    if (!cfg) {
      throw new EmailDeliveryError(
        'SMTP delivery credentials are not configured on the server.',
        'SMTP_UNCONFIGURED',
        503
      );
    }
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 15000,
    });
    fromHeader = `"${cfg.fromName.replace(/"/g, '')}" <${cfg.fromEmail}>`;
  }

  const content = buildVerificationEmailContent({
    code: params.code,
    ttlMinutes: params.ttlMinutes,
    fullName: params.fullName,
  });

  try {
    const info = await transport.sendMail({
      from: fromHeader,
      to: recipient,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    const rejected = Array.isArray(info?.rejected)
      ? info.rejected.map((item) => String(item).toLowerCase())
      : [];
    const accepted = Array.isArray(info?.accepted)
      ? info.accepted.map((item) => String(item).toLowerCase())
      : [];

    if (rejected.includes(recipient) || (Array.isArray(info?.accepted) && accepted.length === 0)) {
      throw new EmailDeliveryError(
        'Email provider rejected the verification email recipient.',
        'EMAIL_DELIVERY_FAILED',
        502
      );
    }

    const domain = recipient.includes('@') ? recipient.split('@')[1] : 'unknown';
    logEvent('EmailDelivery', 'VERIFICATION_EMAIL_SENT', {
      provider: 'smtp',
      recipientDomain: domain,
      messageId: info?.messageId || null,
    });

    return { messageId: info?.messageId || null };
  } catch (err: any) {
    const domain = recipient.includes('@') ? recipient.split('@')[1] : 'unknown';
    logEvent('EmailDelivery', 'VERIFICATION_EMAIL_FAILED', {
      provider: 'smtp',
      recipientDomain: domain,
      message: err?.message || 'SMTP delivery failure',
    });

    if (err instanceof EmailDeliveryError) {
      throw err;
    }
    throw new EmailDeliveryError(
      'Unable to deliver the verification email right now. Please try again shortly.',
      'EMAIL_DELIVERY_FAILED',
      502
    );
  }
}
