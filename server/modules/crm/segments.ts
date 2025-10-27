// server/modules/crm/segments.ts - Dynamic segment engine with field whitelisting
import { and, or, eq, ilike, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import { segments, contacts, companies, deals } from "@shared/schema.crm";

type Rule = {
  field: string;
  op: "eq" | "neq" | "contains" | "starts" | "ends" | "gte" | "lte" | "in";
  value: string | number | string[] | number[];
};

type SegmentQuery = {
  rules: Rule[];
  logic?: "AND" | "OR";
};

// ===============================================
// FIELD WHITELIST (Security - prevent SQL injection via arbitrary field names)
// ===============================================
const ALLOWED_FIELDS = {
  contacts: new Set([
    "id",
    "firstName",
    "lastName",
    "email",
    "phone",
    "companyId",
    "title",
    "source",
    "isOptIn",
    "createdAt",
  ]),
  companies: new Set([
    "id",
    "name",
    "industry",
    "size",
    "website",
    "createdAt",
  ]),
  deals: new Set([
    "id",
    "title",
    "value",
    "stageId",
    "pipelineId",
    "contactId",
    "companyId",
    "expectedCloseDate",
    "createdAt",
  ]),
};

function validateField(entity: "contacts" | "companies" | "deals", field: string): boolean {
  return ALLOWED_FIELDS[entity].has(field);
}

function buildPredicate(
  entity: "contacts" | "companies" | "deals",
  tenantId: string,
  query: SegmentQuery
) {
  const logic = query.logic || "AND";
  const table = entity === "contacts" ? contacts : entity === "companies" ? companies : deals;
  
  const parts: any[] = [eq(table.tenantId, tenantId)];

  for (const rule of query.rules) {
    // SECURITY: Validate field against whitelist
    if (!validateField(entity, rule.field)) {
      throw new Error(`Invalid field: ${rule.field} for entity: ${entity}`);
    }

    const field = (table as any)[rule.field];
    if (!field) continue;
    parts.push(ruleToExpr(field, rule.op, rule.value));
  }

  return logic === "AND" ? and(...parts) : or(...parts);
}

function ruleToExpr(field: any, op: Rule["op"], value: any) {
  switch (op) {
    case "eq":
      return eq(field, value);
    case "neq":
      return sql`${field} <> ${value}`;
    case "contains":
      return ilike(field, `%${value}%`);
    case "starts":
      return ilike(field, `${value}%`);
    case "ends":
      return ilike(field, `%${value}`);
    case "gte":
      return gte(field, value);
    case "lte":
      return lte(field, value);
    case "in":
      return sql`${field} = ANY(${value})`;
    default:
      return eq(field, value);
  }
}

export const SegmentsEngine = {
  async runSegment(
    tenantId: string,
    segmentId: string,
    options: { page?: number; pageSize?: number } = {}
  ) {
    const { page = 1, pageSize = 50 } = options;

    const [segment] = await db
      .select()
      .from(segments)
      .where(eq(segments.id, segmentId))
      .limit(1);

    if (!segment) throw new Error("Segment not found");
    if (segment.tenantId !== tenantId) throw new Error("Forbidden");

    const entity = segment.entity as "contacts" | "companies" | "deals";
    const query = JSON.parse(segment.queryJson) as SegmentQuery;
    
    // Validate query before execution
    const predicate = buildPredicate(entity, tenantId, query);

    let rows: any[] = [];
    let count = 0;

    if (entity === "contacts") {
      rows = await db
        .select()
        .from(contacts)
        .where(predicate)
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const countResult = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int as count FROM contacts WHERE tenant_id = ${tenantId}`
      );
      count = (countResult.rows[0] as any).count;
    } else if (entity === "companies") {
      rows = await db
        .select()
        .from(companies)
        .where(predicate)
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const countResult = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int as count FROM companies WHERE tenant_id = ${tenantId}`
      );
      count = (countResult.rows[0] as any).count;
    } else {
      rows = await db
        .select()
        .from(deals)
        .where(predicate)
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      const countResult = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int as count FROM deals WHERE tenant_id = ${tenantId}`
      );
      count = (countResult.rows[0] as any).count;
    }

    return { entity, rows, page, pageSize, total: count };
  },
};
