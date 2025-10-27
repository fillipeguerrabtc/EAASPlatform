// server/modules/marketing/routes.ts
// Marketing Routes - CRUD + Tracking + Metrics
// SECURITY: isAuthenticated middleware, tenant isolation, trackingId validation

import type { Express, Request, Response } from "express";
import { MarketingService } from "./service";
import { db } from "../../db";
import {
  mkCampaigns,
  mkSends,
  mkEvents,
  contactPreferences
} from "@shared/schema.marketing";
import { and, eq, desc } from "drizzle-orm";

// ========================================
// CONTEXT HELPER
// ========================================

/**
 * Extract tenant context from authenticated request
 * SECURITY: Reads from req.user (set by auth middleware)
 */
function getCtx(req: Request) {
  const user = (req as any).user;
  
  if (!user) {
    throw new Error("Authentication required");
  }

  return {
    tenantId: user.tenantId || process.env.PRIMARY_TENANT_ID!,
    role: user.role || "admin",
    userId: user.id || "system"
  };
}

// ========================================
// ROUTE REGISTRATION
// ========================================

export function registerMarketingRoutes(app: Express, isAuthenticated: any) {
  // ========================================
  // TEMPLATES (Protected)
  // ========================================

  /**
   * Create or update marketing template
   * POST /api/mkt/templates.upsert
   * SECURITY: Requires authentication
   */
  app.post("/api/mkt/templates.upsert", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const result = await MarketingService.upsertTemplate(ctx, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * List all templates
   * GET /api/mkt/templates.list
   * SECURITY: Requires authentication
   */
  app.get("/api/mkt/templates.list", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const { channel } = req.query;
      const result = await MarketingService.listTemplates(ctx, {
        channel: channel as string | undefined
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Get single template
   * GET /api/mkt/templates.get?id=<uuid>
   * SECURITY: Requires authentication
   */
  app.get("/api/mkt/templates.get", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const templateId = String(req.query.id || "");
      const template = await MarketingService.getTemplate(ctx, templateId);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Delete template
   * DELETE /api/mkt/templates.delete
   * SECURITY: Requires authentication
   */
  app.delete("/api/mkt/templates.delete", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const templateId = String(req.body.id || "");
      const result = await MarketingService.deleteTemplate(ctx, templateId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========================================
  // CAMPAIGNS (Protected)
  // ========================================

  /**
   * Create or update campaign
   * POST /api/mkt/campaigns.upsert
   * SECURITY: Requires authentication
   */
  app.post("/api/mkt/campaigns.upsert", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const result = await MarketingService.upsertCampaign(ctx, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * List all campaigns
   * GET /api/mkt/campaigns.list
   * SECURITY: Requires authentication
   */
  app.get("/api/mkt/campaigns.list", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const { status } = req.query;
      const result = await MarketingService.listCampaigns(ctx, {
        status: status as string | undefined
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Get single campaign
   * GET /api/mkt/campaigns.get?id=<uuid>
   * SECURITY: Requires authentication
   */
  app.get("/api/mkt/campaigns.get", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const campaignId = String(req.query.id || "");
      const campaign = await MarketingService.getCampaign(ctx, campaignId);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Schedule campaign execution
   * POST /api/mkt/campaigns.schedule
   * SECURITY: Requires authentication
   */
  app.post("/api/mkt/campaigns.schedule", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const result = await MarketingService.scheduleCampaign(ctx, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Pause running campaign
   * POST /api/mkt/campaigns.pause
   * SECURITY: Requires authentication
   */
  app.post("/api/mkt/campaigns.pause", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const campaignId = String(req.body.campaignId || "");
      const result = await MarketingService.pauseCampaign(ctx, campaignId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Get campaign metrics
   * GET /api/mkt/campaigns.metrics?campaignId=<uuid>
   * SECURITY: Requires authentication
   */
  app.get("/api/mkt/campaigns.metrics", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const campaignId = String(req.query.campaignId || "");
      const metrics = await MarketingService.getCampaignMetrics(ctx, campaignId);
      res.json(metrics);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========================================
  // CONTACT PREFERENCES - LGPD/GDPR (Protected)
  // ========================================

  /**
   * Update contact marketing preferences
   * POST /api/mkt/contact-prefs.set
   * SECURITY: Requires authentication
   */
  app.post("/api/mkt/contact-prefs.set", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const { contactId, ...prefs } = req.body;
      
      if (!contactId) {
        return res.status(400).json({ error: "contactId required" });
      }

      const result = await MarketingService.updateContactPreferences(
        ctx,
        contactId,
        prefs
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * Get contact preferences
   * GET /api/mkt/contact-prefs.get?contactId=<uuid>
   * SECURITY: Requires authentication
   */
  app.get("/api/mkt/contact-prefs.get", isAuthenticated, async (req, res) => {
    try {
      const ctx = getCtx(req);
      const contactId = String(req.query.contactId || "");
      
      if (!contactId) {
        return res.status(400).json({ error: "contactId required" });
      }

      const prefs = await MarketingService.getContactPreferences(ctx, contactId);
      res.json(prefs || { contactId, emailOptIn: true, whatsappOptIn: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ========================================
  // TRACKING ENDPOINTS (PUBLIC - No auth required)
  // ========================================

  /**
   * Tracking pixel (1x1 transparent GIF)
   * GET /api/marketing/t.gif?tid=<trackingId>
   * SECURITY: Public, validates trackingId, tenant isolation via sendId lookup
   */
  app.get("/api/marketing/t.gif", async (req, res) => {
    try {
      const trackingId = String(req.query.tid || "");

      if (!trackingId) {
        // Invalid tracking - return pixel anyway (silent fail)
        const gif = Buffer.from(
          "R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAAACAkQBADs=",
          "base64"
        );
        res.setHeader("Content-Type", "image/gif");
        res.setHeader("Cache-Control", "no-store");
        return res.end(gif);
      }

      // Find send by trackingId
      const [send] = await db
        .select()
        .from(mkSends)
        .where(eq(mkSends.trackingId, trackingId))
        .limit(1);

      if (send) {
        // Log "opened" event
        await db.insert(mkEvents).values({
          tenantId: send.tenantId,
          sendId: send.id,
          type: "opened",
          meta: JSON.stringify({ trackingId, timestamp: new Date().toISOString() })
        });
      }

      // Return 1x1 transparent GIF
      const gif = Buffer.from(
        "R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAAACAkQBADs=",
        "base64"
      );
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Cache-Control", "no-store");
      res.end(gif);
    } catch (error: any) {
      console.error("Tracking pixel error:", error.message);
      // Silent fail - return pixel
      const gif = Buffer.from(
        "R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAAACAkQBADs=",
        "base64"
      );
      res.setHeader("Content-Type", "image/gif");
      res.end(gif);
    }
  });

  /**
   * Click tracking redirect
   * GET /api/marketing/click?tid=<trackingId>&u=<encodedUrl>
   * SECURITY: Public, validates trackingId, tenant isolation via sendId lookup
   */
  app.get("/api/marketing/click", async (req, res) => {
    try {
      const trackingId = String(req.query.tid || "");
      const encodedUrl = String(req.query.u || "");

      if (!encodedUrl) {
        return res.status(400).send("Missing URL");
      }

      const url = decodeURIComponent(encodedUrl);

      if (trackingId) {
        // Find send by trackingId
        const [send] = await db
          .select()
          .from(mkSends)
          .where(eq(mkSends.trackingId, trackingId))
          .limit(1);

        if (send) {
          // Log "clicked" event
          await db.insert(mkEvents).values({
            tenantId: send.tenantId,
            sendId: send.id,
            type: "clicked",
            meta: JSON.stringify({
              trackingId,
              url,
              timestamp: new Date().toISOString()
            })
          });
        }
      }

      // Redirect to original URL
      res.redirect(url);
    } catch (error: any) {
      console.error("Click tracking error:", error.message);
      res.status(400).send("Invalid request");
    }
  });
}
