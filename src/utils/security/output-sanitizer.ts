// src/utils/security/output-sanitizer.ts
// Server-side last line of defence: sanitizes AI-generated markdown output
// before it is persisted to the database or returned to the client.

/** Maximum characters allowed in a single AI-generated document. */
const MAX_OUTPUT_LENGTH = 50_000;

/**
 * Strips unsafe link protocols (javascript:, data:, vbscript:) from
 * markdown link syntax and replaces them with a safe placeholder URL.
 */
function stripUnsafeLinks(markdown: string): string {
  // Matches [text](url) where url begins with an unsafe protocol
  return markdown.replace(
    /\[([^\]]*)\]\(([^)]*)\)/g,
    (_match, linkText: string, linkUrl: string) => {
      const normalized = linkUrl.trim().toLowerCase();
      const isUnsafe =
        normalized.startsWith("javascript:") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("vbscript:") ||
        normalized.startsWith("file:");

      if (isUnsafe) {
        // Preserve the visible link text; replace the href with a no-op anchor
        return `[${linkText}](#removed-unsafe-link)`;
      }
      return `[${linkText}](${linkUrl})`;
    },
  );
}

/**
 * Strips raw HTML tags from markdown output.
 * AI models occasionally emit <script>, <iframe>, or <img onerror=...> tags.
 * Since Penqwin docs do not require inline HTML, we remove all tags entirely.
 */
function stripRawHtml(markdown: string): string {
  // Remove full script/iframe/style blocks including content
  let cleaned = markdown
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

  // Remove all remaining standalone HTML tags
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  return cleaned;
}

/**
 * Sanitizes AI-generated markdown output.
 *
 * Applies in order:
 *  1. Length cap — prevents memory/DB exhaustion from runaway outputs
 *  2. Raw HTML stripping — removes <script>, <iframe>, inline event handlers
 *  3. Unsafe link protocol stripping — neutralises javascript:/data: hrefs
 *
 * This function is intentionally permissive about markdown content — it does
 * not filter "suspicious text" because that would risk removing legitimate
 * documentation. The prompt-level defences handle behavioural manipulation;
 * this layer handles the structural/injection risks in the output.
 */
export function sanitizeMarkdownOutput(markdown: string): string {
  if (!markdown) return "";

  // 1. Length cap
  let sanitized =
    markdown.length > MAX_OUTPUT_LENGTH
      ? markdown.slice(0, MAX_OUTPUT_LENGTH) +
        "\n\n> *(Output truncated by security policy)*"
      : markdown;

  // 2. Strip raw HTML
  sanitized = stripRawHtml(sanitized);

  // 3. Strip unsafe link protocols
  sanitized = stripUnsafeLinks(sanitized);

  return sanitized;
}

export interface OutputValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Performs a basic sanity check on AI output to ensure it looks like
 * Markdown documentation and not an error dump or non-documentation response.
 *
 * This is a soft check — callers should log the reason but not hard-block
 * on validation failure, since false positives are possible.
 */
export function validateMarkdownOutput(
  markdown: string,
): OutputValidationResult {
  if (!markdown || markdown.trim().length === 0) {
    return { valid: false, reason: "Output is empty" };
  }

  if (markdown.trim().length < 50) {
    return {
      valid: false,
      reason: "Output is suspiciously short (< 50 characters)",
    };
  }

  // Looks like a raw JSON dump
  if (markdown.trim().startsWith("{") && markdown.trim().endsWith("}")) {
    return { valid: false, reason: "Output appears to be raw JSON" };
  }

  // Looks like a shell script
  if (/^(#!\/bin\/|import os|import sys|import subprocess)/m.test(markdown)) {
    return {
      valid: false,
      reason: "Output appears to contain executable script content",
    };
  }

  return { valid: true };
}
