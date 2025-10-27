// server/modules/crm/dedupe.ts - Contact deduplication logic
import { db } from "../../db";
import { contacts } from "@shared/schema.crm";
import { and, eq, sql } from "drizzle-orm";

/**
 * Deduplication Rules:
 * 1. Email match (case-insensitive) = exact duplicate
 * 2. Phone normalized match = exact duplicate
 * 3. Name similarity + same companyId = candidate for merge (optional)
 */

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  return p.replace(/[^\d]/g, "");
}

export async function findContactDuplicates(
  tenantId: string,
  payload: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    companyId?: string;
  }
) {
  const email = payload.email?.toLowerCase();
  const normPhone = normalizePhone(payload.phone);
  const nameLike = `${(payload.firstName || "").toLowerCase()} ${(payload.lastName || "").toLowerCase()}`.trim();

  // 1) Check email duplicates
  if (email) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          sql`lower(${contacts.email}) = ${email}`
        )
      )
      .limit(5);

    if (rows.length) {
      return { exact: rows, by: "email" };
    }
  }

  // 2) Check phone duplicates (normalized)
  if (normPhone) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          sql`regexp_replace(${contacts.phone}, '[^0-9]', '', 'g') = ${normPhone}`
        )
      )
      .limit(5);

    if (rows.length) {
      return { exact: rows, by: "phone" };
    }
  }

  // 3) Check name similarity candidates (same company)
  // Note: Requires pg_trgm extension for similarity() or levenshtein
  // For now, simple lowercase exact match; enhance with fuzzy search if needed
  if (nameLike && payload.companyId) {
    const rows = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.companyId, payload.companyId),
          sql`lower(${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, '')) = ${nameLike}`
        )
      )
      .limit(5);

    if (rows.length) {
      return { candidates: rows, by: "name+company" };
    }
  }

  return { exact: [], candidates: [] };
}
