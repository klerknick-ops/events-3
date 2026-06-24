import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { FunctionSheetData, FunctionSheetGroup } from "./function-sheet";
import type { DocBlock, ImageMap } from "./doc-template";

const BRAND = "4F46E5";
const MUTED = "64748B";

type DocxImageType = "png" | "jpg" | "gif" | "bmp";

// Render templated document blocks + sheet data to an editable .docx buffer.
export async function renderDocDocx(
  blocks: DocBlock[],
  data: FunctionSheetData,
  images?: ImageMap,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        if (block.level === 1) {
          children.push(
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: block.text, bold: true, size: 44, color: BRAND })],
            }),
          );
        } else {
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 240, after: 80 },
              children: [new TextRun({ text: block.text, bold: true, size: 20, color: MUTED })],
            }),
          );
        }
        break;
      case "text":
        children.push(new Paragraph({ children: [new TextRun({ text: block.text, size: 20 })] }));
        break;
      case "spacer":
        children.push(new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }));
        break;
      case "image": {
        const img = images?.get(block.src);
        if (img) {
          const maxW = 450;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const t = img.type === "jpeg" ? "jpg" : img.type;
          const allowed: DocxImageType[] = ["png", "jpg", "gif", "bmp"];
          if (allowed.includes(t as DocxImageType)) {
            children.push(
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [
                  new ImageRun({
                    data: img.buffer,
                    type: t as DocxImageType,
                    transformation: {
                      width: Math.round(img.width * scale),
                      height: Math.round(img.height * scale),
                    },
                  }),
                ],
              }),
            );
          }
        }
        break;
      }
      case "schedule":
        if (data.slots.length === 0) {
          children.push(muted("No scheduled slots."));
        } else {
          for (const s of data.slots) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${s.label}: `, bold: true, size: 20 }),
                  new TextRun({ text: s.range, size: 20, color: MUTED }),
                ],
              }),
            );
          }
        }
        break;
      case "product_table":
        if (data.groups.length === 0) children.push(muted("No products."));
        for (const group of data.groups) {
          children.push(
            new Paragraph({
              spacing: { before: 140, after: 60 },
              children: [new TextRun({ text: group.label, bold: true, color: BRAND, size: 22 })],
            }),
          );
          children.push(productTable(group, data.fmt));
        }
        break;
      case "room_block_table":
        if (data.rooms.length === 0) {
          children.push(muted("No rooms booked."));
        } else {
          for (const r of data.rooms) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${r.quantity}× ${r.title} — `, bold: true, size: 20 }),
                  new TextRun({
                    text: `${r.range} · ${r.nights} night${r.nights !== 1 ? "s" : ""} · ${data.fmt(r.gross)}`,
                    size: 20,
                    color: MUTED,
                  }),
                ],
              }),
            );
          }
        }
        break;
      case "totals":
        if (data.productTotals.gross > 0 && data.roomTotals.gross > 0) {
          children.push(totalLine("Products", data.fmt(data.productTotals.gross)));
          children.push(totalLine("Hotel rooms", data.fmt(data.roomTotals.gross)));
        }
        children.push(totalLine("Net", data.fmt(data.totals.net)));
        for (const r of data.totals.byRate) {
          children.push(totalLine(`Tax @ ${r.taxRate}%`, data.fmt(r.taxAmount)));
        }
        children.push(totalLine("Total", data.fmt(data.totals.gross), true));
        break;
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

function muted(text: string) {
  return new Paragraph({ children: [new TextRun({ text, color: MUTED, size: 20 })] });
}

function totalLine(label: string, value: string, bold = false) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold, size: bold ? 24 : 20 }),
      new TextRun({ text: value, bold, size: bold ? 24 : 20 }),
    ],
  });
}

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function productTable(group: FunctionSheetGroup, fmt: (n: number) => string) {
  const headers = ["Item", "Qty", "Unit net", "Tax", "Gross"];
  const widths = [40, 12, 18, 12, 18];
  const headerCells = headers.map((t, i) =>
    new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
          children: [new TextRun({ text: t, bold: true, size: 16, color: MUTED })],
        }),
      ],
    }),
  );
  const rows = [new TableRow({ children: headerCells })];
  for (const line of group.lines) {
    const values = [line.title, String(line.quantity), fmt(line.unitNet), `${line.taxRate}%`, fmt(line.gross)];
    rows.push(
      new TableRow({
        children: values.map((v, i) =>
          new TableCell({
            borders: cellBorders,
            children: [
              new Paragraph({
                alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                children: [new TextRun({ text: v, size: 18, bold: i === 4 })],
              }),
            ],
          }),
        ),
      }),
    );
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}
