"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

// Render an email body the way a mail client does: sanitized HTML (scripts,
// event handlers, iframes, forms stripped) with formatting/images/links kept.
// Plain-text bodies are escaped and shown with preserved line breaks.
export function EmailBody({
  html,
  isHtml,
  className = "",
}: {
  html: string;
  isHtml: boolean;
  className?: string;
}) {
  const clean = useMemo(() => {
    if (!isHtml) {
      const escaped = (html || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<p style="white-space:pre-wrap">${escaped}</p>`;
    }
    return DOMPurify.sanitize(html || "", {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "script", "iframe", "form", "input", "button"],
      FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
      ALLOW_DATA_ATTR: false,
    });
  }, [html, isHtml]);

  return (
    <div
      className={`email-body max-w-none text-sm text-ink-soft ${className}`}
      // Sanitized above with DOMPurify — safe to inject.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
