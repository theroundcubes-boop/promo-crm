"use client";

import React, { useEffect, useState } from "react";
import {
  Inbox,
  Sparkles,
  CheckCircle2,
  XCircle,
  Eye,
  DollarSign,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  HelpCircle,
  Video,
  Layers,
  ChevronRight,
} from "lucide-react";
import { mockStore, AppState } from "@/lib/storage/mock-store";
import { UnlinkedCampaign, Client, formatCustomerId } from "@/lib/types";

export default function ImportInboxPage() {
  const [state, setState] = useState<AppState>(() => mockStore.getState());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeModalCampaign, setActiveModalCampaign] =
    useState<UnlinkedCampaign | null>(null);

  // Modal / Conversion Form State
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [orderSize, setOrderSize] = useState<number>(100000);
  const [clientRatePaise, setClientRatePaise] = useState<number>(2.0);
  const [customRate, setCustomRate] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState("");

  // Bulk Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkClientId, setBulkClientId] = useState("");
  const [bulkRatePaise, setBulkRatePaise] = useState<number>(2.0);

  useEffect(() => {
    return mockStore.subscribe(() => {
      setState({ ...mockStore.getState() });
    });
  }, []);

  const unlinked = state.unlinkedCampaigns || [];
  const clients = state.clients || [];

  // Helper to parse smart guesses from campaign name
  const parseSmartGuesses = (campaign: UnlinkedCampaign) => {
    const name = campaign.campaign_name || "";
    const lower = name.toLowerCase();

    // 1. Order code
    const codeMatch = name.match(/\bORD-(\d{1,6})\b/i);
    const detectedCode = codeMatch ? `ORD-${codeMatch[1]}`.toUpperCase() : null;

    // 2. Order size
    let guessedSize = 100000;
    if (lower.includes("50k") || lower.includes("50,000")) guessedSize = 50000;
    else if (lower.includes("100k") || lower.includes("100,000"))
      guessedSize = 100000;
    else if (lower.includes("200k") || lower.includes("200,000"))
      guessedSize = 200000;
    else if (lower.includes("500k") || lower.includes("500,000"))
      guessedSize = 500000;
    else if (lower.includes("1m") || lower.includes("1,000,000"))
      guessedSize = 1000000;
    else if (campaign.views > 0) {
      // nearest round number above views
      if (campaign.views <= 55000) guessedSize = 50000;
      else if (campaign.views <= 110000) guessedSize = 100000;
      else if (campaign.views <= 215000) guessedSize = 200000;
      else guessedSize = Math.ceil(campaign.views / 50000) * 50000;
    }

    // 3. Client rate paise
    let guessedRate = 2.0;
    if (lower.includes("1.4p") || lower.includes("1.4 paise")) guessedRate = 1.4;
    else if (lower.includes("2p") || lower.includes("2 paise"))
      guessedRate = 2.0;
    else if (lower.includes("2.5p") || lower.includes("2.5 paise"))
      guessedRate = 2.5;
    else if (lower.includes("3p") || lower.includes("3 paise"))
      guessedRate = 3.0;

    // 4. Try matching existing client name in campaign text
    let matchedClientId = "";
    for (const c of clients) {
      const parts = c.name.toLowerCase().split(" ");
      if (parts.some((p) => p.length > 3 && lower.includes(p))) {
        matchedClientId = c.id;
        break;
      }
    }
    if (!matchedClientId && clients.length > 0) {
      matchedClientId = clients[0].id;
    }

    return {
      detectedCode,
      guessedSize,
      guessedRate,
      matchedClientId,
    };
  };

  const handleOpenConvert = (camp: UnlinkedCampaign) => {
    const guesses = parseSmartGuesses(camp);
    setActiveModalCampaign(camp);
    setClientId(guesses.matchedClientId || (clients[0]?.id || ""));
    setNewClientName("");
    setOrderSize(guesses.guessedSize);
    setClientRatePaise(guesses.guessedRate);
    setCustomRate("");
    setVideoTitle(camp.campaign_name);
  };

  const handleConfirmConvert = async () => {
    if (!activeModalCampaign) return;

    let targetClientId = clientId;
    if (clientId === "new" && newClientName.trim()) {
      const newCli = await mockStore.addClient({
        name: newClientName.trim(),
        whatsapp_number: "+91",
        notes: "Created during campaign conversion",
      });
      targetClientId = newCli.id;
    }

    const rate = customRate ? parseFloat(customRate) : clientRatePaise;

    await mockStore.convertUnlinkedToOrder(activeModalCampaign.id, {
      client_id: targetClientId,
      video_title: videoTitle || activeModalCampaign.campaign_name,
      order_size_views: orderSize,
      client_rate_paise_per_view: rate,
    });

    setActiveModalCampaign(null);
  };

  const handleDismiss = async (id: string) => {
    await mockStore.dismissUnlinkedCampaign(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === unlinked.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unlinked.map((c) => c.id)));
    }
  };

  const handleBulkConvert = async () => {
    if (selectedIds.size === 0 || !bulkClientId) return;
    await mockStore.bulkConvertUnlinked(
      Array.from(selectedIds),
      bulkClientId,
      bulkRatePaise
    );
    setSelectedIds(new Set());
    setShowBulkModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5">
              <Inbox className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Import Inbox
                </h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  {unlinked.length} Pending
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Video campaigns discovered by Google Ads MCC Script that aren't
                yet linked to an order. Smart AI guesses client, size, and rate.
              </p>
            </div>
          </div>

          {unlinked.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => {
                  setBulkClientId(clients[0]?.id || "");
                  setShowBulkModal(true);
                }}
                disabled={selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  selectedIds.size > 0
                    ? "bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-500/20"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Bulk Convert ({selectedIds.size})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Campaign List */}
      {unlinked.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Inbox is Clear!
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            All Google Ads video campaigns are linked to active orders. New
            campaigns discovered by your MCC script will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* List Controls */}
          <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            >
              {selectedIds.size === unlinked.length ? (
                <CheckSquare className="w-4 h-4 text-brand-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>
                {selectedIds.size === unlinked.length
                  ? "Deselect All"
                  : "Select All"}
              </span>
            </button>
            <span>Showing {unlinked.length} unlinked campaigns</span>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 gap-3">
            {unlinked.map((camp) => {
              const isSelected = selectedIds.has(camp.id);
              const guesses = parseSmartGuesses(camp);

              return (
                <div
                  key={camp.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 sm:p-5 transition hover:shadow-md ${
                    isSelected
                      ? "border-brand-500 ring-1 ring-brand-500"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleSelect(camp.id)}
                        className="mt-1 text-slate-400 hover:text-brand-500 transition"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-brand-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {camp.account_name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            ID: {formatCustomerId(camp.customer_id)}
                          </span>
                          {camp.status === "PAUSED" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              PAUSED
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                              ACTIVE
                            </span>
                          )}
                          {guesses.detectedCode && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                              {guesses.detectedCode}
                            </span>
                          )}
                        </div>

                        <h4 className="font-semibold text-slate-900 dark:text-white text-base truncate">
                          {camp.campaign_name}
                        </h4>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            {camp.views.toLocaleString()} views
                          </span>
                          <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                            ${camp.cost_usd.toFixed(2)} USD
                          </span>
                          <span className="text-[11px]">
                            Range: {camp.date_range || "ALL_TIME"}
                          </span>
                        </div>

                        {/* Smart Guess Pill */}
                        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Smart guess:{" "}
                            <strong>
                              {(guesses.guessedSize / 1000).toFixed(0)}k views
                            </strong>{" "}
                            @ <strong>{guesses.guessedRate}p</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleDismiss(camp.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleOpenConvert(camp)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/20 transition"
                      >
                        <span>Convert to Order</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Convert to Order Modal */}
      {activeModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Convert to Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Linking campaign {activeModalCampaign.campaign_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalCampaign(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Campaign Info summary */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <p className="text-slate-600 dark:text-slate-300 font-medium truncate">
                  {activeModalCampaign.campaign_name}
                </p>
                <div className="flex items-center gap-3 text-slate-500">
                  <span>{activeModalCampaign.account_name}</span>
                  <span>•</span>
                  <span>
                    {activeModalCampaign.views.toLocaleString()} delivered views
                  </span>
                  <span>•</span>
                  <span>${activeModalCampaign.cost_usd.toFixed(2)} spend</span>
                </div>
              </div>

              {/* Video Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Order Video Title
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Client Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Client
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.whatsapp_number})
                    </option>
                  ))}
                  <option value="new">+ Create New Client...</option>
                </select>

                {clientId === "new" && (
                  <input
                    type="text"
                    placeholder="Enter new client full name"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                )}
              </div>

              {/* Order Size Views */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ordered Size (Views)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[50000, 100000, 200000, 1000000].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setOrderSize(size)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition border ${
                        orderSize === size
                          ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {size >= 1000000 ? "1M" : `${size / 1000}k`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={orderSize}
                  onChange={(e) => setOrderSize(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Client Rate Paise */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client Rate (Paise per view)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1.4, 2.0, 2.5, 3.0].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setClientRatePaise(rate);
                        setCustomRate("");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition border ${
                        clientRatePaise === rate && !customRate
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {rate}p
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Or custom rate in paise (e.g. 1.85)"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModalCampaign(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20"
              >
                Save & Link Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Conversion Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Bulk Convert ({selectedIds.size} Campaigns)
            </h3>
            <p className="text-xs text-slate-500">
              Assign the selected campaigns to a client and rate. Order size
              will be smart-guessed from campaign titles (e.g. 50k, 100k, 1M).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Assign to Client
                </label>
                <select
                  value={bulkClientId}
                  onChange={(e) => setBulkClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Client Rate (Paise)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1.4, 2.0, 2.5, 3.0].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBulkRatePaise(r)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border ${
                        bulkRatePaise === r
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {r}p
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkConvert}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white"
              >
                Convert All {selectedIds.size}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
