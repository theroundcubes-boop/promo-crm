"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Eye,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  Building,
  User,
  MessageCircle,
  Inbox,
  AlertCircle,
  Save,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import {
  calculateAccountMetrics,
  calculateDashboardMetrics,
  calculateOrderMetrics,
} from "@/lib/calculations";
import { Order, Account, Client } from "@/lib/types";

export default function DashboardPage() {
  const [state, setState] = useState<AppState>(mockStore.getState());
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // State for inline "Needs your input" accounts
  const [inputInputs, setInputInputs] = useState<
    Record<string, { cash: string; credit: string }>
  >({});

  useEffect(() => {
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  const { settings, accounts, orders, clients, unlinkedCampaigns } = state;
  const metrics = calculateDashboardMetrics(
    accounts,
    orders,
    settings.usd_to_inr,
    settings.alert_threshold_percent
  );

  // Accounts needing cash/credit input
  const accountsNeedingInput = accounts.filter(
    (a) =>
      a.needs_input || (a.cash_paid_usd === 0 && a.credit_offered_usd === 0)
  );

  // Initialize input fields for accounts needing input
  useEffect(() => {
    const map: Record<string, { cash: string; credit: string }> = {};
    accountsNeedingInput.forEach((acc) => {
      map[acc.id] = {
        cash: acc.cash_paid_usd > 0 ? String(acc.cash_paid_usd) : "",
        credit: acc.credit_offered_usd > 0 ? String(acc.credit_offered_usd) : "",
      };
    });
    setInputInputs((prev) => ({ ...map, ...prev }));
  }, [accountsNeedingInput.length]);

  const handleSaveAccountInput = (accId: string) => {
    const input = inputInputs[accId] || { cash: "0", credit: "0" };
    const cash = parseFloat(input.cash) || 0;
    const credit = parseFloat(input.credit) || 0;

    mockStore.updateAccount(accId, {
      cash_paid_usd: cash,
      credit_offered_usd: credit,
      needs_input: false,
    });
    setSyncFeedback("Account cash & promo credit updated! Realized leverage calculated.");
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  // Orders at >= 85% needing urgent attention
  const urgentOrders = orders.filter((o) => {
    const m = calculateOrderMetrics(o, settings.alert_threshold_percent);
    return m.isAlert85 && o.status !== "completed";
  });

  // Orders that over-delivered (> 100%)
  const overDeliveredOrders = orders.filter((o) => {
    const m = calculateOrderMetrics(o, settings.alert_threshold_percent);
    return m.isOverDelivered;
  });

  // Accounts with overdue/paused/suspended status
  const attentionAccounts = accounts.filter(
    (a) =>
      a.status === "overdue" ||
      a.status === "paused" ||
      a.status === "suspended"
  );

  // Quick Action: Pause an order
  const handleQuickPause = (orderId: string) => {
    mockStore.updateOrder(orderId, { status: "paused" });
  };

  // Quick Action: Run demo sync simulation
  const handleRunDemoSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);

    setTimeout(() => {
      if (orders.length > 0) {
        const target = orders[0];
        const newViews = target.delivered_views + 2000;
        const newSpend = target.spend_usd + 0.5;

        mockStore.updateOrder(target.id, {
          delivered_views: newViews,
          spend_usd: Number(newSpend.toFixed(2)),
        });

        mockStore.addNotification({
          type: "sync",
          title: "Google Ads MCC Script Synced",
          message: `Campaign "${target.campaign_id}" updated: ${newViews.toLocaleString()} views, $${newSpend.toFixed(
            2
          )} spend.`,
        });
      }

      setSyncing(false);
      setSyncFeedback("Sync complete! Updated live views & spend.");
      setTimeout(() => setSyncFeedback(null), 3000);
    }, 600);
  };

  const latestSync = state.syncLogs && state.syncLogs.length > 0 ? state.syncLogs[0] : null;
  const formatSyncTime = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-brand-900/40 via-indigo-950/40 to-slate-900/60 p-5 rounded-2xl border border-brand-500/20 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Agency Dashboard
            </h1>
            {/* Real sync status badge (Requirement 7) */}
            {latestSync ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Last sync: {formatSyncTime(latestSync.timestamp)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                No sync yet
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Real cash margin accounting across Google Ads MCC accounts & promo
            threshold credits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hide simulate sync in real mode (Requirement 7) */}
          {state.isDemoUser && (
            <button
              onClick={handleRunDemoSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Simulate Script Sync"}
            </button>
          )}

          <Link
            href="/orders?new=true"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition"
          >
            <Plus className="w-4 h-4" />
            New Order
          </Link>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between animate-in">
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Empty-State Guide for New Users (Requirement 3) */}
      {accounts.length === 0 && (
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 animate-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-brand-500/25">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Welcome to Promo CRM! Let&apos;s get your agency set up
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                You are in real mode with your Supabase account. Start tracking YouTube video promotions, true cash margins, and promo spend thresholds with these quick steps.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md border border-brand-200 dark:border-brand-800 inline-block mb-2">
                  Step 1 • Manual Setup
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Add your first account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Enter your Google Ads 10-digit CID, initial cash paid, and promised promo credit (e.g. $10 cash, $50 threshold credit).
                </p>
              </div>
              <Link
                href="/accounts?new=true"
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Google Ads Sub-Account
              </Link>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 inline-block mb-2">
                  Step 2 • Automated Sync
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Import from Google Ads script
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Copy our ready-to-run Google Ads MCC script into your Google Ads Manager account. It syncs spend, views, and auto-pauses at 85%.
                </p>
              </div>
              <Link
                href="/settings"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition flex items-center justify-center gap-2 shadow-sm"
              >
                Go to Script Settings &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Requirement B.4: Data Completeness Widget */}
      {((unlinkedCampaigns && unlinkedCampaigns.length > 0) ||
        accountsNeedingInput.length > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Data Completeness: Action Needed ({unlinkedCampaigns?.length || 0 + accountsNeedingInput.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {unlinkedCampaigns && unlinkedCampaigns.length > 0 && (
              <Link
                href="/import"
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 hover:border-amber-500 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {unlinkedCampaigns.length} Unlinked Campaigns in Inbox
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Discovered by Google Ads script. Tap to convert.
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition" />
              </Link>
            )}

            {accountsNeedingInput.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {accountsNeedingInput.length} Account(s) Need Financial Details
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Enter cash paid & promo credit to calculate leverage.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Requirement B.4: Prominent "Needs Your Input" Cards for Accounts */}
      {accountsNeedingInput.length > 0 && (
        <div className="space-y-3">
          {accountsNeedingInput.map((acc) => (
            <div
              key={acc.id}
              className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/50 dark:border-amber-500/40 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">
                      Input Required
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {acc.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Needs your input: How much did you pay for this sub-account,
                    and what promo credit did Google give you?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Customer ID: {acc.google_ads_customer_id} • Status: {acc.status}
                  </p>
                </div>

                {/* Responsive 2-field form with Save button */}
                <div className="grid grid-cols-2 sm:flex sm:items-end gap-2 text-xs w-full sm:w-auto">
                  <div className="w-full sm:w-28">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      Cash Paid ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 80.00"
                      value={inputInputs[acc.id]?.cash ?? ""}
                      onChange={(e) =>
                        setInputInputs({
                          ...inputInputs,
                          [acc.id]: {
                            cash: e.target.value,
                            credit: inputInputs[acc.id]?.credit ?? "",
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div className="w-full sm:w-28">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      Credit ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 100.00"
                      value={inputInputs[acc.id]?.credit ?? ""}
                      onChange={(e) =>
                        setInputInputs({
                          ...inputInputs,
                          [acc.id]: {
                            cash: inputInputs[acc.id]?.cash ?? "",
                            credit: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <button
                    onClick={() => handleSaveAccountInput(acc.id)}
                    className="col-span-2 sm:col-span-1 py-2 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Financials</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requirement C.1: 3 Distinct Numbers (Gross Profit, Over-Delivery Loss, Net Real Profit) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Gross Profit */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-brand-500/40 transition">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">Gross Profit</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Pre-waste
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ₹{metrics.totalGrossProfitInr.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Profit earned before over-delivery view waste
          </p>
        </div>

        {/* Over-Delivery Loss (Red Distinct Card) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-500/40 dark:border-red-600/50 shadow-sm relative overflow-hidden group hover:border-red-500 transition">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-1">
            <span className="text-xs font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Over-Delivery Loss
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold">
              Unbilled Waste
            </span>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            ₹{metrics.totalOverDeliveryLossInr.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-1">
            Wasted cash on extra views client didn't pay for
          </p>
        </div>

        {/* Net Real Profit (Emerald Distinct Card) */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-sm relative overflow-hidden group hover:border-emerald-500 transition">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
            <span className="text-xs font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Net Real Profit
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
              In-Pocket
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ₹{metrics.totalNetProfitInr.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            Actual margin (Gross ₹{metrics.totalGrossProfitInr.toFixed(0)} - Loss ₹{metrics.totalOverDeliveryLossInr.toFixed(0)})
          </p>
        </div>
      </div>

      {/* KPI Metric Cards Grid - Secondary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Client Revenue INR */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Revenue</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            ₹{metrics.totalRevenueInr.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            From {metrics.totalDeliveredViews.toLocaleString()} delivered views
          </p>
        </div>

        {/* Real Cash Deposited */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Real Cash Paid</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            ${metrics.totalCashPaidUsd.toFixed(0)}{" "}
            <span className="text-xs font-normal text-slate-500">
              (₹{metrics.totalRealCashInr.toLocaleString("en-IN")})
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Actual cash out-of-pocket
          </p>
        </div>

        {/* Realized Leverage */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Realized Leverage
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ${metrics.totalRealizedLeverageUsd.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Free Google promo credit active
          </p>
        </div>

        {/* Leverage Lost */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              Leverage Lost
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-500">
            ${metrics.totalLeverageLostUsd.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Trapped in stopped sub-accounts
          </p>
        </div>
      </div>

      {/* Urgent Section 1: Orders at 85%+ (PAUSE NOW!) */}
      {urgentOrders.length > 0 && (
        <div className="p-5 rounded-2xl bg-red-50/90 dark:bg-red-950/30 border-2 border-red-500/60 dark:border-red-600/70 shadow-lg shadow-red-500/10 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-600 text-white animate-urgent">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
                  CRITICAL: Orders at 85%+ Progress (Pause Now!)
                </h2>
                <p className="text-[11px] text-red-700 dark:text-red-300">
                  Threshold reached. Pause the campaign to avoid overdelivering and
                  eating into profit margin.
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white">
              {urgentOrders.length} Urgent
            </span>
          </div>

          <div className="space-y-2.5">
            {urgentOrders.map((order) => {
              const om = calculateOrderMetrics(
                order,
                settings.alert_threshold_percent
              );
              const client = clients.find((c) => c.id === order.client_id);
              const account = accounts.find((a) => a.id === order.account_id);

              return (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {order.video_title}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white uppercase tracking-wider animate-pulse">
                        Pause Now! ({om.progressPercent}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Client: {client?.name || "Client"}</span>
                      <span>•</span>
                      <span>Account: {account?.name || "MCC Sub"}</span>
                      <span>•</span>
                      <span>
                        {order.delivered_views.toLocaleString()} /{" "}
                        {order.order_size_views.toLocaleString()} views
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleQuickPause(order.id)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5 transition"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      Pause Order
                    </button>
                    <Link
                      href={`/orders`}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section: Over-Delivered Orders Warning */}
      {overDeliveredOrders.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500 text-white">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Over-Delivered Orders ({overDeliveredOrders.length})
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Delivered views exceeded order size. Client is not charged for
                  excess views. Pause campaign in Google Ads!
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {overDeliveredOrders.map((o) => {
              const acc = accounts.find((a) => a.id === o.account_id);
              const accM = acc
                ? calculateAccountMetrics(acc, orders, settings.usd_to_inr)
                : null;
              const om = calculateOrderMetrics(
                o,
                settings.alert_threshold_percent,
                accM?.cashCostPerViewPaise || 1.5
              );

              return (
                <div
                  key={o.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {o.video_title}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      [{o.campaign_id}]
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>
                        Target: {o.order_size_views.toLocaleString()} views
                      </span>
                      <span>•</span>
                      <span>
                        Delivered: {o.delivered_views.toLocaleString()} views
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                      Over-delivered: +{om.overDeliveryViews.toLocaleString()} views (-₹{om.overDeliveryLossInr.toFixed(0)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
