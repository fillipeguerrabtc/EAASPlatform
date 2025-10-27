// server/modules/crm/audit.ts - CRM audit trail logging
import { db } from "../../db";
import { crmAudit } from "@shared/schema.crm";

export async function logAudit(args: {
  tenantId: string;
  entity: "contact" | "company" | "deal" | "activity";
  entityId: string;
  action: "create" | "update" | "delete" | "import" | "message";
  before?: any;
  after?: any;
  context?: any;
}) {
  await db.insert(crmAudit).values({
    tenantId: args.tenantId,
    entity: args.entity,
    entityId: args.entityId,
    action: args.action,
    beforeJson: args.before ? JSON.stringify(args.before) : null,
    afterJson: args.after ? JSON.stringify(args.after) : null,
    context: args.context ? JSON.stringify(args.context) : null,
  });
}
