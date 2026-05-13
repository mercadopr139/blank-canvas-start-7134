// Shared receipt-content module.
//
// Both `send-receipt` (real outbound send + audit capture) and
// `backfill-receipt-sends` (regenerate prior sends into the audit table
// without sending) call into this module so the rendered PDF, HTML email
// body, plain-text body, and subject line stay byte-for-byte identical
// across the two code paths. If you change the receipt look, change it
// here and re-deploy both functions.

import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

export const ORG_NAME = "No Limits Academy Inc.";
export const ORG_GYM_ADDRESS_1 = "Gym Location:";
export const ORG_GYM_ADDRESS_2 = "1086 Route 47 South";
export const ORG_GYM_ADDRESS_3 = "Rio Grande, NJ 08242";
export const ORG_MAIL_ADDRESS_1 = "Mailing Address:";
export const ORG_MAIL_ADDRESS_2 = "301 North Vineyard Court";
export const ORG_MAIL_ADDRESS_3 = "Cape May, NJ 08204";
export const ORG_PHONE = "609-780-2761";
export const ORG_EMAIL = "info@nolimitsboxingacademy.org";
export const ORG_WEBSITE = "www.nolimitsboxingacademy.org";
export const ORG_EIN = "84-3998071";
export const SENDER_EMAIL = "alexandravalerio@nolimitsboxingacademy.org";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatReceiptDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface DonationRow {
  deposit_date: string;
  reference_id: string | null;
  amount: number;
}

