import { logger } from '../lib/logger.js';

export interface AlertPayload {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

function webhookUrlFor(type: string): string | undefined {
  if (type.startsWith('etl_')) {
    return process.env.ETL_WEBHOOK_URL?.trim() || process.env.ALERT_WEBHOOK_URL?.trim();
  }
  return process.env.ALERT_WEBHOOK_URL?.trim();
}

async function postWebhook(url: string, payload: AlertPayload): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Webhook responded with ${res.status}`);
  }
}

async function sendSmtpEmail(payload: AlertPayload): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  const to = process.env.ALERT_EMAIL_TO?.trim();
  if (!host || !to) return;

  const nodemailer = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER || 'tess@localhost',
    to,
    subject: `[TESS] ${payload.title}`,
    text: `${payload.message}\n\nType: ${payload.type}`,
  });
}

/** Fire-and-forget external alert delivery when env vars are configured. */
export function deliverExternalAlert(payload: AlertPayload): void {
  void (async () => {
    const webhook = webhookUrlFor(payload.type);
    if (webhook) {
      try {
        await postWebhook(webhook, payload);
      } catch (err) {
        logger.warn({ err, type: payload.type }, 'Alert webhook delivery failed');
      }
    }

    if (process.env.SMTP_HOST?.trim() && process.env.ALERT_EMAIL_TO?.trim()) {
      try {
        await sendSmtpEmail(payload);
      } catch (err) {
        logger.warn({ err, type: payload.type }, 'Alert email delivery failed');
      }
    }
  })();
}
