// server/modules/marketing/providers.ts
// Marketing providers: Email (SMTP), WhatsApp (Twilio), Facebook, Instagram
// SECURITY: Graceful degradation, error handling, crypto-secure tracking IDs

import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import twilio from "twilio";
import { randomUUID } from "crypto";

// ========================================
// CONFIGURATION & INITIALIZATION
// ========================================

// SMTP configuration (Nodemailer)
const SMTP_CONFIGURED = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

const smtpTransport = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!
      }
    })
  : null;

const SMTP_FROM = process.env.SMTP_FROM || "No Reply <no-reply@example.com>";

// Twilio configuration (WhatsApp)
const TWILIO_CONFIGURED = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_WHATSAPP_NUMBER
);

const twilioClient = TWILIO_CONFIGURED
  ? twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  : null;

const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

// ========================================
// TYPES
// ========================================

export type RenderInput = {
  subject?: string;
  bodyHandlebars: string;
  data: Record<string, any>;
};

export type SendResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};

// ========================================
// TEMPLATE RENDERING
// ========================================

/**
 * Renders a Handlebars template with provided data
 * SECURITY: Handlebars auto-escapes HTML by default
 */
export function renderTemplate({ subject, bodyHandlebars, data }: RenderInput): {
  subject?: string;
  body: string;
} {
  try {
    const body = Handlebars.compile(bodyHandlebars)(data);
    const subj = subject ? Handlebars.compile(subject)(data) : undefined;
    return { subject: subj, body };
  } catch (error: any) {
    throw new Error(`Template rendering failed: ${error.message}`);
  }
}

// ========================================
// CRYPTO-SECURE TRACKING ID
// ========================================

/**
 * Generates crypto-secure random tracking ID
 * SECURITY: Uses crypto.randomUUID() instead of Math.random()
 */
export function generateTrackingId(): string {
  return randomUUID().replace(/-/g, ""); // 32 char hex string
}

// ========================================
// EMAIL PROVIDER (SMTP / Nodemailer)
// ========================================

/**
 * Sends email via SMTP
 * SECURITY: Graceful degradation if SMTP not configured
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendResult> {
  if (!smtpTransport) {
    console.warn("⚠️  SMTP not configured - email sending disabled");
    return {
      success: false,
      error: "SMTP not configured"
    };
  }

  try {
    const info = await smtpTransport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html
    });

    return {
      success: true,
      providerMessageId: info.messageId
    };
  } catch (error: any) {
    console.error("❌ Email send failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ========================================
// WHATSAPP PROVIDER (Twilio)
// ========================================

/**
 * Sends WhatsApp message via Twilio
 * SECURITY: Graceful degradation if Twilio not configured
 */
export async function sendWhatsapp(
  to: string,
  text: string
): Promise<SendResult> {
  if (!twilioClient) {
    console.warn("⚠️  Twilio not configured - WhatsApp sending disabled");
    return {
      success: false,
      error: "Twilio not configured"
    };
  }

  try {
    // Ensure phone number has whatsapp: prefix
    const toWhatsapp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const message = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: toWhatsapp,
      body: text
    });

    return {
      success: true,
      providerMessageId: message.sid
    };
  } catch (error: any) {
    console.error("❌ WhatsApp send failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ========================================
// FACEBOOK PROVIDER (Graph API)
// ========================================

/**
 * Sends Facebook message via Graph API
 * TODO: Implement with Facebook Page Access Token
 * SECURITY: Stub for now, ready for implementation
 */
export async function sendFacebook(
  toUserId: string,
  text: string
): Promise<SendResult> {
  console.warn("⚠️  Facebook messaging not implemented - stub only");
  
  // TODO: Implement with Graph API
  // const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  // if (!PAGE_ACCESS_TOKEN) return { success: false, error: "Facebook not configured" };
  //
  // const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "Authorization": `Bearer ${PAGE_ACCESS_TOKEN}`
  //   },
  //   body: JSON.stringify({
  //     recipient: { id: toUserId },
  //     message: { text }
  //   })
  // });

  return {
    success: false,
    error: "Facebook messaging not implemented",
    providerMessageId: `fb_stub_${Date.now()}`
  };
}

// ========================================
// INSTAGRAM PROVIDER (Graph API)
// ========================================

/**
 * Sends Instagram message via Graph API
 * TODO: Implement with Instagram Business Account
 * SECURITY: Stub for now, ready for implementation
 */
export async function sendInstagram(
  toUserId: string,
  text: string
): Promise<SendResult> {
  console.warn("⚠️  Instagram messaging not implemented - stub only");

  // TODO: Implement with Graph API
  // const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  // if (!IG_ACCESS_TOKEN) return { success: false, error: "Instagram not configured" };
  //
  // Similar to Facebook implementation

  return {
    success: false,
    error: "Instagram messaging not implemented",
    providerMessageId: `ig_stub_${Date.now()}`
  };
}

// ========================================
// HTML UTILITIES
// ========================================

/**
 * Strips HTML tags and converts to plain text
 * Used for WhatsApp/SMS channels
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")      // Remove tags
    .replace(/\s+/g, " ")           // Normalize whitespace
    .replace(/&nbsp;/g, " ")        // Replace &nbsp;
    .replace(/&amp;/g, "&")         // Decode &amp;
    .replace(/&lt;/g, "<")          // Decode &lt;
    .replace(/&gt;/g, ">")          // Decode &gt;
    .replace(/&quot;/g, '"')        // Decode &quot;
    .trim();
}

/**
 * Rewrites <a href> links in HTML to add tracking
 * SECURITY: Uses crypto-secure tracking ID
 */
export function rewriteLinksWithTracking(html: string, trackingId: string): string {
  return html.replace(
    /<a\s+([^>]*?)href="([^"]+)"([^>]*)>/gi,
    (match, pre, href, post) => {
      const encodedUrl = encodeURIComponent(href);
      const trackingUrl = `/api/marketing/click?tid=${trackingId}&u=${encodedUrl}`;
      return `<a ${pre}href="${trackingUrl}"${post}>`;
    }
  );
}

/**
 * Adds tracking pixel to HTML email
 * SECURITY: Uses crypto-secure tracking ID
 */
export function addTrackingPixel(html: string, trackingId: string): string {
  const pixel = `<img src="/api/marketing/t.gif?tid=${trackingId}" width="1" height="1" style="display:none" alt="" />`;
  return html + pixel;
}

// ========================================
// PROVIDER STATUS
// ========================================

/**
 * Returns status of all configured providers
 */
export function getProvidersStatus() {
  return {
    smtp: SMTP_CONFIGURED,
    twilio: TWILIO_CONFIGURED,
    facebook: false, // TODO: Check FB config
    instagram: false // TODO: Check IG config
  };
}
