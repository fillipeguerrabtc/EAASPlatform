// server/modules/crm/validators.ts - Zod validation schemas
import { z } from "zod";

export const companyUpsertSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  taxId: z.string().min(3).max(64).optional(),
  phone: z.string().min(6).max(64).optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().optional(),
});

export const contactUpsertSchema = z.object({
  companyId: z.string().uuid().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(64).optional(),
  tags: z.array(z.string()).optional().or(z.string().transform(s => s.split(',').map(t => t.trim()))),
  source: z.string().optional(),
  isOptIn: z.boolean().optional(),
  notes: z.string().optional()
});

export const dealUpsertSchema = z.object({
  title: z.string().min(1, "Deal title is required"),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  valueCents: z.number().int().nonnegative().default(0),
  currency: z.string().min(3).max(8).default("USD"),
  probability: z.number().int().min(0).max(100).default(0),
  expectedClose: z.string().datetime().optional()
});

export const activityCreateSchema = z.object({
  type: z.enum(["note", "call", "meeting", "task", "email", "whatsapp", "facebook", "instagram", "web"]),
  subject: z.string().optional(),
  content: z.string().optional(),
  companyId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional()
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  q: z.string().optional()
});

export const segmentCreateSchema = z.object({
  name: z.string().min(1, "Segment name is required"),
  entity: z.enum(["contacts", "companies", "deals"]),
  queryJson: z.string().refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "queryJson must be valid JSON" }
  )
});
