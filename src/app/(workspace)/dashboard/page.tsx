import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Package, Plus, ReceiptText, UsersRound } from "lucide-react";
import { Shell } from "@/components/shell";
import { getBusinessContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr } from "@/lib/money";

export default async function Dashboard() {
  const context = await getBusinessContext();
  if (!context) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const [monthInvoices, monthExpenses, receivables, customers, products, recentInvoices] = await Promise.all([
    db.invoice.findMany({
      where: { businessId: context.business.id, date: { gte: monthStart }, status: { not: "CANCELLED" } },
      select: { total: true, date: true },
    }),
    db.expense.aggregate({ where: { businessId: context.business.id, date: { gte: monthStart } }, _sum: { amount: true } }),
    db.invoice.aggregate({
      where: { businessId: context.business.id, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { total: true, amountPaid: true },
    }),
    db.customer.count({ where: { businessId: context.business.id } }),
    db.product.findMany({ where: { businessId: context.business.id }, take: 5, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({
      where: { businessId: context.business.id }, take: 5, orderBy: { date: "desc" },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const sales = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const expenses = Number(monthExpenses._sum.amount ?? 0);
  const outstanding = Number(receivables._sum.total ?? 0) - Number(receivables._sum.amountPaid ?? 0);
  const dailySales = Array.from({ length: daysInMonth }, () => 0);
  for (const invoice of monthInvoices) dailySales[invoice.date.getDate() - 1] += Number(invoice.total);
  const maxDailySales = Math.max(...dailySales, 1);
  const chartPoints = dailySales.map((amount, index) => ({
    x: (index / Math.max(daysInMonth - 1, 1)) * 600,
    y: 195 - (amount / maxDailySales) * 160,
  }));
  const chartLine = chartPoints.map((point) => `${point.x} ${point.y}`).join(" L ");
  const chartFill = chartPoints.length ? `M ${chartPoints[0].x} 195 L ${chartLine} L ${chartPoints.at(-1)?.x} 195 Z` : "";

  return (
    <Shell current="/dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">OVERVIEW · {context.business.name}</div>
          <h1 className="page-title">Your business, at a glance</h1>
          <div className="sub">A live view of your workspace for {new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(now)}.</div>
        </div>
        <Link href="/invoices/new" className="btn"><Plus size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />New invoice</Link>
      </div>

      <div className="grid metrics">
        {[
          ["Sales this month", inr(sales), "From issued invoices", true],
          ["Purchases & expenses", inr(expenses), "Recorded operating expenses", false],
          ["Net before tax", inr(sales - expenses), "Sales less recorded expenses", true],
          ["Receivables", inr(outstanding), "Across open invoices", false],
        ].map(([title, value, hint, up]) => (
          <div className="card" key={String(title)}>
            <div className="metric-label">{title}</div>
            <div className="metric-value">{value}</div>
            <div className={`metric-foot ${up ? "good" : ""}`}>
              {up ? <ArrowUpRight size={12} style={{ verticalAlign: "middle" }} /> : <ArrowDownRight size={12} style={{ verticalAlign: "middle" }} />}
              &nbsp;{hint}
            </div>
          </div>
        ))}
      </div>

      <div className="grid two-col">
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div><div className="section-title">Sales activity</div><div className="section-sub">Daily invoice sales this month</div></div>
            <span className="pill">Month to date</span>
          </div>
          <div className="chart" role="img" aria-label={`Daily invoice sales this month. Total ${inr(sales)}.`}>
            <svg viewBox="0 0 600 210" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#176b55" stopOpacity=".17" /><stop offset="1" stopColor="#176b55" stopOpacity="0" /></linearGradient></defs>
              <path d={chartFill} fill="url(#fill)" />
              {chartPoints.length > 1 && <path d={`M ${chartLine}`} fill="none" stroke="#176b55" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
            </svg>
          </div>
          <div className="legend"><span><i className="dot" />Sales</span><span style={{ marginLeft: "auto" }}>1 &nbsp;&nbsp; 7 &nbsp;&nbsp; 14 &nbsp;&nbsp; 21 &nbsp;&nbsp; {daysInMonth}</span></div>
        </section>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div><div className="section-title">Quick actions</div><div className="section-sub">Common tasks, one click away</div></div>
            <span className="pill">{customers} customers</span>
          </div>
          <div style={{ marginTop: 16 }}>
            {[["Create an invoice", "/invoices/new", ReceiptText], ["Add a customer", "/customers/new", UsersRound], ["Add a product", "/products/new", Package]].map(([label, href, Icon]) => (
              <Link href={String(href)} className="row" key={String(label)}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="product-icon"><Icon size={15} /></span>{String(label)}</span>
                <ArrowRight size={15} color="#97a49f" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid two-col activity">
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div className="section-title">Recent invoices</div><div className="section-sub">Latest customer billing</div></div>
            <Link href="/invoices" className="section-sub" style={{ color: "#176b55" }}>View all →</Link>
          </div>
          {recentInvoices.length ? recentInvoices.map((invoice) => (
            <div className="row" key={invoice.id}>
              <span><b>{invoice.customer?.name ?? "Walk-in customer"}</b><div className="section-sub" style={{ marginTop: 4 }}>{invoice.number} · {invoice.date.toLocaleDateString("en-IN")}</div></span>
              <span style={{ textAlign: "right" }}><b>{inr(Number(invoice.total))}</b><div className="section-sub" style={{ marginTop: 4 }}>{invoice.status.replaceAll("_", " ")}</div></span>
            </div>
          )) : <div className="empty">No invoices yet. Create your first invoice to see activity here.</div>}
        </section>
        <section className="card">
          <div className="section-title">Recently added products</div><div className="section-sub">Latest items in your catalog</div>
          {products.length ? products.map((product) => (
            <div className="row" key={product.id}>
              <span className="stock"><span className="product-icon"><Package size={15} /></span><span><b>{product.name}</b><div className="section-sub">{product.sku}</div></span></span>
              <span className="pill">{inr(Number(product.sellingPrice))}</span>
            </div>
          )) : <div className="empty">Add products to start building your catalog.</div>}
          <Link href="/products" className="section-sub" style={{ color: "#176b55", display: "block", marginTop: 10 }}>Manage products →</Link>
        </section>
      </div>
    </Shell>
  );
}
