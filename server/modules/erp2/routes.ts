import express, { Request, Response } from "express";
import { ERP2Service } from "./service";
import {
  setAddressesSchema,
  shippingQuoteSchema,
  applyTaxSchema,
  couponApplySchema,
  createInvoiceSchema,
  fulfillSchema,
  returnSchema,
  approveReturnSchema,
  createShippingMethodSchema,
  createTaxRateSchema,
  createCouponSchema,
} from "./validators";

const router = express.Router();
const erp2Service = new ERP2Service();

// ========================================
// CONTEXT HELPER
// CRITICAL FIX: Read from req (not res)
// ========================================

function getCtx(req: Request) {
  const userId = (req as any).userId;
  const role = (req as any).role;
  
  if (!userId) {
    throw new Error("User not authenticated");
  }

  return {
    tenantId: (req as any).tenantId || process.env.PRIMARY_TENANT_ID!,
    userId,
    role: role || "agent",
  };
}

// RBAC helper
function requireAdmin(ctx: { role: string }) {
  if (ctx.role !== "super_admin" && ctx.role !== "tenant_admin") {
    throw new Error("Admin access required");
  }
}

// ========================================
// ORDER ADDRESSES
// ========================================

router.post("/addresses", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = setAddressesSchema.parse(req.body);
    const addresses = await erp2Service.setAddresses(
      ctx.tenantId,
      validated.orderId,
      {
        billingAddress: validated.billingAddress,
        shippingAddress: validated.shippingAddress,
      }
    );
    
    res.status(201).json(addresses);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/addresses/:orderId", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const addresses = await erp2Service.getAddresses(ctx.tenantId, req.params.orderId);
    
    res.json(addresses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SHIPPING METHODS
// ========================================

router.get("/shipping-methods", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const isActive = req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    
    const methods = await erp2Service.listShippingMethods(ctx.tenantId, isActive);
    
    res.json(methods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/shipping-methods", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = createShippingMethodSchema.parse(req.body);
    const method = await erp2Service.createShippingMethod(ctx.tenantId, validated);
    
    res.status(201).json(method);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/shipping/quote", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = shippingQuoteSchema.parse(req.body);
    const quote = await erp2Service.calculateShipping(
      ctx.tenantId,
      validated.orderId,
      validated.shippingMethodId
    );
    
    res.json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// TAX RATES
// ========================================

router.get("/tax-rates", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const rates = await erp2Service.listTaxRates(ctx.tenantId, {
      country: req.query.country as string,
      state: req.query.state as string,
      isActive: req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined,
    });
    
    res.json(rates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/tax-rates", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = createTaxRateSchema.parse(req.body);
    const rate = await erp2Service.createTaxRate(ctx.tenantId, validated);
    
    res.status(201).json(rate);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/tax/calculate", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = applyTaxSchema.parse(req.body);
    const tax = await erp2Service.calculateTax(
      ctx.tenantId,
      validated.orderId,
      validated.taxRateIds
    );
    
    res.json(tax);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// COUPONS
// ========================================

router.get("/coupons", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const isActive = req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    
    const coupons = await erp2Service.listCoupons(ctx.tenantId, isActive);
    
    res.json(coupons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/coupons", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = createCouponSchema.parse(req.body);
    const coupon = await erp2Service.createCoupon(ctx.tenantId, {
      code: validated.code,
      description: validated.description,
      discountType: validated.discountType,
      discountValue: validated.discountValue,
      maxRedemptions: validated.maxRedemptions,
      validFrom: validated.validFrom ? new Date(validated.validFrom) : undefined,
      validUntil: validated.validUntil ? new Date(validated.validUntil) : undefined,
      minOrderCents: validated.minOrderCents,
      isActive: validated.isActive,
    });
    
    res.status(201).json(coupon);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/coupons/apply", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = couponApplySchema.parse(req.body);
    const result = await erp2Service.applyCoupon(
      ctx.tenantId,
      validated.orderId,
      validated.code
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// INVOICES
// ========================================

router.post("/invoices", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = createInvoiceSchema.parse(req.body);
    const invoice = await erp2Service.createInvoice(ctx.tenantId, {
      orderId: validated.orderId,
      invoiceNumber: validated.invoiceNumber,
      dueAt: validated.dueAt ? new Date(validated.dueAt) : undefined,
    });
    
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/invoices/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    const invoice = await erp2Service.getInvoice(ctx.tenantId, req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// FULFILLMENTS
// ========================================

router.post("/fulfillments", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = fulfillSchema.parse(req.body);
    const fulfillment = await erp2Service.createFulfillment(ctx.tenantId, validated);
    
    res.status(201).json(fulfillment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/fulfillments/:id/status", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const { status, trackingNumber, carrier } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    
    const fulfillment = await erp2Service.updateFulfillmentStatus(
      ctx.tenantId,
      req.params.id,
      status,
      { trackingNumber, carrier }
    );
    
    if (!fulfillment) {
      return res.status(404).json({ error: "Fulfillment not found" });
    }
    
    res.json(fulfillment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// RETURNS
// ========================================

router.post("/returns", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    
    const validated = returnSchema.parse(req.body);
    const returnRecord = await erp2Service.createReturn(ctx.tenantId, validated);
    
    res.status(201).json(returnRecord);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/returns/:id/approve", async (req: Request, res: Response) => {
  try {
    const ctx = getCtx(req);
    requireAdmin(ctx);
    
    const validated = approveReturnSchema.parse(req.body);
    const returnRecord = await erp2Service.approveReturn(
      ctx.tenantId,
      validated.returnId,
      validated.approved,
      validated.refundAmountCents
    );
    
    res.json(returnRecord);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export function registerERP2Routes(app: express.Application) {
  app.use("/api/erp2", router);
}
