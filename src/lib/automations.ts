import { db } from "@/lib/db";
import { inr } from "@/lib/money";

type Event = {
  businessId: string;
  trigger: "INVOICE_OVERDUE" | "PAYMENT_RECEIVED" | "STOCK_LOW" | "LEAD_CREATED";
  entityType: string;
  entityId: string;
  title: string;
  details: string;
  amount?: number;
  leadId?: string;
};

function matchesCondition(condition: string | null, amount?: number) {
  if (!condition?.trim()) return true;
  const match = condition.match(/(?:MIN_AMOUNT=|greater than\s*₹?|>\s*₹?)([\d,.]+)/i);
  if (!match) return false;
  const minimum = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(minimum) && amount !== undefined && amount > minimum;
}

/** Idempotent per rule/entity; external side effects are represented as reviewable tasks only. */
export async function processAutomationEvent(event: Event) {
  const rules = await db.automationRule.findMany({ where: { businessId: event.businessId, trigger: event.trigger, isActive: true } });
  let created = 0;
  for (const rule of rules) {
    if (!matchesCondition(rule.condition, event.amount)) continue;
    try {
      await db.$transaction(async (tx) => {
        const run = await tx.automationRun.create({ data: { businessId: event.businessId, ruleId: rule.id, trigger: event.trigger, entityType: event.entityType, entityId: event.entityId, action: rule.action, result: "Task created" } });
        const isReminder = rule.action === "PREPARE_REMINDER";
        const isNotification = rule.action === "NOTIFY_MANAGER";
        const title = isReminder ? `Review reminder: ${event.title}` : isNotification ? `Manager review: ${event.title}` : `Follow up: ${event.title}`;
        await tx.task.create({ data: { businessId: event.businessId, leadId: event.leadId, title: title.slice(0, 160), status: "OPEN", priority: event.amount && event.amount >= 50000 ? "HIGH" : "MEDIUM", notes: `${event.details}\n\nCreated by automation: ${rule.name}${isReminder ? "\n\nReminder draft: Please review this follow-up before contacting the customer." : isNotification ? "\n\nManager notification prepared for review; no message was sent." : ""}` } });
        await tx.auditLog.create({ data: { businessId: event.businessId, action: "AUTOMATION_EXECUTED", entityType: "AutomationRun", entityId: run.id, metadata: JSON.stringify({ ruleId: rule.id, trigger: event.trigger, targetType: event.entityType, targetId: event.entityId }) } });
      });
      created += 1;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") continue;
      throw error;
    }
  }
  return created;
}

export async function runScheduledAutomations(businessId: string) {
  const now = new Date();
  const [overdue, products] = await Promise.all([
    db.invoice.findMany({ where: { businessId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } }, include: { customer: { select: { name: true } } }, take: 500 }),
    db.product.findMany({ where: { businessId }, take: 500 }),
  ]);
  let processed = 0;
  for (const invoice of overdue) {
    const balance = Number(invoice.total) - Number(invoice.amountPaid);
    if (balance <= 0) continue;
    processed += await processAutomationEvent({ businessId, trigger: "INVOICE_OVERDUE", entityType: "Invoice", entityId: invoice.id, title: `${invoice.number} · ${invoice.customer?.name ?? "Customer"}`, details: `Outstanding balance ${inr(balance)}. Due ${invoice.dueDate?.toLocaleDateString("en-IN") ?? "date unavailable"}.`, amount: balance });
  }
  for (const product of products) {
    if (Number(product.openingStock) > Number(product.minimumStock)) continue;
    processed += await processAutomationEvent({ businessId, trigger: "STOCK_LOW", entityType: "Product", entityId: product.id, title: `${product.name} is low in stock`, details: `On hand: ${product.openingStock} ${product.unit}; minimum: ${product.minimumStock} ${product.unit}.` });
  }
  return processed;
}
