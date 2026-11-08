import { env } from '../config/env.js';

/**
 * ─── Email delivery ───────────────────────────────────────────────────────
 *
 * Phase 2 ships the `console` provider so the admin OTP flow can be built and
 * tested end-to-end without any third-party account. Real providers (SMTP /
 * Resend / Brevo) are completed in Phase 6 — until then they fail loudly so
 * nobody believes a mail was delivered.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Sends one email through the configured provider. */
export async function sendEmail(message: OutgoingEmail): Promise<void> {
  if (env.EMAIL_PROVIDER === 'console') {
    // Never log the OTP body here — the caller logs the code only in dev.
    console.log(`📧 [EMAIL:console] to=${message.to} subject="${message.subject}"`);
    return;
  }

  throw new Error(
    `EMAIL_PROVIDER="${env.EMAIL_PROVIDER}" is not implemented yet — finish Phase 6 before using it.`,
  );
}

/** Admin/staff sign-in code — the owner forwards it to the sub-admin. */
export async function sendAdminOtpEmail(
  email: string,
  code: string,
  brandName: string,
): Promise<void> {
  const subject = `${brandName} — admin sign-in code ${code}`;
  const text = [
    `Your ${brandName} admin sign-in code is ${code}.`,
    '',
    'It expires in 10 minutes and can be used once.',
    'If you did not request it, ignore this email and change your access key.',
  ].join('\n');

  await sendEmail({ to: email, subject, text });
}
