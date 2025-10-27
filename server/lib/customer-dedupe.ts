import { db } from "../db";
import { customers, type InsertCustomer, type Customer } from "@shared/schema";
import { sql, or, eq } from "drizzle-orm";

/**
 * Upsert Customer - Intelligent deduplication
 * 
 * Searches for existing customer by:
 * 1. Email (case-insensitive)
 * 2. Phone (normalized - digits only)
 * 
 * If found: Updates existing record
 * If not found: Creates new record
 */
export async function upsertCustomer(input: InsertCustomer): Promise<Customer> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.replace(/\D/g, '') || null;
  
  // Search for existing customer
  let existing: Customer | undefined;
  
  if (email || phone) {
    const conditions = [];
    
    if (email) {
      conditions.push(sql`LOWER(${customers.email}) = ${email}`);
    }
    
    if (phone) {
      conditions.push(sql`regexp_replace(${customers.phone}, '\\D', '', 'g') = ${phone}`);
    }
    
    const results = await db
      .select()
      .from(customers)
      .where(or(...conditions))
      .limit(1);
    
    existing = results[0];
  }
  
  if (existing) {
    // Update existing customer
    console.log(`📝 [Customer Dedupe] Updating existing customer: ${existing.id}`);
    
    const [updated] = await db
      .update(customers)
      .set({ 
        ...input, 
        updatedAt: new Date() 
      })
      .where(eq(customers.id, existing.id))
      .returning();
    
    return updated;
  }
  
  // Create new customer
  console.log(`✨ [Customer Dedupe] Creating new customer`);
  
  const [created] = await db
    .insert(customers)
    .values(input)
    .returning();
  
  return created;
}
