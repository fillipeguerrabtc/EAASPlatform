import { db } from "../db";
import { activities } from "@shared/schema";
import { sql, and, lt } from "drizzle-orm";

/**
 * SLA Worker - Marca activities atrasadas
 * 
 * Busca activities com:
 * - dueDate < now()
 * - completedAt IS NULL
 * 
 * E atualiza criando um flag no metadata: { isLate: true }
 * Base para futuras notificações automáticas
 */
export async function runSLAWorker(): Promise<{
  checked: number;
  markedLate: number;
}> {
  try {
    console.log("🔍 [SLA Worker] Checking for late activities...");
    
    // Busca activities atrasadas (dueDate passou e não foi completada)
    const lateActivities = await db
      .select()
      .from(activities)
      .where(
        and(
          lt(activities.dueDate, new Date()),
          sql`${activities.completedAt} IS NULL`
        )
      );
    
    let markedCount = 0;
    
    // Marca cada uma como atrasada no metadata
    for (const activity of lateActivities) {
      const currentMetadata = (activity.metadata as any) || {};
      
      // Só atualiza se ainda não está marcada como late
      if (!currentMetadata.isLate) {
        await db
          .update(activities)
          .set({ 
            metadata: { 
              ...currentMetadata, 
              isLate: true,
              markedLateAt: new Date().toISOString()
            } 
          })
          .where(sql`${activities.id} = ${activity.id}`);
        
        markedCount++;
        console.log(`⏰ [SLA Worker] Activity ${activity.id} marked as late`);
      }
    }
    
    const result = {
      checked: lateActivities.length,
      markedLate: markedCount
    };
    
    if (markedCount > 0) {
      console.log(`✅ [SLA Worker] Processed ${markedCount}/${lateActivities.length} late activities`);
    } else if (lateActivities.length > 0) {
      console.log(`ℹ️ [SLA Worker] Found ${lateActivities.length} late activities (already marked)`);
    } else {
      console.log(`✅ [SLA Worker] No late activities found`);
    }
    
    return result;
  } catch (error) {
    console.error("❌ [SLA Worker] Error:", error);
    throw error;
  }
}

/**
 * Inicia o worker em intervalo regular (a cada 5 minutos)
 * Pode ser ativado/desativado via env var: ENABLE_SLA_WORKER=true
 */
export function startSLAWorker(intervalMinutes: number = 5) {
  const enabled = process.env.ENABLE_SLA_WORKER === "true";
  
  if (!enabled) {
    console.log("ℹ️ [SLA Worker] Disabled (set ENABLE_SLA_WORKER=true to enable)");
    return null;
  }
  
  console.log(`🚀 [SLA Worker] Starting (interval: ${intervalMinutes}min)`);
  
  // Roda imediatamente
  runSLAWorker().catch(console.error);
  
  // Depois roda a cada X minutos
  const interval = setInterval(() => {
    runSLAWorker().catch(console.error);
  }, intervalMinutes * 60 * 1000);
  
  return interval;
}
