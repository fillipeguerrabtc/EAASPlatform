// server/modules/crm/service.ts - CRM service layer with RBAC
import { db } from "../../db";
import { getPrimaryTenantId, withTenant } from "../../singleTenant";
import {
  companies,
  contacts,
  deals,
  activities,
  pipelines,
  pipelineStages,
} from "@shared/schema.crm";
import { and, eq, ilike, desc, asc, sql, or } from "drizzle-orm";
import {
  companyUpsertSchema,
  contactUpsertSchema,
  dealUpsertSchema,
  activityCreateSchema,
  paginationSchema,
} from "./validators";
import { findContactDuplicates } from "./dedupe";

type UserCtx = {
  userId: string;
  role: string;
  tenantId: string;
};

function assertCan(ctx: UserCtx, action: string) {
  // Simple RBAC: agents can't do admin actions
  if (ctx.role === "agent" && action.startsWith("admin:")) {
    throw new Error("Permission denied: insufficient privileges");
  }
}

export const CRMService = {
  // ============================================
  // COMPANIES
  // ============================================

  async upsertCompany(ctx: UserCtx, input: unknown) {
    assertCan(ctx, "write:companies");
    const data = companyUpsertSchema.parse(input);

    // Upsert by domain (if provided)
    if (data.domain) {
      const existing = await db
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.tenantId, ctx.tenantId),
            ilike(companies.domain, data.domain)
          )
        )
        .limit(1);

      if (existing.length) {
        await db
          .update(companies)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(companies.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      }
    }

    // Create new company
    const [inserted] = await db
      .insert(companies)
      .values({ ...data, tenantId: ctx.tenantId })
      .returning();
    return { id: inserted.id, created: true };
  },

  async listCompanies(ctx: UserCtx, params: unknown) {
    assertCan(ctx, "read:companies");
    const { page, pageSize, q } = paginationSchema.parse(params);

    const conditions = [eq(companies.tenantId, ctx.tenantId)];
    if (q) {
      conditions.push(
        or(
          ilike(companies.name, `%${q}%`),
          ilike(companies.domain, `%${q}%`)
        )!
      );
    }

    const rows = await db
      .select()
      .from(companies)
      .where(and(...conditions))
      .orderBy(asc(companies.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countResult = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM companies WHERE tenant_id = ${ctx.tenantId}`
    );
    const total = (countResult.rows[0] as any).count;

    return { rows, page, pageSize, total };
  },

  async getCompany(ctx: UserCtx, id: string) {
    assertCan(ctx, "read:companies");
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)))
      .limit(1);
    if (!company) throw new Error("Company not found");
    return company;
  },

  async deleteCompany(ctx: UserCtx, id: string) {
    assertCan(ctx, "write:companies");
    await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.tenantId, ctx.tenantId)));
    return { deleted: true };
  },

  // ============================================
  // CONTACTS
  // ============================================

  async upsertContact(ctx: UserCtx, input: unknown) {
    assertCan(ctx, "write:contacts");
    const data = contactUpsertSchema.parse(input);

    // Convert tags array to CSV if provided
    const tagsString = Array.isArray(data.tags) ? data.tags.join(",") : data.tags;

    // Dedupe check
    const dup = await findContactDuplicates(ctx.tenantId, data);
    if (dup.exact && dup.exact.length) {
      // Update existing contact (merge)
      const target = dup.exact[0];
      await db
        .update(contacts)
        .set({ ...data, tags: tagsString as any, updatedAt: new Date() })
        .where(eq(contacts.id, target.id));
      return { id: target.id, updated: true, dedupe: dup.by };
    }

    // Create new contact
    const [inserted] = await db
      .insert(contacts)
      .values({ ...data, tags: tagsString as any, tenantId: ctx.tenantId })
      .returning();
    return { id: inserted.id, created: true };
  },

  async listContacts(ctx: UserCtx, params: unknown) {
    assertCan(ctx, "read:contacts");
    const { page, pageSize, q } = paginationSchema.parse(params);

    const conditions = [eq(contacts.tenantId, ctx.tenantId)];
    if (q) {
      conditions.push(
        or(
          ilike(contacts.firstName, `%${q}%`),
          ilike(contacts.lastName, `%${q}%`),
          ilike(contacts.email, `%${q}%`),
          ilike(contacts.phone, `%${q}%`)
        )!
      );
    }

    const rows = await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countResult = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM contacts WHERE tenant_id = ${ctx.tenantId}`
    );
    const total = (countResult.rows[0] as any).count;

    return { rows, page, pageSize, total };
  },

  async getContact(ctx: UserCtx, id: string) {
    assertCan(ctx, "read:contacts");
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)))
      .limit(1);
    if (!contact) throw new Error("Contact not found");
    return contact;
  },

  async deleteContact(ctx: UserCtx, id: string) {
    assertCan(ctx, "write:contacts");
    await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)));
    return { deleted: true };
  },

  // ============================================
  // PIPELINES & STAGES
  // ============================================

  async ensureDefaultPipeline(ctx: UserCtx) {
    const existing = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.tenantId, ctx.tenantId))
      .limit(1);

    if (existing.length) return existing[0];

    // Create default pipeline with stages
    const [pipeline] = await db
      .insert(pipelines)
      .values({ tenantId: ctx.tenantId, name: "Sales Pipeline" })
      .returning();

    const defaultStages = [
      { name: "Lead", stageType: "lead", position: 1 },
      { name: "Qualified", stageType: "qualified", position: 2 },
      { name: "Proposal", stageType: "proposal", position: 3 },
      { name: "Negotiation", stageType: "negotiation", position: 4 },
      { name: "Won", stageType: "won", position: 5 },
      { name: "Lost", stageType: "lost", position: 6 },
    ] as const;

    for (const stage of defaultStages) {
      await db.insert(pipelineStages).values({
        tenantId: ctx.tenantId,
        pipelineId: pipeline.id,
        name: stage.name,
        position: stage.position,
        stageType: stage.stageType,
      });
    }

    return pipeline;
  },

  async listPipelines(ctx: UserCtx) {
    assertCan(ctx, "read:pipelines");
    return await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.tenantId, ctx.tenantId))
      .orderBy(asc(pipelines.name));
  },

  async listPipelineStages(ctx: UserCtx, pipelineId: string) {
    assertCan(ctx, "read:pipelines");
    return await db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.pipelineId, pipelineId),
          eq(pipelineStages.tenantId, ctx.tenantId)
        )
      )
      .orderBy(asc(pipelineStages.position));
  },

  // ============================================
  // DEALS
  // ============================================

  async upsertDeal(ctx: UserCtx, input: unknown) {
    assertCan(ctx, "write:deals");
    const data = dealUpsertSchema.parse(input);

    // Ensure default pipeline if not provided
    if (!data.pipelineId) {
      const pipeline = await this.ensureDefaultPipeline(ctx);
      data.pipelineId = pipeline.id;
    }

    // Create deal
    const [inserted] = await db
      .insert(deals)
      .values({ ...data, tenantId: ctx.tenantId } as any)
      .returning();
    return { id: inserted.id, created: true };
  },

  async listDeals(ctx: UserCtx, params: unknown) {
    assertCan(ctx, "read:deals");
    const { page, pageSize, q } = paginationSchema.parse(params);

    const conditions = [eq(deals.tenantId, ctx.tenantId)];
    if (q) {
      conditions.push(ilike(deals.title, `%${q}%`));
    }

    const rows = await db
      .select()
      .from(deals)
      .where(and(...conditions))
      .orderBy(desc(deals.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countResult = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM deals WHERE tenant_id = ${ctx.tenantId}`
    );
    const total = (countResult.rows[0] as any).count;

    return { rows, page, pageSize, total };
  },

  async getDeal(ctx: UserCtx, id: string) {
    assertCan(ctx, "read:deals");
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)))
      .limit(1);
    if (!deal) throw new Error("Deal not found");
    return deal;
  },

  async updateDealStage(ctx: UserCtx, dealId: string, stageId: string) {
    assertCan(ctx, "write:deals");
    await db
      .update(deals)
      .set({ stageId, updatedAt: new Date() })
      .where(and(eq(deals.id, dealId), eq(deals.tenantId, ctx.tenantId)));
    return { updated: true };
  },

  async deleteDeal(ctx: UserCtx, id: string) {
    assertCan(ctx, "write:deals");
    await db
      .delete(deals)
      .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)));
    return { deleted: true };
  },

  // ============================================
  // ACTIVITIES
  // ============================================

  async createActivity(ctx: UserCtx, input: unknown) {
    assertCan(ctx, "write:activities");
    const data = activityCreateSchema.parse(input);
    const [inserted] = await db
      .insert(activities)
      .values({ ...data, tenantId: ctx.tenantId } as any)
      .returning();
    return { id: inserted.id, created: true };
  },

  async listActivities(ctx: UserCtx, params: unknown) {
    assertCan(ctx, "read:activities");
    const { page, pageSize, q } = paginationSchema.parse(params);

    const conditions = [eq(activities.tenantId, ctx.tenantId)];
    if (q) {
      conditions.push(
        or(
          ilike(activities.subject, `%${q}%`),
          ilike(activities.content, `%${q}%`)
        )!
      );
    }

    const rows = await db
      .select()
      .from(activities)
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countResult = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int as count FROM activities WHERE tenant_id = ${ctx.tenantId}`
    );
    const total = (countResult.rows[0] as any).count;

    return { rows, page, pageSize, total };
  },

  async getActivity(ctx: UserCtx, id: string) {
    assertCan(ctx, "read:activities");
    const [activity] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.tenantId, ctx.tenantId)))
      .limit(1);
    if (!activity) throw new Error("Activity not found");
    return activity;
  },

  async completeActivity(ctx: UserCtx, id: string) {
    assertCan(ctx, "write:activities");
    await db
      .update(activities)
      .set({ completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(activities.id, id), eq(activities.tenantId, ctx.tenantId)));
    return { completed: true };
  },

  async deleteActivity(ctx: UserCtx, id: string) {
    assertCan(ctx, "write:activities");
    await db
      .delete(activities)
      .where(and(eq(activities.id, id), eq(activities.tenantId, ctx.tenantId)));
    return { deleted: true };
  },
};
