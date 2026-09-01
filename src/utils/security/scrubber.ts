// src/utils/security/scrubber.ts

const PATTERNS = {
  // Common API Key patterns (generic)
  apiKey: /(?:api[_-]key|apikey|auth[_-]token|secret|password|passwd|private[_-]key)(?:\s*[:=]\s*|["']\s*[:=]\s*["']\s*)(?:[a-zA-Z0-0-_]{16,})/gi,
  
  // Specific patterns
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  
  // Potential Auth headers/tokens in diffs
  bearerToken: /Bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*/gi,
  
  // Git/Github specific
  githubToken: /gh[pous]_[a-zA-Z0-9]{36,}/g,
};

/**
 * Scrubs potential secrets and PII from a string.
 * Replaces sensitive information with a placeholder.
 */
export function scrubSensitiveData(text: string): string {
  let scrubbedText = text;

  // Scrub API keys and tokens
  scrubbedText = scrubbedText.replace(PATTERNS.apiKey, (match) => {
    const [key, ...rest] = match.split(/[:=]/);
    return `${key}: [REDACTED]`;
  });

  scrubbedText = scrubbedText.replace(PATTERNS.bearerToken, "Bearer [REDACTED]");
  scrubbedText = scrubbedText.replace(PATTERNS.githubToken, "[GITHUB_TOKEN_REDACTED]");
  
  // Scrub PII
  scrubbedText = scrubbedText.replace(PATTERNS.email, "[EMAIL_REDACTED]");
  scrubbedText = scrubbedText.replace(PATTERNS.ipv4, "[IP_REDACTED]");

  return scrubbedText;
}

// ── Prompt Injection Detection ────────────────────────────────────────────────

export interface InjectionScanResult {
  detected: boolean;
  /** Specific substrings that triggered detection, for logging. */
  matchedPatterns: string[];
}

/**
 * Known prompt injection / jailbreak patterns.
 * Ordered from most specific to most general to minimise false positives.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s*(instructions?|directives?|rules?|constraints?)/i,
  /disregard\s+(all|previous|prior|your)\s*(instructions?|rules?|context|prompt)/i,
  /forget\s+(your\s+|all\s+)?(previous\s+|prior\s+)?(instructions?|rules?|context|training)/i,
  /you\s+are\s+now\s+(a\s+|an\s+)?/i,
  /new\s+(task|role|persona|instruction)\s*:/i,
  /system\s+override/i,
  /bypass\s+(safety|filter|restriction|content\s+policy)/i,
  /<\/?system>/i,
  /\[INST\]/i,          // Llama-style injection bracket
  /###\s*instruction/i, // Alpaca-style injection header
  /stop\s+(generating|being|acting)/i,
];

/**
 * Scans free-form text for known prompt injection patterns.
 * Returns a soft-flag result — callers decide how to act on it.
 *
 * Designed for LOW false-positive rate: only fires on clear override language,
 * not on incidental words like "ignore" or "forget" in isolation.
 */
export function detectPromptInjectionAttempt(text: string): InjectionScanResult {
  if (!text || text.trim().length === 0) {
    return { detected: false, matchedPatterns: [] };
  }

  const matched: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[0]) {
      matched.push(m[0].trim());
    }
  }

  return {
    detected: matched.length > 0,
    matchedPatterns: matched,
  };
}
