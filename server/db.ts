import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as coreSchema from "@shared/schema";
import * as crmSchema from "@shared/schema.crm";
import * as aiCoreSchema from "@shared/schema.ai.core";
import * as aiGraphSchema from "@shared/schema.ai.graph";
import * as aiEvalSchema from "@shared/schema.ai.eval";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ 
  client: pool, 
  schema: { 
    ...coreSchema, 
    ...crmSchema, 
    ...aiCoreSchema, 
    ...aiGraphSchema, 
    ...aiEvalSchema 
  } 
});
