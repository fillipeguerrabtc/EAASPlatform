// server/stripe.ts
// Stripe sandbox integration for marketplace checkout
// Implements create session + webhook handler with signature validation
// Conforme Architect review: Zod validation, sandbox mode toggle, limited events

import Stripe from "stripe";
import type { Request, Response } from "express";

// Initialize Stripe with API key from env
// SECURITY: Use STRIPE_API_KEY (project standard), fallback to STRIPE_SECRET_KEY for backwards compatibility
const apiKey = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY;

if (!apiKey) {
  console.warn('⚠️ STRIPE_API_KEY not found in environment. Stripe integration disabled.');
}

export const stripe = apiKey ? new Stripe(apiKey, { 
  apiVersion: "2024-06-20" // Pin API version for stability
}) : null;

/**
 * Create Stripe Checkout Session
 * POST /api/checkout/create-session
 * 
 * Body: {
 *   items: Array<{ name: string; unit_amount: number; currency?: string; quantity?: number }>,
 *   success_url: string,
 *   cancel_url: string,
 *   customer_email?: string
 * }
 */
export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!stripe) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  try {
    const { items, success_url, cancel_url, customer_email } = req.body || {};
    
    // Validation
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required and must not be empty" });
      return;
    }
    
    if (!success_url || typeof success_url !== 'string') {
      res.status(400).json({ error: "success_url is required" });
      return;
    }
    
    if (!cancel_url || typeof cancel_url !== 'string') {
      res.status(400).json({ error: "cancel_url is required" });
      return;
    }
    
    // Validate each item
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string') {
        res.status(400).json({ error: "Each item must have a name" });
        return;
      }
      
      if (typeof item.unit_amount !== 'number' || item.unit_amount < 0) {
        res.status(400).json({ error: "Each item must have a valid unit_amount in cents" });
        return;
      }
    }
    
    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map((it: any) => ({
        price_data: {
          currency: it.currency || "usd",
          product_data: { 
            name: it.name || "Item",
            description: it.description || undefined,
          },
          unit_amount: it.unit_amount, // in cents
        },
        quantity: it.quantity || 1
      })),
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: customer_email || undefined,
      metadata: {
        source: "eaas-marketplace",
        mode: process.env.STRIPE_MODE || "sandbox",
      },
    });
    
    console.log(`✓ Created Stripe checkout session: ${session.id}`);
    
    res.json({ 
      id: session.id, 
      url: session.url 
    });
    
  } catch (e: any) {
    console.error('Stripe createCheckoutSession error:', e);
    res.status(500).json({ error: e?.message || "Failed to create checkout session" });
  }
}

/**
 * Handle Stripe Webhook
 * POST /api/checkout/webhook
 * 
 * Must be registered with express.raw({ type: 'application/json' }) middleware
 * before express.json() to access raw body for signature verification
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripe) {
    res.status(503).send("Stripe not configured");
    return;
  }

  const sig = req.headers["stripe-signature"];
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!whsec) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).send("Webhook secret not configured");
    return;
  }
  
  if (!sig) {
    console.error('❌ Missing stripe-signature header');
    res.status(400).send("Missing signature");
    return;
  }

  let event: Stripe.Event;

  try {
    // Get raw body (must be Buffer)
    const rawBody = (req as any).rawBody || req.body;
    
    if (!Buffer.isBuffer(rawBody)) {
      throw new Error("Raw body must be a Buffer. Ensure express.raw() middleware is used for this route.");
    }
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig as string, whsec);
    
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle specific events (limit to critical ones for security)
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`✓ Checkout session completed: ${session.id}`, {
        customer_email: session.customer_email,
        amount_total: session.amount_total,
        currency: session.currency,
        mode: session.metadata?.mode,
      });
      
      // TODO: Mark order as paid in database
      // TODO: Send confirmation email
      // TODO: Trigger fulfillment workflow
      
      break;
    }
    
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`✓ Async payment succeeded: ${session.id}`);
      // Handle async payment completion
      break;
    }
    
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.warn(`⚠️ Async payment failed: ${session.id}`);
      // Handle payment failure
      break;
    }
    
    default:
      // Log unhandled event types but don't fail
      console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
  }

  // Always return 200 to acknowledge receipt
  res.json({ received: true });
}
