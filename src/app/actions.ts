"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, getBusinessContext, requireBusiness } from "@/lib/auth";
import { calculateInvoice } from "@/lib/gst";

const emailSchema = z.email();
export async function signIn(formData: FormData) {
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const password = String(formData.get("password") ?? "");
  if (!email.success || password.length === 0) redirect("/login?error=credentials");
  const user = await db.user.findUnique({ where: { email: email.data } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) redirect("/login?error=credentials");
  await createSession(user.id);
  if (await db.membership.count({ where: { userId: user.id } })) redirect("/dashboard");
  redirect("/onboarding");
}
export async function signUp(formData: FormData) {
  const name = z.string().min(2).max(80).safeParse(String(formData.get("name") ?? "").trim());
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const password = String(formData.get("password") ?? "");
  if (!name.success || !email.success || password.length < 10) redirect("/login?error=signup");
  try {
    if (await db.user.findUnique({ where: { email: email.data } })) redirect("/login?error=exists");
    const user = await db.user.create({ data: { name: name.data, email: email.data, passwordHash: await bcrypt.hash(password, 12) } });
    await createSession(user.id);
  } catch (error) {
    // Next redirects are thrown control flow and must pass through untouched.
    if (error && typeof error === "object" && "digest" in error && String((error as {digest?:unknown}).digest).startsWith("NEXT_REDIRECT")) throw error;
    console.error("Signup persistence failed. Check DATABASE_URL and database availability.", error);
    redirect("/login?error=database");
  }
  redirect("/onboarding");
}
export async function setupBusiness(formData: FormData) {
  const user = await (async () => { const { getUser } = await import("@/lib/auth"); return getUser(); })();
  if (!user) redirect("/login");
  const name = z.string().min(2).max(120).safeParse(String(formData.get("name") ?? "").trim());
  const gstin = String(formData.get("gstin") ?? "").trim().toUpperCase();
  const gstOk = !gstin || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
  if (!name.success || !gstOk) redirect("/onboarding?error=validation");
  const stateCode = gstin ? gstin.slice(0, 2) : undefined;
  const business = await db.business.create({ data: { name: name.data, businessType: String(formData.get("type") ?? "Other"), gstin: gstin || undefined, state: String(formData.get("state") ?? "") || undefined, stateCode, address: String(formData.get("address") ?? "") || undefined, phone: String(formData.get("phone") ?? "") || undefined, memberships: { create: { userId: user.id, role: "OWNER" } }, branches: { create: { name: "Main branch", stateCode } }, warehouses: { create: { name: "Main warehouse" } } } });
  await db.auditLog.create({ data: { businessId: business.id, userId: user.id, action: "BUSINESS_CREATED", entityType: "Business", entityId: business.id } });
  redirect("/dashboard");
}
const customerSchema = z.object({ name:z.string().min(1).max(120), company:z.string().max(120).optional(), email:z.union([z.email(),z.literal("")]).optional(), phone:z.string().max(20).optional(), gstin:z.string().max(15).optional(), state:z.string().max(80).optional(), stateCode:z.string().max(2).optional() });
export async function addCustomer(formData: FormData) {
  const ctx=await requireBusiness(); const parsed=customerSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success) redirect("/customers/new?error=validation");
  const code=`CUS-${Date.now().toString().slice(-7)}`;
  await db.customer.create({data:{...parsed.data,email:parsed.data.email||null,businessId:ctx.business.id,code}});
  await db.auditLog.create({data:{businessId:ctx.business.id,userId:ctx.user.id,action:"CUSTOMER_CREATED",entityType:"Customer",entityId:code}});
  revalidatePath("/customers");redirect("/customers");
}
const productSchema = z.object({sku:z.string().min(1).max(40),name:z.string().min(1).max(120),category:z.string().max(80).optional(),unit:z.string().max(20),gstRate:z.coerce.number().min(0).max(100),purchasePrice:z.coerce.number().min(0),sellingPrice:z.coerce.number().min(0),openingStock:z.coerce.number().min(0),minimumStock:z.coerce.number().min(0),hsnSac:z.string().max(20).optional()});
export async function addProduct(formData:FormData){
 const ctx=await requireBusiness(); const parsed=productSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/products/new?error=validation");
 const p=parsed.data;const product=await db.product.create({data:{businessId:ctx.business.id,...p}});
 if(p.openingStock>0)await db.stockMovement.create({data:{businessId:ctx.business.id,productId:product.id,type:"OPENING",quantity:p.openingStock,unitCost:p.purchasePrice}});
 await db.auditLog.create({data:{businessId:ctx.business.id,userId:ctx.user.id,action:"PRODUCT_CREATED",entityType:"Product",entityId:product.id}});revalidatePath("/products");redirect("/products");
}
const invoiceSchema=z.object({customerId:z.string().optional(),description:z.string().min(1).max(200),quantity:z.coerce.number().positive(),rate:z.coerce.number().nonnegative(),gstRate:z.coerce.number().min(0).max(100),discountPercent:z.coerce.number().min(0).max(100)});
export async function addInvoice(formData:FormData){
 const ctx=await requireBusiness();const parsed=invoiceSchema.safeParse(Object.fromEntries(formData));if(!parsed.success)redirect("/invoices/new?error=validation");const v=parsed.data;
 const customer=v.customerId?await db.customer.findFirst({where:{id:v.customerId,businessId:ctx.business.id}}):null;if(v.customerId&&!customer)redirect("/invoices/new?error=customer");
 const interstate=!!(ctx.business.stateCode&&customer?.stateCode&&ctx.business.stateCode!==customer.stateCode);
 const calc=calculateInvoice([{quantity:v.quantity,rate:v.rate,gstRate:v.gstRate,discountPercent:v.discountPercent}],interstate);
 const number=`INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
 await db.invoice.create({data:{businessId:ctx.business.id,customerId:customer?.id,number,status:"ISSUED",sellerStateCode:ctx.business.stateCode,buyerStateCode:customer?.stateCode,subtotal:calc.subtotal,taxTotal:calc.taxTotal,total:calc.total,items:{create:{description:v.description,quantity:v.quantity,rate:v.rate,gstRate:v.gstRate,discountPercent:v.discountPercent,taxableValue:calc.lines[0].taxableValue,cgst:calc.lines[0].cgst,sgst:calc.lines[0].sgst,igst:calc.lines[0].igst,total:calc.total}}}});
 await db.auditLog.create({data:{businessId:ctx.business.id,userId:ctx.user.id,action:"INVOICE_ISSUED",entityType:"Invoice",entityId:number}});revalidatePath("/invoices");revalidatePath("/dashboard");redirect("/invoices");
}
export async function recordPayment(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("invoiceId") ?? "");
  const amount = Number(formData.get("amount"));
  const method = z.enum(["CASH", "BANK", "UPI", "CARD", "GATEWAY", "CHEQUE", "OTHER"]).safeParse(String(formData.get("method")));
  if (!Number.isFinite(amount) || amount <= 0 || !method.success) redirect("/finance?error=validation");
  const invoice = await db.invoice.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!invoice || amount > Number(invoice.total) - Number(invoice.amountPaid)) redirect("/finance?error=amount");
  await db.$transaction(async (tx) => {
    await tx.payment.create({ data: { businessId: ctx.business.id, invoiceId: id, amount, method: method.data } });
    const paid = Number(invoice.amountPaid) + amount;
    await tx.invoice.update({ where: { id }, data: { amountPaid: paid, status: paid >= Number(invoice.total) ? "PAID" : "PARTIALLY_PAID" } });
    await tx.auditLog.create({ data: { businessId: ctx.business.id, userId: ctx.user.id, action: "PAYMENT_RECORDED", entityType: "Invoice", entityId: id, metadata: JSON.stringify({ amount, method: method.data }) } });
  });
  revalidatePath("/finance");
  revalidatePath("/invoices");
  redirect("/finance");
}
export async function signOut(){const {cookies}=await import("next/headers");(await cookies()).delete("royal_session");redirect("/login");}

export async function addExpense(formData: FormData) {
  const ctx = await requireBusiness();
  const category = z.string().min(1).max(80).safeParse(String(formData.get("category") ?? ""));
  const amount = z.coerce.number().positive().safeParse(formData.get("amount"));
  if (!category.success || !amount.success) redirect("/finance?error=expense");
  await db.expense.create({ data: { businessId: ctx.business.id, category: category.data, amount: amount.data, taxAmount: Number(formData.get("taxAmount") ?? 0), vendor: String(formData.get("vendor") ?? "") || null, description: String(formData.get("description") ?? "") || null, method: String(formData.get("method") ?? "CASH") } });
  await db.auditLog.create({ data: { businessId: ctx.business.id, userId: ctx.user.id, action: "EXPENSE_CREATED", entityType: "Expense" } });
  revalidatePath("/finance"); revalidatePath("/dashboard"); redirect("/finance");
}

export async function addLead(formData: FormData) {
  const ctx = await requireBusiness();
  const name = z.string().min(2).max(120).safeParse(String(formData.get("name") ?? "").trim());
  if (!name.success) redirect("/crm?error=lead");
  await db.lead.create({ data: { businessId: ctx.business.id, name: name.data, company: String(formData.get("company") ?? "") || null, phone: String(formData.get("phone") ?? "") || null, email: String(formData.get("email") ?? "") || null, stage: String(formData.get("stage") ?? "NEW"), estimatedValue: Number(formData.get("estimatedValue") ?? 0) || null, followUpAt: formData.get("followUpAt") ? new Date(String(formData.get("followUpAt"))) : null } });
  revalidatePath("/crm"); redirect("/crm");
}

export async function addTask(formData: FormData) {
  const ctx = await requireBusiness();
  const title = z.string().min(2).max(160).safeParse(String(formData.get("title") ?? "").trim());
  if (!title.success) redirect("/crm?error=task");
  const leadId = String(formData.get("leadId") ?? "") || null;
  if (leadId && !await db.lead.findFirst({ where: { id: leadId, businessId: ctx.business.id } })) redirect("/crm?error=task");
  await db.task.create({ data: { businessId: ctx.business.id, leadId, title: title.data, priority: String(formData.get("priority") ?? "MEDIUM"), dueAt: formData.get("dueAt") ? new Date(String(formData.get("dueAt"))) : null } });
  revalidatePath("/crm"); redirect("/crm");
}

export async function addAutomationRule(formData: FormData) {
  const ctx = await requireBusiness();
  const name = z.string().min(2).max(120).safeParse(String(formData.get("name") ?? "").trim());
  if (!name.success) redirect("/automations?error=rule");
  await db.automationRule.create({ data: { businessId: ctx.business.id, name: name.data, trigger: String(formData.get("trigger") ?? "INVOICE_OVERDUE"), condition: String(formData.get("condition") ?? "") || null, action: String(formData.get("action") ?? "CREATE_TASK") } });
  revalidatePath("/automations"); redirect("/automations");
}
