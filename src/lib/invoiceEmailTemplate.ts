const LOGO_URL = "https://rkdkmzjontaufbyjbcku.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";

export type InvoiceEmailMode = "initial" | "resend";

export interface InvoiceEmailOptions {
  mode: InvoiceEmailMode;
  invoiceNumber: string;
  clientName: string;
  periodLabel: string;
  total: string;
  note?: string | null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildInvoiceEmailSubject({
  mode,
  invoiceNumber,
  clientName,
  periodLabel,
}: Pick<InvoiceEmailOptions, "mode" | "invoiceNumber" | "clientName" | "periodLabel">): string {
  return mode === "resend"
    ? `Friendly Reminder: Invoice ${invoiceNumber} – ${clientName} – ${periodLabel}`
    : `Invoice ${invoiceNumber} – No Limits Academy`;
}

export function renderInvoiceEmailHtml({
  mode,
  invoiceNumber,
  clientName,
  periodLabel,
  total,
  note,
}: InvoiceEmailOptions): string {
  const titleLine = mode === "resend" ? `Reminder: Invoice ${invoiceNumber}` : `Invoice ${invoiceNumber}`;

  const greetingLine = mode === "resend"
    ? `Hi <strong>${escapeHtml(clientName)}</strong> — a friendly reminder that your <strong>${escapeHtml(periodLabel)}</strong> invoice is still outstanding (attached below).`
    : `Hi <strong>${escapeHtml(clientName)}</strong> — your <strong>${escapeHtml(periodLabel)}</strong> invoice is attached below.`;

  const trimmedNote = note?.trim();
  const noteHtml = trimmedNote
    ? `<p style="margin: 0 0 24px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151; white-space: pre-wrap;">${escapeHtml(trimmedNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titleLine)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Compact letterhead: logo + wordmark inline, no tagline -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px;">
                    <img src="${LOGO_URL}" alt="" style="height: 44px; width: auto; display: block;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 700; color: #111827; letter-spacing: 0.3px;">No Limits Academy</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <!-- Title row: invoice number left, period right -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 22px 0;">
                <tr>
                  <td style="vertical-align: middle;">
                    <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #111827;">${escapeHtml(titleLine)}</h1>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">${escapeHtml(periodLabel)}</span>
                  </td>
                </tr>
              </table>

              <!-- Greeting + attachment callout merged -->
              <p style="margin: 0 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151;">${greetingLine}</p>

              <!-- Personal message: plain paragraph in Josh's voice, no callout -->
              ${noteHtml}

              <!-- Amount Due anchor card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Amount Due</p>
                    <p style="margin: 0 0 10px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 800; color: #111827;">${escapeHtml(total)}</p>
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6b7280;">Due within 30 days of invoice date</p>
                  </td>
                </tr>
              </table>

              <!-- Sign-off (no divider, flows naturally from the message) -->
              <p style="margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; color: #374151;">With Gratitude,</p>
              <p style="margin: 0 0 2px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 700; color: #111827;">Josh Mercado</p>
              <p style="margin: 0 0 2px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Program Director, No Limits Academy</p>
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">joshmercado@nolimitsboxingacademy.org</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
