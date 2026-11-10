"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Info,
  Building,
  CheckCircle2,
  X,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { calculateAccountMetrics } from "@/lib/calculations";
import { Account, AccountStatus, formatCustomerId } from "@/lib/types";

export default function AccountsPage() {
  const [state, setState] = useState<AppState>(mockStore.getState());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCashPaid, setNewCashPaid] = useState<number>(80);
  const [newCreditOffered, setNewCreditOffered] = useState<number>(100);
  const [newStatus, setNewStatus] = useState<AccountStatus>("active");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    mockStore.refreshData();
    const unsub = mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
    return unsub;
  }, []);

  const { accounts, orders, settings } = state;

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.google_ads_customer_id.includes(search) ||
      acc.account_email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ? true : acc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCustomerId) {
      alert("Please provide account name and Google Ads customer ID");
      return;
    }

    mockStore.addAccount({
      name: newName,
      google_ads_customer_id: newCustomerId,
      account_email: newEmail || "mcc.sub@promocrm.agency",
      cash_paid_usd: Number(newCashPaid) || 0,
      credit_offered_usd: Number(newCreditOffered) || 0,
      status: newStatus,
      notes: newNotes,
    });

    // Reset & close
    setNewName("");
    setNewCustomerId("");
    setNewEmail("");
    setNewCashPaid(80);
    setNewCreditOffered(100);
    setNewNotes("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-brand-500" />
            Google Ads Sub-Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            The core accounting unit holding multiple orders under your Google Ads MCC.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/25 transition"
        >
          <Plus className="w-4 h-4" />
          Add Sub-Account
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, customer ID (XXX-XXX-XXXX), or email..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="paused">Paused</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((acc) => {
          const metrics = calculateAccountMetrics(acc, orders, settings.usd_to_inr);

          return (
            <div
              key={acc.id}
              className={`rounded-2xl p-5 bg-white dark:bg-slate-900 border transition hover:shadow-lg flex flex-col justify-between ${
                acc.status === "active"
                  ? "border-slate-200 dark:border-slate-800 hover:border-brand-500/50"
                  : "border-red-300 dark:border-red-900/60 bg-red-50/10"
              }`}
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      {acc.name}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      CID: <span className="font-mono">{formatCustomerId(acc.google_ads_customer_id)}</span>
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      acc.status === "active"
                        ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                        : "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800"
                    }`}
                  >
                    {acc.status}
                  </span>
                </div>

                {/* Profit Highlight */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Real Cash Profit
                    </span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      ₹{metrics.profitInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Orders
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {metrics.orderCount} active
                    </span>
                  </div>
                </div>

                {/* Key KPIs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Cash Deposited</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ${acc.cash_paid_usd}{" "}
                      <span className="text-[10px] text-slate-500 font-normal">
                        (₹{metrics.realCashInr.toLocaleString()})
                      </span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Credit Offered</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400">
                      ${acc.credit_offered_usd} USD
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Realized Leverage</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ${metrics.realizedLeverageUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">
                      {acc.status === "active" ? "Credit Left" : "Leverage Lost"}
                    </span>
                    <span
                      className={`font-bold ${
                        acc.status === "active"
                          ? "text-slate-900 dark:text-white"
                          : "text-red-500"
                      }`}
                    >
                      $
                      {acc.status === "active"
                        ? metrics.creditLeftUsd.toFixed(2)
                        : metrics.leverageLostUsd.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>Cost: {metrics.totalCostPerViewPaise}p / view</span>
                  <span>Delivered: {metrics.totalDeliveredViews.toLocaleString()}</span>
                </div>
              </div>

              {/* Detail CTA */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60">
                <Link
                  href={`/accounts/${acc.id}`}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-1.5 group"
                >
                  <span>Manage Account & Orders</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No accounts matching your criteria.
          </p>
        </div>
      )}

      {/* Add Sub-Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-brand-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Add Google Ads Sub-Account</h2>
                <p className="text-xs text-brand-100 mt-0.5">
                  Set up a dedicated billing sub-account under your MCC
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. MCC Account #104 (Music Campaigns)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Google Ads Customer ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerId}
                    onChange={(e) => setNewCustomerId(e.target.value)}
                    placeholder="e.g. 123-456-7890"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="mcc.sub104@agency.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cash Paid ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCashPaid}
                    onChange={(e) => setNewCashPaid(Number(e.target.value))}
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
                    value={newCreditOffered}
                    onChange={(e) => setNewCreditOffered(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="paused">Paused</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Promo spend threshold $10 -> $50 credit. Unlocked on first deposit."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-500/25"
                >
                  Create Sub-Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
