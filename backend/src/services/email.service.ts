import { env } from '../config/env.js';

/**
 * ─── Email delivery ───────────────────────────────────────────────────────
 *
 * Phase 2 shipped the `console` provider so the admin OTP flow could be built
 * without a third-party account. Phase 6 adds the real transports.
 *
 *   console  dev only — logs "a mail would go out", never the code
 *   brevo    https://api.brevo.com/v3/smtp/email   (free: 300/day)
 *   resend   https://api.resend.com/emails         (free: 3000/month)
 *   smtp     not wired — needs nodemailer; fails loudly so nobody assumes it sent
 *
 * Rules this file must keep:
 *  • the OTP / permission key value never appears in a log line we write;
 *  • a provider failure throws, so the caller can drop the OTP row and 502;
 *  • one hung request cannot block a login (hard timeout).
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface Sender {
  name: string;
  email: string;
}

/**
 * `"Brand <no-reply@x.com>"` → `{ name: 'Brand', email: 'no-reply@x.com' }`.
 * A bare address is accepted too; the display name falls back to the local part.
 */
export function parseFromAddress(raw: string): Sender {
  const value = (raw ?? '').trim();
  const match = /^(.*?)<\s*([^>]+?)\s*>$/.exec(value);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    const email = match[2].trim();
    return { name: name || email.split('@')[0] || email, email };
  }
  const email = value || 'no-reply@localhost';
  return { name: email.split('@')[0] || email, email };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.EMAIL_TIMEOUT_MS),
    });
  } catch (error) {
    // Network error / timeout — the message never carries the mail body.
    const reason = (error as Error).name === 'TimeoutError' ? 'timed out' : 'network error';
    throw new Error(`email provider ${reason}`);
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      /* body is optional */
    }
    throw new Error(`email provider rejected the request (${response.status})${detail ? `: ${detail}` : ''}`);
  }
}

/** Sends one email through the configured provider. */
export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const sender = parseFromAddress(env.EMAIL_FROM);

  switch (env.EMAIL_PROVIDER) {
    case 'console': {
      // Never log the body here — the caller logs the code only outside production.
      console.log(`📧 [EMAIL:console] to=${message.to} subject="${message.subject}"`);
      return;
    }

    case 'brevo': {
      if (!env.BREVO_API_KEY) {
        throw new Error('BREVO_API_KEY is not set — cannot send mail with EMAIL_PROVIDER=brevo');
      }
      await postJson(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
        {
          sender,
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          ...(message.html ? { htmlContent: message.html } : {}),
        },
      );
      console.log(`📧 [EMAIL:brevo] sent to=${message.to}`);
      return;
    }

    case 'resend': {
      if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not set — cannot send mail with EMAIL_PROVIDER=resend');
      }
      await postJson(
        'https://api.resend.com/emails',
        { authorization: `Bearer ${env.RESEND_API_KEY}` },
        {
          from: `${sender.name} <${sender.email}>`,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        },
      );
      console.log(`📧 [EMAIL:resend] sent to=${message.to}`);
      return;
    }

    default:
      throw new Error(
        `EMAIL_PROVIDER="${env.EMAIL_PROVIDER}" is not implemented — use console, brevo or resend.`,
      );
  }
}

/** Minimal, email-client-safe HTML shell (inline styles, no external assets). */
function otpEmailHtml(input: {
  brandName: string;
  heading: string;
  intro: string;
  code: string;
  footer: string;
}): string {
  return [
    '<div style="margin:0;padding:24px;background:#0b1120;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">',
    '<div style="height:6px;background:#FF5722;"></div>',
    '<div style="padding:24px 24px 8px 24px;">',
    `<p style="margin:0 0 4px 0;font-size:13px;letter-spacing:1px;color:#64748b;text-transform:uppercase;">${input.brandName}</p>`,
    `<h1 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">${input.heading}</h1>`,
    `<p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">${input.intro}</p>`,
    '<div style="margin:0 0 20px 0;padding:16px;background:#f1f5f9;border-radius:10px;text-align:center;">',
    `<span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#0f172a;font-family:Consolas,monospace;">${input.code}</span>`,
    '</div>',
    `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">${input.footer}</p>`,
    '</div>',
    '<p style="margin:0;padding:0 24px 20px 24px;font-size:11px;color:#94a3b8;">',
    'Automated message — please do not reply to this email.',
    '</p>',
    '</div>',
    '</div>',
  ].join('');
}

/** Admin/staff sign-in code — the owner forwards it to the sub-admin. */
export async function sendAdminOtpEmail(
  email: string,
  code: string,
  brandName: string,
): Promise<void> {
  // The code sits in the subject so the owner can forward it from the lock screen.
  const subject = `${brandName} — admin sign-in code ${code}`;
  const text = [
    `Your ${brandName} admin sign-in code is ${code}.`,
    '',
    'It expires in 10 minutes and can be used once.',
    'If you did not request it, ignore this email and change your access key.',
  ].join('\n');

  const html = otpEmailHtml({
    brandName,
    heading: 'Admin sign-in code',
    intro: 'Use this code to finish signing in to the admin console. It expires in 10 minutes.',
    code,
    footer:
      'If you did not request this code, ignore this email and rotate your access key from the Staff screen.',
  });

  await sendEmail({ to: email, subject, text, html });
}

/** Player email OTP (register / login) — same shell, different wording. */
export async function sendPlayerOtpEmail(
  email: string,
  code: string,
  brandName: string,
): Promise<void> {
  const subject = `${brandName} — your verification code ${code}`;
  const text = [
    `Your ${brandName} verification code is ${code}.`,
    '',
    'It expires in 10 minutes and can be used once.',
    'If you did not request it, ignore this email.',
  ].join('\n');

  const html = otpEmailHtml({
    brandName,
    heading: 'Verification code',
    intro: 'Use this code to finish signing in. It expires in 10 minutes.',
    code,
    footer: 'If you did not request this code, ignore this email — nothing will change.',
  });

  await sendEmail({ to: email, subject, text, html });
}
