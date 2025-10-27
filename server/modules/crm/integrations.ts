// server/modules/crm/integrations.ts - Twilio WhatsApp & Meta webhooks
import type { Request, Response } from "express";
import { CRMService } from "./service";
import { logAudit } from "./audit";

// ===============================================
// TWILIO WHATSAPP (Sandbox)
// ===============================================

export async function twilioWhatsappWebhook(req: Request, res: Response) {
  try {
    const tenantId = (req as any).tenantId || process.env.PRIMARY_TENANT_ID!;
    const from = String(req.body.From || "");
    const to = String(req.body.To || "");
    const body = String(req.body.Body || "");

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
      context: { provider: "twilio" },
    });

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("Twilio webhook error:", err);
    res.status(200).send("OK"); // Return 200 to avoid Twilio retries
  }
}

// ===============================================
// META WEBHOOK (Facebook/Instagram)
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
          type: msg.channel as any,
          subject: `Message from ${msg.channel} ${msg.from}`,
          content: msg.text,
          contactId: contactResult.id,
        }
      );

      await logAudit({
        tenantId,
        entity: "activity",
        entityId: activityResult.id,
        action: "message",
        after: msg,
        context: { provider: "meta" },
      });
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (err: any) {
    console.error("Meta webhook error:", err);
    res.status(200).send("EVENT_RECEIVED");
  }
}
