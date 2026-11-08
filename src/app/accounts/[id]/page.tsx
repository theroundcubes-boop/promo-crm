"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building,
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Info,
  Plus,
  Play,
  Pause,
  Save,
  Trash2,
  Video,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import {
  calculateAccountMetrics,
  calculateOrderMetrics,
} from "@/lib/calculations";
import { Account, AccountStatus, Order, formatCustomerId } from "@/lib/types";

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const accountId = resolvedParams.id;

  const [state, setState] = useState<AppState>(mockStore.getState());
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [creditOffered, setCreditOffered] = useState<number>(0);
  const [status, setStatus] = useState<AccountStatus>("active");
  const [notes, setNotes] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  const account = state.accounts.find((a) => a.id === accountId);
  const accountOrders = state.orders.filter((o) => o.account_id === accountId);

  useEffect(() => {
    if (account) {
      setCashPaid(account.cash_paid_usd);
      setCreditOffered(account.credit_offered_usd);
      setStatus(account.status);
      setNotes(account.notes || "");
    }
  }, [account]);

  if (!account) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-slate-500">Account not found.</p>
        <Link
          href="/accounts"
          className="text-xs text-brand-600 font-bold hover:underline mt-2 inline-block"
        >
          Return to accounts
        </Link>
      </div>
    );
  }

  const metrics = calculateAccountMetrics(
    account,
    state.orders,
    state.settings.usd_to_inr,
    state.settings.alert_threshold_percent
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    mockStore.updateAccount(accountId, {
      cash_paid_usd: Number(cashPaid),
      credit_offered_usd: Number(creditOffered),
      status,
      notes,
    });
    setEditing(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this account and all associated orders?"
      )
    ) {
      mockStore.deleteAccount(accountId);
      router.push("/accounts");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/accounts"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {account.name}
              </h1>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  account.status === "active"
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                }`}
              >
                {account.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              CID: <span className="font-mono">{formatCustomerId(account.google_ads_customer_id)}</span> • Email: {account.account_email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            {editing ? "Cancel Editing" : "Edit Financials & Status"}
          </button>

          <Link
            href={`/orders?new=true&account_id=${account.id}`}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Order to Account
          </Link>
        </div>
      </div>

      {savedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Account details updated successfully!
        </div>
      )}

      {/* Requirement B.4: Prominent "Needs Your Input" Card */}
      {(account.needs_input || (account.cash_paid_usd === 0 && account.credit_offered_usd === 0)) && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/60 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white">
                Input Required
              </span>
              <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1">
                Needs your input: How much did you pay for this sub-account, and what promo credit did Google give you?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Once entered, Promo CRM calculates realized leverage and unit margins immediately.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-end gap-2 text-xs w-full sm:w-auto">
              <div className="w-full sm:w-28">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Cash Paid ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cashPaid || ""}
                  onChange={(e) => setCashPaid(Number(e.target.value))}
                  placeholder="e.g. 80"
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
              <div className="w-full sm:w-28">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Credit ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={creditOffered || ""}
                  onChange={(e) => setCreditOffered(Number(e.target.value))}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="col-span-2 sm:col-span-1 py-2 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Financials</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Drawer */}
      {editing && (
        <form
          onSubmit={handleSave}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-brand-500/40 shadow-lg space-y-4 animate-in"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Update Billing & Status
            </h2>
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-red-600 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Account
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cash Paid ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={cashPaid}
                onChange={(e) => setCashPaid(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Credit Offered ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={creditOffered}
                onChange={(e) => setCreditOffered(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AccountStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="active">Active (Normal running)</option>
                <option value="overdue">Overdue (Card declined / past due)</option>
                <option value="paused">Paused (Make a payment notice)</option>
                <option value="suspended">Suspended (Policy stop)</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Card payment cleared, promo credit active."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* 3 Distinct Numbers (Gross Profit, Over-Delivery Loss, Net Real Profit) - Section C */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Gross Profit */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-between mb-1">
            <span>Gross Profit</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Pre-waste
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ₹{metrics.grossProfitInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Revenue if no over-delivery waste
          </p>
        </div>

        {/* Over-Delivery Loss (Red Card) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-500/40 dark:border-red-600/50 shadow-sm">
          <div className="text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between mb-1">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Over-delivery loss: ₹{metrics.totalOverDeliveryLossInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold">
              Unbilled Waste
            </span>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            ₹{metrics.totalOverDeliveryLossInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-red-600/80 dark:text-red-400/80 mt-1">
            {metrics.totalOverDeliveryViews.toLocaleString()} views delivered beyond order caps
          </p>
        </div>

        {/* Net Real Profit (Emerald Card) */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/50 dark:border-emerald-500/40 shadow-sm">
          <div className="text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between mb-1">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Net Real Profit
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
              In-Pocket
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ₹{metrics.netProfitInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            Revenue ₹{metrics.totalRevenueInr.toFixed(0)} - Real Cash ₹{metrics.realCashInr.toFixed(0)}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid - Financials & Leverage */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Real Cash Deposited INR */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-between mb-1">
            <span>Real Cash Deposited</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ${account.cash_paid_usd}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            ₹{metrics.realCashInr.toLocaleString()} INR (@ ₹{state.settings.usd_to_inr}/$)
          </p>
        </div>

        {/* Realized Leverage */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-between mb-1">
            <span>Realized Leverage</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ${metrics.realizedLeverageUsd.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {account.status === "active" ? "Full promo credit active" : "Leverage captured so far"}
          </p>
        </div>

        {/* Leverage Lost / Credit Left */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-between mb-1">
            <span>{account.status === "active" ? "Credit Left" : "Leverage Lost"}</span>
            {account.status === "active" ? (
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <div
            className={`text-2xl font-black ${
              account.status === "active"
                ? "text-slate-900 dark:text-white"
                : "text-red-500"
            }`}
          >
            $
            {account.status === "active"
              ? metrics.creditLeftUsd.toFixed(2)
              : metrics.leverageLostUsd.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {account.status === "active"
              ? "Available spend before refill"
              : "Trapped credit (pay to unlock)"}
          </p>
        </div>

        {/* Total Views Delivered */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-between mb-1">
            <span>Delivered Views</span>
            <Video className="w-4 h-4 text-brand-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {metrics.totalDeliveredViews.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Across {accountOrders.length} orders
          </p>
        </div>
      </div>

      {/* Advanced Unit Economics Cards (Paise per view) */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
        <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
          Unit Economics Breakdown (Paise / View)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] block">Total Cost / View</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {metrics.totalCostPerViewPaise} paise
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              total spend * usd_to_inr / views
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] block">Cash Cost / View</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.cashCostPerViewPaise} paise
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              real cash deposited / views
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] block">Avg Client Rate</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {metrics.avgClientRatePaise} paise
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              sold price per view
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 text-[10px] block">Total Spend</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              ${metrics.totalSpendUsd} USD
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Across {accountOrders.length} orders
            </span>
          </div>
        </div>
      </div>

      {/* Orders in this Account */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-brand-500" />
              Orders in this Account ({accountOrders.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              When an order finishes, leftover credit remains in this account for the next order.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {accountOrders.map((order) => {
            const om = calculateOrderMetrics(
              order,
              state.settings.alert_threshold_percent,
              metrics.cashCostPerViewPaise
            );
            const client = state.clients.find((c) => c.id === order.client_id);

            return (
              <div
                key={order.id}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition ${
                  om.isOverDelivered
                    ? "border-red-400 dark:border-red-900/80 shadow-md shadow-red-500/10"
                    : om.isAlert85 && order.status !== "completed"
                    ? "border-amber-400 dark:border-amber-900/80"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {order.video_title}
                      </span>
                      {om.isOverDelivered ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white uppercase tracking-wider">
                          Over-delivered: +{om.overDeliveryViews.toLocaleString()} views (-₹{om.overDeliveryLossInr.toFixed(2)} loss)
                        </span>
                      ) : om.isAlert85 && order.status !== "completed" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white uppercase">
                          Pause Now! ({om.progressPercent}%)
                        </span>
                      ) : null}
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Client: {client?.name || "Client"}</span>
                      <span>•</span>
                      <span>Campaign ID: {order.campaign_id}</span>
                      <span>•</span>
                      <span>Rate: {order.client_rate_paise_per_view}p / view</span>
                    </div>

                    {/* Progress Bar (Capped at 100% with red overflow if over-delivered) */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-2 flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          om.isOverDelivered
                            ? "bg-amber-500"
                            : om.isAlert85
                            ? "bg-red-600"
                            : "bg-brand-600"
                        }`}
                        style={{ width: `${om.cappedProgressPercent}%` }}
                      />
                      {om.isOverDelivered && (
                        <div
                          className="h-full bg-red-600 animate-pulse"
                          style={{ width: `${Math.min(30, om.progressPercent - 100)}%` }}
                          title={`Over-delivered by ${om.overDeliveryViews.toLocaleString()} views`}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center flex-shrink-0 text-right">
                    <div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {order.delivered_views.toLocaleString()} /{" "}
                        {order.order_size_views.toLocaleString()} views
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        Revenue: ₹{om.revenueInr.toLocaleString()} (Capped) • Spend: ${order.spend_usd}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {accountOrders.length === 0 && (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              No orders assigned to this account yet. Click &quot;Add Order to Account&quot; to assign one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
