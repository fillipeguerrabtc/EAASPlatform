/**
 * Pagination Helper
 * 
 * Standard query parser for all list endpoints.
 * Prevents loading entire tables into memory.
 * 
 * Usage:
 * ```ts
 * app.get("/api/customers", (req, res) => {
 *   const { page, pageSize, offset, search, sort } = parseListQuery(req.query);
 *   const customers = await db.query.customers.findMany({
 *     limit: pageSize,
 *     offset,
 *     where: search ? like(customers.name, `%${search}%`) : undefined,
 *   });
 *   res.json({ data: customers, page, pageSize });
 * });
 * ```
 */

export interface ParsedListQuery {
  page: number;        // Current page (1-indexed)
  pageSize: number;    // Items per page (10-100)
  offset: number;      // SQL offset for current page
  search: string;      // Lowercase search term
  sort: string;        // Sort format: "field:asc" or "field:desc"
}

export function parseListQuery(query: any): ParsedListQuery {
  // Page: minimum 1
  const page = Math.max(1, parseInt(query.page as string) || 1);
  
  // Page size: between 10 and 100, default 20
  const rawPageSize = parseInt(query.pageSize as string) || 20;
  const pageSize = Math.min(100, Math.max(10, rawPageSize));
  
  // Calculate SQL offset
  const offset = (page - 1) * pageSize;
  
  // Search term (lowercase for case-insensitive comparison)
  const search = String(query.q || query.search || "").trim().toLowerCase();
  
  // Sort: "createdAt:desc" by default
  const sort = String(query.sort || "createdAt:desc");
  
  return {
    page,
    pageSize,
    offset,
    search,
    sort,
  };
}

/**
 * Parse sort string into field and direction
 * 
 * @example
 * parseSortString("name:asc") // { field: "name", direction: "asc" }
 * parseSortString("createdAt:desc") // { field: "createdAt", direction: "desc" }
 */
export function parseSortString(sort: string): { field: string; direction: "asc" | "desc" } {
  const [field, direction] = sort.split(":");
  return {
    field: field || "createdAt",
    direction: (direction === "asc" ? "asc" : "desc") as "asc" | "desc",
  };
}
