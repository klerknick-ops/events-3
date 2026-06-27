// ---------------------------------------------------------------------------
// Native email-signature builder (replaces the old Exclaimer integration).
//
// A signature is a vertical stack of blocks stored per organization (Setting
// key "email_signature"). renderSignatureHtml() turns the blocks into email-safe
// inline-styled HTML, substituting {{user_name}} / {{user_email}} / {{org}} with
// the current composer's details — the same {{var}} approach used by document
// templates, applied to signatures.
// ---------------------------------------------------------------------------

export interface SigText {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number; // px
  color?: string;
  href?: string; // makes the whole line a link
}
export interface SigImage {
  type: "image";
  src: string;
  alt?: string;
  width?: number; // px
  href?: string;
}
export interface SigLinks {
  type: "links";
  items: { label: string; href: string }[];
  separator?: string; // default " · "
}
export interface SigSocial {
  type: "social";
  items: { href: string; iconSrc?: string; label?: string }[];
}
export interface SigBanner {
  type: "banner";
  src?: string; // background image (optional — falls back to a brand panel)
  href?: string;
  overlayText?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export type SignatureBlock = SigText | SigImage | SigLinks | SigSocial | SigBanner;

export interface SignatureVars {
  user_name: string;
  user_email: string;
  org: string;
}

// ----- variable substitution + escaping -----

function substitute(s: string, vars: SignatureVars): string {
  return s
    .replaceAll("{{user_name}}", vars.user_name)
    .replaceAll("{{user_email}}", vars.user_email)
    .replaceAll("{{org}}", vars.org);
}
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
// Resolve a value (substitute vars) then HTML-escape for safe text output.
function txt(s: string, vars: SignatureVars): string {
  return esc(substitute(s, vars));
}
// Resolve + escape a URL for an attribute, allowing only safe schemes.
function url(s: string | undefined, vars: SignatureVars): string {
  const v = substitute(s ?? "", vars).trim();
  if (!v) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(v) || v.startsWith("/") || v.startsWith("#")) {
    return esc(v);
  }
  return "#";
}

const ACCENT = "#bd3b2c";
const INK = "#161213";

export function renderSignatureHtml(blocks: SignatureBlock[], vars: SignatureVars): string {
  const rows = blocks.map((b) => `<tr><td style="padding:2px 0;">${renderBlock(b, vars)}</td></tr>`);
  return (
    `<table cellpadding="0" cellspacing="0" border="0" ` +
    `style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:${INK};border-collapse:collapse;">` +
    rows.join("") +
    `</table>`
  );
}

function renderBlock(b: SignatureBlock, vars: SignatureVars): string {
  switch (b.type) {
    case "text": {
      const styles = [
        `font-size:${b.fontSize ?? 13}px`,
        b.bold ? "font-weight:bold" : "",
        b.italic ? "font-style:italic" : "",
        b.underline || b.href ? "text-decoration:underline" : "",
        `color:${b.href ? ACCENT : b.color || INK}`,
      ]
        .filter(Boolean)
        .join(";");
      const inner = txt(b.text, vars);
      return b.href
        ? `<a href="${url(b.href, vars)}" style="${styles}">${inner}</a>`
        : `<span style="${styles}">${inner}</span>`;
    }
    case "image": {
      const img = `<img src="${url(b.src, vars)}" alt="${txt(b.alt ?? "", vars)}" ${
        b.width ? `width="${b.width}"` : ""
      } style="display:block;border:0;max-width:100%;${b.width ? `width:${b.width}px;` : ""}height:auto;" />`;
      return b.href ? `<a href="${url(b.href, vars)}">${img}</a>` : img;
    }
    case "links": {
      const sep = esc(b.separator ?? " · ");
      return b.items
        .map(
          (it) =>
            `<a href="${url(it.href, vars)}" style="color:${ACCENT};text-decoration:underline;font-size:12px;">${txt(
              it.label,
              vars,
            )}</a>`,
        )
        .join(`<span style="color:#999;font-size:12px;">${sep}</span>`);
    }
    case "social": {
      return b.items
        .map((it) => {
          const inner = it.iconSrc
            ? `<img src="${url(it.iconSrc, vars)}" alt="${txt(it.label ?? "", vars)}" width="20" style="display:inline-block;border:0;width:20px;height:20px;vertical-align:middle;" />`
            : `<span style="display:inline-block;padding:2px 8px;border:1px solid ${ACCENT};border-radius:10px;color:${ACCENT};font-size:11px;">${txt(
                it.label ?? "link",
                vars,
              )}</span>`;
          return `<a href="${url(it.href, vars)}" style="text-decoration:none;margin-right:8px;">${inner}</a>`;
        })
        .join("");
    }
    case "banner": {
      const bg = b.src
        ? `background-image:url('${url(b.src, vars)}');background-size:cover;background-position:center;`
        : `background:linear-gradient(135deg,${ACCENT},#e8643f);`;
      const overlay = b.overlayText
        ? `<div style="font-size:15px;font-weight:bold;color:#ffffff;margin-bottom:6px;">${txt(b.overlayText, vars)}</div>`
        : "";
      const cta = b.ctaLabel
        ? `<a href="${url(b.ctaHref, vars)}" style="display:inline-block;background:#ffffff;color:${ACCENT};font-size:12px;font-weight:bold;text-decoration:none;padding:6px 14px;border-radius:6px;">${txt(
            b.ctaLabel,
            vars,
          )}</a>`
        : "";
      const inner = `<div style="${bg}border-radius:8px;padding:18px 20px;max-width:480px;">${overlay}${cta}</div>`;
      return b.href ? `<a href="${url(b.href, vars)}" style="text-decoration:none;">${inner}</a>` : inner;
    }
  }
}

// Starter template matching the reference signature structure (fully editable).
export const STARTER_SIGNATURE: SignatureBlock[] = [
  { type: "text", text: "{{user_name}}", bold: true, fontSize: 16 },
  { type: "text", text: "Event Manager", italic: true, fontSize: 13, color: "#555555" },
  { type: "text", text: "T +31 20 123 4567  ·  M +31 6 1234 5678", fontSize: 12, color: "#555555" },
  { type: "text", text: "{{org}}", bold: true, fontSize: 13 },
  {
    type: "links",
    items: [
      { label: "Restaurant", href: "#" },
      { label: "Spa", href: "#" },
      { label: "Rooftop Bar", href: "#" },
    ],
  },
  {
    type: "social",
    items: [
      { href: "#", label: "Instagram" },
      { href: "#", label: "Facebook" },
      { href: "#", label: "LinkedIn" },
    ],
  },
  { type: "text", text: "Green Key Certified", underline: true, href: "#", fontSize: 12 },
  {
    type: "banner",
    overlayText: "Now taking bookings for 2026",
    ctaLabel: "Enquire now",
    ctaHref: "#",
  },
];
