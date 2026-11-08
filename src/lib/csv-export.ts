import { Account, Client, Order } from "./types";
import { calculateAccountMetrics, calculateOrderMetrics } from "./calculations";

function downloadCsvFile(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportOrdersCsv(
  orders: Order[],
  accounts: Account[],
  clients: Client[],
  usdToInr: number = 88
) {
  const headers = [
    "Order ID",
    "Date",
    "Video Title",
    "Video Link",
    "Client Name",
    "Account Name",
    "Google Ads Customer ID",
    "Campaign ID",
    "Order Size (Views)",
    "Delivered Views",
    "Progress (%)",
    "Client Rate (Paise/View)",
    "Revenue (INR)",
    "Spend (USD)",
    "Spend (INR)",
    "Status",
  ];

  const rows = orders.map((order) => {
    const client = clients.find((c) => c.id === order.client_id);
    const account = accounts.find((a) => a.id === order.account_id);
    const metrics = calculateOrderMetrics(order);
    const spendInr = (order.spend_usd || 0) * usdToInr;

    return [
      `"${order.id}"`,
      `"${order.date}"`,
      `"${(order.video_title || "").replace(/"/g, '""')}"`,
      `"${(order.video_link || "").replace(/"/g, '""')}"`,
      `"${(client?.name || "Unknown").replace(/"/g, '""')}"`,
      `"${(account?.name || "Unknown").replace(/"/g, '""')}"`,
      `"${account?.google_ads_customer_id || ""}"`,
      `"${order.campaign_id || ""}"`,
      order.order_size_views,
      order.delivered_views,
      metrics.progressPercent,
      order.client_rate_paise_per_view,
      metrics.revenueInr,
      order.spend_usd,
      spendInr.toFixed(2),
      order.status,
    ];
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadCsvFile(csv, `promo-crm-orders-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportAccountsCsv(
  accounts: Account[],
  orders: Order[],
  usdToInr: number = 88
) {
  const headers = [
    "Account ID",
    "Account Name",
    "Google Ads Customer ID",
    "Account Email",
    "Cash Paid (USD)",
    "Real Cash (INR)",
    "Credit Offered (USD)",
    "Realized Leverage (USD)",
    "Leverage Lost (USD)",
    "Credit Left (USD)",
    "Total Spend (USD)",
    "Total Delivered Views",
    "Total Revenue (INR)",
    "Profit (INR)",
    "Total Cost/View (Paise)",
    "Cash Cost/View (Paise)",
    "Avg Client Rate (Paise)",
    "Status",
    "Orders Count",
  ];

  const rows = accounts.map((acc) => {
    const metrics = calculateAccountMetrics(acc, orders, usdToInr);
    return [
      `"${acc.id}"`,
      `"${(acc.name || "").replace(/"/g, '""')}"`,
      `"${acc.google_ads_customer_id}"`,
      `"${acc.account_email}"`,
      acc.cash_paid_usd,
      metrics.realCashInr,
      acc.credit_offered_usd,
      metrics.realizedLeverageUsd,
      metrics.leverageLostUsd,
      metrics.creditLeftUsd,
      metrics.totalSpendUsd,
      metrics.totalDeliveredViews,
      metrics.totalRevenueInr,
      metrics.profitInr,
      metrics.totalCostPerViewPaise,
      metrics.cashCostPerViewPaise,
      metrics.avgClientRatePaise,
      acc.status,
      metrics.orderCount,
    ];
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadCsvFile(csv, `promo-crm-accounts-${new Date().toISOString().slice(0, 10)}.csv`);
}