export async function generateReceiptPdf(
  donorName: string,
  donations: DonationRow[],
  total: number,
  dateIssued: string,
  logoBytes?: Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_L = 60;
  const MARGIN_R = 60;
  const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.33, 0.33, 0.33);
  const lineGray = rgb(0.78, 0.78, 0.78);
  const headerBg = rgb(0.96, 0.96, 0.96);

  let logoImage: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (logoBytes && logoBytes.length > 0) {
    try {
      logoImage = await pdf.embedPng(logoBytes);
    } catch (e) {
      console.error("Logo embed failed:", e);
    }
  }

  const LOGO_SIZE = 54;
  const TEXT_X = MARGIN_L + LOGO_SIZE + 14;

  const drawHeader = (page: ReturnType<typeof pdf.addPage>): number => {
    let y = PAGE_H - 50;

    if (logoImage) {
      const aspect = logoImage.width / logoImage.height;
      const drawW = aspect >= 1 ? LOGO_SIZE : LOGO_SIZE * aspect;
      const drawH = aspect >= 1 ? LOGO_SIZE / aspect : LOGO_SIZE;
      page.drawImage(logoImage, {
        x: MARGIN_L,
        y: y + 10 - drawH,
        width: drawW,
        height: drawH,
      });
    }

    page.drawText(ORG_NAME, { x: TEXT_X, y, font: fontBold, size: 14, color: black });
    y -= 16;

    page.drawText(ORG_GYM_ADDRESS_1, { x: TEXT_X, y, font: fontBold, size: 9, color: gray });
    y -= 11;
    page.drawText(ORG_GYM_ADDRESS_2, { x: TEXT_X, y, font, size: 9, color: gray });
    y -= 11;
    page.drawText(ORG_GYM_ADDRESS_3, { x: TEXT_X, y, font, size: 9, color: gray });
    y -= 14;

    page.drawText(ORG_MAIL_ADDRESS_1, { x: TEXT_X, y, font: fontBold, size: 9, color: gray });
    y -= 11;
    page.drawText(ORG_MAIL_ADDRESS_2, { x: TEXT_X, y, font, size: 9, color: gray });
    y -= 11;
    page.drawText(ORG_MAIL_ADDRESS_3, { x: TEXT_X, y, font, size: 9, color: gray });
    y -= 18;

    page.drawLine({ start: { x: MARGIN_L, y }, end: { x: PAGE_W - MARGIN_R, y }, thickness: 1.5, color: black });
    y -= 24;

    return y;
  };

  const COL_DATE_X = MARGIN_L;
  const COL_REF_X = MARGIN_L + 90;
  const COL_AMT_X = MARGIN_L + 360;
  const ROW_H = 18;

  const drawTableHeader = (page: ReturnType<typeof pdf.addPage>, y: number): number => {
    page.drawRectangle({ x: MARGIN_L, y: y - 3, width: CONTENT_W, height: ROW_H, color: headerBg });
    const headerY = y;
    page.drawText("Date", { x: COL_DATE_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    page.drawText("Check # / Transaction ID", { x: COL_REF_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    page.drawText("Amount", { x: COL_AMT_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    return y - ROW_H - 2;
  };

  const drawWrappedText = (
    page: ReturnType<typeof pdf.addPage>,
    text: string,
    x: number,
    startY: number,
    f: typeof font,
    size: number,
    color = black,
    maxW = CONTENT_W,
  ): number => {
    let y = startY;
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxW) {
        page.drawText(line, { x, y, font: f, size, color });
        y -= size + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x, y, font: f, size, color });
      y -= size + 4;
    }
    return y;
  };

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = drawHeader(page);

  page.drawText(`Date Issued: ${dateIssued}`, { x: MARGIN_L, y, font: font, size: 10, color: black });
  y -= 20;

  page.drawText(`Dear ${(donorName?.trim() || "Supporter")},`, { x: MARGIN_L, y, font: font, size: 10, color: black });
  y -= 16;

  const thankYouText = `Thank you for your generous support of ${ORG_NAME} Your contribution helps us use the discipline of boxing to promote personal, professional, and spiritual development within our community.`;
  y = drawWrappedText(page, thankYouText, MARGIN_L, y, font, 10, black);
  y -= 6;

  const missionText = `${ORG_NAME} is a registered 501(c)(3) nonprofit organization, and we believe that the future of our community depends on investing in and empowering our youth through structured programs, accountability, and guidance.`;
  y = drawWrappedText(page, missionText, MARGIN_L, y, font, 10, black);
  y -= 6;

  const totalIntroText = `Your total tax-deductible contributions for the 2026 calendar year total: ${formatCurrency(total)}. A detailed summary of your 2026 donations is provided below for your records:`;
  y = drawWrappedText(page, totalIntroText, MARGIN_L, y, font, 10, black);
  y -= 10;

  page.drawText("2026 Donation Summary", { x: MARGIN_L, y, font: fontBold, size: 12, color: black });
  y -= 20;

  y = drawTableHeader(page, y);

  for (const d of donations) {
    if (y < 120) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = drawHeader(page);
      page.drawText("2026 Donation Summary (continued)", { x: MARGIN_L, y, font: fontBold, size: 12, color: black });
      y -= 20;
      y = drawTableHeader(page, y);
    }

    page.drawText(formatReceiptDate(d.deposit_date), { x: COL_DATE_X + 4, y, font, size: 9, color: black });
    page.drawText(d.reference_id || "—", { x: COL_REF_X + 4, y, font, size: 9, color: black });
    page.drawText(formatCurrency(d.amount), { x: COL_AMT_X + 4, y, font, size: 9, color: black });

    page.drawLine({ start: { x: MARGIN_L, y: y - 4 }, end: { x: PAGE_W - MARGIN_R, y: y - 4 }, thickness: 0.5, color: lineGray });
    y -= ROW_H;
  }

  if (y < 120) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = drawHeader(page);
  }
  page.drawRectangle({ x: MARGIN_L, y: y - 3, width: CONTENT_W, height: ROW_H, color: headerBg });
  page.drawText("TOTAL", { x: COL_DATE_X + 4, y, font: fontBold, size: 9, color: black });
  page.drawText(formatCurrency(total), { x: COL_AMT_X + 4, y, font: fontBold, size: 9, color: black });
  y -= ROW_H + 20;

  page.drawText("Sincerely,", { x: MARGIN_L, y, font, size: 10, color: black });
  y -= 14;
  page.drawText(ORG_NAME, { x: MARGIN_L, y, font: fontBold, size: 10, color: black });
  y -= 24;

  const disclaimerLines = [
    `Please retain this donation acknowledgment for your records. This receipt may be used for tax and accounting purposes. If you have any questions regarding your 2026 contributions, please contact ${ORG_NAME} at ${ORG_PHONE} or ${ORG_EMAIL}.`,
  ];
  for (const dl of disclaimerLines) {
    y = drawWrappedText(page, dl, MARGIN_L, y, font, 8, gray);
    y -= 4;
  }
  y -= 4;

  const legalLines = [
    "No goods or services were provided in exchange for this contribution.",
    `${ORG_NAME} is a 501(c)(3) nonprofit organization.`,
    `EIN: ${ORG_EIN}`,
    "Contributions are tax-deductible to the fullest extent allowed by law.",
  ];
  for (const ll of legalLines) {
    if (y < 40) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 60;
    }
    page.drawText(ll, { x: MARGIN_L, y, font, size: 8, color: gray });
    y -= 12;
  }

  y -= 8;
  if (y < 60) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 60;
  }
  page.drawText(ORG_NAME, { x: MARGIN_L, y, font: fontBold, size: 8, color: gray });
  y -= 12;
  page.drawText(`Phone: ${ORG_PHONE}`, { x: MARGIN_L, y, font, size: 8, color: gray });
  y -= 12;
  page.drawText(`Email: ${ORG_EMAIL}`, { x: MARGIN_L, y, font, size: 8, color: gray });
  y -= 12;
  page.drawText(`Website: ${ORG_WEBSITE}`, { x: MARGIN_L, y, font, size: 8, color: gray });

  return await pdf.save();
}

