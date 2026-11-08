"use client";

import React, { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Percent,
  Calendar,
  Building,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import {
  calculateAccountMetrics,
  calculateOrderMetrics,
} from "@/lib/calculations";

export default function ReportsPage() {
  const [state, setState] = useState<AppState>(() => mockStore.getState());
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "30d" | "7d">("all");

  useEffect(() => {
    return mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
  }, []);

  const { accounts, orders, clients, settings } = state;
  const usdToInr = settings.usd_to_inr || 88;

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (selectedAccountId !== "all" && o.account_id !== selectedAccountId) {
      return false;
    }
    if (dateRange !== "all") {
      const orderDate = new Date(o.date).getTime();
      const days = dateRange === "7d" ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (orderDate < cutoff) return false;
    }
    return true;
  });

  // Calculate detailed row metrics
  const reportRows = filteredOrders.map((o) => {
    const account = accounts.find((a) => a.id === o.account_id);
    const client = clients.find((c) => c.id === o.client_id);

    // Account unit cash cost per view
    const accMetrics = account
      ? calculateAccountMetrics(account, orders, usdToInr)
      : null;
    const cashCostPerViewPaise = accMetrics ? accMetrics.cashCostPerViewPaise : 0;

    const om = calculateOrderMetrics(o, settings.alert_threshold_percent, cashCostPerViewPaise);

    const spendUsd = o.spend_usd || 0;
    const realCashCostInr = (o.delivered_views * cashCostPerViewPaise) / 100;
    const costPerViewPaise =
      o.delivered_views > 0
        ? ((spendUsd * usdToInr) / o.delivered_views) * 100
        : 0;

    const grossProfitInr = om.grossProfitInr !== undefined
      ? om.grossProfitInr
      : om.revenueInr - realCashCostInr + om.overDeliveryLossInr;

    const netProfitInr = om.netProfitInr !== undefined
      ? om.netProfitInr
      : om.revenueInr - realCashCostInr;

    return {
      order: o,
      accountName: account?.name || "Unassigned",
      clientName: client?.name || "Client",
      videoTitle: o.video_title,
      videoUrl: o.video_url || o.video_link || "",
      date: o.date,
      orderedViews: om.orderedViews,
      deliveredViews: om.deliveredViews,
      overDeliveryViews: om.overDeliveryViews,
      clientRatePaise: o.client_rate_paise_per_view,
      revenueInr: om.revenueInr,
      spendUsd: spendUsd,
      realCashCostInr: Number(realCashCostInr.toFixed(2)),
      costPerViewPaise: Number(costPerViewPaise.toFixed(3)),
      cashCostPerViewPaise: Number(cashCostPerViewPaise.toFixed(3)),
      grossProfitInr: Number(grossProfitInr.toFixed(2)),
      overDeliveryLossInr: om.overDeliveryLossInr,
      netProfitInr: Number(netProfitInr.toFixed(2)),
      status: o.status,
      isOverDelivered: om.isOverDelivered,
    };
  });

  // Summary Totals
  const totalRevenueInr = reportRows.reduce((sum, r) => sum + r.revenueInr, 0);
  const totalSpendUsd = reportRows.reduce((sum, r) => sum + r.spendUsd, 0);
  const totalOverDeliveryLossInr = reportRows.reduce(
    (sum, r) => sum + r.overDeliveryLossInr,
    0
  );
  const totalNetProfitInr = reportRows.reduce(
    (sum, r) => sum + r.netProfitInr,
    0
  );
  const avgMarginPercent =
    totalRevenueInr > 0 ? (totalNetProfitInr / totalRevenueInr) * 100 : 0;

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Client",
      "Account",
      "Video Title",
      "Video URL",
      "Ordered Views",
      "Delivered Views",
      "Over-Delivery Views",
      "Client Rate (Paise)",
      "Revenue (INR)",
      "Spend (USD)",
      "Real Cash Cost (INR)",
      "Cost/View (Paise)",
      "Gross Profit (INR)",
      "Over-delivery Loss (INR)",
      "Net Profit (INR)",
      "Status",
    ];

    const csvRows = [headers.join(",")];
    reportRows.forEach((r) => {
      const row = [
        r.date,
        `"${r.clientName.replace(/"/g, '""')}"`,
        `"${r.accountName.replace(/"/g, '""')}"`,
        `"${r.videoTitle.replace(/"/g, '""')}"`,
        `"${(r.videoUrl || "").replace(/"/g, '""')}"`,
        r.orderedViews,
        r.deliveredViews,
        r.overDeliveryViews,
        r.clientRatePaise,
        r.revenueInr,
        r.spendUsd,
        r.realCashCostInr,
        r.costPerViewPaise,
        r.grossProfitInr,
        r.overDeliveryLossInr,
        r.netProfitInr,
        r.status,
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Promo_CRM_Executive_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          nav,
          header,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-full {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Financial & Profit Report
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {reportRows.length} Orders
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete executive accounting audit with gross profit, over-delivery
            waste, and net profit.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Filter className="w-4 h-4" />
            <span>Filters:</span>
          </div>

          {/* Account Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Account:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Date Range:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>
        </div>

        <div className="text-slate-500 font-mono text-[11px]">
          Exchange: $1 USD = ₹{usdToInr} INR
        </div>
      </div>

      {/* Summary KPI Cards Grid (Requirement B.5) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Revenue */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
            Total Revenue
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            ₹{totalRevenueInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[10px] text-slate-500">Billed to clients</span>
        </div>

        {/* Total Spend */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
            Total Ad Spend
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            ${totalSpendUsd.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">
            ₹{(totalSpendUsd * usdToInr).toLocaleString("en-IN", { maximumFractionDigits: 0 })} INR
          </span>
        </div>

        {/* Over-Delivery Loss (Distinct Number) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-500/30 dark:border-red-900/60 bg-red-50/20">
          <span className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Over-Delivery Loss
          </span>
          <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            ₹{totalOverDeliveryLossInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[10px] text-red-500/80">
            Wasted extra views delivered
          </span>
        </div>

        {/* Net Real Profit (Distinct Number) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-900/60 bg-emerald-50/20">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Net Real Profit
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{totalNetProfitInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[10px] text-emerald-600/80">
            Actual in-pocket margin
          </span>
        </div>

        {/* Average Margin % */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2 lg:col-span-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">
            Avg Profit Margin
          </span>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {avgMarginPercent.toFixed(1)}%
          </div>
          <span className="text-[10px] text-slate-500">Margin on revenue</span>
        </div>
      </div>

      {/* Comprehensive Report Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">Video Title</th>
                <th className="py-3 px-3 text-right">Ordered Views</th>
                <th className="py-3 px-3 text-right">Delivered</th>
                <th className="py-3 px-3 text-right">Over-Delivered</th>
                <th className="py-3 px-3 text-right">Rate</th>
                <th className="py-3 px-3 text-right">Revenue (INR)</th>
                <th className="py-3 px-3 text-right">Spend (USD)</th>
                <th className="py-3 px-3 text-right">Cost/View</th>
                <th className="py-3 px-3 text-right">Gross Profit</th>
                <th className="py-3 px-3 text-right">Over-Deliv Loss</th>
                <th className="py-3 px-3 text-right">Net Profit</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {reportRows.map((r) => (
                <tr
                  key={r.order.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition font-sans"
                >
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {r.date}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white max-w-[130px] truncate">
                    {r.clientName}
                  </td>
                  <td className="py-3 px-3 max-w-[200px] truncate text-slate-700 dark:text-slate-300">
                    {r.videoUrl ? (
                      <a
                        href={r.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1 truncate max-w-full"
                        title={r.videoTitle}
                      >
                        <span className="truncate">{r.videoTitle}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span title={r.videoTitle}>{r.videoTitle}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {r.orderedViews.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {r.deliveredViews.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {r.overDeliveryViews > 0 ? (
                      <span className="text-red-600 font-bold">
                        +{r.overDeliveryViews.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {r.clientRatePaise}p
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ₹{r.revenueInr.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    ${r.spendUsd.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {r.costPerViewPaise.toFixed(2)}p
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                    ₹{r.grossProfitInr.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {r.overDeliveryLossInr > 0 ? (
                      <span className="text-red-600 font-bold">
                        -₹{r.overDeliveryLossInr.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-400">₹0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{r.netProfitInr.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {r.isOverDelivered ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                        Over-delivered
                      </span>
                    ) : r.status === "completed" ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        Completed
                      </span>
                    ) : r.status === "alert_85" ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        85% Alert
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        Running
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
