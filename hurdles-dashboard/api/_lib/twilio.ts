import twilio from "twilio";

/**
 * Validate that an incoming request genuinely came from Twilio using the
 * X-Twilio-Signature header. Set SKIP_TWILIO_VALIDATION=true for local testing
 * only — never in production.
 */
export function validateTwilio(
  url: string,
  params: Record<string, unknown>,
  signature: string | undefined,
): boolean {
  if (process.env.SKIP_TWILIO_VALIDATION === "true") return true;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  return twilio.validateRequest(token, signature, url, params ?? {});
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build a TwiML response that replies to the sender with a single message. */
export function twimlMessage(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}
