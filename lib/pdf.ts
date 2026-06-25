import PDFDocument from "pdfkit";
import type { FunctionSheetData } from "./function-sheet";
import type { DocBlock, ImageMap } from "./doc-template";

const BRAND = "#4f46e5";
const INK = "#0f172a";
const MUTED = "#64748b";
const HIGHLIGHT = "#fef08a"; // yellow-200, marks lines changed since the prior version

// Draw a yellow background behind a region (used for changed line items).
function highlightRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.save();
  doc.rect(x, y, w, h).fill(HIGHLIGHT);
  doc.restore();
}

// Render a templated document (ordered blocks + sheet data) to a PDF buffer.
export function renderDocPdf(
  blocks: DocBlock[],
  data: FunctionSheetData,
  images?: ImageMap,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;

    for (const block of blocks) {
      switch (block.type) {
        case "heading":
          if (block.level === 1) {
            ensureSpace(doc, 40);
            doc.moveDown(0.2);
            doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(22).text(block.text);
          } else {
            ensureSpace(doc, 30);
            doc.moveDown(0.5);
            doc
              .fillColor(MUTED)
              .font("Helvetica-Bold")
              .fontSize(9)
              .text(block.text.toUpperCase(), { characterSpacing: 0.6 });
            doc.moveDown(0.2);
            divider(doc, left, right);
            doc.moveDown(0.2);
          }
          break;
        case "text":
          ensureSpace(doc, 16);
          doc.fillColor(INK).font("Helvetica").fontSize(10).text(block.text, { width: contentWidth });
          break;
        case "spacer":
          doc.moveDown(0.5);
          break;
        case "image": {
          const img = images?.get(block.src);
          // pdfkit embeds PNG/JPEG only.
          if (img && /^(png|jpg|jpeg)$/i.test(img.type)) {
            ensureSpace(doc, 60);
            doc.moveDown(0.3);
            try {
              doc.image(img.buffer, { fit: [contentWidth, 240], align: "center" });
              doc.moveDown(0.5);
            } catch {
              /* ignore unrenderable image */
            }
          }
          break;
        }
        case "schedule":
          renderSchedule(doc, data);
          break;
        case "product_table":
          renderProductTable(doc, data, left, right, contentWidth);
          break;
        case "room_block_table":
          renderRoomTable(doc, data, left, right, contentWidth);
          break;
        case "totals":
          renderTotals(doc, data, right, contentWidth);
          break;
      }
    }

    doc.end();
  });
}

function renderSchedule(doc: PDFKit.PDFDocument, data: FunctionSheetData) {
  if (data.slots.length === 0) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("No scheduled slots.");
    return;
  }
  for (const s of data.slots) {
    ensureSpace(doc, 24);
    const left = doc.page.margins.left;
    const cw = doc.page.width - doc.page.margins.right - left;
    if (s.changed) highlightRect(doc, left - 2, doc.y - 2, cw + 4, 26);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(s.label);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(s.range);
    doc.moveDown(0.15);
  }
}

function renderProductTable(
  doc: PDFKit.PDFDocument,
  data: FunctionSheetData,
  left: number,
  right: number,
  contentWidth: number,
) {
  if (data.groups.length === 0) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("No products.");
    return;
  }
  const cols = {
    item: left,
    qty: left + contentWidth * 0.5,
    unit: left + contentWidth * 0.62,
    tax: left + contentWidth * 0.76,
    total: left + contentWidth * 0.88,
  };
  for (const group of data.groups) {
    ensureSpace(doc, 50);
    doc.moveDown(0.2);
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10).text(group.label);
    let y = doc.y + 2;
    doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold");
    doc.text("ITEM", cols.item, y);
    doc.text("QTY", cols.qty, y, { width: contentWidth * 0.1, align: "right" });
    doc.text("UNIT NET", cols.unit, y, { width: contentWidth * 0.12, align: "right" });
    doc.text("TAX", cols.tax, y, { width: contentWidth * 0.1, align: "right" });
    doc.text("GROSS", cols.total, y, { width: contentWidth * 0.12, align: "right" });
    y = doc.y + 2;
    divider(doc, left, right, y);
    doc.moveDown(0.4);

    for (const line of group.lines) {
      ensureSpace(doc, 20);
      const rowY = doc.y;
      const titleH = doc
        .font("Helvetica")
        .fontSize(9.5)
        .heightOfString(line.title, { width: contentWidth * 0.48 });
      const rowH = Math.max(titleH, 12);
      if (line.changed) highlightRect(doc, left - 2, rowY - 2, contentWidth + 4, rowH + 4);
      doc.fontSize(9.5).fillColor(INK).font("Helvetica");
      doc.text(line.title, cols.item, rowY, { width: contentWidth * 0.48 });
      doc.text(String(line.quantity), cols.qty, rowY, { width: contentWidth * 0.1, align: "right" });
      doc.text(data.fmt(line.unitNet), cols.unit, rowY, { width: contentWidth * 0.12, align: "right" });
      doc.fillColor(MUTED).text(`${line.taxRate}%`, cols.tax, rowY, { width: contentWidth * 0.1, align: "right" });
      doc.fillColor(INK).font("Helvetica-Bold").text(data.fmt(line.gross), cols.total, rowY, { width: contentWidth * 0.12, align: "right" });
      doc.y = rowY + rowH;
      doc.moveDown(0.3);
    }
  }
}

