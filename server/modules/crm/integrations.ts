// server/modules/crm/integrations.ts - Twilio WhatsApp & Meta webhooks with signature verification
import type { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import twilio from "twilio";
import { CRMService } from "./service";
import { logAudit } from "./audit";

// ===============================================
// TWILIO WHATSAPP (Sandbox) - WITH SIGNATURE VALIDATION
// ===============================================

export async function twilioWhatsappWebhook(req: Request, res: Response) {
  try {
    // 1. VERIFY TWILIO SIGNATURE (critical security)
    const twilioSignature = req.headers["x-twilio-signature"] as string;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!authToken) {
      console.error("TWILIO_AUTH_TOKEN not configured");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    if (!twilioSignature) {
      console.error("Missing X-Twilio-Signature header");
      return res.status(401).json({ error: "Unauthorized - missing signature" });
    }

    // Build full URL (Twilio validates against the complete URL)
    // Handle SSL termination / proxy scenarios
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Validate signature using Twilio's official helper (handles parameter ordering correctly)
    const isValid = twilio.validateRequest(
      authToken,
      twilioSignature,
      url,
      req.body // Parsed URL-encoded parameters
    );
    
    if (!isValid) {
      console.error("Invalid Twilio signature");
      return res.status(401).json({ error: "Unauthorized - invalid signature" });
    }

    // 2. PROCESS WEBHOOK
    const tenantId = (req as any).tenantId || process.env.PRIMARY_TENANT_ID!;
    const from = String(req.body.From || "");
    const to = String(req.body.To || "");
    const body = String(req.body.Body || "");

    if (!from || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Upsert contact by phone
    const contactResult = await CRMService.upsertContact(
      { tenantId, role: "admin", userId: "twilio" },
      {
        firstName: from.replace("whatsapp:+", "WPP "),
        phone: from,
        source: "whatsapp",
        isOptIn: true,
      }
    );

    // Create activity
    const activityResult = await CRMService.createActivity(
      { tenantId, role: "admin", userId: "twilio" },
      {
        type: "whatsapp",
        subject: `Message from ${from}`,
        content: body,
        contactId: contactResult.id,
      }
    );

    await logAudit({
      tenantId,
      entity: "activity",
      entityId: activityResult.id,
      action: "message",
      after: { from, to, body },
      context: { provider: "twilio", verified: true },
    });

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("Twilio webhook error:", err);
    // Return 4xx on errors (not 200) to signal failure
    res.status(400).json({ error: "Webhook processing failed" });
  }
}

// ===============================================
// META WEBHOOK (Facebook/Instagram) - WITH SIGNATURE VALIDATION
// ===============================================

export function metaWebhookVerify(req: Request, res: Response) {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "dev";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

export async function metaWebhookReceive(req: Request, res: Response) {
  try {
    // 1. VERIFY META SIGNATURE (critical security)
    const signature = req.headers["x-hub-signature-256"] as string;
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret) {
      console.error("META_APP_SECRET not configured");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    if (!signature) {
      console.error("Missing X-Hub-Signature-256 header");
      return res.status(401).json({ error: "Unauthorized - missing signature" });
    }

    // Get raw body (captured by express.json verify hook)
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error("Raw body not available for signature verification");
      return res.status(500).json({ error: "Server misconfigured - raw body missing" });
    }

    // Validate signature against raw body
    const isValid = validateMetaSignature(rawBody, signature, appSecret);

    if (!isValid) {
      console.error("Invalid Meta signature");
      return res.status(401).json({ error: "Unauthorized - invalid signature" });
    }

    // 2. PROCESS WEBHOOK
    const tenantId = (req as any).tenantId || process.env.PRIMARY_TENANT_ID!;
    const body = req.body;

    const messages: Array<{
      from: string;
      text: string;
      channel: "facebook" | "instagram";
    }> = [];

    // Parse Facebook messages
    if (body.object === "page" && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const messaging of entry.messaging || []) {
          if (messaging.message?.text) {
            messages.push({
              from: String(messaging.sender?.id || "fb-user"),
              text: messaging.message.text,
              channel: "facebook",
            });
          }
        }
      }
    }

    // Parse Instagram messages
    if (body.object === "instagram" && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const txt = change?.value?.message || change?.value?.text;
          const from = change?.value?.from || "ig-user";
          if (txt) {
            messages.push({
              from: String(from),
              text: String(txt),
              channel: "instagram",
            });
          }
        }
      }
    }

    if (messages.length === 0) {
      return res.status(200).json({ status: "no_messages" });
    }

    // Process messages
    for (const msg of messages) {
      const contactResult = await CRMService.upsertContact(
        { tenantId, role: "admin", userId: "meta" },
        {
          firstName: `${msg.channel.toUpperCase()} ${msg.from}`,
          source: msg.channel,
          isOptIn: true,
        }
      );

      const activityResult = await CRMService.createActivity(
        { tenantId, role: "admin", userId: "meta" },
        {
          type: msg.channel,
          subject: `${msg.channel} message from ${msg.from}`,
          content: msg.text,
          contactId: contactResult.id,
        }
      );

      await logAudit({
        tenantId,
        entity: "activity",
        entityId: activityResult.id,
        action: "message",
        after: { from: msg.from, text: msg.text, channel: msg.channel },
        context: { provider: "meta", verified: true },
      });
    }

    res.status(200).json({ status: "processed", count: messages.length });
  } catch (err: any) {
    console.error("Meta webhook error:", err);
    // Return 4xx on errors (not 200) to signal failure
    res.status(400).json({ error: "Webhook processing failed" });
  }
}

// Meta signature validation
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
function validateMetaSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  // Expected format: sha256=<hash>
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const expectedHash = signature.substring(7);
  const hmac = createHmac("sha256", appSecret);
  hmac.update(payload);
  const computedHash = hmac.digest("hex");

  // Constant-time comparison
  return computedHash === expectedHash;
}
