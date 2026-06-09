import { jsPDF } from "jspdf";
import { format } from "date-fns";

/**
 * Generates and downloads a payment receipt PDF.
 *
 * @param {object} opts
 * @param {object} opts.payment        - The Accounts entity record
 * @param {string} opts.paidByName     - Display name of the cadet/adult who paid
 * @param {string} opts.creatorName    - Display name of the person who created this receipt
 * @param {string} opts.dcRank         - DC rank (from DetachmentSettings)
 * @param {string} opts.dcName         - DC name (from DetachmentSettings)
 * @param {string} opts.dcTitle        - DC title (from DetachmentSettings)
 */
export function generatePaymentReceiptPDF({ payment, paidByName, creatorName, dcRank, dcName, dcTitle }) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function centredText(text, y, size = 11, style = "normal") {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.text(text, pageW / 2, y, { align: "center" });
  }

  function labelValue(label, value, y) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(label + ":  ");
    const lines = doc.splitTextToSize(String(value || "—"), contentW - labelW);
    doc.text(lines, margin + labelW, y);
    return y + lines.length * 5.5;
  }

  let y = 14;

  // ── Header ───────────────────────────────────────────────────────────────────
  centredText("LEIGH DETACHMENT", y, 13, "bold"); y += 6;
  centredText("5 (Anzio) Company", y, 10, "normal"); y += 5;
  centredText("Greater Manchester Army Cadet Force", y, 10, "normal"); y += 6;

  // Divider
  doc.setDrawColor(40, 80, 50);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y); y += 6;

  // Receipt title
  centredText("PAYMENT RECEIPT", y, 14, "bold"); y += 7;

  // ── Body text ────────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const intro = "A payment has been received from the person named below.";
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 5.5 + 4;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y); y += 5;

  // ── Details ──────────────────────────────────────────────────────────────────
  const dateStr = payment.Date
    ? format(new Date(payment.Date + "T00:00:00"), "d MMMM yyyy")
    : "—";

  y = labelValue("Date of Payment", dateStr, y); y += 1;
  y = labelValue("Receipt No (RV)", payment.SerialNo || "—", y); y += 1;
  y = labelValue("Amount", `£${(payment.Amount || 0).toFixed(2)}`, y); y += 1;
  y = labelValue("Reason for Payment", payment.Details || "—", y); y += 1;
  y = labelValue("Paid By", paidByName || "—", y); y += 4;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y); y += 6;

  // ── Sign-off ──────────────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");

  const dcFullTitle = [dcRank, dcName].filter(Boolean).join(" ");
  const dcLine = dcFullTitle ? `${dcFullTitle}, ${dcTitle || "Detachment Commander"}` : (dcTitle || "Detachment Commander");

  let signOff;
  if (creatorName && creatorName !== dcFullTitle) {
    signOff = `With thanks, ${creatorName}, on behalf of ${dcLine}.`;
  } else {
    signOff = `With thanks, ${dcLine}.`;
  }

  const signOffLines = doc.splitTextToSize(signOff, contentW);
  doc.text(signOffLines, margin, y);
  y += signOffLines.length * 5 + 4;

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("This receipt was generated electronically by the Leigh Detachment Training Manager.", pageW / 2, y, { align: "center" });

  // ── Save ──────────────────────────────────────────────────────────────────────
  const filename = `receipt_${payment.SerialNo || "RV"}_${payment.Date || "date"}.pdf`;
  doc.save(filename);
}