function renderRoomTable(
  doc: PDFKit.PDFDocument,
  data: FunctionSheetData,
  left: number,
  right: number,
  contentWidth: number,
) {
  if (data.rooms.length === 0) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(10).text("No rooms booked.");
    return;
  }
  for (const r of data.rooms) {
    ensureSpace(doc, 26);
    const y = doc.y;
    if (r.changed) highlightRect(doc, left - 2, y - 2, contentWidth + 4, 28);
    doc.fontSize(9.5).fillColor(INK).font("Helvetica-Bold");
    doc.text(`${r.quantity}× ${r.title}`, left, y, { width: contentWidth * 0.6 });
    doc.font("Helvetica-Bold").text(data.fmt(r.gross), left + contentWidth * 0.8, y, {
      width: contentWidth * 0.2,
      align: "right",
    });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(
      `${r.range} · ${r.nights} night${r.nights !== 1 ? "s" : ""} · ${data.fmt(r.unitNet)}/night`,
      left,
      doc.y,
      { width: contentWidth * 0.8 },
    );
    doc.moveDown(0.3);
  }
}

function renderTotals(
  doc: PDFKit.PDFDocument,
  data: FunctionSheetData,
  right: number,
  contentWidth: number,
) {
  ensureSpace(doc, 90);
  doc.moveDown(0.2);
  const boxW = contentWidth * 0.45;
  const boxX = right - boxW;
  let by = doc.y;
  // Highlight the whole totals box when the grand totals changed.
  if (data.totalsChanged) {
    const bothShown = data.productTotals.gross > 0 && data.roomTotals.gross > 0;
    const rowCount = (bothShown ? 2 : 0) + 1 + data.totals.byRate.length;
    const boxH = rowCount * 14 + 6 + 18;
    highlightRect(doc, boxX - 4, by - 3, boxW + 8, boxH + 6);
  }
  const line = (label: string, value: string, bold = false) => {
    doc
      .fontSize(bold ? 11 : 9.5)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fillColor(bold ? INK : MUTED);
    doc.text(label, boxX, by, { width: boxW * 0.5 });
    doc.text(value, boxX + boxW * 0.5, by, { width: boxW * 0.5, align: "right" });
    by += bold ? 18 : 14;
  };
  if (data.productTotals.gross > 0 && data.roomTotals.gross > 0) {
    line("Products", data.fmt(data.productTotals.gross));
    line("Hotel rooms", data.fmt(data.roomTotals.gross));
  }
  line("Net", data.fmt(data.totals.net));
  for (const r of data.totals.byRate) line(`Tax @ ${r.taxRate}%`, data.fmt(r.taxAmount));
  doc.moveTo(boxX, by + 1).lineTo(right, by + 1).strokeColor("#cbd5e1").stroke();
  by += 6;
  line("Total", data.fmt(data.totals.gross), true);
  doc.y = by + 4;
}

function divider(doc: PDFKit.PDFDocument, x1: number, x2: number, y?: number) {
  const yy = y ?? doc.y;
  doc.moveTo(x1, yy).lineTo(x2, yy).strokeColor("#e2e8f0").stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}
