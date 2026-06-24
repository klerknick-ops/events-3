import type { FunctionSheetData } from "./function-sheet";

// ---------------------------------------------------------------------------
// Variable-based document templating. A template is plain text with {{tokens}}.
// Scalar tokens are substituted inline; "block" tokens on their own line expand
// to rich content (tables, schedule, totals) rendered by the PDF/Word backends.
// The same engine powers the Function Sheet and the Proposal.
// ---------------------------------------------------------------------------

export type DocBlock =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "text"; text: string }
  | { type: "spacer" }
  | { type: "image"; src: string }
  | { type: "schedule" }
  | { type: "product_table" }
  | { type: "room_block_table" }
  | { type: "totals" };

const BLOCK_TOKENS = new Set([
  "schedule",
  "product_table",
  "room_block_table",
  "totals",
]);

// Resolved image bytes + dimensions, passed to the PDF/DOCX renderers.
export interface DocImage {
  buffer: Buffer;
  width: number;
  height: number;
  type: string;
}
export type ImageMap = Map<string, DocImage>;

// Variables available to template authors (shown in the editor help panel).
export const TEMPLATE_VARIABLES: { token: string; desc: string }[] = [
  { token: "{{event_title}}", desc: "Event name" },
  { token: "{{event_date}}", desc: "First/primary date (or range)" },
  { token: "{{status}}", desc: "Event status label" },
  { token: "{{client_name}}", desc: "Contact full name" },
  { token: "{{company_name}}", desc: "Company name (blank if none)" },
  { token: "{{contact_email}}", desc: "Contact email" },
  { token: "{{contact_phone}}", desc: "Contact phone" },
  { token: "{{total_net}}", desc: "Net total" },
  { token: "{{total_tax}}", desc: "Tax total" },
  { token: "{{total_amount}}", desc: "Gross grand total" },
  { token: "{{notes}}", desc: "Event notes" },
  { token: "{{cancellation_policy}}", desc: "Cancellation policy text" },
  { token: "{{payment_terms}}", desc: "Selected payment terms text" },
  { token: "{{payment_terms_name}}", desc: "Payment terms preset name" },
  { token: "{{deposit_percent}}", desc: "Deposit % (if set)" },
  { token: "{{deposit_amount}}", desc: "Deposit amount (deposit % of gross)" },
  { token: "{{generated_at}}", desc: "Generation timestamp" },
  { token: "{{schedule}}", desc: "Block: list of time slots" },
  { token: "{{product_table}}", desc: "Block: itemized products table" },
  { token: "{{room_block_table}}", desc: "Block: hotel rooms table" },
  { token: "{{totals}}", desc: "Block: totals summary" },
];

export const DEFAULT_FUNCTION_SHEET_TEMPLATE = `# Function Sheet
{{event_title}}
Status: {{status}}

## Client
{{client_name}}
{{company_name}}
{{contact_email}} · {{contact_phone}}

## Schedule
{{schedule}}

## Products & Services
{{product_table}}

## Hotel Rooms
{{room_block_table}}

## Totals
{{totals}}

## Notes
{{notes}}`;

export const DEFAULT_PROPOSAL_TEMPLATE = `# Event Proposal
Prepared for {{client_name}} — {{company_name}}

Thank you for considering us to host {{event_title}}. We are delighted to share the proposal below.

## Your event
{{event_title}} — {{event_date}}

## Programme
{{schedule}}

## Products & Services
{{product_table}}

## Accommodation
{{room_block_table}}

## Investment
{{totals}}

## Cancellation Policy
{{cancellation_policy}}

We would be delighted to welcome you and your guests.`;

export const DEFAULT_CONFIRMATION_TEMPLATE = `# Booking Confirmation
{{event_title}} — {{event_date}}

Dear {{client_name}},

This confirms your booking. Please review the details below and let us know of any changes.

## Schedule
{{schedule}}

## Products & Services
{{product_table}}

## Hotel Rooms
{{room_block_table}}

## Totals
{{totals}}

## Payment Terms
{{payment_terms}}

## Cancellation Policy
{{cancellation_policy}}

We look forward to hosting you.`;

export const DEFAULT_PROFORMA_TEMPLATE = `# Pro Forma Invoice
{{event_title}} — {{event_date}}

## Bill To
{{client_name}}
{{company_name}}
{{contact_email}}

## Products & Services
{{product_table}}

## Hotel Rooms
{{room_block_table}}

## Amount Due
{{totals}}

Deposit due now ({{deposit_percent}}): {{deposit_amount}}

## Payment Terms
{{payment_terms}}

This is a pro forma invoice and is not a tax invoice.`;

// Build the scalar variable map from sheet data + extras.
export function buildDocVars(
  data: FunctionSheetData,
  extra: {
    cancellationPolicy?: string;
    paymentTerms?: string;
    paymentTermsName?: string;
    depositPercent?: number | null;
  } = {},
): Record<string, string> {
  const depositAmount =
    extra.depositPercent != null
      ? data.fmt((data.totals.gross * extra.depositPercent) / 100)
      : "";
  return {
    event_title: data.title,
    event_date: data.slots[0]?.range ?? "",
    status: data.statusLabel,
    client_name: data.client.name,
    company_name: data.client.company ?? "",
    contact_email: data.client.email ?? "",
    contact_phone: data.client.phone ?? "",
    total_net: data.fmt(data.totals.net),
    total_tax: data.fmt(data.totals.taxAmount),
    total_amount: data.fmt(data.totals.gross),
    notes: data.notes ?? "",
    cancellation_policy: extra.cancellationPolicy ?? "",
    payment_terms: extra.paymentTerms ?? "",
    payment_terms_name: extra.paymentTermsName ?? "",
    deposit_percent: extra.depositPercent != null ? `${extra.depositPercent}%` : "",
    deposit_amount: depositAmount,
    generated_at: data.generatedAt,
  };
}

function substitute(line: string, vars: Record<string, string>): string {
  return line.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

// Parse a template string into ordered document blocks, substituting scalars.
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const raw of template.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();

    // Image token: {{image:<url-or-key>}} on its own line.
    const imageMatch = trimmed.match(/^\{\{image:(.+)\}\}$/);
    if (imageMatch) {
      blocks.push({ type: "image", src: imageMatch[1].trim() });
      continue;
    }

    const blockMatch = trimmed.match(/^\{\{(\w+)\}\}$/);
    if (blockMatch && BLOCK_TOKENS.has(blockMatch[1])) {
      blocks.push({
        type: blockMatch[1] as "schedule" | "product_table" | "room_block_table" | "totals",
      });
      continue;
    }
    if (trimmed === "") {
      blocks.push({ type: "spacer" });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "heading", level: 2, text: substitute(trimmed.slice(3), vars) });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push({ type: "heading", level: 1, text: substitute(trimmed.slice(2), vars) });
      continue;
    }
    const text = substitute(line, vars).trim();
    // Skip lines that became empty after substitution (e.g. blank company).
    if (text === "") continue;
    blocks.push({ type: "text", text });
  }
  return blocks;
}
