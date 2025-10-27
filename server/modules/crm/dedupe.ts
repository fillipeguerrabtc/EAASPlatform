// server/modules/crm/dedupe.ts - Contact deduplication with Levenshtein fuzzy matching
import { db } from "../../db";
import { contacts, companies } from "@shared/schema.crm";
import { and, eq, sql } from "drizzle-orm";

/**
 * Deduplication Rules:
 * 1. Email match (case-insensitive) = exact duplicate
 * 2. Phone normalized match = exact duplicate
 * 3. Name similarity (Levenshtein) + same companyId = candidate for merge
 */

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  return p.replace(/[^\d]/g, "");
}

/**
 * Levenshtein distance implementation
 * Measures the minimum number of single-character edits (insertions, deletions, substitutions)
 * needed to transform one string into another.
 * 
 * Example:
 * - levenshteinDistance("John Doe", "Jon Doe") = 1
 * - levenshteinDistance("Jane Smith", "Janet Smith") = 1
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calculates similarity percentage (0-100) between two strings
 * Higher percentage = more similar
 */
function similarityPercent(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return ((maxLen - distance) / maxLen) * 100;
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
  const fullName = `${(payload.firstName || "").toLowerCase()} ${(payload.lastName || "").toLowerCase()}`.trim();

  // 1) Check email duplicates (exact match)
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

  // 3) Check name similarity using Levenshtein distance
  // Fetch all contacts in the same company (or all if no company)
  if (fullName) {
    let query = db
      .select()
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId))
      .limit(100); // Limit to avoid performance issues

    // Optionally filter by company
    if (payload.companyId) {
      query = db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            eq(contacts.companyId, payload.companyId)
          )
        )
        .limit(100);
    }

    const allContacts = await query;

    // Apply Levenshtein fuzzy matching
    const SIMILARITY_THRESHOLD = 80; // 80% similarity required
    const candidates = allContacts.filter((contact) => {
      const contactName = `${(contact.firstName || "").toLowerCase()} ${(contact.lastName || "").toLowerCase()}`.trim();
      if (!contactName) return false;
      
      const similarity = similarityPercent(fullName, contactName);
      return similarity >= SIMILARITY_THRESHOLD && similarity < 100; // Exclude exact matches
    });

    if (candidates.length) {
      return { 
        candidates, 
        by: "name_similarity",
        meta: { 
          algorithm: "levenshtein",
          threshold: SIMILARITY_THRESHOLD 
        }
      };
    }
  }

  return { exact: [], candidates: [] };
}

/**
 * Find duplicate companies by name similarity
 */
export async function findCompanyDuplicates(
  tenantId: string,
  companyName: string
) {
  const normalized = companyName.toLowerCase().trim();

  // 1) Check exact match in companies table
  const exact = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.tenantId, tenantId),
        sql`lower(${companies.name}) = ${normalized}`
      )
    )
    .limit(5);

  if (exact.length) {
    return { exact, by: "name_exact" };
  }

  // 2) Fuzzy matching using Levenshtein on companies table
  const allCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.tenantId, tenantId))
    .limit(100);

  const SIMILARITY_THRESHOLD = 85; // Higher threshold for company names
  const candidates = allCompanies.filter((company) => {
    if (!company.name) return false;
    const similarity = similarityPercent(normalized, company.name.toLowerCase());
    return similarity >= SIMILARITY_THRESHOLD && similarity < 100;
  });

  if (candidates.length) {
    return { 
      candidates, 
      by: "name_similarity",
      meta: { algorithm: "levenshtein", threshold: SIMILARITY_THRESHOLD }
    };
  }

  return { exact: [], candidates: [] };
}
