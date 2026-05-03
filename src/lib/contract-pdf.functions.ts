import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Buffer } from "node:buffer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  loanId: z.string().uuid(),
  accessToken: z.string().min(20),
});

// Helvetica (WinAnsi) cannot encode characters like U+202F (narrow nbsp) or U+00A0 (nbsp)
// that French Intl formatters insert. Strip them to safe ASCII.
function sanitize(s: string): string {
  return s
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\u2009/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, "-");
}

function eur(n: number) {
  return sanitize(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n));
}

function date(iso: string) {
  return sanitize(new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(iso)));
}

// Estimate effective annual interest (TAEG) — fixed demo rate
const ANNUAL_RATE = 0.049; // 4.9%
function monthlyPayment(principal: number, months: number, annualRate: number) {
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export const generateContractPdf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Session expirée. Veuillez vous reconnecter.");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

    const { data: loan, error } = await supabaseAdmin
      .from("loans")
      .select("id, user_id, full_name, email, amount, duration_months, monthly_income, purpose, status, created_at")
      .eq("id", data.loanId)
      .maybeSingle();

    if (error || !loan) {
      throw new Error("Prêt introuvable");
    }
    if (!isAdmin && loan.user_id !== authData.user.id) {
      throw new Error("Accès non autorisé à ce contrat");
    }

    const amount = Number(loan.amount);
    const months = Number(loan.duration_months);
    const monthly = monthlyPayment(amount, months, ANNUAL_RATE);
    const totalCost = monthly * months;
    const interestCost = totalCost - amount;

    // Build PDF
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Contrat de prêt — HSBC BANK — ${loan.id.slice(0, 8)}`);
    pdf.setAuthor("HSBC BANK");
    pdf.setCreator("HSBC BANK");
    pdf.setProducer("HSBC BANK Contract Generator");
    pdf.setCreationDate(new Date());

    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.addPage([595.28, 841.89]); // A4
    // Wrap drawText to always sanitize unicode -> WinAnsi safe.
    const originalDrawText = page.drawText.bind(page);
    page.drawText = ((text: string, options?: Parameters<typeof originalDrawText>[1]) =>
      originalDrawText(sanitize(text), options)) as typeof page.drawText;
    const width = page.getWidth();
    const height = page.getHeight();

    const ink = rgb(0.10, 0.10, 0.12);
    const muted = rgb(0.42, 0.42, 0.46);
    const accent = rgb(0.13, 0.55, 0.43);
    const line = rgb(0.86, 0.86, 0.86);

    const margin = 50;
    let y = height - margin;

    const hsbcRed = rgb(0.85, 0.0, 0.0);
    // === Header band ===
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.98, 0.98, 0.97) });
    // HSBC hexagonal logo (deux triangles rouges + carrés blancs)
    const lx = margin, ly = height - 60, ls = 32;
    page.drawRectangle({ x: lx, y: ly, width: ls, height: ls, color: rgb(1, 1, 1), borderColor: hsbcRed, borderWidth: 1 });
    page.drawRectangle({ x: lx, y: ly + ls / 2, width: ls / 2, height: ls / 2, color: hsbcRed });
    page.drawRectangle({ x: lx + ls / 2, y: ly, width: ls / 2, height: ls / 2, color: hsbcRed });
    page.drawText("HSBC BANK", { x: margin + 42, y: height - 47, size: 16, font: helvBold, color: hsbcRed });
    page.drawText("Crédit en ligne — Contrat officiel", {
      x: margin + 42, y: height - 62, size: 8, font: helv, color: muted,
    });
    // Right meta
    const refText = sanitize(`Réf. ${loan.id.slice(0, 8).toUpperCase()}`);
    const refW = helvBold.widthOfTextAtSize(refText, 10);
    page.drawText(refText, { x: width - margin - refW, y: height - 47, size: 10, font: helvBold, color: ink });
    const dateText = sanitize(`Émis le ${date(new Date().toISOString())}`);
    const dateW = helv.widthOfTextAtSize(dateText, 9);
    page.drawText(dateText, { x: width - margin - dateW, y: height - 62, size: 9, font: helv, color: muted });

    y = height - 110;

    // Title
    page.drawText("Contrat de prêt personnel", { x: margin, y, size: 22, font: helvBold, color: ink });
    y -= 26;
    page.drawText("Document contractuel — à conserver précieusement", {
      x: margin, y, size: 10, font: helv, color: muted,
    });
    y -= 28;

    // === Parties ===
    drawSectionTitle(page, helvBold, "1. Parties", margin, y, ink, accent);
    y -= 22;
    drawKV(page, helv, helvBold, "Preteur", sanitize("HSBC BANK SAS - 12 rue de la Finance, 75002 Paris"), margin, y, ink, muted);
    y -= 16;
    drawKV(page, helv, helvBold, "Emprunteur", sanitize(`${loan.full_name} - ${loan.email}`), margin, y, ink, muted);
    y -= 28;

    // === Conditions ===
    drawSectionTitle(page, helvBold, "2. Conditions du prêt", margin, y, ink, accent);
    y -= 22;

    // Highlight box for amount
    const boxY = y - 60;
    page.drawRectangle({
      x: margin, y: boxY, width: width - margin * 2, height: 70,
      color: rgb(0.97, 0.99, 0.97), borderColor: rgb(0.85, 0.92, 0.87), borderWidth: 1,
    });
    page.drawText("MONTANT DU PRÊT", { x: margin + 16, y: y - 14, size: 8, font: helvBold, color: muted });
    page.drawText(eur(amount), { x: margin + 16, y: y - 38, size: 26, font: helvBold, color: ink });

    page.drawText("DURÉE", { x: margin + 220, y: y - 14, size: 8, font: helvBold, color: muted });
    page.drawText(`${months} mois`, { x: margin + 220, y: y - 38, size: 18, font: helvBold, color: ink });

    page.drawText("TAEG FIXE", { x: margin + 360, y: y - 14, size: 8, font: helvBold, color: muted });
    page.drawText(`${(ANNUAL_RATE * 100).toFixed(2)} %`, { x: margin + 360, y: y - 38, size: 18, font: helvBold, color: accent });

    y = boxY - 22;

    drawKV(page, helv, helvBold, "Mensualité", `${eur(monthly)} / mois`, margin, y, ink, muted);
    y -= 16;
    drawKV(page, helv, helvBold, "Coût total des intérêts", eur(interestCost), margin, y, ink, muted);
    y -= 16;
    drawKV(page, helv, helvBold, "Montant total dû", eur(totalCost), margin, y, ink, muted);
    y -= 16;
    drawKV(page, helv, helvBold, "Objet du pret", sanitize(loan.purpose || "Non precise"), margin, y, ink, muted);
    y -= 28;

    // === Engagements ===
    drawSectionTitle(page, helvBold, "3. Engagements", margin, y, ink, accent);
    y -= 22;
    const clauses = [
      "L'emprunteur s'engage à rembourser le capital prêté augmenté des intérêts selon les",
      "mensualités définies ci-dessus. Le prêt est fixe et amortissable mensuellement.",
      "",
      "Tout retard de paiement de plus de 30 jours pourra entraîner l'exigibilité immédiate",
      "du capital restant dû, des intérêts échus et des frais y afférents.",
      "",
      "L'emprunteur dispose d'un délai légal de rétractation de 14 jours calendaires à",
      "compter de la signature du présent contrat (art. L312-19 du Code de la consommation).",
    ];
    for (const ln of clauses) {
      page.drawText(ln, { x: margin, y, size: 9.5, font: helv, color: ink });
      y -= 13;
    }

    y -= 18;

    // === Signature block ===
    drawSectionTitle(page, helvBold, "4. Acceptation et signature", margin, y, ink, accent);
    y -= 22;

    // Two signature boxes
    const sigW = (width - margin * 2 - 24) / 2;
    const sigH = 110;

    // === Signature prêteur (avec cachet HSBC) ===
    page.drawRectangle({ x: margin, y: y - sigH, width: sigW, height: sigH, borderColor: line, borderWidth: 1, color: rgb(1, 1, 1) });
    page.drawText("Signature du prêteur", { x: margin + 10, y: y - 16, size: 9, font: helvBold, color: muted });
    page.drawText("HSBC BANK SAS", { x: margin + 10, y: y - 30, size: 9, font: helv, color: ink });

    // Cachet circulaire HSBC (rouge, à droite dans la box)
    const stampCx = margin + sigW - 42;
    const stampCy = y - sigH / 2 - 4;
    const stampR = 32;
    const hsbcRed = rgb(0.85, 0.0, 0.0);
    page.drawCircle({ x: stampCx, y: stampCy, size: stampR, borderColor: hsbcRed, borderWidth: 2, color: rgb(1, 1, 1) });
    page.drawCircle({ x: stampCx, y: stampCy, size: stampR - 4, borderColor: hsbcRed, borderWidth: 0.6, color: rgb(1, 1, 1) });
    // Petits triangles rouges (rappel logo HSBC)
    const tw = 6;
    page.drawRectangle({ x: stampCx - tw, y: stampCy + 4, width: tw, height: 6, color: hsbcRed });
    page.drawRectangle({ x: stampCx, y: stampCy - 10, width: tw, height: 6, color: hsbcRed });
    page.drawText("HSBC", { x: stampCx - 12, y: stampCy + 14, size: 8, font: helvBold, color: hsbcRed });
    page.drawText("BANK", { x: stampCx - 11, y: stampCy - 22, size: 7, font: helvBold, color: hsbcRed });
    page.drawText("PARIS", { x: stampCx - 11, y: stampCy - 30, size: 6, font: helv, color: hsbcRed });

    // Signature électronique stylisée (script)
    page.drawText("HSBC BANK SAS", { x: margin + 14, y: y - sigH + 38, size: 14, font: helvBold, color: rgb(0.05, 0.18, 0.45) });
    page.drawLine({ start: { x: margin + 14, y: y - sigH + 34 }, end: { x: margin + 130, y: y - sigH + 34 }, thickness: 1, color: rgb(0.05, 0.18, 0.45) });
    page.drawText("Signé électroniquement · " + new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
      { x: margin + 14, y: y - sigH + 14, size: 7, font: helv, color: muted });
    page.drawText("Certificat: HSBC-eSign-" + loan.id.slice(0, 8).toUpperCase(),
      { x: margin + 14, y: y - sigH + 6, size: 6.5, font: helv, color: muted });

    page.drawRectangle({ x: margin + sigW + 24, y: y - sigH, width: sigW, height: sigH, borderColor: line, borderWidth: 1, color: rgb(1, 1, 1) });
    page.drawText("Signature de l'emprunteur", { x: margin + sigW + 34, y: y - 16, size: 9, font: helvBold, color: muted });
    page.drawText('Faire précéder la signature de la mention "Lu et approuvé"', {
      x: margin + sigW + 34, y: y - 30, size: 8, font: helv, color: muted,
    });
    page.drawText(loan.full_name, { x: margin + sigW + 34, y: y - sigH + 12, size: 9, font: helv, color: muted });

    // Footer
    page.drawLine({
      start: { x: margin, y: 60 }, end: { x: width - margin, y: 60 },
      thickness: 0.5, color: line,
    });
    page.drawText("HSBC BANK SAS · contact@lendly.app · MVP de démonstration", {
      x: margin, y: 46, size: 8, font: helv, color: muted,
    });
    page.drawText(`Page 1 / 1 · Réf. ${loan.id.slice(0, 8).toUpperCase()}`, {
      x: width - margin - 140, y: 46, size: 8, font: helv, color: muted,
    });

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");

    return {
      base64,
      filename: `contrat-lendly-${loan.id.slice(0, 8)}.pdf`,
    };
  });

function drawSectionTitle(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  text: string,
  x: number,
  y: number,
  ink: ReturnType<typeof rgb>,
  accent: ReturnType<typeof rgb>,
) {
  page.drawRectangle({ x, y: y + 2, width: 3, height: 12, color: accent });
  page.drawText(text, { x: x + 10, y: y + 2, size: 11, font, color: ink });
}

function drawKV(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  key: string,
  value: string,
  x: number,
  y: number,
  ink: ReturnType<typeof rgb>,
  muted: ReturnType<typeof rgb>,
) {
  page.drawText(key, { x, y, size: 9, font, color: muted });
  page.drawText(value, { x: x + 140, y, size: 10, font: fontBold, color: ink });
}
