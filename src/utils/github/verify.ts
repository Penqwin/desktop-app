import crypto from 'crypto';

/**
 * Verifies the signature sent by GitHub Webhooks
 * @param payload The raw string body from the request
 * @param signature The 'x-hub-signature-256' header from GitHub
 * @param secret Your GITHUB_WEBHOOK_SECRET
 */
export function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = Buffer.from(
    'sha256=' + hmac.update(payload).digest('hex'),
    'utf8'
  );
  const checksum = Buffer.from(signature, 'utf8');

  // Use timingSafeEqual to prevent timing attacks
  if (checksum.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(digest, checksum);
}