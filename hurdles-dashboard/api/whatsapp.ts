import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runAgent } from "./_lib/agent";
import { loadThread, saveThread } from "./_lib/threads";
import { twimlMessage, validateTwilio } from "./_lib/twilio";

/**
 * Twilio WhatsApp webhook. Twilio POSTs an application/x-www-form-urlencoded
 * body (From, Body, ...). We validate the signature, enforce a single-number
 * allowlist, run the Claude agent against Supabase, and reply via TwiML.
 */

function sendTwiml(res: VercelResponse, message: string): void {
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.status(200).send(twimlMessage(message));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const body = (req.body ?? {}) as Record<string, string>;

  // Reconstruct the public URL Twilio signed.
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = req.headers.host ?? "";
  const url = `${proto}://${host}${req.url}`;
  const signature = req.headers["x-twilio-signature"] as string | undefined;

  if (!validateTwilio(url, body, signature)) {
    res.status(403).send("Invalid signature");
    return;
  }

  const from = (body.From ?? "").trim();
  const text = (body.Body ?? "").toString().trim();
  const allowed = process.env.WHATSAPP_ALLOWED_FROM ?? "";

  if (!from || from !== allowed) {
    sendTwiml(res, "Sorry, this assistant isn't available for this number.");
    return;
  }

  if (!text) {
    sendTwiml(res, "Send me a question about your training, or tell me a session to add.");
    return;
  }

  try {
    const prior = await loadThread(from);
    const { reply, turns } = await runAgent(prior, text);
    await saveThread(from, turns);
    sendTwiml(res, reply);
  } catch (err) {
    console.error("whatsapp handler error", err);
    sendTwiml(res, "Something went wrong handling that. Please try again in a moment.");
  }
}