export function buildReceiptEmailHtml(
  receiptName: string,
  personalMessage: string | null | undefined,
  logoUrl: string,
): string {
  const personalHtml = personalMessage
    ? `<p style="margin:0 0 24px;color:#222;font-size:15px;line-height:1.7;">${escapeHtml(personalMessage).replace(/\n/g, "<br/>")}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Logo Header -->
  <tr>
    <td align="center" style="background:#000000;padding:28px 32px;">
      <img src="${logoUrl}" alt="No Limits Academy" width="160" style="display:block;max-width:160px;height:auto;" />
    </td>
  </tr>

  <!-- Body Content -->
  <tr>
    <td style="padding:36px 40px 20px;">
      <p style="margin:0 0 20px;color:#222;font-size:15px;line-height:1.7;">Dear ${receiptName},</p>
      ${personalHtml}
      <p style="margin:0 0 20px;color:#222;font-size:15px;line-height:1.7;">Please find your <strong>2026 Annual Donation Receipt</strong> attached to this email for your records.</p>
      <p style="margin:0 0 28px;color:#222;font-size:15px;line-height:1.7;">Thank you for your generous support. Your contribution helps us use the discipline of boxing to promote personal, professional, and spiritual development within our community.</p>
    </td>
  </tr>

  <!-- Sign-off -->
  <tr>
    <td style="padding:0 40px 32px;">
      <p style="margin:0 0 4px;color:#222;font-size:15px;">Sincerely,</p>
      <p style="margin:0;color:#000;font-size:16px;font-weight:bold;">Alexandra Valerio Mercado</p>
      <p style="margin:0;color:#222;font-size:14px;">Assistant Program Coordinator</p>
      <p style="margin:0 0 16px;color:#222;font-size:14px;">No Limits Academy Inc.</p>
      <p style="margin:0 0 4px;color:#555;font-size:13px;">
        <a href="https://www.nolimitsboxingacademy.org" style="color:#1a73e8;text-decoration:none;font-weight:bold;">www.nolimitsboxingacademy.org</a>
      </p>
      <p style="margin:0;color:#555;font-size:13px;">
        <a href="https://www.instagram.com/nolimitsboxingacademy/" style="color:#555;text-decoration:none;">Instagram</a>
        &nbsp;&bull;&nbsp;
        <a href="https://www.facebook.com/nolimitsboxingacademy/" style="color:#555;text-decoration:none;">Facebook</a>
        &nbsp;&bull;&nbsp;
        <a href="mailto:info@nolimitsboxingacademy.org" style="color:#555;text-decoration:none;">info@nolimitsboxingacademy.org</a>
      </p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #eee;">
      <p style="margin:0;color:#999;font-size:11px;line-height:1.5;text-align:center;">
        You may reply directly to this email with any questions.<br/>
        No Limits Academy Inc. &bull; EIN: 84-3998071 &bull; 501(c)(3) Nonprofit
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildReceiptEmailText(
  receiptName: string,
  personalMessage: string | null | undefined,
): string {
  const personalText = personalMessage ? `${personalMessage}\n\n` : "";
  return `Dear ${receiptName},

${personalText}Please find your 2026 Annual Donation Receipt attached to this email for your records.

Thank you for your generous support. Your contribution helps us use the discipline of boxing to promote personal, professional, and spiritual development within our community.

Sincerely,
Alexandra Valerio Mercado
Assistant Program Coordinator
No Limits Academy Inc.

www.nolimitsboxingacademy.org
Instagram: @nolimitsboxingacademy
Facebook: facebook.com/nolimitsboxingacademy
Email: info@nolimitsboxingacademy.org

EIN: 84-3998071 | 501(c)(3) Nonprofit`;
}

export const RECEIPT_SUBJECT = `Your 2026 Donation Receipt from No Limits Academy`;
export const RECEIPT_PDF_FILENAME_PREFIX = `2026-Donation-Receipt-`;
